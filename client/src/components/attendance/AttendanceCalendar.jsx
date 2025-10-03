import React, { useState, useRef, useEffect, useMemo, useCallback } from "react";
import { Calendar, Clock, AlertTriangle, CheckCircle, Filter, ChevronLeft, ChevronRight, CalendarDays, Timer, XCircle } from "lucide-react";

const STATUS_COLOR = {
  present: "bg-gradient-to-br from-green-600 to-green-700 text-green-100 border-green-500",
  absent: "bg-gradient-to-br from-red-600 to-red-700 text-red-100 border-red-500",
  holiday: "bg-gradient-to-br from-blue-600 to-blue-700 text-blue-100 border-blue-500",
  weekend: "bg-gradient-to-br from-gray-600 to-gray-700 text-gray-300 border-gray-500",
  leave: "bg-gradient-to-br from-purple-600 to-purple-700 text-purple-100 border-purple-500",
  late: "bg-gradient-to-br from-orange-600 to-orange-700 text-orange-100 border-orange-500",
  "half-day": "bg-gradient-to-br from-yellow-600 to-yellow-700 text-yellow-100 border-yellow-500",
  "half-day-leave": "bg-gradient-to-br from-yellow-600 to-yellow-700 text-yellow-100 border-yellow-500",
  "approved-leave": "bg-gradient-to-br from-purple-600 to-purple-700 text-purple-100 border-purple-500",
  wfh: "bg-gradient-to-br from-orange-500 to-orange-600 text-orange-100 border-orange-400",
  default: "bg-gradient-to-br from-slate-600 to-slate-700 text-slate-300 border-slate-500",
};

const AttendanceCalendar = ({ data, onDateFilterChange, onMonthChange }) => {
  const [selectedDay, setSelectedDay] = useState(null);
  const [showFilters, setShowFilters] = useState(false);
  const [viewMode, setViewMode] = useState('month'); // month, week, day
  const [hoveredDay, setHoveredDay] = useState(null);
  const [showTooltip, setShowTooltip] = useState(false);
  const [tooltipPosition, setTooltipPosition] = useState(null);
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
        isToday: (() => {
          const today = new Date();
          return dayNum === today.getDate() &&
                 monthIndex === today.getMonth() &&
                 data.year === today.getFullYear();
        })()
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

  // Calculate optimal tooltip position with smart positioning and error handling
  const calculateTooltipPosition = useCallback((event) => {
    try {
      // Safety checks
      if (!event || typeof event.clientX !== 'number' || typeof event.clientY !== 'number') {
        console.warn('Invalid event object for tooltip positioning');
        return { x: 100, y: 100 }; // Default safe position
      }

      const tooltipWidth = 200;
      const tooltipHeight = 180;
      const offset = 15;

      const viewportWidth = window.innerWidth || 1024; // Fallback
      const viewportHeight = window.innerHeight || 768; // Fallback
      const scrollY = window.scrollY || 0; // Fallback

      console.log('Viewport info:', { viewportWidth, viewportHeight, scrollY });
      console.log('Event coordinates:', { clientX: event.clientX, clientY: event.clientY });

      // For fixed positioning, use clientX/Y directly (no scrollY needed)
      let x = event.clientX;
      let y = event.clientY;

      console.log('Calculated base position:', { x, y });

      // Preferred position: to the right and slightly below cursor
      let preferredX = x + offset;
      let preferredY = y + offset;

      // Check if tooltip fits on the right side
      if (preferredX + tooltipWidth > viewportWidth - offset) {
        // Position to the left of cursor
        preferredX = x - tooltipWidth - offset;
      }

      // If still doesn't fit, center horizontally with some margin
      if (preferredX < offset) {
        preferredX = Math.max(offset, Math.min(viewportWidth - tooltipWidth - offset, x - tooltipWidth / 2));
      }

      // Check vertical positioning
      if (preferredY + tooltipHeight > viewportHeight - offset) {
        // Position above cursor
        preferredY = y - tooltipHeight - offset;
      }

      // Ensure tooltip stays within viewport vertically
      if (preferredY < offset) {
        preferredY = offset;
      }

      // Final bounds check with safety
      const finalX = Math.max(offset, Math.min(viewportWidth - tooltipWidth - offset, preferredX));
      const finalY = Math.max(offset, Math.min(viewportHeight - tooltipHeight - offset, preferredY));

      // Ensure we return valid numbers
      return {
        x: isNaN(finalX) ? 100 : finalX,
        y: isNaN(finalY) ? 100 : finalY
      };
    } catch (error) {
      console.error('Error calculating tooltip position:', error);
      return { x: 100, y: 100 }; // Safe fallback position
    }
  }, []);

  const getStatusIcon = (status) => {
    switch (status) {
      case "present":
        return <CheckCircle className="w-3 h-3" />;
      case "late":
        return <Clock className="w-3 h-3" />;
      case "absent":
        return <AlertTriangle className="w-3 h-3" />;
      case "wfh":
        return <Timer className="w-3 h-3" />;
      case "half-day":
      case "half-day-leave":
        return <Clock className="w-3 h-3" />;
      case "approved-leave":
      case "leave":
        return <XCircle className="w-3 h-3" />;
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
      case "half-day-leave": return "Half Day Leave";
      case "approved-leave": return "Approved Leave";
      case "holiday": return "Holiday";
      case "weekend": return "Weekend";
      case "leave": return "On Leave";
      case "wfh": return "Work From Home";
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
            const isSelected = selectedDay?.day === dayData.day;
            const statusClass = STATUS_COLOR[dayData.status] || STATUS_COLOR.default;

            return (
              <div
                key={dayData.day}
                className={`relative h-12 flex flex-col items-center justify-center rounded-lg cursor-pointer transition-colors duration-200 border-2 ${statusClass} hover:brightness-110 hover:scale-105 ${
                  isSelected ? 'ring-2 ring-cyan-400 ring-offset-2 ring-offset-slate-800' : ''
                } ${
                  dayData.isToday ? 'ring-2 ring-white ring-offset-1 ring-offset-slate-800' : ''
                }`}
                onClick={() => {
                  console.log('Click event fired for day:', dayData.day);
                  setSelectedDay(isSelected ? null : dayData);
                  // Clear tooltip on click to avoid interference
                  setShowTooltip(false);
                  setHoveredDay(null);
                }}
                onMouseEnter={(event) => {
                  console.log('Mouse enter event fired for day:', dayData.day, event);
                  try {
                    console.log('Setting hovered day to:', dayData);
                    setHoveredDay(dayData);
                    setShowTooltip(true);
                    const position = calculateTooltipPosition(event);
                    console.log('Calculated position:', position);
                    setTooltipPosition(position);
                    console.log('State should be updated now');
                  } catch (error) {
                    console.error('Error in onMouseEnter:', error);
                    setShowTooltip(false);
                  }
                }}
                onMouseMove={(event) => {
                  try {
                    if (showTooltip) {
                      const position = calculateTooltipPosition(event);
                      setTooltipPosition(position);
                    }
                  } catch (error) {
                    console.error('Error in onMouseMove:', error);
                    // Don't hide tooltip on move errors, just log them
                  }
                }}
                onMouseLeave={() => {
                  console.log('Mouse leave event fired for day:', dayData.day);
                  try {
                    setHoveredDay(null);
                    setShowTooltip(false);
                    setTooltipPosition(null);
                  } catch (error) {
                    console.error('Error in onMouseLeave:', error);
                  }
                }}
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

      {/* Lightweight Hover Tooltip */}
      {console.log('Tooltip render check:', { hoveredDay: !!hoveredDay, showTooltip, tooltipPosition }) || null}
      {hoveredDay && showTooltip && tooltipPosition?.x !== undefined && tooltipPosition?.y !== undefined && (
        <div className="fixed z-[9999] pointer-events-none">
          <div
            className="absolute bg-slate-900 border-2 border-cyan-400 rounded-lg p-3 shadow-2xl text-sm w-[200px]"
            style={{
              left: `${tooltipPosition.x}px`,
              top: `${tooltipPosition.y}px`,
            }}
          >
            {/* Header */}
            <div className="flex items-center justify-between mb-2">
              <div className="font-semibold text-white">
                {data.month} {hoveredDay.day}, {data.year}
              </div>
              <div className={`text-xs px-2 py-1 rounded ${
                hoveredDay.status === 'present' ? 'bg-green-600/30 text-green-300' :
                hoveredDay.status === 'late' ? 'bg-orange-600/30 text-orange-300' :
                hoveredDay.status === 'absent' ? 'bg-red-600/30 text-red-300' :
                hoveredDay.status === 'half-day' ? 'bg-yellow-600/30 text-yellow-300' :
                'bg-gray-600/30 text-gray-300'
              }`}>
                {getStatusLabel(hoveredDay.status)}
              </div>
            </div>

            {/* Key Stats */}
            <div className="space-y-1 text-xs">
              <div className="flex justify-between">
                <span className="text-gray-400">Work Hours:</span>
                <span className="text-blue-400 font-medium">{hoveredDay.workingHours}h</span>
              </div>

              {hoveredDay.arrivalTime && (
                <div className="flex justify-between">
                  <span className="text-gray-400">Time In:</span>
                  <span className="text-green-400 font-medium">
                    {typeof hoveredDay.arrivalTime === 'string' ?
                      (hoveredDay.arrivalTime.includes('T') ?
                        new Date(hoveredDay.arrivalTime).toLocaleTimeString([], {hour: '2-digit', minute: '2-digit', hour12: true})
                        : hoveredDay.arrivalTime)
                      : '--'}
                  </span>
                </div>
              )}

              {hoveredDay.departureTime && (
                <div className="flex justify-between">
                  <span className="text-gray-400">Time Out:</span>
                  <span className="text-red-400 font-medium">
                    {typeof hoveredDay.departureTime === 'string' ?
                      (hoveredDay.departureTime.includes('T') ?
                        new Date(hoveredDay.departureTime).toLocaleTimeString([], {hour: '2-digit', minute: '2-digit', hour12: true})
                        : hoveredDay.departureTime)
                      : '--'}
                  </span>
                </div>
              )}

              {hoveredDay.metadata?.breakSessions > 0 && (
                <div className="flex justify-between">
                  <span className="text-gray-400">Breaks:</span>
                  <span className="text-yellow-400 font-medium">
                    {hoveredDay.metadata.breakSessions} ({hoveredDay.metadata.totalBreakTime}h)
                  </span>
                </div>
              )}

              {hoveredDay.metadata?.lateMinutes > 0 && (
                <div className="flex justify-between">
                  <span className="text-gray-400">Late by:</span>
                  <span className="text-orange-400 font-medium">{hoveredDay.metadata.lateMinutes} min</span>
                </div>
              )}

              <div className="flex justify-between">
                <span className="text-gray-400">Efficiency:</span>
                <span className="text-cyan-400 font-medium">
                  {parseFloat(hoveredDay.workingHours) > 0 ?
                    Math.round((parseFloat(hoveredDay.workingHours) / 8) * 100) : 0}%
                </span>
              </div>
            </div>

            {/* Click hint */}
            <div className="text-xs text-gray-500 mt-2 pt-2 border-t border-slate-600/30 text-center">
              Click for detailed view
            </div>
          </div>
        </div>
      )}

      {/* Enhanced Selected Day Details */}
      {selectedDay && (
        <div className="mt-6 p-6 bg-gradient-to-br from-slate-700/40 to-slate-800/40 rounded-xl border border-slate-600/30 backdrop-blur-sm">
          <div className="space-y-5">
            {/* Date Header */}
            <div className="flex items-center justify-between">
              <div>
                <h4 className="text-xl font-bold text-white">
                  {data.month} {selectedDay.day}, {data.year}
                </h4>
                <p className="text-sm text-gray-400 mt-1">
                  {new Date(data.year, new Date(`${data.month} 1, ${data.year}`).getMonth(), selectedDay.day).toLocaleDateString('en-US', { weekday: 'long' })}
                </p>
              </div>
              <div className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-semibold border-2 ${STATUS_COLOR[selectedDay.status]}`}>
                {getStatusIcon(selectedDay.status)}
                {getStatusLabel(selectedDay.status)}
              </div>
            </div>

            {/* Main Stats Grid */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              {/* Working Hours Card */}
              <div className="bg-blue-600/20 border border-blue-500/30 rounded-lg p-4">
                <div className="flex items-center gap-2 mb-2">
                  <Clock className="w-4 h-4 text-blue-400" />
                  <span className="text-xs font-medium text-blue-300 uppercase tracking-wide">Work Duration</span>
                </div>
                <div className="text-2xl font-bold text-blue-400">{selectedDay.workingHours}h</div>
                <div className="text-xs text-blue-300 mt-1">
                  {parseFloat(selectedDay.workingHours) >= 8 ? 'Full Day' :
                   parseFloat(selectedDay.workingHours) >= 5 ? 'Half Day' :
                   parseFloat(selectedDay.workingHours) > 0 ? 'Partial' : 'No Work'}
                </div>
              </div>

              {/* Break Time Card */}
              <div className="bg-yellow-600/20 border border-yellow-500/30 rounded-lg p-4">
                <div className="flex items-center gap-2 mb-2">
                  <Timer className="w-4 h-4 text-yellow-400" />
                  <span className="text-xs font-medium text-yellow-300 uppercase tracking-wide">Break Time</span>
                </div>
                <div className="text-2xl font-bold text-yellow-400">
                  {selectedDay.metadata?.totalBreakTime || '0.0'}h
                </div>
                <div className="text-xs text-yellow-300 mt-1">
                  {selectedDay.metadata?.breakSessions || 0} break{(selectedDay.metadata?.breakSessions || 0) !== 1 ? 's' : ''} taken
                </div>
              </div>

              {/* Efficiency Card */}
              <div className="bg-green-600/20 border border-green-500/30 rounded-lg p-4">
                <div className="flex items-center gap-2 mb-2">
                  <CheckCircle className="w-4 h-4 text-green-400" />
                  <span className="text-xs font-medium text-green-300 uppercase tracking-wide">Efficiency</span>
                </div>
                <div className="text-2xl font-bold text-green-400">
                  {parseFloat(selectedDay.workingHours) > 0 ?
                    Math.round((parseFloat(selectedDay.workingHours) / 8) * 100) : 0}%
                </div>
                <div className="text-xs text-green-300 mt-1">
                  Target: 8h
                </div>
              </div>
            </div>

            {/* Time Details */}
            <div className="bg-slate-600/20 rounded-lg p-4">
              <h5 className="text-sm font-semibold text-white mb-3 flex items-center gap-2">
                <Calendar className="w-4 h-4" />
                Time Details
              </h5>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-sm">
                {/* Arrival Time */}
                <div className="flex items-center justify-between">
                  <span className="text-gray-400 flex items-center gap-2">
                    <Clock className="w-3 h-3 text-green-400" />
                    Time In:
                  </span>
                  <span className="text-green-400 font-semibold">
                    {selectedDay.arrivalTime ?
                      (typeof selectedDay.arrivalTime === 'string' ?
                        (selectedDay.arrivalTime.includes('T') ?
                          new Date(selectedDay.arrivalTime).toLocaleTimeString([], {hour: '2-digit', minute: '2-digit', hour12: true})
                          : selectedDay.arrivalTime)
                        : '--')
                      : '--'}
                  </span>
                </div>

                {/* Departure Time */}
                <div className="flex items-center justify-between">
                  <span className="text-gray-400 flex items-center gap-2">
                    <Clock className="w-3 h-3 text-red-400" />
                    Time Out:
                  </span>
                  <span className="text-red-400 font-semibold">
                    {selectedDay.departureTime ?
                      (typeof selectedDay.departureTime === 'string' ?
                        (selectedDay.departureTime.includes('T') ?
                          new Date(selectedDay.departureTime).toLocaleTimeString([], {hour: '2-digit', minute: '2-digit', hour12: true})
                          : selectedDay.departureTime)
                        : '--')
                      : (selectedDay.arrivalTime ? 'Still Working' : '--')}
                  </span>
                </div>

                {/* Shift Type */}
                <div className="flex items-center justify-between">
                  <span className="text-gray-400">Shift Type:</span>
                  <span className="text-cyan-400 font-semibold">
                    {selectedDay.metadata?.isFlexible ? 'Flexible' : 'Standard'}
                  </span>
                </div>

                {/* Late Status */}
                {selectedDay.metadata?.lateMinutes > 0 && (
                  <div className="flex items-center justify-between">
                    <span className="text-gray-400">Late By:</span>
                    <span className="text-orange-400 font-semibold">
                      {selectedDay.metadata.lateMinutes} min
                    </span>
                  </div>
                )}
              </div>
            </div>

            {/* Attendance Status Details */}
            <div className="bg-slate-600/20 rounded-lg p-4">
              <h5 className="text-sm font-semibold text-white mb-3 flex items-center gap-2">
                <CheckCircle className="w-4 h-4" />
                Attendance Status
              </h5>
              <div className="grid grid-cols-2 gap-4 text-sm">
                <div className="flex justify-between">
                  <span className="text-gray-400">Status:</span>
                  <span className={`font-semibold ${
                    selectedDay.metadata?.isAbsent ? 'text-red-400' :
                    selectedDay.metadata?.isHalfDay ? 'text-yellow-400' :
                    selectedDay.metadata?.isLate ? 'text-orange-400' :
                    'text-green-400'
                  }`}>
                    {selectedDay.metadata?.isAbsent ? 'Absent' :
                     selectedDay.metadata?.isHalfDay ? 'Half Day' :
                     selectedDay.metadata?.isFullDay ? 'Full Day' :
                     'Present'}
                  </span>
                </div>
                <div className="flex justify-between">
                  <span className="text-gray-400">Shift:</span>
                  <span className="text-cyan-400 font-semibold">
                    {selectedDay.metadata?.shiftType === 'flexiblePermanent' ? 'Flexible Permanent' :
                     selectedDay.metadata?.shiftType === 'flexible' ? 'One-Day Flexible' :
                     'Standard'}
                  </span>
                </div>
                {selectedDay.metadata?.effectiveShift?.start && (
                  <div className="flex justify-between">
                    <span className="text-gray-400">Expected Time:</span>
                    <span className="text-blue-400 font-semibold">
                      {selectedDay.metadata.effectiveShift.start} - {selectedDay.metadata.effectiveShift.end}
                    </span>
                  </div>
                )}
                <div className="flex justify-between">
                  <span className="text-gray-400">Work + Break:</span>
                  <span className="text-purple-400 font-semibold">
                    {selectedDay.metadata?.netHours ? selectedDay.metadata.netHours.toFixed(1) : '0.0'}h
                  </span>
                </div>
              </div>
            </div>

            {/* Break Sessions Details */}
            {selectedDay.metadata?.breakSessions > 0 && (
              <div className="bg-slate-600/20 rounded-lg p-4">
                <h5 className="text-sm font-semibold text-white mb-3 flex items-center gap-2">
                  <Timer className="w-4 h-4" />
                  Break Analysis
                </h5>
                <div className="grid grid-cols-2 gap-4 text-sm">
                  <div className="flex justify-between">
                    <span className="text-gray-400">Total Breaks:</span>
                    <span className="text-yellow-400 font-semibold">{selectedDay.metadata.breakSessions}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-gray-400">Break Duration:</span>
                    <span className="text-yellow-400 font-semibold">{selectedDay.metadata.totalBreakTime}h</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-gray-400">Avg Break:</span>
                    <span className="text-yellow-400 font-semibold">
                      {selectedDay.metadata.breakSessions > 0 ?
                        ((parseFloat(selectedDay.metadata.totalBreakTime) * 60) / selectedDay.metadata.breakSessions).toFixed(0) : 0} min
                    </span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-gray-400">Break %:</span>
                    <span className="text-yellow-400 font-semibold">
                      {selectedDay.metadata.netHours > 0 ?
                        Math.round((parseFloat(selectedDay.metadata.totalBreakTime) / selectedDay.metadata.netHours) * 100) : 0}%
                    </span>
                  </div>
                </div>

                {/* Break vs Work Ratio Visualization */}
                {parseFloat(selectedDay.workingHours) > 0 && (
                  <div className="mt-3 pt-3 border-t border-slate-500/30">
                    <div className="flex justify-between text-xs text-gray-400 mb-1">
                      <span>Work vs Break Ratio</span>
                      <span>{(parseFloat(selectedDay.workingHours) / (parseFloat(selectedDay.metadata.totalBreakTime) || 1)).toFixed(1)}:1</span>
                    </div>
                    <div className="w-full bg-slate-700 rounded-full h-2 overflow-hidden">
                      <div className="h-full flex">
                        <div
                          className="bg-blue-500"
                          style={{
                            width: `${(parseFloat(selectedDay.workingHours) / selectedDay.metadata.netHours) * 100}%`
                          }}
                        ></div>
                        <div
                          className="bg-yellow-500"
                          style={{
                            width: `${(parseFloat(selectedDay.metadata.totalBreakTime) / selectedDay.metadata.netHours) * 100}%`
                          }}
                        ></div>
                      </div>
                    </div>
                    <div className="flex justify-between text-xs mt-1">
                      <span className="text-blue-400">Work ({selectedDay.workingHours}h)</span>
                      <span className="text-yellow-400">Break ({selectedDay.metadata.totalBreakTime}h)</span>
                    </div>
                  </div>
                )}
              </div>
            )}

            {/* Action Buttons */}
            <div className="flex justify-between items-center pt-2">
              <div className="text-xs text-gray-500">
                Click any day to view details
              </div>
              <button
                onClick={() => setSelectedDay(null)}
                className="px-4 py-2 bg-slate-600 hover:bg-slate-500 text-white text-sm rounded-lg transition-colors flex items-center gap-2"
              >
                <XCircle className="w-4 h-4" />
                Close
              </button>
            </div>
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