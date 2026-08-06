// utils/webPush.js
//
// Client half of Web Push: register the service worker, subscribe, hand the
// subscription to the server.
//
// ─── ON PROMPT TIMING ───
// Nothing here prompts on load. `Notification.requestPermission()` is a
// one-shot: if the user denies it, the browser remembers "denied" and there is
// no way to ask again from code — they have to dig into site settings, which
// nobody does. A prompt fired at page load, before the user has any idea what
// they'd be agreeing to, gets denied most of the time and burns the permission
// permanently.
//
// So `enablePush()` is only ever called from a real click on an explicit
// in-app "Enable notifications" control (see NotificationPermissionPrompt),
// shown after the user has actually sent a message. By then the value is
// obvious and the browser dialog is a formality.
import API from "../api";

const SW_PATH = "/sw.js";

/* ── Capability checks ────────────────────────────────────────────────── */

export const isSupported = () =>
  typeof window !== "undefined" &&
  "serviceWorker" in navigator &&
  "PushManager" in window &&
  "Notification" in window;

export const permission = () =>
  typeof Notification === "undefined" ? "unsupported" : Notification.permission;

/** iOS delivers Web Push ONLY to a PWA installed to the home screen. */
export const isIOS = () =>
  typeof navigator !== "undefined" &&
  (/iPad|iPhone|iPod/.test(navigator.userAgent) ||
    // iPadOS 13+ reports itself as a Mac; the touch points give it away.
    (navigator.platform === "MacIntel" && navigator.maxTouchPoints > 1));

export const isStandalone = () =>
  typeof window !== "undefined" &&
  (window.matchMedia?.("(display-mode: standalone)").matches ||
    window.navigator.standalone === true);

/**
 * Can this browser actually deliver a push right now?
 * Returns a reason so the UI can explain itself instead of just hiding.
 */
export function pushAvailability() {
  if (!isSupported()) return { ok: false, reason: "unsupported" };
  if (isIOS() && !isStandalone()) return { ok: false, reason: "ios-needs-install" };
  if (permission() === "denied") return { ok: false, reason: "denied" };
  return { ok: true, reason: permission() === "granted" ? "granted" : "prompt" };
}

/* ── Registration ─────────────────────────────────────────────────────── */

let swRegistration = null;

export async function registerServiceWorker() {
  if (!isSupported()) return null;
  if (swRegistration) return swRegistration;
  try {
    swRegistration = await navigator.serviceWorker.register(SW_PATH);
    return swRegistration;
  } catch (err) {
    console.error("[push] service worker registration failed:", err);
    return null;
  }
}

/** VAPID keys arrive base64url-encoded; PushManager wants a Uint8Array. */
function urlBase64ToUint8Array(base64String) {
  const padding = "=".repeat((4 - (base64String.length % 4)) % 4);
  const base64 = (base64String + padding).replace(/-/g, "+").replace(/_/g, "/");
  const raw = window.atob(base64);
  return Uint8Array.from([...raw].map((c) => c.charCodeAt(0)));
}

/* ── Subscribe / unsubscribe ──────────────────────────────────────────── */

/**
 * Ask for permission and subscribe. MUST be called from a user gesture.
 * @returns {Promise<{ok: boolean, reason: string}>}
 */
export async function enablePush() {
  const availability = pushAvailability();
  if (!availability.ok) return availability;

  const { data } = await API.get("/api/push/public-key");
  if (!data?.enabled || !data.publicKey) {
    // Server has no VAPID keys — don't burn the browser permission on a
    // capability the backend can't deliver.
    return { ok: false, reason: "server-not-configured" };
  }

  const result = await Notification.requestPermission();
  if (result !== "granted") return { ok: false, reason: result };

  const registration = await registerServiceWorker();
  if (!registration) return { ok: false, reason: "sw-failed" };
  await navigator.serviceWorker.ready;

  // Stash the key where the worker can reach it — `pushsubscriptionchange`
  // fires with no page open, so it can't ask the server for it.
  try {
    const cache = await caches.open("push-config");
    await cache.put("vapid", new Response(data.publicKey));
  } catch {
    /* non-fatal: only affects silent re-subscription after endpoint rotation */
  }

  const existing = await registration.pushManager.getSubscription();
  const subscription =
    existing ||
    (await registration.pushManager.subscribe({
      // Required by every browser: a push must always result in a visible
      // notification. Silent pushes are not permitted.
      userVisibleOnly: true,
      applicationServerKey: urlBase64ToUint8Array(data.publicKey),
    }));

  await API.post("/api/push/subscribe", { subscription });
  return { ok: true, reason: "subscribed" };
}

export async function disablePush() {
  if (!isSupported()) return false;
  const registration = await navigator.serviceWorker.getRegistration(SW_PATH);
  const subscription = await registration?.pushManager.getSubscription();
  if (!subscription) return false;

  // Tell the server FIRST. If the order were reversed and the request failed,
  // the row would linger server-side with no device able to remove it.
  await API.post("/api/push/unsubscribe", { endpoint: subscription.endpoint }).catch(() => {});
  await subscription.unsubscribe();
  return true;
}

/**
 * Re-register on app start for users who already granted permission.
 *
 * This does NOT prompt — `Notification.permission === "granted"` means they
 * already said yes. It exists because a browser can drop a subscription
 * (endpoint rotation, storage eviction) without telling anyone, and the symptom
 * is simply that notifications stop.
 */
export async function resumePush() {
  if (permission() !== "granted") return;
  if (!pushAvailability().ok) return;
  try {
    await enablePush();
  } catch (err) {
    console.error("[push] resume failed:", err);
  }
}
