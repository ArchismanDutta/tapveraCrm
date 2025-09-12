import React, { useState, useMemo } from "react";
import { BarChart3, Clock, TrendingUp, Target, Calendar } from "lucide-react";

const WeeklyHoursChart = ({ weeklyHours = [], targetHours = 8, showTarget = true }) => {
  const [hoveredIndex, setHoveredIndex] = useState(null);
  const [chartType, setChartType] = useState("bar");

  // Calculate metrics with proper efficiency calculation
  const metrics = useMemo(() => {
    if (!weeklyHours || weeklyHours.length === 0) {
      return {
        totalHours: "0.0",
        workingDays: 0,
        targetMet: 0,
        efficiency: "0"
      };
    }

    const totalHours = weeklyHours.reduce((sum, d) => sum + (d.hours || 0), 0);
    
    // Only count weekdays (Mon-Fri) for working days calculation
    const weekdayIndices = [1, 2, 3, 4, 5]; // Monday to Friday
    const weekdayData = weeklyHours.filter((_, index) => {
      // Map array index to day of week (assuming weeklyHours starts with Sunday)
      const dayOfWeek = index === 0 ? 0 : index; // Sunday=0, Mon=1, etc.
      return weekdayIndices.includes(dayOfWeek);
    });
    
    const workingDaysWithHours = weekdayData.filter(d => (d.hours || 0) > 0).length;
    const targetMetDays = weekdayData.filter(d => (d.hours || 0) >= targetHours).length;
    
    // Efficiency: percentage of working days where target was met
    const efficiency = workingDaysWithHours > 0 ? 
      Math.round((targetMetDays / workingDaysWithHours) * 100) : 0;

    return {
      totalHours: totalHours.toFixed(1),
      workingDays: workingDaysWithHours,
      targetMet: targetMetDays,
      efficiency: efficiency.toString()
    };
  }, [weeklyHours, targetHours]);

  // Chart dimensions and scales
  const chartHeight = 280;
  const barWidth = 35;
  const barGap = 25;
  const padding = { top: 30, right: 20, bottom: 50, left: 40 };
  const svgWidth = Math.max(weeklyHours.length * (barWidth + barGap) + padding.left + padding.right, 400);
  const svgHeight = chartHeight + padding.top + padding.bottom;
  const maxScale = Math.max(...weeklyHours.map(d => d.hours || 0), targetHours, 8) + 2;

  const getBarColor = (hours, index, isHovered) => {
    if (isHovered) return "#3b82f6";
    if (!hours || hours === 0) return "#374151"; // Dark gray for no work
    if (hours >= targetHours) return "#10b981"; // Green for target met
    if (hours >= targetHours * 0.75) return "#f59e0b"; // Amber for close to target
    return "#ef4444"; // Red for below target
  };

  const yAxisLabels = Array.from({ length: Math.ceil(maxScale) + 1 }, (_, i) => i);

  const linePath = useMemo(() => {
    if (chartType !== "line" || weeklyHours.length === 0) return "";
    const points = weeklyHours.map((data, index) => {
      const x = padding.left + index * (barWidth + barGap) + barWidth / 2;
      const y = padding.top + chartHeight - ((data.hours || 0) / maxScale) * chartHeight;
      return `${x},${y}`;
    });
    return `M ${points.join(" L ")}`;
  }, [weeklyHours, chartType, maxScale, barWidth, barGap, chartHeight, padding]);

  if (!weeklyHours || weeklyHours.length === 0) {
    return (
      <div className="bg-[#161c2c] rounded-xl shadow-md p-6 w-full border border-[#232945]">
        <div className="flex items-center gap-2 mb-4">
          <BarChart3 className="w-5 h-5 text-blue-400" />
          <h3 className="font-semibold text-lg text-gray-100">Weekly Hours</h3>
        </div>
        <div className="text-center py-12">
          <Calendar className="w-16 h-16 text-gray-600 mx-auto mb-4" />
          <p className="text-gray-400 text-lg mb-2">No data available</p>
          <p className="text-gray-500 text-sm">Weekly hours will appear here once you start tracking time.</p>
        </div>
      </div>
    );
  }

  return (
    <div className="bg-[#161c2c] rounded-xl shadow-md p-6 w-full border border-[#232945]">
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div className="flex items-center gap-2">
          <BarChart3 className="w-5 h-5 text-blue-400" />
          <h3 className="font-semibold text-lg text-gray-100">Weekly Hours</h3>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={() => setChartType("bar")}
            className={`p-2 rounded-md transition-colors ${
              chartType === "bar"
                ? "bg-blue-600 text-white"
                : "bg-[#232945] text-gray-400 hover:text-gray-200"
            }`}
            title="Bar Chart"
          >
            <BarChart3 className="w-4 h-4" />
          </button>
          <button
            onClick={() => setChartType("line")}
            className={`p-2 rounded-md transition-colors ${
              chartType === "line"
                ? "bg-blue-600 text-white"
                : "bg-[#232945] text-gray-400 hover:text-gray-200"
            }`}
            title="Line Chart"
          >
            <TrendingUp className="w-4 h-4" />
          </button>
        </div>
      </div>

      {/* Metrics */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mb-6">
        <div className="bg-[#232945] rounded-lg p-4">
          <div className="flex items-center gap-2 mb-1">
            <Clock className="w-4 h-4 text-blue-400" />
            <span className="text-xs text-gray-400">Total Hours</span>
          </div>
          <span className="text-xl font-bold text-blue-400">{metrics.totalHours}h</span>
        </div>
        <div className="bg-[#232945] rounded-lg p-4">
          <div className="flex items-center gap-2 mb-1">
            <Target className="w-4 h-4 text-green-400" />
            <span className="text-xs text-gray-400">Target Met</span>
          </div>
          <span className="text-xl font-bold text-green-400">
            {metrics.targetMet}/{metrics.workingDays}
          </span>
        </div>
        <div className="bg-[#232945] rounded-lg p-4">
          <div className="flex items-center gap-2 mb-1">
            <TrendingUp className="w-4 h-4 text-purple-400" />
            <span className="text-xs text-gray-400">Efficiency</span>
          </div>
          <span className="text-xl font-bold text-purple-400">{metrics.efficiency}%</span>
        </div>
      </div>

      {/* Chart */}
      <div className="relative bg-[#0f1419] rounded-lg p-4 overflow-x-auto">
        <div className="min-w-[500px]">
          <svg
            viewBox={`0 0 ${svgWidth} ${svgHeight}`}
            preserveAspectRatio="xMidYMid meet"
            className="w-full h-auto min-h-[300px]"
          >
            {/* Definitions */}
            <defs>
              <filter id="glow">
                <feGaussianBlur stdDeviation="3" result="coloredBlur" />
                <feMerge>
                  <feMergeNode in="coloredBlur" />
                  <feMergeNode in="SourceGraphic" />
                </feMerge>
              </filter>
              <linearGradient id="barGradient" x1="0%" y1="0%" x2="0%" y2="100%">
                <stop offset="0%" stopColor="rgba(59, 130, 246, 0.8)" />
                <stop offset="100%" stopColor="rgba(59, 130, 246, 0.4)" />
              </linearGradient>
            </defs>

            {/* Y Grid */}
            {yAxisLabels.map((label) => {
              const y = padding.top + chartHeight - (label / maxScale) * chartHeight;
              return (
                <g key={label}>
                  <line
                    x1={padding.left}
                    y1={y}
                    x2={svgWidth - padding.right}
                    y2={y}
                    stroke="#374151"
                    strokeDasharray="2,2"
                    opacity="0.3"
                  />
                  <text
                    x={padding.left - 10}
                    y={y + 4}
                    textAnchor="end"
                    fontSize="11"
                    fill="#6b7280"
                  >
                    {label}h
                  </text>
                </g>
              );
            })}

            {/* Target Line */}
            {showTarget && targetHours > 0 && (
              <g>
                <line
                  x1={padding.left}
                  y1={padding.top + chartHeight - (targetHours / maxScale) * chartHeight}
                  x2={svgWidth - padding.right}
                  y2={padding.top + chartHeight - (targetHours / maxScale) * chartHeight}
                  stroke="#f59e0b"
                  strokeDasharray="8,4"
                  strokeWidth="2"
                  opacity="0.8"
                />
                <text
                  x={svgWidth - padding.right - 5}
                  y={padding.top + chartHeight - (targetHours / maxScale) * chartHeight - 5}
                  textAnchor="end"
                  fontSize="10"
                  fill="#f59e0b"
                  fontWeight="bold"
                >
                  Target: {targetHours}h
                </text>
              </g>
            )}

            {/* Chart Type */}
            {chartType === "bar"
              ? weeklyHours.map((data, index) => {
                  const hours = data.hours || 0;
                  const barHeight = Math.max((hours / maxScale) * chartHeight, 0);
                  const x = padding.left + index * (barWidth + barGap);
                  const y = padding.top + chartHeight - barHeight;
                  const isHovered = index === hoveredIndex;
                  const barColor = getBarColor(hours, index, isHovered);

                  return (
                    <g key={`${data.label}-${index}`}>
                      {/* Shadow */}
                      <rect 
                        x={x + 2} 
                        y={y + 2} 
                        width={barWidth} 
                        height={barHeight} 
                        fill="#000" 
                        opacity="0.2" 
                        rx="6" 
                      />
                      {/* Main bar */}
                      <rect
                        x={x}
                        y={y}
                        width={barWidth}
                        height={Math.max(barHeight, 2)} // Minimum height for visibility
                        fill={barColor}
                        rx="6"
                        className="cursor-pointer transition-all duration-200"
                        style={{ 
                          filter: isHovered ? "url(#glow)" : "none",
                          transform: isHovered ? "scale(1.02)" : "scale(1)"
                        }}
                        onMouseEnter={() => setHoveredIndex(index)}
                        onMouseLeave={() => setHoveredIndex(null)}
                      />
                      
                      {/* Hover tooltip */}
                      {isHovered && (
                        <g>
                          <rect 
                            x={x - 10} 
                            y={y - 35} 
                            width={barWidth + 20} 
                            height={25} 
                            fill="#1f2937" 
                            stroke="#374151" 
                            rx="4" 
                          />
                          <text 
                            x={x + barWidth / 2} 
                            y={y - 18} 
                            textAnchor="middle" 
                            fontSize="12" 
                            fill="#fff" 
                            fontWeight="bold"
                          >
                            {hours.toFixed(1)}h
                          </text>
                        </g>
                      )}
                      
                      {/* Day label */}
                      <text
                        x={x + barWidth / 2}
                        y={padding.top + chartHeight + 20}
                        textAnchor="middle"
                        fontSize="12"
                        fill={isHovered ? "#ffffff" : "#9ca3af"}
                        fontWeight={isHovered ? "bold" : "normal"}
                      >
                        {data.label}
                      </text>
                      
                      {/* Hours label */}
                      <text 
                        x={x + barWidth / 2} 
                        y={padding.top + chartHeight + 35} 
                        textAnchor="middle" 
                        fontSize="10" 
                        fill="#6b7280"
                      >
                        {hours.toFixed(1)}h
                      </text>
                    </g>
                  );
                })
              : (
                <g>
                  {/* Line path */}
                  <path 
                    d={linePath} 
                    stroke="#3b82f6" 
                    strokeWidth="3" 
                    fill="none"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                  />
                  
                  {/* Data points */}
                  {weeklyHours.map((data, index) => {
                    const hours = data.hours || 0;
                    const x = padding.left + index * (barWidth + barGap) + barWidth / 2;
                    const y = padding.top + chartHeight - (hours / maxScale) * chartHeight;
                    const isHovered = index === hoveredIndex;

                    return (
                      <g key={`${data.label}-${index}`}>
                        <circle
                          cx={x}
                          cy={y}
                          r={isHovered ? "8" : "5"}
                          fill="#3b82f6"
                          stroke="#ffffff"
                          strokeWidth="2"
                          className="cursor-pointer transition-all duration-200"
                          onMouseEnter={() => setHoveredIndex(index)}
                          onMouseLeave={() => setHoveredIndex(null)}
                        />
                        
                        {/* Hover tooltip */}
                        {isHovered && (
                          <g>
                            <rect 
                              x={x - 20} 
                              y={y - 35} 
                              width="40" 
                              height="25" 
                              fill="#1f2937" 
                              stroke="#374151" 
                              rx="4" 
                            />
                            <text 
                              x={x} 
                              y={y - 18} 
                              textAnchor="middle" 
                              fontSize="12" 
                              fill="#fff" 
                              fontWeight="bold"
                            >
                              {hours.toFixed(1)}h
                            </text>
                          </g>
                        )}
                        
                        {/* Day label */}
                        <text 
                          x={x} 
                          y={padding.top + chartHeight + 20} 
                          textAnchor="middle" 
                          fontSize="12" 
                          fill={isHovered ? "#ffffff" : "#9ca3af"}
                        >
                          {data.label}
                        </text>
                        
                        {/* Hours label */}
                        <text 
                          x={x} 
                          y={padding.top + chartHeight + 35} 
                          textAnchor="middle" 
                          fontSize="10" 
                          fill="#6b7280"
                        >
                          {hours.toFixed(1)}h
                        </text>
                      </g>
                    );
                  })}
                </g>
              )}
          </svg>
        </div>
      </div>

      {/* Legend */}
      <div className="flex flex-wrap items-center justify-center gap-6 mt-6 text-xs text-gray-400">
        <div className="flex items-center gap-2">
          <div className="w-3 h-3 rounded-full bg-green-500" />
          <span>Target Met ({targetHours}h+)</span>
        </div>
        <div className="flex items-center gap-2">
          <div className="w-3 h-3 rounded-full bg-yellow-500" />
          <span>Close ({Math.round(targetHours * 0.75)}h+)</span>
        </div>
        <div className="flex items-center gap-2">
          <div className="w-3 h-3 rounded-full bg-red-500" />
          <span>Below Target</span>
        </div>
        <div className="flex items-center gap-2">
          <div className="w-3 h-3 rounded-full bg-gray-600" />
          <span>No Work</span>
        </div>
      </div>
    </div>
  );
};

export default WeeklyHoursChart;