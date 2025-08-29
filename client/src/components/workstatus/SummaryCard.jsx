import React from "react";

const SummaryCard = ({ weeklySummary }) => {
  if (!weeklySummary) {
    return (
      <div className="bg-[#161c2c] border border-[#232945] rounded-xl shadow-lg p-6 w-full">
        <h3 className="text-lg font-semibold text-gray-100 border-b border-[#232945] pb-2 mb-3">
          Week Summary
        </h3>
        <p className="text-gray-400">No weekly data available.</p>
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
    <div className="bg-[#161c2c] border border-[#232945] rounded-xl shadow-lg p-6 w-full space-y-6 transition-all hover:shadow-xl">
      {/* Header */}
      <h3 className="text-lg font-semibold text-gray-100 border-b border-[#232945] pb-2 mb-4">
        Week Summary
      </h3>

      {/* Main Stats Grid */}
      <div className="grid grid-cols-2 sm:grid-cols-3 gap-4">
        <div className="bg-[#232945] p-4 rounded-lg flex flex-col items-center justify-center hover:bg-[#2a3050] transition-colors">
          <p className="text-gray-400 text-xs uppercase tracking-wider">Total Hours</p>
          <p className="text-orange-400 text-xl font-bold">{totalWork}</p>
        </div>

        <div className="bg-[#232945] p-4 rounded-lg flex flex-col items-center justify-center hover:bg-[#2a3050] transition-colors">
          <p className="text-gray-400 text-xs uppercase tracking-wider">Avg. Daily Work</p>
          <p className="text-orange-400 text-xl font-bold">{avgDailyWork}</p>
        </div>

        <div className="bg-[#232945] p-4 rounded-lg flex flex-col items-center justify-center hover:bg-[#2a3050] transition-colors">
          <p className="text-gray-400 text-xs uppercase tracking-wider">Total Break</p>
          <p className="text-orange-400 text-xl font-bold">{totalBreak}</p>
        </div>

        <div className="bg-[#232945] p-4 rounded-lg flex flex-col items-center justify-center hover:bg-[#2a3050] transition-colors">
          <p className="text-gray-400 text-xs uppercase tracking-wider">Avg. Daily Break</p>
          <p className="text-orange-400 text-xl font-bold">{avgDailyBreak}</p>
        </div>

        <div className="bg-[#232945] p-4 rounded-lg flex flex-col items-center justify-center hover:bg-[#2a3050] transition-colors">
          <p className="text-gray-400 text-xs uppercase tracking-wider">On-Time Rate</p>
          <p className="text-orange-400 text-xl font-bold">{onTimeRate}</p>
        </div>

        <div className="bg-[#232945] p-4 rounded-lg flex flex-col items-center justify-center hover:bg-[#2a3050] transition-colors">
          <p className="text-gray-400 text-xs uppercase tracking-wider">Breaks Taken</p>
          <p className="text-orange-400 text-xl font-bold">{breaksTaken}</p>
        </div>
      </div>

      {/* Quick Stats Section */}
      {quickStats && (
        <div className="mt-4">
          <h4 className="text-gray-200 font-semibold mb-2">Quick Stats</h4>
          <div className="grid grid-cols-3 gap-4 text-sm font-semibold text-gray-300">
            <div className="bg-[#232945] p-3 rounded-lg flex flex-col items-center gap-1 hover:bg-[#2a3050] transition-colors">
              <p className="text-purple-400 text-2xl font-bold">{quickStats.earlyArrivals}</p>
              <span className="text-gray-400 text-xs">Early Arrivals</span>
            </div>
            <div className="bg-[#232945] p-3 rounded-lg flex flex-col items-center gap-1 hover:bg-[#2a3050] transition-colors">
              <p className="text-yellow-400 text-2xl font-bold">{quickStats.lateArrivals}</p>
              <span className="text-gray-400 text-xs">Late Arrivals</span>
            </div>
            <div className="bg-[#232945] p-3 rounded-lg flex flex-col items-center gap-1 hover:bg-[#2a3050] transition-colors">
              <p className="text-green-400 text-2xl font-bold">{quickStats.perfectDays}</p>
              <span className="text-gray-400 text-xs">Perfect Days</span>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default SummaryCard;
