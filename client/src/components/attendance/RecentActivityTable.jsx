import React, { useState } from "react";
import {
  Clock,
  CheckCircle,
  AlertTriangle,
  XCircle,
  Timer,
  Activity,
  TrendingUp,
  Calendar,
  Filter,
  Download,
  CalendarDays
} from "lucide-react";

const STATUS_STYLES = {
  Present: "text-green-400 bg-gradient-to-r from-green-900/30 to-green-800/30 border-green-500/30",
  Late: "text-orange-400 bg-gradient-to-r from-orange-900/30 to-orange-800/30 border-orange-500/30",
  Absent: "text-red-400 bg-gradient-to-r from-red-900/30 to-red-800/30 border-red-500/30",
  "Half Day": "text-yellow-400 bg-gradient-to-r from-yellow-900/30 to-yellow-800/30 border-yellow-500/30",
  "Half Day Leave": "text-yellow-400 bg-gradient-to-r from-yellow-900/30 to-yellow-800/30 border-yellow-500/30",
  WFH: "text-orange-400 bg-gradient-to-r from-orange-900/30 to-orange-800/30 border-orange-500/30",
  "Sick Leave": "text-purple-400 bg-gradient-to-r from-purple-900/30 to-purple-800/30 border-purple-500/30",
  "Paid Leave": "text-purple-400 bg-gradient-to-r from-purple-900/30 to-purple-800/30 border-purple-500/30",
  "Unpaid Leave": "text-purple-400 bg-gradient-to-r from-purple-900/30 to-purple-800/30 border-purple-500/30",
  "Maternity Leave": "text-purple-400 bg-gradient-to-r from-purple-900/30 to-purple-800/30 border-purple-500/30",
  default: "text-slate-400 bg-gradient-to-r from-slate-900/30 to-slate-800/30 border-slate-500/30",
};

const STATUS_ICONS = {
  Present: CheckCircle,
  Late: Clock,
  Absent: XCircle,
  "Half Day": Timer,
  "Half Day Leave": Timer,
  WFH: Activity,
  "Sick Leave": XCircle,
  "Paid Leave": XCircle,
  "Unpaid Leave": XCircle,
  "Maternity Leave": XCircle,
  default: Activity,
};

const RecentActivityTable = ({ activities = [], onDateFilterChange, currentFilter = '5days' }) => {
  const [filter, setFilter] = useState("all");
  const [sortBy, setSortBy] = useState("date");
  const [sortOrder, setSortOrder] = useState("desc");
  const [dateFilter, setDateFilter] = useState(currentFilter);
  const [showFilters, setShowFilters] = useState(false);

  // Update local state when prop changes
  React.useEffect(() => {
    setDateFilter(currentFilter);
  }, [currentFilter]);

  // Handle date filter change
  const handleDateFilterChange = (filter) => {
    setDateFilter(filter);
    if (onDateFilterChange) {
      onDateFilterChange(filter);
    }
  };

  if (!activities || activities.length === 0) {
    return (
      <div className="bg-gradient-to-br from-slate-800/50 to-slate-900/50 backdrop-blur-sm border border-slate-600/30 rounded-2xl p-6 w-full">
        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4 mb-6">
          <div className="flex items-center gap-3">
            <Activity className="w-6 h-6 text-cyan-400" />
            <h3 className="text-xl font-semibold text-white">Recent Activity</h3>
          </div>
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

        {/* Filter Options */}
        {showFilters && (
          <div className="mb-6 p-4 bg-slate-700/30 rounded-xl border border-slate-600/30">
            <div className="flex flex-wrap items-center gap-2">
              <span className="text-sm text-gray-400 mr-2">Time Period:</span>
              {[
                { key: '5days', label: 'Last 5 Days', icon: CalendarDays },
                { key: 'week', label: 'This Week', icon: Calendar },
                { key: 'month', label: 'This Month', icon: Calendar },
              ].map(({ key, label, icon: Icon }) => (
                <button
                  key={key}
                  onClick={() => handleDateFilterChange(key)}
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

        <div className="text-center py-12">
          <Calendar className="w-16 h-16 text-gray-600 mx-auto mb-4" />
          <p className="text-gray-400 text-lg mb-2">No activity data available</p>
          <p className="text-gray-500 text-sm">Your recent attendance records will appear here.</p>
        </div>
      </div>
    );
  }

  // Filter activities based on status
  const filteredActivities = activities.filter(activity => {
    if (filter === "all") return true;
    if (filter === "present") return activity.status === "Present";
    if (filter === "late") return activity.status.includes("Late");
    if (filter === "absent") return activity.status === "Absent";
    if (filter === "halfday") return activity.status === "Half Day";
    return true;
  });

  // Sort activities
  const sortedActivities = [...filteredActivities].sort((a, b) => {
    let comparison = 0;

    switch (sortBy) {
      case "date":
        comparison = new Date(a.date) - new Date(b.date);
        break;
      case "timeIn":
        comparison = (a.timeIn || "").localeCompare(b.timeIn || "");
        break;
      case "workingHours":
        comparison = parseFloat(a.workingHours) - parseFloat(b.workingHours);
        break;
      case "status":
        comparison = a.status.localeCompare(b.status);
        break;
      default:
        comparison = 0;
    }

    return sortOrder === "desc" ? -comparison : comparison;
  });

  const handleSort = (column) => {
    if (sortBy === column) {
      setSortOrder(sortOrder === "asc" ? "desc" : "asc");
    } else {
      setSortBy(column);
      setSortOrder("desc");
    }
  };

  // Calculate summary statistics
  const summary = {
    totalDays: filteredActivities.length,
    presentDays: filteredActivities.filter(a => a.status === "Present").length,
    lateDays: filteredActivities.filter(a => a.status.includes("Late")).length,
    absentDays: filteredActivities.filter(a => a.status === "Absent").length,
    totalHours: filteredActivities.reduce((sum, a) => sum + parseFloat(a.workingHours || 0), 0),
    averageHours: filteredActivities.length > 0 ?
      (filteredActivities.reduce((sum, a) => sum + parseFloat(a.workingHours || 0), 0) / filteredActivities.length).toFixed(1) : 0,
    period: dateFilter === '5days' ? 'Last 5 days' :
            dateFilter === 'week' ? 'This week' :
            dateFilter === 'month' ? 'This month' : 'This month'
  };

  const exportToCSV = () => {
    const headers = ["Date", "Time In", "Time Out", "Status", "Working Hours", "Break Time", "Efficiency"];
    const csvContent = [
      headers.join(","),
      ...sortedActivities.map(activity => [
        activity.date,
        activity.timeIn,
        activity.timeOut,
        `"${activity.status}"`,
        activity.workingHours,
        activity.breakTime,
        activity.efficiency
      ].join(","))
    ].join("\n");

    const blob = new Blob([csvContent], { type: "text/csv" });
    const url = window.URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `attendance_report_${new Date().toISOString().split('T')[0]}.csv`;
    a.click();
    window.URL.revokeObjectURL(url);
  };

  return (
    <div className="bg-gradient-to-br from-slate-800/50 to-slate-900/50 backdrop-blur-sm border border-slate-600/30 rounded-2xl p-6 w-full min-w-0">
      {/* Header with controls */}
      <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4 mb-6">
        <div className="flex items-center gap-3">
          <Activity className="w-6 h-6 text-cyan-400" />
          <h3 className="text-xl font-semibold text-white">Recent Activity</h3>
          <span className="text-sm text-gray-400 bg-slate-700/50 px-2 py-1 rounded">
            {sortedActivities.length} records
          </span>
          <span className="text-xs text-cyan-400 bg-cyan-900/30 px-2 py-1 rounded border border-cyan-700/50">
            {dateFilter === '5days' ? 'Last 5 Days' :
             dateFilter === 'week' ? 'This Week' :
             dateFilter === 'month' ? 'This Month' : 'This Month'}
          </span>
        </div>

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

          {/* Status filter dropdown */}
          <div className="relative">
            <select
              value={filter}
              onChange={(e) => setFilter(e.target.value)}
              className="bg-slate-700/50 border border-slate-600/50 rounded-lg px-3 py-2 text-sm text-gray-300 focus:outline-none focus:ring-2 focus:ring-cyan-500 focus:border-cyan-500 appearance-none pr-8"
            >
              <option value="all">All Status</option>
              <option value="present">Present</option>
              <option value="absent">Absent</option>
              <option value="halfday">Half Day</option>
            </select>
            <Filter className="w-3 h-3 text-gray-500 absolute right-2 top-3 pointer-events-none" />
          </div>

          {/* Export button */}
          <button
            onClick={exportToCSV}
            className="bg-gradient-to-r from-cyan-600 to-cyan-700 hover:from-cyan-700 hover:to-cyan-800 text-white px-4 py-2 rounded-lg text-sm font-medium flex items-center gap-2 transition-all duration-200 shadow-lg hover:shadow-cyan-500/25"
          >
            <Download className="w-4 h-4" />
            Export
          </button>
        </div>
      </div>

      {/* Date Filter Options */}
      {showFilters && (
        <div className="mb-6 p-4 bg-slate-700/30 rounded-xl border border-slate-600/30">
          <div className="flex flex-wrap items-center gap-2">
            <span className="text-sm text-gray-400 mr-2">Time Period:</span>
            {[
              { key: '5days', label: 'Last 5 Days', icon: CalendarDays },
              { key: 'week', label: 'This Week', icon: Calendar },
              { key: 'month', label: 'This Month', icon: Calendar },
            ].map(({ key, label, icon: Icon }) => (
              <button
                key={key}
                onClick={() => handleDateFilterChange(key)}
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

      {/* Summary cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
        <div className="bg-gradient-to-br from-blue-600/20 to-blue-800/20 backdrop-blur-sm border border-blue-500/20 rounded-xl p-4 hover:border-blue-400/40 transition-all duration-300 group">
          <div className="flex items-center gap-2 mb-1">
            <Calendar className="w-4 h-4 text-blue-400 group-hover:scale-110 transition-transform duration-200" />
            <span className="text-xs text-gray-400">Total Days</span>
          </div>
          <div className="flex items-center gap-1.5">
            <span className="text-lg font-bold text-blue-400">{summary.totalDays}</span>
            <span className="text-xs text-blue-300">{summary.period}</span>
          </div>
        </div>

        <div className="bg-gradient-to-br from-green-600/20 to-green-800/20 backdrop-blur-sm border border-green-500/20 rounded-xl p-4 hover:border-green-400/40 transition-all duration-300 group">
          <div className="flex items-center gap-2 mb-1">
            <CheckCircle className="w-4 h-4 text-green-400 group-hover:scale-110 transition-transform duration-200" />
            <span className="text-xs text-gray-400">Present</span>
          </div>
          <div className="flex items-center gap-1.5">
            <span className="text-lg font-bold text-green-400">{summary.presentDays}</span>
            <span className="text-xs text-green-300">days</span>
          </div>
        </div>

        <div className="bg-gradient-to-br from-orange-600/20 to-orange-800/20 backdrop-blur-sm border border-orange-500/20 rounded-xl p-4 hover:border-orange-400/40 transition-all duration-300 group">
          <div className="flex items-center gap-2 mb-1">
            <AlertTriangle className="w-4 h-4 text-orange-400 group-hover:scale-110 transition-transform duration-200" />
            <span className="text-xs text-gray-400">Late</span>
          </div>
          <div className="flex items-center gap-1.5">
            <span className="text-lg font-bold text-orange-400">{summary.lateDays}</span>
            <span className="text-xs text-orange-300">days</span>
          </div>
        </div>

        <div className="bg-gradient-to-br from-purple-600/20 to-purple-800/20 backdrop-blur-sm border border-purple-500/20 rounded-xl p-4 hover:border-purple-400/40 transition-all duration-300 group">
          <div className="flex items-center gap-2 mb-1">
            <Timer className="w-4 h-4 text-purple-400 group-hover:scale-110 transition-transform duration-200" />
            <span className="text-xs text-gray-400">Total Hours</span>
          </div>
          <div className="flex items-center gap-1.5">
            <span className="text-lg font-bold text-purple-400">{summary.totalHours.toFixed(1)}h</span>
            <span className="text-xs text-purple-300">worked</span>
          </div>
        </div>
      </div>

      {/* Table */}
      <div className="bg-slate-700/20 rounded-xl border border-slate-600/20 overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm text-gray-300 table-fixed">
            <thead className="bg-slate-800/50 border-b border-slate-600/30">
              <tr className="text-left">
                <th
                  className="py-4 px-4 cursor-pointer hover:text-cyan-400 transition-colors w-36 font-semibold"
                  onClick={() => handleSort("date")}
                >
                  <div className="flex items-center gap-2">
                    <Calendar className="w-4 h-4" />
                    Date
                    <TrendingUp className={`w-3 h-3 transform transition-transform ${
                      sortBy === "date" ? (sortOrder === "desc" ? "rotate-180" : "") : "opacity-50"
                    }`} />
                  </div>
                </th>
                <th
                  className="py-4 px-4 cursor-pointer hover:text-cyan-400 transition-colors w-28 font-semibold"
                  onClick={() => handleSort("timeIn")}
                >
                  <div className="flex items-center gap-2">
                    <Clock className="w-4 h-4" />
                    Time In
                    <TrendingUp className={`w-3 h-3 transform transition-transform ${
                      sortBy === "timeIn" ? (sortOrder === "desc" ? "rotate-180" : "") : "opacity-50"
                    }`} />
                  </div>
                </th>
                <th className="py-4 px-4 w-28 font-semibold">
                  <div className="flex items-center gap-2">
                    <Clock className="w-4 h-4" />
                    Time Out
                  </div>
                </th>
                <th
                  className="py-4 px-4 cursor-pointer hover:text-cyan-400 transition-colors w-32 font-semibold"
                  onClick={() => handleSort("status")}
                >
                  <div className="flex items-center gap-2">
                    <Activity className="w-4 h-4" />
                    Status
                    <TrendingUp className={`w-3 h-3 transform transition-transform ${
                      sortBy === "status" ? (sortOrder === "desc" ? "rotate-180" : "") : "opacity-50"
                    }`} />
                  </div>
                </th>
                <th
                  className="py-4 px-4 cursor-pointer hover:text-cyan-400 transition-colors w-24 font-semibold"
                  onClick={() => handleSort("workingHours")}
                >
                  <div className="flex items-center gap-2">
                    <Timer className="w-4 h-4" />
                    Hours
                    <TrendingUp className={`w-3 h-3 transform transition-transform ${
                      sortBy === "workingHours" ? (sortOrder === "desc" ? "rotate-180" : "") : "opacity-50"
                    }`} />
                  </div>
                </th>
                <th className="py-4 px-4 hidden sm:table-cell w-20 font-semibold">Break</th>
                <th className="py-4 px-4 hidden md:table-cell w-36 font-semibold">Efficiency</th>
              </tr>
            </thead>
            <tbody>
              {sortedActivities.map((activity, idx) => {
                const StatusIcon = STATUS_ICONS[activity.status] || STATUS_ICONS.default;
                const statusStyle = STATUS_STYLES[activity.status] || STATUS_STYLES.default;
                const isToday = activity.date === new Date().toISOString().split('T')[0];

                return (
                  <tr
                    key={idx}
                    className={`border-b border-slate-600/20 last:border-none hover:bg-slate-700/30 transition-all duration-200 ${
                      isToday ? 'bg-cyan-900/20 border-cyan-700/50' : ''
                    }`}
                  >
                    <td className="py-4 px-4">
                      <div className="flex items-center gap-2">
                        <span className={`font-medium ${isToday ? 'text-cyan-400' : 'text-gray-300'}`}>
                          {new Date(activity.date).toLocaleDateString('en-US', {
                            month: 'short',
                            day: 'numeric',
                            weekday: 'short'
                          })}
                        </span>
                        {isToday && (
                          <span className="text-xs bg-gradient-to-r from-cyan-600 to-cyan-700 text-white px-2 py-1 rounded-full font-medium">
                            TODAY
                          </span>
                        )}
                      </div>
                    </td>
                    <td className="py-4 px-4">
                      <div className="flex items-center gap-2">
                        <Clock className="w-3 h-3 text-gray-500" />
                        <span className="font-medium">{activity.timeIn}</span>
                      </div>
                    </td>
                    <td className="py-4 px-4">
                      <div className="flex items-center gap-2">
                        <Clock className="w-3 h-3 text-gray-500" />
                        <span className="font-medium">{activity.timeOut}</span>
                      </div>
                    </td>
                    <td className="py-4 px-4 break-words">
                      <div
                        className={`inline-flex items-center gap-2 px-3 py-2 rounded-lg font-medium text-xs border backdrop-blur-sm ${statusStyle}`}
                      >
                        <StatusIcon className="w-3 h-3" />
                        <span>{activity.status}</span>
                      </div>
                    </td>
                    <td className="py-4 px-4">
                      <div className="flex items-center gap-2">
                        <Timer className="w-3 h-3 text-cyan-400" />
                        <span className="font-semibold text-white">{activity.workingHours}</span>
                      </div>
                    </td>
                    <td className="py-4 px-4 hidden sm:table-cell">
                      <span className="text-yellow-400 font-medium">{activity.breakTime}</span>
                    </td>
                    <td className="py-4 px-4 hidden md:table-cell">
                      <div className="flex items-center gap-2">
                        <div className="w-16 bg-slate-700 rounded-full h-2">
                          <div
                            className={`h-2 rounded-full transition-all duration-300 ${
                              parseFloat(activity.efficiency) >= 80 ? 'bg-gradient-to-r from-green-500 to-green-600' :
                              parseFloat(activity.efficiency) >= 60 ? 'bg-gradient-to-r from-yellow-500 to-yellow-600' :
                              'bg-gradient-to-r from-red-500 to-red-600'
                            }`}
                            style={{ width: activity.efficiency }}
                          ></div>
                        </div>
                        <span className="text-xs font-medium text-white">{activity.efficiency}</span>
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>

      {/* Empty state for filtered results */}
      {filteredActivities.length === 0 && activities.length > 0 && (
        <div className="text-center py-12 bg-slate-700/20 rounded-xl border border-slate-600/20 mt-6">
          <Filter className="w-12 h-12 text-gray-600 mx-auto mb-4" />
          <p className="text-gray-400 text-lg mb-2">No records match the current filter</p>
          <button
            onClick={() => setFilter("all")}
            className="text-cyan-400 hover:text-cyan-300 text-sm font-medium transition-colors"
          >
            Clear filter
          </button>
        </div>
      )}

      {/* Performance insights */}
      <div className="mt-6 pt-4 border-t border-slate-600/30">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 text-sm text-gray-400">
          <div className="flex flex-wrap gap-6">
            <div className="flex items-center gap-2">
              <Timer className="w-4 h-4 text-cyan-400" />
              <span>Average: <span className="text-cyan-400 font-medium">{summary.averageHours}h/day</span></span>
            </div>
            <div className="flex items-center gap-2">
              <Calendar className="w-4 h-4 text-purple-400" />
              <span>Period: <span className="text-purple-400 font-medium">{summary.period}</span></span>
            </div>
          </div>
          <span className="text-xs">Last updated: {new Date().toLocaleTimeString()}</span>
        </div>
      </div>
    </div>
  );
};

export default RecentActivityTable;