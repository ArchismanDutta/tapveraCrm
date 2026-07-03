import React, { useState } from "react";
import { Send } from "lucide-react";
import API from "../../api";

export default function NoticeForm({ onPublish }) {
  const [message, setMessage] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [feedback, setFeedback] = useState(null);

  const handleSubmit = async (event) => {
    event.preventDefault();
    const trimmedMessage = message.trim();
    if (!trimmedMessage) return;

    try {
      setSubmitting(true);
      setFeedback(null);
      await API.post("/api/notices", { message: trimmedMessage });
      await onPublish?.();
      setMessage("");
      setFeedback({ type: "success", message: "Notice published successfully." });
    } catch (error) {
      console.error("publishNotice error:", error);
      setFeedback({
        type: "error",
        message: "The notice could not be published. Please try again.",
      });
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <section className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm dark:border-white/10 dark:bg-[#10131c] sm:p-5">
      <div>
        <h2 className="text-base font-semibold text-slate-950 dark:text-white">
          Publish a notice
        </h2>
        <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">
          This message will be shown to all employees while it remains active.
        </p>
      </div>

      <form onSubmit={handleSubmit} className="mt-4">
        <label className="block">
          <span className="sr-only">Notice message</span>
          <textarea
            className="min-h-28 w-full resize-y rounded-xl border border-slate-200 bg-slate-50 p-3 text-sm leading-6 text-slate-900 outline-none transition placeholder:text-slate-400 focus:border-blue-500 focus:bg-white focus:ring-2 focus:ring-blue-500/15 dark:border-white/10 dark:bg-white/[0.035] dark:text-white dark:focus:bg-white/[0.05]"
            rows={4}
            maxLength={1000}
            placeholder="Write an announcement for the team..."
            value={message}
            onChange={(event) => {
              setMessage(event.target.value);
              if (feedback) setFeedback(null);
            }}
            required
          />
        </label>

        <div className="mt-3 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex items-center gap-3">
            <span className="text-xs text-slate-400">{message.length}/1000</span>
            {feedback && (
              <span
                className={`text-xs ${
                  feedback.type === "success"
                    ? "text-emerald-600 dark:text-emerald-300"
                    : "text-rose-600 dark:text-rose-300"
                }`}
              >
                {feedback.message}
              </span>
            )}
          </div>
          <button
            type="submit"
            disabled={submitting || !message.trim()}
            className="inline-flex h-10 items-center justify-center gap-2 rounded-lg bg-blue-600 px-4 text-sm font-semibold text-white transition hover:bg-blue-700 disabled:cursor-not-allowed disabled:opacity-50"
          >
            {submitting ? (
              <span className="h-4 w-4 animate-spin rounded-full border-2 border-white/30 border-t-white" />
            ) : (
              <Send className="h-4 w-4" />
            )}
            {submitting ? "Publishing..." : "Publish notice"}
          </button>
        </div>
      </form>
    </section>
  );
}
