// outbox.test.js — optimistic send + queue reconciliation (S2).
//
//     npm test --prefix client -- --run
//
// The cases that matter are the ones where a bug loses someone's typed message
// or silently posts it twice.
import { describe, it, expect, vi } from "vitest";

vi.mock("../../api/messagingApi", () => ({
  SCOPES: { CHAT: "chat", PROJECT: "project" },
  threadKey: (scope, id) => `${scope}:${id}`,
  parseKey: (k) => ({ scope: k.split(":")[0], threadId: k.split(":")[1] }),
  newClientMsgId: () => "generated",
  listThreads: vi.fn(),
  fetchMessages: vi.fn(),
  fetchUnreadCount: vi.fn(),
  sendMessage: vi.fn(),
  markRead: vi.fn(),
  react: vi.fn(),
}));

import reducer, {
  enqueueOptimistic,
  markSendFailed,
  markSendRetrying,
  discardOptimistic,
  receiveMessage,
  selectMessages,
  selectPending,
} from "./threadsSlice";

const ME = "me1";
const S = () => reducer(undefined, { type: "@@INIT" });
const at = (s) => ({ threads: s });
const msgs = (s) => selectMessages("chat", "t1")(at(s));
const pending = (s) => selectPending("chat", "t1")(at(s));

const optimistic = (clientMsgId = "c1", over = {}) =>
  enqueueOptimistic({
    scope: "chat",
    threadId: "t1",
    message: {
      clientMsgId,
      id: null,
      sender: { id: ME },
      body: "hello",
      createdAt: new Date(1000).toISOString(),
      ...over,
    },
  });

describe("optimistic render", () => {
  it("appears immediately as sending", () => {
    const s = reducer(S(), optimistic());
    expect(msgs(s)).toHaveLength(1);
    expect(msgs(s)[0].status).toBe("sending");
  });

  it("shows in the pending selector", () => {
    const s = reducer(S(), optimistic());
    expect(pending(s)).toHaveLength(1);
  });

  it("does not bump unread for your own optimistic message", () => {
    const s = reducer(S(), optimistic());
    expect(at(s).threads.unreadByKey["chat:t1"]).toBe(0);
  });
});

describe("reconciliation with the server echo", () => {
  it("the echo merges onto the same row — no duplicate bubble", () => {
    let s = reducer(S(), optimistic("c1"));
    s = reducer(
      s,
      receiveMessage({
        scope: "chat",
        threadId: "t1",
        currentUserId: ME,
        message: {
          id: "server1",
          clientMsgId: "c1",
          sender: { id: ME },
          body: "hello",
          createdAt: new Date(1000).toISOString(),
        },
      })
    );
    expect(msgs(s)).toHaveLength(1);
    expect(msgs(s)[0].id).toBe("server1");
  });

  it("the reconciled row leaves the pending set", () => {
    let s = reducer(S(), optimistic("c1"));
    expect(pending(s)).toHaveLength(1);
    s = reducer(
      s,
      receiveMessage({
        scope: "chat",
        threadId: "t1",
        currentUserId: ME,
        message: {
          id: "server1",
          clientMsgId: "c1",
          sender: { id: ME },
          body: "hello",
          status: "sent",
          createdAt: new Date(1000).toISOString(),
        },
      })
    );
    expect(pending(s)).toHaveLength(0);
  });

  it("local-only fields survive reconciliation", () => {
    // The pending attachment placeholder must not be wiped by the echo, or the
    // bubble flickers from "uploading" to nothing mid-send.
    let s = reducer(
      S(),
      optimistic("c1", { attachments: [{ filename: "a.png", _pending: true }] })
    );
    s = reducer(
      s,
      receiveMessage({
        scope: "chat",
        threadId: "t1",
        currentUserId: ME,
        message: { id: "server1", clientMsgId: "c1", sender: { id: ME }, body: "hello" },
      })
    );
    expect(msgs(s)[0].attachments[0].filename).toBe("a.png");
  });

  it("a duplicate echo still lands once", () => {
    let s = reducer(S(), optimistic("c1"));
    const echo = receiveMessage({
      scope: "chat",
      threadId: "t1",
      currentUserId: ME,
      message: { id: "server1", clientMsgId: "c1", sender: { id: ME }, body: "hello" },
    });
    s = reducer(reducer(s, echo), echo);
    expect(msgs(s)).toHaveLength(1);
  });
});

describe("failure is visible, never silent", () => {
  it("a failed send stays on screen, marked failed", () => {
    let s = reducer(S(), optimistic("c1"));
    s = reducer(s, markSendFailed({ scope: "chat", threadId: "t1", clientMsgId: "c1", error: "offline" }));
    expect(msgs(s)).toHaveLength(1);
    expect(msgs(s)[0].status).toBe("failed");
    expect(msgs(s)[0].sendError).toBe("offline");
  });

  it("a failed message is still pending (retryable)", () => {
    let s = reducer(S(), optimistic("c1"));
    s = reducer(s, markSendFailed({ scope: "chat", threadId: "t1", clientMsgId: "c1", error: "x" }));
    expect(pending(s)).toHaveLength(1);
  });

  it("retrying flips it back to sending and clears the error", () => {
    let s = reducer(S(), optimistic("c1"));
    s = reducer(s, markSendFailed({ scope: "chat", threadId: "t1", clientMsgId: "c1", error: "x" }));
    s = reducer(s, markSendRetrying({ scope: "chat", threadId: "t1", clientMsgId: "c1" }));
    expect(msgs(s)[0].status).toBe("sending");
    expect(msgs(s)[0].sendError).toBe(null);
  });

  it("discard removes it — only on explicit user action", () => {
    let s = reducer(S(), optimistic("c1"));
    s = reducer(s, discardOptimistic({ scope: "chat", threadId: "t1", clientMsgId: "c1" }));
    expect(msgs(s)).toHaveLength(0);
  });

  it("failing one message does not touch the others", () => {
    let s = reducer(S(), optimistic("c1"));
    s = reducer(s, optimistic("c2", { createdAt: new Date(2000).toISOString() }));
    s = reducer(s, markSendFailed({ scope: "chat", threadId: "t1", clientMsgId: "c1", error: "x" }));
    expect(msgs(s).find((m) => m.clientMsgId === "c2").status).toBe("sending");
  });
});

describe("ordering", () => {
  it("queued messages keep the order they were typed in", () => {
    let s = reducer(S(), optimistic("c1", { createdAt: new Date(1000).toISOString() }));
    s = reducer(s, optimistic("c2", { createdAt: new Date(2000).toISOString() }));
    s = reducer(s, optimistic("c3", { createdAt: new Date(3000).toISOString() }));
    expect(msgs(s).map((m) => m.clientMsgId)).toEqual(["c1", "c2", "c3"]);
  });

  it("an echo arriving out of order does not reshuffle the thread", () => {
    let s = reducer(S(), optimistic("c1", { createdAt: new Date(1000).toISOString() }));
    s = reducer(s, optimistic("c2", { createdAt: new Date(2000).toISOString() }));
    // c2's echo arrives first.
    s = reducer(
      s,
      receiveMessage({
        scope: "chat",
        threadId: "t1",
        currentUserId: ME,
        message: {
          id: "s2",
          clientMsgId: "c2",
          sender: { id: ME },
          createdAt: new Date(2000).toISOString(),
        },
      })
    );
    expect(msgs(s).map((m) => m.clientMsgId)).toEqual(["c1", "c2"]);
  });
});

describe("robustness", () => {
  it("malformed payloads are ignored", () => {
    expect(() => {
      let s = reducer(S(), enqueueOptimistic({}));
      s = reducer(s, enqueueOptimistic({ scope: "chat", threadId: "t1", message: {} })); // no clientMsgId
      s = reducer(s, markSendFailed({}));
      s = reducer(s, markSendRetrying({}));
      s = reducer(s, discardOptimistic({}));
    }).not.toThrow();
  });

  it("acting on an unknown clientMsgId is a no-op", () => {
    let s = reducer(S(), optimistic("c1"));
    s = reducer(s, markSendFailed({ scope: "chat", threadId: "t1", clientMsgId: "nope", error: "x" }));
    expect(msgs(s)[0].status).toBe("sending");
  });
});
