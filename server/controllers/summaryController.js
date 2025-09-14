// controllers/summaryController.js
const DailyWork = require("../models/DailyWork");
const { getEffectiveShift } = require("./statusController");

// ======================
// Helper: Convert seconds to "Hh Mm" format
// ======================
function secToHM(sec) {
  const h = Math.floor(sec / 3600);
  const m = Math.floor((sec % 3600) / 60);
  return `${h}h ${m.toString().padStart(2, "0")}m`;
}

// ======================
// GET /api/summary/week
// ======================
exports.getWeeklySummary = async (req, res) => {
  try {
    const userId = req.user?._id;
    if (!userId) return res.status(401).json({ message: "Unauthorized" });

    let { startDate, endDate } = req.query;

    // Default: current week (Mon → Sun)
    if (!startDate || !endDate) {
      const now = new Date();
      const day = now.getDay(); // Sunday = 0
      const diffToMonday = (day + 6) % 7;

      startDate = new Date(now);
      startDate.setDate(now.getDate() - diffToMonday);
      startDate.setHours(0, 0, 0, 0);

      endDate = new Date(startDate);
      endDate.setDate(startDate.getDate() + 6);
      endDate.setHours(23, 59, 59, 999);
    } else {
      startDate = new Date(startDate);
      startDate.setHours(0, 0, 0, 0);
      endDate = new Date(endDate);
      endDate.setHours(23, 59, 59, 999);
    }

    // Fetch daily work data
    const rawDailyData = await DailyWork.find({
      userId,
      date: { $gte: startDate, $lte: endDate },
    }).sort({ date: 1 });

    const daysCount = rawDailyData.length || 1;

    let totalWorkSeconds = 0;
    let totalBreakSeconds = 0;
    let earlyArrivals = 0;
    let lateArrivals = 0;
    let perfectDays = 0;
    let onTimeCount = 0;
    let breaksTaken = 0;
    let halfDays = 0;
    let absentDays = 0;

    const MIN_HALF_DAY_SECONDS = 5 * 3600; // 5 hours
    const MIN_FULL_DAY_SECONDS = 8 * 3600; // 8 hours

    const dailyData = [];

    for (const day of rawDailyData) {
      const effectiveShift = await getEffectiveShift(userId, day.date);

      // Skip days where no shift is assigned
      if (!effectiveShift) {
        continue;
      }

      const workSeconds = day.workDurationSeconds || 0;
      const breakSeconds = day.breakDurationSeconds || 0;

      totalWorkSeconds += workSeconds;
      totalBreakSeconds += breakSeconds;

      let isEarly = false;
      let isLate = false;
      let isHalfDay = false;
      let isAbsent = false;

      // Absent / Half Day logic
      if (!day.arrivalTime || workSeconds < MIN_HALF_DAY_SECONDS) {
        isAbsent = true;
        absentDays++;
      } else if (workSeconds >= MIN_HALF_DAY_SECONDS && workSeconds < MIN_FULL_DAY_SECONDS) {
        isHalfDay = true;
        halfDays++;
      }

      // Punctuality & perfect day
      if (!isAbsent) {
        if (effectiveShift.isFlexible) {
          if (workSeconds >= MIN_FULL_DAY_SECONDS) {
            perfectDays++;
            onTimeCount++;
          }
        } else if (day.arrivalTime && effectiveShift?.start) {
          const arrival = new Date(day.arrivalTime);
          const [shiftH, shiftM] = effectiveShift.start.split(":").map(Number);
          const expectedShift = new Date(day.date);
          expectedShift.setHours(shiftH, shiftM, 0, 0);

          if (arrival <= expectedShift) {
            isEarly = true;
            earlyArrivals++;
            if (!isHalfDay) onTimeCount++;
          } else {
            isLate = true;
            lateArrivals++;
          }

          if (!isHalfDay && workSeconds >= MIN_FULL_DAY_SECONDS && arrival <= expectedShift) {
            perfectDays++;
          }
        }
      }

      if (Array.isArray(day.breakSessions)) breaksTaken += day.breakSessions.length;

      dailyData.push({
        ...day.toObject(),
        effectiveShift,
        isEarly,
        isLate,
        isHalfDay,
        isAbsent,
      });
    }

    const onTimeRate = dailyData.length
      ? `${Math.round((onTimeCount / dailyData.length) * 100)}%`
      : "0%";

    const avgDailyWork = Math.floor(totalWorkSeconds / daysCount);
    const avgDailyBreak = Math.floor(totalBreakSeconds / daysCount);

    const weeklySummary = {
      totalWork: secToHM(totalWorkSeconds),
      totalBreak: secToHM(totalBreakSeconds),
      avgDailyWork: secToHM(avgDailyWork),
      avgDailyBreak: secToHM(avgDailyBreak),
      daysCount,
      onTimeRate,
      breaksTaken,
      halfDays,
      absentDays,
      quickStats: {
        earlyArrivals,
        lateArrivals,
        perfectDays,
      },
    };

    res.json({ dailyData, weeklySummary });
  } catch (err) {
    console.error("❌ Error fetching weekly summary:", err);
    res.status(500).json({ message: "Server error", error: err.message });
  }
};
