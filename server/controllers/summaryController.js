const DailyWork = require("../models/DailyWork");

function secToHM(sec) {
  const h = Math.floor(sec / 3600);
  const m = Math.floor((sec % 3600) / 60);
  return `${h}h ${m.toString().padStart(2, "0")}m`;
}

exports.getWeeklySummary = async (req, res) => {
  try {
    const userId = req.user._id;
    if (!userId) return res.status(401).json({ message: "Unauthorized" });

    let { startDate, endDate } = req.query;

    if (!startDate || !endDate) {
      const now = new Date();
      const day = now.getDay();
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

    const dailyData = await DailyWork.find({
      userId,
      date: { $gte: startDate, $lte: endDate }
    }).sort({ date: 1 });

    const totalWorkSeconds = dailyData.reduce((sum, day) => sum + (day.workDurationSeconds || 0), 0);
    const totalBreakSeconds = dailyData.reduce((sum, day) => sum + (day.breakDurationSeconds || 0), 0);
    const daysCount = dailyData.length || 1;

    let earlyArrivals = 0;
    let lateArrivals = 0;
    let perfectDays = 0;
    let onTimeCount = 0;
    let breaksTaken = 0;

    dailyData.forEach((day) => {
      if (day.arrivalTime && day.expectedStartTime) {
        const arrival = new Date(day.arrivalTime);
        if (isNaN(arrival)) return;
        const [expHour, expMin] = day.expectedStartTime.split(":").map(Number);
        const expected = new Date(arrival);
        expected.setHours(expHour, expMin, 0, 0);

        if (arrival <= expected) {
          onTimeCount++;
          earlyArrivals++;
        } else {
          lateArrivals++;
        }
      }

      if (day.workDurationSeconds >= 28800 && day.arrivalTime) {
        const arrival = new Date(day.arrivalTime);
        if (!isNaN(arrival) && arrival.getHours() <= 9) {
          perfectDays++;
        }
      }

      if (Array.isArray(day.breakSessions)) {
        breaksTaken += day.breakSessions.length;
      }
    });

    const onTimeRate = dailyData.length
      ? `${Math.round((onTimeCount / dailyData.length) * 100)}%`
      : "0%";

    const avgDailyBreak = Math.floor(totalBreakSeconds / daysCount);

    const weeklySummary = {
      totalWork: secToHM(totalWorkSeconds),
      totalBreak: secToHM(totalBreakSeconds),
      avgDailyWork: secToHM(Math.floor(totalWorkSeconds / daysCount)),
      avgDailyBreak: secToHM(avgDailyBreak),
      daysCount,
      onTimeRate,
      breaksTaken,
      quickStats: {
        earlyArrivals,
        lateArrivals,
        perfectDays,
      },
    };

    res.json({ dailyData, weeklySummary });
  } catch (err) {
    console.error("Error fetching weekly summary:", err);
    res.status(500).json({ message: "Server error" });
  }
};
