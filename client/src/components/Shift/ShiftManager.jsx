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

      {/* Shifts List */}
      <div className="mt-6">
        <h3 className="mb-3 text-sm font-semibold text-slate-700 dark:text-slate-200">Existing shifts</h3>
        {loading ? (
          <div className="space-y-2">{[0, 1, 2].map((item) => <div key={item} className="h-14 animate-pulse rounded-xl bg-slate-100 dark:bg-white/[0.04]" />)}</div>
        ) : (
          <div className="grid gap-3">
            {shifts.map((shift) => (
              <div key={shift._id} className="rounded-xl border border-slate-200 bg-slate-50 p-4 dark:border-white/10 dark:bg-white/[0.025]">
                <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
                  <div>
                    <span className="font-semibold text-slate-900 dark:text-white">{shift.name}</span>
                    <span className="ml-3 text-sm text-slate-500 dark:text-slate-400">
                      {shift.start} - {shift.end} ({shift.durationHours}h)
                    </span>
                  </div>
                  <div className="text-xs text-slate-500 dark:text-slate-400">
                    {shift.activeDays?.join(", ")}
                    {shift.isFlexible && (
                      <span className="ml-2 text-blue-600">[Flexible]</span>
                    )}
                    {shift.isNightShift && (
                      <span className="ml-2 text-purple-600">[Night]</span>
                    )}
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Create New Shift Form */}
      <div className="mt-6 border-t border-slate-200 pt-6 dark:border-white/10">
        <h3 className="mb-3 text-sm font-semibold text-slate-700 dark:text-slate-200">Create a new shift</h3>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <input
              name="name"
              placeholder="Shift name"
              value={newShift.name}
              onChange={handleInputChange}
              className="h-10 rounded-xl border border-slate-200 bg-slate-50 px-3 text-sm text-slate-900 outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-500/15 dark:border-white/10 dark:bg-white/[0.035] dark:text-white"
              required
            />
            <input
              type="time"
              name="start"
              value={newShift.start}
              onChange={handleInputChange}
              className="h-10 rounded-xl border border-slate-200 bg-slate-50 px-3 text-sm text-slate-900 outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-500/15 dark:border-white/10 dark:bg-white/[0.035] dark:text-white"
              required
            />
            <input
              type="time"
              name="end"
              value={newShift.end}
              onChange={handleInputChange}
              className="h-10 rounded-xl border border-slate-200 bg-slate-50 px-3 text-sm text-slate-900 outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-500/15 dark:border-white/10 dark:bg-white/[0.035] dark:text-white"
              required
            />
          </div>

          <div>
            <label className="mb-2 block text-sm font-medium text-slate-700 dark:text-slate-200">
              Duration (hours)
            </label>
            <input
              type="number"
              name="durationHours"
              min="1"
              max="24"
              value={newShift.durationHours}
              onChange={handleInputChange}
              className="h-10 w-32 rounded-xl border border-slate-200 bg-slate-50 px-3 text-sm text-slate-900 outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-500/15 dark:border-white/10 dark:bg-white/[0.035] dark:text-white"
              required
            />
          </div>

          <div>
            <label className="mb-2 block text-sm font-medium text-slate-700 dark:text-slate-200">
              Active Days
            </label>
            <div className="flex flex-wrap gap-3">
              {dayNames.map((day) => (
                <label key={day} className="flex items-center rounded-lg border border-slate-200 px-3 py-2 text-sm text-slate-600 dark:border-white/10 dark:text-slate-300">
                  <input
                    type="checkbox"
                    checked={newShift.activeDays.includes(day)}
                    onChange={() => toggleActiveDay(day)}
                    className="mr-2"
                  />
                  {day}
                </label>
              ))}
            </div>
          </div>

          <div className="flex gap-6">
            <label className="flex items-center text-sm text-slate-600 dark:text-slate-300">
              <input
                type="checkbox"
                name="isFlexible"
                checked={newShift.isFlexible}
                onChange={handleInputChange}
                className="mr-2"
              />
              Flexible Shift
            </label>
            <label className="flex items-center text-sm text-slate-600 dark:text-slate-300">
              <input
                type="checkbox"
                name="isNightShift"
                checked={newShift.isNightShift}
                onChange={handleInputChange}
                className="mr-2"
              />
              Night Shift
            </label>
          </div>

          <button
            type="submit"
            disabled={loading}
            className="h-10 rounded-lg bg-blue-600 px-4 text-sm font-semibold text-white transition hover:bg-blue-700 disabled:opacity-50"
          >
            {loading ? "Creating..." : "Create shift"}
          </button>
        </form>
      </div>
    </div>
  );
};

export default ShiftsManager;
