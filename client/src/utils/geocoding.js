// src/utils/geocoding.js
//
// Geofenced login (2026-08-07) — address search, key-free.
//
// Nominatim is OpenStreetMap's own geocoder. No API key, no account, no
// billing — which is the whole reason it is here rather than Google's
// Geocoding API.
//
// ─── USAGE POLICY, WHICH IS BINDING ───
// https://operations.osmfoundation.org/policies/nominatim/
// It is a free service run on donated hardware, and the policy is enforced by
// IP blocking rather than by quota errors. The two rules that matter:
//
//   1. Absolute maximum of 1 request per second.
//   2. Requests must be identifiable (a valid Referer or User-Agent).
//
// This module honours (1) by construction: the search only fires on an
// explicit submit, and the in-flight guard below refuses to issue a second
// request while one is outstanding. Browsers send Referer automatically and
// forbid scripts from setting User-Agent, so (2) is satisfied by the browser.
//
// If this ever needs to run at volume — bulk-geocoding an address list, say —
// it must move to a self-hosted Nominatim or a paid provider. Doing that
// through this endpoint would get the office IP banned.

const NOMINATIM_URL = "https://nominatim.openstreetmap.org/search";

let inFlight = false;

export class GeocodingError extends Error {
  constructor(message) {
    super(message);
    this.name = "GeocodingError";
  }
}

/**
 * Address → coordinates.
 *
 * @returns {Promise<{latitude:number, longitude:number, formattedAddress:string}>}
 */
export async function geocodeAddress(query) {
  const trimmed = String(query || "").trim();
  if (!trimmed) throw new GeocodingError("Enter an address to search for.");

  // Rate-limit guard. Also stops a double-click from issuing two requests, and
  // stops Enter-key repeat from machine-gunning the service.
  if (inFlight) {
    throw new GeocodingError("A search is already running — one moment.");
  }
  inFlight = true;

  try {
    const params = new URLSearchParams({
      format: "jsonv2",
      q: trimmed,
      limit: "1",
      addressdetails: "0",
    });

    const res = await fetch(`${NOMINATIM_URL}?${params}`, {
      headers: { Accept: "application/json" },
      // No credentials — this is a third-party public endpoint and there is no
      // reason for it to receive anything of ours.
      credentials: "omit",
    });

    if (res.status === 429 || res.status === 403) {
      throw new GeocodingError(
        "Address search is rate-limited right now. Wait a moment, or click the map directly."
      );
    }
    if (!res.ok) {
      throw new GeocodingError(`Address search failed (${res.status}).`);
    }

    const results = await res.json();
    if (!Array.isArray(results) || !results.length) {
      throw new GeocodingError("No match for that address. Try a broader search, or click the map.");
    }

    const [hit] = results;
    const latitude = Number(hit.lat);
    const longitude = Number(hit.lon);

    // Nominatim returns coordinates as STRINGS. Coercing without checking would
    // put a NaN into the form, which reads downstream as "no location" and
    // produces a confusing validation error rather than an honest failure here.
    if (!Number.isFinite(latitude) || !Number.isFinite(longitude)) {
      throw new GeocodingError("Address search returned an unusable result.");
    }

    return {
      latitude,
      longitude,
      formattedAddress: hit.display_name || trimmed,
    };
  } catch (err) {
    if (err instanceof GeocodingError) throw err;
    throw new GeocodingError(
      "Could not reach the address search service. Check your connection, or click the map directly."
    );
  } finally {
    inFlight = false;
  }
}
