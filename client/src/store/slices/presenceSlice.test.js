// presenceSlice.test.js — S3 client state.
//
//     npm test --prefix client -- --run
//
// The interesting cases are all about NOT saying something misleading: a hidden
// user must not read as offline, and an unknown one must not read as "last seen
// a long time ago".
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";

import reducer, {
  receiveSnapshot,
  receiveChange,
  resetPresence,
  selectPresence,
  selectOnlineCount,
  formatLastSeen,
} from "./presenceSlice";

const S = () => reducer(undefined, { type: "@@INIT" });
const at = (state) => ({ presence: state });

describe("snapshot + change", () => {
  it("applies a bulk snapshot", () => {
    const s = reducer(
      S(),
      receiveSnapshot({ presence: { u1: { online: true }, u2: { online: false, lastSeenAt: null } } })
    );
    expect(selectPresence("u1")(at(s)).online).toBe(true);
    expect(selectPresence("u2")(at(s)).online).toBe(false);
  });

  it("a change event flips one user without touching others", () => {
    let s = reducer(S(), receiveSnapshot({ presence: { u1: { online: true }, u2: { online: true } } }));
    s = reducer(s, receiveChange({ userId: "u2", online: false, lastSeenAt: "2026-08-05T10:00:00Z" }));
    expect(selectPresence("u1")(at(s)).online).toBe(true);
    expect(selectPresence("u2")(at(s)).online).toBe(false);
    expect(selectPresence("u2")(at(s)).lastSeenAt).toBe("2026-08-05T10:00:00Z");
  });

  it("going online clears the stale lastSeenAt", () => {
    let s = reducer(S(), receiveChange({ userId: "u1", online: false, lastSeenAt: "2026-08-05T10:00:00Z" }));
    s = reducer(s, receiveChange({ userId: "u1", online: true }));
    expect(selectPresence("u1")(at(s)).lastSeenAt).toBe(null);
  });

  it("going offline without a timestamp keeps the previous one", () => {
    let s = reducer(S(), receiveChange({ userId: "u1", online: false, lastSeenAt: "2026-08-05T10:00:00Z" }));
    s = reducer(s, receiveChange({ userId: "u1", online: false }));
    expect(selectPresence("u1")(at(s)).lastSeenAt).toBe("2026-08-05T10:00:00Z");
  });

  it("a change for a previously hidden user clears the hidden flag", () => {
    let s = reducer(S(), receiveSnapshot({ presence: { u1: { hidden: true } } }));
    expect(selectPresence("u1")(at(s)).hidden).toBe(true);
    s = reducer(s, receiveChange({ userId: "u1", online: true }));
    expect(selectPresence("u1")(at(s)).hidden).toBeUndefined();
    expect(selectPresence("u1")(at(s)).online).toBe(true);
  });

  it("malformed payloads are ignored", () => {
    expect(() => {
      let s = reducer(S(), receiveChange({}));
      s = reducer(s, receiveSnapshot({}));
      s = reducer(s, receiveChange({ online: true })); // no userId
    }).not.toThrow();
  });

  it("reset clears everything", () => {
    let s = reducer(S(), receiveSnapshot({ presence: { u1: { online: true } } }));
    s = reducer(s, resetPresence());
    expect(selectPresence("u1")(at(s)).unknown).toBe(true);
  });
});

describe("unknown users", () => {
  it("an unseen user is 'unknown', not 'offline'", () => {
    const entry = selectPresence("nobody")(at(S()));
    expect(entry.unknown).toBe(true);
    expect(entry.online).toBe(false);
  });

  it("the unknown sentinel is a stable reference (no re-render churn)", () => {
    const s = at(S());
    expect(selectPresence("a")(s)).toBe(selectPresence("b")(s));
  });
});

describe("online count", () => {
  it("counts only users marked online", () => {
    const s = reducer(
      S(),
      receiveSnapshot({
        presence: { u1: { online: true }, u2: { online: false }, u3: { online: true }, u4: { hidden: true } },
      })
    );
    expect(selectOnlineCount(["u1", "u2", "u3", "u4"])(at(s))).toBe(3 - 1);
  });

  it("a hidden user never counts as online", () => {
    const s = reducer(S(), receiveSnapshot({ presence: { u1: { hidden: true } } }));
    expect(selectOnlineCount(["u1"])(at(s))).toBe(0);
  });

  it("unknown users do not count", () => {
    expect(selectOnlineCount(["ghost"])(at(S()))).toBe(0);
  });
});

describe("formatLastSeen — says nothing rather than something misleading", () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-08-05T12:00:00Z"));
  });
  afterEach(() => vi.useRealTimers());

  const ago = (ms) => ({ online: false, lastSeenAt: new Date(Date.now() - ms).toISOString() });

  it("returns null for a hidden user (never leak what they turned off)", () => {
    expect(formatLastSeen({ hidden: true })).toBe(null);
  });

  it("returns null for an unknown user", () => {
    expect(formatLastSeen({ unknown: true, online: false })).toBe(null);
  });

  it("returns null while online", () => {
    expect(formatLastSeen({ online: true })).toBe(null);
  });

  it("returns null when there is no timestamp", () => {
    expect(formatLastSeen({ online: false, lastSeenAt: null })).toBe(null);
  });

  it("returns null for an unparseable timestamp", () => {
    expect(formatLastSeen({ online: false, lastSeenAt: "nonsense" })).toBe(null);
  });

  it("formats the ranges", () => {
    expect(formatLastSeen(ago(10_000))).toBe("last seen just now");
    expect(formatLastSeen(ago(5 * 60_000))).toBe("last seen 5m ago");
    expect(formatLastSeen(ago(3 * 3600_000))).toBe("last seen 3h ago");
    expect(formatLastSeen(ago(30 * 3600_000))).toBe("last seen yesterday");
    expect(formatLastSeen(ago(3 * 86400_000))).toBe("last seen 3d ago");
  });

  it("falls back to a date beyond a week", () => {
    expect(formatLastSeen(ago(30 * 86400_000))).toMatch(/^last seen \d/);
  });
});
