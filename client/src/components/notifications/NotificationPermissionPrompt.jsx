import React, { useEffect, useState } from "react";
import { Bell, X, Share } from "lucide-react";
import { pushAvailability, enablePush, resumePush } from "../../utils/webPush";

/**
 * Contextual "turn on notifications" strip.
 *
 * ─── WHY IT IS NOT SHOWN ON LOAD ───
 * `Notification.requestPermission()` can only be answered once. A denial is
 * permanent as far as code is concerned — the only way back is the browser's
 * site-settings UI, which effectively nobody visits. So a prompt fired the
 * moment the app loads, before the user has any idea what they'd be agreeing
 * to, doesn't just get dismissed: it destroys the capability for that user.
 *
 * This renders only after `trigger` goes true — the caller sets it once the
 * user has actually sent a message, at which point "get notified about replies"
 * is self-evidently useful. The browser dialog only ever appears after they
 * click Enable here, so the real question is asked in our own UI where a "not
 * now" costs nothing.
 *
 * Dismissal is remembered in localStorage so it doesn't nag.
 *
 * @param {boolean} trigger  the moment has arrived (e.g. first message sent)
 */
const DISMISS_KEY = "push_prompt_dismissed_at";
const REASK_AFTER_DAYS = 30;

export default function NotificationPermissionPrompt({ trigger = false }) {
  const [state, setState] = useState("hidden"); // hidden | offer | ios | busy | done
  const [error, setError] = useState("");

  // Silently re-establish the subscription for users who already said yes.
  useEffect(() => {
    resumePush();
  }, []);

  useEffect(() => {
    if (!trigger) return;

    const dismissedAt = Number(localStorage.getItem(DISMISS_KEY) || 0);
    if (dismissedAt && Date.now() - dismissedAt < REASK_AFTER_DAYS * 864e5) return;

    const { ok, reason } = pushAvailability();

    // Already granted, permanently denied, or the browser can't do it —
    // in all three cases there is nothing useful to show.
    if (ok && reason === "granted") return;
    if (!ok && reason !== "ios-needs-install") return;

    setState(reason === "ios-needs-install" ? "ios" : "offer");
  }, [trigger]);

  const dismiss = () => {
    localStorage.setItem(DISMISS_KEY, String(Date.now()));
    setState("hidden");
  };

  const onEnable = async () => {
    setState("busy");
    setError("");
    try {
      const { ok, reason } = await enablePush();
      if (ok) {
        setState("done");
        setTimeout(() => setState("hidden"), 2500);
        return;
      }
      setState("offer");
      setError(
        reason === "denied"
          ? "Notifications are blocked for this site. You can re-enable them in your browser's site settings."
          : reason === "server-not-configured"
          ? "Push isn't configured on the server yet."
          : "Couldn't enable notifications. Please try again."
      );
    } catch {
      setState("offer");
      setError("Couldn't enable notifications. Please try again.");
    }
  };

  if (state === "hidden") return null;

  if (state === "done") {
    return (
      <div className="flex items-center gap-2 border-b border-emerald-200 bg-emerald-50 px-4 py-2 text-sm text-emerald-800 dark:border-emerald-500/30 dark:bg-emerald-500/10 dark:text-emerald-300">
        <Bell className="h-4 w-4" />
        Notifications are on — you'll hear about new messages even with the app closed.
      </div>
    );
  }

  // iOS only delivers Web Push to an installed PWA, so a permission prompt
  // here would do nothing at all. Explain the actual next step instead.
  if (state === "ios") {
    return (
      <div className="flex items-start gap-3 border-b border-blue-200 bg-blue-50 px-4 py-2.5 text-sm text-blue-900 dark:border-blue-400/30 dark:bg-blue-500/10 dark:text-blue-200">
        <Share className="mt-0.5 h-4 w-4 flex-shrink-0" />
        <div className="flex-1">
          <p className="font-medium">Get message notifications on iPhone</p>
          <p className="mt-0.5 text-xs opacity-80">
            Tap Share, then “Add to Home Screen”. iOS only delivers notifications to
            apps installed that way.
          </p>
        </div>
        <button onClick={dismiss} className="rounded p-1 hover:bg-blue-100 dark:hover:bg-white/10">
          <X className="h-4 w-4" />
        </button>
      </div>
    );
  }

  return (
    <div className="flex items-start gap-3 border-b border-blue-200 bg-blue-50 px-4 py-2.5 text-sm text-blue-900 dark:border-blue-400/30 dark:bg-blue-500/10 dark:text-blue-200">
      <Bell className="mt-0.5 h-4 w-4 flex-shrink-0" />
      <div className="flex-1">
        <p className="font-medium">Get notified about replies</p>
        <p className="mt-0.5 text-xs opacity-80">
          Notifications reach you even when this tab is closed. Muted threads and your
          quiet hours are always respected.
        </p>
        {error && <p className="mt-1 text-xs text-red-600 dark:text-red-400">{error}</p>}
      </div>
      <div className="flex flex-shrink-0 items-center gap-2">
        <button
          onClick={onEnable}
          disabled={state === "busy"}
          className="rounded-lg bg-blue-600 px-3 py-1.5 text-xs font-medium text-white transition hover:bg-blue-500 disabled:opacity-60"
        >
          {state === "busy" ? "Enabling…" : "Enable"}
        </button>
        <button
          onClick={dismiss}
          className="rounded p-1 hover:bg-blue-100 dark:hover:bg-white/10"
          title="Not now"
        >
          <X className="h-4 w-4" />
        </button>
      </div>
    </div>
  );
}
