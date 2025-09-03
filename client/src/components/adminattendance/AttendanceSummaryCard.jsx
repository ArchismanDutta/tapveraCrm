// File: components/adminattendance/AttendanceSummaryCard.jsx
import React from "react";
import {
  ClockIcon,
  PauseIcon,
  ExclamationCircleIcon,
  XCircleIcon,
  CalendarIcon,
  CalendarDaysIcon,
  ArrowDownIcon,
  ArrowUpIcon,
} from "@heroicons/react/24/outline";

const AttendanceSummaryCard = ({ summary = {} }) => {
  // Default summary values
  const {
    totalWorkHours = "0h 0m",
    totalBreakHours = "0h 0m",
    lateDays = 0,
    absentDays = 0,
    leavesTaken = 0,
    totalDays = 0,
    firstPunchIn = "-",
    lastPunchOut = "-",
  } = summary;

  // Convert 24-hour HH:MM to 12-hour format with AM/PM
  const format12HourTime = (timeStr) => {
    if (!timeStr || timeStr === "-") return "-";
    const [hoursStr, minutesStr] = timeStr.split(":");
    let hours = parseInt(hoursStr, 10);
    const minutes = minutesStr;
    const ampm = hours >= 12 ? "PM" : "AM";
    hours = hours % 12 || 12;
    return `${hours}:${minutes} ${ampm}`;
  };

  const summaryItems = [
    {
      label: "Total Work Hours",
      value: totalWorkHours,
      icon: <ClockIcon className="w-6 h-6 text-white" />,
      gradient: "from-green-400 to-green-600",
    },
    {
      label: "Total Break Hours",
      value: totalBreakHours,
      icon: <PauseIcon className="w-6 h-6 text-white" />,
      gradient: "from-yellow-400 to-yellow-600",
    },
    {
      label: "Late Days",
      value: lateDays,
      icon: <ExclamationCircleIcon className="w-6 h-6 text-white" />,
      gradient: "from-orange-400 to-orange-600",
    },
    {
      label: "Absent Days",
      value: absentDays,
      icon: <XCircleIcon className="w-6 h-6 text-white" />,
      gradient: "from-red-400 to-red-600",
    },
    {
      label: "Leaves Taken",
      value: leavesTaken,
      icon: <CalendarIcon className="w-6 h-6 text-white" />,
      gradient: "from-purple-400 to-purple-600",
    },
    {
      label: "Total Days",
      value: totalDays,
      icon: <CalendarDaysIcon className="w-6 h-6 text-white" />,
      gradient: "from-blue-400 to-blue-600",
    },
    {
      label: "Punch In",
      value: format12HourTime(firstPunchIn),
      icon: <ArrowDownIcon className="w-6 h-6 text-white" />,
      gradient: "from-teal-400 to-teal-600",
    },
    {
      label: "Punch Out",
      value: format12HourTime(lastPunchOut),
      icon: <ArrowUpIcon className="w-6 h-6 text-white" />,
      gradient: "from-pink-400 to-pink-600",
    },
  ];

  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-6 mb-6">
      {summaryItems.map(({ label, value, icon, gradient }) => (
        <div
          key={label}
          title={label}
          className={`flex items-center p-5 rounded-xl shadow-lg bg-gradient-to-r ${gradient} hover:scale-105 transition-transform cursor-default`}
        >
          <div className="mr-4 flex-shrink-0">{icon}</div>
          <div className="text-white truncate">
            <h3 className="font-medium text-sm sm:text-base truncate">{label}</h3>
            <p className="text-2xl font-bold mt-1 truncate">{value}</p>
          </div>
        </div>
      ))}
    </div>
  );
};

export default AttendanceSummaryCard;
