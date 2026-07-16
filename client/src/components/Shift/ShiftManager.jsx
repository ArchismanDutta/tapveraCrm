import React, { useEffect, useState } from "react";
import { shiftApi } from "../../api/shiftApi";

const ShiftsManager = () => {
  const [shifts, setShifts] = useState([]);
  const [loading, setLoading] = useState(false);
  const [newShift, setNewShift] = useState({
    name: "",
    start: "",
    end: "",
    durationHours: 8,
    activeDays: [],
    isFlexible: false,
    isNightShift: false,
  });

  const dayNames = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

  useEffect(() => {
    fetchShifts();
  }, []);

  const fetchShifts = async () => {
    try {
      setLoading(true);
      const response = await shiftApi.getShifts();
      setShifts(response.data);
    } catch (error) {
      console.error("Error fetching shifts:", error);
      alert("Failed to load shifts");
    } finally {
      setLoading(false);
    }
  };

  const handleInputChange = (e) => {
    const { name, value, type, checked } = e.target;
    if (type === "checkbox") {
      setNewShift((prev) => ({ ...prev, [name]: checked }));
    } else {
      setNewShift((prev) => ({ ...prev, [name]: value }));
    }
  };

  const toggleActiveDay = (day) => {
    setNewShift((prev) => {
      const days = new Set(prev.activeDays);
      days.has(day) ? days.delete(day) : days.add(day);
      return { ...prev, activeDays: Array.from(days) };
    });
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    try {
      setLoading(true);
      await shiftApi.createShift(newShift);
      setNewShift({
        name: "",
        start: "",
        end: "",
        durationHours: 8,
        activeDays: [],
        isFlexible: false,
        isNightShift: false,
      });
      fetchShifts();
      alert("Shift created successfully!");
    } catch (error) {
      console.error("Error creating shift:", error);
      alert(
        "Error creating shift: " +
          (error.response?.data?.error || error.message)
      );
    } finally {
      setLoading(false);
    }
  };

  return (
    <div>
      <h2 className="text-lg font-semibold text-slate-950 dark:text-white">Manage shifts</h2>
      <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">Review existing schedules or create a new shift.</p>

      <div className="mt-6 grid gap-6 xl:grid-cols-[minmax(0,1fr)_minmax(400px,0.8fr)]">
        {/* Shifts List */}
        <section>
          <div className="mb-3 flex items-center justify-between gap-3">
            <h3 className="text-sm font-semibold text-slate-700 dark:text-slate-200">Existing shifts</h3>
            <span className="rounded-full bg-slate-100 px-2.5 py-1 text-xs font-medium text-slate-500 dark:bg-white/[0.05] dark:text-slate-400">
              {shifts.length} schedules
            </span>
          </div>
          {loading ? (
            <div className="space-y-3">{[0, 1, 2].map((item) => <div key={item} className="h-20 animate-pulse rounded-xl bg-slate-100 dark:bg-white/[0.04]" />)}</div>
          ) : shifts.length === 0 ? (
            <div className="rounded-xl border border-dashed border-slate-300 px-5 py-12 text-center dark:border-white/15">
              <p className="text-sm font-medium text-slate-700 dark:text-slate-200">No shifts created yet</p>
              <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">Use the form to create the first schedule.</p>
            </div>
          ) : (
            <div className="grid gap-3">
              {shifts.map((shift) => (
                <article key={shift._id} className="rounded-xl border border-slate-200 bg-slate-50 p-4 dark:border-white/10 dark:bg-white/[0.025]">
                  <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                    <div>
                      <h4 className="font-semibold text-slate-900 dark:text-white">{shift.name}</h4>
                      <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">
                        {shift.start} – {shift.end} · {shift.durationHours} hours
                      </p>
                    </div>
                    <div className="flex flex-wrap gap-1.5">
                      {shift.isFlexible && <span className="rounded-full bg-blue-50 px-2.5 py-1 text-[11px] font-medium text-blue-700 dark:bg-blue-400/10 dark:text-blue-300">Flexible</span>}
                      {shift.isNightShift && <span className="rounded-full bg-violet-50 px-2.5 py-1 text-[11px] font-medium text-violet-700 dark:bg-violet-400/10 dark:text-violet-300">Night</span>}
                    </div>
                  </div>
                  <p className="mt-3 border-t border-slate-200 pt-3 text-xs text-slate-500 dark:border-white/10 dark:text-slate-400">
                    {shift.activeDays?.length ? shift.activeDays.join(" · ") : "No active days selected"}
                  </p>
                </article>
              ))}
            </div>
          )}
        </section>

        {/* Create New Shift Form */}
        <section className="self-start rounded-2xl border border-slate-200 bg-slate-50 p-5 dark:border-white/10 dark:bg-white/[0.025] xl:sticky xl:top-4">
          <h3 className="text-base font-semibold text-slate-900 dark:text-white">Create a new shift</h3>
          <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">Define working hours, active weekdays, and schedule type.</p>
          <form onSubmit={handleSubmit} className="mt-5 space-y-5">
            <label className="block">
              <span className="mb-1.5 block text-xs font-medium text-slate-600 dark:text-slate-300">Shift name</span>
              <input
                name="name"
                placeholder="e.g. Morning shift"
                value={newShift.name}
                onChange={handleInputChange}
                className="h-10 w-full rounded-xl border border-slate-200 bg-white px-3 text-sm text-slate-900 outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-500/15 dark:border-white/10 dark:bg-[#151923] dark:text-white"
                required
              />
            </label>

            <div className="grid grid-cols-2 gap-3">
              <label className="block">
                <span className="mb-1.5 block text-xs font-medium text-slate-600 dark:text-slate-300">Starts at</span>
                <input type="time" name="start" value={newShift.start} onChange={handleInputChange} className="h-10 w-full rounded-xl border border-slate-200 bg-white px-3 text-sm text-slate-900 outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-500/15 dark:border-white/10 dark:bg-[#151923] dark:text-white" required />
              </label>
              <label className="block">
                <span className="mb-1.5 block text-xs font-medium text-slate-600 dark:text-slate-300">Ends at</span>
                <input type="time" name="end" value={newShift.end} onChange={handleInputChange} className="h-10 w-full rounded-xl border border-slate-200 bg-white px-3 text-sm text-slate-900 outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-500/15 dark:border-white/10 dark:bg-[#151923] dark:text-white" required />
              </label>
            </div>

            <label className="block">
              <span className="mb-1.5 block text-xs font-medium text-slate-600 dark:text-slate-300">Duration (hours)</span>
              <input type="number" name="durationHours" min="1" max="24" value={newShift.durationHours} onChange={handleInputChange} className="h-10 w-28 rounded-xl border border-slate-200 bg-white px-3 text-sm text-slate-900 outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-500/15 dark:border-white/10 dark:bg-[#151923] dark:text-white" required />
            </label>

            <fieldset>
              <legend className="mb-2 text-xs font-medium text-slate-600 dark:text-slate-300">Active days</legend>
              <div className="grid grid-cols-4 gap-2 sm:grid-cols-7 xl:grid-cols-4 2xl:grid-cols-7">
                {dayNames.map((day) => {
                  const isSelected = newShift.activeDays.includes(day);
                  return (
                    <label key={day} className={`cursor-pointer rounded-lg border px-2 py-2 text-center text-xs font-medium transition ${isSelected ? "border-blue-500 bg-blue-50 text-blue-700 dark:border-blue-400/40 dark:bg-blue-400/10 dark:text-blue-300" : "border-slate-200 bg-white text-slate-500 hover:bg-slate-50 dark:border-white/10 dark:bg-white/[0.03] dark:text-slate-400"}`}>
                      <input type="checkbox" checked={isSelected} onChange={() => toggleActiveDay(day)} className="sr-only" />
                      {day}
                    </label>
                  );
                })}
              </div>
            </fieldset>

            <div className="grid gap-2 sm:grid-cols-2">
              <label className="flex cursor-pointer items-center gap-3 rounded-xl border border-slate-200 bg-white p-3 text-sm text-slate-600 dark:border-white/10 dark:bg-white/[0.03] dark:text-slate-300">
                <input type="checkbox" name="isFlexible" checked={newShift.isFlexible} onChange={handleInputChange} className="h-4 w-4 rounded border-slate-300 text-blue-600 focus:ring-blue-500" />
                Flexible shift
              </label>
              <label className="flex cursor-pointer items-center gap-3 rounded-xl border border-slate-200 bg-white p-3 text-sm text-slate-600 dark:border-white/10 dark:bg-white/[0.03] dark:text-slate-300">
                <input type="checkbox" name="isNightShift" checked={newShift.isNightShift} onChange={handleInputChange} className="h-4 w-4 rounded border-slate-300 text-blue-600 focus:ring-blue-500" />
                Night shift
              </label>
            </div>

            <button type="submit" disabled={loading} className="h-10 w-full rounded-lg bg-blue-600 px-4 text-sm font-semibold text-white transition hover:bg-blue-700 disabled:cursor-not-allowed disabled:opacity-50">
              {loading ? "Creating..." : "Create shift"}
            </button>
          </form>
        </section>
      </div>
    </div>
  );
};

export default ShiftsManager;
