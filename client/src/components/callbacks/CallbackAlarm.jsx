import React, { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import {
  AlarmClock,
  Phone,
  Mail,
  MessageCircle,
  Video,
  Users,
  Clock,
  X,
  Bell,
} from "lucide-react";
import useCallbackAlarms from "../../hooks/useCallbackAlarms";

/**
 * The persistent callback alarm.
 *
 * ─── WHY IT IS MODAL AND HAS NO BACKDROP DISMISS ───
 * A callback the agent asked to be reminded about, at the moment they asked
 * for, is worth interrupting them. Everything else in this app that overlays
 * the screen closes on a backdrop click or Escape; this deliberately does not,
 * because a stray click is exactly how an alarm gets dismissed without being
 * read. Leaving requires choosing: snooze it, or close it.
 *
 * ─── SNOOZE vs CLOSE ───
 * Both stop the ringing; only one brings it back. Neither touches the
 * callback's `status`, because acknowledging an alarm is not the same as
 * having made the call — merging them would silently mark work complete that
 * nobody did.
 */

const SNOOZE_OPTIONS = [5, 10, 15, 30];

const TYPE_ICONS = {
  Call: Phone,
  Email: Mail,
  WhatsApp: MessageCircle,
  Zoom: Video,
  "In-Person Meeting": Users,
};

const PRIORITY_STYLES = {
  Urgent: "bg-rose-100 text-rose-700 dark:bg-rose-500/15 dark:text-rose-300",
  High: "bg-orange-100 text-orange-700 dark:bg-orange-500/15 dark:text-orange-300",
  Medium: "bg-blue-100 text-blue-700 dark:bg-blue-500/15 dark:text-blue-300",
  Low: "bg-slate-100 text-slate-600 dark:bg-white/[0.07] dark:text-slate-300",
};

/** "3 minutes ago" / "just now" — the alarm's whole job is urgency, so this
 *  reads in the terms the agent cares about rather than a wall-clock time. */
const overdueLabel = (minutes) => {
  if (!minutes || minutes < 1) return "Due now";
  if (minutes < 60) return `${minutes} min overdue`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours} hr${hours === 1 ? "" : "s"} overdue`;
  const days = Math.floor(hours / 24);
  return `${days} day${days === 1 ? "" : "s"} overdue`;
};

const CallbackAlarm = () => {
  const navigate = useNavigate();
  const { ringing, headsUp, snooze, dismiss, acknowledgeHeadsUp } =
    useCallbackAlarms();
  const [busy, setBusy] = useState(false);

  // Heads-up toasts are acknowledged as soon as they're rendered — the server
  // then stops returning them, so each fires exactly once instead of on every
  // poll for the whole five-minute window.
  useEffect(() => {
    if (!headsUp.length) return undefined;
    const ids = headsUp.map((c) => c._id);
    const t = setTimeout(() => acknowledgeHeadsUp(ids), 8000);
    return () => clearTimeout(t);
  }, [headsUp, acknowledgeHeadsUp]);

  // Only the most overdue one is shown at a time. A stack of simultaneous
  // alarms is unreadable and encourages dismissing them all blindly; dealing
  // with them one at a time means each is actually seen. The count below tells
  // the agent more are waiting.
  const current = ringing[0];

  const run = async (action) => {
    setBusy(true);
    try {
      await action();
    } catch {
      // The hook restores the alarm on failure, so the user sees it is still
      // outstanding rather than believing it was handled.
    } finally {
      setBusy(false);
    }
  };

  return (
    <>
      {/* ── Quiet heads-up, 5 minutes ahead ─────────────────────────────
          A toast, not a modal: this exists so the agent can wrap up what
          they're doing, which is the opposite of an interruption. */}
      {headsUp.length > 0 && !current && (
        <div className="pointer-events-none fixed bottom-6 right-6 z-[60] flex flex-col gap-2">
          {headsUp.slice(0, 3).map((cb) => (
            <div
              key={cb._id}
              className="pointer-events-auto flex w-80 items-start gap-3 rounded-xl border border-amber-200 bg-white p-3 shadow-lg dark:border-amber-400/25 dark:bg-[#131c24]"
            >
              <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-amber-100 text-amber-700 dark:bg-amber-400/15 dark:text-amber-300">
                <Bell className="h-4 w-4" />
              </div>
              <div className="min-w-0 flex-1">
                <p className="text-sm font-semibold text-slate-900 dark:text-white">
                  Callback in 5 minutes
                </p>
                <p className="truncate text-xs text-slate-600 dark:text-slate-400">
                  {cb.clientName}
                  {cb.businessName ? ` · ${cb.businessName}` : ""}
                </p>
              </div>
              <button
                type="button"
                onClick={() => acknowledgeHeadsUp([cb._id])}
                className="shrink-0 rounded p-1 text-slate-400 transition hover:bg-slate-100 hover:text-slate-700 dark:hover:bg-white/[0.06] dark:hover:text-white"
                aria-label="Dismiss"
              >
                <X className="h-4 w-4" />
              </button>
            </div>
          ))}
        </div>
      )}

      {/* ── The alarm itself ────────────────────────────────────────────── */}
      {current && (
        <div
          className="fixed inset-0 z-[70] flex items-center justify-center bg-black/70 p-4 backdrop-blur-sm"
          role="alertdialog"
          aria-modal="true"
          aria-labelledby="callback-alarm-title"
        >
          <div className="w-full max-w-md overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-2xl dark:border-white/10 dark:bg-[#131c24]">
            {/* Header */}
            <div className="flex items-center gap-3 border-b border-slate-200 bg-rose-50 p-4 dark:border-white/10 dark:bg-rose-500/10">
              {/* The pulse is the one thing visible from across a desk. */}
              <div className="flex h-11 w-11 shrink-0 animate-pulse items-center justify-center rounded-xl bg-rose-600 text-white">
                <AlarmClock className="h-5 w-5" />
              </div>
              <div className="min-w-0 flex-1">
                <h2
                  id="callback-alarm-title"
                  className="text-base font-bold text-slate-950 dark:text-white"
                >
                  Callback due
                </h2>
                <p className="text-xs font-medium text-rose-700 dark:text-rose-300">
                  {overdueLabel(current.overdueMinutes)}
                </p>
              </div>
              {ringing.length > 1 && (
                <span className="shrink-0 rounded-full bg-rose-600 px-2 py-1 text-[11px] font-semibold text-white">
                  +{ringing.length - 1} more
                </span>
              )}
            </div>

            {/* Who to call */}
            <div className="space-y-3 p-4">
              <div className="flex items-start gap-3">
                {(() => {
                  const Icon = TYPE_ICONS[current.callbackType] || Phone;
                  return (
                    <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-slate-100 text-slate-600 dark:bg-white/[0.06] dark:text-slate-300">
                      <Icon className="h-4 w-4" />
                    </div>
                  );
                })()}
                <div className="min-w-0 flex-1">
                  <p className="truncate text-base font-semibold text-slate-950 dark:text-white">
                    {current.clientName}
                  </p>
                  {current.businessName && (
                    <p className="truncate text-sm text-slate-500 dark:text-slate-400">
                      {current.businessName}
                    </p>
                  )}
                </div>
              </div>

              <div className="flex flex-wrap items-center gap-2 text-xs">
                <span className="rounded-md bg-slate-100 px-2 py-1 font-medium text-slate-600 dark:bg-white/[0.06] dark:text-slate-300">
                  {current.callbackType}
                </span>
                {current.priority && (
                  <span
                    className={`rounded-md px-2 py-1 font-medium ${
                      PRIORITY_STYLES[current.priority] || PRIORITY_STYLES.Medium
                    }`}
                  >
                    {current.priority}
                  </span>
                )}
                {current.snoozeCount > 0 && (
                  // Surfaced rather than hidden: a callback snoozed four times
                  // is being avoided, and that is worth the agent seeing.
                  <span className="inline-flex items-center gap-1 rounded-md bg-amber-100 px-2 py-1 font-medium text-amber-700 dark:bg-amber-400/15 dark:text-amber-300">
                    <Clock className="h-3 w-3" />
                    Snoozed {current.snoozeCount}×
                  </span>
                )}
              </div>

              {current.remarks && (
                <p className="rounded-lg border border-slate-200 bg-slate-50 p-3 text-sm text-slate-700 dark:border-white/10 dark:bg-white/[0.03] dark:text-slate-300">
                  {current.remarks}
                </p>
              )}
            </div>

            {/* Snooze */}
            <div className="border-t border-slate-200 p-4 dark:border-white/10">
              <p className="mb-2 text-xs font-medium text-slate-500 dark:text-slate-400">
                Remind me again in
              </p>
              <div className="grid grid-cols-4 gap-2">
                {SNOOZE_OPTIONS.map((mins) => (
                  <button
                    key={mins}
                    type="button"
                    disabled={busy}
                    onClick={() => run(() => snooze(current._id, mins))}
                    className="rounded-lg border border-slate-200 bg-white px-2 py-2 text-sm font-medium text-slate-700 transition hover:border-blue-300 hover:bg-blue-50 hover:text-blue-700 disabled:opacity-50 dark:border-white/10 dark:bg-white/[0.04] dark:text-slate-200 dark:hover:border-blue-400/30 dark:hover:bg-blue-500/10 dark:hover:text-blue-300"
                  >
                    {mins}m
                  </button>
                ))}
              </div>
            </div>

            {/* Primary actions */}
            <div className="flex gap-2 border-t border-slate-200 p-4 dark:border-white/10">
              <button
                type="button"
                disabled={busy}
                onClick={() => run(() => dismiss(current._id))}
                className="flex-1 rounded-lg border border-slate-200 bg-white px-4 py-2.5 text-sm font-medium text-slate-700 transition hover:bg-slate-50 disabled:opacity-50 dark:border-white/10 dark:bg-white/[0.04] dark:text-slate-200 dark:hover:bg-white/[0.08]"
              >
                Close
              </button>
              <button
                type="button"
                disabled={busy}
                onClick={() =>
                  run(async () => {
                    // Dismiss before navigating: the agent is acting on it
                    // now, so re-ringing thirty seconds later while they are
                    // on the call is exactly wrong.
                    await dismiss(current._id);
                    navigate("/callbacks", {
                      state: { openCallbackId: current._id },
                    });
                  })
                }
                className="flex-[2] rounded-lg bg-rose-600 px-4 py-2.5 text-sm font-semibold text-white transition hover:bg-rose-700 disabled:opacity-50"
              >
                Open callback
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
};

export default CallbackAlarm;
