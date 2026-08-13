import { describe, it, expect } from "vitest";
import { canEditMessage, EDIT_WINDOW_MS } from "./messagingApi";

/**
 * The client-side edit gate. Presentation only — the server re-checks both
 * rules on every request — but it decides whether the button is offered, and
 * offering an edit that will be refused is worse than not offering one.
 *
 * Kept in step with server/tests/message-edit.test.js, which asserts the same
 * boundaries against the authoritative implementation.
 */

const ME = "user-1";
const OTHER = "user-2";
const NOW = 1_770_000_000_000;
const MIN = 60 * 1000;

/** A message in the RAW ChatMessage shape (what a REST refetch returns). */
const raw = (overrides = {}) => ({
  _id: "m1",
  senderId: ME,
  message: "hello",
  timestamp: new Date(NOW).toISOString(),
  ...overrides,
});

/** The NORMALIZED shape carried by thread:* socket events. */
const normalized = (overrides = {}) => ({
  id: "m1",
  sender: { id: ME, name: "Me" },
  body: "hello",
  createdAt: new Date(NOW).toISOString(),
  ...overrides,
});

describe("canEditMessage — window", () => {
  it("allows an edit immediately after sending", () => {
    expect(canEditMessage(raw(), ME, NOW)).toBe(true);
  });

  it("allows an edit at 6 minutes", () => {
    expect(canEditMessage(raw({ timestamp: new Date(NOW - 6 * MIN) }), ME, NOW)).toBe(true);
  });

  it("allows an edit at exactly 7 minutes", () => {
    expect(canEditMessage(raw({ timestamp: new Date(NOW - 7 * MIN) }), ME, NOW)).toBe(true);
  });

  it("refuses one second past the window", () => {
    expect(canEditMessage(raw({ timestamp: new Date(NOW - 7 * MIN - 1000) }), ME, NOW)).toBe(false);
  });

  it("exposes a 7-minute window", () => {
    expect(EDIT_WINDOW_MS).toBe(7 * MIN);
  });
});

describe("canEditMessage — ownership", () => {
  it("refuses someone else's message", () => {
    expect(canEditMessage(raw({ senderId: OTHER }), ME, NOW)).toBe(false);
  });

  it("reads the sender from the normalized shape too", () => {
    // Both shapes reach the renderer: REST returns raw, sockets deliver
    // normalized. Reading only one would make edit vanish for live messages
    // and reappear on refresh.
    expect(canEditMessage(normalized(), ME, NOW)).toBe(true);
    expect(canEditMessage(normalized({ sender: { id: OTHER } }), ME, NOW)).toBe(false);
  });

  it("compares ids as strings", () => {
    expect(canEditMessage(raw({ senderId: ME }), { toString: () => ME }, NOW)).toBe(true);
  });
});

describe("canEditMessage — messages that cannot be edited yet", () => {
  it("refuses an optimistic row with no server id", () => {
    // Nothing to PATCH until the send lands.
    expect(canEditMessage({ ...raw(), _id: undefined, id: null }, ME, NOW)).toBe(false);
  });

  it("refuses a message still sending", () => {
    expect(canEditMessage(raw({ status: "sending" }), ME, NOW)).toBe(false);
  });

  it("refuses a failed message", () => {
    // A failed send is retried or discarded, not edited.
    expect(canEditMessage(raw({ status: "failed" }), ME, NOW)).toBe(false);
  });

  it("refuses when the timestamp is unusable", () => {
    expect(canEditMessage(raw({ timestamp: undefined }), ME, NOW)).toBe(false);
    expect(canEditMessage(raw({ timestamp: "nonsense" }), ME, NOW)).toBe(false);
  });

  it("handles missing arguments without throwing", () => {
    expect(canEditMessage(null, ME, NOW)).toBe(false);
    expect(canEditMessage(raw(), null, NOW)).toBe(false);
  });
});
