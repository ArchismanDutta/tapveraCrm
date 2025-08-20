import React from "react";

const SummaryCard = ({ weeklySummary }) => {
  if (!weeklySummary) {
    return (
      <div className="bg-white p-4 rounded-xl shadow-md space-y-4 w-full">
        <h3 className="text-lg font-semibold border-b border-gray-300 pb-2">
          Week Summary
        </h3>
        <p>No weekly data available.</p>
      </div>
    );
  }

  const {
    totalWork,
    avgDailyWork,
    totalBreak,
    avgDailyBreak,
    onTimeRate,
    breaksTaken,
    quickStats,
  } = weeklySummary;

  return (
    <div className="bg-white p-4 rounded-xl shadow-md space-y-4 w-full">
      <h3 className="text-lg font-semibold border-b border-gray-300 pb-2">
        Week Summary
      </h3>
      <div className="grid gap-4 sm:grid-cols-2">
        <div>
          <p className="text-gray-600 uppercase tracking-wider text-xs font-medium">Total Hours</p>
          <p className="text-xl font-bold text-gray-900">{totalWork}</p>
        </div>
        <div>
          <p className="text-gray-600 uppercase tracking-wider text-xs font-medium">Avg. Daily Work</p>
          <p className="text-xl font-bold text-gray-900">{avgDailyWork}</p>
        </div>
        <div>
          <p className="text-gray-600 uppercase tracking-wider text-xs font-medium">Total Break</p>
          <p className="text-xl font-bold text-gray-900">{totalBreak}</p>
        </div>
        <div>
          <p className="text-gray-600 uppercase tracking-wider text-xs font-medium">Avg. Daily Break</p>
          <p className="text-xl font-bold text-gray-900">{avgDailyBreak}</p>
        </div>
        <div>
          <p className="text-gray-600 uppercase tracking-wider text-xs font-medium">On-Time Rate</p>
          <p className="text-xl font-bold text-gray-900">{onTimeRate}</p>
        </div>
        <div>
          <p className="text-gray-600 uppercase tracking-wider text-xs font-medium">Breaks Taken</p>
          <p className="text-xl font-bold text-gray-900">{breaksTaken}</p>
        </div>
      </div>
      {quickStats && (
        <div>
          <h4 className="text-base font-semibold mb-2">Quick Stats</h4>
          <div className="grid grid-cols-3 gap-4 text-gray-700 text-sm font-semibold">
            <div>
              <p className="text-2xl text-purple-600">{quickStats.earlyArrivals}</p>
              <p>Early Arrivals</p>
            </div>
            <div>
              <p className="text-2xl text-yellow-500">{quickStats.lateArrivals}</p>
              <p>Late Arrivals</p>
            </div>
            <div>
              <p className="text-2xl text-green-600">{quickStats.perfectDays}</p>
              <p>Perfect Days</p>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default SummaryCard;
