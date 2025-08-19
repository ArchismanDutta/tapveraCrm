import React from "react";

const SummaryCard = ({ summary }) => {
  if (!summary) return null;

  return (
    <div className="bg-white p-6 rounded-xl shadow-md space-y-6">
      <h3 className="text-xl font-semibold border-b border-gray-300 pb-2">Week Summary</h3>
      <div className="grid gap-6 sm:grid-cols-2">
        <div>
          <p className="text-gray-600 uppercase tracking-wider text-xs font-medium">Total Hours</p>
          <p className="text-2xl font-bold text-gray-900">{summary.totalHours}</p>
        </div>
        <div>
          <p className="text-gray-600 uppercase tracking-wider text-xs font-medium">Avg. Daily</p>
          <p className="text-2xl font-bold text-gray-900">{summary.avgDaily}</p>
        </div>
        <div>
          <p className="text-gray-600 uppercase tracking-wider text-xs font-medium">On-Time Rate</p>
          <p className="text-2xl font-bold text-gray-900">{summary.onTimeRate}</p>
        </div>
        <div>
          <p className="text-gray-600 uppercase tracking-wider text-xs font-medium">Breaks Taken</p>
          <p className="text-2xl font-bold text-gray-900">{summary.breaksTaken}</p>
        </div>
      </div>

      {summary.quickStats && (
        <div>
          <h4 className="text-lg font-semibold mb-3">Quick Stats</h4>
          <div className="grid grid-cols-3 gap-6 text-gray-700 text-sm font-semibold">
            <div>
              <p className="text-3xl text-purple-600">{summary.quickStats.earlyArrivals}</p>
              <p>Early Arrivals</p>
            </div>
            <div>
              <p className="text-3xl text-yellow-500">{summary.quickStats.lateArrivals}</p>
              <p>Late Arrivals</p>
            </div>
            <div>
              <p className="text-3xl text-green-600">{summary.quickStats.perfectDays}</p>
              <p>Perfect Days</p>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default SummaryCard;
