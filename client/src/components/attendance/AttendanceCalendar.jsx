import React from "react";

const STATUS_COLOR = {
  present: "bg-green-700 text-green-200 cursor-pointer",
  absent: "bg-red-700 text-red-200 cursor-pointer",
  late: "bg-yellow-700 text-yellow-200 cursor-pointer",
  holiday: "bg-gray-700 text-gray-300 cursor-pointer",
  leave: "bg-purple-500 text-purple-200 cursor-pointer",
  default: "bg-blue-700 text-blue-200 cursor-pointer",
};

const AttendanceCalendar = ({ data }) => {
  if (!data) return null;

  const daysOfWeek = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
  const monthIndex = new Date(`${data.month} 1, ${data.year}`).getMonth();
  const maxDays = new Date(data.year, monthIndex + 1, 0).getDate();
  const blanks = Array(data.startDayOfWeek).fill(null);

  // Prepare days array with fallback status 'default'
  const days = Array.from({ length: maxDays }, (_, i) => {
    const dayNum = i + 1;
    const dayObj = data.days.find((d) => d.day === dayNum);
    const status = dayObj?.status || "default";
    const name = dayObj?.name || null;
    return { day: dayNum, status, name };
  });

  return (
    <div className="bg-[#161c2c] rounded-xl shadow-md p-4 w-full border border-[#232945]">
      <div className="flex justify-between items-center mb-4">
        <h3 className="font-semibold text-lg text-gray-100">
          {data.month} {data.year}
        </h3>
      </div>

      <div className="grid grid-cols-7 gap-2 mb-2">
        {daysOfWeek.map((d) => (
          <div
            key={d}
            className="text-xs font-semibold text-center text-gray-400"
          >
            {d}
          </div>
        ))}
      </div>

      <div className="grid grid-cols-7 gap-2">
        {/* Blank days */}
        {blanks.map((_, idx) => (
          <div key={`blank-${idx}`} className="h-10 rounded-lg" />
        ))}

        {/* Days */}
        {days.map(({ day, status, name }) => (
          <div
            key={day}
            title={
              status === "holiday" && name
                ? name
                : status === "leave"
                ? "Approved Leave"
                : undefined
            }
            className={`h-10 rounded-lg flex justify-center items-center font-medium select-none cursor-default ${
              STATUS_COLOR[status] || STATUS_COLOR.default
            }`}
          >
            {day}
            {/* {(status === "holiday" || status === "leave") && (
              <span
                className="ml-1 text-xs font-normal text-current"
                title={status === "holiday" ? name : "Approved Leave"}
              >
                ★
              </span>
            )} */}
          </div>
        ))}
      </div>
    </div>
  );
};

export default AttendanceCalendar;
