import React, { useState } from "react";

const LeaveApplicationForm = ({ onSubmitLeave }) => {
  const [leaveType, setLeaveType] = useState("Paid Leave");
  const [startDate, setStartDate] = useState("");
  const [endDate, setEndDate] = useState("");
  const [reason, setReason] = useState("");

  const handleSubmit = (e) => {
    e.preventDefault();

    if (!startDate || !endDate) return;

    const todayStr = new Date().toISOString().split("T")[0]; // yyyy-mm-dd

    if (startDate < todayStr) {
      alert("Start date cannot be in the past.");
      return;
    }

    if (endDate < startDate) {
      alert("End date cannot be before start date.");
      return;
    }

    onSubmitLeave({ leaveType, startDate, endDate, reason });
    setReason("");
  };

  const todayStr = new Date().toISOString().split("T")[0]; // for setting min attributes

  return (
    <div className="bg-white backdrop-blur-xl border border-gray-100 shadow-xl rounded-2xl p-6">
      <h3 className="text-xl font-semibold mb-5 text-gray-800">Apply for Leave</h3>
      <form onSubmit={handleSubmit} className="space-y-4">
        {/* Leave Type */}
        <select
          className="border border-gray-200 rounded-lg p-3 w-full shadow-sm focus:ring-2 focus:ring-yellow-500 focus:outline-none"
          value={leaveType}
          onChange={(e) => setLeaveType(e.target.value)}
        >
          <option>Paid Leave</option>
          <option>Unpaid Leave</option>
          <option>Sick Leave</option>
        </select>

        {/* Dates */}
        <div className="flex gap-3 flex-col sm:flex-row">
          <input
            type="date"
            min={todayStr} // Disallow past dates
            className="border border-gray-200 rounded-lg p-3 w-full shadow-sm focus:ring-2 focus:ring-orange-500 focus:outline-none"
            value={startDate}
            onChange={(e) => setStartDate(e.target.value)}
          />
          <input
            type="date"
            min={startDate || todayStr} // End date cannot be before start date
            className="border border-gray-200 rounded-lg p-3 w-full shadow-sm focus:ring-2 focus:ring-yellow-500 focus:outline-none"
            value={endDate}
            onChange={(e) => setEndDate(e.target.value)}
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
