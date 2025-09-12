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
    <div className="bg-white p-6 rounded-lg shadow-md">
      <h2 className="text-2xl font-bold mb-4">Shifts Management</h2>

      {/* Shifts List */}
      <div className="mb-6">
        <h3 className="text-lg font-semibold mb-3">Existing Shifts</h3>
        {loading ? (
          <div className="text-center py-4">Loading...</div>
        ) : (
          <div className="grid gap-3">
            {shifts.map((shift) => (
              <div key={shift._id} className="border p-3 rounded-md bg-gray-50">
                <div className="flex justify-between items-center">
                  <div>
                    <span className="font-medium">{shift.name}</span>
                    <span className="ml-3 text-gray-600">
                      {shift.start} - {shift.end} ({shift.durationHours}h)
                    </span>
                  </div>
                  <div className="text-sm text-gray-500">
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
      <div className="border-t pt-6">
        <h3 className="text-lg font-semibold mb-3">Create New Shift</h3>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <input
              name="name"
              placeholder="Shift Name"
              value={newShift.name}
              onChange={handleInputChange}
              className="border rounded-md px-3 py-2"
              required
            />
            <input
              type="time"
              name="start"
              value={newShift.start}
              onChange={handleInputChange}
              className="border rounded-md px-3 py-2"
              required
            />
            <input
              type="time"
              name="end"
              value={newShift.end}
              onChange={handleInputChange}
              className="border rounded-md px-3 py-2"
              required
            />
          </div>

          <div>
            <label className="block text-sm font-medium mb-2">
              Duration (hours)
            </label>
            <input
              type="number"
              name="durationHours"
              min="1"
              max="24"
              value={newShift.durationHours}
              onChange={handleInputChange}
              className="border rounded-md px-3 py-2 w-32"
              required
            />
          </div>

          <div>
            <label className="block text-sm font-medium mb-2">
              Active Days
            </label>
            <div className="flex flex-wrap gap-3">
              {dayNames.map((day) => (
                <label key={day} className="flex items-center">
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
            <label className="flex items-center">
              <input
                type="checkbox"
                name="isFlexible"
                checked={newShift.isFlexible}
                onChange={handleInputChange}
                className="mr-2"
              />
              Flexible Shift
            </label>
            <label className="flex items-center">
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
            className="bg-blue-600 text-white px-6 py-2 rounded-md hover:bg-blue-700 disabled:opacity-50"
          >
            {loading ? "Creating..." : "Create Shift"}
          </button>
        </form>
      </div>
    </div>
  );
};

export default ShiftsManager;
