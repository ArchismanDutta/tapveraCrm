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
    <div className="bg-white p-6 rounded-lg shadow-md">
      <h2 className="text-2xl font-bold mb-4">Employee Shift Assignment</h2>

      <form onSubmit={handleSubmit} className="space-y-6">
        {/* Default Shift */}
        <div>
          <label className="block text-sm font-medium mb-2">
            Default Shift
          </label>
          <select
            value={assignment.defaultShiftId}
            onChange={handleDefaultShiftChange}
            className="border rounded-md px-3 py-2 w-full md:w-64"
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
          <label className="block text-sm font-medium mb-2">
            Weekly Shift Overrides (Optional)
          </label>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {dayNames.map((day) => (
              <div key={day}>
                <label className="block text-xs font-medium mb-1">{day}</label>
                <select
                  value={assignment.weeklyShifts[day]}
                  onChange={(e) => handleWeeklyShiftChange(day, e.target.value)}
                  className="border rounded-md px-3 py-2 w-full"
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
          className="bg-green-600 text-white px-6 py-2 rounded-md hover:bg-green-700 disabled:opacity-50"
        >
          {loading ? "Saving..." : "Save Assignment"}
        </button>
      </form>
    </div>
  );
};

export default EmployeeShiftAssignment;
