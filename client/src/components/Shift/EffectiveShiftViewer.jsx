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
    <div className="bg-white p-6 rounded-lg shadow-md">
      <h2 className="text-2xl font-bold mb-4">View Effective Shift</h2>

      <div className="space-y-4">
        <div className="flex gap-4 items-end">
          <div>
            <label className="block text-sm font-medium mb-2">
              Select Date
            </label>
            <input
              type="date"
              value={selectedDate}
              onChange={handleDateChange}
              className="border rounded-md px-3 py-2"
            />
          </div>
          <button
            onClick={fetchEffectiveShift}
            disabled={loading || !selectedDate}
            className="bg-blue-600 text-white px-6 py-2 rounded-md hover:bg-blue-700 disabled:opacity-50"
          >
            {loading ? "Loading..." : "Get Shift"}
          </button>
        </div>

        {error && (
          <div className="bg-red-100 border border-red-400 text-red-700 px-4 py-3 rounded">
            {error}
          </div>
        )}

        {effectiveShift && (
          <div className="bg-green-50 border border-green-200 p-4 rounded-md">
            <h3 className="text-lg font-semibold mb-2">
              Effective Shift for {selectedDate}
            </h3>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
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
                <span className="inline-block bg-blue-100 text-blue-800 px-2 py-1 rounded text-sm">
                  Flexible Shift
                </span>
              </div>
            )}
            {effectiveShift.isNightShift && (
              <div className="mt-2">
                <span className="inline-block bg-purple-100 text-purple-800 px-2 py-1 rounded text-sm">
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
