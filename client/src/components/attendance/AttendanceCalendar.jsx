import React from "react";

const STATUS_COLOR = {
  present: "bg-green-700 text-green-200",
  absent: "bg-red-700 text-red-200",
  late: "bg-yellow-700 text-yellow-200",
  default: "bg-gray-700 text-gray-300",
};

const AttendanceCalendar = ({ data }) => {
  const daysOfWeek = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
  const maxDays = new Date(data.year, new Date(`${data.month} 1, ${data.year}`).getMonth() + 1, 0).getDate();
  const blanks = Array(data.startDayOfWeek).fill(null);
  const days = Array.from({ length: maxDays }, (_, i) => {
    const dayStatusObj = data.days.find((d) => d.day === i + 1);
    return {
      day: i + 1,
      status: dayStatusObj ? dayStatusObj.status : "default",
    };
  });

  return (
    <div className="bg-[#161c2c] rounded-xl shadow-md p-4 w-full border border-[#232945]">
      <div className="flex justify-between items-center mb-4">
        <h3 className="font-semibold text-lg text-gray-100">{data.month} {data.year}</h3>
      </div>
      <div className="grid grid-cols-7 gap-2 mb-2">
        {daysOfWeek.map((d) => (
          <div key={d} className="text-xs font-semibold text-center text-gray-400">{d}</div>
        ))}
      </div>
      <div className="grid grid-cols-7 gap-2">
        {blanks.map((_, i) => (
          <div key={`blank-${i}`} className="h-10 rounded-lg" />
        ))}
        {days.map(({ day, status }) => (
          <div
            key={day}
            className={`h-10 rounded-lg flex justify-center items-center font-medium cursor-default ${STATUS_COLOR[status] || STATUS_COLOR.default}`}
          >
            {day}
          </div>
        ))}
      </div>
    </div>
  );
};

export default AttendanceCalendar;
