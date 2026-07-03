import React, { useEffect, useState } from "react";
import {
  AlertCircle,
  CalendarDays,
  Check,
  Clock3,
  LoaderCircle,
  X,
} from "lucide-react";

const toDateInputValue = (value) => {
  const date = value ? new Date(value) : new Date();
  if (Number.isNaN(date.getTime())) return "";

  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
};

const priorities = [
  {
    value: "High",
    label: "High",
    active:
      "border-rose-300 bg-rose-50 text-rose-700 dark:border-rose-400/30 dark:bg-rose-400/10 dark:text-rose-200",
  },
  {
    value: "Medium",
    label: "Medium",
    active:
      "border-amber-300 bg-amber-50 text-amber-700 dark:border-amber-400/30 dark:bg-amber-400/10 dark:text-amber-200",
  },
  {
    value: "Low",
    label: "Low",
    active:
      "border-emerald-300 bg-emerald-50 text-emerald-700 dark:border-emerald-400/30 dark:bg-emerald-400/10 dark:text-emerald-200",
  },
];

const TaskForm = ({ task, onSave, onClose, loading = false }) => {
  const [title, setTitle] = useState(task?.title || task?.text || "");
  const [label, setLabel] = useState(task?.label || task?.priority || "Medium");
  const [date, setDate] = useState(toDateInputValue(task?.date));
  const [time, setTime] = useState(task?.time || "");
  const [description, setDescription] = useState(task?.description || "");
  const [submitError, setSubmitError] = useState("");

  useEffect(() => {
    setTitle(task?.title || task?.text || "");
    setLabel(task?.label || task?.priority || "Medium");
    setDate(toDateInputValue(task?.date));
    setTime(task?.time || "");
    setDescription(task?.description || "");
    setSubmitError("");
  }, [task]);

  useEffect(() => {
    const handleKeyDown = (event) => {
      if (event.key === "Escape" && !loading) onClose();
    };

    const originalOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    window.addEventListener("keydown", handleKeyDown);

    return () => {
      document.body.style.overflow = originalOverflow;
      window.removeEventListener("keydown", handleKeyDown);
    };
  }, [loading, onClose]);

  const handleSubmit = async (event) => {
    event.preventDefault();
    setSubmitError("");

    if (!title.trim()) {
      setSubmitError("Add a short title so the task is easy to identify.");
      return;
    }

    if (!date) {
      setSubmitError("Choose a date for this task.");
      return;
    }

    try {
      await onSave({
        ...task,
        title: title.trim(),
        label,
        time,
        description: description.trim(),
        date: new Date(`${date}T00:00:00`).toISOString(),
      });
    } catch {
      setSubmitError("The task could not be saved. Please try again.");
    }
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center overflow-y-auto bg-slate-950/65 p-3 backdrop-blur-sm sm:p-4"
      role="dialog"
      aria-modal="true"
      aria-labelledby="task-form-title"
      onMouseDown={(event) => {
        if (event.target === event.currentTarget && !loading) onClose();
      }}
    >
      <form
        onSubmit={handleSubmit}
        className="my-auto w-full max-w-xl overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-2xl dark:border-white/10 dark:bg-[#10131c]"
      >
        <div className="flex items-start justify-between gap-4 border-b border-slate-200 px-4 py-4 dark:border-white/10 sm:px-5">
          <div>
            <p className="text-xs font-semibold uppercase tracking-wider text-blue-600 dark:text-blue-300">
              {task ? "Update task" : "New task"}
            </p>
            <h2
              id="task-form-title"
              className="mt-1 text-lg font-semibold text-slate-950 dark:text-white"
            >
              {task ? "Edit task details" : "Add to your plan"}
            </h2>
            <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">
              Keep the title clear and choose when you plan to work on it.
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            disabled={loading}
            className="inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-lg border border-slate-200 bg-white text-slate-500 transition hover:bg-slate-50 hover:text-slate-800 disabled:opacity-50 dark:border-white/10 dark:bg-white/[0.04] dark:text-slate-300 dark:hover:bg-white/[0.07] dark:hover:text-white"
            aria-label="Close task form"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        <div className="space-y-5 p-4 sm:p-5">
          {submitError && (
            <div className="flex items-start gap-2 rounded-lg border border-rose-200 bg-rose-50 px-3 py-2.5 text-sm text-rose-700 dark:border-rose-400/20 dark:bg-rose-400/10 dark:text-rose-200">
              <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" />
              {submitError}
            </div>
          )}

          <label className="block">
            <span className="mb-1.5 block text-xs font-semibold text-slate-700 dark:text-slate-300">
              Task title <span className="text-rose-500">*</span>
            </span>
            <input
              type="text"
              placeholder="What needs to be done?"
              autoFocus
              value={title}
              onChange={(event) => setTitle(event.target.value)}
              disabled={loading}
              maxLength={140}
              className="h-11 w-full rounded-lg border border-slate-200 bg-white px-3 text-sm text-slate-900 outline-none transition placeholder:text-slate-400 focus:border-blue-400 focus:ring-2 focus:ring-blue-100 disabled:opacity-60 dark:border-white/10 dark:bg-white/[0.04] dark:text-white dark:focus:border-blue-400/40 dark:focus:ring-blue-400/10"
            />
            <span className="mt-1 block text-right text-[10px] text-slate-400">
              {title.length}/140
            </span>
          </label>

          <fieldset>
            <legend className="mb-2 text-xs font-semibold text-slate-700 dark:text-slate-300">
              Priority
            </legend>
            <div className="grid grid-cols-3 gap-2">
              {priorities.map((priority) => (
                <button
                  key={priority.value}
                  type="button"
                  onClick={() => setLabel(priority.value)}
                  disabled={loading}
                  aria-pressed={label === priority.value}
                  className={`inline-flex h-10 items-center justify-center gap-2 rounded-lg border text-xs font-semibold transition disabled:opacity-60 ${
                    label === priority.value
                      ? priority.active
                      : "border-slate-200 bg-white text-slate-500 hover:bg-slate-50 dark:border-white/10 dark:bg-white/[0.03] dark:text-slate-400 dark:hover:bg-white/[0.06]"
                  }`}
                >
                  {label === priority.value && <Check className="h-3.5 w-3.5" />}
                  {priority.label}
                </button>
              ))}
            </div>
          </fieldset>

          <div className="grid gap-4 sm:grid-cols-2">
            <label className="block">
              <span className="mb-1.5 flex items-center gap-2 text-xs font-semibold text-slate-700 dark:text-slate-300">
                <CalendarDays className="h-3.5 w-3.5 text-slate-400" />
                Scheduled date <span className="text-rose-500">*</span>
              </span>
              <input
                type="date"
                value={date}
                onChange={(event) => setDate(event.target.value)}
                disabled={loading}
                required
                className="h-11 w-full rounded-lg border border-slate-200 bg-white px-3 text-sm text-slate-700 outline-none transition focus:border-blue-400 focus:ring-2 focus:ring-blue-100 disabled:opacity-60 dark:border-white/10 dark:bg-[#151923] dark:text-slate-200 dark:focus:border-blue-400/40 dark:focus:ring-blue-400/10"
              />
            </label>

            <label className="block">
              <span className="mb-1.5 flex items-center gap-2 text-xs font-semibold text-slate-700 dark:text-slate-300">
                <Clock3 className="h-3.5 w-3.5 text-slate-400" />
                Due time <span className="font-normal text-slate-400">(optional)</span>
              </span>
              <input
                type="time"
                value={time}
                onChange={(event) => setTime(event.target.value)}
                disabled={loading}
                className="h-11 w-full rounded-lg border border-slate-200 bg-white px-3 text-sm text-slate-700 outline-none transition focus:border-blue-400 focus:ring-2 focus:ring-blue-100 disabled:opacity-60 dark:border-white/10 dark:bg-[#151923] dark:text-slate-200 dark:focus:border-blue-400/40 dark:focus:ring-blue-400/10"
              />
            </label>
          </div>

          <label className="block">
            <span className="mb-1.5 block text-xs font-semibold text-slate-700 dark:text-slate-300">
              Notes <span className="font-normal text-slate-400">(optional)</span>
            </span>
            <textarea
              rows={4}
              placeholder="Add context, links, or the next action..."
              value={description}
              onChange={(event) => setDescription(event.target.value)}
              disabled={loading}
              maxLength={500}
              className="w-full resize-none rounded-lg border border-slate-200 bg-white px-3 py-2.5 text-sm leading-5 text-slate-900 outline-none transition placeholder:text-slate-400 focus:border-blue-400 focus:ring-2 focus:ring-blue-100 disabled:opacity-60 dark:border-white/10 dark:bg-white/[0.04] dark:text-white dark:focus:border-blue-400/40 dark:focus:ring-blue-400/10"
            />
            <span className="mt-1 block text-right text-[10px] text-slate-400">
              {description.length}/500
            </span>
          </label>
        </div>

        <div className="flex flex-col-reverse gap-2 border-t border-slate-200 bg-slate-50 px-4 py-3 dark:border-white/10 dark:bg-white/[0.02] sm:flex-row sm:justify-end sm:px-5">
          <button
            type="button"
            onClick={onClose}
            disabled={loading}
            className="inline-flex h-10 items-center justify-center rounded-lg border border-slate-200 bg-white px-4 text-sm font-semibold text-slate-600 transition hover:bg-slate-100 disabled:opacity-50 dark:border-white/10 dark:bg-white/[0.04] dark:text-slate-300 dark:hover:bg-white/[0.07]"
          >
            Cancel
          </button>
          <button
            type="submit"
            disabled={loading}
            className="inline-flex h-10 items-center justify-center gap-2 rounded-lg bg-blue-600 px-5 text-sm font-semibold text-white transition hover:bg-blue-700 disabled:cursor-not-allowed disabled:opacity-60 dark:bg-blue-500 dark:hover:bg-blue-400"
          >
            {loading ? (
              <LoaderCircle className="h-4 w-4 animate-spin" />
            ) : (
              <Check className="h-4 w-4" />
            )}
            {loading ? "Saving..." : task ? "Save changes" : "Add task"}
          </button>
        </div>
      </form>
    </div>
  );
};

export default TaskForm;
