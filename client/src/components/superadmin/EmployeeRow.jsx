import React from "react";
import { attendanceUtils } from "../../api.js";
import {
  Lock,
  Unlock,
  Coffee,
  CheckCircle,
  FileText,
  Timer,
  Briefcase,
  Zap,
  PauseCircle,
  Hourglass
} from "lucide-react";

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

  const formatTime = (time) => {
    if (!time) return "-";
    return attendanceUtils.formatTime(time);
  };

  // Get standardized arrival time
  const arrivalTimeStandardized = attendanceUtils.getArrivalTime(employee) || arrivalTime;
  const departureTimeStandardized = attendanceUtils.getDepartureTime(employee) || punchOutTime;

  const getRowClass = () => {
    // Simple logic: Green if working, Yellow if on break, Violet if punched out, Normal for rest
    if (currentlyWorking && !onBreak) {
      // Working employees - Green
      return "bg-gradient-to-r from-green-600/20 to-emerald-600/20 border border-green-500/30 text-green-100 shadow-md hover:shadow-lg hover:shadow-green-500/30 hover:from-green-600/30 hover:to-emerald-600/30";
    } else if (onBreak) {
      // On break employees - Yellow
      return "bg-gradient-to-r from-yellow-600/20 to-orange-600/20 border border-yellow-500/30 text-yellow-100 shadow-md hover:shadow-lg hover:shadow-yellow-500/30 hover:from-yellow-600/30 hover:to-orange-600/30";
    } else if (punchOutTime) {
      // Punched out employees - Violet
      return "bg-gradient-to-r from-purple-600/15 to-violet-600/15 border border-purple-500/30 text-purple-200 hover:shadow-md hover:shadow-purple-500/20 hover:from-purple-600/25 hover:to-violet-600/25";
    } else {
      // Normal for rest
      return "bg-gradient-to-r from-slate-800/50 to-slate-900/50 border border-slate-700/50 text-gray-300 hover:bg-slate-700/50 hover:border-slate-600/50 hover:shadow-md";
    }
  };

  return (
    <tr
      className={`border-b border-gray-700/50 transition-all duration-300 ease-in-out cursor-default backdrop-blur-sm hover:scale-[1.01] hover:z-10 relative ${getRowClass()}`}
      title={`${name} (${employeeId})`}
    >
      <td className="py-3 px-3 whitespace-nowrap font-mono text-xs">
        <div className="flex items-center space-x-2">
          <span className="w-7 h-7 bg-gradient-to-br from-purple-600 to-violet-700 rounded-full flex items-center justify-center text-xs font-bold text-white shadow-md shadow-purple-500/30 ring-2 ring-purple-500/20">
            {employeeId?.toString().slice(-2) || "ID"}
          </span>
          <span className="font-semibold text-xs">{employeeId}</span>
        </div>
      </td>

      <td className="py-3 px-3 whitespace-normal text-sm">
        <div className="flex items-center space-x-2">
          <div className="w-8 h-8 bg-gradient-to-br from-cyan-500 via-blue-500 to-purple-600 rounded-full flex items-center justify-center text-white text-sm font-bold shadow-md shadow-blue-500/30 ring-2 ring-blue-500/20">
            {name?.charAt(0).toUpperCase() || "?"}
          </div>
          <span className="font-semibold text-sm">{name}</span>
        </div>
      </td>

      <td className="py-3 px-3 whitespace-nowrap text-sm">
        <div className="flex items-center space-x-2">
          <div className="w-7 h-7 bg-gradient-to-br from-green-500 to-emerald-600 rounded-lg flex items-center justify-center shadow-md shadow-green-500/30 ring-2 ring-green-500/20">
            <Unlock className="h-3.5 w-3.5 text-white" />
          </div>
          <span className="font-mono text-xs font-semibold">{formatTime(arrivalTimeStandardized)}</span>
        </div>
      </td>

      <td className="py-3 px-3 whitespace-nowrap text-sm">
        <div className="flex items-center space-x-2">
          <div className={`w-7 h-7 rounded-lg flex items-center justify-center shadow-md ring-2 ${
            departureTimeStandardized
              ? 'bg-gradient-to-br from-red-500 to-orange-600 shadow-red-500/30 ring-red-500/20'
              : 'bg-gradient-to-br from-amber-500 to-yellow-600 shadow-yellow-500/30 ring-yellow-500/20'
          }`}>
            {departureTimeStandardized ? (
              <Lock className="h-3.5 w-3.5 text-white" />
            ) : (
              <Hourglass className="h-3.5 w-3.5 text-white" />
            )}
          </div>
          <span className="font-mono text-xs font-semibold">{formatTime(departureTimeStandardized)}</span>
        </div>
      </td>

      <td className="py-3 px-3 whitespace-nowrap text-sm">
        {onBreak ? (
          <span className="inline-flex items-center space-x-1.5 bg-gradient-to-r from-yellow-500 to-orange-500 text-white px-3 py-1 rounded-full font-semibold text-xs shadow-lg shadow-yellow-500/40">
            <Coffee className="h-3 w-3" />
            <span>On Break</span>
          </span>
        ) : (
          <span className="inline-flex items-center space-x-1.5 bg-gradient-to-r from-emerald-500/20 to-green-500/20 text-emerald-400 px-3 py-1 rounded-full font-medium text-xs border border-emerald-500/30 shadow-sm">
            <CheckCircle className="h-3 w-3" />
            <span>Available</span>
          </span>
        )}
      </td>

      <td className="py-3 px-3 whitespace-normal text-sm">
        {onBreak ? (
          <span className="inline-flex items-center space-x-1.5 bg-white/10 px-2 py-1 rounded-lg text-xs border border-white/20 backdrop-blur-sm">
            <FileText className="h-3 w-3" />
            <span className="text-xs">{breakType || "General"}</span>
          </span>
        ) : (
          <span className="text-gray-500 text-xs font-medium">-</span>
        )}
      </td>

      <td className="py-3 px-3 whitespace-nowrap font-mono text-center text-sm">
        <div className="flex items-center justify-center space-x-2">
          <div className="w-7 h-7 bg-gradient-to-br from-orange-500 to-amber-600 rounded-lg flex items-center justify-center shadow-md shadow-orange-500/30 ring-2 ring-orange-500/20">
            <Timer className="h-3.5 w-3.5 text-white" />
          </div>
          <div className="flex items-center space-x-1">
            <span className="font-bold text-sm">
              {attendanceUtils.calculateBreakMinutes(employee, onBreak)}
            </span>
            <span className="text-xs opacity-70">m</span>
            {onBreak && (
              <div className="w-1.5 h-1.5 bg-orange-400 rounded-full animate-pulse ml-1 shadow-sm shadow-orange-400/50" title="Real-time break tracking"></div>
            )}
          </div>
        </div>
      </td>

      <td
        className="py-3 px-3 whitespace-nowrap font-mono text-center text-sm"
        title="Total work hours and minutes"
      >
        <div className="flex items-center justify-center space-x-2">
          <div className="w-7 h-7 bg-gradient-to-br from-blue-500 to-cyan-600 rounded-lg flex items-center justify-center shadow-md shadow-blue-500/30 ring-2 ring-blue-500/20">
            <Briefcase className="h-3.5 w-3.5 text-white" />
          </div>
          <div className="flex items-center space-x-1">
            <span className="font-bold text-sm">{workDuration || "0:00"}</span>
            {currentlyWorking && (
              <div className="w-1.5 h-1.5 bg-green-400 rounded-full animate-pulse ml-1 shadow-sm shadow-green-400/50" title="Real-time work tracking"></div>
            )}
          </div>
        </div>
      </td>

      <td className="py-3 px-3 whitespace-nowrap text-sm">
        {currentlyWorking && !onBreak ? (
          <span className="inline-flex items-center space-x-1.5 bg-gradient-to-r from-green-500 to-emerald-500 text-white px-3 py-1.5 rounded-full font-semibold text-xs shadow-lg shadow-green-500/40 animate-pulse ring-2 ring-green-400/30">
            <Zap className="h-3.5 w-3.5" />
            <span>Working</span>
          </span>
        ) : onBreak ? (
          <span className="inline-flex items-center space-x-1.5 bg-gradient-to-r from-yellow-500 to-orange-500 text-white px-3 py-1.5 rounded-full font-semibold text-xs shadow-lg shadow-yellow-500/40 ring-2 ring-yellow-400/30">
            <Coffee className="h-3.5 w-3.5" />
            <span>On Break</span>
          </span>
        ) : punchOutTime ? (
          <span className="inline-flex items-center space-x-1.5 bg-gradient-to-r from-purple-500 to-violet-500 text-white px-3 py-1.5 rounded-full font-semibold text-xs shadow-lg shadow-purple-500/40 ring-2 ring-purple-400/30">
            <Lock className="h-3.5 w-3.5" />
            <span>Punched Out</span>
          </span>
        ) : (
          <span className="inline-flex items-center space-x-1.5 bg-gradient-to-r from-gray-600/50 to-slate-600/50 text-gray-300 px-3 py-1.5 rounded-full font-medium text-xs border border-gray-500/30 shadow-sm">
            <PauseCircle className="h-3.5 w-3.5" />
            <span>Offline</span>
          </span>
        )}
      </td>
    </tr>
  );
};

export default EmployeeRow;
