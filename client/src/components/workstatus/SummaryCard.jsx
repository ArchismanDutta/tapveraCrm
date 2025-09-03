// File: src/components/workstatus/SummaryCard.jsx
import React from "react";

// Helper: parse "Hh Mm" to total minutes
const parseTimeStrToMinutes = (timeStr) => {
  if (!timeStr) return 0;
  const [h, m] = timeStr.split(" ").map((t) => parseInt(t.replace(/[hm]/, ""), 10));
  return (h || 0) * 60 + (m || 0);
};

// Robust time parser: handles ISO, "HH:mm", "HH:mm AM/PM"
const parseArrivalTime = (timeStr) => {
  if (!timeStr) return null;

  // Case 1: ISO string
  const isoDate = new Date(timeStr);
  if (!isNaN(isoDate.getTime())) return isoDate;

  // Case 2: "HH:mm" or "HH:mm AM/PM"
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
      <div className="bg-[#161c2c] border border-[#232945] rounded-2xl shadow-lg p-6 w-full">
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
    quickStats: backendQuickStats,
  } = weeklySummary;

  // -------------------------
  // Recalculate quick stats dynamically if backend not available
  // -------------------------
  let earlyArrivals = 0;
  let lateArrivals = 0;
  let perfectDays = 0;

  if (Array.isArray(dailyData)) {
    dailyData.forEach((day) => {
      if (!day.arrivalTime) return;

      const arrival = parseArrivalTime(day.arrivalTime);
      const expectedStart = day.effectiveShift?.start || day.expectedStartTime || "09:00";
      const expected = parseArrivalTime(expectedStart);

      if (!arrival || !expected) return;

      if (arrival <= expected) earlyArrivals++;
      else lateArrivals++;

      // Work duration in minutes
      let workMins = 0;
      if (day.workDurationSeconds != null) {
        workMins = Math.floor(day.workDurationSeconds / 60);
      } else if (day.workDuration) {
        workMins = parseTimeStrToMinutes(day.workDuration);
      }

      // Perfect day: >= 8h work & arrived before/at shift start
      if (workMins >= 480 && arrival <= expected) {
        perfectDays++;
      }
    });
  }

  const quickStats = backendQuickStats || { earlyArrivals, lateArrivals, perfectDays };

  // Clean onTimeRate formatting (avoid 0%% issue)
  const formattedOnTimeRate =
    typeof onTimeRate === "string"
      ? onTimeRate.replace(/%+$/, "") + "%"
      : onTimeRate != null
      ? `${onTimeRate}%`
      : "0%";

  return (
    <div className="bg-[#161c2c] border border-[#232945] rounded-2xl shadow-lg p-6 w-full space-y-6 transition-all hover:shadow-xl">
      {/* Header */}
      <h3 className="text-lg font-semibold text-gray-100 border-b border-[#232945] pb-2 mb-4">
        Week Summary
      </h3>

      {/* Main Stats Grid */}
      <div className="grid grid-cols-2 sm:grid-cols-3 gap-4">
        <div className="bg-[#232945] p-4 rounded-lg flex flex-col items-center hover:bg-[#2a3050] transition-colors">
          <p className="text-gray-400 text-xs uppercase tracking-wider">Total Hours</p>
          <p className="text-orange-400 text-xl font-bold">{totalWork || "0h 0m"}</p>
        </div>

        <div className="bg-[#232945] p-4 rounded-lg flex flex-col items-center hover:bg-[#2a3050] transition-colors">
          <p className="text-gray-400 text-xs uppercase tracking-wider">Avg. Daily Work</p>
          <p className="text-orange-400 text-xl font-bold">{avgDailyWork || "0h 0m"}</p>
        </div>

        <div className="bg-[#232945] p-4 rounded-lg flex flex-col items-center hover:bg-[#2a3050] transition-colors">
          <p className="text-gray-400 text-xs uppercase tracking-wider">Total Break</p>
          <p className="text-orange-400 text-xl font-bold">{totalBreak || "0h 0m"}</p>
        </div>

        <div className="bg-[#232945] p-4 rounded-lg flex flex-col items-center hover:bg-[#2a3050] transition-colors">
          <p className="text-gray-400 text-xs uppercase tracking-wider">Avg. Daily Break</p>
          <p className="text-orange-400 text-xl font-bold">{avgDailyBreak || "0h 0m"}</p>
        </div>

        <div className="bg-[#232945] p-4 rounded-lg flex flex-col items-center hover:bg-[#2a3050] transition-colors">
          <p className="text-gray-400 text-xs uppercase tracking-wider">On-Time Rate</p>
          <p className="text-orange-400 text-xl font-bold">{formattedOnTimeRate}</p>
        </div>

        <div className="bg-[#232945] p-4 rounded-lg flex flex-col items-center hover:bg-[#2a3050] transition-colors">
          <p className="text-gray-400 text-xs uppercase tracking-wider">Breaks Taken</p>
          <p className="text-orange-400 text-xl font-bold">{breaksTaken ?? 0}</p>
        </div>
      </div>

      {/* Quick Stats Section */}
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
    </div>
  );
};

export default SummaryCard;
