// listMechanics.test.js — S5 grouping logic.
//
//     npm test --prefix client -- --run
//
// Scroll anchoring and the divider position need a real DOM and are covered by
// the acceptance checks in WHATSAPP-PARITY-PLAN.md §10. `startsGroup` is pure,
// and it's the piece that decides whether a thread reads as a conversation or
// as a log file — so it gets tested properly.
import { describe, it, expect } from "vitest";
import { startsGroup } from "./useMessageListMechanics";

const msg = (senderId, atMs, shape = "normalized") => {
  const iso = new Date(atMs).toISOString();
  if (shape === "chat") return { senderId, timestamp: iso };
  if (shape === "project") return { sentBy: { _id: senderId }, createdAt: iso };
  return { sender: { id: senderId }, createdAt: iso };
};

describe("startsGroup", () => {
  it("the first message always starts a group", () => {
    expect(startsGroup(msg("a", 1000), null)).toBe(true);
    expect(startsGroup(msg("a", 1000), undefined)).toBe(true);
  });

  it("a different sender starts a new group", () => {
    expect(startsGroup(msg("b", 2000), msg("a", 1000))).toBe(true);
  });

  it("the same sender within the window continues the group", () => {
    expect(startsGroup(msg("a", 60_000), msg("a", 1000))).toBe(false);
  });

  it("the same sender after the window starts a new group", () => {
    const sixMinutes = 6 * 60 * 1000;
    expect(startsGroup(msg("a", sixMinutes + 1000), msg("a", 1000))).toBe(true);
  });

  it("exactly at the boundary continues (gap must EXCEED the window)", () => {
    const fiveMinutes = 5 * 60 * 1000;
    expect(startsGroup(msg("a", fiveMinutes), msg("a", 0))).toBe(false);
  });

  it("the window is configurable", () => {
    expect(startsGroup(msg("a", 2000), msg("a", 0), 1000)).toBe(true);
    expect(startsGroup(msg("a", 500), msg("a", 0), 1000)).toBe(false);
  });

  it("works across all three message shapes", () => {
    // chat uses senderId/timestamp, project uses sentBy/createdAt, the
    // normalized shape uses sender.id/createdAt — grouping must not depend on
    // which surface the row came from.
    expect(startsGroup(msg("a", 60_000, "chat"), msg("a", 1000, "chat"))).toBe(false);
    expect(startsGroup(msg("a", 60_000, "project"), msg("a", 1000, "project"))).toBe(false);
    expect(startsGroup(msg("b", 60_000, "chat"), msg("a", 1000, "chat"))).toBe(true);
  });

  it("ids are compared as strings", () => {
    expect(startsGroup(msg(42, 60_000), msg("42", 1000))).toBe(false);
  });

  it("an unparseable timestamp starts a new group rather than throwing", () => {
    const bad = { sender: { id: "a" }, createdAt: "nonsense" };
    expect(() => startsGroup(bad, msg("a", 1000))).not.toThrow();
    expect(startsGroup(bad, msg("a", 1000))).toBe(true);
  });

  it("a missing sender on both sides still groups by time", () => {
    // Both resolve to "", which are equal — grouping then falls to the gap.
    expect(startsGroup({ createdAt: new Date(2000).toISOString() }, { createdAt: new Date(1000).toISOString() })).toBe(false);
  });
});
