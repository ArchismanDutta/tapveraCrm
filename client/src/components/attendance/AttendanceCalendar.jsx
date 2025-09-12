import React, { useState, useRef, useEffect } from "react";

const STATUS_COLOR = {
  present: "bg-green-700 text-green-200 cursor-pointer hover:bg-green-600",
  absent: "bg-red-700 text-red-200 cursor-pointer hover:bg-red-600",
  holiday: "bg-blue-700 text-blue-200 cursor-pointer hover:bg-blue-600",
  weekend: "bg-gray-700 text-gray-300 cursor-pointer hover:bg-gray-600",
  leave: "bg-purple-500 text-purple-200 cursor-pointer hover:bg-purple-400",
  default: "bg-slate-600 text-slate-300 cursor-pointer hover:bg-slate-500",
};

const AttendanceCalendar = ({ data }) => {
  const [hoveredDay, setHoveredDay] = useState(null);
  const [tooltipStyle, setTooltipStyle] = useState({});
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

        const tooltipWidth = 200;
        let left = rect.left - containerRect.left + rect.width / 2 - tooltipWidth / 2;
        if (left < 5) left = 5;
        if (left + tooltipWidth > containerRect.width - 5) left = containerRect.width - tooltipWidth - 5;

        const top = rect.top - containerRect.top - 80; // More space for detailed tooltip

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
    
    // Main status or holiday name
    if (day.status === "holiday" && day.name) {
      content.push(`🎉 ${day.name}`);
    } else if (day.status === "weekend") {
      content.push("🏠 Weekend");
    } else if (day.status === "leave") {
      content.push(`🌴 ${day.name || 'Approved Leave'}`);
    } else {
      // Working day details
      const statusEmoji = {
        present: "✅",
        absent: "❌",
        default: "📅"
      };
      
      content.push(`${statusEmoji[day.status] || "📅"} ${day.status.charAt(0).toUpperCase() + day.status.slice(1)}`);
    }
    
    // Working hours (for all statuses)
    if (parseFloat(day.workingHours) > 0) {
      content.push(`⏱️ ${day.workingHours}h worked`);
    }
    
    // Time details for working days
    if (day.status === "present") {
      if (day.arrivalTime) {
        const arrivalTime = new Date(day.arrivalTime);
        content.push(`🚪 In: ${arrivalTime.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}`);
      }
      
      if (day.departureTime) {
        const departureTime = new Date(day.departureTime);
        content.push(`🚪 Out: ${departureTime.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}`);
      }
      
      // Break information
      if (day.metadata?.totalBreakTime && parseFloat(day.metadata.totalBreakTime) > 0) {
        content.push(`☕ Break: ${day.metadata.totalBreakTime}h`);
      }
      
      // Flexible shift indicator
      if (day.metadata?.isFlexible) {
        content.push("🔄 Flexible shift");
      }
    }
    
    return content;
  };

  // Get status indicator for visual feedback
  const getStatusIndicator = (status) => {
    const indicators = {
      present: "●",
      absent: "○",
      holiday: "★",
      weekend: "▪",
      leave: "▲",
      default: "○"
    };
    return indicators[status] || "○";
  };

  return (
    <div
      ref={containerRef}
      className="relative bg-[#161c2c] rounded-xl shadow-md p-4 w-full border border-[#232945]"
    >
      <div className="flex justify-between items-center mb-4">
        <h3 className="font-semibold text-lg text-gray-100">
          {data.month} {data.year}
        </h3>
        
        {/* Legend */}
        <div className="flex items-center gap-4 text-xs">
          <div className="flex items-center gap-1">
            <span className="w-2 h-2 rounded-full bg-green-500"></span>
            <span className="text-gray-400">Present</span>
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
          <div key={`blank-${idx}`} className="h-12 rounded-lg" />
        ))}

        {/* Days */}
        {days.map((day) => {
          const statusColor = STATUS_COLOR[day.status] || STATUS_COLOR.default;
          const indicator = getStatusIndicator(day.status);
          const isToday = new Date().getDate() === day.day && 
                           new Date().getMonth() === monthIndex && 
                           new Date().getFullYear() === data.year;

          return (
            <div
              key={day.day}
              data-day={day.day}
              onMouseEnter={() => setHoveredDay(day)}
              onMouseLeave={() => setHoveredDay(null)}
              className={`h-12 rounded-lg flex flex-col justify-center items-center font-medium select-none transition-all duration-200 relative ${statusColor} ${
                isToday ? "ring-2 ring-blue-400 ring-offset-1 ring-offset-[#161c2c]" : ""
              }`}
            >
              <div className="text-sm font-semibold">{day.day}</div>
              <div className="text-xs opacity-75">{indicator}</div>
              
              {/* Working hours indicator for present days */}
              {day.status === "present" && parseFloat(day.workingHours) > 0 && (
                <div className="absolute -bottom-1 -right-1 bg-blue-600 text-white text-xs rounded-full w-4 h-4 flex items-center justify-center font-bold">
                  {Math.round(parseFloat(day.workingHours))}
                </div>
              )}
              
              {/* Today indicator */}
              {isToday && (
                <div className="absolute -top-1 -right-1 bg-blue-500 rounded-full w-2 h-2"></div>
              )}
            </div>
          );
        })}
      </div>

      {/* Enhanced frosted glass tooltip */}
      {hoveredDay && (
        <div
          className="absolute z-50 pointer-events-none text-xs rounded-xl px-4 py-3 select-none transition-all duration-300 transform"
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
          <div className="space-y-1">
            {getTooltipContent(hoveredDay).map((line, idx) => (
              <div key={idx} className="text-sm">
                {line}
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
      
      {/* Monthly summary at the bottom */}
      <div className="mt-4 pt-3 border-t border-[#232945]">
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 text-xs text-gray-400">
          <div className="text-center">
            <div className="text-green-400 font-semibold text-sm">
              {days.filter(d => d.status === "present").length}
            </div>
            <div>Present</div>
          </div>
          <div className="text-center">
            <div className="text-red-400 font-semibold text-sm">
              {days.filter(d => d.status === "absent").length}
            </div>
            <div>Absent</div>
          </div>
          <div className="text-center">
            <div className="text-purple-400 font-semibold text-sm">
              {days.filter(d => d.status === "leave").length}
            </div>
            <div>On Leave</div>
          </div>
          <div className="text-center">
            <div className="text-blue-400 font-semibold text-sm">
              {days.filter(d => d.status === "holiday").length}
            </div>
            <div>Holidays</div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default AttendanceCalendar;