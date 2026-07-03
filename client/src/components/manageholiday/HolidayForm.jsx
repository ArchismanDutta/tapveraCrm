import React, { useEffect, useState } from "react";
import { CalendarPlus, X } from "lucide-react";

const emptyForm = {
  name: "",
  startDate: "",
  endDate: "",
  type: "NATIONAL",
  shifts: ["ALL"],
};

const fieldClass =
  "h-10 w-full rounded-xl border border-slate-200 bg-slate-50 px-3 text-sm text-slate-900 outline-none transition placeholder:text-slate-400 focus:border-blue-500 focus:bg-white focus:ring-2 focus:ring-blue-500/15 dark:border-white/10 dark:bg-white/[0.035] dark:text-white dark:focus:bg-white/[0.05]";

const HolidayForm = ({ onAdd, onUpdate, editingHoliday, onCancelEdit }) => {
  const [form, setForm] = useState(emptyForm);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    if (editingHoliday) {
      const holidayDate = String(editingHoliday.date || "").slice(0, 10);
      setForm({
        name: editingHoliday.name || "",
        startDate: holidayDate,
        endDate: holidayDate,
        type: editingHoliday.type || "NATIONAL",
        shifts: editingHoliday.shifts?.length
          ? editingHoliday.shifts
          : ["ALL"],
      });
    } else {
      setForm(emptyForm);
    }
    setError("");
  }, [editingHoliday]);

  const handleChange = (event) => {
    const { name, value } = event.target;
    setForm((current) => ({ ...current, [name]: value }));
    if (error) setError("");
  };

  const handleShiftsChange = (event) => {
    setForm((current) => ({
      ...current,
      shifts: [event.target.value],
    }));
  };

  const handleSubmit = async (event) => {
    event.preventDefault();

    if (!form.name.trim() || !form.startDate) {
      setError("Holiday name and start date are required.");
      return;
    }

    const start = new Date(`${form.startDate}T00:00:00`);
    const end = new Date(`${form.endDate || form.startDate}T00:00:00`);
    if (end < start) {
      setError("End date cannot be before the start date.");
      return;
    }

    try {
      setSaving(true);
      setError("");

      if (editingHoliday) {
        await onUpdate(editingHoliday._id, {
          name: form.name.trim(),
          date: form.startDate,
          type: form.type,
          shifts: form.shifts,
        });
      } else {
        const currentDate = new Date(start);
        while (currentDate <= end) {
          const date = [
            currentDate.getFullYear(),
            String(currentDate.getMonth() + 1).padStart(2, "0"),
            String(currentDate.getDate()).padStart(2, "0"),
          ].join("-");
          await onAdd({
            name: form.name.trim(),
            date,
            type: form.type,
            shifts: form.shifts,
          });
          currentDate.setDate(currentDate.getDate() + 1);
        }
      }

      setForm(emptyForm);
    } catch (submitError) {
      console.error("Error saving holiday:", submitError);
      setError("The holiday could not be saved. Please try again.");
    } finally {
      setSaving(false);
    }
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-[minmax(220px,1.2fr)_170px_170px_180px_190px]">
        <label className="block">
          <span className="mb-1.5 block text-xs font-medium text-slate-600 dark:text-slate-300">
            Holiday name
          </span>
          <input
            type="text"
            name="name"
            value={form.name}
            onChange={handleChange}
            placeholder="e.g. Independence Day"
            className={fieldClass}
            required
          />
        </label>

        <label className="block">
          <span className="mb-1.5 block text-xs font-medium text-slate-600 dark:text-slate-300">
            Start date
          </span>
          <input
            type="date"
            name="startDate"
            value={form.startDate}
            onChange={handleChange}
            className={fieldClass}
            required
          />
        </label>

        <label className="block">
          <span className="mb-1.5 block text-xs font-medium text-slate-600 dark:text-slate-300">
            End date
          </span>
          <input
            type="date"
            name="endDate"
            value={form.endDate}
            min={form.startDate || undefined}
            onChange={handleChange}
            disabled={Boolean(editingHoliday)}
            className={`${fieldClass} disabled:cursor-not-allowed disabled:opacity-50`}
          />
        </label>

        <label className="block">
          <span className="mb-1.5 block text-xs font-medium text-slate-600 dark:text-slate-300">
            Holiday type
          </span>
          <select
            name="type"
            value={form.type}
            onChange={handleChange}
            className={`${fieldClass} dark:bg-[#151923]`}
          >
            <option value="NATIONAL">National</option>
            <option value="COMPANY">Company</option>
            <option value="RELIGIOUS">Religious</option>
            <option value="FESTIVAL">Festival</option>
          </select>
        </label>

        <label className="block">
          <span className="mb-1.5 block text-xs font-medium text-slate-600 dark:text-slate-300">
            Applies to
          </span>
          <select
            name="shifts"
            value={form.shifts[0] || "ALL"}
            onChange={handleShiftsChange}
            className={`${fieldClass} dark:bg-[#151923]`}
          >
            <option value="ALL">All shifts</option>
            <option value="standard">Standard</option>
            <option value="flexiblePermanent">Flexible permanent</option>
          </select>
        </label>
      </div>

      <div className="flex flex-col gap-3 border-t border-slate-200 pt-4 dark:border-white/10 sm:flex-row sm:items-center sm:justify-between">
        <div>
          {error && (
            <p className="text-sm text-rose-600 dark:text-rose-300">{error}</p>
          )}
          {!error && !editingHoliday && (
            <p className="text-xs text-slate-500 dark:text-slate-400">
              A date range creates one holiday entry for each day.
            </p>
          )}
        </div>
        <div className="flex gap-3">
          {editingHoliday && (
            <button
              type="button"
              onClick={onCancelEdit}
              disabled={saving}
              className="inline-flex h-10 items-center justify-center gap-2 rounded-lg border border-slate-200 px-4 text-sm font-semibold text-slate-700 transition hover:bg-slate-50 disabled:opacity-50 dark:border-white/10 dark:text-slate-200 dark:hover:bg-white/[0.05]"
            >
              <X className="h-4 w-4" /> Cancel
            </button>
          )}
          <button
            type="submit"
            disabled={saving}
            className="inline-flex h-10 items-center justify-center gap-2 rounded-lg bg-blue-600 px-4 text-sm font-semibold text-white transition hover:bg-blue-700 disabled:cursor-not-allowed disabled:opacity-60"
          >
            {saving ? (
              <span className="h-4 w-4 animate-spin rounded-full border-2 border-white/30 border-t-white" />
            ) : (
              <CalendarPlus className="h-4 w-4" />
            )}
            {saving
              ? "Saving..."
              : editingHoliday
                ? "Update holiday"
                : "Add holiday"}
          </button>
        </div>
      </div>
    </form>
  );
};

export default HolidayForm;
