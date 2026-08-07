import React from "react";
import {
  FolderKanban,
  Plus,
  Clock,
  AlertTriangle,
  CheckCircle2,
} from "lucide-react";

const ProjectStats = ({ stats }) => {
  const statItems = [
    {
      label: "Total",
      value: stats?.total || 0,
      icon: FolderKanban,
      color: "cyan",
      bgColor: "bg-blue-50 dark:bg-blue-400/10",
      borderColor: "border-blue-200 dark:border-blue-400/20",
      textColor: "text-blue-600 dark:text-blue-300",
    },
    {
      label: "New",
      value: stats?.new || 0,
      icon: Plus,
      color: "blue",
      bgColor: "bg-violet-50 dark:bg-violet-400/10",
      borderColor: "border-violet-200 dark:border-violet-400/20",
      textColor: "text-violet-600 dark:text-violet-300",
    },
    {
      label: "Ongoing",
      value: stats?.ongoing || 0,
      icon: Clock,
      color: "emerald",
      bgColor: "bg-emerald-50 dark:bg-emerald-400/10",
      borderColor: "border-emerald-200 dark:border-emerald-400/20",
      textColor: "text-emerald-600 dark:text-emerald-300",
    },
    {
      label: "Expired",
      value: stats?.expired || 0,
      icon: AlertTriangle,
      color: "amber",
      bgColor: "bg-amber-50 dark:bg-amber-400/10",
      borderColor: "border-amber-200 dark:border-amber-400/20",
      textColor: "text-amber-600 dark:text-amber-300",
    },
    {
      label: "Completed",
      value: stats?.completed || 0,
      icon: CheckCircle2,
      color: "violet",
      bgColor: "bg-slate-100 dark:bg-white/[0.05]",
      borderColor: "border-slate-200 dark:border-white/10",
      textColor: "text-slate-600 dark:text-slate-300",
    },
  ];

  return (
    /* Five counters shouldn't cost 426px of a phone screen.
       At 2-up with a stacked icon-above-label-above-value layout, this block
       pushed the first actual project down to y=1010 — three full screens of
       scrolling on a 390px device before reaching the thing the page is for.
       Below `sm` the icon sits inline with the label and the card loses its
       vertical padding, which drops the block to roughly a third of that. The
       original layout returns at `sm`. */
    <div className="grid grid-cols-2 gap-2 xs:grid-cols-3 sm:gap-3 md:grid-cols-5">
      {statItems.map((item) => {
        const Icon = item.icon;
        return (
          <div
            key={item.label}
            className="overflow-hidden rounded-xl border border-slate-200 bg-white px-3 py-2.5 shadow-sm dark:border-white/10 dark:bg-[#10131c] sm:rounded-2xl sm:p-4"
          >
            <div className="flex items-center gap-2 sm:mb-3 sm:justify-between">
              <div
                className={`inline-flex h-7 w-7 shrink-0 items-center justify-center rounded-lg border ${item.borderColor} ${item.bgColor} ${item.textColor} sm:h-9 sm:w-9`}
              >
                <Icon className="h-3.5 w-3.5 sm:h-4 sm:w-4" />
              </div>
              {/* Label rides beside the icon on a phone and returns to its own
                  line at `sm`, where the taller card has room for it. */}
              <div className="truncate text-xs text-slate-500 dark:text-slate-400 sm:hidden">
                {item.label}
              </div>
            </div>
            <div className="mb-1 hidden text-xs text-slate-500 dark:text-slate-400 sm:block">
              {item.label}
            </div>
            <div className="text-xl font-semibold text-slate-950 dark:text-white sm:text-2xl">
              {item.value}
            </div>
          </div>
        );
      })}
    </div>
  );
};

export default ProjectStats;
