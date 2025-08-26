import React from "react";

const AttendanceStats = ({ stats }) => (
  <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 mb-4">
    <div className="bg-[#161c2c] rounded-xl shadow-md px-6 py-4 flex flex-col items-center border border-[#232945]">
      <span className="text-orange-400 font-bold text-xl">{stats.attendanceRate}%</span>
      <span className="text-xs text-gray-400 mt-1">Attendance Rate</span>
    </div>
    <div className="bg-[#161c2c] rounded-xl shadow-md px-6 py-4 flex flex-col items-center border border-[#232945]">
      <span className="text-green-400 font-bold text-xl">{stats.presentDays}/{stats.totalDays}</span>
      <span className="text-xs text-gray-400 mt-1">Present Days</span>
      <span className="text-xs text-gray-500">Last updated: {stats.lastUpdated}</span>
    </div>
    <div className="bg-[#161c2c] rounded-xl shadow-md px-6 py-4 flex flex-col items-center border border-[#232945]">
      <span className="text-purple-400 font-bold text-xl">{stats.workingHours}h</span>
      <span className="text-xs text-gray-400 mt-1">Working Hours</span>
      <span className="text-xs text-gray-500">{stats.period}</span>
    </div>
    <div className="bg-[#161c2c] rounded-xl shadow-md px-6 py-4 flex flex-col items-center border border-[#232945]">
      <span className="text-yellow-400 font-bold text-xl">{stats.onTimeRate}%</span>
      <span className="text-xs text-gray-400 mt-1">On-Time Rate</span>
      <span className="text-xs text-gray-500">Last 30 days</span>
    </div>
  </div>
);

export default AttendanceStats;
