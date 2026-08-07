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
        const code = codeMap[error?.code] || GEO_ERRORS.UNAVAILABLE;

        if (code !== GEO_ERRORS.PERMISSION_DENIED) {
          reject(new GeolocationError(code));
          return;
        }

        // ─── "BLOCKED" HAS TWO VERY DIFFERENT CAUSES ───
        //
        // The spec gives one code (1) for both "this site is not allowed" and
        // "the browser itself is not allowed by the OS". On macOS the second is
        // extremely common and invisible: Chrome can show Location as Allowed
        // for the site while System Settings → Privacy & Security → Location
        // Services has the browser switched off entirely. The user then follows
        // a message telling them to fix browser settings that are already
        // correct, and concludes the app is broken.
        //
        // The Permissions API disambiguates: it reports the SITE-level grant
        // only. So "the site says granted, yet we were denied" can only mean
        // the refusal came from below the browser.
        getPermissionState()
          .then((state) => {
            reject(
              new GeolocationError(
                state === "granted" ? GEO_ERRORS.SYSTEM_DENIED : GEO_ERRORS.PERMISSION_DENIED
              )
            );
          })
          .catch(() => reject(new GeolocationError(GEO_ERRORS.PERMISSION_DENIED)));
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
