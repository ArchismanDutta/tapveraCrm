import React from "react";

const DateRangePicker = ({ value, onChange }) => {
  const handleStartChange = (e) => {
    onChange({ ...value, startDate: e.target.value });
  };

  const handleEndChange = (e) => {
    onChange({ ...value, endDate: e.target.value });
  };

  return (
    <div className="flex gap-2">
      <input
        type="date"
        className="p-2 rounded border bg-gray-800 text-white"
        value={value.startDate || ""}
        onChange={handleStartChange}
      />
      <input
        type="date"
        className="p-2 rounded border bg-gray-800 text-white"
        value={value.endDate || ""}
        onChange={handleEndChange}
      />
    </div>
  );
};

export default DateRangePicker;
