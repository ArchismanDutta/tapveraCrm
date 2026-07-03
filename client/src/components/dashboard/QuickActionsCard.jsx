import React from "react";
import { ChevronRight } from "lucide-react";

const QuickActionsCard = ({ quickActions = [], isLoading = false, className = "" }) => (
  <section className={`flex h-full flex-col rounded-2xl border border-slate-200 bg-white p-5 shadow-sm dark:border-white/10 dark:bg-[#10131c] ${className}`}>
    <div className="mb-4">
      <h2 className="text-base font-semibold text-slate-950 dark:text-white">Quick actions</h2>
      <p className="mt-0.5 text-sm text-slate-500 dark:text-slate-400">Common attendance and task shortcuts</p>
    </div>

    <div className="space-y-2">
      {quickActions.map((action, idx) => {
        const Icon = action.icon;
        const disabled = action.disabled || isLoading;
        const isPrimary = /Punch|Break|Resume/.test(action.label);

        return (
          <button
            key={`${action.label}-${idx}`}
            type="button"
            onClick={action.action}
            disabled={disabled}
            className={`group flex min-h-11 w-full items-center gap-3 rounded-xl border px-3.5 py-2.5 text-left text-sm font-medium transition focus:outline-none focus:ring-2 focus:ring-blue-500 ${
              disabled
                ? "cursor-not-allowed border-slate-200 bg-slate-50 text-slate-400 dark:border-white/10 dark:bg-white/[0.03] dark:text-slate-500"
                : isPrimary
                ? "border-blue-600 bg-blue-600 text-white hover:border-blue-700 hover:bg-blue-700"
                : "border-slate-200 bg-white text-slate-700 hover:border-slate-300 hover:bg-slate-50 dark:border-white/10 dark:bg-white/[0.03] dark:text-slate-200 dark:hover:bg-white/[0.06]"
            }`}
          >
            {isLoading && isPrimary ? (
              <div className="h-4 w-4 animate-spin rounded-full border-2 border-current border-t-transparent" />
            ) : (
              <Icon className="h-4 w-4 shrink-0" />
            )}
            <span className="min-w-0 flex-1 truncate">{action.label}</span>
            <ChevronRight className="h-4 w-4 shrink-0 opacity-50 transition-transform group-hover:translate-x-0.5" />
          </button>
        );
      })}
    </div>
  </section>
);

export default QuickActionsCard;
