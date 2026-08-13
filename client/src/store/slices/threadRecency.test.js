import { describe, it, expect } from "vitest";
import reducer, {
  receiveMessage,
  enqueueOptimistic,
  fetchThreads,
} from "./threadsSlice";

/**
 * Thread recency ordering.
 *
 * The conversation list and the DM roster both sort on the thread's timestamp.
 * That timestamp used to be written only by `fetchThreads`, so a message
 * arriving live left its sender wherever they already sat in the list and the
 * order silently corrected itself on the next refresh — which reads as the
 * list simply being wrong.
 */

const seed = () =>
  reducer(
    undefined,
    fetchThreads.fulfilled(
      {
        scope: "chat",
        threads: [
          {
            _id: "dm-priya",
            type: "private",
            name: "Priya",
            lastMessageAt: "2026-08-10T09:00:00.000Z",
            updatedAt: "2026-08-10T09:00:00.000Z",
          },
          {
            _id: "dm-arjun",
            type: "private",
            name: "Arjun",
            lastMessageAt: "2026-08-11T09:00:00.000Z",
            updatedAt: "2026-08-11T09:00:00.000Z",
          },
        ],
      },
      "",
      "chat"
    )
  );

const inbound = (threadId, at, senderId = "someone-else") => ({
  scope: "chat",
  threadId,
  currentUserId: "me",
  message: {
    id: `m-${at}`,
    sender: { id: senderId },
    body: "hi",
    createdAt: at,
  },
});

/** Order the DM roster would render, most recent first. */
const order = (state) =>
  Object.values(state.threads)
    .slice()
    .sort((a, b) => new Date(b.lastMessageAt || 0) - new Date(a.lastMessageAt || 0))
    .map((t) => t.name);

describe("an arriving message moves its thread to the top", () => {
  it("reorders without waiting for a refetch", () => {
    let state = seed();
    expect(order(state)).toEqual(["Arjun", "Priya"]);

    state = reducer(state, receiveMessage(inbound("dm-priya", "2026-08-12T10:00:00.000Z")));

    expect(order(state)).toEqual(["Priya", "Arjun"]);
  });

  it("updates BOTH timestamp fields", () => {
    // The chat list reads `updatedAt` and the DM roster reads `lastMessageAt`.
    // Writing one leaves the other stale, and the two tabs then disagree.
    let state = seed();
    state = reducer(state, receiveMessage(inbound("dm-priya", "2026-08-12T10:00:00.000Z")));

    const t = state.threads["chat:dm-priya"];
    expect(t.lastMessageAt).toBe("2026-08-12T10:00:00.000Z");
    expect(t.updatedAt).toBe("2026-08-12T10:00:00.000Z");
  });

  it("your own outgoing message counts as activity", () => {
    // Replying to someone should lift them immediately — not when their reply
    // eventually arrives.
    let state = seed();
    state = reducer(
      state,
      enqueueOptimistic({
        scope: "chat",
        threadId: "dm-priya",
        message: {
          clientMsgId: "c1",
          sender: { id: "me" },
          body: "hello",
          createdAt: "2026-08-12T11:00:00.000Z",
        },
      })
    );

    expect(order(state)).toEqual(["Priya", "Arjun"]);
  });
});

describe("threads never move backwards", () => {
  it("a late-arriving older message does not demote a thread", () => {
    // Out-of-order delivery is normal on a flaky connection. A message from an
    // hour ago landing now must not push a conversation below one that has
    // been quiet longer.
    let state = seed();
    state = reducer(state, receiveMessage(inbound("dm-priya", "2026-08-12T10:00:00.000Z")));
    expect(order(state)).toEqual(["Priya", "Arjun"]);

    // Older message for Arjun arrives late.
    state = reducer(state, receiveMessage(inbound("dm-arjun", "2026-08-09T08:00:00.000Z")));

    expect(order(state)).toEqual(["Priya", "Arjun"]);
    expect(state.threads["chat:dm-arjun"].lastMessageAt).toBe("2026-08-11T09:00:00.000Z");
  });
});

describe("safety", () => {
  it("does not invent a thread that was never listed", () => {
    // `ensure` deliberately creates no threads entry. Fabricating one here
    // would put a nameless row in the sidebar; the real thread arrives
    // complete from the next fetch.
    let state = seed();
    state = reducer(state, receiveMessage(inbound("dm-unknown", "2026-08-12T10:00:00.000Z")));

    expect(state.threads["chat:dm-unknown"]).toBeUndefined();
    // The message itself is still stored, so nothing is lost.
    expect(state.messagesByKey["chat:dm-unknown"]).toHaveLength(1);
  });

  it("a duplicate message does not re-touch the thread", () => {
    // receiveMessage returns early for a message it already has, so an echo
    // of something old cannot bump the ordering.
    let state = seed();
    const payload = inbound("dm-priya", "2026-08-12T10:00:00.000Z");
    state = reducer(state, receiveMessage(payload));
    const after = state.threads["chat:dm-priya"].lastMessageAt;

    state = reducer(state, receiveMessage(payload));
    expect(state.threads["chat:dm-priya"].lastMessageAt).toBe(after);
    expect(state.messagesByKey["chat:dm-priya"]).toHaveLength(1);
  });
});
