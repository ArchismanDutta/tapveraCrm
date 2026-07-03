import React from "react";

const formatDate = (value) => {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "Date unavailable";
  return date.toLocaleDateString("en-IN", { day: "numeric", month: "short" });
};

const getYears = (joinedAt, nextDate) => {
  const joined = new Date(joinedAt);
  const next = new Date(nextDate);
  if (Number.isNaN(joined.getTime()) || Number.isNaN(next.getTime())) return null;
  return Math.max(1, next.getFullYear() - joined.getFullYear());
};

const UpcomingAnniversaries = ({ anniversaries = [], loading = false }) => {
  if (loading) {
    return (
      <div className="space-y-2">
        {[0, 1, 2].map((item) => (
          <div
            key={item}
            className="h-14 animate-pulse rounded-xl bg-slate-100 dark:bg-white/[0.04]"
          />
        ))}
      </div>
    );
  }

  if (anniversaries.length === 0) {
    return (
      <div className="rounded-xl border border-dashed border-slate-300 px-5 py-10 text-center dark:border-white/10">
        <p className="text-sm font-medium text-slate-700 dark:text-slate-200">
          No upcoming anniversaries
        </p>
        <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">
          Employee milestones will appear here automatically.
        </p>
      </div>
    );
  }

  return (
    <ul className="space-y-2">
      {anniversaries.map((anniversary) => {
        const years = getYears(anniversary.originalDoj, anniversary.nextDate);
        return (
          <li
            key={anniversary._id}
            className="flex items-center gap-3 rounded-xl border border-slate-200 p-3 dark:border-white/10"
          >
            {anniversary.avatar ? (
              <img
                src={anniversary.avatar}
                alt=""
                className="h-10 w-10 shrink-0 rounded-full object-cover"
              />
            ) : (
              <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-amber-100 text-sm font-semibold text-amber-700 dark:bg-amber-400/10 dark:text-amber-200">
                {anniversary.name?.trim()?.charAt(0)?.toUpperCase() || "?"}
              </span>
            )}
            <div className="min-w-0 flex-1">
              <p className="truncate text-sm font-semibold text-slate-900 dark:text-white">
                {anniversary.name}
              </p>
              <p className="mt-0.5 truncate text-xs capitalize text-slate-500 dark:text-slate-400">
                {anniversary.designation || "Employee"}
                {years ? ` · ${years} year${years === 1 ? "" : "s"}` : ""}
              </p>
            </div>
            <span className="shrink-0 rounded-lg bg-amber-50 px-2.5 py-1.5 text-xs font-semibold text-amber-700 dark:bg-amber-400/10 dark:text-amber-200">
              {formatDate(anniversary.nextDate)}
            </span>
          </li>
        );
      })}
    </ul>
  );
};

export default UpcomingAnniversaries;
