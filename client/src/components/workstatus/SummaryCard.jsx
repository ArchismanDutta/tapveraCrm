import React from "react";

// Helper: parse "Hh Mm" to total minutes
const parseTimeStrToMinutes = (timeStr) => {
  if (!timeStr) return 0;
  const [h, m] = timeStr
    .split(" ")
    .map((t) => parseInt(t.replace(/[hm]/g, ""), 10));
  return (h || 0) * 60 + (m || 0);
};

const parseArrivalTime = (timeStr) => {
  if (!timeStr) return null;
  const isoDate = new Date(timeStr);
  if (!isNaN(isoDate.getTime())) return isoDate;
  const today = new Date();
  const match = timeStr.match(/(\d{1,2}):(\d{2})(?:\s?(AM|PM))?/i);
  if (match) {
    let [_, hh, mm, ampm] = match;
    let hours = parseInt(hh, 10);
    const minutes = parseInt(mm, 10);
    if (ampm) {
      if (ampm.toUpperCase() === "PM" && hours < 12) hours += 12;
      if (ampm.toUpperCase() === "AM" && hours === 12) hours = 0;
    }
    today.setHours(hours, minutes, 0, 0);
    return today;
  }
  return null;
};

const SummaryCard = ({ weeklySummary, dailyData }) => {
  if (!weeklySummary) {
    return (
      <div className="bg-slate-800/50 backdrop-blur-sm border border-slate-700/50 rounded-lg shadow-xl p-3 w-full">
        <div className="flex flex-wrap items-center gap-3">
          <h3 className="text-sm font-bold text-white whitespace-nowrap">
            Week Summary
          </h3>
          <p className="text-gray-300 text-xs">No data available.</p>
        </div>
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
    quickStats: backendQuickStats,
  } = weeklySummary;

  let earlyArrivals = 0;
  let lateArrivals = 0;
  let perfectDays = 0;

  if (Array.isArray(dailyData)) {
    dailyData.forEach((day) => {
      if (!day.arrivalTime) return;
      const arrival = parseArrivalTime(day.arrivalTime);
      const expectedStart =
        day.effectiveShift?.start || day.expectedStartTime || "09:00";
      const expected = parseArrivalTime(expectedStart);
      if (!arrival || !expected) return;
      if (arrival <= expected) earlyArrivals++;
      else lateArrivals++;
      let workMins = 0;
      if (day.workDurationSeconds != null) {
        workMins = Math.floor(day.workDurationSeconds / 60);
      } else if (day.workDuration) {
        workMins = parseTimeStrToMinutes(day.workDuration);
      }
      if (workMins >= 480 && arrival <= expected) {
        perfectDays++;
      }
    });
  }

  const quickStats = {
    earlyArrivals:
      backendQuickStats?.earlyArrivals > 0
        ? backendQuickStats.earlyArrivals
        : earlyArrivals,
    lateArrivals:
      backendQuickStats?.lateArrivals > 0
        ? backendQuickStats.lateArrivals
        : lateArrivals,
    perfectDays:
      backendQuickStats?.perfectDays > 0
        ? backendQuickStats.perfectDays
        : perfectDays,
  };

  const formattedOnTimeRate =
    typeof onTimeRate === "string"
      ? onTimeRate.replace(/%+$/, "") + "%"
      : onTimeRate != null
      ? `${onTimeRate}%`
      : "0%";

  return (
    <div className="bg-slate-800/50 backdrop-blur-sm border border-slate-700/50 rounded-lg shadow-xl p-3 w-full transition-all">
      <div className="flex flex-col sm:flex-row sm:items-center gap-2 sm:gap-4">
        <h3 className="text-sm font-bold text-white whitespace-nowrap">
          Week Summary
        </h3>
        <div className="flex-1 grid grid-cols-3 sm:grid-cols-3 md:grid-cols-6 gap-2">
          <div className="bg-slate-900/60 p-2 rounded border border-slate-700/30 flex flex-col items-center">
            <p className="text-gray-400 text-xs mb-0.5 text-center">Total Hours</p>
            <p className="text-green-400 text-sm font-bold">{totalWork || "0h 0m"}</p>
          </div>
          <div className="bg-slate-900/60 p-2 rounded border border-slate-700/30 flex flex-col items-center">
            <p className="text-gray-400 text-xs mb-0.5 text-center">Avg. Daily</p>
            <p className="text-green-400 text-sm font-bold">{avgDailyWork || "0h 0m"}</p>
          </div>
          <div className="bg-slate-900/60 p-2 rounded border border-slate-700/30 flex flex-col items-center">
            <p className="text-gray-400 text-xs mb-0.5 text-center">Total Break</p>
            <p className="text-orange-400 text-sm font-bold">{totalBreak || "0h 0m"}</p>
          </div>
          <div className="bg-slate-900/60 p-2 rounded border border-slate-700/30 flex flex-col items-center">
            <p className="text-gray-400 text-xs mb-0.5 text-center">Avg. Break</p>
            <p className="text-orange-400 text-sm font-bold">{avgDailyBreak || "0h 0m"}</p>
          </div>
          <div className="bg-slate-900/60 p-2 rounded border border-slate-700/30 flex flex-col items-center">
            <p className="text-gray-400 text-xs mb-0.5 text-center">On-Time</p>
            <p className="text-purple-400 text-sm font-bold">{formattedOnTimeRate}</p>
          </div>
          <div className="bg-slate-900/60 p-2 rounded border border-slate-700/30 flex flex-col items-center">
            <p className="text-gray-400 text-xs mb-0.5 text-center">Breaks</p>
            <p className="text-red-400 text-sm font-bold">{breaksTaken ?? 0}</p>
          </div>
        </div>
      </div>
    </div>
  );
};

export default SummaryCard;
