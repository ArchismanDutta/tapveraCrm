// controllers/summaryControllerNew.js
// Refactored summary controller using unified attendance service

const AttendanceRecord = require("../models/AttendanceRecord");
const User = require("../models/User");
const unifiedAttendanceService = require("../services/unifiedAttendanceService");

const {
  getUnifiedAttendanceData,
  formatDuration,
  secondsToHours,
  ATTENDANCE_CONSTANTS,
} = unifiedAttendanceService;

/**
 * Get weekly summary using unified attendance calculations
 * This ensures consistency with daily punch in/out data
 */
exports.getWeeklySummary = async (req, res) => {
  try {
    let userId = req.user?._id;

    // Check if admin is requesting data for a specific employee
    if (req.query.userId && ["admin", "super-admin", "hr"].includes(req.user.role)) {
      userId = req.query.userId;
    }

    if (!userId) return res.status(401).json({ message: "Unauthorized" });

    const user = await User.findById(userId).lean();
    if (!user) {
      return res.status(404).json({ message: "User not found" });
    }

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

    console.log(`Getting unified attendance summary for user ${userId}, range: ${startDate.toISOString()} to ${endDate.toISOString()}`);

    // Get daily data using unified service for consistency
    const dailyData = await getUnifiedDailyData(userId, startDate, endDate);

    // Calculate summary statistics using consistent methods
    const weeklySummary = calculateWeeklySummary(dailyData);

    // Format response
    const response = {
      dailyData,
      weeklySummary,
      dateRange: {
        startDate: startDate.toISOString(),
        endDate: endDate.toISOString(),
      },
      generatedAt: new Date().toISOString(),
    };

    res.json(response);

  } catch (error) {
    console.error("Error in getWeeklySummary:", error);
    res.status(500).json({
      message: "Failed to get weekly summary",
      error: error.message
    });
  }
};

/**
 * Get unified daily data for a date range
 * Uses the unified attendance service for each day
 */
async function getUnifiedDailyData(userId, startDate, endDate) {
  const dailyData = [];
  const current = new Date(startDate);

  while (current <= endDate) {
    try {
      // Get unified attendance data for this day
      const attendanceData = await getUnifiedAttendanceData(userId, current);

      // Format the daily record consistently
      const dailyRecord = {
        userId,
        date: new Date(current),

        // Work and break durations from unified calculations
        workDurationSeconds: attendanceData.workDurationSeconds,
        breakDurationSeconds: attendanceData.breakDurationSeconds,

        // Sessions from unified source
        workedSessions: attendanceData.workedSessions,
        breakSessions: attendanceData.breakSessions,

        // Timeline from unified source
        timeline: attendanceData.timeline,

        // Attendance status from unified calculations
        arrivalTime: attendanceData.arrivalTime,
        departureTime: attendanceData.departureTime,
        isLate: attendanceData.isLate,
        isHalfDay: attendanceData.isHalfDay,
        isAbsent: attendanceData.isAbsent,
        isWFH: attendanceData.isWFH,

        // Leave information
        isOnLeave: Boolean(attendanceData.leaveInfo),
        leaveInfo: attendanceData.leaveInfo,

        // Shift information
        effectiveShift: attendanceData.effectiveShift,
        expectedStartTime: attendanceData.effectiveShift.start,

        // Status flags with WFH support
        currentlyWorking: attendanceData.currentlyWorking,
        onBreak: attendanceData.onBreak,

        // Formatted durations for display
        workDuration: formatDuration(attendanceData.workDurationSeconds),
        breakDuration: formatDuration(attendanceData.breakDurationSeconds),
      };

      dailyData.push(dailyRecord);

    } catch (error) {
      console.error(`Error getting data for ${current.toISOString()}:`, error);

      // Add empty record for failed days to maintain consistency
      dailyData.push({
        userId,
        date: new Date(current),
        workDurationSeconds: 0,
        breakDurationSeconds: 0,
        isAbsent: true,
        isLate: false,
        isHalfDay: false,
        isWFH: false,
        isOnLeave: false,
        workedSessions: [],
        breakSessions: [],
        timeline: [],
        arrivalTime: null,
        departureTime: null,
        workDuration: "0h 0m",
        breakDuration: "0h 0m",
        effectiveShift: null,
      });
    }

    // Move to next day
    current.setDate(current.getDate() + 1);
  }

  return dailyData;
}

/**
 * Calculate weekly summary statistics from daily data
 * Uses consistent calculation methods
 */
function calculateWeeklySummary(dailyData) {
  let totalWorkSeconds = 0;
  let totalBreakSeconds = 0;
  let presentDays = 0;
  let lateDays = 0;
  let halfDays = 0;
  let absentDays = 0;
  let wfhDays = 0;
  let leaveDays = 0;
  let workingDays = 0;

  // Calculate totals using unified data
  for (const day of dailyData) {
    // Skip weekends for working day calculations
    const dayOfWeek = new Date(day.date).getDay();
    const isWeekend = dayOfWeek === 0 || dayOfWeek === 6;

    if (!isWeekend) {
      workingDays++;

      if (day.isWFH) {
        wfhDays++;
        presentDays++; // WFH counts as present
      } else if (day.isOnLeave) {
        leaveDays++;
        if (day.leaveInfo && day.leaveInfo.type !== 'unpaid') {
          presentDays++; // Paid leave counts as present
        }
      } else if (!day.isAbsent) {
        presentDays++;

        if (day.isLate) {
          lateDays++;
        }

        if (day.isHalfDay) {
          halfDays++;
        }
      } else {
        absentDays++;
      }
    }

    // Add work and break time regardless of weekend status
    totalWorkSeconds += day.workDurationSeconds || 0;
    totalBreakSeconds += day.breakDurationSeconds || 0;
  }

  // Calculate rates and averages
  const attendanceRate = workingDays > 0 ? Math.round((presentDays / workingDays) * 100) : 0;
  const onTimeRate = presentDays > 0 ? Math.round(((presentDays - lateDays) / presentDays) * 100) : 0;

  const totalWorkHours = secondsToHours(totalWorkSeconds);
  const averageDailyHours = workingDays > 0 ? secondsToHours(totalWorkSeconds / workingDays) : 0;

  // Calculate efficiency (could be enhanced based on business requirements)
  const expectedDailyHours = 8; // Standard work day
  const expectedWeeklyHours = expectedDailyHours * workingDays;
  const efficiency = expectedWeeklyHours > 0 ? Math.round((totalWorkHours / expectedWeeklyHours) * 100) : 0;

  // Calculate total breaks taken from daily data
  const breaksTaken = dailyData.reduce((total, day) => {
    return total + (day.breakDurationSeconds > 0 ? 1 : 0);
  }, 0);

  return {
    // Summary counts
    presentDays,
    lateDays,
    halfDays,
    absentDays,
    wfhDays,
    leaveDays,
    workingDays,
    totalDays: dailyData.length,

    // Time totals (decimal hours)
    totalWorkHours: Math.round(totalWorkHours * 100) / 100,
    totalBreakHours: Math.round(secondsToHours(totalBreakSeconds) * 100) / 100,
    averageDailyHours: Math.round(averageDailyHours * 100) / 100,

    // Formatted durations (for SummaryCard compatibility)
    totalWork: formatDuration(totalWorkSeconds),
    totalBreak: formatDuration(totalBreakSeconds),
    avgDailyWork: formatDuration(Math.floor(totalWorkSeconds / Math.max(presentDays, 1))),
    avgDailyBreak: formatDuration(Math.floor(totalBreakSeconds / Math.max(presentDays, 1))),
    breaksTaken: breaksTaken,
    onTimeRate: onTimeRate + '%',

    // Legacy field names for backward compatibility
    totalWorkDuration: formatDuration(totalWorkSeconds),
    totalBreakDuration: formatDuration(totalBreakSeconds),
    averageDailyDuration: formatDuration(Math.floor(totalWorkSeconds / Math.max(workingDays, 1))),
    totalWorkTime: formatDuration(totalWorkSeconds),
    totalBreakTime: formatDuration(totalBreakSeconds),

    // Rates and percentages
    attendanceRate,
    efficiency: Math.min(efficiency, 100), // Cap at 100%

    // Quick stats for dashboard
    quickStats: {
      earlyArrivals: presentDays - lateDays, // On-time arrivals
      lateArrivals: lateDays,
      perfectDays: presentDays - lateDays - halfDays,
    },

    // Additional insights
    insights: {
      mostProductiveDay: findMostProductiveDay(dailyData),
      averageBreakTime: Math.round((totalBreakSeconds / Math.max(presentDays, 1)) / 60), // in minutes
      longestWorkDay: Math.max(...dailyData.map(d => secondsToHours(d.workDurationSeconds))),
    },
  };
}

/**
 * Find the most productive day (highest work hours)
 */
function findMostProductiveDay(dailyData) {
  if (dailyData.length === 0) return null;

  let maxHours = 0;
  let mostProductiveDay = null;

  for (const day of dailyData) {
    const hours = secondsToHours(day.workDurationSeconds);
    if (hours > maxHours) {
      maxHours = hours;
      mostProductiveDay = {
        date: day.date,
        hours: Math.round(hours * 100) / 100,
      };
    }
  }

  return mostProductiveDay;
}

/**
 * Get monthly summary (extended from weekly logic)
 */
exports.getMonthlySummary = async (req, res) => {
  try {
    const userId = req.user._id;
    const user = await User.findById(userId).lean();

    if (!user) {
      return res.status(404).json({ message: "User not found" });
    }

    // Default to current month
    const now = new Date();
    const startDate = new Date(now.getFullYear(), now.getMonth(), 1);
    const endDate = new Date(now.getFullYear(), now.getMonth() + 1, 0, 23, 59, 59, 999);

    console.log(`Getting monthly summary for user ${userId}, range: ${startDate.toISOString()} to ${endDate.toISOString()}`);

    // Get daily data using unified service
    const dailyData = await getUnifiedDailyData(userId, startDate, endDate);

    // Calculate monthly summary (reuse weekly logic)
    const monthlySummary = calculateWeeklySummary(dailyData);

    const response = {
      dailyData,
      monthlySummary,
      dateRange: {
        startDate: startDate.toISOString(),
        endDate: endDate.toISOString(),
        month: now.toLocaleString('default', { month: 'long' }),
        year: now.getFullYear(),
      },
      generatedAt: new Date().toISOString(),
    };

    res.json(response);

  } catch (error) {
    console.error("Error in getMonthlySummary:", error);
    res.status(500).json({
      message: "Failed to get monthly summary",
      error: error.message
    });
  }
};

module.exports = {
  getWeeklySummary: exports.getWeeklySummary,
  getMonthlySummary: exports.getMonthlySummary,
};