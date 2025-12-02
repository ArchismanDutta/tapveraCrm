// File: components/dashboard/AttendanceCalendar.jsx
import React from "react";

// Color mapping for attendance status
const STATUS_COLOR = {
  present: "bg-green-500 text-white",
  absent: "bg-red-500 text-white",
  late: "bg-yellow-400 text-black",
  "half-day": "bg-violet-500 text-white",
  "half-day-leave": "bg-violet-600 text-white",
  wfh: "bg-fuchsia-500 text-white",
  "paid-leave": "bg-emerald-500 text-white",
  "unpaid-leave": "bg-rose-500 text-white",
  "sick-leave": "bg-orange-500 text-white",
  "maternity-leave": "bg-pink-500 text-white",
  leave: "bg-purple-500 text-white",
  default: "bg-gray-400 text-white",
};

const AttendanceCalendar = ({ dailyData = [] }) => {
  if (!dailyData || dailyData.length === 0) {
    return (
      <p className="text-gray-400 italic text-center py-4">
        No attendance data available.
      </p>
    );
  }

  // Group data by year-month
  const groupedByMonth = dailyData.reduce((acc, record) => {
    const date = new Date(record.date);
    const key = `${date.getFullYear()}-${date.getMonth()}`;
    if (!acc[key]) acc[key] = [];
    acc[key].push(record);
    return acc;
  }, {});

  return (
    <div className="space-y-12">
      {Object.entries(groupedByMonth).map(([key, records]) => {
        const [year, month] = key.split("-");
        const monthName = new Date(year, month).toLocaleString("default", {
          month: "long",
        });
        const maxDays = new Date(year, parseInt(month, 10) + 1, 0).getDate();

        // Prepare days with status
        const daysWithStatus = Array.from({ length: maxDays }, (_, i) => {
          const dayNum = i + 1;
          const record = records.find(
            (r) => new Date(r.date).getDate() === dayNum
          );
          let status = "default";
          let tooltip = `Day ${dayNum}`;

          if (record) {
            // Check for WFH first
            if (record.isWFH || record.leave?.isWFH) {
              status = "wfh";
              tooltip += " - Work From Home";
            }
            // Check for half-day leave
            else if (record.leave?.isHalfDayLeave || record.leave?.leaveType === 'halfDay') {
              status = "half-day-leave";
              tooltip += " - Half Day Leave (4-4.5 hours)";
            }
            // Check for other leaves
            else if (record.leave?.isOnLeave) {
              if (record.leave?.isPaidLeave || record.leave?.leaveType === 'paid') {
                status = "paid-leave";
                tooltip += " - Paid Leave";
              } else if (record.leave?.leaveType === 'unpaid') {
                status = "unpaid-leave";
                tooltip += " - Unpaid Leave";
              } else if (record.leave?.leaveType === 'sick') {
                status = "sick-leave";
                tooltip += " - Sick Leave";
              } else if (record.leave?.leaveType === 'maternity') {
                status = "maternity-leave";
                tooltip += " - Maternity Leave";
              } else {
                status = "leave";
                tooltip += ` - ${record.leave?.leaveType || "Leave"}`;
              }
            }
            // Check for absence
            else if (record.isAbsent || !record.arrivalTime) {
              status = "absent";
              tooltip += " - Absent";
            }
            // Check for half-day work (automatic)
            else if (record.isHalfDay) {
              status = "half-day";
              tooltip += ` - Half Day (${record.arrivalTime} - ${record.departureTime || "N/A"})`;
            }
            // Check for late
            else if (record.isLate || record.late) {
              status = "late";
              tooltip += ` - Late (${record.arrivalTime})`;
            }
            // Present
            else {
              status = "present";
              tooltip += ` - Present (${record.arrivalTime} - ${record.departureTime || "N/A"})`;
            }

            // Append break details if available
            const breakSeconds = record.breakDurationSeconds || 0;
            if (breakSeconds > 0) {
              const minutes = Math.round(breakSeconds / 60);
              const h = Math.floor(minutes / 60);
              const m = minutes % 60;
              tooltip += ` • Break: ${h}h ${m.toString().padStart(2, "0")}m`;
            }
          }

          return { day: dayNum, status, tooltip };
        });

        return (
          <div key={key}>
            <h3 className="text-lg md:text-xl font-semibold mb-4 text-gray-200">
              {monthName} {year}
            </h3>

            {/* Weekday labels */}
            <div className="grid grid-cols-7 gap-2 text-center text-xs md:text-sm font-semibold text-gray-400 mb-2">
              {["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"].map((d) => (
                <div key={d} className="py-1 md:py-2">
                  {d}
                </div>
              ))}
            </div>

            {/* Attendance grid */}
            <div className="grid grid-cols-7 gap-2">
              {daysWithStatus.map(({ day, status, tooltip }) => (
                <div
                  key={day}
                  title={tooltip}
                  className={`py-2 md:py-3 rounded-lg flex items-center justify-center text-sm md:text-base font-medium ${STATUS_COLOR[status]} shadow-md hover:scale-105 transition-transform cursor-default`}
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
