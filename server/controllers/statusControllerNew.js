// controllers/statusControllerNew.js
// Refactored status controller using unified attendance service

const UserStatus = require("../models/UserStatus");
const User = require("../models/User");
const unifiedAttendanceService = require("../services/unifiedAttendanceService");

const {
  getEffectiveShift,
  getUnifiedAttendanceData,
  validateTimelineEvent,
  validatePunchInTime,
  syncToDailyWorkSafely,
  formatDuration,
  secondsToHours,
  EVENT_TYPES,
  ATTENDANCE_CONSTANTS,
} = unifiedAttendanceService;

/**
 * Get today's status for authenticated user
 * Uses unified attendance service for consistent calculations
 */
async function getTodayStatus(req, res) {
  try {
    const userId = req.user._id;
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    // Get or create UserStatus record
    let userStatus = await UserStatus.findOne({ userId, today });

    if (!userStatus) {
      userStatus = new UserStatus({
        userId,
        today,
        timeline: [],
        workedSessions: [],
        breakSessions: [],
        currentlyWorking: false,
        onBreak: false,
      });
      await userStatus.save();
    }

    // Get unified attendance data
    const attendanceData = await getUnifiedAttendanceData(userId, today);

    // Format response data
    const response = {
      userId: userStatus.userId,
      today: userStatus.today,
      currentlyWorking: attendanceData.currentlyWorking,
      onBreak: attendanceData.onBreak,

      // Use unified calculations
      workDurationSeconds: attendanceData.workDurationSeconds,
      breakDurationSeconds: attendanceData.breakDurationSeconds,
      workDuration: formatDuration(attendanceData.workDurationSeconds),
      breakDuration: formatDuration(attendanceData.breakDurationSeconds),

      // Attendance status from unified service
      arrivalTime: attendanceData.arrivalTime,
      departureTime: attendanceData.departureTime,
      isLate: attendanceData.isLate,
      isHalfDay: attendanceData.isHalfDay,
      isAbsent: attendanceData.isAbsent,
      isWFH: attendanceData.isWFH,

      // Timeline and sessions (source of truth)
      timeline: attendanceData.timeline,
      workedSessions: attendanceData.workedSessions,
      breakSessions: attendanceData.breakSessions,

      // Effective shift information
      effectiveShift: attendanceData.effectiveShift,

      // Formatted times for display
      arrivalTimeFormatted: attendanceData.arrivalTime
        ? attendanceData.arrivalTime.toLocaleTimeString('en-US', {
            hour: '2-digit',
            minute: '2-digit',
            hour12: true
          })
        : null,
    };

    res.json(response);

  } catch (error) {
    console.error("Error in getTodayStatus:", error);
    res.status(500).json({
      message: "Failed to get today's status",
      error: error.message
    });
  }
}

/**
 * Update today's status with punch in/out and break actions
 * Simplified and unified approach using the unified attendance service
 */
async function updateTodayStatus(req, res) {
  try {
    const userId = req.user._id;
    const { timelineEvent } = req.body;

    if (!timelineEvent || !timelineEvent.type) {
      return res.status(400).json({ message: "Timeline event is required" });
    }

    const now = new Date();
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    // Get or create UserStatus record
    let userStatus = await UserStatus.findOne({ userId, today });

    if (!userStatus) {
      userStatus = new UserStatus({
        userId,
        today,
        timeline: [],
        workedSessions: [],
        breakSessions: [],
        currentlyWorking: false,
        onBreak: false,
      });
    }

    // Validate the timeline event
    const eventToAdd = {
      type: timelineEvent.type,
      time: now,
    };

    if (!validateTimelineEvent(eventToAdd)) {
      return res.status(400).json({ message: "Invalid timeline event" });
    }

    const eventType = timelineEvent.type.toLowerCase();

    // Get effective shift for validation
    const effectiveShift = await getEffectiveShift(userId, today);

    // Handle different event types
    if (eventType.includes("punch in")) {
      await handlePunchIn(userStatus, effectiveShift, now);
    } else if (eventType.includes("punch out")) {
      await handlePunchOut(userStatus, now);
    } else if (eventType.includes("break start")) {
      await handleBreakStart(userStatus, now, timelineEvent.breakType);
    } else if (eventType.includes("resume work")) {
      await handleResumeWork(userStatus, now);
    } else {
      return res.status(400).json({ message: "Unknown event type" });
    }

    // Add event to timeline
    userStatus.timeline.push(eventToAdd);

    // Save UserStatus
    await userStatus.save();

    // Sync to DailyWork safely
    try {
      await syncToDailyWorkSafely(userId, today);
    } catch (syncError) {
      console.error("Sync to DailyWork failed:", syncError);
      // Don't fail the request if sync fails, but log it
    }

    // Get updated unified attendance data for response
    const updatedData = await getUnifiedAttendanceData(userId, today);

    // Format response
    const response = {
      userId: userStatus.userId,
      today: userStatus.today,
      currentlyWorking: updatedData.currentlyWorking,
      onBreak: updatedData.onBreak,

      workDurationSeconds: updatedData.workDurationSeconds,
      breakDurationSeconds: updatedData.breakDurationSeconds,
      workDuration: formatDuration(updatedData.workDurationSeconds),
      breakDuration: formatDuration(updatedData.breakDurationSeconds),

      arrivalTime: updatedData.arrivalTime,
      departureTime: updatedData.departureTime,
      isLate: updatedData.isLate,
      isHalfDay: updatedData.isHalfDay,
      isAbsent: updatedData.isAbsent,

      timeline: updatedData.timeline,
      workedSessions: updatedData.workedSessions,
      breakSessions: updatedData.breakSessions,

      effectiveShift: updatedData.effectiveShift,

      arrivalTimeFormatted: updatedData.arrivalTime
        ? updatedData.arrivalTime.toLocaleTimeString('en-US', {
            hour: '2-digit',
            minute: '2-digit',
            hour12: true
          })
        : null,
    };

    res.json(response);

  } catch (error) {
    console.error("Error in updateTodayStatus:", error);
    res.status(500).json({
      message: "Failed to update status",
      error: error.message
    });
  }
}

/**
 * Handle punch in logic
 */
async function handlePunchIn(userStatus, effectiveShift, now) {
  // Validate punch in time
  const validation = validatePunchInTime(now, effectiveShift);
  if (!validation.isValid) {
    throw new Error(validation.message);
  }

  // Check if already punched in today
  const hasPunchedIn = userStatus.timeline.some(e =>
    e.type.toLowerCase().includes("punch in")
  );

  if (hasPunchedIn) {
    throw new Error("Already punched in today");
  }

  // Check if already punched out (can't punch in after punch out)
  const hasPunchedOut = userStatus.timeline.some(e =>
    e.type.toLowerCase().includes("punch out")
  );

  if (hasPunchedOut) {
    throw new Error("Cannot punch in after punching out for the day");
  }

  if (userStatus.currentlyWorking) {
    throw new Error("Already working");
  }

  // Set status
  userStatus.currentlyWorking = true;
  userStatus.onBreak = false;
  userStatus.arrivalTime = userStatus.arrivalTime || now;

  // Start new work session
  userStatus.workedSessions.push({ start: now });

  // Update user status to active
  await User.findByIdAndUpdate(userStatus.userId, { status: "active" });
}

/**
 * Handle punch out logic
 */
async function handlePunchOut(userStatus, now) {
  // Check if already punched out today
  const hasPunchedOut = userStatus.timeline.some(e =>
    e.type.toLowerCase().includes("punch out")
  );

  if (hasPunchedOut) {
    throw new Error("Already punched out today");
  }

  // Check if currently working or on break
  if (!userStatus.currentlyWorking && !userStatus.onBreak) {
    throw new Error("Cannot punch out when not working or on break");
  }

  // Close current work session
  const lastWorkSession = userStatus.workedSessions[userStatus.workedSessions.length - 1];
  if (lastWorkSession && !lastWorkSession.end) {
    lastWorkSession.end = now;
  }

  // Close current break session if any
  const lastBreakSession = userStatus.breakSessions[userStatus.breakSessions.length - 1];
  if (lastBreakSession && !lastBreakSession.end) {
    lastBreakSession.end = now;
  }

  // Update status
  userStatus.currentlyWorking = false;
  userStatus.onBreak = false;

  // Update user status to inactive
  await User.findByIdAndUpdate(userStatus.userId, { status: "inactive" });
}

/**
 * Handle break start logic
 */
async function handleBreakStart(userStatus, now, breakType = null) {
  if (!userStatus.currentlyWorking) {
    throw new Error("Cannot start break when not working");
  }

  if (userStatus.onBreak) {
    throw new Error("Already on break");
  }

  // Check if already punched out
  const hasPunchedOut = userStatus.timeline.some(e =>
    e.type.toLowerCase().includes("punch out")
  );

  if (hasPunchedOut) {
    throw new Error("Cannot start break after punching out for the day");
  }

  // Close current work session
  const lastWorkSession = userStatus.workedSessions[userStatus.workedSessions.length - 1];
  if (lastWorkSession && !lastWorkSession.end) {
    lastWorkSession.end = now;
  }

  // Start new break session
  const newBreak = { start: now };
  if (breakType) newBreak.type = breakType;
  userStatus.breakSessions.push(newBreak);

  // Update status
  userStatus.onBreak = true;
}

/**
 * Handle resume work logic
 */
async function handleResumeWork(userStatus, now) {
  if (!userStatus.onBreak) {
    throw new Error("Cannot resume work when not on break");
  }

  // Check if already punched out
  const hasPunchedOut = userStatus.timeline.some(e =>
    e.type.toLowerCase().includes("punch out")
  );

  if (hasPunchedOut) {
    throw new Error("Cannot resume work after punching out for the day");
  }

  // Close current break session
  const lastBreakSession = userStatus.breakSessions[userStatus.breakSessions.length - 1];
  if (lastBreakSession && !lastBreakSession.end) {
    lastBreakSession.end = now;
  }

  // Start new work session
  userStatus.workedSessions.push({ start: now });

  // Update status
  userStatus.onBreak = false;
  userStatus.currentlyWorking = true;
}

/**
 * Get employee status for admin view
 */
async function getEmployeeTodayStatus(req, res) {
  try {
    const { employeeId } = req.params;
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    // Get unified attendance data
    const attendanceData = await getUnifiedAttendanceData(employeeId, today);

    const response = {
      employeeId,
      today,
      currentlyWorking: attendanceData.currentlyWorking,
      onBreak: attendanceData.onBreak,

      workDurationSeconds: attendanceData.workDurationSeconds,
      breakDurationSeconds: attendanceData.breakDurationSeconds,
      workDuration: formatDuration(attendanceData.workDurationSeconds),
      breakDuration: formatDuration(attendanceData.breakDurationSeconds),

      arrivalTime: attendanceData.arrivalTime,
      departureTime: attendanceData.departureTime,
      isLate: attendanceData.isLate,
      isHalfDay: attendanceData.isHalfDay,
      isAbsent: attendanceData.isAbsent,
      isWFH: attendanceData.isWFH,

      timeline: attendanceData.timeline,
      effectiveShift: attendanceData.effectiveShift,

      arrivalTimeFormatted: attendanceData.arrivalTime
        ? attendanceData.arrivalTime.toLocaleTimeString('en-US', {
            hour: '2-digit',
            minute: '2-digit',
            hour12: true
          })
        : null,
    };

    res.json(response);

  } catch (error) {
    console.error("Error in getEmployeeTodayStatus:", error);
    res.status(500).json({
      message: "Failed to get employee status",
      error: error.message
    });
  }
}

/**
 * Utility function to format time for display
 */
function formatTime(date) {
  if (!date) return null;
  const d = new Date(date);
  return d.toLocaleTimeString('en-US', {
    hour: '2-digit',
    minute: '2-digit',
    hour12: true
  });
}

/**
 * Manual sync function for admin use
 */
async function syncDailyWork(req, res) {
  try {
    const userId = req.params.userId || req.user._id;
    const date = req.query.date ? new Date(req.query.date) : new Date();

    await syncToDailyWorkSafely(userId, date);

    res.json({
      message: "Sync completed successfully",
      userId,
      date: date.toISOString().split('T')[0]
    });

  } catch (error) {
    console.error("Error in syncDailyWork:", error);
    res.status(500).json({
      message: "Sync failed",
      error: error.message
    });
  }
}

module.exports = {
  getTodayStatus,
  updateTodayStatus,
  getEmployeeTodayStatus,
  syncDailyWork,
  formatTime,
};