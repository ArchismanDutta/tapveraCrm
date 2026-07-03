import React from "react";
import { CalendarClock, CheckCircle2, UserRound } from "lucide-react";

const priorityStyles = {
  red: "border-rose-200 bg-rose-50 text-rose-700 dark:border-rose-400/20 dark:bg-rose-400/10 dark:text-rose-200",
  yellow: "border-amber-200 bg-amber-50 text-amber-700 dark:border-amber-400/20 dark:bg-amber-400/10 dark:text-amber-200",
  green: "border-slate-200 bg-slate-50 text-slate-600 dark:border-white/10 dark:bg-white/[0.04] dark:text-slate-300",
};

const TodayTasks = ({ data = [], className = "" }) => {
  const tasksToRender = [...data].reverse();

  return (
    <div className={`overflow-hidden rounded-xl border border-slate-200 dark:border-white/10 ${className}`}>
      {tasksToRender.length > 0 ? (
        <div className="divide-y divide-slate-200 dark:divide-white/10">
          {tasksToRender.map((task, index) => (
            <article
              key={task.id || index}
              className="bg-white px-4 py-4 transition-colors hover:bg-slate-50/80 dark:bg-transparent dark:hover:bg-white/[0.025] sm:px-5"
            >
              <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                <div className="min-w-0">
                  <h3 className="truncate text-sm font-semibold text-slate-900 dark:text-white">{task.label}</h3>
                  <div className="mt-2 flex flex-wrap gap-x-4 gap-y-1.5 text-xs text-slate-500 dark:text-slate-400">
                    <span className="inline-flex items-center gap-1.5">
                      <CalendarClock className="h-3.5 w-3.5" />
                      {task.dueDateTime || "No due date"}
                    </span>
                    <span className="inline-flex items-center gap-1.5">
                      <UserRound className="h-3.5 w-3.5" />
                      {task.assignedBy || "Unknown"}
                    </span>
                  </div>
                </div>
                <span className={`inline-flex w-fit shrink-0 items-center rounded-md border px-2 py-1 text-[11px] font-semibold ${priorityStyles[task.color] || priorityStyles.green}`}>
                  {task.level || "Normal"}
                </span>
              </div>
            </article>
          ))}
        </div>
      ) : (
        <div className="flex min-h-56 flex-col items-center justify-center bg-slate-50 px-6 text-center dark:bg-white/[0.02]">
          <div className="mb-3 flex h-10 w-10 items-center justify-center rounded-full border border-slate-200 bg-white text-emerald-600 dark:border-white/10 dark:bg-white/[0.04] dark:text-emerald-300">
            <CheckCircle2 className="h-5 w-5" />
          </div>
          <h3 className="text-sm font-semibold text-slate-900 dark:text-white">No active tasks</h3>
          <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">New assignments will appear here.</p>
        </div>
      )}
    </div>
  );
};

export default TodayTasks;
