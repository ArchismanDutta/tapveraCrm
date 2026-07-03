import React from "react";
import { Coffee, Loader2, Play, UserRound, Utensils } from "lucide-react";

const breakTypes = [
  { id: "Lunch", label: "Lunch", description: "Meal break", icon: Utensils },
  { id: "Coffee", label: "Coffee", description: "Quick reset", icon: Coffee },
  { id: "Personal", label: "Personal", description: "Personal time", icon: UserRound },
];

const BreakActions = ({ breakDuration = "0h 00m 00s", onBreak = false, onStartBreak, onResumeWork, currentlyWorking = false, isLoading = false, currentBreakType = "", className = "" }) => {
  const canStartBreak = currentlyWorking && !isLoading && !onBreak;

  return (
    <section className={`rounded-2xl border border-slate-200 bg-white p-4 shadow-sm dark:border-white/10 dark:bg-[#10131c] sm:p-5 ${className}`}>
      <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
        <div className="flex min-w-0 items-center gap-3">
          <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-amber-50 text-amber-600 dark:bg-amber-400/10 dark:text-amber-300"><Coffee className="h-4 w-4" /></div>
          <div className="min-w-0">
            <h2 className="text-base font-semibold text-slate-950 dark:text-white">Break management</h2>
            <p className="mt-0.5 truncate text-sm text-slate-500 dark:text-slate-400">{onBreak ? `${currentBreakType || "Break"} in progress` : "Choose a break type when you need to step away"}</p>
          </div>
        </div>

        {onBreak ? (
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
            <div className="flex items-center justify-between gap-4 rounded-xl border border-amber-200 bg-amber-50 px-3.5 py-2 dark:border-amber-400/20 dark:bg-amber-400/10">
              <span className="inline-flex items-center gap-2 text-xs font-medium text-amber-700 dark:text-amber-200"><span className="h-2 w-2 rounded-full bg-amber-500" /> Active break</span>
              <span className="text-sm font-semibold text-slate-950 dark:text-white">{breakDuration}</span>
            </div>
            <button type="button" onClick={onResumeWork} disabled={isLoading} className={`inline-flex h-10 items-center justify-center gap-2 rounded-xl px-5 text-sm font-semibold transition focus:outline-none focus:ring-2 focus:ring-blue-500 ${isLoading ? "cursor-not-allowed border border-slate-200 bg-slate-100 text-slate-400 dark:border-white/10 dark:bg-white/[0.04] dark:text-slate-500" : "border border-blue-600 bg-blue-600 text-white hover:border-blue-700 hover:bg-blue-700"}`}>
              {isLoading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Play className="h-4 w-4" />} Resume work
            </button>
          </div>
        ) : (
          <div className="grid gap-2 sm:grid-cols-3 lg:min-w-[620px]">
            {breakTypes.map((breakType) => {
              const Icon = breakType.icon;
              return (
                <button key={breakType.id} type="button" onClick={() => canStartBreak && onStartBreak(breakType.id)} disabled={!canStartBreak} className={`flex min-h-12 items-center gap-3 rounded-xl border px-3.5 py-2.5 text-left transition focus:outline-none focus:ring-2 focus:ring-blue-500 ${canStartBreak ? "border-slate-200 text-slate-700 hover:border-slate-300 hover:bg-slate-50 dark:border-white/10 dark:text-slate-200 dark:hover:bg-white/[0.04]" : "cursor-not-allowed border-slate-100 text-slate-400 dark:border-white/[0.06] dark:text-slate-600"}`}>
                  <Icon className="h-4 w-4 shrink-0" />
                  <span className="min-w-0"><span className="block truncate text-sm font-medium">{breakType.label}</span><span className="block truncate text-[11px] text-slate-400 dark:text-slate-500">{breakType.description}</span></span>
                </button>
              );
            })}
          </div>
        )}
      </div>
    </section>
  );
};

export default BreakActions;
