// Regression tests that DISPATCH the pagination thunks against a real store.
//
// pagination.test.js next door feeds hand-written action objects straight into
// the reducer, so it never executes the payload creator. That is why it stayed
// green while "Load earlier messages" was completely dead: the guard against a
// load already being in flight was written inside the payload creator, and
// createAsyncThunk dispatches `pending` — which sets that very flag — before
// the creator runs. Every call saw its own pending and returned early, so no
// request was ever made, in any chat, group or project thread.
//
// These tests exercise the thunk end to end with a mocked API, which is the
// only shape of test that can catch that class of bug.

import { describe, it, expect, vi, beforeEach } from "vitest";
import { configureStore } from "@reduxjs/toolkit";
import reducer, { fetchMessages, fetchOlderMessages, threadKey } from "./threadsSlice";
import * as messagingApi from "../../api/messagingApi";

// Keep the real module (threadsSlice re-exports helpers from it) and stub only
// the network call.
vi.mock("../../api/messagingApi", async (importOriginal) => ({
  ...(await importOriginal()),
  fetchMessages: vi.fn(),
  listThreads: vi.fn(async () => []),
}));

const KEY = threadKey("chat", "t1");
const msg = (id, ts) => ({ _id: id, timestamp: new Date(ts).toISOString(), message: id });
const makeStore = () => configureStore({ reducer: { threads: reducer } });

const seedPageOne = async (store, pagination = { page: 1, limit: 50, total: 137, hasMore: true }) => {
  messagingApi.fetchMessages.mockResolvedValueOnce({
    messages: [msg("m88", 8800), msg("m89", 8900)],
    pagination,
  });
  await store.dispatch(
    fetchMessages({ scope: "chat", threadId: "t1", params: { page: 1, limit: 50 } })
  );
};

beforeEach(() => vi.clearAllMocks());

describe("fetchOlderMessages (dispatched for real)", () => {
  it("actually requests the next page — the bug that made the button inert", async () => {
    const store = makeStore();
    await seedPageOne(store);
    messagingApi.fetchMessages.mockClear();

    messagingApi.fetchMessages.mockResolvedValueOnce({
      messages: [msg("m38", 3800)],
      pagination: { page: 2, limit: 50, total: 137, hasMore: true },
    });
    await store.dispatch(fetchOlderMessages({ scope: "chat", threadId: "t1" }));

    expect(messagingApi.fetchMessages).toHaveBeenCalledTimes(1);
    expect(messagingApi.fetchMessages).toHaveBeenCalledWith("chat", "t1", {
      page: 2,
      limit: 50,
    });

    const state = store.getState().threads;
    expect(state.messagesByKey[KEY].map((m) => m._id)).toEqual(["m38", "m88", "m89"]);
    expect(state.paginationByKey[KEY].page).toBe(2);
    expect(state.olderStatusByKey[KEY]).toBe("idle");
  });

  it("works the same for a project thread", async () => {
    const store = makeStore();
    messagingApi.fetchMessages.mockResolvedValueOnce({
      messages: [msg("p9", 9000)],
      pagination: { page: 1, limit: 50, total: 60, hasMore: true },
    });
    await store.dispatch(fetchMessages({ scope: "project", threadId: "p1", params: {} }));
    messagingApi.fetchMessages.mockClear();

    messagingApi.fetchMessages.mockResolvedValueOnce({
      messages: [msg("p1x", 1000)],
      pagination: { page: 2, limit: 50, total: 60, hasMore: false },
    });
    await store.dispatch(fetchOlderMessages({ scope: "project", threadId: "p1" }));

    expect(messagingApi.fetchMessages).toHaveBeenCalledWith("project", "p1", {
      page: 2,
      limit: 50,
    });
    expect(store.getState().threads.messagesByKey[threadKey("project", "p1")]).toHaveLength(2);
  });

  it("a burst of scroll events makes exactly one request", async () => {
    const store = makeStore();
    await seedPageOne(store);
    messagingApi.fetchMessages.mockClear();

    let resolve;
    messagingApi.fetchMessages.mockReturnValueOnce(
      new Promise((r) => {
        resolve = r;
      })
    );

    const calls = [
      store.dispatch(fetchOlderMessages({ scope: "chat", threadId: "t1" })),
      store.dispatch(fetchOlderMessages({ scope: "chat", threadId: "t1" })),
      store.dispatch(fetchOlderMessages({ scope: "chat", threadId: "t1" })),
    ];
    resolve({ messages: [msg("m38", 3800)], pagination: { page: 2, hasMore: false } });
    await Promise.all(calls);

    expect(messagingApi.fetchMessages).toHaveBeenCalledTimes(1);
  });

  it("does not request anything once hasMore is false", async () => {
    const store = makeStore();
    await seedPageOne(store, { page: 1, limit: 50, total: 2, hasMore: false });
    messagingApi.fetchMessages.mockClear();

    await store.dispatch(fetchOlderMessages({ scope: "chat", threadId: "t1" }));

    expect(messagingApi.fetchMessages).not.toHaveBeenCalled();
  });
});

describe("a page-1 refetch does not rewind the paging position", () => {
  it("keeps the furthest page reached, so the next load asks for page 3", async () => {
    const store = makeStore();
    await seedPageOne(store);

    messagingApi.fetchMessages.mockResolvedValueOnce({
      messages: [msg("m38", 3800)],
      pagination: { page: 2, limit: 50, total: 137, hasMore: true },
    });
    await store.dispatch(fetchOlderMessages({ scope: "chat", threadId: "t1" }));

    // A socket reconnect refetches page 1 while the user is scrolled back.
    await seedPageOne(store);
    expect(store.getState().threads.paginationByKey[KEY].page).toBe(2);

    messagingApi.fetchMessages.mockClear();
    messagingApi.fetchMessages.mockResolvedValueOnce({
      messages: [msg("m1", 100)],
      pagination: { page: 3, limit: 50, total: 137, hasMore: false },
    });
    await store.dispatch(fetchOlderMessages({ scope: "chat", threadId: "t1" }));

    expect(messagingApi.fetchMessages).toHaveBeenCalledWith("chat", "t1", {
      page: 3,
      limit: 50,
    });
  });
});
