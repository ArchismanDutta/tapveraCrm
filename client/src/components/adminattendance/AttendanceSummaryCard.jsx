// File: components/dashboard/AttendanceSummaryCard.jsx
import React from "react";

const AttendanceSummaryCard = ({ summary = {} }) => {
  // Default summary values to prevent undefined
  const {
    totalWorkHours = 0,
    totalBreakHours = 0,
    lateDays = 0,
    absentDays = 0,
    leavesTaken = 0,
    totalDays = 0,
  } = summary;

  const summaryItems = [
    { label: "Total Work Hours", value: totalWorkHours },
    { label: "Total Break Hours", value: totalBreakHours },
    { label: "Late Days", value: lateDays },
    { label: "Absent Days", value: absentDays },
    { label: "Leaves Taken", value: leavesTaken },
    { label: "Total Days", value: totalDays },
  ];

  return (
    <div className="bg-gray-800 p-6 rounded-xl shadow-md text-white grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-6 mb-6">
      {summaryItems.map(({ label, value }) => (
        <div key={label} className="flex flex-col items-center sm:items-start">
          <h3 className="font-semibold text-gray-300">{label}</h3>
          <p className="text-xl font-bold mt-1">{value}</p>
        </div>
      ))}
    </div>
  );
};

export default AttendanceSummaryCard;
