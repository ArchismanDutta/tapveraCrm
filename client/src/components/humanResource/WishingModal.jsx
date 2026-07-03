import React, { useEffect, useState } from "react";
import { AlertCircle, Award, Cake, LoaderCircle, Send, X } from "lucide-react";

const TEMPLATES = {
  birthday: [
    "Happy birthday, [name]! Wishing you a wonderful day and a brilliant year ahead.",
    "Many happy returns, [name]! We hope you enjoy your special day.",
  ],
  anniversary: [
    "Happy work anniversary, [name]! Thank you for your dedication and contribution.",
    "Congratulations on your work milestone, [name]. We’re glad to have you on the team.",
  ],
};

const WishingModal = ({
  isOpen,
  onClose,
  birthdays = [],
  anniversaries = [],
  defaultType = "birthday",
  onSend,
}) => {
  const [selectedUsers, setSelectedUsers] = useState([]);
  const [messageType, setMessageType] = useState(defaultType);
  const [message, setMessage] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    if (!isOpen) return;
    setMessageType(defaultType);
    setSelectedUsers([]);
    setMessage("");
    setError("");
  }, [defaultType, isOpen]);

  useEffect(() => {
    if (!isOpen) return undefined;

    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    const handleKeyDown = (event) => {
      if (event.key === "Escape" && !submitting) onClose();
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => {
      document.body.style.overflow = previousOverflow;
      window.removeEventListener("keydown", handleKeyDown);
    };
  }, [isOpen, onClose, submitting]);

  if (!isOpen) return null;

  const options = messageType === "birthday" ? birthdays : anniversaries;

  const changeType = (type) => {
    setMessageType(type);
    setSelectedUsers([]);
    setMessage("");
    setError("");
  };

  const toggleUser = (user) => {
    setSelectedUsers((current) =>
      current.some((selected) => selected._id === user._id)
        ? current.filter((selected) => selected._id !== user._id)
        : [...current, user],
    );
  };

  const handleSend = async () => {
    if (selectedUsers.length === 0 || !message.trim()) {
      setError("Select at least one person and add a message.");
      return;
    }

    try {
      setSubmitting(true);
      setError("");
      await onSend(selectedUsers, message.trim(), messageType);
      onClose();
    } catch (requestError) {
      console.error("Unable to send wishes:", requestError);
      setError(
        requestError.response?.data?.message ||
          "The message could not be sent. Please try again.",
      );
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/70 p-3 backdrop-blur-sm sm:p-6"
      onMouseDown={(event) => {
        if (event.target === event.currentTarget && !submitting) onClose();
      }}
    >
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="wishing-modal-title"
        className="flex max-h-[92vh] w-full max-w-2xl flex-col overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-2xl dark:border-slate-700 dark:bg-slate-900"
      >
        <header className="flex items-start justify-between gap-4 border-b border-slate-200 px-5 py-4 dark:border-slate-800 sm:px-6">
          <div>
            <h2
              id="wishing-modal-title"
              className="text-lg font-semibold text-slate-900 dark:text-white"
            >
              Send a team wish
            </h2>
            <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">
              Choose people, personalise the message, and send it from HR.
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            disabled={submitting}
            aria-label="Close wishing dialog"
            className="rounded-lg p-2 text-slate-400 transition hover:bg-slate-100 hover:text-slate-700 disabled:opacity-50 dark:hover:bg-slate-800 dark:hover:text-slate-200"
          >
            <X className="h-5 w-5" />
          </button>
        </header>

        <div className="flex-1 space-y-5 overflow-y-auto p-5 sm:p-6">
          {error && (
            <div className="flex items-start gap-2 rounded-xl border border-rose-200 bg-rose-50 p-3 text-sm text-rose-700 dark:border-rose-900/60 dark:bg-rose-950/30 dark:text-rose-200">
              <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" />
              {error}
            </div>
          )}

          <section>
            <h3 className="text-xs font-semibold uppercase tracking-wider text-slate-500 dark:text-slate-400">
              Occasion
            </h3>
            <div className="mt-2 grid grid-cols-2 gap-2">
              <button
                type="button"
                aria-pressed={messageType === "birthday"}
                onClick={() => changeType("birthday")}
                className={`flex items-center justify-center gap-2 rounded-xl border px-3 py-2.5 text-sm font-semibold transition ${
                  messageType === "birthday"
                    ? "border-pink-500 bg-pink-500 text-white"
                    : "border-slate-200 text-slate-600 hover:bg-slate-50 dark:border-slate-700 dark:text-slate-300 dark:hover:bg-slate-800"
                }`}
              >
                <Cake className="h-4 w-4" />
                Birthday
              </button>
              <button
                type="button"
                aria-pressed={messageType === "anniversary"}
                onClick={() => changeType("anniversary")}
                className={`flex items-center justify-center gap-2 rounded-xl border px-3 py-2.5 text-sm font-semibold transition ${
                  messageType === "anniversary"
                    ? "border-amber-500 bg-amber-500 text-white"
                    : "border-slate-200 text-slate-600 hover:bg-slate-50 dark:border-slate-700 dark:text-slate-300 dark:hover:bg-slate-800"
                }`}
              >
                <Award className="h-4 w-4" />
                Anniversary
              </button>
            </div>
          </section>

          <section>
            <div className="flex items-center justify-between gap-3">
              <h3 className="text-sm font-semibold text-slate-900 dark:text-white">
                Recipients
              </h3>
              <span className="text-xs text-slate-500 dark:text-slate-400">
                {selectedUsers.length} selected
              </span>
            </div>
            <div className="mt-2 max-h-48 space-y-2 overflow-y-auto rounded-xl border border-slate-200 p-2 dark:border-slate-700">
              {options.length === 0 ? (
                <p className="px-3 py-8 text-center text-sm text-slate-500 dark:text-slate-400">
                  No people available for this occasion.
                </p>
              ) : (
                options.map((user) => {
                  const checked = selectedUsers.some(
                    (selected) => selected._id === user._id,
                  );
                  return (
                    <label
                      key={user._id}
                      className={`flex cursor-pointer items-center gap-3 rounded-lg border p-3 transition ${
                        checked
                          ? "border-blue-300 bg-blue-50 dark:border-blue-700 dark:bg-blue-950/30"
                          : "border-transparent hover:bg-slate-50 dark:hover:bg-slate-800"
                      }`}
                    >
                      <input
                        type="checkbox"
                        checked={checked}
                        onChange={() => toggleUser(user)}
                        className="h-4 w-4 rounded border-slate-300 text-blue-600 focus:ring-blue-500"
                      />
                      <span className="flex h-8 w-8 items-center justify-center rounded-full bg-gradient-to-br from-blue-500 to-indigo-600 text-xs font-semibold text-white">
                        {user.name?.trim()?.charAt(0)?.toUpperCase() || "?"}
                      </span>
                      <span className="min-w-0 flex-1">
                        <span className="block truncate text-sm font-medium text-slate-800 dark:text-slate-100">
                          {user.name}
                        </span>
                        <span className="block truncate text-xs capitalize text-slate-500 dark:text-slate-400">
                          {user.role || user.designation || "Employee"}
                        </span>
                      </span>
                    </label>
                  );
                })
              )}
            </div>
          </section>

          <section>
            <h3 className="text-sm font-semibold text-slate-900 dark:text-white">
              Start with a template
            </h3>
            <div className="mt-2 grid gap-2">
              {TEMPLATES[messageType].map((template) => (
                <button
                  key={template}
                  type="button"
                  onClick={() => setMessage(template)}
                  className="rounded-xl border border-slate-200 p-3 text-left text-xs leading-5 text-slate-600 transition hover:border-blue-300 hover:bg-blue-50 dark:border-slate-700 dark:text-slate-300 dark:hover:border-blue-700 dark:hover:bg-blue-950/30"
                >
                  {template}
                </button>
              ))}
            </div>
          </section>

          <label className="block">
            <span className="text-sm font-semibold text-slate-900 dark:text-white">
              Message
            </span>
            <textarea
              rows={4}
              maxLength={500}
              value={message}
              onChange={(event) => setMessage(event.target.value)}
              placeholder="Write a warm message…"
              className="mt-2 w-full resize-none rounded-xl border border-slate-300 bg-white px-3 py-2.5 text-sm text-slate-800 outline-none transition placeholder:text-slate-400 focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20 dark:border-slate-700 dark:bg-slate-950 dark:text-slate-100"
            />
            <span className="mt-1 block text-right text-xs text-slate-400">
              {message.length}/500
            </span>
          </label>
        </div>

        <footer className="flex gap-3 border-t border-slate-200 bg-slate-50 px-5 py-4 dark:border-slate-800 dark:bg-slate-950/50 sm:justify-end sm:px-6">
          <button
            type="button"
            onClick={onClose}
            disabled={submitting}
            className="flex-1 rounded-lg border border-slate-300 bg-white px-4 py-2.5 text-sm font-semibold text-slate-700 transition hover:bg-slate-100 disabled:opacity-50 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-200 dark:hover:bg-slate-800 sm:flex-none"
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={handleSend}
            disabled={submitting || options.length === 0}
            className="inline-flex flex-1 items-center justify-center gap-2 rounded-lg bg-blue-600 px-4 py-2.5 text-sm font-semibold text-white transition hover:bg-blue-700 disabled:cursor-not-allowed disabled:opacity-60 sm:flex-none"
          >
            {submitting ? (
              <LoaderCircle className="h-4 w-4 animate-spin" />
            ) : (
              <Send className="h-4 w-4" />
            )}
            {submitting ? "Sending…" : "Send wish"}
          </button>
        </footer>
      </div>
    </div>
  );
};

export default WishingModal;
