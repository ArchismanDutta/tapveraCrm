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
    <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 md:grid-cols-5">
      {statItems.map((item) => {
        const Icon = item.icon;
        return (
          <div
            key={item.label}
            className="overflow-hidden rounded-2xl border border-slate-200 bg-white p-4 shadow-sm dark:border-white/10 dark:bg-[#10131c]"
          >
            <div className="mb-3 flex items-center justify-between">
              <div
                className={`inline-flex h-9 w-9 items-center justify-center rounded-lg border ${item.borderColor} ${item.bgColor} ${item.textColor}`}
              >
                <Icon className="h-4 w-4" />
              </div>
            </div>
            <div className="mb-1 text-xs text-slate-500 dark:text-slate-400">{item.label}</div>
            <div className="text-2xl font-semibold text-slate-950 dark:text-white">
              {item.value}
            </div>
          </div>
        );
      })}
    </div>
  );
};

export default ProjectStats;
