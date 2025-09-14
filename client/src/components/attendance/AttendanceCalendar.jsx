import React, { useState, useRef, useEffect } from "react";
import { Calendar, Clock, AlertTriangle, CheckCircle } from "lucide-react";

const STATUS_COLOR = {
  present: "bg-green-700 text-green-200 cursor-pointer hover:bg-green-600",
  absent: "bg-red-700 text-red-200 cursor-pointer hover:bg-red-600",
  holiday: "bg-blue-700 text-blue-200 cursor-pointer hover:bg-blue-600",
  weekend: "bg-gray-700 text-gray-300 cursor-pointer hover:bg-gray-600",
  leave: "bg-purple-500 text-purple-200 cursor-pointer hover:bg-purple-400",
  late: "bg-orange-700 text-orange-200 cursor-pointer hover:bg-orange-600",
  "half-day": "bg-yellow-700 text-yellow-200 cursor-pointer hover:bg-yellow-600",
  default: "bg-slate-600 text-slate-300 cursor-pointer hover:bg-slate-500",
};

const AttendanceCalendar = ({ data }) => {
  const [hoveredDay, setHoveredDay] = useState(null);
  const [tooltipStyle, setTooltipStyle] = useState({});
  const [selectedDay, setSelectedDay] = useState(null);
  const containerRef = useRef(null);

  if (!data) return null;

  const daysOfWeek = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
  const monthIndex = new Date(`${data.month} 1, ${data.year}`).getMonth();
  const maxDays = new Date(data.year, monthIndex + 1, 0).getDate();
  const blanks = Array(data.startDayOfWeek).fill(null);

  // Prepare days array with enhanced status handling
  const days = Array.from({ length: maxDays }, (_, i) => {
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
    };
  });

  // Update tooltip position on hover
  useEffect(() => {
    if (hoveredDay !== null && containerRef.current) {
      const dayCell = containerRef.current.querySelector(`[data-day='${hoveredDay.day}']`);
      if (dayCell) {
        const rect = dayCell.getBoundingClientRect();
        const containerRect = containerRef.current.getBoundingClientRect();

        const tooltipWidth = 280;
        let left = rect.left - containerRect.left + rect.width / 2 - tooltipWidth / 2;
        if (left < 5) left = 5;
        if (left + tooltipWidth > containerRect.width - 5) left = containerRect.width - tooltipWidth - 5;

        const top = rect.top - containerRect.top - 100; // More space for detailed tooltip

        setTooltipStyle({
          left,
          top,
          width: tooltipWidth,
        });
      }
    } else {
      setTooltipStyle({});
    }
  }, [hoveredDay]);

  // Enhanced tooltip content with more details
  const getTooltipContent = (day) => {
    const content = [];
    
    // Date header
    const dateStr = new Date(data.year, monthIndex, day.day).toLocaleDateString('en-US', {
      weekday: 'long',
      month: 'long',
      day: 'numeric'
    });
    content.push({ type: 'header', text: dateStr });
    
    // Main status or holiday name
    if (day.status === "holiday" && day.name) {
      content.push({ type: 'status', text: `🎉 ${day.name}`, color: 'text-blue-400' });
    } else if (day.status === "weekend") {
      content.push({ type: 'status', text: "🏠 Weekend", color: 'text-gray-400' });
    } else if (day.status === "leave") {
      content.push({ type: 'status', text: `🌴 ${day.name || 'Approved Leave'}`, color: 'text-purple-400' });
    } else {
      // Working day details
      const statusEmoji = {
        present: "✅",
        late: "⏰",
        absent: "❌",
        "half-day": "🕐",
        default: "📅"
      };
      
      const statusColors = {
        present: "text-green-400",
        late: "text-orange-400",
        absent: "text-red-400",
        "half-day": "text-yellow-400",
        default: "text-gray-400"
      };
      
      content.push({ 
        type: 'status', 
        text: `${statusEmoji[day.status] || "📅"} ${day.status.charAt(0).toUpperCase() + day.status.slice(1)}`,
        color: statusColors[day.status] || "text-gray-400"
      });
    }
    
    // Working hours (for all statuses)
    if (parseFloat(day.workingHours) > 0) {
      content.push({ 
        type: 'info', 
        text: `⏱️ ${day.workingHours}h worked`,
        color: 'text-blue-400'
      });
    }
    
    // Time details for working days
    if (day.status === "present" || day.status === "late" || day.status === "half-day") {
      if (day.arrivalTime) {
        const arrivalTime = new Date(day.arrivalTime);
        content.push({ 
          type: 'info', 
          text: `🚪 In: ${arrivalTime.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}`,
          color: 'text-gray-300'
        });
      }
      
      if (day.departureTime) {
        const departureTime = new Date(day.departureTime);
        content.push({ 
          type: 'info', 
          text: `🚪 Out: ${departureTime.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}`,
          color: 'text-gray-300'
        });
      }
      
      // Break information
      if (day.metadata?.totalBreakTime && parseFloat(day.metadata.totalBreakTime) > 0) {
        content.push({ 
          type: 'info', 
          text: `☕ Break: ${day.metadata.totalBreakTime}h`,
          color: 'text-yellow-400'
        });
      }
      
      // Late information
      if (day.metadata?.lateMinutes && day.metadata.lateMinutes > 0) {
        content.push({ 
          type: 'warning', 
          text: `⏰ Late by ${day.metadata.lateMinutes} minutes`,
          color: 'text-orange-400'
        });
      }
      
      // Flexible shift indicator
      if (day.metadata?.isFlexible) {
        content.push({ 
          type: 'info', 
          text: "🔄 Flexible shift",
          color: 'text-cyan-400'
        });
      }

      // Break sessions count
      if (day.metadata?.breakSessions > 0) {
        content.push({ 
          type: 'info', 
          text: `🔢 ${day.metadata.breakSessions} break session${day.metadata.breakSessions !== 1 ? 's' : ''}`,
          color: 'text-gray-400'
        });
      }
    }
    
    return content;
  };

  // Get status indicator for visual feedback
  const getStatusIndicator = (status) => {
    const indicators = {
      present: "●",
      late: "◐",
      absent: "○",
      "half-day": "◑",
      holiday: "★",
      weekend: "▪",
      leave: "▲",
      default: "○"
    };
    return indicators[status] || "○";
  };

  // Handle day click for detailed view
  const handleDayClick = (day) => {
    if (day.status !== "default" && day.status !== "weekend") {
      setSelectedDay(day);
    }
  };

  return (
    <div
      ref={containerRef}
      className="relative bg-[#161c2c] rounded-xl shadow-md p-4 w-full border border-[#232945]"
    >
      <div className="flex justify-between items-center mb-4">
        <div className="flex items-center gap-2">
          <Calendar className="w-5 h-5 text-blue-400" />
          <h3 className="font-semibold text-lg text-gray-100">
            {data.month} {data.year}
          </h3>
        </div>
        
        {/* Enhanced Legend */}
        <div className="flex items-center gap-3 text-xs">
          <div className="flex items-center gap-1">
            <span className="w-2 h-2 rounded-full bg-green-500"></span>
            <span className="text-gray-400">Present</span>
          </div>
          <div className="flex items-center gap-1">
            <span className="w-2 h-2 rounded-full bg-orange-500"></span>
            <span className="text-gray-400">Late</span>
          </div>
          <div className="flex items-center gap-1">
            <span className="w-2 h-2 rounded-full bg-yellow-500"></span>
            <span className="text-gray-400">Half Day</span>
          </div>
          <div className="flex items-center gap-1">
            <span className="w-2 h-2 rounded-full bg-red-500"></span>
            <span className="text-gray-400">Absent</span>
          </div>
          <div className="flex items-center gap-1">
            <span className="w-2 h-2 rounded-full bg-purple-500"></span>
            <span className="text-gray-400">Leave</span>
          </div>
          <div className="flex items-center gap-1">
            <span className="w-2 h-2 rounded-full bg-blue-500"></span>
            <span className="text-gray-400">Holiday</span>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-7 gap-2 mb-2">
        {daysOfWeek.map((d) => (
          <div key={d} className="text-xs font-semibold text-center text-gray-400 py-1">
            {d}
          </div>
        ))}
      </div>

      <div className="grid grid-cols-7 gap-2">
        {/* Blank days */}
        {blanks.map((_, idx) => (
          <div key={`blank-${idx}`} className="h-14 rounded-lg" />
        ))}

        {/* Days */}
        {days.map((day) => {
          const statusColor = STATUS_COLOR[day.status] || STATUS_COLOR.default;
          const indicator = getStatusIndicator(day.status);
          const isToday = new Date().getDate() === day.day && 
                           new Date().getMonth() === monthIndex && 
                           new Date().getFullYear() === data.year;
          const isSelected = selectedDay?.day === day.day;

          return (
            <div
              key={day.day}
              data-day={day.day}
              onMouseEnter={() => setHoveredDay(day)}
              onMouseLeave={() => setHoveredDay(null)}
              onClick={() => handleDayClick(day)}
              className={`h-14 rounded-lg flex flex-col justify-center items-center font-medium select-none transition-all duration-200 relative ${statusColor} ${
                isToday ? "ring-2 ring-blue-400 ring-offset-1 ring-offset-[#161c2c]" : ""
              } ${isSelected ? "ring-2 ring-purple-400 ring-offset-1 ring-offset-[#161c2c]" : ""}`}
            >
              <div className="text-sm font-semibold">{day.day}</div>
              <div className="text-xs opacity-75">{indicator}</div>
              
              {/* Working hours indicator for present days */}
              {(day.status === "present" || day.status === "late" || day.status === "half-day") && parseFloat(day.workingHours) > 0 && (
                <div className="absolute -bottom-1 -right-1 bg-blue-600 text-white text-xs rounded-full w-5 h-5 flex items-center justify-center font-bold">
                  {Math.round(parseFloat(day.workingHours))}
                </div>
              )}
              
              {/* Late indicator */}
              {day.status === "late" && day.metadata?.lateMinutes > 0 && (
                <div className="absolute -top-1 -left-1 bg-orange-500 rounded-full w-3 h-3 flex items-center justify-center">
                  <Clock className="w-2 h-2 text-white" />
                </div>
              )}
              
              {/* Today indicator */}
              {isToday && (
                <div className="absolute -top-1 -right-1 bg-blue-500 rounded-full w-2 h-2 animate-pulse"></div>
              )}

              {/* Break sessions indicator */}
              {day.metadata?.breakSessions > 0 && (
                <div className="absolute top-0 left-0 text-xs text-yellow-400">
                  ●
                </div>
              )}
            </div>
          );
        })}
      </div>

      {/* Enhanced frosted glass tooltip */}
      {hoveredDay && (
        <div
          className="absolute z-50 pointer-events-none text-sm rounded-xl px-4 py-3 select-none transition-all duration-300 transform"
          style={{
            position: "absolute",
            left: tooltipStyle.left,
            top: tooltipStyle.top,
            width: tooltipStyle.width,
            opacity: hoveredDay ? 1 : 0,
            userSelect: "none",
            background: "rgba(15, 20, 25, 0.95)",
            backdropFilter: "blur(12px)",
            WebkitBackdropFilter: "blur(12px)",
            boxShadow:
              "0 10px 40px 0 rgba(0, 0, 0, 0.5), 0 0 20px 2px rgba(59, 130, 246, 0.3)",
            border: "1px solid rgba(59, 130, 246, 0.3)",
            color: "#f0f4f8",
            fontWeight: "500",
            textAlign: "left",
            lineHeight: "1.4",
          }}
        >
          <div className="space-y-2">
            {getTooltipContent(hoveredDay).map((item, idx) => (
              <div key={idx} className={`${
                item.type === 'header' ? 'text-base font-semibold text-white border-b border-gray-600 pb-1' :
                item.type === 'status' ? `text-sm font-medium ${item.color}` :
                item.type === 'warning' ? `text-sm ${item.color}` :
                `text-sm ${item.color || 'text-gray-300'}`
              }`}>
                {item.text}
              </div>
            ))}
          </div>
          
          {/* Tooltip arrow */}
          <div
            style={{
              position: "absolute",
              width: 0,
              height: 0,
              borderLeft: "8px solid transparent",
              borderRight: "8px solid transparent",
              borderTop: "8px solid rgba(15, 20, 25, 0.95)",
              bottom: -8,
              left: "50%",
              transform: "translateX(-50%)",
              filter: "drop-shadow(0 2px 4px rgba(0,0,0,0.3))",
            }}
          />
        </div>
      )}
      
      {/* Enhanced Monthly summary with performance insights */}
      <div className="mt-4 pt-3 border-t border-[#232945]">
        <div className="grid grid-cols-2 sm:grid-cols-5 gap-4 text-xs">
          <div className="text-center">
            <div className="flex items-center justify-center gap-1 mb-1">
              <CheckCircle className="w-3 h-3 text-green-400" />
              <span className="text-green-400 font-semibold text-sm">
                {days.filter(d => d.status === "present").length}
              </span>
            </div>
            <div className="text-gray-400">Present</div>
          </div>
          <div className="text-center">
            <div className="flex items-center justify-center gap-1 mb-1">
              <Clock className="w-3 h-3 text-orange-400" />
              <span className="text-orange-400 font-semibold text-sm">
                {days.filter(d => d.status === "late").length}
              </span>
            </div>
            <div className="text-gray-400">Late</div>
          </div>
          <div className="text-center">
            <div className="flex items-center justify-center gap-1 mb-1">
              <AlertTriangle className="w-3 h-3 text-red-400" />
              <span className="text-red-400 font-semibold text-sm">
                {days.filter(d => d.status === "absent").length}
              </span>
            </div>
            <div className="text-gray-400">Absent</div>
          </div>
          <div className="text-center">
            <div className="text-purple-400 font-semibold text-sm">
              {days.filter(d => d.status === "leave").length}
            </div>
            <div className="text-gray-400">On Leave</div>
          </div>
          <div className="text-center">
            <div className="text-blue-400 font-semibold text-sm">
              {days.filter(d => d.status === "holiday").length}
            </div>
            <div className="text-gray-400">Holidays</div>
          </div>
        </div>
        
        {/* Monthly performance summary */}
        {data.monthlyStats && (
          <div className="mt-3 pt-3 border-t border-[#232945] text-xs text-gray-400">
            <div className="flex justify-between items-center">
              <span>Monthly Performance:</span>
              <div className="flex gap-4">
                <span className="text-blue-400">
                  {((data.monthlyStats.totalPresent / (data.monthlyStats.totalPresent + data.monthlyStats.totalAbsent)) * 100 || 0).toFixed(1)}% attendance
                </span>
                <span className="text-green-400">
                  {days.reduce((sum, d) => sum + parseFloat(d.workingHours || 0), 0).toFixed(1)}h total
                </span>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default AttendanceCalendar;