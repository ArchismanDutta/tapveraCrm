import React, { useState } from "react";
import PropTypes from "prop-types";
import { Trash2, X, Loader2, AlertTriangle, Users, User } from "lucide-react";
import * as messagingApi from "../../api/messagingApi";

/**
 * The WhatsApp-shaped delete dialog: "delete for me" or "delete for everyone".
 *
 * ─── WHY BOTH OPTIONS, AND WHY ONE IS CONDITIONAL ───
 * They are different claims. Hiding a message changes only your own view, so
 * it is offered on anything you can see, at any time, with no consequences for
 * anyone else. Retracting it reaches into a copy everyone already holds, so it
 * is the sender's alone and only inside the window — past that, people have
 * read it and acted on it, and un-saying it changes what was agreed rather
 * than fixing a slip.
 *
 * When the window has closed the option is not hidden but SHOWN DISABLED with
 * the reason. A control that silently disappears reads as a bug; one that
 * explains itself teaches the rule once.
 *
 * The server re-checks both rules on every request — this only decides what to
 * offer, because a client cannot be trusted to have hidden a button.
 */
const DeleteMessageModal = ({ open, onClose, scope, message, currentUserId, onDeleted, accent = "blue" }) => {
  const [busy, setBusy] = useState(null); // 'me' | 'everyone'
  const [error, setError] = useState(null);

  if (!open || !message) return null;

  const messageId = String(message.messageId || message._id || message.id || "");
  const isMine =
    String(message.sender?.id ?? message.senderId ?? message.sentBy?._id ?? message.sentBy ?? "") ===
    String(currentUserId);
  const canEveryone = messagingApi.canDeleteForEveryone(message, currentUserId);

  const a = accent === "teal" ? "bg-teal-600 hover:bg-teal-700" : "bg-blue-600 hover:bg-blue-700";

  const run = async (mode) => {
    if (busy) return;
    setBusy(mode);
    setError(null);
    try {
      await messagingApi.deleteMessage(scope, messageId, mode);
      onDeleted?.(messageId, mode);
      onClose();
    } catch (err) {
      setError(err.message || "Could not delete that message.");
    } finally {
      setBusy(null);
    }
  };

  return (
    <div
      className="fixed inset-0 z-[60] flex items-center justify-center bg-black/40 p-4 backdrop-blur-sm"
      role="dialog"
      aria-modal="true"
      aria-labelledby="delete-message-title"
    >
      <div className="w-full max-w-sm overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-xl dark:border-white/10 dark:bg-[#10131c]">
        <div className="flex items-start justify-between gap-3 border-b border-slate-200 p-4 dark:border-white/10">
          <div className="flex items-center gap-2">
            <Trash2 className="h-4 w-4 text-rose-600 dark:text-rose-400" />
            <h3 id="delete-message-title" className="font-semibold text-slate-900 dark:text-white">
              Delete message
            </h3>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close"
            className="rounded-lg p-1.5 text-slate-400 hover:bg-slate-100 dark:hover:bg-white/[0.05]"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        <div className="space-y-2 p-4">
          {error && (
            <p className="flex items-start gap-2 rounded-lg border border-amber-200 bg-amber-50 p-2.5 text-sm text-amber-800 dark:border-amber-400/20 dark:bg-amber-400/10 dark:text-amber-200">
              <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" />
              {error}
            </p>
          )}

          <button
            type="button"
            onClick={() => run("me")}
            disabled={Boolean(busy)}
            className="flex w-full items-start gap-3 rounded-lg border border-slate-200 p-3 text-left transition hover:bg-slate-50 disabled:opacity-50 dark:border-white/10 dark:hover:bg-white/[0.04]"
          >
            <User className="mt-0.5 h-4 w-4 shrink-0 text-slate-400" />
            <span className="min-w-0">
              <span className="flex items-center gap-2 text-sm font-semibold text-slate-900 dark:text-white">
                Delete for me
                {busy === "me" && <Loader2 className="h-3.5 w-3.5 animate-spin" />}
              </span>
              <span className="mt-0.5 block text-xs text-slate-500 dark:text-slate-400">
                Removes it from your view only. Everyone else still sees it.
              </span>
            </span>
          </button>

          {isMine && (
            <button
              type="button"
              onClick={() => run("everyone")}
              disabled={Boolean(busy) || !canEveryone}
              className="flex w-full items-start gap-3 rounded-lg border border-slate-200 p-3 text-left transition hover:bg-rose-50 disabled:cursor-not-allowed disabled:opacity-60 disabled:hover:bg-transparent dark:border-white/10 dark:hover:bg-rose-500/10"
            >
              <Users className="mt-0.5 h-4 w-4 shrink-0 text-slate-400" />
              <span className="min-w-0">
                <span className="flex items-center gap-2 text-sm font-semibold text-rose-700 dark:text-rose-300">
                  Delete for everyone
                  {busy === "everyone" && <Loader2 className="h-3.5 w-3.5 animate-spin" />}
                </span>
                <span className="mt-0.5 block text-xs text-slate-500 dark:text-slate-400">
                  {canEveryone
                    ? "Removes the text and any files for everyone in this conversation. They'll see that a message was deleted."
                    : "No longer available — messages can only be deleted for everyone within 7 minutes of sending."}
                </span>
              </span>
            </button>
          )}
        </div>

        <div className="border-t border-slate-200 p-3 dark:border-white/10">
          <button
            type="button"
            onClick={onClose}
            disabled={Boolean(busy)}
            className={`h-10 w-full rounded-lg text-sm font-semibold text-white transition disabled:opacity-50 ${a}`}
          >
            Cancel
          </button>
        </div>
      </div>
    </div>
  );
};

DeleteMessageModal.propTypes = {
  open: PropTypes.bool,
  onClose: PropTypes.func.isRequired,
  scope: PropTypes.oneOf(["chat", "project"]).isRequired,
  /** The message row, in whichever shape the surface renders. */
  message: PropTypes.object,
  currentUserId: PropTypes.string,
  /** Called with (messageId, mode) after a successful delete. */
  onDeleted: PropTypes.func,
  accent: PropTypes.oneOf(["blue", "teal"]),
};

export default DeleteMessageModal;
