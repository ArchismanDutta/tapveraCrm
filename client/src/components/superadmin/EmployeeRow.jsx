// EmployeeRow.jsx (Updated for compact spacing and responsive table)

import React from "react";

const EmployeeRow = ({ employee }) => {
  const {
    employeeId,
    name,
    arrivalTime,
    punchOutTime,
    onBreak,
    breakDurationMinutes,
    breakType,
    workDuration,
    currentlyWorking,
  } = employee;

  const rowClass = currentlyWorking
    ? "bg-[#22332A] text-green-300"
    : onBreak
    ? "bg-[#3A3322] text-yellow-200"
    : "bg-[#232848] text-white";

  const formatTime = (time) =>
    time ? new Date(time).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }) : "-";

  return (
    <tr
      className={`border-b border-[#313A53] hover:bg-[#2C3363]/80 transition-colors duration-300 ease-in-out ${rowClass} cursor-default`}
      title={`${name} (${employeeId})`}
    >
      <td className="py-1.5 px-2 whitespace-nowrap font-mono text-xs">{employeeId}</td>
      <td className="py-1.5 px-2 whitespace-normal text-xs">{name}</td>
      <td className="py-1.5 px-2 whitespace-nowrap text-xs">{formatTime(arrivalTime)}</td>
      <td className="py-1.5 px-2 whitespace-nowrap text-xs">{formatTime(punchOutTime)}</td>
      <td className="py-1.5 px-2 whitespace-nowrap text-xs">
        {onBreak ? (
          <span className="inline-block bg-yellow-600 bg-opacity-80 text-yellow-100 px-1.5 py-0.5 rounded-full font-semibold text-[10px] select-none">
            Yes
          </span>
        ) : (
          <span className="text-gray-400 select-none text-xs">No</span>
        )}
      </td>
      <td className="py-1.5 px-2 whitespace-normal text-xs">{onBreak ? breakType || "-" : ""}</td>
      <td className="py-1.5 px-2 whitespace-nowrap font-mono text-center text-xs">{breakDurationMinutes ?? "0"}</td>
      <td
        className="py-1.5 px-2 whitespace-nowrap font-mono text-center text-xs"
        title="Total work hours and minutes"
      >
        {workDuration || "-"}
      </td>
      <td className="py-1.5 px-2 whitespace-nowrap text-xs">
        {currentlyWorking ? (
          <span className="inline-block bg-green-600 bg-opacity-90 text-green-100 px-1.5 py-0.5 rounded-full font-semibold text-[10px] select-none">
            Yes
          </span>
        ) : (
          <span className="text-gray-400 select-none text-xs">No</span>
        )}
      </td>
    </tr>
  );
};

export default EmployeeRow;
