import React, { useEffect, useState } from "react";
import { shiftApi } from "../../api/shiftApi";

const EmployeeShiftAssignment = () => {
  const [shifts, setShifts] = useState([]);
  const [loading, setLoading] = useState(false);
  const [assignment, setAssignment] = useState({
    defaultShiftId: "",
    weeklyShifts: {
      Mon: "",
      Tue: "",
      Wed: "",
      Thu: "",
      Fri: "",
      Sat: "",
      Sun: "",
    },
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

  const handleDefaultShiftChange = (e) => {
    setAssignment((prev) => ({
      ...prev,
      defaultShiftId: e.target.value,
    }));
  };

  const handleWeeklyShiftChange = (day, shiftId) => {
    setAssignment((prev) => ({
      ...prev,
      weeklyShifts: {
        ...prev.weeklyShifts,
        [day]: shiftId,
      },
    }));
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    try {
      setLoading(true);
      await shiftApi.assignEmployeeShift(assignment);
      alert("Shift assignment saved successfully!");
    } catch (error) {
      console.error("Error assigning shifts:", error);
      alert(
        "Error assigning shifts: " +
          (error.response?.data?.error || error.message)
      );
    } finally {
      setLoading(false);
    }
  };

  return (
    <div>
      <h2 className="text-lg font-semibold text-slate-950 dark:text-white">Employee shift assignment</h2>
      <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">Set a default shift and optional weekday overrides.</p>

      <form onSubmit={handleSubmit} className="mt-6 max-w-5xl space-y-6">
        {/* Default Shift */}
        <section className="rounded-2xl border border-slate-200 bg-slate-50 p-5 dark:border-white/10 dark:bg-white/[0.025]">
          <label className="mb-2 block text-sm font-medium text-slate-700 dark:text-slate-200">
            Default shift
          </label>
          <p className="mb-3 text-xs text-slate-500 dark:text-slate-400">Applied whenever a weekday-specific override is not selected.</p>
          <select
            value={assignment.defaultShiftId}
            onChange={handleDefaultShiftChange}
            className="h-10 w-full rounded-xl border border-slate-200 bg-slate-50 px-3 text-sm text-slate-900 outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-500/15 dark:border-white/10 dark:bg-[#151923] dark:text-white md:w-72"
            required
          >
            <option value="">Select Default Shift</option>
            {shifts.map((shift) => (
              <option key={shift._id} value={shift._id}>
                {shift.name} ({shift.start} - {shift.end})
              </option>
            ))}
          </select>
        </section>

        {/* Weekly Shifts */}
        <section>
          <label className="mb-2 block text-sm font-medium text-slate-700 dark:text-slate-200">
            Weekly shift overrides
          </label>
          <p className="mb-4 text-xs text-slate-500 dark:text-slate-400">Only change the days that differ from the default schedule.</p>
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-4">
            {dayNames.map((day) => (
              <div key={day} className="rounded-xl border border-slate-200 bg-slate-50 p-3 dark:border-white/10 dark:bg-white/[0.025]">
                <label className="mb-2 block text-xs font-semibold text-slate-600 dark:text-slate-300">{day}</label>
                <select
                  value={assignment.weeklyShifts[day]}
                  onChange={(e) => handleWeeklyShiftChange(day, e.target.value)}
                  className="h-10 w-full rounded-xl border border-slate-200 bg-slate-50 px-3 text-sm text-slate-900 outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-500/15 dark:border-white/10 dark:bg-[#151923] dark:text-white"
                >
                  <option value="">Use default</option>
                  {shifts.map((shift) => (
                    <option key={shift._id} value={shift._id}>
                      {shift.name}
                    </option>
                  ))}
                </select>
              </div>
            ))}
          </div>
        </section>

        <button
          type="submit"
          disabled={loading}
          className="h-10 rounded-lg bg-blue-600 px-5 text-sm font-semibold text-white transition hover:bg-blue-700 disabled:cursor-not-allowed disabled:opacity-50"
        >
          {loading ? "Saving..." : "Save assignment"}
        </button>
      </form>
    </div>
  );
};

export default EmployeeShiftAssignment;
