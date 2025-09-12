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
    <div className="bg-white p-6 rounded-lg shadow-md">
      <h2 className="text-2xl font-bold mb-4">Request Shift Change</h2>

      <form onSubmit={handleSubmit} className="space-y-4">
        {/* Request Type */}
        <div>
          <label className="block text-sm font-medium mb-2">Request Type</label>
          <select
            name="type"
            value={request.type}
            onChange={handleInputChange}
            className="border rounded-md px-3 py-2 w-full md:w-64"
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
          <label className="block text-sm font-medium mb-2">
            Requested Shift
          </label>
          <select
            name="requestedShiftId"
            value={request.requestedShiftId}
            onChange={handleInputChange}
            className="border rounded-md px-3 py-2 w-full md:w-64"
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

        {/* Date Range */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div>
            <label className="block text-sm font-medium mb-2">Start Date</label>
            <input
              type="date"
              name="startDate"
              value={request.startDate}
              onChange={handleInputChange}
              className="border rounded-md px-3 py-2 w-full"
              required
            />
          </div>
          {request.type === "temporary" && (
            <div>
              <label className="block text-sm font-medium mb-2">End Date</label>
              <input
                type="date"
                name="endDate"
                value={request.endDate}
                onChange={handleInputChange}
                className="border rounded-md px-3 py-2 w-full"
                required
              />
            </div>
          )}
        </div>

        {/* Days Selection for Partial Weekly */}
        {request.type === "partialWeekly" && (
          <div>
            <label className="block text-sm font-medium mb-2">
              Select Days
            </label>
            <div className="flex flex-wrap gap-3">
              {dayNames.map((day) => (
                <label key={day} className="flex items-center">
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
          className="bg-orange-600 text-white px-6 py-2 rounded-md hover:bg-orange-700 disabled:opacity-50"
        >
          {loading ? "Submitting..." : "Submit Request"}
        </button>
      </form>
    </div>
  );
};

export default ShiftChangeRequest;
