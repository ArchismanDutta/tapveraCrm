import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import PropTypes from "prop-types";
import {
  Search,
  X,
  Loader2,
  AlertCircle,
  Paperclip,
  MessagesSquare,
  ChevronDown,
  ChevronRight,
  CornerDownRight,
} from "lucide-react";
import * as messagingApi from "../../api/messagingApi";

/**
 * Search across message history — the real thing, not a filter over what
 * happens to be on screen.
 *
 * ─── WHY THIS IS A SEPARATE VIEW AND NOT A FILTER ───
 * Every surface used to "search" by filtering its in-memory list, and a thread
 * only loads its newest 50 messages, so anything older was unfindable. The
 * previous attempt at fixing that sent the query to the server and merged the
 * response back into the shared thread store — which only ever ADDS rows, so a
 * narrowing query widened the thread everyone was reading and the rendered
 * list never changed at all. Both project surfaces backed it out.
 *
 * The conclusion their own code comments reached is the one this follows: a
 * server-side search has to be its own result view, not a mutation of the
 * thread everyone else is looking at. Nothing here touches the store.
 *
 * ─── READING A RESULT ───
 * A hit from six months ago cannot be shown by scrolling the thread to it —
 * that would mean loading a page from the middle of history into a store that
 * only pages one direction, leaving a gap nothing reconciles. Instead a result
 * expands in place to show the messages around it. `onJump` is offered as well
 * for the case where the message IS already loaded in the open thread, where
 * scrolling to it is the nicer answer.
 */

const DEBOUNCE_MS = 350;
const PAGE_SIZE = 25;

/** Split a snippet into plain and highlighted runs, using server offsets. */
function renderSnippet(snippet) {
  if (!snippet) return null;
  const { text = "", highlights = [], truncatedStart, truncatedEnd } = snippet;

  if (!highlights.length) {
    return (
      <>
        {truncatedStart && "… "}
        {text}
        {truncatedEnd && " …"}
      </>
    );
  }

  const parts = [];
  let cursor = 0;
  highlights.forEach((h, i) => {
    if (h.start > cursor) parts.push(<span key={`t${i}`}>{text.slice(cursor, h.start)}</span>);
    parts.push(
      <mark
        key={`h${i}`}
        className="rounded bg-amber-200 px-0.5 text-slate-900 dark:bg-amber-400/30 dark:text-amber-100"
      >
        {text.slice(h.start, h.start + h.length)}
      </mark>
    );
    cursor = h.start + h.length;
  });
  if (cursor < text.length) parts.push(<span key="tail">{text.slice(cursor)}</span>);

  return (
    <>
      {truncatedStart && "… "}
      {parts}
      {truncatedEnd && " …"}
    </>
  );
}

const formatWhen = (iso) => {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "";
  const sameYear = d.getFullYear() === new Date().getFullYear();
  return d.toLocaleDateString(undefined, {
    day: "numeric",
    month: "short",
    ...(sameYear ? {} : { year: "numeric" }),
    hour: "2-digit",
    minute: "2-digit",
  });
};

const MessageSearchPanel = ({ open, onClose, scope, threadId, threadLabel, onJump, accent = "blue" }) => {
  const [input, setInput] = useState("");
  const [query, setQuery] = useState("");
  // "thread" searches only the thread you're in; "all" searches everything you
  // can read, across chat and projects.
  const [where, setWhere] = useState(threadId ? "thread" : "all");

  const [results, setResults] = useState([]);
  const [total, setTotal] = useState(0);
  const [pagination, setPagination] = useState(null);
  const [loading, setLoading] = useState(false);
  const [loadingMore, setLoadingMore] = useState(false);
  const [error, setError] = useState(null);
  const [expanded, setExpanded] = useState({});

  const inputRef = useRef(null);
  // Guards against a slow early query landing after a fast later one and
  // overwriting it — the classic search race.
  const requestSeq = useRef(0);

  const a = accent === "teal"
    ? { ring: "focus:border-teal-400/50 focus:ring-teal-500/15", chip: "bg-teal-600", text: "text-teal-700 dark:text-teal-300" }
    : { ring: "focus:border-blue-400/50 focus:ring-blue-500/15", chip: "bg-blue-600", text: "text-blue-700 dark:text-blue-300" };

  useEffect(() => {
    if (open) inputRef.current?.focus();
  }, [open]);

  useEffect(() => {
    if (!open) return undefined;
    const onKey = (e) => {
      if (e.key === "Escape") onClose?.();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open, onClose]);

  // Debounced so it is one request per pause, not one per keystroke — the
  // other half of why the earlier attempt was withdrawn.
  useEffect(() => {
    const t = setTimeout(() => setQuery(input.trim()), DEBOUNCE_MS);
    return () => clearTimeout(t);
  }, [input]);

  const runSearch = useCallback(
    async (page = 1) => {
      if (query.length < 2) {
        setResults([]);
        setTotal(0);
        setPagination(null);
        setError(null);
        return;
      }

      const seq = ++requestSeq.current;
      page === 1 ? setLoading(true) : setLoadingMore(true);
      setError(null);

      try {
        const out = await messagingApi.searchMessages({
          query,
          scope: where === "thread" ? scope : "all",
          threadId: where === "thread" ? threadId : null,
          page,
          limit: PAGE_SIZE,
        });
        if (seq !== requestSeq.current) return; // a newer query already won
        setResults((prev) => (page === 1 ? out.results : [...prev, ...out.results]));
        setTotal(out.total);
        setPagination(out.pagination);
      } catch (err) {
        if (seq !== requestSeq.current) return;
        setError(err.message || "Search failed");
        if (page === 1) setResults([]);
      } finally {
        if (seq === requestSeq.current) {
          setLoading(false);
          setLoadingMore(false);
        }
      }
    },
    [query, where, scope, threadId]
  );

  useEffect(() => {
    setExpanded({});
    runSearch(1);
  }, [runSearch]);

  const toggleContext = async (result) => {
    const key = result.messageId;
    if (expanded[key]) {
      setExpanded((prev) => ({ ...prev, [key]: null }));
      return;
    }
    setExpanded((prev) => ({ ...prev, [key]: { loading: true, messages: [] } }));
    try {
      const ctx = await messagingApi.fetchMessageContext(result.scope, result.messageId);
      setExpanded((prev) => ({ ...prev, [key]: { loading: false, messages: ctx.messages } }));
    } catch (err) {
      setExpanded((prev) => ({
        ...prev,
        [key]: { loading: false, messages: [], error: err.message || "Couldn't load the surrounding messages" },
      }));
    }
  };

  const scopeLabel = useMemo(
    () => (threadLabel ? `In ${threadLabel}` : "This conversation"),
    [threadLabel]
  );

  if (!open) return null;

  return (
    // A drawer rather than a column in the thread layout: all three surfaces
    // have different, already-crowded flex trees, and search is a transient
    // side view rather than part of the conversation. One line at each call
    // site, no layout surgery.
    <div className="fixed inset-0 z-50 flex justify-end" role="dialog" aria-modal="true" aria-label="Search messages">
      <button
        type="button"
        aria-label="Close search"
        onClick={onClose}
        className="absolute inset-0 cursor-default bg-black/30 backdrop-blur-[2px]"
      />
      <div className="relative flex h-full w-full min-h-0 max-w-md flex-col border-l border-slate-200 bg-white shadow-2xl dark:border-white/10 dark:bg-[#10131c]">
      <div className="flex items-center justify-between gap-2 border-b border-slate-200 px-4 py-3 dark:border-white/10">
        <h3 className="flex items-center gap-2 text-sm font-semibold text-slate-900 dark:text-white">
          <Search className="h-4 w-4" />
          Search messages
        </h3>
        <button
          type="button"
          onClick={onClose}
          aria-label="Close search"
          className="rounded-lg p-1.5 text-slate-400 hover:bg-slate-100 dark:hover:bg-white/[0.05]"
        >
          <X className="h-4 w-4" />
        </button>
      </div>

      <div className="space-y-2 border-b border-slate-200 p-3 dark:border-white/10">
        <div className="relative">
          <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
          <input
            ref={inputRef}
            type="search"
            value={input}
            onChange={(e) => setInput(e.target.value)}
            placeholder="Search all history…"
            className={`w-full rounded-lg border border-slate-200 bg-white py-2 pl-9 pr-3 text-sm text-slate-900 placeholder-slate-400 dark:border-white/10 dark:bg-white/[0.03] dark:text-white ${a.ring}`}
          />
        </div>

        {threadId && (
          <div className="flex gap-1 text-xs">
            {[
              ["thread", scopeLabel],
              ["all", "Everywhere"],
            ].map(([key, label]) => (
              <button
                key={key}
                type="button"
                onClick={() => setWhere(key)}
                className={`rounded-md px-2.5 py-1 font-medium transition ${
                  where === key
                    ? `${a.chip} text-white`
                    : "text-slate-600 hover:bg-slate-100 dark:text-slate-300 dark:hover:bg-white/[0.06]"
                }`}
              >
                {label}
              </button>
            ))}
          </div>
        )}
      </div>

      <div className="min-h-0 flex-1 overflow-y-auto">
        {query.length > 0 && query.length < 2 && (
          <p className="px-4 py-6 text-center text-sm text-slate-400">Keep typing — two characters minimum.</p>
        )}

        {loading && (
          <p className="flex items-center justify-center gap-2 px-4 py-8 text-sm text-slate-400">
            <Loader2 className="h-4 w-4 animate-spin" />
            Searching…
          </p>
        )}

        {!loading && error && (
          <div className="space-y-3 px-4 py-8 text-center">
            <AlertCircle className="mx-auto h-5 w-5 text-amber-500" />
            <p className="text-sm text-slate-500 dark:text-slate-400">{error}</p>
            <button
              type="button"
              onClick={() => runSearch(1)}
              className="rounded-lg border border-slate-200 px-3 py-1.5 text-xs font-semibold text-slate-700 hover:bg-slate-50 dark:border-white/10 dark:text-slate-200 dark:hover:bg-white/[0.05]"
            >
              Try again
            </button>
          </div>
        )}

        {!loading && !error && query.length >= 2 && results.length === 0 && (
          <p className="px-4 py-8 text-center text-sm text-slate-400">
            Nothing found for “{query}”.
          </p>
        )}

        {!loading && !error && results.length > 0 && (
          <>
            <p className="px-4 pt-3 text-xs text-slate-500 dark:text-slate-400">
              {total} {total === 1 ? "message" : "messages"}
            </p>

            <ul className="divide-y divide-slate-100 dark:divide-white/[0.06]">
              {results.map((r) => {
                const ctx = expanded[r.messageId];
                return (
                  <li key={`${r.scope}:${r.messageId}`} className="px-4 py-3">
                    <div className="flex items-baseline justify-between gap-2">
                      <span className={`flex items-center gap-1.5 truncate text-xs font-semibold ${a.text}`}>
                        <MessagesSquare className="h-3 w-3 shrink-0" />
                        {r.threadName}
                      </span>
                      <span className="shrink-0 text-[11px] text-slate-400">{formatWhen(r.createdAt)}</span>
                    </div>

                    <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">
                      {r.sender?.name || "Unknown"}
                      {r.senderType === "client" && " (Client)"}
                      {r.hasAttachments && (
                        <Paperclip className="ml-1 inline h-3 w-3 align-[-1px] text-slate-400" />
                      )}
                    </p>

                    <p className="mt-1 whitespace-pre-wrap break-words text-sm text-slate-800 dark:text-slate-200">
                      {renderSnippet(r.snippet)}
                    </p>

                    <div className="mt-2 flex flex-wrap items-center gap-3">
                      <button
                        type="button"
                        onClick={() => toggleContext(r)}
                        className="inline-flex items-center gap-1 text-xs font-medium text-slate-500 hover:text-slate-900 dark:text-slate-400 dark:hover:text-white"
                      >
                        {ctx ? <ChevronDown className="h-3 w-3" /> : <ChevronRight className="h-3 w-3" />}
                        {ctx ? "Hide surrounding messages" : "Show surrounding messages"}
                      </button>

                      {/* Only useful when the message is already on screen —
                          scrolling the live thread to a six-month-old message
                          is exactly what the context view exists to avoid. */}
                      {onJump && r.threadId === threadId && (
                        <button
                          type="button"
                          onClick={() => onJump(r.messageId)}
                          className="inline-flex items-center gap-1 text-xs font-medium text-slate-500 hover:text-slate-900 dark:text-slate-400 dark:hover:text-white"
                        >
                          <CornerDownRight className="h-3 w-3" />
                          Show in conversation
                        </button>
                      )}
                    </div>

                    {ctx && (
                      <div className="mt-2 space-y-1.5 rounded-lg border border-slate-200 bg-slate-50 p-2.5 dark:border-white/10 dark:bg-white/[0.03]">
                        {ctx.loading && (
                          <p className="flex items-center gap-2 text-xs text-slate-400">
                            <Loader2 className="h-3 w-3 animate-spin" />
                            Loading…
                          </p>
                        )}
                        {ctx.error && <p className="text-xs text-amber-600 dark:text-amber-300">{ctx.error}</p>}
                        {ctx.messages.map((m) => (
                          <div
                            key={m.id}
                            className={`rounded px-2 py-1 text-xs ${
                              m.isMatch
                                ? "bg-amber-100 text-slate-900 dark:bg-amber-400/15 dark:text-amber-50"
                                : "text-slate-600 dark:text-slate-300"
                            }`}
                          >
                            <span className="font-semibold">{m.sender?.name || "Unknown"}</span>
                            <span className="ml-1.5 text-[10px] text-slate-400">{formatWhen(m.createdAt)}</span>
                            <div className="whitespace-pre-wrap break-words">
                              {m.body || (m.hasAttachments ? "📎 Attachment" : "")}
                            </div>
                          </div>
                        ))}
                      </div>
                    )}
                  </li>
                );
              })}
            </ul>

            {pagination?.hasMore && (
              <div className="p-3">
                <button
                  type="button"
                  onClick={() => runSearch((pagination.page || 1) + 1)}
                  disabled={loadingMore}
                  className="flex w-full items-center justify-center gap-2 rounded-lg border border-slate-200 py-2 text-xs font-semibold text-slate-700 hover:bg-slate-50 disabled:opacity-50 dark:border-white/10 dark:text-slate-200 dark:hover:bg-white/[0.05]"
                >
                  {loadingMore && <Loader2 className="h-3.5 w-3.5 animate-spin" />}
                  {loadingMore ? "Loading…" : "Load more results"}
                </button>
              </div>
            )}
          </>
        )}
        </div>
      </div>
    </div>
  );
};

MessageSearchPanel.propTypes = {
  open: PropTypes.bool,
  onClose: PropTypes.func.isRequired,
  /** The scope of the thread this panel was opened from. */
  scope: PropTypes.oneOf(["chat", "project"]).isRequired,
  /** Omit to search everywhere with no thread toggle. */
  threadId: PropTypes.string,
  threadLabel: PropTypes.string,
  /** Called with a message id when it is already loaded in the open thread. */
  onJump: PropTypes.func,
  accent: PropTypes.oneOf(["blue", "teal"]),
};

export default MessageSearchPanel;
