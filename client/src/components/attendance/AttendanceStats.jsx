import React from "react";
import { Clock, Target, TrendingUp, CheckCircle } from "lucide-react";

const AttendanceStats = ({ stats }) => {
  if (!stats) {
    return (
      <div className="grid grid-cols-2 sm:grid-cols-3 gap-4 mb-4">
        {Array(3).fill(0).map((_, i) => (
          <div
            key={i}
            className="bg-[#161c2c] rounded-xl shadow-md px-6 py-4 flex flex-col items-center border border-[#232945] animate-pulse"
          >
            <div className="w-8 h-6 bg-gray-700 rounded mb-2"></div>
            <div className="w-16 h-3 bg-gray-700 rounded"></div>
          </div>
        ))}
      </div>
    );
  }

  // Helper functions
  const getAttendanceRateColor = (rate) => {
    if (rate >= 90) return "text-green-400";
    if (rate >= 75) return "text-yellow-400";
    return "text-red-400";
  };

  const getPresentDaysColor = (present, total) => {
    const rate = total > 0 ? (present / total) * 100 : 0;
    if (rate >= 90) return "text-green-400";
    if (rate >= 75) return "text-yellow-400";
    return "text-red-400";
  };

  const getWorkingHoursColor = (hours) => {
    const numHours = parseFloat(hours);
    if (numHours >= 40) return "text-green-400";
    if (numHours >= 30) return "text-yellow-400";
    return "text-purple-400";
  };

  return (
    <div className="grid grid-cols-2 sm:grid-cols-3 gap-4 mb-4">
      {/* Attendance Rate */}
      <div className="bg-[#161c2c] rounded-xl shadow-md px-6 py-4 flex flex-col items-center border border-[#232945] hover:shadow-lg transition-shadow duration-200">
        <div className="flex items-center gap-2 mb-2">
          <TrendingUp className="w-4 h-4 text-orange-400" />
          <span className={`font-bold text-xl ${getAttendanceRateColor(stats.attendanceRate)}`}>
            {stats.attendanceRate}%
          </span>
        </div>
        <span className="text-xs text-gray-400 text-center">Attendance Rate</span>
        <span className="text-xs text-gray-500 mt-1">{stats.period || "This week"}</span>
      </div>

      {/* Present Days */}
      <div className="bg-[#161c2c] rounded-xl shadow-md px-6 py-4 flex flex-col items-center border border-[#232945] hover:shadow-lg transition-shadow duration-200">
        <div className="flex items-center gap-2 mb-2">
          <CheckCircle className="w-4 h-4 text-green-400" />
          <span className={`font-bold text-xl ${getPresentDaysColor(stats.presentDays, stats.totalDays)}`}>
            {stats.presentDays}/{stats.totalDays}
          </span>
        </div>
        <span className="text-xs text-gray-400 text-center">Present Days</span>
        <div className="text-xs text-gray-500 mt-1 text-center">
          <div>Last updated: {stats.lastUpdated}</div>
          {stats.totalWorkingDaysInWeek !== undefined &&
            stats.totalWorkingDaysInWeek !== stats.totalDays && (
              <div className="text-xs text-blue-400">
                {stats.totalWorkingDaysInWeek} working days expected
              </div>
            )}
        </div>
      </div>

      {/* Working Hours */}
      <div className="bg-[#161c2c] rounded-xl shadow-md px-6 py-4 flex flex-col items-center border border-[#232945] hover:shadow-lg transition-shadow duration-200">
        <div className="flex items-center gap-2 mb-2">
          <Clock className="w-4 h-4 text-purple-400" />
          <span className={`font-bold text-xl ${getWorkingHoursColor(stats.workingHours)}`}>
            {stats.workingHours}h
          </span>
        </div>
        <span className="text-xs text-gray-400 text-center">Working Hours</span>
        <div className="text-xs text-gray-500 mt-1 text-center">
          <div>{stats.period || "This week"}</div>
          {parseFloat(stats.workingHours) > 0 && (
            <div className="text-xs text-blue-400">
              ~{Math.round((parseFloat(stats.workingHours) / Math.max(stats.presentDays, 1)) * 10) / 10}h avg/day
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default AttendanceStats;
