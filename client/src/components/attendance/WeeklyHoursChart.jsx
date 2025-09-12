import React, { useState, useMemo } from "react";
import {
  BarChart3,
  Clock,
  TrendingUp,
  Target,
  Calendar,
  Activity,
  Award,
  AlertCircle,
} from "lucide-react";

const WeeklyHoursChart = ({
  weeklyHours = [],
  targetHours = 8,
  showTarget = true,
}) => {
  const [hoveredIndex, setHoveredIndex] = useState(null);
  const [chartType, setChartType] = useState("bar");
  const [showDetails, setShowDetails] = useState(false);

  // Calculate comprehensive metrics
  const metrics = useMemo(() => {
    if (!weeklyHours || weeklyHours.length === 0) {
      return {
        totalHours: "0.0",
        workingDays: 0,
        targetMet: 0,
        efficiency: "0",
        streak: 0,
        trend: "neutral",
        avgDailyHours: "0.0",
        weekProgress: 0,
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

    const workingDaysWithHours = weekdayData.filter(
      (d) => (d.hours || 0) > 0
    ).length;
    const targetMetDays = weekdayData.filter(
      (d) => (d.hours || 0) >= targetHours
    ).length;

    // Efficiency: percentage of working days where target was met
    const efficiency =
      workingDaysWithHours > 0
        ? Math.round((targetMetDays / workingDaysWithHours) * 100)
        : 0;

    // Calculate streak of consecutive days meeting target
    let streak = 0;
    for (let i = weekdayData.length - 1; i >= 0; i--) {
      if ((weekdayData[i].hours || 0) >= targetHours) {
        streak++;
      } else if ((weekdayData[i].hours || 0) > 0) {
        break; // Stop at first working day that doesn't meet target
      }
    }

    // Calculate trend (comparing first half vs second half of week)
    const firstHalf = weekdayData
      .slice(0, 2)
      .reduce((sum, d) => sum + (d.hours || 0), 0);
    const secondHalf = weekdayData
      .slice(2)
      .reduce((sum, d) => sum + (d.hours || 0), 0);
    const trend =
      secondHalf > firstHalf
        ? "up"
        : secondHalf < firstHalf
        ? "down"
        : "neutral";

    // Average daily hours for working days only
    const avgDailyHours =
      workingDaysWithHours > 0
        ? (totalHours / workingDaysWithHours).toFixed(1)
        : "0.0";

    // Week progress (how much of ideal week is completed)
    const idealWeekHours = weekdayData.length * targetHours;
    const weekProgress = Math.min((totalHours / idealWeekHours) * 100, 100);

    return {
      totalHours: totalHours.toFixed(1),
      workingDays: workingDaysWithHours,
      targetMet: targetMetDays,
      efficiency: efficiency.toString(),
      streak,
      trend,
      avgDailyHours,
      weekProgress: Math.round(weekProgress),
    };
  }, [weeklyHours, targetHours]);

  // Chart dimensions and scales
  const chartHeight = 300;
  const barWidth = 40;
  const barGap = 20;
  const padding = { top: 40, right: 30, bottom: 60, left: 50 };
  const svgWidth = Math.max(
    weeklyHours.length * (barWidth + barGap) + padding.left + padding.right,
    500
  );
  const svgHeight = chartHeight + padding.top + padding.bottom;
  const maxScale =
    Math.max(...weeklyHours.map((d) => d.hours || 0), targetHours, 8) + 2;

  const getBarColor = (hours, index, isHovered) => {
    if (isHovered) return "#3b82f6";
    if (!hours || hours === 0) return "#374151"; // Dark gray for no work
    if (hours >= targetHours) return "#10b981"; // Green for target met
    if (hours >= targetHours * 0.75) return "#f59e0b"; // Amber for close to target
    return "#ef4444"; // Red for below target
  };

  const getPerformanceColor = (hours) => {
    if (!hours || hours === 0) return "text-gray-500";
    if (hours >= targetHours) return "text-green-400";
    if (hours >= targetHours * 0.75) return "text-yellow-400";
    return "text-red-400";
  };

  const yAxisLabels = Array.from(
    { length: Math.ceil(maxScale) + 1 },
    (_, i) => i
  );

  const linePath = useMemo(() => {
    if (chartType !== "line" || weeklyHours.length === 0) return "";
    const points = weeklyHours.map((data, index) => {
      const x = padding.left + index * (barWidth + barGap) + barWidth / 2;
      const y =
        padding.top +
        chartHeight -
        ((data.hours || 0) / maxScale) * chartHeight;
      return `${x},${y}`;
    });
    return `M ${points.join(" L ")}`;
  }, [
    weeklyHours,
    chartType,
    maxScale,
    barWidth,
    barGap,
    chartHeight,
    padding,
  ]);

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
          <p className="text-gray-500 text-sm">
            Weekly hours will appear here once you start tracking time.
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="bg-[#161c2c] rounded-xl shadow-md p-6 w-full border border-[#232945]">
      {/* Header with enhanced controls */}
      <div className="flex items-center justify-between mb-6">
        <div className="flex items-center gap-2">
          <BarChart3 className="w-5 h-5 text-blue-400" />
          <h3 className="font-semibold text-lg text-gray-100">Weekly Hours</h3>
          <div className="flex items-center gap-1 ml-2">
            {metrics.trend === "up" && (
              <TrendingUp className="w-4 h-4 text-green-400" />
            )}
            {metrics.trend === "down" && (
              <TrendingUp className="w-4 h-4 text-red-400 transform rotate-180" />
            )}
            {metrics.streak > 0 && (
              <div className="flex items-center gap-1 text-xs bg-green-900/30 text-green-400 px-2 py-1 rounded">
                <Award className="w-3 h-3" />
                {metrics.streak} day streak
              </div>
            )}
          </div>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={() => setShowDetails(!showDetails)}
            className={`p-2 rounded-md transition-colors ${
              showDetails
                ? "bg-blue-600 text-white"
                : "bg-[#232945] text-gray-400 hover:text-gray-200"
            }`}
            title="Toggle Details"
          >
            <Activity className="w-4 h-4" />
          </button>
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

      {/* Enhanced Metrics Grid */}
      <div
        className={`grid gap-4 mb-6 transition-all duration-300 ${
          showDetails
            ? "grid-cols-2 sm:grid-cols-4"
            : "grid-cols-1 sm:grid-cols-3"
        }`}
      >
        <div className="bg-[#232945] rounded-lg p-4">
          <div className="flex items-center gap-2 mb-1">
            <Clock className="w-4 h-4 text-blue-400" />
            <span className="text-xs text-gray-400">Total Hours</span>
          </div>
          <div className="flex items-center gap-2">
            <span className="text-xl font-bold text-blue-400">
              {metrics.totalHours}h
            </span>
            <div className="text-xs text-gray-500">
              of {(targetHours * 5).toFixed(0)}h expected
            </div>
          </div>
          <div className="w-full bg-gray-700 rounded-full h-1.5 mt-2">
            <div
              className="h-1.5 bg-blue-500 rounded-full transition-all duration-300"
              style={{ width: `${metrics.weekProgress}%` }}
            ></div>
          </div>
        </div>

        <div className="bg-[#232945] rounded-lg p-4">
          <div className="flex items-center gap-2 mb-1">
            <Target className="w-4 h-4 text-green-400" />
            <span className="text-xs text-gray-400">Target Met</span>
          </div>
          <div className="flex items-center gap-2">
            <span className="text-xl font-bold text-green-400">
              {metrics.targetMet}/{metrics.workingDays}
            </span>
            <div className="text-xs text-gray-500">days</div>
          </div>
        </div>

        <div className="bg-[#232945] rounded-lg p-4">
          <div className="flex items-center gap-2 mb-1">
            <TrendingUp className="w-4 h-4 text-purple-400" />
            <span className="text-xs text-gray-400">Efficiency</span>
          </div>
          <div className="flex items-center gap-2">
            <span className="text-xl font-bold text-purple-400">
              {metrics.efficiency}%
            </span>
            <div className="text-xs text-gray-500">target rate</div>
          </div>
        </div>

        {showDetails && (
          <div className="bg-[#232945] rounded-lg p-4">
            <div className="flex items-center gap-2 mb-1">
              <Activity className="w-4 h-4 text-cyan-400" />
              <span className="text-xs text-gray-400">Daily Avg</span>
            </div>
            <div className="flex items-center gap-2">
              <span className="text-xl font-bold text-cyan-400">
                {metrics.avgDailyHours}h
              </span>
              <div className="text-xs text-gray-500">per day</div>
            </div>
          </div>
        )}
      </div>

      {/* Chart */}
      <div className="relative bg-[#0f1419] rounded-lg p-4 overflow-x-auto custom-scrollbar">
        <div className="w-max min-w-full">
          <svg
            viewBox={`0 0 ${svgWidth} ${svgHeight}`}
            preserveAspectRatio="xMidYMid meet"
            className="w-full h-auto min-h-[350px]"
          >
            {/* Definitions for enhanced visuals */}
            <defs>
              <filter id="glow">
                <feGaussianBlur stdDeviation="3" result="coloredBlur" />
                <feMerge>
                  <feMergeNode in="coloredBlur" />
                  <feMergeNode in="SourceGraphic" />
                </feMerge>
              </filter>
              <linearGradient
                id="barGradient"
                x1="0%"
                y1="0%"
                x2="0%"
                y2="100%"
              >
                <stop offset="0%" stopColor="rgba(59, 130, 246, 0.8)" />
                <stop offset="100%" stopColor="rgba(59, 130, 246, 0.4)" />
              </linearGradient>
              <linearGradient
                id="targetGradient"
                x1="0%"
                y1="0%"
                x2="100%"
                y2="0%"
              >
                <stop offset="0%" stopColor="rgba(245, 158, 11, 0.2)" />
                <stop offset="50%" stopColor="rgba(245, 158, 11, 0.8)" />
                <stop offset="100%" stopColor="rgba(245, 158, 11, 0.2)" />
              </linearGradient>
            </defs>

            {/* Background grid */}
            {yAxisLabels.map((label) => {
              const y =
                padding.top + chartHeight - (label / maxScale) * chartHeight;
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

            {/* Target Line with enhanced styling */}
            {showTarget && targetHours > 0 && (
              <g>
                <line
                  x1={padding.left}
                  y1={
                    padding.top +
                    chartHeight -
                    (targetHours / maxScale) * chartHeight
                  }
                  x2={svgWidth - padding.right}
                  y2={
                    padding.top +
                    chartHeight -
                    (targetHours / maxScale) * chartHeight
                  }
                  stroke="url(#targetGradient)"
                  strokeDasharray="8,4"
                  strokeWidth="3"
                  opacity="0.8"
                />
                <text
                  x={svgWidth - padding.right - 5}
                  y={
                    padding.top +
                    chartHeight -
                    (targetHours / maxScale) * chartHeight -
                    8
                  }
                  textAnchor="end"
                  fontSize="12"
                  fill="#f59e0b"
                  fontWeight="bold"
                >
                  Target: {targetHours}h
                </text>

                {/* Target zone indicator */}
                <rect
                  x={padding.left}
                  y={
                    padding.top +
                    chartHeight -
                    (targetHours / maxScale) * chartHeight -
                    2
                  }
                  width={svgWidth - padding.left - padding.right}
                  height="4"
                  fill="rgba(245, 158, 11, 0.2)"
                  rx="2"
                />
              </g>
            )}

            {/* Chart content based on type */}
            {chartType === "bar" ? (
              weeklyHours.map((data, index) => {
                const hours = data.hours || 0;
                const barHeight = Math.max((hours / maxScale) * chartHeight, 0);
                const x = padding.left + index * (barWidth + barGap);
                const y = padding.top + chartHeight - barHeight;
                const isHovered = index === hoveredIndex;
                const barColor = getBarColor(hours, index, isHovered);
                const isWeekend = index === 0 || index === 6; // Sunday or Saturday

                return (
                  <g key={`${data.label}-${index}`}>
                    {/* Bar shadow */}
                    <rect
                      x={x + 2}
                      y={y + 2}
                      width={barWidth}
                      height={barHeight}
                      fill="#000"
                      opacity="0.3"
                      rx="6"
                    />

                    {/* Main bar with enhanced styling */}
                    <rect
                      x={x}
                      y={y}
                      width={barWidth}
                      height={Math.max(barHeight, 3)} // Minimum height for visibility
                      fill={barColor}
                      rx="6"
                      className="cursor-pointer transition-all duration-200"
                      style={{
                        filter: isHovered ? "url(#glow)" : "none",
                        transform: isHovered ? "scale(1.02)" : "scale(1)",
                        transformOrigin: `${x + barWidth / 2}px ${
                          y + barHeight
                        }px`,
                      }}
                      onMouseEnter={() => setHoveredIndex(index)}
                      onMouseLeave={() => setHoveredIndex(null)}
                    />

                    {/* Weekend indicator */}
                    {isWeekend && (
                      <rect
                        x={x}
                        y={y - 3}
                        width={barWidth}
                        height="3"
                        fill="#6b7280"
                        rx="1"
                        opacity="0.5"
                      />
                    )}

                    {/* Target achievement indicator */}
                    {hours >= targetHours && (
                      <circle
                        cx={x + barWidth - 6}
                        cy={y + 6}
                        r="4"
                        fill="#10b981"
                        stroke="#ffffff"
                        strokeWidth="1"
                      />
                    )}

                    {/* Enhanced hover tooltip */}
                    {isHovered && (
                      <g>
                        <rect
                          x={x - 15}
                          y={y - 50}
                          width={barWidth + 30}
                          height="40"
                          fill="rgba(15, 20, 25, 0.95)"
                          stroke="#374151"
                          rx="6"
                        />
                        <text
                          x={x + barWidth / 2}
                          y={y - 32}
                          textAnchor="middle"
                          fontSize="12"
                          fill="#fff"
                          fontWeight="bold"
                        >
                          {hours.toFixed(1)}h
                        </text>
                        <text
                          x={x + barWidth / 2}
                          y={y - 18}
                          textAnchor="middle"
                          fontSize="10"
                          fill="#9ca3af"
                        >
                          {hours >= targetHours
                            ? "Target Met"
                            : hours >= targetHours * 0.75
                            ? "Close"
                            : "Below Target"}
                        </text>
                      </g>
                    )}

                    {/* Day label with performance indicator */}
                    <text
                      x={x + barWidth / 2}
                      y={padding.top + chartHeight + 25}
                      textAnchor="middle"
                      fontSize="12"
                      fill={isHovered ? "#ffffff" : getPerformanceColor(hours)}
                      fontWeight={isHovered ? "bold" : "normal"}
                    >
                      {data.label}
                    </text>

                    {/* Hours label */}
                    <text
                      x={x + barWidth / 2}
                      y={padding.top + chartHeight + 40}
                      textAnchor="middle"
                      fontSize="10"
                      fill="#6b7280"
                    >
                      {hours.toFixed(1)}h
                    </text>
                  </g>
                );
              })
            ) : (
              <g>
                {/* Line path with gradient */}
                <path
                  d={linePath}
                  stroke="#3b82f6"
                  strokeWidth="3"
                  fill="none"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  filter="url(#glow)"
                />

                {/* Area fill under line */}
                <path
                  d={`${linePath} L ${
                    padding.left +
                    (weeklyHours.length - 1) * (barWidth + barGap) +
                    barWidth / 2
                  },${padding.top + chartHeight} L ${
                    padding.left + barWidth / 2
                  },${padding.top + chartHeight} Z`}
                  fill="url(#barGradient)"
                  opacity="0.3"
                />

                {/* Data points with enhanced interactivity */}
                {weeklyHours.map((data, index) => {
                  const hours = data.hours || 0;
                  const x =
                    padding.left + index * (barWidth + barGap) + barWidth / 2;
                  const y =
                    padding.top +
                    chartHeight -
                    (hours / maxScale) * chartHeight;
                  const isHovered = index === hoveredIndex;
                  const isWeekend = index === 0 || index === 6;

                  return (
                    <g key={`${data.label}-${index}`}>
                      {/* Point glow effect */}
                      {isHovered && (
                        <circle
                          cx={x}
                          cy={y}
                          r="12"
                          fill="#3b82f6"
                          opacity="0.2"
                        />
                      )}

                      {/* Main data point */}
                      <circle
                        cx={x}
                        cy={y}
                        r={isHovered ? "8" : "5"}
                        fill={
                          hours >= targetHours
                            ? "#10b981"
                            : hours >= targetHours * 0.75
                            ? "#f59e0b"
                            : "#ef4444"
                        }
                        stroke="#ffffff"
                        strokeWidth="2"
                        className="cursor-pointer transition-all duration-200"
                        onMouseEnter={() => setHoveredIndex(index)}
                        onMouseLeave={() => setHoveredIndex(null)}
                      />

                      {/* Weekend indicator for line chart */}
                      {isWeekend && (
                        <rect
                          x={x - 2}
                          y={y - 15}
                          width="4"
                          height="6"
                          fill="#6b7280"
                          rx="2"
                          opacity="0.5"
                        />
                      )}

                      {/* Enhanced hover tooltip for line chart */}
                      {isHovered && (
                        <g>
                          <rect
                            x={x - 25}
                            y={y - 50}
                            width="50"
                            height="35"
                            fill="rgba(15, 20, 25, 0.95)"
                            stroke="#374151"
                            rx="4"
                          />
                          <text
                            x={x}
                            y={y - 30}
                            textAnchor="middle"
                            fontSize="12"
                            fill="#fff"
                            fontWeight="bold"
                          >
                            {hours.toFixed(1)}h
                          </text>
                          <text
                            x={x}
                            y={y - 18}
                            textAnchor="middle"
                            fontSize="9"
                            fill="#9ca3af"
                          >
                            {data.label}
                          </text>
                        </g>
                      )}

                      {/* Day label for line chart */}
                      <text
                        x={x}
                        y={padding.top + chartHeight + 25}
                        textAnchor="middle"
                        fontSize="12"
                        fill={
                          isHovered ? "#ffffff" : getPerformanceColor(hours)
                        }
                      >
                        {data.label}
                      </text>

                      {/* Hours label for line chart */}
                      <text
                        x={x}
                        y={padding.top + chartHeight + 40}
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

      {/* Enhanced Legend with performance insights */}
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

      {/* Performance insights and recommendations */}
      {showDetails && (
        <div className="mt-6 pt-4 border-t border-[#232945]">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {/* Weekly insights */}
            <div className="bg-[#232945] rounded-lg p-4">
              <h4 className="text-sm font-semibold text-gray-200 mb-3 flex items-center gap-2">
                <TrendingUp className="w-4 h-4 text-blue-400" />
                Weekly Insights
              </h4>
              <div className="space-y-2 text-xs text-gray-400">
                <div>
                  Week Progress:{" "}
                  <span className="text-blue-400">{metrics.weekProgress}%</span>
                </div>
                <div>
                  Trend:{" "}
                  <span
                    className={
                      metrics.trend === "up"
                        ? "text-green-400"
                        : metrics.trend === "down"
                        ? "text-red-400"
                        : "text-gray-400"
                    }
                  >
                    {metrics.trend === "up"
                      ? "Improving"
                      : metrics.trend === "down"
                      ? "Declining"
                      : "Stable"}
                  </span>
                </div>
                <div>
                  Consistency:{" "}
                  <span className="text-purple-400">
                    {metrics.workingDays} of 5 days active
                  </span>
                </div>
              </div>
            </div>

            {/* Recommendations */}
            <div className="bg-[#232945] rounded-lg p-4">
              <h4 className="text-sm font-semibold text-gray-200 mb-3 flex items-center gap-2">
                <AlertCircle className="w-4 h-4 text-yellow-400" />
                Recommendations
              </h4>
              <div className="space-y-2 text-xs text-gray-400">
                {parseFloat(metrics.efficiency) < 60 && (
                  <div className="text-orange-400">
                    • Focus on reaching daily targets consistently
                  </div>
                )}
                {metrics.workingDays < 4 && (
                  <div className="text-red-400">
                    • Improve attendance to meet weekly goals
                  </div>
                )}
                {parseFloat(metrics.avgDailyHours) > targetHours + 2 && (
                  <div className="text-blue-400">
                    • Consider work-life balance on high-hour days
                  </div>
                )}
                {metrics.streak >= 3 && (
                  <div className="text-green-400">
                    • Great streak! Keep up the consistent performance
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Footer note */}
      <div className="text-xs text-gray-500 mt-4 text-center">
        * Efficiency calculated based on weekdays only (Mon-Fri) • Target:{" "}
        {targetHours}h per day
      </div>
    </div>
  );
};

export default WeeklyHoursChart;
