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
  Filter,
  CalendarDays
} from "lucide-react";

const WeeklyHoursChart = ({ weeklyHours = [], targetHours = 8, showTarget = true, onDateFilterChange }) => {
  const [hoveredIndex, setHoveredIndex] = useState(null);
  const [chartType, setChartType] = useState("bar");
  const [showDetails, setShowDetails] = useState(false);
  const [dateFilter, setDateFilter] = useState('week');
  const [showFilters, setShowFilters] = useState(false);

  // Handle date filter change
  const handleFilterChange = (filter) => {
    setDateFilter(filter);
    if (onDateFilterChange) {
      onDateFilterChange(filter);
    }
  };

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
        period: dateFilter === 'day' ? 'Today' :
                dateFilter === 'week' ? 'This week' :
                dateFilter === 'month' ? 'This month' : 'This week'
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

    // Number of weekdays in provided data (fallback to 5 if empty)
    const totalWeekdays = weekdayData.length || 5;

    const workingDaysWithHours = weekdayData.filter(d => (d.hours || 0) > 0).length;
    const targetMetDays = weekdayData.filter(d => (d.hours || 0) >= targetHours).length;

    // Efficiency: percentage of working days where target was met
    const efficiency = workingDaysWithHours > 0 ?
      Math.round((targetMetDays / workingDaysWithHours) * 100) : 0;

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
    const firstHalf = weekdayData.slice(0, 2).reduce((sum, d) => sum + (d.hours || 0), 0);
    const secondHalf = weekdayData.slice(2).reduce((sum, d) => sum + (d.hours || 0), 0);
    const trend = secondHalf > firstHalf ? "up" : secondHalf < firstHalf ? "down" : "neutral";

    // Average daily hours for ALL weekdays (including zero-hour days)
    const avgDailyHours = totalWeekdays > 0 ?
      (totalHours / totalWeekdays).toFixed(1) : "0.0";

    // Week progress (how much of ideal week is completed)
    const idealWeekHours = totalWeekdays * targetHours;
    const weekProgress = idealWeekHours > 0 ? Math.min((totalHours / idealWeekHours) * 100, 100) : 0;

    return {
      totalHours: totalHours.toFixed(1),
      workingDays: workingDaysWithHours,
      targetMet: targetMetDays,
      efficiency: efficiency.toString(),
      streak,
      trend,
      avgDailyHours,
      weekProgress: Math.round(weekProgress),
      period: dateFilter === 'day' ? 'Today' :
              dateFilter === 'week' ? 'This week' :
              dateFilter === 'month' ? 'This month' : 'This week'
    };
  }, [weeklyHours, targetHours, dateFilter]);

  // Chart dimensions and scales - responsive design
  const chartHeight = 280;
  const barWidth = 35;
  const barGap = 15;
  const padding = { top: 40, right: 40, bottom: 110, left: 60 };
  const svgWidth = Math.max(weeklyHours.length * (barWidth + barGap) + padding.left + padding.right, 400);
  const svgHeight = chartHeight + padding.top + padding.bottom;
  const maxScale = Math.max(...weeklyHours.map(d => d.hours || 0), targetHours, 8) + 2;

  const getBarColor = (hours, index, isHovered) => {
    if (isHovered) return "#06b6d4";
    if (!hours || hours === 0) return "#475569"; // Slate for no work
    if (hours >= targetHours) return "#10b981"; // Green for target met
    if (hours >= targetHours * 0.75) return "#f59e0b"; // Amber for close to target
    return "#ef4444"; // Red for below target
  };

  const getPerformanceColor = (hours) => {
    if (!hours || hours === 0) return "text-slate-500";
    if (hours >= targetHours) return "text-green-400";
    if (hours >= targetHours * 0.75) return "text-yellow-400";
    return "text-red-400";
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
      <div className="bg-gradient-to-br from-slate-800/50 to-slate-900/50 backdrop-blur-sm border border-slate-600/30 rounded-2xl p-6 w-full">
        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4 mb-6">
          <div className="flex items-center gap-3">
            <BarChart3 className="w-6 h-6 text-cyan-400" />
            <h3 className="text-xl font-semibold text-white">Weekly Hours Chart</h3>
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

        <div className="text-center py-12">
          <Calendar className="w-16 h-16 text-gray-600 mx-auto mb-4" />
          <p className="text-gray-400 text-lg mb-2">No data available</p>
          <p className="text-gray-500 text-sm">Weekly hours will appear here once you start tracking time.</p>
        </div>
      </div>
    );
  }

  return (
    <div className="bg-gradient-to-br from-slate-800/50 to-slate-900/50 backdrop-blur-sm border border-slate-600/30 rounded-2xl p-6 w-full">
      {/* Header with enhanced controls */}
      <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4 mb-6">
        <div className="flex flex-wrap items-center gap-2">
          <BarChart3 className="w-6 h-6 text-cyan-400" />
          <h3 className="text-xl font-semibold text-white">Weekly Hours Chart</h3>
          <div className="flex flex-wrap items-center gap-1 ml-2">
            {metrics.trend === "up" && <TrendingUp className="w-4 h-4 text-green-400" />}
            {metrics.trend === "down" && <TrendingUp className="w-4 h-4 text-red-400 transform rotate-180" />}
            {metrics.streak > 0 && (
              <div className="flex items-center gap-1 text-xs bg-green-900/30 text-green-400 px-2 py-1 rounded whitespace-nowrap">
                <Award className="w-3 h-3" />
                {metrics.streak} day streak
              </div>
            )}
          </div>
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
          <button
            onClick={() => setShowDetails(!showDetails)}
            className={`p-2 rounded-lg transition-all duration-200 ${
              showDetails
                ? "bg-cyan-600 text-white"
                : "bg-slate-700/50 hover:bg-slate-600/50 text-gray-400"
            }`}
            title="Toggle Details"
          >
            <Activity className="w-4 h-4" />
          </button>
          <button
            onClick={() => setChartType("bar")}
            className={`p-2 rounded-lg transition-all duration-200 ${
              chartType === "bar"
                ? "bg-cyan-600 text-white"
                : "bg-slate-700/50 hover:bg-slate-600/50 text-gray-400"
            }`}
            title="Bar Chart"
          >
            <BarChart3 className="w-4 h-4" />
          </button>
          <button
            onClick={() => setChartType("line")}
            className={`p-2 rounded-lg transition-all duration-200 ${
              chartType === "line"
                ? "bg-cyan-600 text-white"
                : "bg-slate-700/50 hover:bg-slate-600/50 text-gray-400"
            }`}
            title="Line Chart"
          >
            <TrendingUp className="w-4 h-4" />
          </button>
        </div>
      </div>

      {/* Filter Options */}
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

      {/* Enhanced Metrics Grid with responsive auto-fit */}
      <div
        className={`grid gap-4 mb-6 transition-all duration-300`}
        style={{
          gridTemplateColumns: showDetails
            ? "repeat(auto-fit,minmax(180px,1fr))"
            : "repeat(auto-fit,minmax(180px,1fr))",
        }}
      >
        <div className="bg-gradient-to-br from-blue-600/20 to-blue-800/20 backdrop-blur-sm border border-blue-500/20 rounded-xl p-4 hover:border-blue-400/40 transition-all duration-300 group">
          <div className="flex items-center gap-2 mb-1">
            <Clock className="w-4 h-4 text-blue-400 group-hover:scale-110 transition-transform duration-200" />
            <span className="text-xs text-gray-400">Total Hours</span>
          </div>
          <div className="flex items-center gap-1.5">
            <span className="text-base font-bold text-blue-400">{metrics.totalHours}h</span>
            <div className="text-xs text-blue-300">
              of {(targetHours * 5).toFixed(0)}h
            </div>
          </div>
          <div className="space-y-1">
            <p className="text-xs text-blue-300">{metrics.period}</p>
            <div className="w-full bg-gray-700 rounded-full h-1.5">
              <div
                className="h-1.5 bg-blue-500 rounded-full transition-all duration-300"
                style={{ width: `${metrics.weekProgress}%` }}
              ></div>
            </div>
          </div>
        </div>

        <div className="bg-gradient-to-br from-green-600/20 to-green-800/20 backdrop-blur-sm border border-green-500/20 rounded-xl p-4 hover:border-green-400/40 transition-all duration-300 group">
          <div className="flex items-center gap-2 mb-1">
            <Target className="w-4 h-4 text-green-400 group-hover:scale-110 transition-transform duration-200" />
            <span className="text-xs text-gray-400">Target Met</span>
          </div>
          <div className="flex items-center gap-1.5">
            <span className="text-base font-bold text-green-400">
              {metrics.targetMet}/{metrics.workingDays}
            </span>
            <div className="text-xs text-green-300">days</div>
          </div>
        </div>

        <div className="bg-gradient-to-br from-purple-600/20 to-purple-800/20 backdrop-blur-sm border border-purple-500/20 rounded-xl p-4 hover:border-purple-400/40 transition-all duration-300 group">
          <div className="flex items-center gap-2 mb-1">
            <TrendingUp className="w-4 h-4 text-purple-400 group-hover:scale-110 transition-transform duration-200" />
            <span className="text-xs text-gray-400">Efficiency</span>
          </div>
          <div className="flex items-center gap-1.5">
            <span className="text-base font-bold text-purple-400">{metrics.efficiency}%</span>
            <div className="text-xs text-purple-300">rate</div>
          </div>
        </div>

        {showDetails && (
          <div className="bg-gradient-to-br from-cyan-600/20 to-cyan-800/20 backdrop-blur-sm border border-cyan-500/20 rounded-xl p-4 hover:border-cyan-400/40 transition-all duration-300 group">
            <div className="flex items-center gap-2 mb-1">
              <Activity className="w-4 h-4 text-cyan-400 group-hover:scale-110 transition-transform duration-200" />
              <span className="text-xs text-gray-400">Daily Avg</span>
            </div>
            <div className="flex items-center gap-1.5">
              <span className="text-base font-bold text-cyan-400">{metrics.avgDailyHours}h</span>
              <div className="text-xs text-cyan-300">per day</div>
            </div>
          </div>
        )}
      </div>

      {/* Chart */}
      <div className="relative bg-slate-700/20 rounded-xl p-4 border border-slate-600/20 overflow-x-auto max-w-full">
        <div className="min-w-[600px] w-full max-w-full">
          <svg
            viewBox={`0 0 ${svgWidth} ${svgHeight}`}
            preserveAspectRatio="xMidYMid meet"
            className="w-full h-auto min-h-[320px] max-w-full"
            style={{ minWidth: `${svgWidth}px` }}
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
              <linearGradient id="barGradient" x1="0%" y1="0%" x2="0%" y2="100%">
                <stop offset="0%" stopColor="rgba(6, 182, 212, 0.8)" />
                <stop offset="100%" stopColor="rgba(6, 182, 212, 0.4)" />
              </linearGradient>
              <linearGradient id="targetGradient" x1="0%" y1="0%" x2="100%" y2="0%">
                <stop offset="0%" stopColor="rgba(245, 158, 11, 0.2)" />
                <stop offset="50%" stopColor="rgba(245, 158, 11, 0.8)" />
                <stop offset="100%" stopColor="rgba(245, 158, 11, 0.2)" />
              </linearGradient>
            </defs>

            {/* Background grid */}
            {yAxisLabels.map((label) => {
              const y = padding.top + chartHeight - (label / maxScale) * chartHeight;
              return (
                <g key={label}>
                  <line
                    x1={padding.left}
                    y1={y}
                    x2={svgWidth - padding.right}
                    y2={y}
                    stroke="#475569"
                    strokeDasharray="2,2"
                    opacity="0.3"
                  />
                  <text
                    x={padding.left - 15}
                    y={y + 3}
                    textAnchor="end"
                    fontSize="10"
                    fill="#64748b"
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
                  y1={padding.top + chartHeight - (targetHours / maxScale) * chartHeight}
                  x2={svgWidth - padding.right}
                  y2={padding.top + chartHeight - (targetHours / maxScale) * chartHeight}
                  stroke="url(#targetGradient)"
                  strokeDasharray="8,4"
                  strokeWidth="3"
                  opacity="0.8"
                />
                <text
                  x={svgWidth - padding.right - 10}
                  y={padding.top + chartHeight - (targetHours / maxScale) * chartHeight - 5}
                  textAnchor="end"
                  fontSize="10"
                  fill="#f59e0b"
                  fontWeight="bold"
                >
                  Target: {targetHours}h
                </text>

                {/* Target zone indicator */}
                <rect
                  x={padding.left}
                  y={padding.top + chartHeight - (targetHours / maxScale) * chartHeight - 2}
                  width={svgWidth - padding.left - padding.right}
                  height="4"
                  fill="rgba(245, 158, 11, 0.2)"
                  rx="2"
                />
              </g>
            )}

            {/* Chart content based on type */}
            {chartType === "bar"
              ? weeklyHours.map((data, index) => {
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
                          transformOrigin: `${x + barWidth/2}px ${y + barHeight}px`
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
                          fill="#64748b"
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
                            fill="rgba(30, 41, 59, 0.95)"
                            stroke="#475569"
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
                            fill="#94a3b8"
                          >
                            {hours >= targetHours ? "Target Met" :
                             hours >= targetHours * 0.75 ? "Close" : "Below Target"}
                          </text>
                        </g>
                      )}

                      {/* Day label with performance indicator */}
                      <text
                        x={x + barWidth / 2}
                        y={padding.top + chartHeight + 20}
                        textAnchor="middle"
                        fontSize="11"
                        fill={isHovered ? "#ffffff" : getPerformanceColor(hours)}
                        fontWeight={isHovered ? "bold" : "normal"}
                      >
                        {data.label}
                      </text>

                      {/* Hours label */}
                      <text
                        x={x + barWidth / 2}
                        y={padding.top + chartHeight + 35}
                        textAnchor="middle"
                        fontSize="9"
                        fill="#64748b"
                      >
                        {hours.toFixed(1)}h
                      </text>
                    </g>
                  );
                })
              : (
                <g>
                  {/* Line path with gradient */}
                  <path
                    d={linePath}
                    stroke="#06b6d4"
                    strokeWidth="3"
                    fill="none"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    filter="url(#glow)"
                  />

                  {/* Area fill under line */}
                  <path
                    d={`${linePath} L ${padding.left + (weeklyHours.length - 1) * (barWidth + barGap) + barWidth / 2},${padding.top + chartHeight} L ${padding.left + barWidth / 2},${padding.top + chartHeight} Z`}
                    fill="url(#barGradient)"
                    opacity="0.3"
                  />

                  {/* Data points with enhanced interactivity */}
                  {weeklyHours.map((data, index) => {
                    const hours = data.hours || 0;
                    const x = padding.left + index * (barWidth + barGap) + barWidth / 2;
                    const y = padding.top + chartHeight - (hours / maxScale) * chartHeight;
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
                            fill="#06b6d4"
                            opacity="0.2"
                          />
                        )}

                        {/* Main data point */}
                        <circle
                          cx={x}
                          cy={y}
                          r={isHovered ? "8" : "5"}
                          fill={hours >= targetHours ? "#10b981" : hours >= targetHours * 0.75 ? "#f59e0b" : "#ef4444"}
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
                            fill="#64748b"
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
                              fill="rgba(30, 41, 59, 0.95)"
                              stroke="#475569"
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
                              fill="#94a3b8"
                            >
                              {data.label}
                            </text>
                          </g>
                        )}

                        {/* Day label for line chart */}
                        <text
                          x={x}
                          y={padding.top + chartHeight + 20}
                          textAnchor="middle"
                          fontSize="11"
                          fill={isHovered ? "#ffffff" : getPerformanceColor(hours)}
                        >
                          {data.label}
                        </text>

                        {/* Hours label for line chart */}
                        <text
                          x={x}
                          y={padding.top + chartHeight + 35}
                          textAnchor="middle"
                          fontSize="9"
                          fill="#64748b"
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
          <div className="w-3 h-3 rounded-full bg-slate-600" />
          <span>No Work</span>
        </div>
      </div>

      {/* Performance insights and recommendations */}
      {showDetails && (
        <div className="mt-6 pt-4 border-t border-slate-600/30">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {/* Weekly insights */}
            <div className="bg-slate-700/30 rounded-xl p-4 border border-slate-600/30">
              <h4 className="text-sm font-semibold text-gray-200 mb-3 flex items-center gap-2">
                <TrendingUp className="w-4 h-4 text-cyan-400" />
                Weekly Insights
              </h4>
              <div className="space-y-2 text-xs text-gray-400">
                <div>Week Progress: <span className="text-cyan-400">{metrics.weekProgress}%</span></div>
                <div>Period: <span className="text-blue-400">{metrics.period}</span></div>
                <div>Trend: <span className={
                  metrics.trend === 'up' ? 'text-green-400' :
                  metrics.trend === 'down' ? 'text-red-400' : 'text-gray-400'
                }>
                  {metrics.trend === 'up' ? 'Improving' :
                   metrics.trend === 'down' ? 'Declining' : 'Stable'}
                </span></div>
                <div>Consistency: <span className="text-purple-400">
                  {metrics.workingDays} of 5 days active
                </span></div>
              </div>
            </div>

            {/* Recommendations */}
            <div className="bg-slate-700/30 rounded-xl p-4 border border-slate-600/30">
              <h4 className="text-sm font-semibold text-gray-200 mb-3 flex items-center gap-2">
                <AlertCircle className="w-4 h-4 text-yellow-400" />
                Recommendations
              </h4>
              <div className="space-y-2 text-xs text-gray-400">
                {parseFloat(metrics.efficiency) < 60 && (
                  <div className="text-orange-400">• Focus on reaching daily targets consistently</div>
                )}
                {metrics.workingDays < 4 && (
                  <div className="text-red-400">• Improve attendance to meet weekly goals</div>
                )}
                {parseFloat(metrics.avgDailyHours) > targetHours + 2 && (
                  <div className="text-blue-400">• Consider work-life balance on high-hour days</div>
                )}
                {metrics.streak >= 3 && (
                  <div className="text-green-400">• Great streak! Keep up the consistent performance</div>
                )}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Footer note */}
      <div className="text-xs text-gray-500 mt-4 text-center">
        * Efficiency calculated based on weekdays only (Mon-Fri) • Target: {targetHours}h per day • {metrics.period}
      </div>
    </div>
  );
};

export default WeeklyHoursChart;