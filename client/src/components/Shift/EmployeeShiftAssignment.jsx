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

      <form onSubmit={handleSubmit} className="mt-6 space-y-6">
        {/* Default Shift */}
        <div>
          <label className="mb-2 block text-sm font-medium text-slate-700 dark:text-slate-200">
            Default Shift
          </label>
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
        </div>

        {/* Weekly Shifts */}
        <div>
          <label className="mb-2 block text-sm font-medium text-slate-700 dark:text-slate-200">
            Weekly Shift Overrides (Optional)
          </label>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {dayNames.map((day) => (
              <div key={day}>
                <label className="mb-1 block text-xs font-medium text-slate-500 dark:text-slate-400">{day}</label>
                <select
                  value={assignment.weeklyShifts[day]}
                  onChange={(e) => handleWeeklyShiftChange(day, e.target.value)}
                  className="h-10 w-full rounded-xl border border-slate-200 bg-slate-50 px-3 text-sm text-slate-900 outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-500/15 dark:border-white/10 dark:bg-[#151923] dark:text-white"
                >
                  <option value="">Use Default</option>
                  {shifts.map((shift) => (
                    <option key={shift._id} value={shift._id}>
                      {shift.name}
                    </option>
                  ))}
                </select>
              </div>
            ))}
          </div>
        </div>

        <button
          type="submit"
          disabled={loading}
          className="h-10 rounded-lg bg-blue-600 px-4 text-sm font-semibold text-white transition hover:bg-blue-700 disabled:opacity-50"
        >
          {loading ? "Saving..." : "Save assignment"}
        </button>
      </form>
    </div>
  );
};

export default EmployeeShiftAssignment;
