import React, { useMemo, useState } from "react";
import PropTypes from "prop-types";
import { useDispatch } from "react-redux";
import { Forward, Search, Check, X, Loader2 } from "lucide-react";
import * as messagingApi from "../../api/messagingApi";
import { forwardMessages } from "../../store/slices/threadsSlice";

/**
 * Pick which conversations to forward the selected messages into.
 *
 * ─── PARTIAL SUCCESS IS A NORMAL OUTCOME ───
 * The server checks write access per destination and reports failures rather
 * than rejecting the whole request. Forwarding to four groups when you've since
 * been removed from one should deliver to the other three — so this reports
 * what landed and what didn't, instead of a single "failed" that hides the
 * three that worked.
 */
const ForwardMessagesModal = ({
  open,
  onClose,
  sourceThreadId,
  messageIds,
  conversations,
  onDone,
}) => {
  const dispatch = useDispatch();

  const [search, setSearch] = useState("");
  const [selected, setSelected] = useState([]);
  const [sending, setSending] = useState(false);
  const [result, setResult] = useState(null);

  // Never offer the conversation the messages came from — forwarding a message
  // back into its own thread is always a mistake.
  const targets = useMemo(() => {
    const term = search.trim().toLowerCase();
    return (conversations || [])
      .filter((c) => String(c._id) !== String(sourceThreadId))
      .filter((c) => !term || (c.name || "").toLowerCase().includes(term));
  }, [conversations, sourceThreadId, search]);

  if (!open) return null;

  const toggle = (id) =>
    setSelected((prev) =>
      prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]
    );

  const send = async () => {
    if (!selected.length || sending) return;
    setSending(true);
    try {
      const res = await dispatch(
        forwardMessages({
          scope: messagingApi.SCOPES.CHAT,
          sourceThreadId,
          messageIds,
          destinationThreadIds: selected,
        })
      ).unwrap();

      // Anything rejected is worth showing rather than closing over silently.
      if (res.failed?.length) {
        setResult(res);
      } else {
        onDone?.(res);
        onClose();
      }
    } catch (err) {
      setResult({ delivered: [], failed: [{ threadId: "", reason: err.message }] });
    } finally {
      setSending(false);
    }
  };

  const nameOf = (id) =>
    (conversations || []).find((c) => String(c._id) === String(id))?.name || "a conversation";

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4 backdrop-blur-sm"
      role="dialog"
      aria-modal="true"
      aria-labelledby="forward-title"
    >
      <div className="flex max-h-[80vh] w-full max-w-md flex-col overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-xl dark:border-white/10 dark:bg-[#10131c]">
        <div className="flex items-center justify-between border-b border-slate-200 p-4 dark:border-white/10">
          <div className="flex items-center gap-2">
            <Forward className="h-4 w-4 text-blue-600 dark:text-blue-400" />
            <h3 id="forward-title" className="font-semibold text-slate-900 dark:text-white">
              Forward {messageIds.length} message{messageIds.length === 1 ? "" : "s"}
            </h3>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="rounded-lg p-1.5 text-slate-400 hover:bg-slate-100 dark:hover:bg-white/[0.05]"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        {result?.failed?.length ? (
          <div className="space-y-3 p-4">
            {result.delivered?.length > 0 && (
              <p className="text-sm text-emerald-600 dark:text-emerald-400">
                Sent to {result.delivered.length} conversation
                {result.delivered.length === 1 ? "" : "s"}.
              </p>
            )}
            <div className="rounded-lg border border-amber-200 bg-amber-50 p-3 text-sm text-amber-800 dark:border-amber-400/20 dark:bg-amber-400/10 dark:text-amber-200">
              <p className="mb-1 font-medium">Could not send to:</p>
              <ul className="space-y-0.5">
                {result.failed.map((f, i) => (
                  <li key={i}>
                    {nameOf(f.threadId)} — {f.reason}
                  </li>
                ))}
              </ul>
            </div>
            <button
              type="button"
              onClick={onClose}
              className="h-10 w-full rounded-lg bg-blue-600 text-sm font-semibold text-white hover:bg-blue-700"
            >
              Close
            </button>
          </div>
        ) : (
          <>
            <div className="border-b border-slate-200 p-3 dark:border-white/10">
              <div className="relative">
                <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
                <input
                  type="text"
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  placeholder="Search conversations"
                  className="w-full rounded-lg border border-slate-200 bg-white py-2 pl-9 pr-3 text-sm text-slate-900 placeholder-slate-400 dark:border-white/10 dark:bg-white/[0.03] dark:text-white"
                />
              </div>
            </div>

            <div className="flex-1 overflow-y-auto p-2">
              {targets.length === 0 ? (
                <p className="py-8 text-center text-sm text-slate-400">
                  No other conversations
                </p>
              ) : (
                targets.map((conv) => {
                  const id = String(conv._id);
                  const on = selected.includes(id);
                  return (
                    <button
                      key={id}
                      type="button"
                      onClick={() => toggle(id)}
                      className={`flex w-full items-center gap-3 rounded-lg px-3 py-2.5 text-left transition ${
                        on
                          ? "bg-blue-50 dark:bg-blue-400/10"
                          : "hover:bg-slate-50 dark:hover:bg-white/[0.04]"
                      }`}
                    >
                      <span
                        className={`flex h-5 w-5 shrink-0 items-center justify-center rounded border ${
                          on
                            ? "border-blue-600 bg-blue-600 text-white"
                            : "border-slate-300 dark:border-white/20"
                        }`}
                      >
                        {on && <Check className="h-3 w-3" />}
                      </span>
                      <span className="truncate text-sm text-slate-800 dark:text-slate-200">
                        {conv.name || "Unnamed group"}
                      </span>
                    </button>
                  );
                })
              )}
            </div>

            <div className="flex items-center justify-between gap-3 border-t border-slate-200 p-4 dark:border-white/10">
              <span className="text-xs text-slate-500 dark:text-slate-400">
                {selected.length} selected
              </span>
              <button
                type="button"
                onClick={send}
                disabled={!selected.length || sending}
                className="inline-flex h-10 items-center gap-2 rounded-lg bg-blue-600 px-5 text-sm font-semibold text-white transition hover:bg-blue-700 disabled:cursor-not-allowed disabled:opacity-50"
              >
                {sending ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  <Forward className="h-4 w-4" />
                )}
                {sending ? "Sending…" : "Forward"}
              </button>
            </div>
          </>
        )}
      </div>
    </div>
  );
};

ForwardMessagesModal.propTypes = {
  open: PropTypes.bool,
  onClose: PropTypes.func.isRequired,
  sourceThreadId: PropTypes.string,
  messageIds: PropTypes.array,
  conversations: PropTypes.array,
  onDone: PropTypes.func,
};

export default ForwardMessagesModal;
