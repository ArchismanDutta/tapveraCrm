import { describe, it, expect } from "vitest";
import reducer, { fetchMessages, fetchOlderMessages, threadKey } from "./threadsSlice";

const S = () => reducer(undefined, { type: "@@INIT" });
const KEY = threadKey("chat", "t1");
const msg = (id, ts) => ({ _id: id, timestamp: new Date(ts).toISOString(), message: id });

describe("chat pagination", () => {
  it("page 1 seeds newest messages and pagination", () => {
    const s = reducer(S(), {
      type: fetchMessages.fulfilled.type,
      payload: { key: KEY, messages: [msg("m88", 8800), msg("m89", 8900)], pagination: { page: 1, limit: 50, total: 137, hasMore: true } },
      meta: { arg: { scope: "chat", threadId: "t1" } },
    });
    expect(s.messagesByKey[KEY].map(m => m._id)).toEqual(["m88", "m89"]);
    expect(s.paginationByKey[KEY].hasMore).toBe(true);
  });

  it("older page PREPENDS in time order, does not append", () => {
    let s = reducer(S(), {
      type: fetchMessages.fulfilled.type,
      payload: { key: KEY, messages: [msg("m88", 8800), msg("m89", 8900)], pagination: { page: 1, hasMore: true } },
      meta: { arg: { scope: "chat", threadId: "t1" } },
    });
    s = reducer(s, {
      type: fetchOlderMessages.fulfilled.type,
      payload: { key: KEY, messages: [msg("m38", 3800), msg("m39", 3900)], pagination: { page: 2, hasMore: true }, skipped: false },
      meta: { arg: { scope: "chat", threadId: "t1" } },
    });
    expect(s.messagesByKey[KEY].map(m => m._id)).toEqual(["m38", "m39", "m88", "m89"]);
  });

  it("a skipped call does not clobber pagination", () => {
    let s = reducer(S(), {
      type: fetchMessages.fulfilled.type,
      payload: { key: KEY, messages: [msg("m1", 1000)], pagination: { page: 1, hasMore: true } },
      meta: { arg: { scope: "chat", threadId: "t1" } },
    });
    s = reducer(s, {
      type: fetchOlderMessages.fulfilled.type,
      payload: { key: KEY, messages: [], pagination: undefined, skipped: true },
      meta: { arg: { scope: "chat", threadId: "t1" } },
    });
    expect(s.paginationByKey[KEY].hasMore).toBe(true);
  });

  it("older loading does not blank the thread (separate status)", () => {
    let s = reducer(S(), {
      type: fetchMessages.fulfilled.type,
      payload: { key: KEY, messages: [msg("m1", 1000)], pagination: { page: 1, hasMore: true } },
      meta: { arg: { scope: "chat", threadId: "t1" } },
    });
    s = reducer(s, { type: fetchOlderMessages.pending.type, meta: { arg: { scope: "chat", threadId: "t1" } } });
    expect(s.statusByKey[KEY]).toBe("ready");
    expect(s.olderStatusByKey[KEY]).toBe("loading");
    expect(s.messagesByKey[KEY]).toHaveLength(1);
  });

  it("re-delivering an older page is idempotent", () => {
    const page2 = { key: KEY, messages: [msg("m38", 3800)], pagination: { page: 2, hasMore: false }, skipped: false };
    let s = reducer(S(), { type: fetchOlderMessages.fulfilled.type, payload: page2, meta: { arg: { scope: "chat", threadId: "t1" } } });
    s = reducer(s, { type: fetchOlderMessages.fulfilled.type, payload: page2, meta: { arg: { scope: "chat", threadId: "t1" } } });
    expect(s.messagesByKey[KEY]).toHaveLength(1);
  });
});
