const express = require("express");
const router = express.Router();
const User = require("../models/User");
const UserStatus = require("../models/UserStatus");
const DailyWork = require("../models/DailyWork");

// GET all employees, admins, and HRs with attendance for a specific date
router.get("/employees-today", async (req, res) => {
  try {
    const { date } = req.query;

    // Parse date or use today
    const targetDate = date ? new Date(date) : new Date();
    targetDate.setHours(0, 0, 0, 0);

    const startOfDay = new Date(targetDate);
    const endOfDay = new Date(targetDate);
    endOfDay.setHours(23, 59, 59, 999);

    // Fetch users with role employee, admin, or hr
    const users = await User.find({ role: { $in: ["employee", "admin", "hr"] } }).lean();

    const data = await Promise.all(
      users.map(async (user) => {
        // Get user status for the date
        const status = await UserStatus.findOne({
          userId: user._id,
          today: { $gte: startOfDay, $lte: endOfDay },
        });

        // Get daily work info
        const dailyWork = await DailyWork.findOne({
          userId: user._id,
          date: { $gte: startOfDay, $lte: endOfDay },
        });

        // Work duration string from DailyWork or compute from sessions
        let workDurationStr = "0h 0m";
        const workSeconds = dailyWork?.workDurationSeconds || 0;
        if (workSeconds > 0) {
          const hours = Math.floor(workSeconds / 3600);
          const minutes = Math.floor((workSeconds % 3600) / 60);
          workDurationStr = `${hours}h ${minutes}m`;
        }

        // Break minutes from DailyWork.breakDurationSeconds or compute
        let breakMinutes = 0;
        const breakSeconds = dailyWork?.breakDurationSeconds || 0;
        if (breakSeconds > 0) {
          breakMinutes = Math.round(breakSeconds / 60);
        } else if (Array.isArray(dailyWork?.breakSessions)) {
          const totalBreakMs = dailyWork.breakSessions.reduce((sum, s) => {
            if (s.start && s.end) return sum + (new Date(s.end) - new Date(s.start));
            return sum;
          }, 0);
          breakMinutes = Math.round(totalBreakMs / 60000);
        }

        // Derive punch-in and punch-out strictly from timeline to avoid counting breaks as punch-out
        let punchInTime = null;
        let punchOutTime = null;
        if (status?.timeline?.length > 0) {
          const firstPunchIn = status.timeline
            .filter((e) => typeof e.type === 'string' && e.type.toLowerCase().includes('punch in') && e.time)
            .sort((a, b) => new Date(a.time) - new Date(b.time))[0];
          if (firstPunchIn) punchInTime = firstPunchIn.time;

          const lastPunchOut = [...status.timeline]
            .reverse()
            .find((e) => typeof e.type === 'string' && e.type.toLowerCase().includes('punch out') && e.time);
          if (lastPunchOut) punchOutTime = lastPunchOut.time;
        }

        // Fallbacks
        if (!punchInTime) punchInTime = status?.arrivalTime || dailyWork?.arrivalTime || null;

        // Break type from latest break start event
        let breakType = null;
        if (status?.timeline?.length > 0) {
          const breakEntry = [...status.timeline]
            .reverse()
            .find((e) => typeof e.type === 'string' && e.type.toLowerCase().includes("break start"));
          if (breakEntry) breakType = breakEntry.type;
        }

        return {
          userId: user._id,
          employeeId: user.employeeId,
          name: user.name,
          role: user.role,
          arrivalTime: punchInTime,
          punchOutTime,
          onBreak: status?.onBreak || false,
          breakDurationMinutes: breakMinutes,
          breakType, // include break type
          workDuration: workDurationStr,
          currentlyWorking: status?.currentlyWorking || false,
        };
      })
    );

    // Sort so currently working → on break → others
    data.sort((a, b) => {
      if (a.currentlyWorking && !b.currentlyWorking) return -1;
      if (!a.currentlyWorking && b.currentlyWorking) return 1;

      if (a.onBreak && !b.onBreak) return -1;
      if (!a.onBreak && b.onBreak) return 1;

      return 0;
    });

    res.json(data);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Server error" });
  }
});

module.exports = router;
