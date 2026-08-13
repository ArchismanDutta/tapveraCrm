import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { getCurrentCoordinates, GEO_ERRORS } from "./geolocation";

/**
 * The callback races in getCurrentCoordinates.
 *
 * getCurrentPosition is specified to invoke exactly one callback. Chrome on
 * macOS does not honour that — it fires the error callback with code 1 while
 * Core Location wakes, then fires success with a real fix. These tests pin
 * that behaviour, because the failure it caused was invisible in code review:
 * the promise was rejected before the position arrived, and users were told
 * macOS was blocking a browser that was working.
 */

const position = (accuracy = 35) => ({
  coords: { latitude: 22.5719245, longitude: 88.433039, accuracy },
});

const geoError = (code) => ({ code, message: "stub" });

/** Install a navigator whose geolocation behaves as `impl` describes. */
function stubGeolocation({ getCurrentPosition, watchPosition = vi.fn(), permission = "granted" }) {
  vi.stubGlobal("navigator", {
    geolocation: { getCurrentPosition, watchPosition, clearWatch: vi.fn() },
    permissions: { query: async () => ({ state: permission }) },
  });
  vi.stubGlobal("window", { isSecureContext: true });
}

beforeEach(() => {
  vi.useFakeTimers();
});

afterEach(() => {
  vi.useRealTimers();
  vi.unstubAllGlobals();
});

describe("Chrome on macOS fires BOTH callbacks", () => {
  it("resolves when a real fix follows a spurious denial", async () => {
    // Exactly the sequence observed in the browser console: error(1) then
    // success on the same call. This is the reported bug.
    stubGeolocation({
      getCurrentPosition: (onSuccess, onError) => {
        onError(geoError(1));
        setTimeout(() => onSuccess(position()), 10);
      },
    });

    const promise = getCurrentCoordinates({ timeoutMs: 15000 });
    await vi.advanceTimersByTimeAsync(50);

    await expect(promise).resolves.toMatchObject({
      latitude: 22.5719245,
      longitude: 88.433039,
      accuracy: 35,
    });
  });

  it("resolves even when the late fix arrives via watchPosition", async () => {
    // Some builds don't re-fire the original success callback; the grace-window
    // watch is what catches those.
    stubGeolocation({
      getCurrentPosition: (onSuccess, onError) => onError(geoError(1)),
      watchPosition: (onSuccess) => {
        setTimeout(() => onSuccess(position(20)), 500);
        return 1;
      },
    });

    const promise = getCurrentCoordinates({ timeoutMs: 15000 });
    await vi.advanceTimersByTimeAsync(1000);

    await expect(promise).resolves.toMatchObject({ accuracy: 20 });
  });

  it("does not settle twice when success follows the grace expiry", async () => {
    // A late fix after we have already given up must not turn a rejected
    // promise into an unhandled resolve.
    let late;
    stubGeolocation({
      getCurrentPosition: (onSuccess, onError) => {
        late = onSuccess;
        onError(geoError(1));
      },
    });

    const promise = getCurrentCoordinates({ timeoutMs: 15000 });
    const assertion = expect(promise).rejects.toMatchObject({
      code: GEO_ERRORS.SYSTEM_DENIED,
    });
    await vi.advanceTimersByTimeAsync(6000);
    await assertion;

    expect(() => late(position())).not.toThrow();
  });
});

describe("genuine failures are still reported promptly", () => {
  it("a site-level denial rejects immediately, with no grace wait", async () => {
    // Permissions API says the SITE is blocked — nothing transient about it,
    // and the advice must be about Chrome, not macOS.
    stubGeolocation({
      getCurrentPosition: (onSuccess, onError) => onError(geoError(1)),
      permission: "denied",
    });

    const promise = getCurrentCoordinates({ timeoutMs: 15000 });
    const assertion = expect(promise).rejects.toMatchObject({
      code: GEO_ERRORS.PERMISSION_DENIED,
    });
    await vi.advanceTimersByTimeAsync(0);
    await assertion;
  });

  it("a real OS block still reports SYSTEM_DENIED after the grace window", async () => {
    // Granted at site level, denied, and no fix ever arrives — the macOS
    // message is correct here, just no longer premature.
    stubGeolocation({
      getCurrentPosition: (onSuccess, onError) => onError(geoError(1)),
    });

    const promise = getCurrentCoordinates({ timeoutMs: 15000 });
    const assertion = expect(promise).rejects.toMatchObject({
      code: GEO_ERRORS.SYSTEM_DENIED,
    });
    await vi.advanceTimersByTimeAsync(6000);
    await assertion;
  });

  it("waits no longer than the caller's own timeout", async () => {
    // A caller asking for 2s must not be held for the full 5s grace.
    stubGeolocation({
      getCurrentPosition: (onSuccess, onError) => onError(geoError(1)),
    });

    const promise = getCurrentCoordinates({ timeoutMs: 2000 });
    const assertion = expect(promise).rejects.toMatchObject({
      code: GEO_ERRORS.SYSTEM_DENIED,
    });
    await vi.advanceTimersByTimeAsync(2100);
    await assertion;
  });

  it("position-unavailable rejects at once — nothing to wait for", async () => {
    stubGeolocation({
      getCurrentPosition: (onSuccess, onError) => onError(geoError(2)),
    });

    const promise = getCurrentCoordinates({ timeoutMs: 15000 });
    const assertion = expect(promise).rejects.toMatchObject({
      code: GEO_ERRORS.UNAVAILABLE,
    });
    await vi.advanceTimersByTimeAsync(0);
    await assertion;
  });

  it("timeout rejects at once", async () => {
    stubGeolocation({
      getCurrentPosition: (onSuccess, onError) => onError(geoError(3)),
    });

    const promise = getCurrentCoordinates({ timeoutMs: 15000 });
    const assertion = expect(promise).rejects.toMatchObject({
      code: GEO_ERRORS.TIMEOUT,
    });
    await vi.advanceTimersByTimeAsync(0);
    await assertion;
  });

  it("an insecure origin is named as such, not as a denial", async () => {
    // Otherwise this reads as a permission problem no amount of clicking
    // "allow" will fix.
    stubGeolocation({ getCurrentPosition: vi.fn() });
    vi.stubGlobal("window", { isSecureContext: false });

    await expect(getCurrentCoordinates()).rejects.toMatchObject({
      code: GEO_ERRORS.INSECURE_CONTEXT,
    });
  });
});

describe("the happy path is untouched", () => {
  it("resolves straight away when the first callback is a fix", async () => {
    stubGeolocation({
      getCurrentPosition: (onSuccess) => onSuccess(position(12)),
    });

    await expect(getCurrentCoordinates()).resolves.toMatchObject({ accuracy: 12 });
  });
});
