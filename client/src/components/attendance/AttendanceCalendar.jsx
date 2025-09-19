import React, { useState, useRef, useEffect, useMemo } from "react";
import { Calendar, Clock, AlertTriangle, CheckCircle, Filter, ChevronLeft, ChevronRight, CalendarDays } from "lucide-react";

const STATUS_COLOR = {
  present: "bg-gradient-to-br from-green-600 to-green-700 text-green-100 border-green-500",
  absent: "bg-gradient-to-br from-red-600 to-red-700 text-red-100 border-red-500",
  holiday: "bg-gradient-to-br from-blue-600 to-blue-700 text-blue-100 border-blue-500",
  weekend: "bg-gradient-to-br from-gray-600 to-gray-700 text-gray-300 border-gray-500",
  leave: "bg-gradient-to-br from-purple-600 to-purple-700 text-purple-100 border-purple-500",
  late: "bg-gradient-to-br from-orange-600 to-orange-700 text-orange-100 border-orange-500",
  "half-day": "bg-gradient-to-br from-yellow-600 to-yellow-700 text-yellow-100 border-yellow-500",
  default: "bg-gradient-to-br from-slate-600 to-slate-700 text-slate-300 border-slate-500",
};

const AttendanceCalendar = ({ data, onDateFilterChange, onMonthChange }) => {
  const [hoveredDay, setHoveredDay] = useState(null);
  const [tooltipStyle, setTooltipStyle] = useState({});
  const [selectedDay, setSelectedDay] = useState(null);
  const [showFilters, setShowFilters] = useState(false);
  const [viewMode, setViewMode] = useState('month'); // month, week, day
  const [currentDate, setCurrentDate] = useState(new Date());
  const containerRef = useRef(null);

  if (!data) return null;

  const daysOfWeek = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
  const monthIndex = new Date(`${data.month} 1, ${data.year}`).getMonth();
  const maxDays = new Date(data.year, monthIndex + 1, 0).getDate();
  const blanks = Array(data.startDayOfWeek).fill(null);

  // Handle view mode changes
  const handleViewModeChange = (mode) => {
    setViewMode(mode);
    if (onDateFilterChange) {
      onDateFilterChange(mode);
    }
  };

  // Navigate months
  const navigateMonth = (direction) => {
    const newDate = new Date(data.year, monthIndex + direction, 1);
    setCurrentDate(newDate);
    if (onMonthChange) {
      onMonthChange(newDate);
    }
  };

  // Prepare days array with enhanced status handling
  const days = useMemo(() => {
    return Array.from({ length: maxDays }, (_, i) => {
      const dayNum = i + 1;
      const dayObj = data.days.find((d) => d.day === dayNum) || {};

      return {
        day: dayNum,
        status: dayObj.status || "default",
        name: dayObj.name || null,
        workingHours: dayObj.workingHours || "0.0",
        arrivalTime: dayObj.arrivalTime || null,
        departureTime: dayObj.departureTime || null,
        metadata: dayObj.metadata || {},
        isToday: dayNum === new Date().getDate() &&
                 monthIndex === new Date().getMonth() &&
                 data.year === new Date().getFullYear()
      };
    });
  }, [data, maxDays, monthIndex]);

  // Filter days based on view mode
  const filteredDays = useMemo(() => {
    if (viewMode === 'month') return days;

    const today = new Date();
    const todayDate = today.getDate();

    if (viewMode === 'day') {
      return days.filter(day => day.day === todayDate);
    }

    if (viewMode === 'week') {
      const startOfWeek = todayDate - today.getDay();
      const endOfWeek = startOfWeek + 6;
      return days.filter(day => day.day >= startOfWeek && day.day <= endOfWeek);
    }

    return days;
  }, [days, viewMode]);

  // Update tooltip position on hover
  useEffect(() => {
    if (hoveredDay !== null && containerRef.current) {
      const dayCell = containerRef.current.querySelector(`[data-day='${hoveredDay.day}']`);
      if (dayCell) {
        const rect = dayCell.getBoundingClientRect();
        const containerRect = containerRef.current.getBoundingClientRect();

        const tooltipWidth = 300;
        let left = rect.left - containerRect.left + rect.width / 2 - tooltipWidth / 2;
        if (left < 5) left = 5;
        if (left + tooltipWidth > containerRect.width - 5) left = containerRect.width - tooltipWidth - 5;

        const top = rect.top - containerRect.top - 120;

        setTooltipStyle({
          left,
          top,
          width: tooltipWidth,
        });
      }
    }
  }, [hoveredDay]);

  const getStatusIcon = (status) => {
    switch (status) {
      case "present":
        return <CheckCircle className="w-3 h-3" />;
      case "late":
        return <Clock className="w-3 h-3" />;
      case "absent":
        return <AlertTriangle className="w-3 h-3" />;
      default:
        return <Calendar className="w-3 h-3" />;
    }
  };

  const getStatusLabel = (status) => {
    switch (status) {
      case "present": return "Present";
      case "absent": return "Absent";
      case "late": return "Late";
      case "half-day": return "Half Day";
      case "holiday": return "Holiday";
      case "weekend": return "Weekend";
      case "leave": return "On Leave";
      default: return "No Data";
    }
  };

  return (
    <div className="bg-gradient-to-br from-slate-800/50 to-slate-900/50 backdrop-blur-sm border border-slate-600/30 rounded-2xl p-6" ref={containerRef}>
      {/* Header with Navigation and Filters */}
      <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4 mb-6">
        <div className="flex items-center gap-4">
          <div className="flex items-center gap-3">
            <Calendar className="w-6 h-6 text-cyan-400" />
            <h3 className="text-xl font-semibold text-white">Attendance Calendar</h3>
          </div>

          {/* Month Navigation */}
          <div className="flex items-center gap-2">
            <button
              onClick={() => navigateMonth(-1)}
              className="p-2 bg-slate-700/50 hover:bg-slate-600/50 rounded-lg transition-all duration-200"
              title="Previous Month"
            >
              <ChevronLeft className="w-4 h-4 text-gray-400" />
            </button>
            <span className="text-lg font-medium text-white min-w-[140px] text-center">
              {data.month} {data.year}
            </span>
            <button
              onClick={() => navigateMonth(1)}
              className="p-2 bg-slate-700/50 hover:bg-slate-600/50 rounded-lg transition-all duration-200"
              title="Next Month"
            >
              <ChevronRight className="w-4 h-4 text-gray-400" />
            </button>
          </div>
        </div>

        {/* View Mode and Filter Controls */}
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

      {/* Filter Options */}
      {showFilters && (
        <div className="mb-6 p-4 bg-slate-700/30 rounded-xl border border-slate-600/30">
          <div className="flex flex-wrap items-center gap-2">
            <span className="text-sm text-gray-400 mr-2">View:</span>
            {[
              { key: 'day', label: 'Today', icon: CalendarDays },
              { key: 'week', label: 'This Week', icon: Calendar },
              { key: 'month', label: 'Month View', icon: Calendar },
            ].map(({ key, label, icon: Icon }) => (
              <button
                key={key}
                onClick={() => handleViewModeChange(key)}
                className={`flex items-center gap-2 px-3 py-2 rounded-lg text-sm font-medium transition-all duration-200 ${
                  viewMode === key
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

      {/* Calendar Grid */}
      <div className="bg-slate-700/20 rounded-xl p-4 border border-slate-600/20">
        {/* Calendar Header */}
        <div className="grid grid-cols-7 gap-1 mb-4">
          {daysOfWeek.map((day) => (
            <div
              key={day}
              className="text-center text-sm font-semibold text-gray-400 py-2"
            >
              {day}
            </div>
          ))}
        </div>

        {/* Calendar Body */}
        <div className="grid grid-cols-7 gap-1">
          {/* Empty cells for start of month */}
          {blanks.map((_, index) => (
            <div key={`blank-${index}`} className="h-12"></div>
          ))}

          {/* Days */}
          {(viewMode === 'month' ? days : filteredDays).map((dayData) => {
            const isHovered = hoveredDay?.day === dayData.day;
            const isSelected = selectedDay?.day === dayData.day;
            const statusClass = STATUS_COLOR[dayData.status] || STATUS_COLOR.default;

            return (
              <div
                key={dayData.day}
                data-day={dayData.day}
                className={`relative h-12 flex flex-col items-center justify-center rounded-lg cursor-pointer transition-all duration-200 border-2 ${statusClass} ${
                  isHovered ? 'scale-105 z-10' : ''
                } ${
                  isSelected ? 'ring-2 ring-cyan-400 ring-offset-2 ring-offset-slate-800' : ''
                } ${
                  dayData.isToday ? 'ring-2 ring-white ring-offset-1 ring-offset-slate-800' : ''
                }`}
                onMouseEnter={() => setHoveredDay(dayData)}
                onMouseLeave={() => setHoveredDay(null)}
                onClick={() => setSelectedDay(isSelected ? null : dayData)}
              >
                {/* Day Number */}
                <span className="text-sm font-semibold">
                  {dayData.day}
                </span>

                {/* Status Indicator */}
                {dayData.status !== 'default' && (
                  <div className="absolute top-1 right-1">
                    {getStatusIcon(dayData.status)}
                  </div>
                )}

                {/* Today Indicator */}
                {dayData.isToday && (
                  <div className="absolute bottom-1 left-1/2 transform -translate-x-1/2">
                    <div className="w-1 h-1 bg-white rounded-full"></div>
                  </div>
                )}

                {/* Working Hours Indicator */}
                {parseFloat(dayData.workingHours) > 0 && (
                  <div className="absolute bottom-1 right-1">
                    <div className="text-xs font-bold opacity-80">
                      {parseFloat(dayData.workingHours).toFixed(0)}h
                    </div>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </div>

      {/* Enhanced Tooltip */}
      {hoveredDay && (
        <div
          className="absolute z-50 p-4 bg-slate-900/95 backdrop-blur-lg border border-slate-600/50 rounded-xl shadow-2xl"
          style={{
            left: tooltipStyle.left,
            top: tooltipStyle.top,
            width: tooltipStyle.width,
          }}
        >
          <div className="space-y-3">
            {/* Date Header */}
            <div className="flex items-center justify-between">
              <h4 className="text-lg font-semibold text-white">
                {data.month} {hoveredDay.day}, {data.year}
              </h4>
              <div className={`flex items-center gap-2 px-2 py-1 rounded-lg text-xs font-medium ${STATUS_COLOR[hoveredDay.status]}`}>
                {getStatusIcon(hoveredDay.status)}
                {getStatusLabel(hoveredDay.status)}
              </div>
            </div>

            {/* Working Hours */}
            <div className="flex items-center justify-between">
              <span className="text-gray-400">Working Hours:</span>
              <span className="text-white font-semibold">{hoveredDay.workingHours}h</span>
            </div>

            {/* Arrival Time */}
            {hoveredDay.arrivalTime && (
              <div className="flex items-center justify-between">
                <span className="text-gray-400">Arrival:</span>
                <span className="text-green-400 font-semibold">{hoveredDay.arrivalTime}</span>
              </div>
            )}

            {/* Departure Time */}
            {hoveredDay.departureTime && (
              <div className="flex items-center justify-between">
                <span className="text-gray-400">Departure:</span>
                <span className="text-red-400 font-semibold">{hoveredDay.departureTime}</span>
              </div>
            )}

            {/* Additional Metadata */}
            {hoveredDay.metadata && Object.keys(hoveredDay.metadata).length > 0 && (
              <div className="pt-2 border-t border-slate-600">
                <span className="text-gray-400 text-sm">Additional Info:</span>
                <div className="mt-1 space-y-1">
                  {Object.entries(hoveredDay.metadata).map(([key, value]) => (
                    <div key={key} className="flex justify-between text-sm">
                      <span className="text-gray-500 capitalize">{key}:</span>
                      <span className="text-gray-300">{value}</span>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Legend */}
      <div className="mt-6 pt-4 border-t border-slate-600/30">
        <div className="flex flex-wrap gap-4 justify-center">
          {Object.entries(STATUS_COLOR)
            .filter(([status]) => status !== 'default')
            .map(([status, className]) => (
              <div key={status} className="flex items-center gap-2">
                <div className={`w-3 h-3 rounded border-2 ${className}`}></div>
                <span className="text-sm text-gray-400 capitalize">
                  {getStatusLabel(status)}
                </span>
              </div>
            ))}
        </div>
      </div>

      {/* Summary Stats */}
      {data.monthlyStats && (
        <div className="mt-6 pt-4 border-t border-slate-600/30">
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <div className="text-center">
              <div className="text-2xl font-bold text-green-400">{data.monthlyStats.totalPresent}</div>
              <div className="text-sm text-gray-400">Present Days</div>
            </div>
            <div className="text-center">
              <div className="text-2xl font-bold text-yellow-400">{data.monthlyStats.totalLate}</div>
              <div className="text-sm text-gray-400">Late Days</div>
            </div>
            <div className="text-center">
              <div className="text-2xl font-bold text-red-400">{data.monthlyStats.totalAbsent}</div>
              <div className="text-sm text-gray-400">Absent Days</div>
            </div>
            <div className="text-center">
              <div className="text-2xl font-bold text-purple-400">{data.monthlyStats.totalLeave}</div>
              <div className="text-sm text-gray-400">Leave Days</div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default AttendanceCalendar;