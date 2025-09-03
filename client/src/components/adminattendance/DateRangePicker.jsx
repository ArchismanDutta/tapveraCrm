// File: components/dashboard/DateRangePicker.jsx
import React from "react";

const DateRangePicker = ({ value = {}, onChange = () => {} }) => {
  // Handlers for start and end date changes
  const handleStartChange = (e) => {
    onChange({ ...value, startDate: e.target.value });
  };

  const handleEndChange = (e) => {
    onChange({ ...value, endDate: e.target.value });
  };

  return (
    <div className="flex flex-col sm:flex-row gap-4 items-start sm:items-center">
      {/* Start Date */}
      <div className="flex flex-col w-full sm:w-auto">
        <label
          htmlFor="startDate"
          className="text-gray-300 text-sm mb-1 font-medium"
        >
          Start Date
        </label>
        <input
          id="startDate"
          type="date"
          className="p-2 rounded-lg border border-gray-600 bg-gray-800 text-white focus:outline-none focus:ring-2 focus:ring-pink-500 transition-all"
          value={value.startDate || ""}
          onChange={handleStartChange}
        />
      </div>

      {/* End Date */}
      <div className="flex flex-col w-full sm:w-auto">
        <label
          htmlFor="endDate"
          className="text-gray-300 text-sm mb-1 font-medium"
        >
          End Date
        </label>
        <input
          id="endDate"
          type="date"
          className="p-2 rounded-lg border border-gray-600 bg-gray-800 text-white focus:outline-none focus:ring-2 focus:ring-pink-500 transition-all"
          value={value.endDate || ""}
          onChange={handleEndChange}
        />
      </div>
    </div>
  );
};

export default DateRangePicker;
