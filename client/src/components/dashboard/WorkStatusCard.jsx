import React from "react";
import { AlertTriangle, Clock3, Coffee, LogIn } from "lucide-react";

const WorkStatusCard = ({ workStatus, isLoading = false, className = "" }) => {
  const formatWorkDuration = (seconds) => {
    if (!seconds) return "0h 00m";
    return `${Math.floor(seconds / 3600)}h ${String(
      Math.floor((seconds % 3600) / 60)
    ).padStart(2, "0")}m`;
  };

  const workSeconds = workStatus?.workDurationSeconds || 0;
  const progress = Math.min(100, Math.round((workSeconds / (8 * 3600)) * 100));
  const metrics = [
    { label: "Work time", value: formatWorkDuration(workSeconds), icon: Clock3 },
    { label: "Break", value: formatWorkDuration(workStatus?.breakDurationSeconds), icon: Coffee },
    { label: "Arrival", value: workStatus?.arrivalTimeFormatted || "—", icon: LogIn },
  ];

  return (
    <section className={`relative flex h-full flex-col rounded-2xl border border-slate-200 bg-white p-5 shadow-sm dark:border-white/10 dark:bg-[#10131c] ${className}`}>
      {isLoading && (
        <div className="absolute inset-0 z-20 flex items-center justify-center rounded-2xl bg-white/80 backdrop-blur-sm dark:bg-[#10131c]/80">
          <div className="flex items-center gap-2 text-xs font-medium text-slate-600 dark:text-slate-300">
            <div className="h-3.5 w-3.5 animate-spin rounded-full border-2 border-slate-200 border-t-blue-600 dark:border-white/10 dark:border-t-blue-400" />
            Updating
          </div>
        </div>
      )}

      <div className="mb-4">
        <h2 className="text-base font-semibold text-slate-950 dark:text-white">Work status</h2>
        <p className="mt-0.5 text-sm text-slate-500 dark:text-slate-400">Today’s attendance summary</p>
      </div>

      <div className="divide-y divide-slate-200 rounded-xl border border-slate-200 dark:divide-white/10 dark:border-white/10">
        {metrics.map((metric) => {
          const MetricIcon = metric.icon;
          return (
            <div key={metric.label} className="flex items-center justify-between gap-4 px-3.5 py-3">
              <div className="flex items-center gap-2.5 text-sm text-slate-500 dark:text-slate-400">
                <MetricIcon className="h-4 w-4" />
                {metric.label}
              </div>
              <span className="text-sm font-semibold text-slate-900 dark:text-white">{metric.value}</span>
            </div>
          );
        })}
      </div>

      <div className="mt-4">
        <div className="mb-2 flex items-center justify-between text-xs">
          <span className="font-medium text-slate-600 dark:text-slate-300">Daily progress</span>
          <span className="text-slate-500 dark:text-slate-400">{progress}% of 8 hours</span>
        </div>
        <div className="h-1.5 overflow-hidden rounded-full bg-slate-100 dark:bg-white/[0.07]">
          <div className="h-full rounded-full bg-blue-600 transition-[width] duration-700" style={{ width: `${progress}%` }} />
        </div>
      </div>

      {workStatus?.isLate && (
        <div className="mt-4 flex items-center gap-2 rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-xs font-medium text-amber-800 dark:border-amber-400/20 dark:bg-amber-400/10 dark:text-amber-200">
          <AlertTriangle className="h-3.5 w-3.5" /> Late arrival recorded
        </div>
      )}
    </section>
  );
};

export default WorkStatusCard;
