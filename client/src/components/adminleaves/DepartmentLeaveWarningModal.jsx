import React from "react";
import { AlertTriangle, X } from "lucide-react";

const DepartmentLeaveWarningModal = ({
  isOpen,
  onClose,
  onProceed,
  department,
  currentLeaves,
  selectedEmployee,
}) => {
  if (!isOpen) return null;

  const employeeName =
    selectedEmployee?.employee?.name || selectedEmployee?.name || "this employee";

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/60 p-4 backdrop-blur-sm">
      <section
        className="w-full max-w-md overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-2xl dark:border-white/10 dark:bg-[#10131c]"
        role="dialog"
        aria-modal="true"
        aria-labelledby="leave-warning-title"
      >
        <header className="flex items-start justify-between gap-4 border-b border-slate-200 px-5 py-4 dark:border-white/10">
          <div className="flex gap-3">
            <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-amber-50 text-amber-600 dark:bg-amber-400/10 dark:text-amber-300">
              <AlertTriangle className="h-5 w-5" />
            </span>
            <div>
              <h2 id="leave-warning-title" className="text-base font-semibold text-slate-950 dark:text-white">
                Confirm leave decision
              </h2>
              <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">
                Check team availability before continuing.
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="rounded-lg p-1.5 text-slate-400 transition hover:bg-slate-100 hover:text-slate-900 dark:hover:bg-white/[0.06] dark:hover:text-white"
            aria-label="Close confirmation"
          >
            <X className="h-5 w-5" />
          </button>
        </header>

        <div className="space-y-4 px-5 py-5">
          <p className="text-sm leading-6 text-slate-600 dark:text-slate-300">
            You are about to update the leave request for{" "}
            <span className="font-semibold text-slate-900 dark:text-white">{employeeName}</span>
            {department ? ` from ${department}` : ""}.
          </p>

          {currentLeaves?.length > 0 ? (
            <div className="max-h-52 overflow-y-auto rounded-xl border border-amber-200 bg-amber-50 p-3 dark:border-amber-400/20 dark:bg-amber-400/10">
              <p className="mb-2 text-xs font-semibold text-amber-800 dark:text-amber-200">
                Employees already on leave
              </p>
              <div className="space-y-2">
                {currentLeaves.map((leave) => (
                  <div
                    key={leave._id}
                    className="flex items-center justify-between gap-3 rounded-lg bg-white/70 px-3 py-2 text-xs dark:bg-white/[0.04]"
                  >
                    <span className="font-medium text-slate-700 dark:text-slate-200">
                      {leave.employee?.name || "Employee"}
                    </span>
                    <span className="text-right text-slate-500 dark:text-slate-400">
                      {new Date(leave.period.start).toLocaleDateString("en-IN")} –{" "}
                      {new Date(leave.period.end).toLocaleDateString("en-IN")}
                    </span>
                  </div>
                ))}
              </div>
            </div>
          ) : (
            <p className="rounded-xl bg-slate-50 px-4 py-3 text-sm text-slate-500 dark:bg-white/[0.035] dark:text-slate-400">
              No other employees are currently on leave.
            </p>
          )}
        </div>

        <footer className="flex justify-end gap-3 border-t border-slate-200 px-5 py-4 dark:border-white/10">
          <button
            type="button"
            onClick={onClose}
            className="h-10 rounded-lg border border-slate-200 px-4 text-sm font-semibold text-slate-700 transition hover:bg-slate-50 dark:border-white/10 dark:text-slate-200 dark:hover:bg-white/[0.05]"
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={onProceed}
            className="h-10 rounded-lg bg-blue-600 px-4 text-sm font-semibold text-white transition hover:bg-blue-700"
          >
            Continue
          </button>
        </footer>
      </section>
    </div>
  );
};

export default DepartmentLeaveWarningModal;
