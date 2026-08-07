// server/utils/geofence.js
//
// Geofenced login (2026-08-07) — Phase 1.
// See docs/superpowers/specs/2026-08-07-geofenced-login-design.md
//
// The whole decision — "may this user sign in from this point?" — lives here,
// as pure functions over plain objects. Nothing in this file touches the
// database, req/res, or mongoose. That is what makes the rules testable
// without a running Mongo (tests/geofence.test.js pins every branch below),
// and it is why the two call sites — authController.login and the periodic
// /api/geofence/verify re-check — cannot drift apart: they both ask this one
// function and neither re-implements any part of the rule.
//
// ─── THREAT MODEL, STATED PLAINLY ───
// The coordinates are supplied by the client. A determined technical user can
// override them (Chrome DevTools has a location spoofer built into the Sensors
// panel; so does every mobile emulator). NOTHING in this file changes that,
// and no client-side code could — the browser is the attacker's computer.
//
// So this is an access-control policy, not a tamper-proof security boundary.
// It reliably stops casual out-of-policy access — logging in from home, from a
// cafe, a family member using saved credentials — which is the actual thing
// being asked for. It does not stop a motivated insider who knows what
// DevTools is. If the requirement ever hardens into "must be un-spoofable",
// the answer is not more client-side checking; it is a factor the browser
// cannot fabricate — the office network/VPN as a second gate, or the biometric
// terminal this codebase already integrates (docs/biometric-attendance-integration.md).
// Recording denials in GeofenceEvent is the mitigation that does work here:
// spoofing leaves a trail of impossible movement in the audit log.

// Mean Earth radius (metres), IUGG. Haversine on a sphere is accurate to
// ~0.5% versus a proper ellipsoidal (Vincenty) calculation — that is ±1m over
// a 200m fence, which is an order of magnitude below GPS error. The extra
// complexity of Vincenty would buy precision that the input data does not have.
const EARTH_RADIUS_METERS = 6371008.8;

// How much of the browser's self-reported error circle we forgive.
//
// The browser hands us a point AND an `accuracy` value: the radius in metres
// within which it is 95% confident the true position lies. Indoors — which is
// exactly where fenced employees are — that is routinely 50-200m on wifi
// positioning, and can exceed 1km. Ignoring it means denying people who are
// genuinely at their desk, because their reported point landed just outside a
// fence that their error circle comfortably overlaps.
//
// So a user is admitted if they *could* be inside the fence: distance is
// measured, then up to this many metres of their stated uncertainty is
// subtracted. Capped, because uncapped it degenerates — a device reporting
// 50km accuracy (IP-based fallback positioning, which is what a browser
// returns when it has no GPS and no wifi fix) would otherwise satisfy any
// fence on the continent, which is precisely the case this must reject.
const ACCURACY_GRACE_METERS = 100;

// Beyond this, the fix is not a location, it is a guess — typically the
// browser falling back to IP geolocation. Treated as "no usable location"
// rather than silently trusted or silently denied, so the user gets an
// actionable message ("your device could not get a precise fix") instead of a
// bare rejection they cannot act on.
const MAX_USABLE_ACCURACY_METERS = 5000;

/**
 * Great-circle distance between two lat/lng points, in metres.
 * Haversine — numerically stable for the short distances this deals in,
 * unlike the spherical law of cosines.
 */
function haversineDistanceMeters(lat1, lon1, lat2, lon2) {
  const toRad = (deg) => (deg * Math.PI) / 180;

  const dLat = toRad(lat2 - lat1);
  const dLon = toRad(lon2 - lon1);
  const rLat1 = toRad(lat1);
  const rLat2 = toRad(lat2);

  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(rLat1) * Math.cos(rLat2) * Math.sin(dLon / 2) ** 2;

  return 2 * EARTH_RADIUS_METERS * Math.asin(Math.min(1, Math.sqrt(a)));
}

/**
 * Validate and normalise client-supplied coordinates.
 *
 * Everything here arrives over the wire from a browser, so it is all
 * untrusted: strings where numbers are expected, NaN, Infinity, nulls, and
 * out-of-range values are all reachable from a hand-rolled request, and
 * several of them would otherwise poison the arithmetic downstream (NaN
 * compares false against every threshold, which in a naive implementation
 * means "outside every fence" — or worse, depending on comparison direction,
 * "inside all of them").
 *
 * Returns { valid: true, latitude, longitude, accuracy } or
 *         { valid: false, reason }.
 */
function normalizeCoordinates(raw) {
  if (!raw || typeof raw !== "object") {
    return { valid: false, reason: "No location was provided." };
  }

  const latitude = Number(raw.latitude);
  const longitude = Number(raw.longitude);

  // Number.isFinite rejects NaN and ±Infinity in one go. Number("") is 0, not
  // NaN, so the explicit empty-string guard matters: without it an empty
  // payload reads as the coordinate origin (0,0) in the Gulf of Guinea, which
  // is a real point that a sufficiently large fence could contain.
  if (
    raw.latitude === "" || raw.longitude === "" ||
    raw.latitude === null || raw.longitude === null ||
    !Number.isFinite(latitude) || !Number.isFinite(longitude)
  ) {
    return { valid: false, reason: "Location coordinates were malformed." };
  }

  if (latitude < -90 || latitude > 90 || longitude < -180 || longitude > 180) {
    return { valid: false, reason: "Location coordinates were out of range." };
  }

  // Absent accuracy is treated as the worst case we still accept, not as
  // perfect. A client that omits the field — including one hand-crafted to
  // omit it — must not thereby earn more trust than an honest browser that
  // reports its real uncertainty.
  let accuracy = Number(raw.accuracy);
  if (!Number.isFinite(accuracy) || accuracy < 0) {
    accuracy = MAX_USABLE_ACCURACY_METERS;
  }

  if (accuracy > MAX_USABLE_ACCURACY_METERS) {
    return {
      valid: false,
      reason:
        "Your device could not determine a precise location. Enable GPS / location services and try again.",
    };
  }

  return { valid: true, latitude, longitude, accuracy };
}

/**
 * Is this user subject to geofencing at all?
 *
 * Two hard exclusions, both deliberate and both documented in the design doc:
 *
 *  1. CLIENTS ARE NEVER FENCED. Clients are external customers logging into
 *     the client portal from their own offices, homes and countries. There is
 *     no location that "should" restrict them and the requirement explicitly
 *     excludes them. Checked on userType, not role, because a Client document
 *     has no `role` field at all — authController assigns role "client" only
 *     after login succeeds, so keying on role here would read `undefined` at
 *     exactly the moment the decision is made.
 *
 *  2. SUPER ADMIN IS NEVER FENCED. This is a lockout guard, not a privilege.
 *     The Super Admin is the only account that can edit or remove a fence. If
 *     they could be fenced out, a single mistyped coordinate — a swapped
 *     lat/lng, a radius entered in kilometres — would lock the only person
 *     able to undo it out of the system permanently, with no recovery path
 *     short of editing the database by hand. The feature must not be able to
 *     brick itself. Same reasoning the codebase already applies in
 *     authMiddleware.authorize(), where super-admin bypasses every role check.
 */
function isSubjectToGeofence(user, userType = "User") {
  if (!user) return false;
  if (userType === "Client") return false;

  const role = String(user.role || "").toLowerCase();
  if (role === "super-admin" || role === "superadmin" || role === "client") return false;

  const fence = user.geofence;
  if (!fence || fence.enabled !== true) return false;

  return Array.isArray(fence.locations) && fence.locations.length > 0;
}

/**
 * The decision.
 *
 * @param {Array}  locations  Resolved GeofenceLocation docs assigned to the user.
 * @param {Object} rawCoords  Untrusted { latitude, longitude, accuracy } from the client.
 * @returns {Object} {
 *   allowed, reason, code,
 *   nearest: { id, name, distanceMeters } | null,
 *   coordinates: { latitude, longitude, accuracy } | null
 * }
 *
 * `code` is what the HTTP layer branches on, so status-code choice stays out
 * of this file:
 *   NO_LOCATION      -> 428, "give me coordinates and retry"
 *   OUTSIDE_FENCE    -> 403, refusal
 *   NO_ACTIVE_FENCE  -> 403, misconfiguration (see below)
 */
/**
 * Is this stored fence usable for a decision?
 *
 * `Number.isFinite(Number(x))` alone is NOT sufficient here, and the
 * difference is a genuine bug the tests caught: Number(null) is 0, Number("")
 * is 0, and Number([]) is 0 — all finite. A GeofenceLocation whose latitude
 * had been nulled out would therefore have been read as a real fence centred
 * on (0, 0) in the Gulf of Guinea, quietly denying everyone assigned to it
 * with no indication that the location itself was the problem. Requiring the
 * raw value to already be a number closes that off, so a corrupt row is
 * treated as what it is — missing — and surfaces as NO_ACTIVE_FENCE.
 */
function isUsableLocation(loc) {
  return Boolean(
    loc &&
    loc.isActive !== false &&
    typeof loc.latitude === "number" && Number.isFinite(loc.latitude) &&
    typeof loc.longitude === "number" && Number.isFinite(loc.longitude) &&
    typeof loc.radiusMeters === "number" && Number.isFinite(loc.radiusMeters) &&
    loc.radiusMeters > 0
  );
}

function evaluate(locations, rawCoords) {
  const active = (Array.isArray(locations) ? locations : []).filter(isUsableLocation);

  // Assigned fences exist but none resolve to an active location — every one
  // was deactivated, or the refs dangle.
  //
  // This FAILS CLOSED, and that is a real judgement call worth being explicit
  // about. Failing open here would be the more forgiving behaviour, but it
  // would mean deactivating a location silently unfences everyone attached to
  // it — the restriction quietly evaporates and nothing surfaces that it has.
  // A user who cannot log in gets noticed and fixed within minutes; a fence
  // that stopped applying gets noticed after an incident. The error message
  // names the actual cause so whoever picks up the ticket can act on it
  // immediately rather than debugging a login failure from scratch.
  if (!active.length) {
    return {
      allowed: false,
      code: "NO_ACTIVE_FENCE",
      reason:
        "Your account is restricted to specific locations, but none are currently active. Please contact your administrator.",
      nearest: null,
      coordinates: null,
    };
  }

  const coords = normalizeCoordinates(rawCoords);
  if (!coords.valid) {
    return {
      allowed: false,
      code: "NO_LOCATION",
      reason: coords.reason,
      nearest: null,
      coordinates: null,
    };
  }

  const { latitude, longitude, accuracy } = coords;
  const grace = Math.min(accuracy, ACCURACY_GRACE_METERS);

  let nearest = null;

  for (const loc of active) {
    const distance = haversineDistanceMeters(
      latitude,
      longitude,
      Number(loc.latitude),
      Number(loc.longitude)
    );

    // Distance past the fence edge. Negative means comfortably inside.
    const overshoot = distance - Number(loc.radiusMeters);

    if (!nearest || overshoot < nearest.overshoot) {
      nearest = {
        id: loc._id || loc.id || null,
        name: loc.name || "Assigned location",
        distanceMeters: Math.round(distance),
        overshoot,
      };
    }

    // Any ONE assigned fence being satisfied is enough — a user assigned both
    // "Kolkata HQ" and "Delhi Branch" is allowed at either. Multiple fences
    // are a union, never an intersection; an intersection would be
    // unsatisfiable for any two locations that don't overlap, which is all of
    // them.
    if (overshoot <= grace) {
      return {
        allowed: true,
        code: "INSIDE_FENCE",
        reason: "",
        nearest: {
          id: loc._id || loc.id || null,
          name: loc.name || "Assigned location",
          distanceMeters: Math.round(distance),
        },
        coordinates: { latitude, longitude, accuracy },
      };
    }
  }

  return {
    allowed: false,
    code: "OUTSIDE_FENCE",
    reason: `You are outside your permitted work location${
      nearest ? ` (${Math.round(nearest.overshoot)}m beyond ${nearest.name})` : ""
    }. Sign in from an approved location, or contact your administrator.`,
    nearest: nearest
      ? { id: nearest.id, name: nearest.name, distanceMeters: nearest.distanceMeters }
      : null,
    coordinates: { latitude, longitude, accuracy },
  };
}

module.exports = {
  haversineDistanceMeters,
  normalizeCoordinates,
  isSubjectToGeofence,
  isUsableLocation,
  evaluate,
  EARTH_RADIUS_METERS,
  ACCURACY_GRACE_METERS,
  MAX_USABLE_ACCURACY_METERS,
};
