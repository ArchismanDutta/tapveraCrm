import React from "react";

const STATUS_STYLES = {
  approved:
    "bg-emerald-50 text-emerald-700 dark:bg-emerald-400/10 dark:text-emerald-200",
  rejected: "bg-rose-50 text-rose-700 dark:bg-rose-400/10 dark:text-rose-200",
  pending: "bg-amber-50 text-amber-700 dark:bg-amber-400/10 dark:text-amber-200",
};

const RecentActivities = ({ activities = [], loading = false }) => {
  if (loading) {
    return (
      <div className="grid gap-3 md:grid-cols-2">
        {[0, 1, 2, 3].map((item) => (
          <div
            key={item}
            className="h-16 animate-pulse rounded-xl bg-slate-100 dark:bg-white/[0.04]"
          />
        ))}
      </div>
    );
  }

  if (activities.length === 0) {
    return (
      <div className="rounded-xl border border-dashed border-slate-300 px-5 py-10 text-center dark:border-white/10">
        <p className="text-sm font-medium text-slate-700 dark:text-slate-200">
          No recent leave activity
        </p>
        <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">
          New employee requests will appear here.
        </p>
      </div>
    );
  }

  return (
    <ul className="grid gap-3 md:grid-cols-2">
      {activities.map((activity) => (
        <li
          key={activity.id}
          className="flex items-start gap-3 rounded-xl border border-slate-200 p-3 dark:border-white/10"
        >
          <span
            className={`mt-1 h-2 w-2 shrink-0 rounded-full ${
              activity.status === "approved"
                ? "bg-emerald-500"
                : activity.status === "rejected"
                  ? "bg-rose-500"
                  : "bg-amber-500"
            }`}
          />
          <div className="min-w-0 flex-1">
            <p className="text-sm font-medium leading-5 text-slate-800 dark:text-slate-100">
              {activity.title}
            </p>
            <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">
              {activity.time}
            </p>
          </div>
          <span
            className={`shrink-0 rounded-full px-2 py-1 text-[10px] font-semibold capitalize ${
              STATUS_STYLES[activity.status] || STATUS_STYLES.pending
            }`}
          >
            {activity.status}
          </span>
        </li>
      ))}
    </ul>
  );
};

export default RecentActivities;
