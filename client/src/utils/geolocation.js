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
  UNAVAILABLE: "UNAVAILABLE",
  TIMEOUT: "TIMEOUT",
};

const MESSAGES = {
  [GEO_ERRORS.UNSUPPORTED]:
    "This browser cannot report its location. Try Chrome, Safari, Edge or Firefox.",
  [GEO_ERRORS.INSECURE_CONTEXT]:
    "Location is only available over a secure (https) connection. Contact your administrator.",
  [GEO_ERRORS.PERMISSION_DENIED]:
    "Location access was blocked. Allow location for this site in your browser settings, then try again.",
  [GEO_ERRORS.UNAVAILABLE]:
    "Your device could not determine its location. Turn on GPS / location services and try again.",
  [GEO_ERRORS.TIMEOUT]:
    "Getting your location took too long. Move somewhere with a clearer signal and try again.",
};

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

    navigator.geolocation.getCurrentPosition(
      (position) => {
        resolve({
          latitude: position.coords.latitude,
          longitude: position.coords.longitude,
          // Forwarded verbatim and never massaged. The server subtracts a
          // capped amount of this uncertainty when deciding, so under-reporting
          // it here would cause false denials for people genuinely at their
          // desks — see ACCURACY_GRACE_METERS in server/utils/geofence.js.
          accuracy: position.coords.accuracy,
        });
      },
      (error) => {
        const codeMap = {
          1: GEO_ERRORS.PERMISSION_DENIED,
          2: GEO_ERRORS.UNAVAILABLE,
          3: GEO_ERRORS.TIMEOUT,
        };
        reject(new GeolocationError(codeMap[error?.code] || GEO_ERRORS.UNAVAILABLE));
      },
      {
        enableHighAccuracy: highAccuracy,
        timeout: timeoutMs,
        // 0 by default: a cached fix is exactly what someone who has driven
        // home would be served, which would defeat the check.
        maximumAge: maximumAgeMs,
      }
    );
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
