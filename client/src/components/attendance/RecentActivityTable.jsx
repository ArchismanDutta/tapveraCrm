import React, { useState } from "react";
import { Clock, Calendar, AlertCircle, CheckCircle, XCircle, Info } from "lucide-react";

const STATUS_STYLES = {
  Present: "text-green-400 bg-green-900/30 border-green-700",
  "Present": "text-green-400 bg-green-900/30 border-green-700",
  Late: "text-yellow-400 bg-yellow-900/30 border-yellow-700",
  "Late": "text-yellow-400 bg-yellow-900/30 border-yellow-700",
  Absent: "text-red-400 bg-red-900/30 border-red-700",
  "Absent": "text-red-400 bg-red-900/30 border-red-700",
  default: "text-gray-400 bg-gray-900/30 border-gray-700",
};

const STATUS_ICONS = {
  Present: CheckCircle,
  Late: AlertCircle,
  Absent: XCircle,
  default: Info,
};

const RecentActivityTable = ({ activities = [] }) => {
  const [sortField, setSortField] = useState("date");
  const [sortDirection, setSortDirection] = useState("desc");
  const [showDetails, setShowDetails] = useState({});

  // Enhanced sorting function
  const handleSort = (field) => {
    if (sortField === field) {
      setSortDirection(sortDirection === "asc" ? "desc" : "asc");
    } else {
      setSortField(field);
      setSortDirection("desc");
    }
  };

  // Sort activities
  const sortedActivities = [...activities].sort((a, b) => {
    let aValue = a[sortField];
    let bValue = b[sortField];

    // Handle date sorting
    if (sortField === "date") {
      aValue = new Date(a.date);
      bValue = new Date(b.date);
    }
    
    // Handle time sorting
    if (sortField === "timeIn" || sortField === "timeOut") {
      // Convert time strings to comparable format
      const parseTime = (timeStr) => {
        if (timeStr === "--" || !timeStr) return new Date(0);
        const [time, period] = timeStr.split(" ");
        const [hours, minutes] = time.split(":");
        let hour24 = parseInt(hours);
        if (period === "PM" && hour24 !== 12) hour24 += 12;
        if (period === "AM" && hour24 === 12) hour24 = 0;
        return new Date(2000, 0, 1, hour24, parseInt(minutes));
      };
      aValue = parseTime(aValue);
      bValue = parseTime(bValue);
    }

    if (sortDirection === "asc") {
      return aValue < bValue ? -1 : aValue > bValue ? 1 : 0;
    } else {
      return aValue > bValue ? -1 : aValue < bValue ? 1 : 0;
    }
  });

  // Get status color and icon
  const getStatusInfo = (status) => {
    // Handle dynamic late status with minutes
    if (typeof status === "string" && status.includes("Late")) {
      return {
        style: STATUS_STYLES.Late,
        Icon: STATUS_ICONS.Late,
        text: status
      };
    }
    
    const baseStatus = status?.split(" ")[0] || "default";
    return {
      style: STATUS_STYLES[baseStatus] || STATUS_STYLES.default,
      Icon: STATUS_ICONS[baseStatus] || STATUS_ICONS.default,
      text: status
    };
  };

  // Toggle row details
  const toggleDetails = (index) => {
    setShowDetails(prev => ({
      ...prev,
      [index]: !prev[index]
    }));
  };

  // Format date for display
  const formatDate = (dateStr) => {
    const date = new Date(dateStr);
    const today = new Date();
    const yesterday = new Date(today);
    yesterday.setDate(yesterday.getDate() - 1);

    if (date.toDateString() === today.toDateString()) {
      return "Today";
    } else if (date.toDateString() === yesterday.toDateString()) {
      return "Yesterday";
    } else {
      return date.toLocaleDateString('en-US', { 
        month: 'short', 
        day: 'numeric',
        weekday: 'short'
      });
    }
  };

  // Calculate work duration
  const calculateWorkDuration = (timeIn, timeOut) => {
    if (timeIn === "--" || timeOut === "--") return "--";
    
    try {
      const parseTime = (timeStr) => {
        const [time, period] = timeStr.split(" ");
        const [hours, minutes] = time.split(":");
        let hour24 = parseInt(hours);
        if (period === "PM" && hour24 !== 12) hour24 += 12;
        if (period === "AM" && hour24 === 12) hour24 = 0;
        return { hours: hour24, minutes: parseInt(minutes) };
      };

      const inTime = parseTime(timeIn);
      const outTime = parseTime(timeOut);
      
      const inMinutes = inTime.hours * 60 + inTime.minutes;
      let outMinutes = outTime.hours * 60 + outTime.minutes;
      
      // Handle overnight shifts
      if (outMinutes < inMinutes) {
        outMinutes += 24 * 60;
      }
      
      const diffMinutes = outMinutes - inMinutes;
      const hours = Math.floor(diffMinutes / 60);
      const minutes = diffMinutes % 60;
      
      return `${hours}h ${minutes}m`;
    } catch (error) {
      return "--";
    }
  };

  if (activities.length === 0) {
    return (
      <div className="bg-[#161c2c] rounded-xl shadow-md p-8 w-full border border-[#232945]">
        <h3 className="font-semibold text-lg mb-4 text-gray-100 flex items-center gap-2">
          <Clock className="w-5 h-5" />
          Recent Activity
        </h3>
        <div className="text-center py-8">
          <Calendar className="w-12 h-12 text-gray-600 mx-auto mb-3" />
          <p className="text-gray-400">No recent activity to display</p>
        </div>
      </div>
    );
  }

  return (
    <div className="bg-[#161c2c] rounded-xl shadow-md p-4 w-full border border-[#232945]">
      <div className="flex items-center justify-between mb-4">
        <h3 className="font-semibold text-lg text-gray-100 flex items-center gap-2">
          <Clock className="w-5 h-5" />
          Recent Activity
        </h3>
        <span className="text-sm text-gray-400">
          Last {activities.length} days
        </span>
      </div>
      
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
                  <span className="text-xs">
                    {sortField === "date" && (sortDirection === "asc" ? "↑" : "↓")}
                  </span>
                </div>
              </th>
              <th 
                className="py-3 px-3 cursor-pointer hover:text-blue-400 transition-colors"
                onClick={() => handleSort("timeIn")}
              >
                <div className="flex items-center gap-1">
                  Time In
                  <span className="text-xs">
                    {sortField === "timeIn" && (sortDirection === "asc" ? "↑" : "↓")}
                  </span>
                </div>
              </th>
              <th 
                className="py-3 px-3 cursor-pointer hover:text-blue-400 transition-colors"
                onClick={() => handleSort("timeOut")}
              >
                <div className="flex items-center gap-1">
                  Time Out
                  <span className="text-xs">
                    {sortField === "timeOut" && (sortDirection === "asc" ? "↑" : "↓")}
                  </span>
                </div>
              </th>
              <th className="py-3 px-3">Duration</th>
              <th 
                className="py-3 px-3 cursor-pointer hover:text-blue-400 transition-colors"
                onClick={() => handleSort("status")}
              >
                <div className="flex items-center gap-1">
                  Status
                  <span className="text-xs">
                    {sortField === "status" && (sortDirection === "asc" ? "↑" : "↓")}
                  </span>
                </div>
              </th>
              <th className="py-3 px-3 w-8"></th>
            </tr>
          </thead>
          <tbody>
            {sortedActivities.map((activity, idx) => {
              const { date, timeIn, timeOut, status, workingHours, breakTime } = activity;
              const statusInfo = getStatusInfo(status);
              const StatusIcon = statusInfo.Icon;
              const workDuration = calculateWorkDuration(timeIn, timeOut);
              const isExpanded = showDetails[idx];

              return (
                <React.Fragment key={idx}>
                  <tr className="border-b border-[#232945] last:border-none hover:bg-[#232945] transition-colors group">
                    <td className="py-3 px-3">
                      <div className="font-medium">
                        {formatDate(date)}
                      </div>
                      <div className="text-xs text-gray-500 mt-1">
                        {new Date(date).toLocaleDateString()}
                      </div>
                    </td>
                    <td className="py-3 px-3">
                      <span className={`${timeIn === "--" ? "text-gray-500" : "text-gray-300"}`}>
                        {timeIn}
                      </span>
                    </td>
                    <td className="py-3 px-3">
                      <span className={`${timeOut === "--" ? "text-gray-500" : "text-gray-300"}`}>
                        {timeOut}
                      </span>
                    </td>
                    <td className="py-3 px-3">
                      <span className="text-blue-400 font-medium">
                        {workingHours || workDuration}
                      </span>
                    </td>
                    <td className="py-3 px-3">
                      <span
                        className={`px-3 py-1.5 rounded-full font-semibold text-xs border flex items-center gap-1.5 w-fit ${statusInfo.style}`}
                      >
                        <StatusIcon className="w-3 h-3" />
                        {statusInfo.text}
                      </span>
                    </td>
                    <td className="py-3 px-3">
                      {(workingHours || breakTime) && (
                        <button
                          onClick={() => toggleDetails(idx)}
                          className="text-gray-400 hover:text-blue-400 transition-colors opacity-0 group-hover:opacity-100"
                        >
                          <Info className={`w-4 h-4 transition-transform ${isExpanded ? 'rotate-180' : ''}`} />
                        </button>
                      )}
                    </td>
                  </tr>
                  
                  {isExpanded && (workingHours || breakTime) && (
                    <tr className="border-b border-[#232945] bg-[#1a2332]">
                      <td colSpan="6" className="py-3 px-3">
                        <div className="flex gap-6 text-xs">
                          {workingHours && (
                            <div className="flex items-center gap-2">
                              <Clock className="w-3 h-3 text-blue-400" />
                              <span className="text-gray-400">Work:</span>
                              <span className="text-blue-400 font-medium">{workingHours}</span>
                            </div>
                          )}
                          {breakTime && breakTime !== "0.00h" && (
                            <div className="flex items-center gap-2">
                              <AlertCircle className="w-3 h-3 text-orange-400" />
                              <span className="text-gray-400">Break:</span>
                              <span className="text-orange-400 font-medium">{breakTime}</span>
                            </div>
                          )}
                        </div>
                      </td>
                    </tr>
                  )}
                </React.Fragment>
              );
            })}
          </tbody>
        </table>
      </div>
      
      {activities.length > 10 && (
        <div className="text-center pt-4 border-t border-[#232945] mt-4">
          <button className="text-blue-400 hover:text-blue-300 text-sm font-medium transition-colors">
            View All Activity
          </button>
        </div>
      )}
    </div>
  );
};

export default RecentActivityTable;