import React from "react";
import { Filter, Search, X as XCircle, Sparkles, History } from "lucide-react";

/**
 * Search / filter bar shown above a message thread, shared by all three
 * messaging surfaces.
 *
 * ─── WHY THIS IS SHARED ───
 * Like the summary modal, this markup existed three times over — chatWindow,
 * ProjectMessagePanel and ProjectDetailPage each carried their own copy of the
 * same four controls (message text, sender name, two dates) plus the collapse
 * toggle, the "Reconnecting" pill and the Summarize button. The copies had
 * already drifted in spacing and in which dark-mode tokens they used.
 *
 * Purely presentational and fully controlled — every value and setter comes
 * from the parent, because the filters feed different things per surface
 * (client-side filtering on two of them, a paginated server query on the third).
 *
 * @param {boolean}  open              filter panel expanded
 * @param {Function} onToggle
 * @param {boolean}  connected         false renders the "Reconnecting" pill
 * @param {Function} [onSummarize]     omit to hide the Summarize button
 * @param {string}   search
 * @param {Function} onSearchChange
 * @param {string}   sender
 * @param {Function} onSenderChange
 * @param {{start: string, end: string}} dateRange
 * @param {Function} onDateRangeChange  receives the full next range
 * @param {Function} onClear
 * @param {Function} [onSearchHistory]  omit to hide the all-history button.
 *        The `search` field above filters only the messages already LOADED —
 *        the newest page — which is why this is offered beside it rather than
 *        replacing it: filtering what is on screen is instant and often what
 *        you want; finding something from six months ago is a different job
 *        and needs the server.
 * @param {'blue'|'teal'} [accent]  chat threads are blue, project threads teal
 *                                  — a deliberate existing distinction, not
 *                                  drift, so it stays configurable
 */
const ACCENT = {
  blue: "text-blue-500 dark:text-blue-400",
  teal: "text-teal-500 dark:text-teal-400",
};

export default function ThreadFilterBar({
  open = false,
  onToggle,
  connected = true,
  onSummarize,
  accent = "blue",
  search = "",
  onSearchChange,
  sender = "",
  onSenderChange,
  dateRange = { start: "", end: "" },
  onDateRangeChange,
  onClear,
  onSearchHistory,
}) {
  const hasFilters = Boolean(search || sender || dateRange.start || dateRange.end);

  return (
    <div className="border-b border-slate-200 bg-white dark:border-white/10 dark:bg-[#10131c]">
      <div className="flex items-center">
        <button
          onClick={onToggle}
          className="flex flex-1 items-center gap-2 px-4 py-2 text-left text-sm text-slate-600 transition hover:bg-slate-100 dark:text-slate-300 dark:hover:bg-white/[0.06]"
        >
          <Filter className="h-4 w-4" />
          <span>Search &amp; Filters {open ? "▼" : "▶"}</span>
        </button>

        {!connected && (
          <span className="inline-flex items-center gap-1.5 rounded-full bg-rose-50 px-2 py-1 text-[10px] text-rose-700 dark:bg-rose-500/10 dark:text-rose-300">
            <span className="h-1.5 w-1.5 rounded-full bg-rose-400" />
            Reconnecting
          </span>
        )}

        {onSearchHistory && (
          <button
            onClick={onSearchHistory}
            className="flex items-center gap-2 border-l border-slate-200 px-4 py-2 text-sm text-slate-600 transition hover:bg-slate-100 dark:border-white/10 dark:text-slate-300 dark:hover:bg-white/[0.06]"
            title="Search all message history"
          >
            <History className={`h-4 w-4 ${ACCENT[accent] || ACCENT.blue}`} />
            <span className="hidden sm:inline">Search all</span>
          </button>
        )}

        {onSummarize && (
          <button
            onClick={onSummarize}
            className="flex items-center gap-2 border-l border-slate-200 px-4 py-2 text-sm text-slate-600 transition hover:bg-slate-100 dark:border-white/10 dark:text-slate-300 dark:hover:bg-white/[0.06]"
            title="Summarize conversation"
          >
            <Sparkles className={`h-4 w-4 ${ACCENT[accent] || ACCENT.blue}`} />
            <span>Summarize</span>
          </button>
        )}
      </div>

      {open && (
        <div className="grid grid-cols-1 gap-3 border-t border-slate-200 bg-slate-50 p-3 dark:border-white/10 dark:bg-[#0d1017] sm:grid-cols-2">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
            <input
              type="text"
              placeholder="Search messages..."
              value={search}
              onChange={(e) => onSearchChange?.(e.target.value)}
              className="app-control w-full py-2 pl-10 pr-4 text-sm"
            />
            {onSearchHistory && (
              <p className="mt-1 text-[11px] text-slate-500 dark:text-slate-400">
                Filters loaded messages only.{" "}
                <button
                  type="button"
                  onClick={onSearchHistory}
                  className="font-medium underline underline-offset-2 hover:text-slate-900 dark:hover:text-white"
                >
                  Search all history
                </button>
              </p>
            )}
          </div>

          <input
            type="text"
            placeholder="Filter by sender name..."
            value={sender}
            onChange={(e) => onSenderChange?.(e.target.value)}
            className="app-control px-4 py-2 text-sm"
          />

          <div className="flex gap-2">
            <input
              type="date"
              value={dateRange.start}
              onChange={(e) => onDateRangeChange?.({ ...dateRange, start: e.target.value })}
              className="app-control flex-1 px-3 py-2 text-sm"
            />
            <input
              type="date"
              value={dateRange.end}
              onChange={(e) => onDateRangeChange?.({ ...dateRange, end: e.target.value })}
              className="app-control flex-1 px-3 py-2 text-sm"
            />
          </div>

          {hasFilters && (
            <button
              onClick={onClear}
              className="flex items-center justify-center gap-2 rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700 transition hover:bg-red-100 dark:border-red-500/30 dark:bg-red-600/20 dark:text-red-400 dark:hover:bg-red-600/40 sm:col-span-2"
            >
              <XCircle className="h-4 w-4" />
              Clear Filters
            </button>
          )}
        </div>
      )}
    </div>
  );
}
