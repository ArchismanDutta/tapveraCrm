import React, { useState, useEffect, useMemo } from "react";
import {
  ChevronLeft,
  ChevronRight,
  TrendingUp,
  TrendingDown,
  Calendar,
  Info,
  ChevronDown,
  ChevronUp,
  Copy,
  X
} from "lucide-react";

const KeywordCalendarHeatmap = ({ keywords, onDateClick }) => {
  const [isOpen, setIsOpen] = useState(false);
  const [viewMode, setViewMode] = useState("month"); // month, week, quarter
  const [comparisonMode, setComparisonMode] = useState(false);
  const [currentMonth, setCurrentMonth] = useState(new Date());
  const [comparisonMonth, setComparisonMonth] = useState(
    new Date(new Date().setMonth(new Date().getMonth() - 1))
  );
  const [hoveredCell, setHoveredCell] = useState(null);
  const [tooltipPosition, setTooltipPosition] = useState({ x: 0, y: 0 });

  // Calculate heatmap data
  const heatmapData = useMemo(() => {
    const data = {};

    keywords.forEach((keyword) => {
      keyword.rankHistory?.forEach((record, index) => {
        if (index === 0) return;

        const date = new Date(record.recordedAt);
        const dateKey = date.toISOString().split('T')[0];
        const prevRank = keyword.rankHistory[index - 1].rank;
        const currentRank = record.rank;
        const change = prevRank - currentRank;

        if (!data[dateKey]) {
          data[dateKey] = {
            totalChange: 0,
            improvements: 0,
            declines: 0,
            updates: 0,
            keywords: []
          };
        }

        data[dateKey].totalChange += change;
        data[dateKey].updates += 1;

        if (change > 0) data[dateKey].improvements += 1;
        else if (change < 0) data[dateKey].declines += 1;

        data[dateKey].keywords.push({
          keyword: keyword.keyword,
          change,
          rank: currentRank,
          prevRank
        });
      });
    });

    return data;
  }, [keywords]);

  // Get color for cell
  const getCellColor = (dateKey) => {
    const data = heatmapData[dateKey];
    if (!data) return "bg-[#0f1419]";

    const change = data.totalChange;
    if (change === 0) return "bg-gray-700/30";

    if (change > 0) {
      if (change >= 20) return "bg-green-500";
      if (change >= 10) return "bg-green-600";
      if (change >= 5) return "bg-green-700";
      return "bg-green-800/60";
    }

    if (change < 0) {
      const absChange = Math.abs(change);
      if (absChange >= 20) return "bg-red-500";
      if (absChange >= 10) return "bg-red-600";
      if (absChange >= 5) return "bg-red-700";
      return "bg-red-800/60";
    }
  };

  // Generate calendar for month view
  const generateMonthCalendar = (baseDate) => {
    const year = baseDate.getFullYear();
    const month = baseDate.getMonth();
    const firstDay = new Date(year, month, 1);
    const lastDay = new Date(year, month + 1, 0);
    const daysInMonth = lastDay.getDate();
    const startingDayOfWeek = firstDay.getDay();
    const days = [];

    for (let i = 0; i < startingDayOfWeek; i++) {
      days.push(null);
    }

    for (let day = 1; day <= daysInMonth; day++) {
      const date = new Date(year, month, day);
      const dateKey = date.toISOString().split('T')[0];
      days.push({
        day,
        date,
        dateKey,
        data: heatmapData[dateKey]
      });
    }

    return days;
  };

  // Generate calendar for week view
  const generateWeekCalendar = (baseDate) => {
    const days = [];
    const startOfWeek = new Date(baseDate);
    startOfWeek.setDate(baseDate.getDate() - baseDate.getDay());

    for (let i = 0; i < 7; i++) {
      const date = new Date(startOfWeek);
      date.setDate(startOfWeek.getDate() + i);
      const dateKey = date.toISOString().split('T')[0];
      days.push({
        day: date.getDate(),
        date,
        dateKey,
        data: heatmapData[dateKey]
      });
    }

    return days;
  };

  // Generate calendar for quarter view
  const generateQuarterCalendar = (baseDate) => {
    const year = baseDate.getFullYear();
    const quarter = Math.floor(baseDate.getMonth() / 3);
    const startMonth = quarter * 3;
    const days = [];

    for (let monthOffset = 0; monthOffset < 3; monthOffset++) {
      const month = startMonth + monthOffset;
      const firstDay = new Date(year, month, 1);
      const lastDay = new Date(year, month + 1, 0);
      const daysInMonth = lastDay.getDate();

      for (let day = 1; day <= daysInMonth; day++) {
        const date = new Date(year, month, day);
        const dateKey = date.toISOString().split('T')[0];
        days.push({
          day,
          date,
          dateKey,
          data: heatmapData[dateKey],
          month: monthOffset
        });
      }
    }

    return days;
  };

  const weekDays = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
  const monthNames = [
    'January', 'February', 'March', 'April', 'May', 'June',
    'July', 'August', 'September', 'October', 'November', 'December'
  ];

  // Navigation functions
  const navigatePrevious = () => {
    if (viewMode === "month") {
      setCurrentMonth(new Date(currentMonth.getFullYear(), currentMonth.getMonth() - 1));
      if (comparisonMode) {
        setComparisonMonth(new Date(comparisonMonth.getFullYear(), comparisonMonth.getMonth() - 1));
      }
    } else if (viewMode === "week") {
      const newDate = new Date(currentMonth);
      newDate.setDate(newDate.getDate() - 7);
      setCurrentMonth(newDate);
      if (comparisonMode) {
        const newCompDate = new Date(comparisonMonth);
        newCompDate.setDate(newCompDate.getDate() - 7);
        setComparisonMonth(newCompDate);
      }
    } else if (viewMode === "quarter") {
      setCurrentMonth(new Date(currentMonth.getFullYear(), currentMonth.getMonth() - 3));
      if (comparisonMode) {
        setComparisonMonth(new Date(comparisonMonth.getFullYear(), comparisonMonth.getMonth() - 3));
      }
    }
  };

  const navigateNext = () => {
    if (viewMode === "month") {
      setCurrentMonth(new Date(currentMonth.getFullYear(), currentMonth.getMonth() + 1));
      if (comparisonMode) {
        setComparisonMonth(new Date(comparisonMonth.getFullYear(), comparisonMonth.getMonth() + 1));
      }
    } else if (viewMode === "week") {
      const newDate = new Date(currentMonth);
      newDate.setDate(newDate.getDate() + 7);
      setCurrentMonth(newDate);
      if (comparisonMode) {
        const newCompDate = new Date(comparisonMonth);
        newCompDate.setDate(newCompDate.getDate() + 7);
        setComparisonMonth(newCompDate);
      }
    } else if (viewMode === "quarter") {
      setCurrentMonth(new Date(currentMonth.getFullYear(), currentMonth.getMonth() + 3));
      if (comparisonMode) {
        setComparisonMonth(new Date(comparisonMonth.getFullYear(), comparisonMonth.getMonth() + 3));
      }
    }
  };

  const goToToday = () => {
    setCurrentMonth(new Date());
    if (comparisonMode) {
      if (viewMode === "month") {
        setComparisonMonth(new Date(new Date().setMonth(new Date().getMonth() - 1)));
      } else if (viewMode === "week") {
        const lastWeek = new Date();
        lastWeek.setDate(lastWeek.getDate() - 7);
        setComparisonMonth(lastWeek);
      } else if (viewMode === "quarter") {
        setComparisonMonth(new Date(new Date().setMonth(new Date().getMonth() - 3)));
      }
    }
  };

  const handleCellHover = (cellData, event) => {
    if (cellData?.data) {
      setHoveredCell(cellData);
      const rect = event.currentTarget.getBoundingClientRect();
      setTooltipPosition({
        x: rect.left + rect.width / 2,
        y: rect.top - 10
      });
    } else {
      setHoveredCell(null);
    }
  };

  const handleCellClick = (cellData) => {
    if (cellData?.data && onDateClick) {
      onDateClick(cellData.dateKey, cellData.data);
    }
  };

  // Calculate stats for current view
  const calculateStats = (days) => {
    let totalUpdates = 0;
    let totalImprovement = 0;
    let totalDecline = 0;

    days.forEach(day => {
      if (day?.data) {
        totalUpdates += day.data.updates;
        if (day.data.totalChange > 0) totalImprovement += day.data.totalChange;
        if (day.data.totalChange < 0) totalDecline += Math.abs(day.data.totalChange);
      }
    });

    return { totalUpdates, totalImprovement, totalDecline };
  };

  // Render calendar based on view mode
  const renderCalendar = (baseDate, isComparison = false) => {
    let days, title;

    if (viewMode === "month") {
      days = generateMonthCalendar(baseDate);
      title = `${monthNames[baseDate.getMonth()]} ${baseDate.getFullYear()}`;
    } else if (viewMode === "week") {
      days = generateWeekCalendar(baseDate);
      const startDate = days[0].date;
      const endDate = days[6].date;
      title = `Week of ${startDate.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })} - ${endDate.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}`;
    } else if (viewMode === "quarter") {
      days = generateQuarterCalendar(baseDate);
      const quarter = Math.floor(baseDate.getMonth() / 3) + 1;
      title = `Q${quarter} ${baseDate.getFullYear()}`;
    }

    const stats = calculateStats(days);

    return (
      <div className={`${comparisonMode && !isComparison ? 'border-r border-[#232945] pr-4' : ''}`}>
        {/* Title */}
        <div className="text-center mb-4">
          <h4 className="text-lg font-bold text-white">{title}</h4>
          {isComparison && (
            <span className="text-xs text-gray-500">Comparison Period</span>
          )}
        </div>

        {/* Stats */}
        <div className="grid grid-cols-3 gap-2 mb-4">
          <div className="bg-[#141a21] border border-[#232945] rounded-lg p-2 text-center">
            <div className="text-xs text-gray-500">Updates</div>
            <div className="text-lg font-bold text-white">{stats.totalUpdates}</div>
          </div>
          <div className="bg-[#141a21] border border-green-500/30 rounded-lg p-2 text-center">
            <div className="text-xs text-gray-500 flex items-center justify-center gap-1">
              <TrendingUp className="w-3 h-3" />
              Up
            </div>
            <div className="text-lg font-bold text-green-400">+{stats.totalImprovement}</div>
          </div>
          <div className="bg-[#141a21] border border-red-500/30 rounded-lg p-2 text-center">
            <div className="text-xs text-gray-500 flex items-center justify-center gap-1">
              <TrendingDown className="w-3 h-3" />
              Down
            </div>
            <div className="text-lg font-bold text-red-400">-{stats.totalDecline}</div>
          </div>
        </div>

        {/* Calendar Grid */}
        {viewMode === "month" && (
          <div>
            {/* Week headers */}
            <div className="grid grid-cols-7 gap-1 mb-1">
              {weekDays.map(day => (
                <div key={day} className="text-center text-xs font-medium text-gray-500 py-1">
                  {day.charAt(0)}
                </div>
              ))}
            </div>

            {/* Days */}
            <div className="grid grid-cols-7 gap-1">
              {days.map((cellData, index) => {
                if (!cellData) {
                  return <div key={`empty-${index}`} className="aspect-square"></div>;
                }

                const isToday = cellData.dateKey === new Date().toISOString().split('T')[0];
                const isFuture = new Date(cellData.dateKey) > new Date();

                return (
                  <div
                    key={cellData.dateKey}
                    className={`
                      aspect-square rounded-lg border-2 transition-all cursor-pointer
                      ${getCellColor(cellData.dateKey)}
                      ${isToday ? 'border-blue-500' : 'border-transparent'}
                      ${cellData.data ? 'hover:border-purple-500 hover:scale-110' : ''}
                      ${isFuture ? 'opacity-30' : ''}
                      relative flex items-center justify-center text-xs font-medium
                      ${cellData.data ? 'text-white' : 'text-gray-600'}
                    `}
                    onMouseEnter={(e) => handleCellHover(cellData, e)}
                    onMouseLeave={() => setHoveredCell(null)}
                    onClick={() => handleCellClick(cellData)}
                  >
                    {cellData.day}
                    {cellData.data && (
                      <div className="absolute top-0.5 right-0.5 w-1 h-1 rounded-full bg-purple-400"></div>
                    )}
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {viewMode === "week" && (
          <div>
            <div className="grid grid-cols-7 gap-2">
              {days.map((cellData, index) => {
                const isToday = cellData.dateKey === new Date().toISOString().split('T')[0];

                return (
                  <div key={cellData.dateKey} className="text-center">
                    <div className="text-xs text-gray-500 mb-1">{weekDays[index]}</div>
                    <div
                      className={`
                        h-32 rounded-lg border-2 transition-all cursor-pointer
                        ${getCellColor(cellData.dateKey)}
                        ${isToday ? 'border-blue-500' : 'border-transparent'}
                        ${cellData.data ? 'hover:border-purple-500' : ''}
                        p-2 flex flex-col items-center justify-between
                      `}
                      onMouseEnter={(e) => handleCellHover(cellData, e)}
                      onMouseLeave={() => setHoveredCell(null)}
                      onClick={() => handleCellClick(cellData)}
                    >
                      <span className={`text-sm font-bold ${cellData.data ? 'text-white' : 'text-gray-600'}`}>
                        {cellData.day}
                      </span>
                      {cellData.data && (
                        <div className="text-center">
                          <div className="text-xs text-gray-300">{cellData.data.updates} updates</div>
                          <div className={`text-lg font-bold ${
                            cellData.data.totalChange > 0 ? 'text-green-400' :
                            cellData.data.totalChange < 0 ? 'text-red-400' : 'text-gray-400'
                          }`}>
                            {cellData.data.totalChange > 0 ? '+' : ''}{cellData.data.totalChange}
                          </div>
                        </div>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {viewMode === "quarter" && (
          <div className="space-y-4">
            {[0, 1, 2].map(monthOffset => {
              const monthDays = days.filter(d => d.month === monthOffset);
              const monthDate = new Date(baseDate.getFullYear(), Math.floor(baseDate.getMonth() / 3) * 3 + monthOffset, 1);

              return (
                <div key={monthOffset}>
                  <div className="text-sm font-semibold text-gray-300 mb-2">
                    {monthNames[monthDate.getMonth()]}
                  </div>
                  <div className="grid grid-cols-7 gap-1">
                    {/* Empty cells for alignment */}
                    {Array(new Date(monthDate.getFullYear(), monthDate.getMonth(), 1).getDay())
                      .fill(null)
                      .map((_, i) => <div key={`empty-${i}`} className="aspect-square"></div>)}

                    {monthDays.map(cellData => {
                      const isToday = cellData.dateKey === new Date().toISOString().split('T')[0];

                      return (
                        <div
                          key={cellData.dateKey}
                          className={`
                            aspect-square rounded border transition-all cursor-pointer text-xs
                            ${getCellColor(cellData.dateKey)}
                            ${isToday ? 'border-blue-500' : 'border-transparent'}
                            ${cellData.data ? 'hover:border-purple-500' : ''}
                            flex items-center justify-center
                            ${cellData.data ? 'text-white' : 'text-gray-600'}
                          `}
                          onMouseEnter={(e) => handleCellHover(cellData, e)}
                          onMouseLeave={() => setHoveredCell(null)}
                          onClick={() => handleCellClick(cellData)}
                        >
                          {cellData.day}
                        </div>
                      );
                    })}
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    );
  };

  if (!isOpen) {
    return (
      <div className="bg-[#0f1419] border border-[#232945] rounded-lg p-4">
        <button
          onClick={() => setIsOpen(true)}
          className="w-full flex items-center justify-between text-left hover:bg-[#141a21] transition-colors p-2 rounded-lg"
        >
          <div className="flex items-center gap-3">
            <Calendar className="w-5 h-5 text-purple-400" />
            <div>
              <h3 className="text-base font-semibold text-white">Calendar Heatmap</h3>
              <p className="text-sm text-gray-400">Visual timeline of rank changes</p>
            </div>
          </div>
          <ChevronDown className="w-5 h-5 text-gray-400" />
        </button>
      </div>
    );
  }

  return (
    <div className="bg-[#0f1419] border border-[#232945] rounded-lg p-4 sm:p-6 space-y-4">
      {/* Header with close button */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <Calendar className="w-5 h-5 text-purple-400" />
          <div>
            <h3 className="text-lg font-bold text-white">Calendar Heatmap</h3>
            <p className="text-sm text-gray-400">Visual timeline of rank changes</p>
          </div>
        </div>

        <button
          onClick={() => setIsOpen(false)}
          className="p-2 hover:bg-[#141a21] rounded-lg transition-colors"
        >
          <ChevronUp className="w-5 h-5 text-gray-400" />
        </button>
      </div>

      {/* Controls */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 p-4 bg-[#141a21] rounded-lg border border-[#232945]">
        {/* View Mode Selector */}
        <div className="flex items-center gap-2">
          <span className="text-sm text-gray-400">View:</span>
          <div className="flex rounded-lg bg-[#0f1419] border border-[#232945]">
            <button
              onClick={() => setViewMode("week")}
              className={`px-3 py-1.5 text-sm rounded-l-lg transition-colors ${
                viewMode === "week"
                  ? "bg-purple-600 text-white"
                  : "text-gray-400 hover:text-white"
              }`}
            >
              Week
            </button>
            <button
              onClick={() => setViewMode("month")}
              className={`px-3 py-1.5 text-sm transition-colors ${
                viewMode === "month"
                  ? "bg-purple-600 text-white"
                  : "text-gray-400 hover:text-white"
              }`}
            >
              Month
            </button>
            <button
              onClick={() => setViewMode("quarter")}
              className={`px-3 py-1.5 text-sm rounded-r-lg transition-colors ${
                viewMode === "quarter"
                  ? "bg-purple-600 text-white"
                  : "text-gray-400 hover:text-white"
              }`}
            >
              Quarter
            </button>
          </div>
        </div>

        {/* Navigation */}
        <div className="flex items-center gap-2">
          <button
            onClick={navigatePrevious}
            className="p-2 bg-[#0f1419] border border-[#232945] rounded-lg hover:bg-[#1a2130] transition-colors"
          >
            <ChevronLeft className="w-4 h-4 text-gray-400" />
          </button>

          <button
            onClick={goToToday}
            className="px-3 py-2 bg-[#0f1419] border border-[#232945] rounded-lg hover:bg-[#1a2130] transition-colors text-sm text-gray-300"
          >
            Today
          </button>

          <button
            onClick={navigateNext}
            className="p-2 bg-[#0f1419] border border-[#232945] rounded-lg hover:bg-[#1a2130] transition-colors"
          >
            <ChevronRight className="w-4 h-4 text-gray-400" />
          </button>
        </div>

        {/* Comparison Toggle */}
        <button
          onClick={() => setComparisonMode(!comparisonMode)}
          className={`flex items-center gap-2 px-3 py-2 rounded-lg transition-all text-sm ${
            comparisonMode
              ? "bg-blue-600 text-white"
              : "bg-[#0f1419] border border-[#232945] text-gray-300 hover:bg-[#1a2130]"
          }`}
        >
          <Copy className="w-4 h-4" />
          Compare
        </button>
      </div>

      {/* Calendar Display */}
      <div className={`grid ${comparisonMode ? 'md:grid-cols-2' : 'grid-cols-1'} gap-6`}>
        <div>{renderCalendar(currentMonth, false)}</div>
        {comparisonMode && (
          <div>{renderCalendar(comparisonMonth, true)}</div>
        )}
      </div>

      {/* Legend */}
      <div className="pt-4 border-t border-[#232945]">
        <div className="flex items-center justify-between flex-wrap gap-4">
          <div className="flex items-center gap-2 text-xs text-gray-400">
            <Info className="w-4 h-4" />
            <span>Hover for details • Click to view keywords</span>
          </div>

          <div className="flex items-center gap-4">
            <div className="flex items-center gap-2">
              <div className="flex items-center gap-1">
                <div className="w-3 h-3 bg-green-500 rounded"></div>
                <div className="w-3 h-3 bg-green-700 rounded"></div>
                <div className="w-3 h-3 bg-green-800/60 rounded"></div>
              </div>
              <span className="text-xs text-gray-500">Improvements</span>
            </div>

            <div className="flex items-center gap-2">
              <div className="flex items-center gap-1">
                <div className="w-3 h-3 bg-red-500 rounded"></div>
                <div className="w-3 h-3 bg-red-700 rounded"></div>
                <div className="w-3 h-3 bg-red-800/60 rounded"></div>
              </div>
              <span className="text-xs text-gray-500">Declines</span>
            </div>
          </div>
        </div>
      </div>

      {/* Tooltip */}
      {hoveredCell && hoveredCell.data && (
        <div
          className="fixed z-50 pointer-events-none"
          style={{
            left: `${tooltipPosition.x}px`,
            top: `${tooltipPosition.y}px`,
            transform: 'translate(-50%, -100%)'
          }}
        >
          <div className="bg-[#1a2130] border border-[#232945] rounded-lg shadow-2xl p-4 min-w-[250px]">
            <div className="text-sm font-semibold text-white mb-2">
              {new Date(hoveredCell.dateKey).toLocaleDateString('en-US', {
                weekday: 'long',
                year: 'numeric',
                month: 'long',
                day: 'numeric'
              })}
            </div>

            <div className="space-y-2">
              <div className="flex items-center justify-between text-xs">
                <span className="text-gray-400">Updates:</span>
                <span className="text-white font-medium">{hoveredCell.data.updates}</span>
              </div>

              <div className="flex items-center justify-between text-xs">
                <span className="text-gray-400">Total Change:</span>
                <span className={`font-bold ${
                  hoveredCell.data.totalChange > 0 ? 'text-green-400' :
                  hoveredCell.data.totalChange < 0 ? 'text-red-400' : 'text-gray-400'
                }`}>
                  {hoveredCell.data.totalChange > 0 ? '+' : ''}
                  {hoveredCell.data.totalChange}
                </span>
              </div>

              <div className="flex items-center justify-between text-xs">
                <span className="text-gray-400 flex items-center gap-1">
                  <TrendingUp className="w-3 h-3" />
                  Improved:
                </span>
                <span className="text-green-400 font-medium">{hoveredCell.data.improvements}</span>
              </div>

              <div className="flex items-center justify-between text-xs">
                <span className="text-gray-400 flex items-center gap-1">
                  <TrendingDown className="w-3 h-3" />
                  Declined:
                </span>
                <span className="text-red-400 font-medium">{hoveredCell.data.declines}</span>
              </div>
            </div>

            {hoveredCell.data.keywords.length > 0 && (
              <>
                <div className="border-t border-[#232945] my-2"></div>
                <div className="text-xs text-gray-400 mb-1">Keywords updated:</div>
                <div className="max-h-32 overflow-y-auto space-y-1">
                  {hoveredCell.data.keywords.slice(0, 5).map((kw, idx) => (
                    <div key={idx} className="text-xs flex items-center justify-between bg-[#0f1419] p-1.5 rounded">
                      <span className="text-gray-300 truncate">{kw.keyword}</span>
                      <span className={`font-medium ml-2 ${
                        kw.change > 0 ? 'text-green-400' :
                        kw.change < 0 ? 'text-red-400' : 'text-gray-400'
                      }`}>
                        {kw.prevRank}→{kw.rank}
                      </span>
                    </div>
                  ))}
                  {hoveredCell.data.keywords.length > 5 && (
                    <div className="text-xs text-gray-500 italic">
                      +{hoveredCell.data.keywords.length - 5} more...
                    </div>
                  )}
                </div>
              </>
            )}
          </div>
        </div>
      )}
    </div>
  );
};

export default KeywordCalendarHeatmap;
