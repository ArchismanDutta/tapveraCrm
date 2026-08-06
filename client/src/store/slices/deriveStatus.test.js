// deriveStatus.test.js — client-side tick derivation (S1).
//
// Mirrors server/tests/receipts.test.js. Both must agree: the server is the
// authority, but the client derives locally so the sender's ticks advance the
// instant a receipt lands rather than waiting for a refetch. A disagreement
// between the two would show as a tick that flickers on refresh.
import { describe, it, expect, vi } from "vitest";

vi.mock("../../api/messagingApi", () => ({
  SCOPES: { CHAT: "chat", PROJECT: "project" },
  threadKey: (scope, id) => `${scope}:${id}`,
  parseKey: (k) => ({ scope: k.split(":")[0], threadId: k.split(":")[1] }),
  listThreads: vi.fn(),
  fetchMessages: vi.fn(),
  fetchUnreadCount: vi.fn(),
  sendMessage: vi.fn(),
  markRead: vi.fn(),
  react: vi.fn(),
}));

import { deriveStatus } from "./threadsSlice";

const msg = (over = {}) => ({
  id: "m1",
  sender: { id: "me" },
  deliveredTo: [],
  readBy: [],
  ...over,
});

describe("one-to-one", () => {
  it("nobody has it -> sent", () => {
    expect(deriveStatus(msg(), ["b"])).toBe("sent");
  });

  it("delivered to the recipient -> delivered", () => {
    expect(deriveStatus(msg({ deliveredTo: [{ id: "b" }] }), ["b"])).toBe("delivered");
  });

  it("read by the recipient -> read", () => {
    expect(deriveStatus(msg({ deliveredTo: [{ id: "b" }], readBy: [{ id: "b" }] }), ["b"])).toBe("read");
  });
});

describe("groups — advance only when everyone has", () => {
  it("2 of 3 delivered -> sent", () => {
    expect(deriveStatus(msg({ deliveredTo: [{ id: "b" }, { id: "c" }] }), ["b", "c", "d"])).toBe("sent");
  });

  it("3 of 3 delivered -> delivered", () => {
    expect(
      deriveStatus(msg({ deliveredTo: [{ id: "b" }, { id: "c" }, { id: "d" }] }), ["b", "c", "d"])
    ).toBe("delivered");
  });

  it("all delivered, 2 of 3 read -> delivered", () => {
    expect(
      deriveStatus(
        msg({ deliveredTo: [{ id: "b" }, { id: "c" }, { id: "d" }], readBy: [{ id: "b" }, { id: "c" }] }),
        ["b", "c", "d"]
      )
    ).toBe("delivered");
  });

  it("the last reader flips it blue", () => {
    expect(
      deriveStatus(
        msg({
          deliveredTo: [{ id: "b" }, { id: "c" }, { id: "d" }],
          readBy: [{ id: "b" }, { id: "c" }, { id: "d" }],
        }),
        ["b", "c", "d"]
      )
    ).toBe("read");
  });
});

describe("cases that would otherwise render a lie", () => {
  it("no recipients -> sent, never read", () => {
    // [].every() is vacuously true — without the guard a note-to-self would
    // show as read the instant it was sent.
    expect(deriveStatus(msg(), [])).toBe("sent");
  });

  it("the sender is excluded from the recipient set", () => {
    // Sender is in `members`, so a DM's member list is [me, b]. If the sender
    // weren't filtered out, the message could never advance past sent.
    expect(
      deriveStatus(msg({ deliveredTo: [{ id: "b" }], readBy: [{ id: "b" }] }), ["me", "b"])
    ).toBe("read");
  });

  it("a thread where the only member is the sender -> sent", () => {
    expect(deriveStatus(msg(), ["me"])).toBe("sent");
  });

  it("read implies delivered for pre-feature messages", () => {
    // deliveredTo postdates existing messages; readBy alone must still advance.
    expect(deriveStatus(msg({ deliveredTo: [], readBy: [{ id: "b" }] }), ["b"])).toBe("read");
  });

  it("in-flight and failed states are preserved, not recomputed", () => {
    expect(deriveStatus(msg({ status: "sending" }), ["b"])).toBe("sending");
    expect(deriveStatus(msg({ status: "failed" }), ["b"])).toBe("failed");
  });

  it("accepts flat id arrays as well as {id} entries", () => {
    // The chat schema stores readBy as bare strings; project as subdocuments.
    expect(deriveStatus(msg({ readBy: ["b"], deliveredTo: ["b"] }), ["b"])).toBe("read");
  });

  it("compares ids as strings", () => {
    expect(deriveStatus(msg({ deliveredTo: [{ id: 42 }] }), [42])).toBe("delivered");
  });

  it("legacy sender shapes are recognised", () => {
    expect(deriveStatus({ senderId: "me", deliveredTo: [{ id: "b" }] }, ["me", "b"])).toBe("delivered");
    expect(deriveStatus({ sentBy: { _id: "me" }, deliveredTo: [{ id: "b" }] }, ["me", "b"])).toBe("delivered");
  });
});
