const express = require("express");
const router = express.Router();
const { protect } = require("../middlewares/authMiddleware");
const User = require("../models/User");
const UserStatus = require("../models/UserStatus");
// const DailyWork = require("../models/DailyWork"); // REMOVED - Using new AttendanceRecord system
const AttendanceRecord = require("../models/AttendanceRecord");

// Apply authentication middleware to all routes
router.use(protect);

// GET all employees, admins, and HRs with attendance for a specific date
router.get("/employees-today", async (req, res) => {
  try {
    // Check if user has permission to access this endpoint
    const userRole = req.user.role;
    if (!["super-admin", "hr", "admin"].includes(userRole)) {
      return res
        .status(403)
        .json({
          error:
            "Access denied. Super admin, HR, or admin privileges required.",
        });
    }

    const { date } = req.query;
    console.log("SuperAdmin API called with date:", date);
    console.log("Requested by user:", req.user.name, "with role:", userRole);

    // Parse date or use today
    const targetDate = date ? new Date(date) : new Date();
    targetDate.setHours(0, 0, 0, 0);
    console.log("Target date:", targetDate);

    const startOfDay = new Date(targetDate);
    const endOfDay = new Date(targetDate);
    endOfDay.setHours(23, 59, 59, 999);

    // Fetch users with role employee, admin, or hr
    const users = await User.find({
      role: { $in: ["employee", "admin", "hr"] },
    }).lean();
    console.log(`Found ${users.length} users with roles: employee, admin, hr`);

    // OPTIMIZATION: Fetch the date record ONCE for all employees
    const dateRecord = await AttendanceRecord.findOne({
      date: { $gte: startOfDay, $lte: endOfDay }
    });
    console.log(`Date record found: ${!!dateRecord}, employees in record: ${dateRecord?.employees?.length || 0}`);

    const data = await Promise.all(
      users.map(async (user) => {
        try {
          // Get user status for the date (legacy real-time tracking)
          const status = await UserStatus.findOne({
            userId: user._id,
            today: { $gte: startOfDay, $lte: endOfDay },
          });

          // Extract this employee's data from the date record
          let attendanceRecord = null;
          if (dateRecord) {
            const employeeData = dateRecord.employees?.find(
              emp => emp.userId.toString() === user._id.toString()
            );
            if (employeeData) {
              // Flatten the structure for backward compatibility
              attendanceRecord = {
                userId: user._id,
                date: dateRecord.date,
                workDurationSeconds: employeeData.calculated?.workDurationSeconds || 0,
                breakDurationSeconds: employeeData.calculated?.breakDurationSeconds || 0,
                arrivalTime: employeeData.calculated?.arrivalTime,
                departureTime: employeeData.calculated?.departureTime,
                isPresent: employeeData.calculated?.isPresent || false,
                isLate: employeeData.calculated?.isLate || false,
                isHalfDay: employeeData.calculated?.isHalfDay || false,
                events: employeeData.events || [],
                timeline: employeeData.events || [], // Map events to timeline for compatibility
                assignedShift: employeeData.assignedShift
              };
            }
          }

          // Log missing data for debugging
          if (!status && !attendanceRecord) {
            console.log(`No data found for ${user.name} (${user.employeeId}) on ${targetDate.toDateString()}`);
          }

        // Work duration string - calculate real-time for accuracy
        let workDurationStr = "0h 0m";
        let totalWorkMinutes = 0;

        // First try stored work duration as fallback
        const workSeconds = attendanceRecord?.workDurationSeconds || 0;
        if (workSeconds > 0) {
          totalWorkMinutes = Math.floor(workSeconds / 60);
        }

        // For real-time accuracy, calculate from timeline events
        if (status?.timeline?.length > 0) {
          let timelineWorkMinutes = 0;
          let lastPunchIn = null;
          let isCurrentlyWorking = false;

          // Process timeline to calculate work time
          for (const event of status.timeline) {
            const eventTime = new Date(event.time);

            if (event.type && event.type.toLowerCase().includes('punch in')) {
              lastPunchIn = eventTime;
              isCurrentlyWorking = true;
            } else if (event.type && event.type.toLowerCase().includes('punch out')) {
              if (lastPunchIn) {
                timelineWorkMinutes += (eventTime - lastPunchIn) / (1000 * 60);
              }
              isCurrentlyWorking = false;
              lastPunchIn = null;
            } else if (event.type && event.type.toLowerCase().includes('break start') && lastPunchIn) {
              // Count work time until break start
              timelineWorkMinutes += (eventTime - lastPunchIn) / (1000 * 60);
              lastPunchIn = null;
            } else if (event.type && event.type.toLowerCase().includes('break end')) {
              // Resume work timing from break end
              lastPunchIn = eventTime;
            }
          }

          // If currently working and not on break, add time since last punch in or break end
          if (status.currentlyWorking && !status.onBreak && lastPunchIn) {
            const now = new Date();
            timelineWorkMinutes += (now - lastPunchIn) / (1000 * 60);
          }

          // Use timeline calculation if it seems more accurate
          if (timelineWorkMinutes > 0) {
            totalWorkMinutes = Math.round(timelineWorkMinutes);
          }
        }

        // Format work duration string
        if (totalWorkMinutes > 0) {
          const hours = Math.floor(totalWorkMinutes / 60);
          const minutes = totalWorkMinutes % 60;
          workDurationStr = `${hours}h ${minutes}m`;
        }

        // Break minutes - calculate from current timeline for real-time accuracy
        let breakMinutes = 0;

        // If using DailyWork breakDurationSeconds, use it as fallback
        const storedBreakSeconds = attendanceRecord?.breakDurationSeconds || 0;
        if (storedBreakSeconds > 0) {
          breakMinutes = Math.round(storedBreakSeconds / 60);
        }

        // For real-time accuracy, calculate from timeline break sessions
        if (status?.timeline?.length > 0) {
          let timelineBreakMinutes = 0;
          let currentBreakStart = null;

          // Process timeline events to calculate break time
          for (const event of status.timeline) {
            const eventTime = new Date(event.time);

            if (event.type && event.type.toLowerCase().includes('break start')) {
              currentBreakStart = eventTime;
            } else if (event.type && event.type.toLowerCase().includes('break end') && currentBreakStart) {
              timelineBreakMinutes += (eventTime - currentBreakStart) / (1000 * 60);
              currentBreakStart = null;
            } else if (event.type && event.type.toLowerCase().includes('resume work') && currentBreakStart) {
              // Also handle "Resume Work" events as break end
              timelineBreakMinutes += (eventTime - currentBreakStart) / (1000 * 60);
              currentBreakStart = null;
            }
          }

          // If currently on break, add time since break started
          if (status.onBreak && currentBreakStart) {
            const now = new Date();
            timelineBreakMinutes += (now - currentBreakStart) / (1000 * 60);
          } else if (status.onBreak && !currentBreakStart) {
            // Fallback: if on break but no break start found in timeline, use breakStartTime
            const breakStartTime = status.breakStartTime || status.lastBreakStart;
            if (breakStartTime) {
              const now = new Date();
              timelineBreakMinutes += (now - new Date(breakStartTime)) / (1000 * 60);
            }
          }

          // Use timeline calculation if available
          if (timelineBreakMinutes > 0) {
            breakMinutes = Math.round(timelineBreakMinutes);
          }
        }

        // Fallback to DailyWork.breakSessions if available
        if (breakMinutes === 0 && Array.isArray(attendanceRecord?.breakSessions)) {
          const totalBreakMs = attendanceRecord.breakSessions.reduce((sum, s) => {
            if (s.start && s.end)
              return sum + (new Date(s.end) - new Date(s.start));
            return sum;
          }, 0);
          breakMinutes = Math.round(totalBreakMs / 60000);
        }

        // Derive punch-in and punch-out strictly from timeline to avoid counting breaks as punch-out
        let punchInTime = null;
        let punchOutTime = null;
        if (status?.timeline?.length > 0) {
          const firstPunchIn = status.timeline
            .filter(
              (e) =>
                typeof e.type === "string" &&
                e.type.toLowerCase().includes("punch in") &&
                e.time
            )
            .sort((a, b) => new Date(a.time) - new Date(b.time))[0];
          if (firstPunchIn) punchInTime = firstPunchIn.time;

          const lastPunchOut = [...status.timeline]
            .reverse()
            .find(
              (e) =>
                typeof e.type === "string" &&
                e.type.toLowerCase().includes("punch out") &&
                e.time
            );
          if (lastPunchOut) punchOutTime = lastPunchOut.time;
        }

        // Fallbacks
        if (!punchInTime)
          punchInTime = status?.arrivalTime || attendanceRecord?.arrivalTime || null;

        // Break type from latest break start event
        let breakType = null;
        if (status?.timeline?.length > 0) {
          const breakEntry = [...status.timeline]
            .reverse()
            .find(
              (e) =>
                typeof e.type === "string" &&
                e.type.toLowerCase().includes("break start")
            );
          if (breakEntry) breakType = breakEntry.type;
        }

          // Debug logging for calculation verification
          if (user.name && (status?.currentlyWorking || status?.onBreak)) {
            console.log(`Real-time calc for ${user.name}:`, {
              currentlyWorking: status?.currentlyWorking,
              onBreak: status?.onBreak,
              workDuration: workDurationStr,
              breakMinutes,
              storedWorkSeconds: workSeconds,
              storedBreakSeconds: storedBreakSeconds,
              timelineEventsCount: status?.timeline?.length || 0,
              breakStartTime: status?.breakStartTime,
              lastBreakStart: status?.lastBreakStart
            });
          }

          return {
            userId: user._id,
            employeeId: user.employeeId || `EMP${user._id.toString().slice(-4)}`,
            name: user.name || 'Unknown Employee',
            role: user.role,
            arrivalTime: punchInTime,
            punchOutTime,
            onBreak: status?.onBreak || false,
            breakDurationMinutes: breakMinutes,
            breakType, // include break type
            workDuration: workDurationStr,
            currentlyWorking: status?.currentlyWorking || false,
            // Add debug fields
            hasStatus: !!status,
            hasAttendanceRecord: !!attendanceRecord,
            // Add calculation source info for debugging
            calculationSource: {
              workFromTimeline: totalWorkMinutes > Math.floor(workSeconds / 60),
              breakFromTimeline: breakMinutes > Math.round((attendanceRecord?.breakDurationSeconds || 0) / 60),
              lastCalculated: new Date().toISOString()
            }
          };
        } catch (error) {
          console.error(`Error processing employee ${user.name} (${user.employeeId}):`, error);
          // Return minimal data for problematic employees
          return {
            userId: user._id,
            employeeId: user.employeeId || `EMP${user._id.toString().slice(-4)}`,
            name: user.name || 'Unknown Employee',
            role: user.role,
            arrivalTime: null,
            punchOutTime: null,
            onBreak: false,
            breakDurationMinutes: 0,
            breakType: null,
            workDuration: "0h 0m",
            currentlyWorking: false,
            hasStatus: false,
            hasAttendanceRecord: false,
            error: error.message,
          };
        }
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

    console.log(`Returning data for ${data.length} employees`);
    res.json(data);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Server error" });
  }
});

module.exports = router;
