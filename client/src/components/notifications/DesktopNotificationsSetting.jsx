import React, { useCallback, useEffect, useState } from "react";
import { Bell, BellOff, Share, Loader2, AlertCircle, Check } from "lucide-react";
import API from "../../api";
import { pushAvailability, enablePush, disablePush } from "../../utils/webPush";

/**
 * The deliberate, re-findable "Desktop notifications" switch.
 *
 * ─── WHY A SETTING AND NOT JUST THE PROMPT ───
 * NotificationPermissionPrompt is contextual: it appears once, at a moment when
 * notifications are obviously useful, and is dismissible. That is the right way
 * to ASK. It is the wrong way to CHANGE YOUR MIND — someone who dismissed it in
 * March and wants notifications in June has nowhere to go, and someone who
 * enabled them and now finds them noisy has to dig through browser site
 * settings to stop them. This is the place both of those people can reach.
 *
 * ─── TWO SWITCHES THAT LOOK LIKE ONE ───
 * "On" requires two independent things to be true, and they fail differently:
 *
 *   1. The BROWSER permission + a live push subscription. Granted per-device,
 *      revocable only through browser settings, and can vanish on its own when
 *      an endpoint rotates or storage is evicted.
 *   2. The SERVER preference (MessagingPrefs.pushEnabled). Per-account, so
 *      turning it off silences every device at once.
 *
 * Collapsing them into one toggle is what users expect, so that is what this
 * shows — but the failure states are reported separately, because "your browser
 * is blocking this" and "you switched this off" need completely different
 * actions and a single "notifications are off" would hide which one applies.
 */
export default function DesktopNotificationsSetting() {
  const [prefEnabled, setPrefEnabled] = useState(null); // null = still loading
  const [availability, setAvailability] = useState({ ok: false, reason: "loading" });
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [justSaved, setJustSaved] = useState(false);

  const refreshAvailability = useCallback(() => {
    setAvailability(pushAvailability());
  }, []);

  useEffect(() => {
    refreshAvailability();
    API.get("/api/push/prefs")
      .then(({ data }) => setPrefEnabled(data?.pushEnabled !== false))
      .catch(() => setPrefEnabled(true)); // server default; never leave it stuck loading
  }, [refreshAvailability]);

  const granted = availability.ok && availability.reason === "granted";
  const on = granted && prefEnabled === true;

  const flash = () => {
    setJustSaved(true);
    setTimeout(() => setJustSaved(false), 2000);
  };

  const turnOn = async () => {
    setBusy(true);
    setError("");
    try {
      // Order matters: get the browser subscription first. If we flipped the
      // server preference first and the user then denied the browser dialog,
      // the setting would read "on" while nothing could ever be delivered.
      if (!granted) {
        const { ok, reason } = await enablePush();
        refreshAvailability();
        if (!ok) {
          setError(
            reason === "denied"
              ? "Your browser is blocking notifications for this site. Open the padlock icon in the address bar and allow notifications, then try again."
              : reason === "server-not-configured"
              ? "Push isn't configured on the server yet. Ask an administrator to set the VAPID keys."
              : reason === "ios-needs-install"
              ? "On iPhone, add the CRM to your Home Screen first — iOS only delivers notifications to installed apps."
              : "Couldn't enable notifications. Please try again."
          );
          return;
        }
      }

      await API.patch("/api/push/prefs", { pushEnabled: true });
      setPrefEnabled(true);
      flash();
    } catch {
      setError("Couldn't save that. Please try again.");
    } finally {
      setBusy(false);
    }
  };

  const turnOff = async () => {
    setBusy(true);
    setError("");
    try {
      // Server preference first, and it is the one that matters: it silences
      // every device on the account immediately. Dropping the local browser
      // subscription too is tidiness — it stops this device holding an endpoint
      // it will never use — but if that half fails the user is still unsubscribed
      // where it counts.
      await API.patch("/api/push/prefs", { pushEnabled: false });
      setPrefEnabled(false);
      await disablePush().catch(() => {});
      refreshAvailability();
      flash();
    } catch {
      setError("Couldn't save that. Please try again.");
    } finally {
      setBusy(false);
    }
  };

  // iOS outside an installed PWA cannot receive Web Push at all, so a toggle
  // would be a lie. Say what actually unlocks it instead.
  if (availability.reason === "ios-needs-install") {
    return (
      <div className="flex items-start gap-3 rounded-xl border border-blue-200 bg-blue-50 p-4 dark:border-blue-400/30 dark:bg-blue-500/10">
        <Share className="mt-0.5 h-5 w-5 flex-shrink-0 text-blue-600 dark:text-blue-400" />
        <div>
          <p className="text-sm font-medium text-slate-900 dark:text-white">
            Desktop &amp; mobile notifications
          </p>
          <p className="mt-1 text-xs text-slate-600 dark:text-slate-400">
            On iPhone and iPad, tap Share then “Add to Home Screen”. iOS only delivers
            notifications to apps installed that way.
          </p>
        </div>
      </div>
    );
  }

  if (availability.reason === "unsupported") {
    return (
      <div className="flex items-start gap-3 rounded-xl border border-slate-200 bg-slate-50 p-4 dark:border-white/10 dark:bg-white/[0.03]">
        <BellOff className="mt-0.5 h-5 w-5 flex-shrink-0 text-slate-400" />
        <div>
          <p className="text-sm font-medium text-slate-900 dark:text-white">
            Desktop notifications
          </p>
          <p className="mt-1 text-xs text-slate-600 dark:text-slate-400">
            This browser doesn&apos;t support them. Chrome, Edge or Firefox will work.
          </p>
        </div>
      </div>
    );
  }

  const loading = prefEnabled === null;

  return (
    <div className="rounded-xl border border-slate-200 bg-white p-4 dark:border-white/10 dark:bg-white/[0.03]">
      <div className="flex items-start justify-between gap-4">
        <div className="flex items-start gap-3">
          {on ? (
            <Bell className="mt-0.5 h-5 w-5 flex-shrink-0 text-emerald-600 dark:text-emerald-400" />
          ) : (
            <BellOff className="mt-0.5 h-5 w-5 flex-shrink-0 text-slate-400" />
          )}
          <div>
            <p className="text-sm font-medium text-slate-900 dark:text-white">
              Desktop notifications
            </p>
            <p className="mt-1 max-w-md text-xs text-slate-600 dark:text-slate-400">
              Get a notification for new messages, task assignments and leave decisions
              — even when the CRM is minimised or your browser is closed. Muted threads
              and your quiet hours are always respected.
            </p>
          </div>
        </div>

        <button
          type="button"
          role="switch"
          aria-checked={on}
          aria-label="Desktop notifications"
          disabled={busy || loading}
          onClick={on ? turnOff : turnOn}
          className={`relative mt-0.5 inline-flex h-6 w-11 flex-shrink-0 items-center rounded-full transition disabled:cursor-not-allowed disabled:opacity-60 ${
            on ? "bg-emerald-500" : "bg-slate-300 dark:bg-white/20"
          }`}
        >
          <span
            className={`inline-block h-4 w-4 transform rounded-full bg-white shadow transition ${
              on ? "translate-x-6" : "translate-x-1"
            }`}
          />
        </button>
      </div>

      {busy && (
        <p className="mt-3 flex items-center gap-1.5 text-xs text-slate-500 dark:text-slate-400">
          <Loader2 className="h-3 w-3 animate-spin" />
          Saving…
        </p>
      )}

      {justSaved && !busy && (
        <p className="mt-3 flex items-center gap-1.5 text-xs text-emerald-600 dark:text-emerald-400">
          <Check className="h-3 w-3" />
          Saved
        </p>
      )}

      {error && (
        <p className="mt-3 flex items-start gap-1.5 text-xs text-red-600 dark:text-red-400">
          <AlertCircle className="mt-0.5 h-3 w-3 flex-shrink-0" />
          {error}
        </p>
      )}

      {/* The account-level switch is on but this particular browser isn't
          subscribed — the single most confusing state possible, because it is
          "on" everywhere except right here. Name it explicitly. */}
      {!granted && prefEnabled === true && !error && !busy && (
        <p className="mt-3 text-xs text-amber-600 dark:text-amber-400">
          Notifications are on for your account, but this browser hasn&apos;t been
          allowed yet. Turn the switch off and on again to allow it here.
        </p>
      )}
    </div>
  );
}
