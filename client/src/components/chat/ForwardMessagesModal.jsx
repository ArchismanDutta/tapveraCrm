import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import PropTypes from "prop-types";
import { useDispatch } from "react-redux";
import { Forward, Search, Check, X, Loader2, Users, AlertCircle } from "lucide-react";
import * as messagingApi from "../../api/messagingApi";
import { forwardMessages } from "../../store/slices/threadsSlice";

/**
 * Pick which conversations to forward the selected messages into.
 *
 * ─── ONE PICKER, TWO SOURCES ───
 * The messages being forwarded come either from a chat conversation or from a
 * project thread (`sourceScope`). The DESTINATION is always a chat
 * conversation either way — the server's FORWARD_DESTINATIONS table is what
 * decides that, and this component only has to render what it allows:
 *
 *   from chat     -> any conversation you're in, groups and DMs alike
 *   from project  -> GROUPS ONLY
 *
 * The groups-only rule for project messages is enforced server-side too
 * (chatThread.forwardDestinationGate). Filtering here is so the user is never
 * offered a destination that would be refused, not a substitute for the check.
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
  sourceScope = messagingApi.SCOPES.CHAT,
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

  // Destinations, when the caller has no list of its own to hand us. ChatPage
  // already loads every conversation for its sidebar, so it passes them in;
  // the two project surfaces have no reason to know about chat conversations
  // at all, so the picker fetches its own.
  const [loaded, setLoaded] = useState(null);
  const [loading, setLoading] = useState(false);
  const [loadError, setLoadError] = useState(null);

  const fromProject = sourceScope === messagingApi.SCOPES.PROJECT;

  /**
   * One token per forward ATTEMPT-AND-ITS-RETRIES.
   *
   * The server derives each copy's clientMsgId from it, so pressing Forward
   * again after a failure returns the copies that already landed rather than
   * writing a second set. That case is not hypothetical: the request can
   * complete server-side after the client has given up on it, and the only
   * thing the user has seen is an error — so of course they press it again.
   *
   * Held in a ref, not state, because it must survive the re-render that
   * showing the failure causes. Cleared when the modal closes, so the next
   * deliberate forward of the same messages is correctly treated as new.
   */
  const forwardTokenRef = useRef(null);

  const needsOwnList = !conversations;

  const load = useCallback(async () => {
    setLoading(true);
    setLoadError(null);
    try {
      setLoaded(await messagingApi.listThreads(messagingApi.SCOPES.CHAT));
    } catch (err) {
      // An empty roster and a roster that failed to arrive render identically
      // as "no conversations", so the error state is not optional here — see
      // the same reasoning on ChatPage's directory list.
      setLoadError(err?.message || "Could not load your conversations");
    } finally {
      setLoading(false);
    }
  }, []);

  // `loadError` is part of the guard, not decoration: without it a failed
  // fetch leaves loaded=null and loading=false, which is exactly the condition
  // that starts a fetch — so the effect re-fires the moment it re-renders and
  // spins. After a failure the only way back in is the Try again button, which
  // calls load() directly and clears the error itself.
  useEffect(() => {
    if (open && needsOwnList && loaded === null && !loading && !loadError) load();
  }, [open, needsOwnList, loaded, loading, loadError, load]);

  const available = conversations || loaded || [];

  const targets = useMemo(() => {
    const term = search.trim().toLowerCase();
    return available
      // Never offer the conversation the messages came from — forwarding a
      // message back into its own thread is always a mistake. (A project id
      // can never collide with a conversation id, so this is a no-op for a
      // project source, which is correct.)
      .filter((c) => String(c._id) !== String(sourceThreadId))
      // Project messages go to groups only. See the note at the top.
      .filter((c) => !fromProject || c.type === "group")
      .filter((c) => !term || (c.name || "").toLowerCase().includes(term));
  }, [available, sourceThreadId, search, fromProject]);

  if (!open) return null;

  const toggle = (id) =>
    setSelected((prev) =>
      prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]
    );

  // This component stays mounted while closed (`open` only gates the render),
  // so its state does not reset on its own — a previous failure would still be
  // on screen the next time it opened. Everything closes through here.
  const close = () => {
    forwardTokenRef.current = null;
    setResult(null);
    setSelected([]);
    setSearch("");
    onClose();
  };

  const send = async () => {
    if (!selected.length || sending) return;
    setSending(true);

    if (!forwardTokenRef.current) {
      forwardTokenRef.current = messagingApi.newForwardToken();
    }

    try {
      const res = await dispatch(
        forwardMessages({
          sourceScope,
          sourceThreadId,
          messageIds,
          destinationThreadIds: selected,
          forwardToken: forwardTokenRef.current,
        })
      ).unwrap();

      // Anything rejected is worth showing rather than closing over silently.
      if (res.failed?.length) {
        setResult(res);
      } else {
        onDone?.(res);
        close();
      }
    } catch (err) {
      setResult({ delivered: [], failed: [{ threadId: "", reason: err.message }] });
    } finally {
      setSending(false);
    }
  };

  // A retry reuses the token, so it can only ever fill in what didn't land.
  const retry = () => {
    setResult(null);
    send();
  };

  const nameOf = (id) =>
    available.find((c) => String(c._id) === String(id))?.name || "a conversation";

  const emptyMessage = fromProject
    ? "You're not in any group chats yet. Project messages can only be forwarded to groups."
    : "No other conversations";

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4 backdrop-blur-sm"
      role="dialog"
      aria-modal="true"
      aria-labelledby="forward-title"
    >
      <div className="flex max-h-[80vh] w-full max-w-md flex-col overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-xl dark:border-white/10 dark:bg-[#10131c]">
        <div className="flex items-start justify-between border-b border-slate-200 p-4 dark:border-white/10">
          <div className="flex items-start gap-2">
            <Forward className="mt-0.5 h-4 w-4 shrink-0 text-blue-600 dark:text-blue-400" />
            <div>
              <h3 id="forward-title" className="font-semibold text-slate-900 dark:text-white">
                Forward {messageIds.length} message{messageIds.length === 1 ? "" : "s"}
              </h3>
              {/* Says where these can go BEFORE anything is picked. Without it
                  the groups-only rule reads as missing conversations. */}
              {fromProject && (
                <p className="mt-0.5 flex items-center gap-1 text-xs text-slate-500 dark:text-slate-400">
                  <Users className="h-3 w-3" />
                  To a group chat — project messages can't go to direct messages
                </p>
              )}
            </div>
          </div>
          <button
            type="button"
            onClick={close}
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
                {/* A whole-request failure has no thread to name, so it
                    reads as the message alone rather than "a conversation —
                    Couldn't reach the server". */}
                {result.failed.map((f, i) => (
                  <li key={i}>
                    {f.threadId ? `${nameOf(f.threadId)} — ${f.reason}` : f.reason}
                  </li>
                ))}
              </ul>
            </div>
            <div className="flex gap-2">
              <button
                type="button"
                onClick={close}
                className="h-10 flex-1 rounded-lg border border-slate-200 text-sm font-semibold text-slate-700 hover:bg-slate-50 dark:border-white/10 dark:text-slate-200 dark:hover:bg-white/[0.05]"
              >
                Close
              </button>
              <button
                type="button"
                onClick={retry}
                disabled={sending}
                className="inline-flex h-10 flex-1 items-center justify-center gap-2 rounded-lg bg-blue-600 text-sm font-semibold text-white hover:bg-blue-700 disabled:cursor-not-allowed disabled:opacity-50"
              >
                {sending && <Loader2 className="h-4 w-4 animate-spin" />}
                {sending ? "Retrying…" : "Try again"}
              </button>
            </div>
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
                  placeholder={fromProject ? "Search group chats" : "Search conversations"}
                  className="w-full rounded-lg border border-slate-200 bg-white py-2 pl-9 pr-3 text-sm text-slate-900 placeholder-slate-400 dark:border-white/10 dark:bg-white/[0.03] dark:text-white"
                />
              </div>
            </div>

            <div className="flex-1 overflow-y-auto p-2">
              {loading ? (
                <p className="flex items-center justify-center gap-2 py-8 text-sm text-slate-400">
                  <Loader2 className="h-4 w-4 animate-spin" />
                  Loading conversations…
                </p>
              ) : loadError ? (
                <div className="space-y-3 px-3 py-8 text-center">
                  <AlertCircle className="mx-auto h-5 w-5 text-amber-500" />
                  <p className="text-sm text-slate-500 dark:text-slate-400">{loadError}</p>
                  <button
                    type="button"
                    onClick={load}
                    className="rounded-lg border border-slate-200 px-3 py-1.5 text-xs font-semibold text-slate-700 hover:bg-slate-50 dark:border-white/10 dark:text-slate-200 dark:hover:bg-white/[0.05]"
                  >
                    Try again
                  </button>
                </div>
              ) : targets.length === 0 ? (
                <p className="px-4 py-8 text-center text-sm text-slate-400">{emptyMessage}</p>
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
                      {/* Only worth distinguishing where both kinds appear. */}
                      {!fromProject && conv.type === "private" && (
                        <span className="ml-auto shrink-0 text-[10px] uppercase tracking-wide text-slate-400">
                          Direct
                        </span>
                      )}
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
  /** Where the messages are being taken FROM. Destinations are always chat. */
  sourceScope: PropTypes.oneOf(["chat", "project"]),
  sourceThreadId: PropTypes.string,
  messageIds: PropTypes.array,
  /** Optional. When omitted the picker loads chat conversations itself. */
  conversations: PropTypes.array,
  onDone: PropTypes.func,
};

export default ForwardMessagesModal;
