// threadsSlice.test.js
//
// Phase 2 verification. Pure reducer tests — no React, no network.
//
//     npm test --prefix client -- --run
//
// The focus is the two behaviours the whole migration rests on:
//   1. DEDUP — the server dual-emits, so the same message arrives twice (once
//      as `chat:message`, once as `thread:message`). It must land once.
//   2. ORDERING — out-of-order arrival is normal on a flaky connection, so
//      messages must insert at position rather than append.
import { describe, it, expect, vi } from "vitest";

// The slice only needs `threadKey` and `SCOPES` from the API module at import
// time; the thunks aren't exercised here. Mocked so this stays a pure reducer
// test with no axios import.
vi.mock("../../api/messagingApi", () => ({
  SCOPES: { CHAT: "chat", PROJECT: "project" },
  threadKey: (scope, id) => `${scope}:${id}`,
  parseKey: (k) => ({ scope: k.split(":")[0], threadId: k.split(":")[1] }),
  listThreads: vi.fn(async () => []),
  fetchMessages: vi.fn(async () => ({ messages: [], pagination: null })),
  fetchUnreadCount: vi.fn(async () => 0),
  sendMessage: vi.fn(async () => ({})),
  markRead: vi.fn(async () => 0),
  react: vi.fn(async () => ({})),
}));

import reducer, {
  fetchThreads,
  setActiveThread,
  receiveMessage,
  receiveReceipt,
  receiveThreadUpdated,
  receiveTyping,
  setUnread,
  selectMessages,
  selectUnread,
  selectTyping,
  selectTotalUnread,
} from "./threadsSlice";

const ME = "me1";
const THEM = "them1";

const msg = (id, at, extra = {}) => ({
  id,
  sender: { id: THEM, name: "Them" },
  body: `msg ${id}`,
  createdAt: new Date(at).toISOString(),
  ...extra,
});

const S = () => reducer(undefined, { type: "@@INIT" });
const recv = (state, message, over = {}) =>
  reducer(state, receiveMessage({ scope: "chat", threadId: "t1", message, currentUserId: ME, ...over }));
const msgs = (state, scope = "chat", id = "t1") => selectMessages(scope, id)({ threads: state });
const unread = (state, scope = "chat", id = "t1") => selectUnread(scope, id)({ threads: state });

describe("dedup (dual-emit safety)", () => {
  it("same message delivered twice lands once", () => {
    let s = recv(S(), msg("m1", 1000));
    s = recv(s, msg("m1", 1000));
    expect(msgs(s)).toHaveLength(1);
  });

  it("…and does not double-count the unread badge", () => {
    let s = recv(S(), msg("m1", 1000));
    s = recv(s, msg("m1", 1000));
    expect(unread(s)).toBe(1);
  });

  it("legacy shape (_id/senderId/timestamp) dedupes against normalized shape", () => {
    let s = recv(S(), msg("m1", 1000));
    // Exactly what the legacy chat:message event carries.
    s = recv(s, { _id: "m1", senderId: THEM, message: "msg m1", timestamp: new Date(1000).toISOString() });
    expect(msgs(s)).toHaveLength(1);
  });

  it("dedupes on clientMsgId before the server id is known", () => {
    let s = recv(S(), { clientMsgId: "c1", body: "hi", createdAt: new Date(1000).toISOString(), sender: { id: ME } });
    s = recv(s, { id: "m9", clientMsgId: "c1", body: "hi", createdAt: new Date(1000).toISOString(), sender: { id: ME } });
    expect(msgs(s)).toHaveLength(1);
    expect(msgs(s)[0].id).toBe("m9"); // server id wins
  });

  it("merge preserves local-only fields on the optimistic row", () => {
    let s = recv(S(), { clientMsgId: "c1", body: "hi", createdAt: new Date(1000).toISOString(), _localFile: "blob", sender: { id: ME } });
    s = recv(s, { id: "m9", clientMsgId: "c1", body: "hi", createdAt: new Date(1000).toISOString(), sender: { id: ME } });
    expect(msgs(s)[0]._localFile).toBe("blob");
  });
});

describe("ordering", () => {
  it("in-order arrival stays in order", () => {
    let s = S();
    [1000, 2000, 3000].forEach((t, i) => { s = recv(s, msg(`m${i}`, t)); });
    expect(msgs(s).map((m) => m.id)).toEqual(["m0", "m1", "m2"]);
  });

  it("out-of-order message inserts at position, not at the end", () => {
    let s = S();
    s = recv(s, msg("late", 3000));
    s = recv(s, msg("early", 1000));
    s = recv(s, msg("mid", 2000));
    expect(msgs(s).map((m) => m.id)).toEqual(["early", "mid", "late"]);
  });

  it("unparseable timestamps neither throw nor reorder others", () => {
    let s = recv(S(), msg("a", 1000));
    s = recv(s, { id: "bad", createdAt: "not-a-date", sender: { id: THEM } });
    expect(msgs(s)).toHaveLength(2);
  });
});

describe("unread accounting", () => {
  it("own message never bumps unread", () => {
    const s = recv(S(), { id: "m1", sender: { id: ME }, createdAt: new Date(1000).toISOString() });
    expect(unread(s)).toBe(0);
  });

  it("own message via legacy senderId shape also never bumps unread", () => {
    const s = recv(S(), { _id: "m1", senderId: ME, timestamp: new Date(1000).toISOString() });
    expect(unread(s)).toBe(0);
  });

  it("active thread does not accumulate unread", () => {
    let s = reducer(S(), setActiveThread("chat", "t1"));
    s = recv(s, msg("m1", 1000));
    expect(unread(s)).toBe(0);
  });

  it("a different thread still accumulates while one is active", () => {
    let s = reducer(S(), setActiveThread("chat", "t1"));
    s = reducer(s, receiveMessage({ scope: "chat", threadId: "t2", message: msg("m1", 1000), currentUserId: ME }));
    expect(unread(s, "chat", "t2")).toBe(1);
  });

  it("switching to a thread clears its unread", () => {
    let s = recv(S(), msg("m1", 1000));
    expect(unread(s)).toBe(1);
    s = reducer(s, setActiveThread("chat", "t1"));
    expect(unread(s)).toBe(0);
  });

  it("total unread is scoped — project counts do not leak into chat", () => {
    let s = reducer(S(), setUnread({ scope: "chat", threadId: "a", count: 2 }));
    s = reducer(s, setUnread({ scope: "project", threadId: "b", count: 5 }));
    expect(selectTotalUnread("chat")({ threads: s })).toBe(2);
    expect(selectTotalUnread("project")({ threads: s })).toBe(5);
    expect(selectTotalUnread(null)({ threads: s })).toBe(7);
  });
});

describe("receipts, updates, typing", () => {
  it("read receipt attaches to the right message", () => {
    let s = recv(S(), msg("m1", 1000));
    s = reducer(s, receiveReceipt({ scope: "chat", threadId: "t1", messageId: "m1", userId: "u2", kind: "read" }));
    expect(msgs(s)[0].readBy).toEqual([{ id: "u2", at: null }]);
  });

  it("duplicate read receipt does not duplicate the entry", () => {
    let s = recv(S(), msg("m1", 1000));
    const r = receiveReceipt({ scope: "chat", threadId: "t1", messageId: "m1", userId: "u2", kind: "read" });
    s = reducer(reducer(s, r), r);
    expect(msgs(s)[0].readBy).toHaveLength(1);
  });

  it("thread-level receipt (null messageId) applies to every message", () => {
    let s = recv(S(), msg("m1", 1000));
    s = recv(s, msg("m2", 2000));
    s = reducer(s, receiveReceipt({ scope: "chat", threadId: "t1", messageId: null, userId: "u2", kind: "read" }));
    expect(msgs(s).every((m) => m.readBy?.length === 1)).toBe(true);
  });

  it("thread:updated patches a message without clobbering its id", () => {
    let s = recv(S(), msg("m1", 1000));
    s = reducer(s, receiveThreadUpdated({
      scope: "chat", threadId: "t1",
      patch: { messageId: "m1", reactions: [{ emoji: "👍", users: ["u2"] }] },
    }));
    expect(msgs(s)[0].reactions).toHaveLength(1);
    expect(msgs(s)[0].id).toBe("m1");
  });

  it("typing sets then clears", () => {
    let s = reducer(S(), receiveTyping({ scope: "chat", threadId: "t1", userId: "u2", userName: "Ravi" }));
    expect(selectTyping("chat", "t1")({ threads: s })).toEqual({ u2: "Ravi" });
    s = reducer(s, receiveTyping({ scope: "chat", threadId: "t1", userId: "u2", stop: true }));
    expect(selectTyping("chat", "t1")({ threads: s })).toEqual({});
  });

  it("sending clears that sender's typing indicator", () => {
    let s = reducer(S(), receiveTyping({ scope: "chat", threadId: "t1", userId: THEM, userName: "Them" }));
    s = recv(s, msg("m1", 1000));
    expect(selectTyping("chat", "t1")({ threads: s })).toEqual({});
  });
});

describe("server reseed (survives refresh / second tab / reconnect)", () => {
  // The server returns unreadCount per conversation on GET /api/chat/groups.
  // That is the ONLY thing that makes unread survive a page refresh, a second
  // tab, or a period spent disconnected — a live socket increment can't know
  // about messages that arrived while this client wasn't listening.
  const seed = (threads) => reducer(S(), { type: fetchThreads.fulfilled.type, payload: { scope: "chat", threads } });

  it("seeds unread from the server's per-thread count", () => {
    const s = seed([{ _id: "t1", name: "G1", unreadCount: 4 }]);
    expect(unread(s, "chat", "t1")).toBe(4);
  });

  it("a reseed overrides a stale local count (the reconnect case)", () => {
    let s = recv(S(), msg("m1", 1000)); // locally counted 1 while connected
    expect(unread(s)).toBe(1);
    // Reconnect: server says 7 were actually missed.
    s = reducer(s, { type: fetchThreads.fulfilled.type, payload: { scope: "chat", threads: [{ _id: "t1", unreadCount: 7 }] } });
    expect(unread(s)).toBe(7);
  });

  it("threads with no unreadCount field are left untouched", () => {
    let s = recv(S(), msg("m1", 1000));
    s = reducer(s, { type: fetchThreads.fulfilled.type, payload: { scope: "chat", threads: [{ _id: "t1" }] } });
    expect(unread(s)).toBe(1);
  });

  it("stores the thread summary for the list UI", () => {
    const s = seed([{ _id: "t1", name: "Design", members: [] }]);
    expect(s.threads["chat:t1"].name).toBe("Design");
  });
});

describe("robustness", () => {
  it("selectors on an unknown thread return a stable empty array", () => {
    const s = S();
    expect(msgs(s, "chat", "nope")).toEqual([]);
    expect(unread(s, "chat", "nope")).toBe(0);
    // Same frozen reference, so an unknown thread can't cause re-render churn.
    expect(msgs(s, "chat", "nope")).toBe(msgs(s, "chat", "nope2"));
  });

  it("malformed payloads are ignored rather than throwing", () => {
    expect(() => {
      let s = reducer(S(), receiveMessage({}));
      s = reducer(s, receiveMessage({ scope: "chat", threadId: "t1" }));
      s = reducer(s, receiveReceipt({}));
      s = reducer(s, receiveTyping({}));
      s = reducer(s, receiveThreadUpdated({ scope: "chat", threadId: "t1" }));
    }).not.toThrow();
  });
});
