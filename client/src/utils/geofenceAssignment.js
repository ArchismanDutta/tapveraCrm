// src/utils/geofenceAssignment.js
//
// Geofenced login (2026-08-07).
// See docs/superpowers/specs/2026-08-07-geofenced-login-design.md
//
// Resolves "admin clicked something" into the {enabled, locationIds} pair the
// API expects. Extracted out of the page component purely so it can be tested
// (utils/__tests__ / geofenceAssignment.test.js) — this is small logic with an
// outsized consequence, since getting it wrong means the admin appears to
// configure a fence that is never actually enforced.
//
// ─── THE BUG THIS EXISTS TO PREVENT ───
// The first version of this computed the new enabled state as:
//
//     enabled: next.length > 0 && (user.geofence?.enabled ?? true)
//
// `??` only falls back on null/undefined, and every existing user has
// `geofence.enabled === false` from the schema default — so `false ?? true`
// is `false`, and clicking a location saved `enabled: false` every time. The
// locations persisted and the pill lit up, so the admin saw their click take
// effect, while enforcement stayed off permanently. A silent no-op on the
// feature's single most important action.

/**
 * Admin clicked a location pill.
 *
 * Assigning the first location turns enforcement ON — that is unambiguously
 * the intent behind "give this person a location", and requiring a second
 * separate switch afterwards is a step people forget, leaving a fence that
 * looks configured but does nothing.
 *
 * Removing the last one turns it OFF, because "enabled with nowhere to be" is
 * unsatisfiable and the API rejects it.
 */
export function toggleLocation(currentState, locationId) {
  const current = currentState.locationIds || [];
  const wasEnabled = currentState.enabled === true;

  const locationIds = current.includes(locationId)
    ? current.filter((id) => id !== locationId)
    : [...current, locationId];

  if (locationIds.length === 0) return { enabled: false, locationIds };

  // Adding the first location to an unfenced user enables the fence.
  // Otherwise the admin's existing on/off choice is preserved — so removing
  // one of three locations from a deliberately-paused fence doesn't silently
  // switch it back on.
  const enabled = current.length === 0 ? true : wasEnabled || current.length === 0;

  return { enabled, locationIds };
}

/**
 * Admin flipped the explicit enable/disable switch.
 *
 * Exists so a fence can be paused for someone travelling without discarding
 * which locations they were assigned — otherwise the only way to lift a
 * restriction is to unassign everything and later remember what it was.
 */
export function toggleEnabled(currentState) {
  const locationIds = currentState.locationIds || [];

  // Refused rather than sent: the API rejects enabling with nothing assigned,
  // and surfacing that as a red error banner on a switch the admin was
  // reasonably allowed to press is worse than not moving the switch.
  if (!currentState.enabled && locationIds.length === 0) {
    return { ...currentState, locationIds, blocked: "Assign at least one location first." };
  }

  return { enabled: !currentState.enabled, locationIds };
}

/** Read a user document into the flat shape the helpers above operate on. */
export function readState(user) {
  return {
    enabled: user?.geofence?.enabled === true,
    locationIds: (user?.geofence?.locations || []).map((l) =>
      typeof l === "object" && l !== null ? l._id : l
    ),
  };
}
