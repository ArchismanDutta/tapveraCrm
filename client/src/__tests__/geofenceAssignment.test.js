// client/src/__tests__/geofenceAssignment.test.js
//
// Geofenced login (2026-08-07).
//
//     npx vitest run src/__tests__/geofenceAssignment.test.js
//
// ─── WHAT THIS PINS DOWN ───
// The admin console's single most important action is "restrict this person to
// this location". The first implementation of that computed the new enabled
// flag as `next.length > 0 && (user.geofence?.enabled ?? true)` — and because
// `??` only falls back on null/undefined while every existing user carries the
// schema default `enabled: false`, it resolved to `false` every time. Locations
// saved, the pill lit up, the admin saw their click land — and enforcement
// never switched on. A silent no-op on the whole feature.
//
// That failure was invisible from the UI, so these assertions are the thing
// standing between it and a repeat.

import { describe, test, expect } from "vitest";
import {
  toggleLocation,
  toggleEnabled,
  readState,
} from "../utils/geofenceAssignment";

const HQ = "loc_hq";
const BRANCH = "loc_branch";

describe("readState", () => {
  test("an untouched user reads as unfenced", () => {
    expect(readState({})).toEqual({ enabled: false, locationIds: [] });
    expect(readState(undefined)).toEqual({ enabled: false, locationIds: [] });
  });

  test("reads the schema default (enabled:false) without treating it as unset", () => {
    // The exact shape every existing user has on disk, and the input the
    // original `?? true` bug mishandled.
    expect(readState({ geofence: { enabled: false, locations: [] } })).toEqual({
      enabled: false,
      locationIds: [],
    });
  });

  test("flattens populated location documents to their ids", () => {
    const state = readState({
      geofence: { enabled: true, locations: [{ _id: HQ, name: "Kolkata HQ" }] },
    });
    expect(state).toEqual({ enabled: true, locationIds: [HQ] });
  });

  test("accepts unpopulated raw ids too", () => {
    expect(readState({ geofence: { enabled: true, locations: [HQ] } }).locationIds).toEqual([HQ]);
  });
});

describe("toggleLocation", () => {
  test("REGRESSION: assigning the first location to a default user ENABLES the fence", () => {
    // The load-bearing assertion. Previously produced enabled:false, which made
    // the entire feature a no-op while looking like it had worked.
    const before = readState({ geofence: { enabled: false, locations: [] } });
    const after = toggleLocation(before, HQ);

    expect(after.enabled).toBe(true);
    expect(after.locationIds).toEqual([HQ]);
  });

  test("assigning the first location to a user with no geofence block at all enables it", () => {
    expect(toggleLocation(readState({}), HQ)).toEqual({ enabled: true, locationIds: [HQ] });
  });

  test("adding a second location keeps the fence enabled", () => {
    const after = toggleLocation({ enabled: true, locationIds: [HQ] }, BRANCH);
    expect(after.enabled).toBe(true);
    expect(after.locationIds).toEqual([HQ, BRANCH]);
  });

  test("removing one of two locations keeps the fence enabled", () => {
    const after = toggleLocation({ enabled: true, locationIds: [HQ, BRANCH] }, BRANCH);
    expect(after.enabled).toBe(true);
    expect(after.locationIds).toEqual([HQ]);
  });

  test("removing the LAST location disables the fence", () => {
    // "Enabled with nowhere to be" is unsatisfiable and the API rejects it, so
    // the UI must not construct that state.
    expect(toggleLocation({ enabled: true, locationIds: [HQ] }, HQ)).toEqual({
      enabled: false,
      locationIds: [],
    });
  });

  test("adding a location to a deliberately PAUSED fence does not silently resume it", () => {
    // An admin who paused someone for travel, then edited which offices they
    // belong to, has not asked for the restriction to come back on.
    const after = toggleLocation({ enabled: false, locationIds: [HQ] }, BRANCH);
    expect(after.enabled).toBe(false);
    expect(after.locationIds).toEqual([HQ, BRANCH]);
  });

  test("is a pure function — the caller's state is not mutated", () => {
    const before = { enabled: true, locationIds: [HQ] };
    toggleLocation(before, BRANCH);
    expect(before.locationIds).toEqual([HQ]);
  });

  test("tolerates a missing locationIds array", () => {
    expect(toggleLocation({ enabled: false }, HQ)).toEqual({ enabled: true, locationIds: [HQ] });
  });
});

describe("toggleEnabled", () => {
  test("pausing a fence PRESERVES the location assignment", () => {
    // Otherwise the only way to lift a restriction is to unassign everything
    // and later remember what it was.
    expect(toggleEnabled({ enabled: true, locationIds: [HQ, BRANCH] })).toEqual({
      enabled: false,
      locationIds: [HQ, BRANCH],
    });
  });

  test("resuming a paused fence re-enables it against the same locations", () => {
    expect(toggleEnabled({ enabled: false, locationIds: [HQ] })).toEqual({
      enabled: true,
      locationIds: [HQ],
    });
  });

  test("enabling with nothing assigned is refused, not sent to be rejected", () => {
    const result = toggleEnabled({ enabled: false, locationIds: [] });
    expect(result.enabled).toBe(false);
    expect(result.blocked).toBeTruthy();
  });

  test("disabling is always allowed", () => {
    // Never trap an admin in an enforced state they cannot switch off.
    expect(toggleEnabled({ enabled: true, locationIds: [HQ] }).enabled).toBe(false);
  });
});
