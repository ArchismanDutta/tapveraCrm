import React from "react";
import {
  Calendar,
  Clock,
  TrendingUp,
  CheckCircle,
  Activity,
  Timer,
} from "lucide-react";

const AttendanceStats = ({ stats }) => {
  if (!stats) {
    return (
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-4 mb-6">
        {Array(4)
          .fill(0)
          .map((_, i) => (
            <div
              key={i}
              className="bg-[#1a1f2e] rounded-xl shadow px-6 py-4 border border-[#2a2f3e] animate-pulse"
            >
              <div className="w-8 h-6 bg-gray-700 rounded mb-2"></div>
              <div className="w-16 h-3 bg-gray-700 rounded mb-1"></div>
              <div className="w-12 h-2 bg-gray-800 rounded"></div>
            </div>
          ))}
      </div>
    );
  }

  // Helper functions for styling
  const getAttendanceRateColor = (rate) => {
    if (rate >= 90) return "text-green-400";
    if (rate >= 75) return "text-yellow-400";
    return "text-red-400";
  };

  const getPresentDaysColor = (present, total) => {
    if (total === 0) return "text-gray-400";
    const rate = (present / total) * 100;
    if (rate >= 90) return "text-green-400";
    if (rate >= 75) return "text-yellow-400";
    return "text-red-400";
  };

  const getWorkingHoursColor = (hours) => {
    const numHours = parseFloat(hours) || 0;
    if (numHours >= 35) return "text-green-400";
    if (numHours >= 25) return "text-yellow-400";
    return "text-purple-400";
  };

  const avgHoursPerDay =
    stats.presentDays > 0
      ? (parseFloat(stats.workingHours) / stats.presentDays).toFixed(1)
      : "0.0";

  return (
    <>
      {/* Main Stats Row */}
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-4 mb-6">
        {/* Attendance Rate */}
        <div className="bg-[#1a1f2e] rounded-xl shadow px-6 py-4 border border-[#2a2f3e] hover:border-blue-500/30 transition-all duration-300 group">
          <div className="flex items-center justify-between mb-2">
            <TrendingUp className="w-5 h-5 text-blue-400 group-hover:scale-110 transition-transform duration-200" />
            <span
              className={`font-bold text-2xl ${getAttendanceRateColor(
                stats.attendanceRate
              )}`}
            >
              {stats.attendanceRate}%
            </span>
          </div>
          <div className="space-y-1">
            <p className="text-sm text-gray-300 font-medium">Attendance Rate</p>
            <p className="text-xs text-gray-500">{stats.period}</p>
            <div className="w-full bg-gray-700 rounded-full h-1.5">
              <div
                className={`h-1.5 rounded-full transition-all duration-300 ${
                  stats.attendanceRate >= 90
                    ? "bg-green-500"
                    : stats.attendanceRate >= 75
                    ? "bg-yellow-500"
                    : "bg-red-500"
                }`}
                style={{
                  width: `${Math.min(stats.attendanceRate, 100)}%`,
                }}
              ></div>
            </div>
          </div>
        </div>

        {/* Present Days */}
        <div className="bg-[#1a1f2e] rounded-xl shadow px-6 py-4 border border-[#2a2f3e] hover:border-green-500/30 transition-all duration-300 group">
          <div className="flex items-center justify-between mb-2">
            <CheckCircle className="w-5 h-5 text-green-400 group-hover:scale-110 transition-transform duration-200" />
            <span
              className={`font-bold text-2xl ${getPresentDaysColor(
                stats.presentDays,
                stats.totalDays
              )}`}
            >
              {stats.presentDays}/{stats.totalDays}
            </span>
          </div>
          <div className="space-y-1">
            <p className="text-sm text-gray-300 font-medium">Present Days</p>
            <p className="text-xs text-gray-500">Expected working days</p>
            {stats.totalDays > 0 && (
              <div className="w-full bg-gray-700 rounded-full h-1.5">
                <div
                  className="h-1.5 bg-green-500 rounded-full transition-all duration-300"
                  style={{
                    width: `${(stats.presentDays / stats.totalDays) * 100}%`,
                  }}
                ></div>
              </div>
            )}
          </div>
        </div>

        {/* Working Hours */}
        <div className="bg-[#1a1f2e] rounded-xl shadow px-6 py-4 border border-[#2a2f3e] hover:border-purple-500/30 transition-all duration-300 group">
          <div className="flex items-center justify-between mb-2">
            <Clock className="w-5 h-5 text-purple-400 group-hover:scale-110 transition-transform duration-200" />
            <span
              className={`font-bold text-2xl ${getWorkingHoursColor(
                stats.workingHours
              )}`}
            >
              {stats.workingHours}h
            </span>
          </div>
          <div className="space-y-1">
            <p className="text-sm text-gray-300 font-medium">Working Hours</p>
            <p className="text-xs text-gray-500">{stats.period}</p>
            <p className="text-xs text-blue-400">
              ~{stats.averageHoursPerDay || avgHoursPerDay}h average/day
            </p>
          </div>
        </div>

        {/* Full Days */}
        <div className="bg-[#1a1f2e] rounded-xl shadow px-6 py-4 border border-[#2a2f3e] hover:border-emerald-500/30 transition-all duration-300 group">
          <div className="flex items-center justify-between mb-2">
            <Calendar className="w-5 h-5 text-emerald-400 group-hover:scale-110 transition-transform duration-200" />
            <span className="font-bold text-2xl text-emerald-400">
              {Math.round(parseFloat(stats.workingHours) / 8)}
            </span>
          </div>
          <div className="space-y-1">
            <p className="text-sm text-gray-300 font-medium">Full Days</p>
            <p className="text-xs text-gray-500">8+ hours worked</p>
          </div>
        </div>
      </div>

      {/* Optional Current Status Row */}
      {stats.currentStatus && (
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-4 mb-6">
          {/* Current Status */}
          <div className="bg-[#1a1f2e] rounded-xl shadow px-6 py-4 border border-[#2a2f3e] hover:border-cyan-500/30 transition-all duration-300 group">
            <div className="flex items-center justify-between mb-2">
              <Activity className="w-5 h-5 text-cyan-400 group-hover:scale-110 transition-transform duration-200" />
              <span
                className={`font-bold text-2xl ${
                  stats.currentStatus.isWorking
                    ? "text-green-400"
                    : stats.currentStatus.onBreak
                    ? "text-yellow-400"
                    : "text-gray-400"
                }`}
              >
                {stats.currentStatus.isWorking
                  ? "WORK"
                  : stats.currentStatus.onBreak
                  ? "BREAK"
                  : "OFF"}
              </span>
            </div>
            <div className="space-y-1">
              <p className="text-sm text-gray-300 font-medium">Current Status</p>
              <p className="text-xs text-gray-500">Live status</p>
            </div>
          </div>

          {/* Today's Hours */}
          <div className="bg-[#1a1f2e] rounded-xl shadow px-6 py-4 border border-[#2a2f3e] hover:border-indigo-500/30 transition-all duration-300 group">
            <div className="flex items-center justify-between mb-2">
              <Timer className="w-5 h-5 text-indigo-400 group-hover:scale-110 transition-transform duration-200" />
              <span className="font-bold text-2xl text-indigo-400">
                {stats.currentStatus.todayHours}h
              </span>
            </div>
            <div className="space-y-1">
              <p className="text-sm text-gray-300 font-medium">Today's Hours</p>
              <p className="text-xs text-gray-500">
                {stats.currentStatus.arrivalTime
                  ? `In: ${stats.currentStatus.arrivalTime}`
                  : "Not clocked in"}
              </p>
            </div>
          </div>
        </div>
      )}
    </>
  );
};

export default AttendanceStats;
