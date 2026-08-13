// src/utils/geolocation.js
//
// Geofenced login (2026-08-07).
// See docs/superpowers/specs/2026-08-07-geofenced-login-design.md
//
// A promise wrapper around navigator.geolocation with the failure modes named.
// The browser API is callback-based, and — more importantly — its error codes
// are numbers whose meanings decide what we can usefully tell the user. A
// denied permission is fixable by the person at the keyboard; an unavailable
// signal is not. Collapsing both into "location failed" produces the support
// ticket this feature is most likely to generate.

// Distinguishes "you can fix this" from "your device can't do this right now".
export const GEO_ERRORS = {
  UNSUPPORTED: "UNSUPPORTED",
  INSECURE_CONTEXT: "INSECURE_CONTEXT",
  PERMISSION_DENIED: "PERMISSION_DENIED",
  // The browser has the site permission but the OPERATING SYSTEM is refusing
  // the browser itself. See the note in getCurrentCoordinates.
  SYSTEM_DENIED: "SYSTEM_DENIED",
  UNAVAILABLE: "UNAVAILABLE",
  TIMEOUT: "TIMEOUT",
};

const isMac = () =>
  typeof navigator !== "undefined" && /Mac|iPhone|iPad/.test(navigator.platform || navigator.userAgent || "");

const MESSAGES = {
  [GEO_ERRORS.UNSUPPORTED]:
    "This browser cannot report its location. Try Chrome, Safari, Edge or Firefox.",
  [GEO_ERRORS.INSECURE_CONTEXT]:
    "Location is only available over a secure (https) connection. Contact your administrator.",
  [GEO_ERRORS.PERMISSION_DENIED]:
    "Location access was blocked for this site. Click the icon at the left of the address bar → Location → Allow, then try again.",
  [GEO_ERRORS.SYSTEM_DENIED]: isMac()
    ? "This site is allowed to use location, but macOS is blocking the browser itself. Open System Settings → Privacy & Security → Location Services, turn it on, and enable your browser in the list. You may need to restart the browser afterwards."
    : "This site is allowed to use location, but your operating system is blocking the browser. Enable location services for the browser in your system privacy settings, then try again.",
  [GEO_ERRORS.UNAVAILABLE]:
    "Your device could not determine its location. Turn on GPS / location services and try again.",
  [GEO_ERRORS.TIMEOUT]:
    "Getting your location took too long. Move somewhere with a clearer signal and try again.",
};

/**
 * Great-circle distance in metres. Mirrors server/utils/geofence.js exactly —
 * same formula, same Earth radius — so the admin's "test my position" readout
 * cannot disagree with the server's actual verdict. A diagnostic that reports
 * a different number from the thing it is diagnosing is worse than none.
 */
export function haversineDistanceMeters(lat1, lon1, lat2, lon2) {
  const R = 6371008.8;
  const toRad = (deg) => (deg * Math.PI) / 180;
  const dLat = toRad(lat2 - lat1);
  const dLon = toRad(lon2 - lon1);
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLon / 2) ** 2;
  return 2 * R * Math.asin(Math.min(1, Math.sqrt(a)));
}

export class GeolocationError extends Error {
  constructor(code) {
    super(MESSAGES[code] || MESSAGES[GEO_ERRORS.UNAVAILABLE]);
    this.name = "GeolocationError";
    this.code = code;
  }
}

/**
 * Read the device's current position.
 *
 * @param {Object}  options
 * @param {number}  options.timeoutMs      How long to wait for a fix.
 * @param {boolean} options.highAccuracy   Ask for GPS rather than a coarse fix.
 * @param {number}  options.maximumAgeMs   How stale a cached fix may be.
 * @returns {Promise<{latitude, longitude, accuracy}>}
 */
/**
 * How long to keep listening after a CONTRADICTORY permission denial before
 * concluding the OS is really blocking the browser.
 *
 * See the note in getCurrentCoordinates. Long enough for Core Location to
 * finish waking (observed at well under a second), short enough that someone
 * facing a genuine system block isn't left staring at a spinner.
 */
const CONTRADICTORY_DENIAL_GRACE_MS = 5000;

export function getCurrentCoordinates({
  timeoutMs = 15000,
  highAccuracy = true,
  maximumAgeMs = 0,
} = {}) {
  return new Promise((resolve, reject) => {
    if (typeof navigator === "undefined" || !navigator.geolocation) {
      reject(new GeolocationError(GEO_ERRORS.UNSUPPORTED));
      return;
    }

    // Checked explicitly and up front, because otherwise this surfaces as a
    // PERMISSION_DENIED that no amount of clicking "allow" will fix — the
    // browser silently refuses the API on plain http (localhost excepted) and
    // reports it as a denial. Whoever hits this needs to hear "the site isn't
    // on https", not "check your browser settings".
    if (typeof window !== "undefined" && window.isSecureContext === false) {
      reject(new GeolocationError(GEO_ERRORS.INSECURE_CONTEXT));
      return;
    }

    const options = {
      enableHighAccuracy: highAccuracy,
      timeout: timeoutMs,
      // 0 by default: a cached fix is exactly what someone who has driven
      // home would be served, which would defeat the check.
      maximumAge: maximumAgeMs,
    };

    // ─── THIS PROMISE SETTLES ONCE, THE BROWSER MAY CALL BACK TWICE ───
    //
    // getCurrentPosition is specified to invoke exactly one callback. Chrome
    // on macOS does not honour that: it fires the error callback with code 1
    // ("User denied Geolocation") while Core Location is still waking, and
    // then fires the SUCCESS callback with a real fix immediately afterwards.
    //
    // The previous version rejected inside the error callback, so the late
    // position arrived at an already-settled promise and was thrown away —
    // every affected user was told macOS was blocking their browser while
    // their browser was, at that moment, successfully reporting its location.
    //
    // Hence the explicit guard: whichever callback carries usable information
    // wins, no matter which order they arrive in.
    let settled = false;
    let graceTimer = null;
    let watchId = null;

    const cleanup = () => {
      if (graceTimer) clearTimeout(graceTimer);
      if (watchId != null && navigator.geolocation.clearWatch) {
        navigator.geolocation.clearWatch(watchId);
      }
    };

    const succeed = (position) => {
      if (settled) return;
      settled = true;
      cleanup();
      resolve({
        latitude: position.coords.latitude,
        longitude: position.coords.longitude,
        // Forwarded verbatim and never massaged. The server subtracts a
        // capped amount of this uncertainty when deciding, so under-reporting
        // it here would cause false denials for people genuinely at their
        // desks — see ACCURACY_GRACE_METERS in server/utils/geofence.js.
        accuracy: position.coords.accuracy,
      });
    };

    const fail = (code) => {
      if (settled) return;
      settled = true;
      cleanup();
      reject(new GeolocationError(code));
    };

    const onError = (error) => {
      if (settled) return;

      const codeMap = {
        1: GEO_ERRORS.PERMISSION_DENIED,
        2: GEO_ERRORS.UNAVAILABLE,
        3: GEO_ERRORS.TIMEOUT,
      };
      const code = codeMap[error?.code] || GEO_ERRORS.UNAVAILABLE;

      // Nothing ambiguous about "no signal" or "timed out" — report at once.
      if (code !== GEO_ERRORS.PERMISSION_DENIED) {
        fail(code);
        return;
      }

      // ─── "BLOCKED" HAS THREE CAUSES, NOT TWO ───
      //
      // The spec gives one code (1) for what turns out to be three situations:
      //   a) this site is not allowed        -> the user can fix it, in Chrome
      //   b) the OS is blocking the browser  -> the user fixes it in macOS
      //   c) nothing is wrong; Core Location just hadn't woken up yet
      //
      // The Permissions API separates (a) from the others: it reports the
      // SITE-level grant only, so a state other than "granted" means the site
      // really is blocked and there is nothing transient about it.
      //
      // "Granted, yet denied" is a contradiction, and it is either (b) or (c).
      // They are indistinguishable at this instant and only time tells them
      // apart — so instead of guessing (the old behaviour, which always
      // guessed (b) and was usually wrong), keep listening. A fix arriving
      // means it was (c); silence means it really was (b).
      getPermissionState()
        .then((state) => {
          if (settled) return;

          if (state !== "granted") {
            fail(GEO_ERRORS.PERMISSION_DENIED);
            return;
          }

          // watchPosition rather than another getCurrentPosition: it delivers
          // whenever the platform is ready instead of racing a second cold
          // start, and the original call's success callback is still live and
          // can also settle us first.
          try {
            watchId = navigator.geolocation.watchPosition(succeed, () => {}, options);
          } catch {
            // Older/odd implementations without watchPosition — the original
            // success callback is still the fallback.
          }

          graceTimer = setTimeout(
            () => fail(GEO_ERRORS.SYSTEM_DENIED),
            Math.min(CONTRADICTORY_DENIAL_GRACE_MS, timeoutMs)
          );
        })
        .catch(() => fail(GEO_ERRORS.PERMISSION_DENIED));
    };

    navigator.geolocation.getCurrentPosition(succeed, onError, options);
  });
}

/**
 * Has the user already granted location permission?
 *
 * Used by the background session watcher to stay silent when it would
 * otherwise trigger a permission prompt out of nowhere, minutes into a
 * session, with no visible action to explain it. Permissions API isn't
 * universal (older Safari), so an unknown answer resolves to "prompt" and the
 * caller decides.
 *
 * @returns {Promise<"granted"|"denied"|"prompt">}
 */
export async function getPermissionState() {
  try {
    if (typeof navigator === "undefined" || !navigator.permissions?.query) return "prompt";
    const status = await navigator.permissions.query({ name: "geolocation" });
    return status.state;
  } catch {
    return "prompt";
  }
}
