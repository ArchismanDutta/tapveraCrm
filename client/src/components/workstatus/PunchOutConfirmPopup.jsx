// File: src/components/workstatus/PunchOutConfirmPopup.jsx
//
// This is the ONLY way an employee ends their own attendance day. Scanning at
// the fingerprint terminal on the way out does not close it — the terminal only
// records arrival, because it cannot tell a final exit from a lunch run (see
// server/services/biometric/BiometricAttendanceService.js).
//
// So the wording has to carry real weight: this is irreversible for the day, and
// the timer they can see running behind this dialog stops the moment they
// confirm. Worth spelling out rather than a bare "Are you sure?".
import React from "react";
import { AlertTriangle } from "lucide-react";

const PunchOutConfirmPopup = ({ onCancel, onConfirm }) => {
  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4 backdrop-blur-sm"
      aria-modal="true"
      role="dialog"
      aria-labelledby="punchout-title"
    >
      <div className="w-full max-w-md rounded-2xl border border-slate-200 bg-white p-6 shadow-xl dark:border-[#232945] dark:bg-[#161c2c]">
        <div className="mb-3 flex items-start gap-3">
          <span className="mt-0.5 inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-rose-50 text-rose-600 dark:bg-rose-400/10 dark:text-rose-300">
            <AlertTriangle className="h-5 w-5" />
          </span>
          <h2
            id="punchout-title"
            className="text-xl font-bold text-slate-900 dark:text-gray-100"
          >
            End your day?
          </h2>
        </div>

        <p className="mb-3 leading-relaxed text-slate-600 dark:text-gray-300">
          This stops your work timer and closes today&apos;s attendance. You{" "}
          <span className="font-semibold text-orange-600 dark:text-orange-400">
            won&apos;t be able to punch in again today
          </span>
          .
        </p>

        <p className="mb-6 rounded-lg bg-slate-50 px-3 py-2.5 text-sm leading-relaxed text-slate-500 dark:bg-white/[0.04] dark:text-slate-400">
          Only stepping out for a while? Cancel this and use a break instead —
          scanning your finger on the way out and back in won&apos;t end your day.
        </p>

        <div className="flex justify-end gap-3">
          <button
            onClick={onCancel}
            className="rounded-lg border border-slate-200 bg-white px-5 py-2.5 font-medium text-slate-700 transition hover:bg-slate-50 dark:border-transparent dark:bg-[#232945] dark:text-gray-200 dark:hover:bg-[#2f3557]"
          >
            Cancel
          </button>
          <button
            onClick={onConfirm}
            className="rounded-lg bg-red-500 px-5 py-2.5 font-semibold text-white shadow transition hover:bg-red-600"
          >
            Punch Out
          </button>
        </div>
      </div>
    </div>
  );
};

export default PunchOutConfirmPopup;
