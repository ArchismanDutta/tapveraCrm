import React, { useMemo } from "react";
import { CalendarX2, Pencil, Trash2 } from "lucide-react";

const typeStyles = {
  NATIONAL:
    "border-blue-200 bg-blue-50 text-blue-700 dark:border-blue-400/20 dark:bg-blue-400/10 dark:text-blue-200",
  COMPANY:
    "border-violet-200 bg-violet-50 text-violet-700 dark:border-violet-400/20 dark:bg-violet-400/10 dark:text-violet-200",
  RELIGIOUS:
    "border-amber-200 bg-amber-50 text-amber-700 dark:border-amber-400/20 dark:bg-amber-400/10 dark:text-amber-200",
  FESTIVAL:
    "border-rose-200 bg-rose-50 text-rose-700 dark:border-rose-400/20 dark:bg-rose-400/10 dark:text-rose-200",
};

const formatDate = (date) =>
  new Date(date).toLocaleDateString("en-IN", {
    day: "numeric",
    month: "short",
    year: "numeric",
    timeZone: "UTC",
  });

const formatShift = (shift) => {
  if (shift === "ALL") return "All shifts";
  if (shift === "flexiblePermanent") return "Flexible permanent";
  return shift.charAt(0).toUpperCase() + shift.slice(1);
};

const HolidayTable = ({ holidays, onDelete, onEdit }) => {
  const sortedHolidays = useMemo(
    () =>
      [...holidays].sort(
        (first, second) => new Date(first.date) - new Date(second.date),
      ),
    [holidays],
  );

  if (sortedHolidays.length === 0) {
    return (
      <div className="py-14 text-center">
        <span className="mx-auto flex h-12 w-12 items-center justify-center rounded-xl bg-slate-100 text-slate-400 dark:bg-white/[0.05]">
          <CalendarX2 className="h-5 w-5" />
        </span>
        <h3 className="mt-4 text-sm font-semibold text-slate-900 dark:text-white">
          No holidays configured
        </h3>
        <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">
          Use the form above to add the first holiday.
        </p>
      </div>
    );
  }

  return (
    <>
      <div className="space-y-3 md:hidden">
        {sortedHolidays.map((holiday) => (
          <article
            key={holiday._id}
            className="rounded-xl border border-slate-200 p-4 dark:border-white/10"
          >
            <div className="flex items-start justify-between gap-3">
              <div className="min-w-0">
                <h3 className="truncate text-sm font-semibold text-slate-900 dark:text-white">
                  {holiday.name}
                </h3>
                <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">
                  {formatDate(holiday.date)}
                </p>
              </div>
              <span
                className={`shrink-0 rounded-full border px-2.5 py-1 text-[11px] font-semibold ${
                  typeStyles[holiday.type] || typeStyles.COMPANY
                }`}
              >
                {holiday.type || "Company"}
              </span>
            </div>
            <div className="mt-4 flex items-center justify-between gap-3 border-t border-slate-200 pt-3 dark:border-white/10">
              <p className="truncate text-xs text-slate-500 dark:text-slate-400">
                {(holiday.shifts || ["ALL"]).map(formatShift).join(", ")}
              </p>
              <div className="flex gap-2">
                <button
                  type="button"
                  onClick={() => onEdit(holiday)}
                  className="rounded-lg bg-blue-50 p-2 text-blue-700 transition hover:bg-blue-100 dark:bg-blue-400/10 dark:text-blue-300"
                  aria-label={`Edit ${holiday.name}`}
                >
                  <Pencil className="h-4 w-4" />
                </button>
                <button
                  type="button"
                  onClick={() => onDelete(holiday._id)}
                  className="rounded-lg bg-rose-50 p-2 text-rose-700 transition hover:bg-rose-100 dark:bg-rose-400/10 dark:text-rose-300"
                  aria-label={`Delete ${holiday.name}`}
                >
                  <Trash2 className="h-4 w-4" />
                </button>
              </div>
            </div>
          </article>
        ))}
      </div>

      <div className="hidden overflow-hidden rounded-xl border border-slate-200 dark:border-white/10 md:block">
        <div className="overflow-x-auto">
          <table className="w-full min-w-[720px] text-left">
            <thead className="bg-slate-50 dark:bg-white/[0.025]">
              <tr className="border-b border-slate-200 dark:border-white/10">
                {["Holiday", "Date", "Type", "Applies to", ""].map(
                  (heading) => (
                    <th
                      key={heading || "actions"}
                      className="px-5 py-3 text-[11px] font-semibold uppercase tracking-wider text-slate-500 dark:text-slate-400"
                    >
                      {heading}
                    </th>
                  ),
                )}
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-200 dark:divide-white/10">
              {sortedHolidays.map((holiday) => (
                <tr
                  key={holiday._id}
                  className="transition hover:bg-slate-50 dark:hover:bg-white/[0.025]"
                >
                  <td className="px-5 py-3.5 text-sm font-semibold text-slate-900 dark:text-white">
                    {holiday.name}
                  </td>
                  <td className="px-5 py-3.5 text-sm text-slate-600 dark:text-slate-300">
                    {formatDate(holiday.date)}
                  </td>
                  <td className="px-5 py-3.5">
                    <span
                      className={`rounded-full border px-2.5 py-1 text-[11px] font-semibold ${
                        typeStyles[holiday.type] || typeStyles.COMPANY
                      }`}
                    >
                      {holiday.type || "Company"}
                    </span>
                  </td>
                  <td className="px-5 py-3.5 text-sm text-slate-600 dark:text-slate-300">
                    {(holiday.shifts || ["ALL"]).map(formatShift).join(", ")}
                  </td>
                  <td className="px-5 py-3.5">
                    <div className="flex justify-end gap-2">
                      <button
                        type="button"
                        onClick={() => onEdit(holiday)}
                        className="inline-flex h-8 items-center gap-1.5 rounded-lg bg-blue-50 px-3 text-xs font-semibold text-blue-700 transition hover:bg-blue-100 dark:bg-blue-400/10 dark:text-blue-300"
                      >
                        <Pencil className="h-3.5 w-3.5" /> Edit
                      </button>
                      <button
                        type="button"
                        onClick={() => onDelete(holiday._id)}
                        className="inline-flex h-8 items-center gap-1.5 rounded-lg bg-rose-50 px-3 text-xs font-semibold text-rose-700 transition hover:bg-rose-100 dark:bg-rose-400/10 dark:text-rose-300"
                      >
                        <Trash2 className="h-3.5 w-3.5" /> Delete
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </>
  );
};

export default HolidayTable;
