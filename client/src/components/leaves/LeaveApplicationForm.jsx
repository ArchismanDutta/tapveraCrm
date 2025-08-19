import React, { useState, useMemo } from "react";

const LeaveApplicationForm = ({ onSubmitLeave }) => {
  const [type, setType] = useState("paid");
  const [startDate, setStartDate] = useState("");
  const [endDate, setEndDate] = useState("");
  const [reason, setReason] = useState("");

  const todayStr = useMemo(() => new Date().toISOString().split("T")[0], []);

  const handleSubmit = (e) => {
    e.preventDefault();

    if (!startDate) {
      alert("Start date is required.");
      return;
    }

    const isHalfDay = type === "halfDay";

    if (!isHalfDay && !endDate) {
      alert("End date is required for this leave type.");
      return;
    }

    if (!isHalfDay && endDate < startDate) {
      alert("End date cannot be before start date.");
      return;
    }

    // Send the flat fields expected by backend (controller also accepts period)
    onSubmitLeave({
      type,
      startDate,
      endDate: isHalfDay ? startDate : endDate,
      reason,
    });

    // reset
    setReason("");
    setStartDate("");
    setEndDate("");
    setType("paid");
  };

  const isHalfDay = type === "halfDay";

  return (
    <div className="bg-white backdrop-blur-xl border border-gray-100 shadow-xl rounded-2xl p-6">
      <h3 className="text-xl font-semibold mb-5 text-gray-800">Apply for Leave</h3>
      <form onSubmit={handleSubmit} className="space-y-4">
        {/* Leave Type */}
        <select
          className="border border-gray-200 rounded-lg p-3 w-full shadow-sm focus:ring-2 focus:ring-yellow-500 focus:outline-none"
          value={type}
          onChange={(e) => {
            const next = e.target.value;
            setType(next);
            if (next === "halfDay" && startDate) {
              setEndDate(startDate);
            }
          }}
        >
          <option value="paid">Paid Leave</option>
          <option value="unpaid">Unpaid Leave</option>
          <option value="sick">Sick Leave</option>
          <option value="maternity">Maternity Leave</option>
          <option value="workFromHome">Work From Home</option>
          <option value="halfDay">Half Day</option>
        </select>

        {/* Dates */}
        <div className="flex gap-3 flex-col sm:flex-row">
          <input
            type="date"
            min={todayStr}
            className="border border-gray-200 rounded-lg p-3 w-full shadow-sm focus:ring-2 focus:ring-orange-500 focus:outline-none"
            value={startDate}
            onChange={(e) => {
              const v = e.target.value;
              setStartDate(v);
              if (isHalfDay) setEndDate(v);
            }}
          />
          <input
            type="date"
            min={startDate || todayStr}
            className={`border border-gray-200 rounded-lg p-3 w-full shadow-sm focus:ring-2 focus:ring-yellow-500 focus:outline-none ${isHalfDay ? "bg-gray-100 cursor-not-allowed" : ""}`}
            value={isHalfDay ? startDate : endDate}
            onChange={(e) => setEndDate(e.target.value)}
            disabled={isHalfDay}
          />
        </div>

        {/* Reason */}
        <textarea
          placeholder="Enter your reason..."
          className="border border-gray-200 rounded-lg p-3 w-full shadow-sm focus:ring-2 focus:ring-orange-500 focus:outline-none"
          value={reason}
          onChange={(e) => setReason(e.target.value)}
        />

        {/* Submit */}
        <button
          type="submit"
          className="mt-3 w-full bg-gradient-to-r from-orange-500 to-yellow-600 text-white font-medium px-4 py-3 rounded-xl hover:opacity-90 shadow-lg transition transform hover:-translate-y-0.5"
        >
          Submit Request
        </button>
      </form>
    </div>
  );
};

export default LeaveApplicationForm;
