import React, { useState, useMemo } from "react";
import {
  Calendar,
  Clock,
  TrendingUp,
  CheckCircle,
  Activity,
  Timer,
  Filter,
  CalendarDays,
} from "lucide-react";

const AttendanceStats = ({ stats, onDateFilterChange }) => {
  const [dateFilter, setDateFilter] = useState('month');
  const [showFilters, setShowFilters] = useState(false);

  // Handle date filter change
  const handleFilterChange = (filter) => {
    setDateFilter(filter);
    if (onDateFilterChange) {
      onDateFilterChange(filter);
    }
  };

  // Calculate filtered stats based on date filter
  const filteredStats = useMemo(() => {
    if (!stats) return null;

    // For now, return the stats as-is since the filtering is handled by parent
    // In a real implementation, this would filter the data based on the selected period
    return {
      ...stats,
      period: dateFilter === 'day' ? 'Today' :
              dateFilter === 'week' ? 'This week' :
              dateFilter === 'month' ? 'This month' : stats.period
    };
  }, [stats, dateFilter]);

  if (!filteredStats) {
    return (
      <div className="bg-gradient-to-br from-slate-800/50 to-slate-900/50 backdrop-blur-sm border border-slate-600/30 rounded-2xl p-6">
        <div className="flex items-center justify-between mb-6">
          <h3 className="text-xl font-semibold text-white flex items-center gap-3">
            <TrendingUp className="w-6 h-6 text-cyan-400" />
            Attendance Statistics
          </h3>
          <div className="flex items-center gap-2">
            <button
              onClick={() => setShowFilters(!showFilters)}
              className="p-2 bg-slate-700/50 hover:bg-slate-600/50 rounded-lg transition-all duration-200"
              title="Filter Options"
            >
              <Filter className="w-4 h-4 text-gray-400" />
            </button>
          </div>
        </div>
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-4">
          {Array(4)
            .fill(0)
            .map((_, i) => (
              <div
                key={i}
                className="bg-slate-700/30 rounded-xl px-6 py-4 border border-slate-600/30 animate-pulse"
              >
                <div className="w-8 h-6 bg-slate-600 rounded mb-2"></div>
                <div className="w-16 h-3 bg-slate-600 rounded mb-1"></div>
                <div className="w-12 h-2 bg-slate-700 rounded"></div>
              </div>
            ))}
        </div>
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

  const avgHoursPerDay = filteredStats && filteredStats.presentDays > 0
      ? (parseFloat(filteredStats.workingHours) / filteredStats.presentDays).toFixed(1)
      : "0.0";

  return (
    <div className="bg-gradient-to-br from-slate-800/50 to-slate-900/50 backdrop-blur-sm border border-slate-600/30 rounded-2xl p-6">
      {/* Header with Filter Options */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-6">
        <h3 className="text-xl font-semibold text-white flex items-center gap-3">
          <TrendingUp className="w-6 h-6 text-cyan-400" />
          Attendance Statistics
        </h3>
        <div className="flex items-center gap-2">
          <button
            onClick={() => setShowFilters(!showFilters)}
            className={`p-2 rounded-lg transition-all duration-200 ${
              showFilters
                ? 'bg-cyan-600 text-white'
                : 'bg-slate-700/50 hover:bg-slate-600/50 text-gray-400'
            }`}
            title="Filter Options"
          >
            <Filter className="w-4 h-4" />
          </button>
        </div>
      </div>

      {/* Date Filter Options */}
      {showFilters && (
        <div className="mb-6 p-4 bg-slate-700/30 rounded-xl border border-slate-600/30">
          <div className="flex flex-wrap items-center gap-2">
            <span className="text-sm text-gray-400 mr-2">Time Period:</span>
            {[
              { key: 'day', label: 'Today', icon: CalendarDays },
              { key: 'week', label: 'This Week', icon: Calendar },
              { key: 'month', label: 'This Month', icon: Calendar },
            ].map(({ key, label, icon: Icon }) => (
              <button
                key={key}
                onClick={() => handleFilterChange(key)}
                className={`flex items-center gap-2 px-3 py-2 rounded-lg text-sm font-medium transition-all duration-200 ${
                  dateFilter === key
                    ? 'bg-cyan-600 text-white shadow-lg'
                    : 'bg-slate-600/50 text-gray-300 hover:bg-slate-500/50 hover:text-white'
                }`}
              >
                <Icon className="w-4 h-4" />
                {label}
              </button>
            ))}
          </div>
        </div>
      )}

      {/* Main Stats Row */}
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-4 mb-6">
        {/* Attendance Rate */}
        <div className="bg-gradient-to-br from-blue-600/20 to-blue-800/20 backdrop-blur-sm border border-blue-500/20 rounded-xl px-6 py-4 hover:border-blue-400/40 transition-all duration-300 group">
          <div className="flex items-center justify-between mb-2">
            <TrendingUp className="w-5 h-5 text-blue-400 group-hover:scale-110 transition-transform duration-200" />
            <span
              className={`font-bold text-2xl ${getAttendanceRateColor(
                filteredStats.attendanceRate
              )}`}
            >
              {filteredStats.attendanceRate}%
            </span>
          </div>
          <div className="space-y-1">
            <p className="text-sm text-gray-300 font-medium">Attendance Rate</p>
            <p className="text-xs text-blue-300">{filteredStats.period}</p>
            <div className="w-full bg-gray-700 rounded-full h-1.5">
              <div
                className={`h-1.5 rounded-full transition-all duration-300 ${
                  filteredStats.attendanceRate >= 90
                    ? "bg-green-500"
                    : filteredStats.attendanceRate >= 75
                    ? "bg-yellow-500"
                    : "bg-red-500"
                }`}
                style={{
                  width: `${Math.min(filteredStats.attendanceRate, 100)}%`,
                }}
              ></div>
            </div>
          </div>
        </div>

        {/* Present Days */}
        <div className="bg-gradient-to-br from-green-600/20 to-green-800/20 backdrop-blur-sm border border-green-500/20 rounded-xl px-6 py-4 hover:border-green-400/40 transition-all duration-300 group">
          <div className="flex items-center justify-between mb-2">
            <CheckCircle className="w-5 h-5 text-green-400 group-hover:scale-110 transition-transform duration-200" />
            <span
              className={`font-bold text-2xl ${getPresentDaysColor(
                filteredStats.presentDays,
                filteredStats.totalDays
              )}`}
            >
              {filteredStats.presentDays}/{filteredStats.totalDays}
            </span>
          </div>
          <div className="space-y-1">
            <p className="text-sm text-gray-300 font-medium">Present Days</p>
            <p className="text-xs text-green-300">Expected working days</p>
            {filteredStats.totalDays > 0 && (
              <div className="w-full bg-gray-700 rounded-full h-1.5">
                <div
                  className="h-1.5 bg-green-500 rounded-full transition-all duration-300"
                  style={{
                    width: `${(filteredStats.presentDays / filteredStats.totalDays) * 100}%`,
                  }}
                ></div>
              </div>
            )}
          </div>
        </div>

        {/* Working Hours */}
        <div className="bg-gradient-to-br from-purple-600/20 to-purple-800/20 backdrop-blur-sm border border-purple-500/20 rounded-xl px-6 py-4 hover:border-purple-400/40 transition-all duration-300 group">
          <div className="flex items-center justify-between mb-2">
            <Clock className="w-5 h-5 text-purple-400 group-hover:scale-110 transition-transform duration-200" />
            <span
              className={`font-bold text-2xl ${getWorkingHoursColor(
                filteredStats.workingHours
              )}`}
            >
              {filteredStats.workingHours}h
            </span>
          </div>
          <div className="space-y-1">
            <p className="text-sm text-gray-300 font-medium">Working Hours</p>
            <p className="text-xs text-purple-300">{filteredStats.period}</p>
            <p className="text-xs text-blue-400">
              ~{filteredStats.averageHoursPerDay || avgHoursPerDay}h average/day
            </p>
          </div>
        </div>

        {/* Full Days */}
        <div className="bg-gradient-to-br from-emerald-600/20 to-emerald-800/20 backdrop-blur-sm border border-emerald-500/20 rounded-xl px-6 py-4 hover:border-emerald-400/40 transition-all duration-300 group">
          <div className="flex items-center justify-between mb-2">
            <Calendar className="w-5 h-5 text-emerald-400 group-hover:scale-110 transition-transform duration-200" />
            <span className="font-bold text-2xl text-emerald-400">
              {Math.round(parseFloat(filteredStats.workingHours) / 8)}
            </span>
          </div>
          <div className="space-y-1">
            <p className="text-sm text-gray-300 font-medium">Full Days</p>
            <p className="text-xs text-emerald-300">8+ hours worked</p>
          </div>
        </div>
      </div>

      {/* Optional Current Status Row */}
      {filteredStats.currentStatus && (
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-4 mb-6">
          {/* Current Status */}
          <div className="bg-gradient-to-br from-cyan-600/20 to-cyan-800/20 backdrop-blur-sm border border-cyan-500/20 rounded-xl px-6 py-4 hover:border-cyan-400/40 transition-all duration-300 group">
            <div className="flex items-center justify-between mb-2">
              <Activity className="w-5 h-5 text-cyan-400 group-hover:scale-110 transition-transform duration-200" />
              <span
                className={`font-bold text-2xl ${
                  filteredStats.currentStatus.isWorking
                    ? "text-green-400"
                    : filteredStats.currentStatus.onBreak
                    ? "text-yellow-400"
                    : "text-gray-400"
                }`}
              >
                {filteredStats.currentStatus.isWorking
                  ? "WORK"
                  : filteredStats.currentStatus.onBreak
                  ? "BREAK"
                  : "OFF"}
              </span>
            </div>
            <div className="space-y-1">
              <p className="text-sm text-gray-300 font-medium">Current Status</p>
              <p className="text-xs text-cyan-300">Live status</p>
            </div>
          </div>

          {/* Today's Hours */}
          <div className="bg-gradient-to-br from-indigo-600/20 to-indigo-800/20 backdrop-blur-sm border border-indigo-500/20 rounded-xl px-6 py-4 hover:border-indigo-400/40 transition-all duration-300 group">
            <div className="flex items-center justify-between mb-2">
              <Timer className="w-5 h-5 text-indigo-400 group-hover:scale-110 transition-transform duration-200" />
              <span className="font-bold text-2xl text-indigo-400">
                {filteredStats.currentStatus.todayHours}h
              </span>
            </div>
            <div className="space-y-1">
              <p className="text-sm text-gray-300 font-medium">Today's Hours</p>
              <p className="text-xs text-indigo-300">
                {filteredStats.currentStatus.arrivalTime
                  ? `In: ${filteredStats.currentStatus.arrivalTime}`
                  : "Not clocked in"}
              </p>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default AttendanceStats;