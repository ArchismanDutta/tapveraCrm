import React from "react";
import { Link } from "react-router-dom";
import { ArrowRight } from "lucide-react";

const iconStyles = {
  blue: "bg-blue-50 text-blue-600 dark:bg-blue-400/10 dark:text-blue-300",
  orange: "bg-amber-50 text-amber-600 dark:bg-amber-400/10 dark:text-amber-300",
  red: "bg-rose-50 text-rose-600 dark:bg-rose-400/10 dark:text-rose-300",
  green: "bg-emerald-50 text-emerald-600 dark:bg-emerald-400/10 dark:text-emerald-300",
  rose: "bg-slate-100 text-slate-500 dark:bg-white/[0.06] dark:text-slate-300",
};

const TaskOverviewCard = ({ summaryData = [] }) => (
  <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm dark:border-white/10 dark:bg-[#10131c]">
    <div className="mb-4 flex items-center justify-between gap-3">
      <div>
        <h2 className="text-base font-semibold text-slate-950 dark:text-white">Task overview</h2>
        <p className="mt-0.5 text-sm text-slate-500 dark:text-slate-400">Current workload and priority</p>
      </div>
      <Link
        to="/tasks"
        className="group hidden items-center gap-1.5 text-xs font-semibold text-blue-600 transition hover:text-blue-700 dark:text-blue-300 dark:hover:text-blue-200 sm:flex"
      >
        View all <ArrowRight className="h-3.5 w-3.5 transition-transform group-hover:translate-x-0.5" />
      </Link>
    </div>

    <div className="grid grid-cols-2 gap-px overflow-hidden rounded-xl border border-slate-200 bg-slate-200 dark:border-white/10 dark:bg-white/10 md:grid-cols-5">
      {summaryData.map((item, idx) => {
        const Icon = item.icon;
        return (
          <div
            key={`${item.label}-${idx}`}
            className="relative min-w-0 bg-white p-4 dark:bg-[#10131c]"
          >
            {item.urgent && (
              <span className="absolute right-3 top-3 h-1.5 w-1.5 rounded-full bg-rose-500" />
            )}
            <div className={`mb-3 flex h-8 w-8 items-center justify-center rounded-lg ${iconStyles[item.color] || iconStyles.blue}`}>
              {Icon && <Icon className="h-4 w-4" />}
            </div>
            <div className="text-2xl font-semibold tracking-tight text-slate-950 dark:text-white">{item.count}</div>
            <div className="mt-1 truncate text-xs font-medium text-slate-500 dark:text-slate-400">{item.label}</div>
            {item.trend && (
              <div className="mt-1 text-[11px] text-slate-400 dark:text-slate-500">{item.trend} completed</div>
            )}
          </div>
        );
      })}
    </div>
  </section>
);

export default TaskOverviewCard;
