import React, { useEffect, useState } from "react";
import {
  AlertCircle,
  Check,
  FileSpreadsheet,
  Link2,
  LoaderCircle,
  Tags,
  X,
} from "lucide-react";

const emptyForm = {
  name: "",
  description: "",
  originalUrl: "",
  category: "",
  tags: "",
};

const inputClass =
  "w-full rounded-lg border border-slate-200 bg-white px-3 text-sm text-slate-900 outline-none transition placeholder:text-slate-400 focus:border-blue-400 focus:ring-2 focus:ring-blue-100 disabled:cursor-not-allowed disabled:opacity-60 dark:border-white/10 dark:bg-white/[0.04] dark:text-white dark:focus:border-blue-400/40 dark:focus:ring-blue-400/10";

const SheetFormModal = ({ sheet, onClose, onSubmit }) => {
  const editing = Boolean(sheet);
  const [form, setForm] = useState(emptyForm);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    setForm(
      sheet
        ? {
            name: sheet.name || "",
            description: sheet.description || "",
            originalUrl: sheet.originalUrl || "",
            category: sheet.category || "",
            tags: Array.isArray(sheet.tags) ? sheet.tags.join(", ") : "",
          }
        : emptyForm
    );
    setError("");
  }, [sheet]);

  useEffect(() => {
    const handleKeyDown = (event) => {
      if (event.key === "Escape" && !saving) onClose();
    };

    const originalOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    window.addEventListener("keydown", handleKeyDown);

    return () => {
      document.body.style.overflow = originalOverflow;
      window.removeEventListener("keydown", handleKeyDown);
    };
  }, [onClose, saving]);

  const setField = (field, value) => {
    setForm((current) => ({ ...current, [field]: value }));
    if (error) setError("");
  };

  const handleSubmit = async (event) => {
    event.preventDefault();
    setError("");

    if (!form.name.trim()) {
      setError("Add a name for this sheet.");
      return;
    }

    try {
      new URL(form.originalUrl);
    } catch {
      setError("Enter a valid Google Sheets or Excel Online URL.");
      return;
    }

    try {
      setSaving(true);
      await onSubmit({
        name: form.name.trim(),
        description: form.description.trim(),
        originalUrl: form.originalUrl.trim(),
        category: form.category.trim(),
        tags: form.tags
          .split(",")
          .map((tag) => tag.trim())
          .filter(Boolean),
      });
    } catch (submitError) {
      setError(
        submitError.response?.data?.message ||
          `The sheet could not be ${editing ? "updated" : "added"}. Please try again.`
      );
    } finally {
      setSaving(false);
    }
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center overflow-y-auto bg-slate-950/65 p-3 backdrop-blur-sm sm:p-4"
      role="dialog"
      aria-modal="true"
      aria-labelledby="sheet-form-title"
      onMouseDown={(event) => {
        if (event.target === event.currentTarget && !saving) onClose();
      }}
    >
      <form
        onSubmit={handleSubmit}
        className="my-auto w-full max-w-2xl overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-2xl dark:border-white/10 dark:bg-[#10131c]"
      >
        <div className="flex items-start justify-between gap-4 border-b border-slate-200 px-4 py-4 dark:border-white/10 sm:px-5">
          <div className="flex items-start gap-3">
            <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg border border-blue-200 bg-blue-50 text-blue-700 dark:border-blue-400/20 dark:bg-blue-400/10 dark:text-blue-200">
              <FileSpreadsheet className="h-4 w-4" />
            </span>
            <div>
              <p className="text-xs font-semibold uppercase tracking-wider text-blue-600 dark:text-blue-300">
                {editing ? "Update resource" : "Shared resource"}
              </p>
              <h2
                id="sheet-form-title"
                className="mt-1 text-lg font-semibold text-slate-950 dark:text-white"
              >
                {editing ? "Edit sheet" : "Add a sheet"}
              </h2>
              <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">
                Link a Google Sheet or Excel Online workbook to the CRM.
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            disabled={saving}
            className="inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-lg border border-slate-200 bg-white text-slate-500 transition hover:bg-slate-50 hover:text-slate-800 disabled:opacity-50 dark:border-white/10 dark:bg-white/[0.04] dark:text-slate-300 dark:hover:bg-white/[0.07] dark:hover:text-white"
            aria-label="Close sheet form"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        <div className="space-y-4 p-4 sm:p-5">
          {error && (
            <div className="flex items-start gap-2 rounded-lg border border-rose-200 bg-rose-50 px-3 py-2.5 text-sm text-rose-700 dark:border-rose-400/20 dark:bg-rose-400/10 dark:text-rose-200">
              <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" />
              {error}
            </div>
          )}

          <label className="block">
            <span className="mb-1.5 block text-xs font-semibold text-slate-700 dark:text-slate-300">
              Sheet name <span className="text-rose-500">*</span>
            </span>
            <input
              type="text"
              value={form.name}
              onChange={(event) => setField("name", event.target.value)}
              placeholder="For example: Sales performance dashboard"
              maxLength={120}
              disabled={saving}
              autoFocus
              className={`${inputClass} h-11`}
            />
          </label>

          <label className="block">
            <span className="mb-1.5 flex items-center gap-2 text-xs font-semibold text-slate-700 dark:text-slate-300">
              <Link2 className="h-3.5 w-3.5 text-slate-400" />
              Sheet URL <span className="text-rose-500">*</span>
            </span>
            <input
              type="url"
              value={form.originalUrl}
              onChange={(event) =>
                setField("originalUrl", event.target.value)
              }
              placeholder="Paste the Google Sheets or Excel Online link"
              disabled={saving}
              className={`${inputClass} h-11`}
            />
            <p className="mt-1.5 text-[11px] leading-4 text-slate-400">
              Ensure the source platform’s sharing settings allow the intended CRM users to open it.
            </p>
          </label>

          <label className="block">
            <span className="mb-1.5 block text-xs font-semibold text-slate-700 dark:text-slate-300">
              Description{" "}
              <span className="font-normal text-slate-400">(optional)</span>
            </span>
            <textarea
              value={form.description}
              onChange={(event) =>
                setField("description", event.target.value)
              }
              placeholder="Explain what this sheet tracks and when the team should use it."
              rows={4}
              maxLength={500}
              disabled={saving}
              className={`${inputClass} resize-none py-3 leading-5`}
            />
            <p className="mt-1 text-right text-[10px] text-slate-400">
              {form.description.length}/500
            </p>
          </label>

          <div className="grid gap-4 sm:grid-cols-2">
            <label className="block">
              <span className="mb-1.5 block text-xs font-semibold text-slate-700 dark:text-slate-300">
                Category{" "}
                <span className="font-normal text-slate-400">(optional)</span>
              </span>
              <input
                type="text"
                value={form.category}
                onChange={(event) =>
                  setField("category", event.target.value)
                }
                placeholder="Sales, Finance, Operations"
                maxLength={60}
                disabled={saving}
                className={`${inputClass} h-11`}
              />
            </label>

            <label className="block">
              <span className="mb-1.5 flex items-center gap-2 text-xs font-semibold text-slate-700 dark:text-slate-300">
                <Tags className="h-3.5 w-3.5 text-slate-400" />
                Tags{" "}
                <span className="font-normal text-slate-400">(optional)</span>
              </span>
              <input
                type="text"
                value={form.tags}
                onChange={(event) => setField("tags", event.target.value)}
                placeholder="monthly, reporting, targets"
                disabled={saving}
                className={`${inputClass} h-11`}
              />
              <p className="mt-1 text-[10px] text-slate-400">
                Separate tags with commas.
              </p>
            </label>
          </div>
        </div>

        <div className="flex flex-col-reverse gap-2 border-t border-slate-200 bg-slate-50 px-4 py-3 dark:border-white/10 dark:bg-white/[0.02] sm:flex-row sm:justify-end sm:px-5">
          <button
            type="button"
            onClick={onClose}
            disabled={saving}
            className="inline-flex h-10 items-center justify-center rounded-lg border border-slate-200 bg-white px-4 text-sm font-semibold text-slate-600 transition hover:bg-slate-100 disabled:opacity-50 dark:border-white/10 dark:bg-white/[0.04] dark:text-slate-300 dark:hover:bg-white/[0.07]"
          >
            Cancel
          </button>
          <button
            type="submit"
            disabled={saving}
            className="inline-flex h-10 items-center justify-center gap-2 rounded-lg bg-blue-600 px-5 text-sm font-semibold text-white transition hover:bg-blue-700 disabled:cursor-not-allowed disabled:opacity-60 dark:bg-blue-500 dark:hover:bg-blue-400"
          >
            {saving ? (
              <LoaderCircle className="h-4 w-4 animate-spin" />
            ) : (
              <Check className="h-4 w-4" />
            )}
            {saving
              ? editing
                ? "Updating..."
                : "Adding..."
              : editing
                ? "Save changes"
                : "Add sheet"}
          </button>
        </div>
      </form>
    </div>
  );
};

export default SheetFormModal;
