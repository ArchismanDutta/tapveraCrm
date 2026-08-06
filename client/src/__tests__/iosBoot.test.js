import { describe, it, expect, beforeEach, afterEach } from "vitest";

/**
 * Guards the iOS white-screen regression.
 *
 * iOS Safari has no `Notification` global outside an installed PWA. Reading it
 * bare at module load threw a ReferenceError before React could mount, so the
 * entire app rendered blank on every iPhone while Android was fine.
 *
 * These tests import the module with the global ABSENT — the condition that
 * actually broke — so a future edit that reintroduces a bare read fails here
 * rather than on someone's phone.
 */
describe("iOS boot safety", () => {
  let savedNotification;
  let savedAudioContext;

  beforeEach(() => {
    savedNotification = globalThis.Notification;
    savedAudioContext = globalThis.AudioContext;
    // Simulate iOS Safari: neither API exists.
    delete globalThis.Notification;
    delete globalThis.AudioContext;
    delete globalThis.webkitAudioContext;
  });

  afterEach(() => {
    if (savedNotification) globalThis.Notification = savedNotification;
    if (savedAudioContext) globalThis.AudioContext = savedAudioContext;
  });

  it("browserNotifications imports without throwing when Notification is missing", async () => {
    const mod = await import("../utils/browserNotifications.js?ios-boot");
    expect(mod.default).toBeTruthy();
  });

  it("reports permission as 'default' rather than crashing", async () => {
    const { BrowserNotificationManager } = await import("../utils/browserNotifications.js?ios-perm");
    const mgr = new BrowserNotificationManager();
    expect(mgr.permission).toBe("default");
  });

  it("isSupported() is false, isEnabled() is false", async () => {
    const { BrowserNotificationManager } = await import("../utils/browserNotifications.js?ios-supp");
    const mgr = new BrowserNotificationManager();
    expect(mgr.isSupported()).toBe(false);
    expect(mgr.isEnabled()).toBe(false);
  });

  it("showNotification returns null instead of constructing a Notification", async () => {
    const { BrowserNotificationManager } = await import("../utils/browserNotifications.js?ios-show");
    const mgr = new BrowserNotificationManager();
    expect(mgr.showNotification("hi", {})).toBeNull();
  });

  it("requestPermission resolves false rather than throwing", async () => {
    const { BrowserNotificationManager } = await import("../utils/browserNotifications.js?ios-req");
    const mgr = new BrowserNotificationManager();
    await expect(mgr.requestPermission()).resolves.toBe(false);
  });
});
