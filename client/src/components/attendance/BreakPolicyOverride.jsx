import React, { useState } from "react";
import { AlertTriangle, ShieldCheck, X } from "lucide-react";
import API from "../../api";

/**
 * Explains — and lets HR reverse — a day marked absent by the break-duration
 * policy (total break over 1h40m, or under 15m).
 *
 * ─── WHY THE EXPLANATION MATTERS AS MUCH AS THE BUTTON ───
 * Without it, a day showing 8 hours worked and "Absent" looks like a bug, and
 * the natural response is to go and "fix" the punch times — falsifying the
 * record to correct a derived flag. Stating the rule and the actual break
 * total turns that into an informed decision.
 *
 * The override is stored server-side rather than applied as an edit, so it
 * survives auto-close, payroll runs and later edits. A reason is mandatory
 * because this changes whether a day counts as worked, and therefore pay.
 */
const BreakPolicyOverride = ({ userId, date, day, onChanged }) => {
  const [open, setOpen] = useState(false);
  const [reason, setReason] = useState("");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState(null);

  const override = day?.breakPolicyOverride;
  const isOverridden = Boolean(override?.isOverridden);

  // Nothing to say unless the policy fired, or previously fired and was
  // overridden (which still deserves a visible trace).
  if (!day?.isBreakPolicyAbsent && !isOverridden) return null;

  const submit = async (nextState) => {
    setSaving(true);
    setError(null);
    try {
      await API.post("/api/admin/manual-attendance/break-policy-override", {
        userId,
        date,
        isOverridden: nextState,
        reason: nextState ? reason.trim() : undefined,
      });
      setOpen(false);
      setReason("");
      onChanged?.();
    } catch (err) {
      setError(
        err?.response?.data?.error || "Could not update this day. Please try again."
      );
    } finally {
      setSaving(false);
    }
  };

  /* ── Already overridden ─────────────────────────────────────────────── */

  if (isOverridden) {
    return (
      <div className="mt-2 rounded-lg border border-emerald-200 bg-emerald-50 p-2.5 text-xs dark:border-emerald-400/25 dark:bg-emerald-400/10">
        <div className="flex items-start gap-2">
          <ShieldCheck className="mt-0.5 h-3.5 w-3.5 shrink-0 text-emerald-600 dark:text-emerald-400" />
          <div className="min-w-0 flex-1">
            <p className="font-semibold text-emerald-900 dark:text-emerald-200">
              Counted as normal attendance
            </p>
            {override.reason && (
              <p className="mt-0.5 text-emerald-800/90 dark:text-emerald-200/80">
                “{override.reason}”
              </p>
            )}
            <p className="mt-1 text-[11px] text-emerald-700/80 dark:text-emerald-300/70">
              {override.overriddenByName || "HR"}
              {override.overriddenAt &&
                ` · ${new Date(override.overriddenAt).toLocaleDateString()}`}
              {/* What was suppressed. Kept visible so the day is not silently
                  indistinguishable from one that never breached the rule. */}
              {override.originalReason && ` · would otherwise be absent (${override.originalReason})`}
            </p>
          </div>
          <button
            type="button"
            disabled={saving}
            onClick={() => submit(false)}
            className="shrink-0 rounded px-1.5 py-0.5 text-[11px] font-medium text-emerald-700 underline-offset-2 transition hover:underline disabled:opacity-50 dark:text-emerald-300"
          >
            {saving ? "…" : "Undo"}
          </button>
        </div>
      </div>
    );
  }

  /* ── Flagged absent by the policy ───────────────────────────────────── */

  return (
    <div className="mt-2 rounded-lg border border-amber-200 bg-amber-50 p-2.5 text-xs dark:border-amber-400/25 dark:bg-amber-400/10">
      <div className="flex items-start gap-2">
        <AlertTriangle className="mt-0.5 h-3.5 w-3.5 shrink-0 text-amber-600 dark:text-amber-400" />
        <div className="min-w-0 flex-1">
          <p className="font-semibold text-amber-900 dark:text-amber-200">
            Marked absent by break policy
          </p>
          <p className="mt-0.5 text-amber-800/90 dark:text-amber-200/80">
            {day.breakPolicyReason}
          </p>

          {!open ? (
            <button
              type="button"
              onClick={() => setOpen(true)}
              className="mt-1.5 rounded-md border border-amber-300 bg-white px-2 py-1 text-[11px] font-semibold text-amber-800 transition hover:bg-amber-100 dark:border-amber-400/30 dark:bg-transparent dark:text-amber-200 dark:hover:bg-amber-400/15"
            >
              Mark as normal attendance
            </button>
          ) : (
            <div className="mt-2 space-y-2">
              <input
                type="text"
                autoFocus
                value={reason}
                onChange={(e) => setReason(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter" && reason.trim()) submit(true);
                  if (e.key === "Escape") setOpen(false);
                }}
                placeholder="Reason (required) — e.g. client site visit"
                className="w-full rounded-md border border-amber-300 bg-white px-2 py-1.5 text-xs text-slate-900 outline-none dark:border-amber-400/30 dark:bg-[#101820] dark:text-white"
              />
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  disabled={saving || !reason.trim()}
                  onClick={() => submit(true)}
                  className="rounded-md bg-amber-600 px-2.5 py-1 text-[11px] font-semibold text-white transition hover:bg-amber-700 disabled:opacity-50"
                >
                  {saving ? "Saving…" : "Confirm"}
                </button>
                <button
                  type="button"
                  disabled={saving}
                  onClick={() => setOpen(false)}
                  className="rounded-md px-2 py-1 text-[11px] font-medium text-amber-800 transition hover:bg-amber-100 disabled:opacity-50 dark:text-amber-200 dark:hover:bg-amber-400/15"
                >
                  Cancel
                </button>
              </div>
            </div>
          )}

          {error && (
            <p className="mt-1.5 flex items-start gap-1 text-[11px] text-rose-700 dark:text-rose-300">
              <X className="mt-0.5 h-3 w-3 shrink-0" />
              {error}
            </p>
          )}
        </div>
      </div>
    </div>
  );
};

export default BreakPolicyOverride;
