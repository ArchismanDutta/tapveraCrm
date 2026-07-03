import React from "react";
import { CalendarDays } from "lucide-react";

const HolidayList = ({ holidays = [], loading = false, error = null }) => (
  <section className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm dark:border-white/10 dark:bg-[#10131c] sm:p-5">
    <div className="mb-4">
      <h3 className="text-base font-semibold text-slate-950 dark:text-white">Upcoming holidays</h3>
      <p className="mt-0.5 text-xs text-slate-500 dark:text-slate-400">Company-wide holidays and observances</p>
    </div>

    {loading ? (
      <div className="space-y-2">{[0, 1, 2].map((item) => <div key={item} className="h-16 animate-pulse rounded-xl bg-slate-100 dark:bg-white/[0.05]" />)}</div>
    ) : error ? (
      <p className="rounded-xl border border-rose-200 bg-rose-50 p-3 text-sm text-rose-700 dark:border-rose-400/20 dark:bg-rose-400/10 dark:text-rose-200">{error}</p>
    ) : holidays.length > 0 ? (
      <ul className="space-y-2">
        {holidays.slice(0, 6).map((holiday, index) => (
          <li key={`${holiday.name}-${holiday.date}-${index}`} className="flex items-center gap-3 rounded-xl border border-slate-200 p-3 dark:border-white/10 dark:bg-white/[0.02]">
            <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-blue-50 text-blue-600 dark:bg-blue-400/10 dark:text-blue-300"><CalendarDays className="h-4 w-4" /></div>
            <div className="min-w-0"><p className="truncate text-sm font-medium text-slate-950 dark:text-white">{holiday.name}</p><p className="mt-0.5 text-xs text-slate-500 dark:text-slate-400">{holiday.date} · {holiday.type}</p></div>
          </li>
        ))}
      </ul>
    ) : (
      <p className="text-sm text-slate-500 dark:text-slate-400">No upcoming holidays available.</p>
    )}
  </section>
);

export default HolidayList;
