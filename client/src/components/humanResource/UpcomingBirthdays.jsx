import React from "react";

const formatDate = (value) => {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "Date unavailable";
  return date.toLocaleDateString("en-IN", { day: "numeric", month: "short" });
};

const UpcomingBirthdays = ({ birthdays = [], loading = false }) => {
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

  if (birthdays.length === 0) {
    return (
      <div className="rounded-xl border border-dashed border-slate-300 px-5 py-10 text-center dark:border-white/10">
        <p className="text-sm font-medium text-slate-700 dark:text-slate-200">
          No upcoming birthdays
        </p>
        <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">
          New birthday dates will appear here automatically.
        </p>
      </div>
    );
  }

  return (
    <ul className="space-y-2">
      {birthdays.map((birthday) => (
        <li
          key={birthday._id}
          className="flex items-center gap-3 rounded-xl border border-slate-200 p-3 dark:border-white/10"
        >
          {birthday.avatar ? (
            <img
              src={birthday.avatar}
              alt=""
              className="h-10 w-10 shrink-0 rounded-full object-cover"
            />
          ) : (
            <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-pink-100 text-sm font-semibold text-pink-700 dark:bg-pink-400/10 dark:text-pink-200">
              {birthday.name?.trim()?.charAt(0)?.toUpperCase() || "?"}
            </span>
          )}
          <div className="min-w-0 flex-1">
            <p className="truncate text-sm font-semibold text-slate-900 dark:text-white">
              {birthday.name}
            </p>
            <p className="mt-0.5 truncate text-xs capitalize text-slate-500 dark:text-slate-400">
              {birthday.role || "Employee"}
            </p>
          </div>
          <span className="shrink-0 rounded-lg bg-pink-50 px-2.5 py-1.5 text-xs font-semibold text-pink-700 dark:bg-pink-400/10 dark:text-pink-200">
            {formatDate(birthday.nextDate)}
          </span>
        </li>
      ))}
    </ul>
  );
};

export default UpcomingBirthdays;
