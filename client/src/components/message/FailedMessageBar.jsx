import React from "react";
import { useSelector, useDispatch } from "react-redux";
import { AlertTriangle, RotateCw, X } from "lucide-react";
import { selectPending, discardOptimistic } from "../../store/slices/threadsSlice";
import { drainOutbox, discard as discardFromOutbox } from "../../utils/outboxDrain";

/**
 * Strip above the composer showing messages that failed to send (S2).
 *
 * ─── WHY THIS EXISTS AT ALL ───
 * The outbox retries automatically on reconnect, on `online` and on tab focus,
 * so most failures resolve without the user doing anything. This is for the
 * ones that don't: a permanent 4xx, or a network that stays down.
 *
 * Without it, a failed message would sit in the thread greyed out with no way
 * to act on it — and the text the user typed would be trapped in a bubble they
 * can't retry or recover. Discard is explicit and manual precisely because
 * silently dropping someone's message is the worst thing this subsystem can do.
 *
 * Renders nothing while everything is merely in flight — a "sending" spinner on
 * the bubble is enough, and a banner for the normal case would be noise.
 */
export default function FailedMessageBar({ scope, threadId }) {
  const dispatch = useDispatch();
  const pending = useSelector(selectPending(scope, threadId));

  const failed = pending.filter((m) => m.status === "failed");
  const queued = pending.filter((m) => m.status === "sending");

  if (failed.length === 0 && queued.length === 0) return null;

  // Nothing has failed — just note that things are on their way out. This is
  // the offline case: messages are safely queued and will send on reconnect.
  if (failed.length === 0) {
    return (
      <div className="flex items-center gap-2 border-t border-slate-200 bg-slate-50 px-4 py-1.5 text-xs text-slate-600 dark:border-white/10 dark:bg-white/[0.03] dark:text-slate-400">
        <RotateCw className="h-3.5 w-3.5 animate-spin" />
        {queued.length === 1
          ? "Sending…"
          : `Sending ${queued.length} messages…`}
      </div>
    );
  }

  const retryAll = () => drainOutbox();

  const discardOne = async (clientMsgId) => {
    await discardFromOutbox(clientMsgId);
    dispatch(discardOptimistic({ scope, threadId, clientMsgId }));
  };

  return (
    <div className="border-t border-amber-200 bg-amber-50 px-4 py-2 dark:border-amber-500/30 dark:bg-amber-500/10">
      <div className="flex items-center justify-between gap-3">
        <div className="flex min-w-0 items-center gap-2 text-xs text-amber-900 dark:text-amber-200">
          <AlertTriangle className="h-4 w-4 flex-shrink-0" />
          <span className="truncate">
            {failed.length === 1
              ? "A message didn't send."
              : `${failed.length} messages didn't send.`}{" "}
            {failed[0]?.sendError ? (
              <span className="opacity-75">{failed[0].sendError}</span>
            ) : null}
          </span>
        </div>

        <div className="flex flex-shrink-0 items-center gap-1.5">
          <button
            onClick={retryAll}
            className="flex items-center gap-1.5 rounded-md bg-amber-600 px-2.5 py-1 text-xs font-medium text-white transition hover:bg-amber-500"
          >
            <RotateCw className="h-3 w-3" />
            Retry
          </button>
          {failed.map((m) => (
            <button
              key={m.clientMsgId}
              onClick={() => discardOne(m.clientMsgId)}
              className="rounded-md p-1 text-amber-800 transition hover:bg-amber-100 dark:text-amber-300 dark:hover:bg-white/10"
              title={`Discard: "${(m.body || "").slice(0, 40)}"`}
            >
              <X className="h-3.5 w-3.5" />
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}
