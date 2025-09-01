import React from "react";

const AttendanceSummaryCard = ({ summary }) => {
  if (!summary) return null;

  return (
    <div className="bg-gray-800 p-4 rounded shadow text-white grid grid-cols-3 gap-4 mb-6">
      <div>
        <h3 className="font-semibold">Total Work Hours</h3>
        <p>{summary.totalWorkHours}</p>
      </div>
      <div>
        <h3 className="font-semibold">Late Days</h3>
        <p>{summary.lateDays}</p>
      </div>
      <div>
        <h3 className="font-semibold">Absent Days</h3>
        <p>{summary.absentDays}</p>
      </div>
      <div>
        <h3 className="font-semibold">Total Break Hours</h3>
        <p>{summary.totalBreakHours}</p>
      </div>
      <div>
        <h3 className="font-semibold">Leaves Taken</h3>
        <p>{summary.leavesTaken}</p>
      </div>
      <div>
        <h3 className="font-semibold">Total Days</h3>
        <p>{summary.totalDays}</p>
      </div>
    </div>
  );
};

export default AttendanceSummaryCard;
