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
  Download
} from "lucide-react";

const STATUS_STYLES = {
  Present: "text-green-400 bg-green-900/30 border-green-700",
  Late: "text-orange-400 bg-orange-900/30 border-orange-700",
  Absent: "text-red-400 bg-red-900/30 border-red-700",
  "Half Day": "text-yellow-400 bg-yellow-900/30 border-yellow-700",
  default: "text-gray-400 bg-gray-900/30 border-gray-700",
};

const STATUS_ICONS = {
  Present: CheckCircle,
  Late: Clock,
  Absent: XCircle,
  "Half Day": Timer,
  default: Activity,
};

const RecentActivityTable = ({ activities = [] }) => {
  const [filter, setFilter] = useState("all");
  const [sortBy, setSortBy] = useState("date");
  const [sortOrder, setSortOrder] = useState("desc");

  if (!activities || activities.length === 0) {
    return (
      <div className="bg-[#161c2c] rounded-xl shadow-md p-6 w-full border border-[#232945]">
        <div className="flex items-center gap-2 mb-4">
          <Activity className="w-5 h-5 text-blue-400" />
          <h3 className="font-semibold text-lg text-gray-100">Recent Activity</h3>
        </div>
        <div className="text-center py-8">
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
      (filteredActivities.reduce((sum, a) => sum + parseFloat(a.workingHours || 0), 0) / filteredActivities.length).toFixed(1) : 0
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
    <div className="bg-[#161c2c] rounded-xl shadow-md p-4 w-full border border-[#232945]">
      {/* Header with controls */}
      <div className="flex justify-between items-center mb-4">
        <div className="flex items-center gap-2">
          <Activity className="w-5 h-5 text-blue-400" />
          <h3 className="font-semibold text-lg text-gray-100">Recent Activity</h3>
          <span className="text-sm text-gray-400">({sortedActivities.length} records)</span>
        </div>
        
        <div className="flex items-center gap-3">
          {/* Filter dropdown */}
          <div className="relative">
            <select
              value={filter}
              onChange={(e) => setFilter(e.target.value)}
              className="bg-[#232945] border border-[#3a3f4e] rounded-lg px-3 py-1 text-sm text-gray-300 focus:outline-none focus:ring-2 focus:ring-blue-500"
            >
              <option value="all">All Status</option>
              <option value="present">Present</option>
              <option value="late">Late</option>
              <option value="absent">Absent</option>
              <option value="halfday">Half Day</option>
            </select>
            <Filter className="w-3 h-3 text-gray-500 absolute right-2 top-2 pointer-events-none" />
          </div>
          
          {/* Export button */}
          <button
            onClick={exportToCSV}
            className="bg-blue-600 hover:bg-blue-700 text-white px-3 py-1 rounded-lg text-sm font-medium flex items-center gap-1 transition-colors"
          >
            <Download className="w-3 h-3" />
            Export
          </button>
        </div>
      </div>

      {/* Summary cards */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-4">
        <div className="bg-[#232945] rounded-lg p-3 text-center">
          <div className="text-blue-400 font-bold text-lg">{summary.totalDays}</div>
          <div className="text-xs text-gray-400">Total Days</div>
        </div>
        <div className="bg-[#232945] rounded-lg p-3 text-center">
          <div className="text-green-400 font-bold text-lg">{summary.presentDays}</div>
          <div className="text-xs text-gray-400">Present</div>
        </div>
        <div className="bg-[#232945] rounded-lg p-3 text-center">
          <div className="text-orange-400 font-bold text-lg">{summary.lateDays}</div>
          <div className="text-xs text-gray-400">Late</div>
        </div>
        <div className="bg-[#232945] rounded-lg p-3 text-center">
          <div className="text-purple-400 font-bold text-lg">{summary.totalHours.toFixed(1)}h</div>
          <div className="text-xs text-gray-400">Total Hours</div>
        </div>
      </div>

      {/* Table */}
      <div className="overflow-x-auto">
        <table className="w-full text-sm text-gray-300">
          <thead>
            <tr className="border-b border-[#232945] text-left">
              <th 
                className="py-3 px-3 cursor-pointer hover:text-blue-400 transition-colors"
                onClick={() => handleSort("date")}
              >
                <div className="flex items-center gap-1">
                  Date
                  <TrendingUp className={`w-3 h-3 transform transition-transform ${
                    sortBy === "date" ? (sortOrder === "desc" ? "rotate-180" : "") : "opacity-50"
                  }`} />
                </div>
              </th>
              <th 
                className="py-3 px-3 cursor-pointer hover:text-blue-400 transition-colors"
                onClick={() => handleSort("timeIn")}
              >
                <div className="flex items-center gap-1">
                  Time In
                  <TrendingUp className={`w-3 h-3 transform transition-transform ${
                    sortBy === "timeIn" ? (sortOrder === "desc" ? "rotate-180" : "") : "opacity-50"
                  }`} />
                </div>
              </th>
              <th className="py-3 px-3">Time Out</th>
              <th 
                className="py-3 px-3 cursor-pointer hover:text-blue-400 transition-colors"
                onClick={() => handleSort("status")}
              >
                <div className="flex items-center gap-1">
                  Status
                  <TrendingUp className={`w-3 h-3 transform transition-transform ${
                    sortBy === "status" ? (sortOrder === "desc" ? "rotate-180" : "") : "opacity-50"
                  }`} />
                </div>
              </th>
              <th 
                className="py-3 px-3 cursor-pointer hover:text-blue-400 transition-colors"
                onClick={() => handleSort("workingHours")}
              >
                <div className="flex items-center gap-1">
                  Hours
                  <TrendingUp className={`w-3 h-3 transform transition-transform ${
                    sortBy === "workingHours" ? (sortOrder === "desc" ? "rotate-180" : "") : "opacity-50"
                  }`} />
                </div>
              </th>
              <th className="py-3 px-3 hidden sm:table-cell">Break</th>
              <th className="py-3 px-3 hidden md:table-cell">Efficiency</th>
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
                  className={`border-b border-[#232945] last:border-none hover:bg-[#232945]/50 transition-colors ${
                    isToday ? 'bg-blue-900/20 border-blue-700/50' : ''
                  }`}
                >
                  <td className="py-3 px-3">
                    <div className="flex items-center gap-2">
                      <span className={isToday ? 'text-blue-400 font-medium' : ''}>
                        {new Date(activity.date).toLocaleDateString('en-US', { 
                          month: 'short', 
                          day: 'numeric',
                          weekday: 'short'
                        })}
                      </span>
                      {isToday && (
                        <span className="text-xs bg-blue-600 text-white px-1 rounded">TODAY</span>
                      )}
                    </div>
                  </td>
                  <td className="py-3 px-3">
                    <div className="flex items-center gap-1">
                      <Clock className="w-3 h-3 text-gray-500" />
                      <span>{activity.timeIn}</span>
                    </div>
                  </td>
                  <td className="py-3 px-3">
                    <div className="flex items-center gap-1">
                      <Clock className="w-3 h-3 text-gray-500" />
                      <span>{activity.timeOut}</span>
                    </div>
                  </td>
                  <td className="py-3 px-3">
                    <div
                      className={`inline-flex items-center gap-1 px-3 py-1 rounded-full font-medium text-xs border ${statusStyle}`}
                    >
                      <StatusIcon className="w-3 h-3" />
                      <span>{activity.status}</span>
                    </div>
                  </td>
                  <td className="py-3 px-3">
                    <div className="flex items-center gap-1">
                      <Timer className="w-3 h-3 text-blue-400" />
                      <span className="font-medium">{activity.workingHours}</span>
                    </div>
                  </td>
                  <td className="py-3 px-3 hidden sm:table-cell">
                    <span className="text-yellow-400">{activity.breakTime}</span>
                  </td>
                  <td className="py-3 px-3 hidden md:table-cell">
                    <div className="flex items-center gap-1">
                      <div className="w-12 bg-gray-700 rounded-full h-2">
                        <div 
                          className={`h-2 rounded-full transition-all duration-300 ${
                            parseFloat(activity.efficiency) >= 80 ? 'bg-green-500' :
                            parseFloat(activity.efficiency) >= 60 ? 'bg-yellow-500' : 'bg-red-500'
                          }`}
                          style={{ width: activity.efficiency }}
                        ></div>
                      </div>
                      <span className="text-xs">{activity.efficiency}</span>
                    </div>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      {/* Empty state for filtered results */}
      {filteredActivities.length === 0 && activities.length > 0 && (
        <div className="text-center py-8">
          <Filter className="w-12 h-12 text-gray-600 mx-auto mb-3" />
          <p className="text-gray-400">No records match the current filter</p>
          <button
            onClick={() => setFilter("all")}
            className="text-blue-400 hover:text-blue-300 text-sm mt-2"
          >
            Clear filter
          </button>
        </div>
      )}

      {/* Performance insights */}
      <div className="mt-4 pt-4 border-t border-[#232945]">
        <div className="flex items-center justify-between text-xs text-gray-400">
          <div className="flex gap-4">
            <span>Avg: {summary.averageHours}h/day</span>
            <span>Attendance: {((summary.presentDays + summary.lateDays) / Math.max(summary.totalDays, 1) * 100).toFixed(1)}%</span>
            <span>On-time: {(summary.presentDays / Math.max(summary.presentDays + summary.lateDays, 1) * 100).toFixed(1)}%</span>
          </div>
          <span>Last updated: {new Date().toLocaleTimeString()}</span>
        </div>
      </div>
    </div>
  );
};

export default RecentActivityTable;