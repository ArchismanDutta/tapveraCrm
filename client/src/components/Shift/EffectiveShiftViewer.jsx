import React, { useState } from "react";
import { shiftApi } from "../../api/shiftApi";

const EffectiveShiftViewer = () => {
  const [selectedDate, setSelectedDate] = useState("");
  const [effectiveShift, setEffectiveShift] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  const handleDateChange = (e) => {
    setSelectedDate(e.target.value);
    setEffectiveShift(null);
    setError("");
  };

  const fetchEffectiveShift = async () => {
    if (!selectedDate) {
      setError("Please select a date");
      return;
    }

    try {
      setLoading(true);
      setError("");
      const response = await shiftApi.getEffectiveShift(selectedDate);
      setEffectiveShift(response.data);
    } catch (error) {
      console.error("Error fetching effective shift:", error);
      if (error.response?.status === 404) {
        setError("No shift found for the selected date");
      } else {
        setError(
          "Error fetching shift: " +
            (error.response?.data?.error || error.message)
        );
      }
      setEffectiveShift(null);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div>
      <h2 className="text-lg font-semibold text-slate-950 dark:text-white">View effective shift</h2>
      <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">Check the schedule that applies on a specific date.</p>

      <div className="mt-6 max-w-4xl space-y-4">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-end">
          <div>
            <label className="mb-2 block text-sm font-medium text-slate-700 dark:text-slate-200">
              Select Date
            </label>
            <input
              type="date"
              value={selectedDate}
              onChange={handleDateChange}
              className="h-10 rounded-xl border border-slate-200 bg-slate-50 px-3 text-sm text-slate-900 outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-500/15 dark:border-white/10 dark:bg-white/[0.035] dark:text-white"
            />
          </div>
          <button
            onClick={fetchEffectiveShift}
            disabled={loading || !selectedDate}
            className="h-10 rounded-lg bg-blue-600 px-4 text-sm font-semibold text-white transition hover:bg-blue-700 disabled:opacity-50"
          >
            {loading ? "Loading..." : "Get Shift"}
          </button>
        </div>

        {error && (
          <div className="rounded-xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-700 dark:border-rose-400/20 dark:bg-rose-400/10 dark:text-rose-200">
            {error}
          </div>
        )}

        {effectiveShift && (
          <div className="rounded-2xl border border-slate-200 bg-slate-50 p-5 dark:border-white/10 dark:bg-white/[0.025]">
            <h3 className="mb-4 text-sm font-semibold text-slate-900 dark:text-white">
              Effective Shift for {selectedDate}
            </h3>
            <div className="grid grid-cols-1 gap-4 text-sm text-slate-700 dark:text-slate-200 md:grid-cols-3">
              <div>
                <span className="font-medium">Name:</span>
                <p>{effectiveShift.name}</p>
              </div>
              <div>
                <span className="font-medium">Time:</span>
                <p>
                  {effectiveShift.start} - {effectiveShift.end}
                </p>
              </div>
              <div>
                <span className="font-medium">Duration:</span>
                <p>{effectiveShift.durationHours} hours</p>
              </div>
            </div>
            {effectiveShift.isFlexible && (
              <div className="mt-2">
                <span className="inline-block rounded-full border border-blue-200 bg-blue-50 px-2.5 py-1 text-xs text-blue-700 dark:border-blue-400/20 dark:bg-blue-400/10 dark:text-blue-200">
                  Flexible Shift
                </span>
              </div>
            )}
            {effectiveShift.isNightShift && (
              <div className="mt-2">
                <span className="inline-block rounded-full border border-violet-200 bg-violet-50 px-2.5 py-1 text-xs text-violet-700 dark:border-violet-400/20 dark:bg-violet-400/10 dark:text-violet-200">
                  Night Shift
                </span>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
};

export default EffectiveShiftViewer;
