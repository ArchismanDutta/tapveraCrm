import React, { useEffect } from "react";
import { CalendarDays, Users, X } from "lucide-react";

const getLeaveStart = (leave) =>
  leave.period?.start || leave.startDate || leave.fromDate;
const getLeaveEnd = (leave) =>
  leave.period?.end || leave.endDate || leave.toDate || getLeaveStart(leave);

const formatDate = (value) => {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "Date unavailable";
  return date.toLocaleDateString("en-IN", {
    day: "numeric",
    month: "short",
    year: "numeric",
  });
};

const ActiveLeavesModal = ({ isOpen, onClose, leaves = [] }) => {
  useEffect(() => {
    if (!isOpen) return undefined;
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";

    const handleKeyDown = (event) => {
      if (event.key === "Escape") onClose();
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => {
      document.body.style.overflow = previousOverflow;
      window.removeEventListener("keydown", handleKeyDown);
    };
  }, [isOpen, onClose]);

  if (!isOpen) return null;

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/70 p-3 backdrop-blur-sm sm:p-6"
      onMouseDown={(event) => {
        if (event.target === event.currentTarget) onClose();
      }}
    >
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="active-leaves-title"
        className="flex max-h-[88vh] w-full max-w-xl flex-col overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-2xl dark:border-slate-700 dark:bg-slate-900"
      >
        <header className="flex items-start justify-between gap-4 border-b border-slate-200 px-5 py-4 dark:border-slate-800 sm:px-6">
          <div className="flex min-w-0 items-center gap-3">
            <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-amber-50 text-amber-700 dark:bg-amber-400/10 dark:text-amber-200">
              <CalendarDays className="h-5 w-5" />
            </span>
            <div>
              <h2
                id="active-leaves-title"
                className="text-lg font-semibold text-slate-900 dark:text-white"
              >
                Away today
              </h2>
              <p className="mt-0.5 text-sm text-slate-500 dark:text-slate-400">
                {leaves.length} approved active leave{leaves.length === 1 ? "" : "s"}
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close away today dialog"
            className="rounded-lg p-2 text-slate-400 transition hover:bg-slate-100 hover:text-slate-700 dark:hover:bg-slate-800 dark:hover:text-slate-200"
          >
            <X className="h-5 w-5" />
          </button>
        </header>

        <div className="flex-1 overflow-y-auto p-5 sm:p-6">
          {leaves.length === 0 ? (
            <div className="rounded-xl border border-dashed border-slate-300 px-6 py-12 text-center dark:border-slate-700">
              <Users className="mx-auto h-7 w-7 text-slate-400" />
              <h3 className="mt-3 text-sm font-semibold text-slate-800 dark:text-slate-100">
                Everyone is available
              </h3>
              <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">
                No approved leave overlaps with today.
              </p>
            </div>
          ) : (
            <div className="space-y-3">
              {leaves.map((leave) => {
                const employeeName =
                  leave.employee?.name || leave.employeeName || "Unknown employee";
                const employeeRole =
                  leave.employee?.designation ||
                  leave.employee?.role ||
                  "Employee";
                return (
                  <article
                    key={leave._id}
                    className="rounded-xl border border-slate-200 p-4 dark:border-slate-800"
                  >
                    <div className="flex items-start gap-3">
                      <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-gradient-to-br from-amber-500 to-orange-600 text-sm font-semibold text-white">
                        {employeeName.charAt(0).toUpperCase()}
                      </span>
                      <div className="min-w-0 flex-1">
                        <div className="flex flex-wrap items-center justify-between gap-2">
                          <div>
                            <h3 className="text-sm font-semibold text-slate-900 dark:text-white">
                              {employeeName}
                            </h3>
                            <p className="mt-0.5 text-xs capitalize text-slate-500 dark:text-slate-400">
                              {employeeRole}
                            </p>
                          </div>
                          <span className="rounded-full bg-amber-50 px-2.5 py-1 text-[11px] font-semibold text-amber-700 dark:bg-amber-400/10 dark:text-amber-200">
                            {leave.type || "Leave"}
                          </span>
                        </div>
                        <p className="mt-3 text-xs font-medium text-slate-600 dark:text-slate-300">
                          {formatDate(getLeaveStart(leave))} – {formatDate(getLeaveEnd(leave))}
                        </p>
                      </div>
                    </div>
                  </article>
                );
              })}
            </div>
          )}
        </div>

        <footer className="border-t border-slate-200 bg-slate-50 px-5 py-4 text-right dark:border-slate-800 dark:bg-slate-950/50 sm:px-6">
          <button
            type="button"
            onClick={onClose}
            className="rounded-lg bg-slate-900 px-4 py-2.5 text-sm font-semibold text-white transition hover:bg-slate-800 dark:bg-blue-600 dark:hover:bg-blue-700"
          >
            Done
          </button>
        </footer>
      </div>
    </div>
  );
};

export default ActiveLeavesModal;
