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

  const formatTime = (time) =>
    time ? new Date(time).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }) : "-";

  const getRowClass = () => {
    if (currentlyWorking) {
      return "bg-gradient-to-r from-green-600/20 to-emerald-600/20 border border-green-500/40 text-green-200";
    } else if (onBreak) {
      return "bg-gradient-to-r from-yellow-600/20 to-orange-600/20 border border-yellow-500/40 text-yellow-200";
    } else {
      return "bg-gray-800 border border-gray-700 text-gray-300";
    }
  };

  return (
    <tr
      className={`border-b border-gray-700 hover:bg-gray-700 transition-colors duration-300 ease-in-out cursor-default backdrop-blur-sm ${getRowClass()}`}
      title={`${name} (${employeeId})`}
    >
      <td className="py-3 px-4 whitespace-nowrap font-mono text-xs">
        <div className="flex items-center space-x-2">
          <span className="w-7 h-7 bg-purple-700 rounded-full flex items-center justify-center text-xs font-bold text-white">
            {employeeId?.toString().slice(-2) || "ID"}
          </span>
          <span>{employeeId}</span>
        </div>
      </td>

      <td className="py-3 px-4 whitespace-normal text-sm">
        <div className="flex items-center space-x-2">
          <div className="w-7 h-7 bg-gradient-to-br from-purple-500 to-pink-500 rounded-full flex items-center justify-center text-white text-xs font-bold">
            {name?.charAt(0).toUpperCase() || "?"}
          </div>
          <span className="font-medium">{name}</span>
        </div>
      </td>

      <td className="py-3 px-4 whitespace-nowrap text-sm">
        <div className="flex items-center space-x-2">
          <span className="text-lg">🔓</span>
          <span className="font-mono">{formatTime(arrivalTime)}</span>
        </div>
      </td>

      <td className="py-3 px-4 whitespace-nowrap text-sm">
        <div className="flex items-center space-x-2">
          <span className="text-lg">{punchOutTime ? "🔒" : "⏳"}</span>
          <span className="font-mono">{formatTime(punchOutTime)}</span>
        </div>
      </td>

      <td className="py-3 px-4 whitespace-nowrap text-sm">
        {onBreak ? (
          <span className="inline-flex items-center space-x-1 bg-gradient-to-r from-yellow-500 to-orange-500 text-white px-3 py-1 rounded-full font-semibold text-xs shadow-lg">
            <span>☕</span>
            <span>On Break</span>
          </span>
        ) : (
          <span className="inline-flex items-center space-x-1 text-gray-500 text-xs">
            <span>✅</span>
            <span>Available</span>
          </span>
        )}
      </td>

      <td className="py-3 px-4 whitespace-normal text-sm">
        {onBreak ? (
          <span className="inline-flex items-center space-x-1 bg-white/10 px-2 py-1 rounded-lg text-xs">
            <span>📝</span>
            <span>{breakType || "General"}</span>
          </span>
        ) : (
          <span className="text-gray-500 text-xs">-</span>
        )}
      </td>

      <td className="py-3 px-4 whitespace-nowrap font-mono text-center text-sm">
        <div className="flex items-center justify-center space-x-1">
          <span className="text-lg">⏱️</span>
          <span className="font-bold">{breakDurationMinutes ?? "0"}</span>
          <span className="text-xs opacity-70">min</span>
        </div>
      </td>

      <td
        className="py-3 px-4 whitespace-nowrap font-mono text-center text-sm"
        title="Total work hours and minutes"
      >
        <div className="flex items-center justify-center space-x-1">
          <span className="text-lg">💼</span>
          <span className="font-bold">{workDuration || "0:00"}</span>
        </div>
      </td>

      <td className="py-3 px-4 whitespace-nowrap text-sm">
        {currentlyWorking ? (
          <span className="inline-flex items-center space-x-1 bg-gradient-to-r from-green-500 to-emerald-500 text-white px-3 py-1 rounded-full font-semibold text-xs shadow-lg animate-pulse">
            <span>🔄</span>
            <span>Working</span>
          </span>
        ) : (
          <span className="inline-flex items-center space-x-1 bg-gray-600/50 text-gray-300 px-3 py-1 rounded-full text-xs">
            <span>⏸️</span>
            <span>Offline</span>
          </span>
        )}
      </td>
    </tr>
  );
};

export default EmployeeRow;
