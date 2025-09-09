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

        // Work duration string
        let workDurationStr = "0h 0m";
        if (dailyWork?.workDurationSeconds) {
          const hours = Math.floor(dailyWork.workDurationSeconds / 3600);
          const minutes = Math.floor((dailyWork.workDurationSeconds % 3600) / 60);
          workDurationStr = `${hours}h ${minutes}m`;
        }

        const breakMinutes = dailyWork?.totalBreakMinutes || 0;

        // Get latest punch out time from timeline
        let punchOutTime = null;
        if (status?.timeline?.length > 0) {
          const punchOutEntry = [...status.timeline]
            .reverse()
            .find((e) => e.type.toLowerCase() === "punch out");
          if (punchOutEntry) punchOutTime = punchOutEntry.time;
        }

        // Get latest break type from timeline
        let breakType = null;
        if (status?.timeline?.length > 0) {
          const breakEntry = [...status.timeline]
            .reverse()
            .find((e) => e.type.toLowerCase().includes("break"));
          if (breakEntry) breakType = breakEntry.type; // e.g. "Break Start (Personal)"
        }

        return {
          userId: user._id,
          employeeId: user.employeeId,
          name: user.name,
          role: user.role,
          arrivalTime: status?.arrivalTime || null,
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
