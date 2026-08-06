import React from "react";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import { Sparkles, X as XCircle, Copy, Check } from "lucide-react";

/**
 * AI conversation-summary modal, shared by all three messaging surfaces.
 *
 * ─── WHY THIS IS SHARED ───
 * The same modal was written out three times — in chatWindow, in
 * ProjectMessagePanel and in ProjectDetailPage — each with its own copy of the
 * ~40-line ReactMarkdown `components` map. Three copies meant three places to
 * fix a rendering bug and three chances for them to drift apart visually, which
 * they already had (spacing and heading sizes differed slightly).
 *
 * Purely presentational: it owns no state and does no network. The parent keeps
 * the summary text, the loading flag and the day range, because the endpoint
 * differs per scope (see api/messagingApi.js `summarize`).
 *
 * @param {boolean}  open
 * @param {Function} onClose
 * @param {number}   days           selected time window
 * @param {Function} onDaysChange
 * @param {boolean}  loading
 * @param {string}   summary        markdown
 * @param {Function} onRegenerate
 * @param {Function} onCopy         called with the summary text
 * @param {boolean}  copied         show the "Copied!" state
 */

/* Markdown renderers. Module-level so the object identity is stable — inlining
   it would hand ReactMarkdown a new `components` prop on every render. */
const MD = {
  p: ({ children }) => (
    <p className="mb-3 leading-relaxed text-slate-700 dark:text-gray-200">{children}</p>
  ),
  h1: ({ children }) => (
    <h1 className="mb-3 text-2xl font-bold text-slate-950 dark:text-gray-100">{children}</h1>
  ),
  h2: ({ children }) => (
    <h2 className="mb-2 text-xl font-bold text-slate-950 dark:text-gray-100">{children}</h2>
  ),
  h3: ({ children }) => (
    <h3 className="mb-2 text-lg font-bold text-slate-950 dark:text-gray-100">{children}</h3>
  ),
  ul: ({ children }) => <ul className="mb-3 list-inside list-disc space-y-1">{children}</ul>,
  ol: ({ children }) => <ol className="mb-3 list-inside list-decimal space-y-1">{children}</ol>,
  li: ({ children }) => <li className="ml-2 text-slate-700 dark:text-gray-200">{children}</li>,
  strong: ({ children }) => (
    <strong className="font-bold text-blue-700 dark:text-blue-300">{children}</strong>
  ),
  code: ({ inline, children }) =>
    inline ? (
      <code className="rounded bg-slate-100 px-1.5 py-0.5 text-xs text-blue-700 dark:bg-gray-900 dark:text-blue-300">
        {children}
      </code>
    ) : (
      <code className="block overflow-x-auto rounded bg-slate-100 p-3 text-sm text-slate-700 dark:bg-gray-900 dark:text-gray-300">
        {children}
      </code>
    ),
};

const DAY_OPTIONS = [
  { value: 1, label: "Last 24 hours" },
  { value: 3, label: "Last 3 days" },
  { value: 7, label: "Last week" },
  { value: 14, label: "Last 2 weeks" },
  { value: 30, label: "Last month" },
];

export default function ThreadSummaryModal({
  open,
  onClose,
  days = 7,
  onDaysChange,
  loading = false,
  summary = "",
  onRegenerate,
  onCopy,
  copied = false,
}) {
  if (!open) return null;

  return (
    <div
      className="fixed inset-0 z-[9999] flex items-center justify-center bg-slate-950/60 p-4 backdrop-blur-sm"
      onClick={onClose}
    >
      <div
        className="flex max-h-[80vh] w-full max-w-3xl flex-col rounded-xl border border-slate-200 bg-white shadow-2xl dark:border-[#232945] dark:bg-[#0f1419]"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between border-b border-slate-200 p-4 dark:border-[#1e2a35]">
          <div className="flex items-center gap-3">
            <Sparkles className="h-5 w-5 text-blue-500 dark:text-blue-400" />
            <h2 className="text-xl font-semibold text-slate-950 dark:text-white">
              AI Conversation Summary
            </h2>
          </div>
          <button
            onClick={onClose}
            className="rounded-lg p-2 transition hover:bg-slate-100 dark:hover:bg-[#141a21]"
          >
            <XCircle className="h-5 w-5 text-slate-400" />
          </button>
        </div>

        {/* Time window */}
        <div className="border-b border-slate-200 bg-slate-50 px-4 py-3 dark:border-[#1e2a35] dark:bg-[#0a0e14]/50">
          <div className="flex items-center gap-3">
            <label className="text-sm text-slate-500 dark:text-gray-400">Time period:</label>
            <select
              value={days}
              onChange={(e) => onDaysChange?.(Number(e.target.value))}
              className="rounded border border-slate-200 bg-white px-3 py-1.5 text-sm text-slate-900 outline-none focus:ring-2 focus:ring-blue-500 dark:border-[#2a3340] dark:bg-[#141a21] dark:text-blue-100"
            >
              {DAY_OPTIONS.map((o) => (
                <option key={o.value} value={o.value}>
                  {o.label}
                </option>
              ))}
            </select>
            <button
              onClick={onRegenerate}
              disabled={loading}
              className="flex items-center gap-2 rounded bg-blue-600 px-4 py-1.5 text-sm text-white transition hover:bg-blue-500 disabled:cursor-not-allowed disabled:opacity-50"
            >
              <Sparkles className="h-4 w-4" />
              {loading ? "Generating..." : "Regenerate"}
            </button>
          </div>
        </div>

        {/* Body */}
        <div className="flex-1 overflow-y-auto bg-slate-50/50 p-6 dark:bg-[#0a0e14]/30">
          {loading ? (
            <div className="flex h-full flex-col items-center justify-center gap-4">
              <div className="relative">
                <div className="h-16 w-16 animate-spin rounded-full border-4 border-blue-500/30 border-t-blue-500" />
                <Sparkles className="absolute left-1/2 top-1/2 h-6 w-6 -translate-x-1/2 -translate-y-1/2 text-blue-400" />
              </div>
              <p className="text-sm text-slate-500 dark:text-gray-400">
                Analyzing conversation with AI...
              </p>
            </div>
          ) : (
            <div className="prose prose-sm prose-slate max-w-none dark:prose-invert">
              <ReactMarkdown remarkPlugins={[remarkGfm]} components={MD}>
                {summary}
              </ReactMarkdown>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="flex items-center justify-between border-t border-slate-200 bg-slate-50 p-4 dark:border-[#1e2a35] dark:bg-[#0a0e14]/50">
          <div className="text-xs text-slate-500 dark:text-gray-500">
            Powered by AI · Last {days} day{days !== 1 ? "s" : ""}
          </div>
          <button
            onClick={() => onCopy?.(summary)}
            disabled={!summary || loading}
            className="flex items-center gap-2 rounded border border-slate-200 bg-white px-4 py-2 text-sm text-slate-700 transition hover:bg-slate-100 disabled:cursor-not-allowed disabled:opacity-50 dark:border-[#2a3340] dark:bg-[#141a21] dark:text-gray-200 dark:hover:bg-[#1e2a35]"
          >
            {copied ? (
              <>
                <Check className="h-4 w-4" />
                Copied!
              </>
            ) : (
              <>
                <Copy className="h-4 w-4" />
                Copy Summary
              </>
            )}
          </button>
        </div>
      </div>
    </div>
  );
}
