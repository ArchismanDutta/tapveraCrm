// File: components/dashboard/AttendanceCalendar.jsx
import React from "react";

const STATUS_COLOR = {
  present: "bg-green-600 text-white",
  absent: "bg-red-600 text-white",
  late: "bg-yellow-500 text-black",
  default: "bg-gray-400 text-white",
};

const AttendanceCalendar = ({ dailyData = [] }) => {
  if (dailyData.length === 0) {
    return <p className="text-gray-400 italic">No attendance data available.</p>;
  }

  // Group attendance by year-month
  const groupedByMonth = dailyData.reduce((acc, record) => {
    const date = new Date(record.date);
    const key = `${date.getFullYear()}-${date.getMonth()}`;
    if (!acc[key]) acc[key] = [];
    acc[key].push(record);
    return acc;
  }, {});

  return (
    <div className="space-y-8 mb-6">
      {Object.entries(groupedByMonth).map(([key, records]) => {
        const [year, month] = key.split("-");
        const monthName = new Date(year, month).toLocaleString("default", { month: "long" });
        const maxDays = new Date(year, parseInt(month, 10) + 1, 0).getDate();

        // Prepare each day with status
        const daysWithStatus = Array.from({ length: maxDays }, (_, i) => {
          const dayNum = i + 1;
          const record = records.find(r => new Date(r.date).getDate() === dayNum);
          let status = "default";

          if (record) {
            if (record.isAbsent || !record.arrivalTime) status = "absent";
            else if (record.isLate || record.late) status = "late";
            else status = "present";
          }

          return { day: dayNum, status };
        });

        return (
          <div key={key}>
            <h3 className="text-lg font-semibold mb-2">{monthName} {year}</h3>

            {/* Weekday labels */}
            <div className="grid grid-cols-7 gap-1 text-center text-xs font-semibold text-gray-500">
              {["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"].map(d => (
                <div key={d}>{d}</div>
              ))}
            </div>

            {/* Attendance days */}
            <div className="grid grid-cols-7 gap-1">
              {daysWithStatus.map(({ day, status }) => (
                <div
                  key={day}
                  title={`Day ${day} - ${status}`}
                  className={`py-3 rounded ${STATUS_COLOR[status]} hover:scale-105 transition-transform cursor-default`}
                >
                  {day}
                </div>
              ))}
            </div>
          </div>
        );
      })}
    </div>
  );
};

export default AttendanceCalendar;
