import React, { useEffect, useState } from "react";
import { shiftApi } from "../../api/shiftApi";

const ShiftChangeRequest = () => {
  const [shifts, setShifts] = useState([]);
  const [loading, setLoading] = useState(false);
  const [request, setRequest] = useState({
    type: "temporary",
    requestedShiftId: "",
    startDate: "",
    endDate: "",
    days: [],
  });

  const dayNames = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];

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
    const { name, value } = e.target;
    setRequest((prev) => ({ ...prev, [name]: value }));
  };

  const toggleDay = (day) => {
    setRequest((prev) => {
      const days = new Set(prev.days);
      days.has(day) ? days.delete(day) : days.add(day);
      return { ...prev, days: Array.from(days) };
    });
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    try {
      setLoading(true);
      await shiftApi.submitShiftChangeRequest(request);
      setRequest({
        type: "temporary",
        requestedShiftId: "",
        startDate: "",
        endDate: "",
        days: [],
      });
      alert("Shift change request submitted successfully!");
    } catch (error) {
      console.error("Error submitting request:", error);
      alert(
        "Error submitting request: " +
          (error.response?.data?.error || error.message)
      );
    } finally {
      setLoading(false);
    }
  };

  return (
    <div>
      <h2 className="text-lg font-semibold text-slate-950 dark:text-white">Request a shift change</h2>
      <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">Submit a temporary, permanent, or weekday-specific change.</p>

      <form onSubmit={handleSubmit} className="mt-6 max-w-4xl space-y-5">
        <div className="grid gap-4 md:grid-cols-2">
        {/* Request Type */}
        <div>
          <label className="mb-2 block text-sm font-medium text-slate-700 dark:text-slate-200">Request type</label>
          <select
            name="type"
            value={request.type}
            onChange={handleInputChange}
            className="h-10 w-full rounded-xl border border-slate-200 bg-slate-50 px-3 text-sm text-slate-900 outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-500/15 dark:border-white/10 dark:bg-[#151923] dark:text-white"
            required
          >
            <option value="temporary">Temporary (Single Day/Period)</option>
            <option value="permanent">Permanent Change</option>
            <option value="partialWeekly">
              Partial Weekly (Specific Days)
            </option>
          </select>
        </div>

        {/* Requested Shift */}
        <div>
          <label className="mb-2 block text-sm font-medium text-slate-700 dark:text-slate-200">
            Requested Shift
          </label>
          <select
            name="requestedShiftId"
            value={request.requestedShiftId}
            onChange={handleInputChange}
            className="h-10 w-full rounded-xl border border-slate-200 bg-slate-50 px-3 text-sm text-slate-900 outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-500/15 dark:border-white/10 dark:bg-[#151923] dark:text-white"
            required
          >
            <option value="">Select Shift</option>
            {shifts.map((shift) => (
              <option key={shift._id} value={shift._id}>
                {shift.name} ({shift.start} - {shift.end})
              </option>
            ))}
          </select>
        </div>
        </div>

        {/* Date Range */}
        <div className="grid grid-cols-1 gap-4 rounded-2xl border border-slate-200 bg-slate-50 p-4 md:grid-cols-2 dark:border-white/10 dark:bg-white/[0.025]">
          <div>
            <label className="mb-2 block text-sm font-medium text-slate-700 dark:text-slate-200">Start date</label>
            <input
              type="date"
              name="startDate"
              value={request.startDate}
              onChange={handleInputChange}
              className="h-10 w-full rounded-xl border border-slate-200 bg-slate-50 px-3 text-sm text-slate-900 outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-500/15 dark:border-white/10 dark:bg-white/[0.035] dark:text-white"
              required
            />
          </div>
          {request.type === "temporary" && (
            <div>
              <label className="mb-2 block text-sm font-medium text-slate-700 dark:text-slate-200">End date</label>
              <input
                type="date"
                name="endDate"
                value={request.endDate}
                onChange={handleInputChange}
                className="h-10 w-full rounded-xl border border-slate-200 bg-slate-50 px-3 text-sm text-slate-900 outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-500/15 dark:border-white/10 dark:bg-white/[0.035] dark:text-white"
                required
              />
            </div>
          )}
        </div>

        {/* Days Selection for Partial Weekly */}
        {request.type === "partialWeekly" && (
          <div>
            <label className="mb-2 block text-sm font-medium text-slate-700 dark:text-slate-200">
              Select Days
            </label>
            <div className="flex flex-wrap gap-3">
              {dayNames.map((day) => (
                <label key={day} className={`flex cursor-pointer items-center rounded-lg border px-3 py-2 text-sm transition ${request.days.includes(day) ? "border-blue-500 bg-blue-50 text-blue-700 dark:border-blue-400/40 dark:bg-blue-400/10 dark:text-blue-300" : "border-slate-200 text-slate-600 hover:bg-slate-50 dark:border-white/10 dark:text-slate-300 dark:hover:bg-white/[0.03]"}`}>
                  <input
                    type="checkbox"
                    checked={request.days.includes(day)}
                    onChange={() => toggleDay(day)}
                    className="mr-2"
                  />
                  {day}
                </label>
              ))}
            </div>
          </div>
        )}

        <button
          type="submit"
          disabled={loading}
          className="h-10 rounded-lg bg-blue-600 px-5 text-sm font-semibold text-white transition hover:bg-blue-700 disabled:cursor-not-allowed disabled:opacity-50"
        >
          {loading ? "Submitting..." : "Submit request"}
        </button>
      </form>
    </div>
  );
};

export default ShiftChangeRequest;
