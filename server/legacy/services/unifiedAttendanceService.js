// services/unifiedAttendanceService.js
// Unified service to handle all attendance calculations with single source of truth

const User = require("../models/User");
const UserStatus = require("../models/UserStatus");
// const DailyWork = require("../models/DailyWork"); // REMOVED - Using new AttendanceRecord system
const AttendanceRecord = require("../models/AttendanceRecord");
const LeaveRequest = require("../models/LeaveRequest");
const FlexibleShiftRequest = require("../models/FlexibleShiftRequest");

// Constants for attendance rules - Single source of truth
const ATTENDANCE_CONSTANTS = {
  // Work hour thresholds
  MIN_HALF_DAY_WORK_HOURS: 5,
  MIN_FULL_DAY_WORK_HOURS: 7.5,

  // Flexible shift rules (total hours including break)
  FLEXIBLE_MIN_HALF_DAY_TOTAL_HOURS: 5,
  FLEXIBLE_MIN_FULL_DAY_TOTAL_HOURS: 9, // 7.5 work + 1.5 break

  // Time limits
  MAX_DAILY_WORK_HOURS: 24,
  LATE_THRESHOLD_MINUTES: 15,

  // Session validation
  MAX_SESSION_DURATION_HOURS: 24,
  MIN_SESSION_DURATION_SECONDS: 1,
};

// Event types for consistency
const EVENT_TYPES = {
  PUNCH_IN: "Punch In",
  PUNCH_OUT: "Punch Out",
  BREAK_START: "Break Start",
  RESUME_WORK: "Resume Work",
};

// Standard shift definitions
const STANDARD_SHIFTS = {
  MORNING: { name: "Day Shift (Morning Shift)", start: "09:00", end: "18:00", durationHours: 9 },
  EVENING: { name: "Evening Shift", start: "13:00", end: "22:00", durationHours: 9 },
  NIGHT: { name: "Night Shift", start: "20:00", end: "05:00", durationHours: 9 },
  EARLY: { name: "Early Morning Shift", start: "05:30", end: "14:30", durationHours: 9 },
};

/**
 * Unified timeline validation - ensures timeline events are valid
 */
function validateTimelineEvent(event) {
  if (!event || typeof event !== 'object') return false;
  if (!event.type || typeof event.type !== 'string') return false;
  if (!event.time || !(event.time instanceof Date || typeof event.time === 'string')) return false;

  // Validate date
  const eventDate = new Date(event.time);
  if (isNaN(eventDate.getTime())) return false;

  // Validate event type
  const validTypes = Object.values(EVENT_TYPES);
  const isValidType = validTypes.some(type =>
    event.type.toLowerCase().includes(type.toLowerCase())
  );

  return isValidType;
}

/**
 * Get effective shift for user on a specific date
 * Priority: Override > FlexiblePermanent > FlexibleRequest > Standard > Default
 */
async function getEffectiveShift(userId, date) {
  try {
    const targetDate = new Date(date);
    targetDate.setHours(0, 0, 0, 0);
    const dateKey = targetDate.toISOString().slice(0, 10); // YYYY-MM-DD

    const user = await User.findById(userId).lean();
    if (!user) throw new Error("User not found");

    // 1. Check for shift overrides first (highest priority)
    if (user.shiftOverrides) {
      let override = null;

      // Handle Map stored as plain object (MongoDB)
      if (typeof user.shiftOverrides === "object" && user.shiftOverrides[dateKey]) {
        override = user.shiftOverrides[dateKey];
      } else if (user.shiftOverrides.has && user.shiftOverrides.has(dateKey)) {
        override = user.shiftOverrides.get(dateKey);
      }

      if (override) {
        return {
          start: override.start || "00:00",
          end: override.end || "23:59",
          durationHours: override.durationHours || 9,
          isFlexible: override.type === "flexible",
          isFlexiblePermanent: false,
          source: "override",
          type: override.type,
          shiftName: override.name || "Override Shift",
          isOneDayFlexibleOverride: override.type === "flexible" && user.shiftType === "standard"
        };
      }
    }

    // 2. Check for FlexiblePermanent users
    if (user.shiftType === "flexiblePermanent") {
      return {
        start: "00:00",
        end: "23:59",
        durationHours: 9,
        isFlexible: true,
        isFlexiblePermanent: true,
        source: "flexiblePermanent",
        type: "flexiblePermanent",
        shiftName: "Flexible Permanent",
      };
    }

    // 3. Check for approved flexible shift requests
    const flexibleRequest = await FlexibleShiftRequest.findOne({
      userId,
      date: { $gte: targetDate, $lt: new Date(targetDate.getTime() + 24 * 60 * 60 * 1000) },
      status: "approved",
    }).lean();

    if (flexibleRequest) {
      return {
        start: flexibleRequest.startTime,
        end: flexibleRequest.endTime,
        durationHours: flexibleRequest.duration || 9,
        isFlexible: true,
        isFlexiblePermanent: false,
        source: "flexibleRequest",
        type: "flexible",
        shiftName: "Flexible Shift",
      };
    }

    // 4. Use assigned shift or standard shift
    if (user.assignedShift) {
      return {
        start: user.assignedShift.start,
        end: user.assignedShift.end,
        durationHours: user.assignedShift.durationHours || 9,
        isFlexible: user.assignedShift.isFlexible || false,
        isFlexiblePermanent: false,
        source: "assignedShift",
        type: "standard",
        shiftName: user.assignedShift.name || "Assigned Shift",
      };
    }

    // 5. Use standard shift type
    const standardShift = user.standardShiftType ? STANDARD_SHIFTS[user.standardShiftType.toUpperCase()] : null;
    if (standardShift) {
      return {
        ...standardShift,
        isFlexible: false,
        isFlexiblePermanent: false,
        source: "standard",
        type: "standard",
        shiftName: standardShift.name,
      };
    }

    // 6. Default fallback
    return {
      ...STANDARD_SHIFTS.MORNING,
      isFlexible: false,
      isFlexiblePermanent: false,
      source: "default",
      type: "standard",
      shiftName: "Default Morning Shift",
    };

  } catch (error) {
    console.error("Error getting effective shift:", error);
    // Return safe default
    return {
      ...STANDARD_SHIFTS.MORNING,
      isFlexible: false,
      isFlexiblePermanent: false,
      source: "error_default",
      type: "standard",
      shiftName: "Error Default Shift",
    };
  }
}

/**
 * Calculate work duration from sessions with comprehensive validation
 * This is the single source of truth for work duration calculation
 */
function calculateWorkDurationFromSessions(sessions = [], currentlyWorking = false, referenceDate = null) {
  if (!Array.isArray(sessions)) return 0;

  const today = referenceDate ? new Date(referenceDate) : new Date();
  today.setHours(0, 0, 0, 0);
  const todayEnd = new Date(today);
  todayEnd.setDate(today.getDate() + 1);

  // Filter sessions for the target date only
  const todaySessions = sessions.filter(session => {
    if (!session || !session.start) return false;

    const sessionStart = new Date(session.start);
    if (sessionStart < today || sessionStart >= todayEnd) {
      return false;
    }

    return true;
  });

  // Deduplicate sessions by start-end key
  const uniqueSessions = [];
  const sessionMap = new Map();

  todaySessions.forEach(session => {
    const key = `${session.start}-${session.end || 'ongoing'}`;
    if (!sessionMap.has(key)) {
      sessionMap.set(key, session);
      uniqueSessions.push(session);
    }
  });

  let totalSeconds = 0;

  for (const session of uniqueSessions) {
    if (!session.start) continue;

    const startTime = new Date(session.start);
    let endTime;

    if (session.end) {
      endTime = new Date(session.end);
    } else if (currentlyWorking) {
      endTime = new Date(); // Use current time for ongoing sessions
    } else {
      continue; // Skip sessions without end time if not currently working
    }

    // Validate session times
    if (startTime >= endTime) {
      console.warn(`Invalid session: start time >= end time`, {
        start: session.start,
        end: session.end
      });
      continue;
    }

    const sessionDuration = (endTime - startTime) / 1000; // Convert to seconds

    // Cap session duration at reasonable maximum
    const maxSessionSeconds = ATTENDANCE_CONSTANTS.MAX_SESSION_DURATION_HOURS * 3600;
    const cappedDuration = Math.min(sessionDuration, maxSessionSeconds);

    if (sessionDuration !== cappedDuration) {
      console.warn(`Session duration capped from ${sessionDuration} to ${cappedDuration} seconds`);
    }

    totalSeconds += cappedDuration;
  }

  // Cap total at maximum daily work hours
  const maxDailySeconds = ATTENDANCE_CONSTANTS.MAX_DAILY_WORK_HOURS * 3600;
  const finalTotal = Math.min(Math.floor(totalSeconds), maxDailySeconds);

  if (totalSeconds !== finalTotal) {
    console.warn(`Total work duration capped from ${totalSeconds} to ${finalTotal} seconds`);
  }

  return finalTotal;
}

/**
 * Calculate break duration from sessions with comprehensive validation
 */
function calculateBreakDurationFromSessions(sessions = [], onBreak = false, referenceDate = null) {
  if (!Array.isArray(sessions)) return 0;

  const today = referenceDate ? new Date(referenceDate) : new Date();
  today.setHours(0, 0, 0, 0);
  const todayEnd = new Date(today);
  todayEnd.setDate(today.getDate() + 1);

  // Filter break sessions for the target date only
  const todayBreaks = sessions.filter(breakSession => {
    if (!breakSession || !breakSession.start) return false;

    const breakStart = new Date(breakSession.start);
    if (breakStart < today || breakStart >= todayEnd) {
      return false;
    }

    return true;
  });

  let totalBreakSeconds = 0;

  for (const breakSession of todayBreaks) {
    if (!breakSession.start) continue;

    const startTime = new Date(breakSession.start);
    let endTime;

    if (breakSession.end) {
      endTime = new Date(breakSession.end);
    } else if (onBreak) {
      endTime = new Date(); // Use current time for ongoing breaks
    } else {
      continue; // Skip breaks without end time if not currently on break
    }

    // Validate break times
    if (startTime >= endTime) {
      console.warn(`Invalid break session: start time >= end time`, {
        start: breakSession.start,
        end: breakSession.end
      });
      continue;
    }

    const breakDuration = (endTime - startTime) / 1000; // Convert to seconds

    // Cap individual break duration at reasonable maximum (4 hours)
    const maxBreakSeconds = 4 * 3600;
    const cappedDuration = Math.min(breakDuration, maxBreakSeconds);

    if (breakDuration !== cappedDuration) {
      console.warn(`Break duration capped from ${breakDuration} to ${cappedDuration} seconds`);
    }

    totalBreakSeconds += cappedDuration;
  }

  return Math.floor(totalBreakSeconds);
}

/**
 * Calculate comprehensive attendance status using timeline as source of truth
 */
function calculateAttendanceStatusFromTimeline(timeline = [], shift, workDurationSeconds = 0) {
  if (!Array.isArray(timeline) || timeline.length === 0) {
    return {
      isAbsent: true,
      isLate: false,
      isHalfDay: false,
      arrivalTime: null,
      departureTime: null,
    };
  }

  // Sort timeline events by time
  const sortedEvents = timeline
    .filter(validateTimelineEvent)
    .sort((a, b) => new Date(a.time) - new Date(b.time));

  if (sortedEvents.length === 0) {
    return {
      isAbsent: true,
      isLate: false,
      isHalfDay: false,
      arrivalTime: null,
      departureTime: null,
    };
  }

  // Find first punch in and last punch out
  const firstPunchIn = sortedEvents.find(e =>
    e.type.toLowerCase().includes('punch in')
  );

  const lastPunchOut = sortedEvents
    .slice()
    .reverse()
    .find(e => e.type.toLowerCase().includes('punch out'));

  if (!firstPunchIn) {
    return {
      isAbsent: true,
      isLate: false,
      isHalfDay: false,
      arrivalTime: null,
      departureTime: null,
    };
  }

  const arrivalTime = new Date(firstPunchIn.time);
  const departureTime = lastPunchOut ? new Date(lastPunchOut.time) : null;

  // Calculate lateness - applies to all shift types
  // No grace period - any lateness counts as late
  let isLate = false;
  if (shift && shift.start && arrivalTime) {
    const [shiftHour, shiftMinute] = shift.start.split(':').map(Number);
    const expectedStart = new Date(arrivalTime);
    expectedStart.setHours(shiftHour, shiftMinute, 0, 0);

    // Employee is late if arrival time is after shift start (no grace period)
    isLate = arrivalTime > expectedStart;

    console.log('🕐 unifiedAttendanceService - Late Calculation:', {
      userId,
      arrivalTime: arrivalTime.toISOString(),
      shiftStart: shift.start,
      expectedStartCalculated: expectedStart.toISOString(),
      isLate,
      minutesLate: Math.round((arrivalTime - expectedStart) / 60000)
    });
  }

  // Determine if half day or full day based on work hours
  const workHours = workDurationSeconds / 3600;
  let isHalfDay = false;

  if (shift && shift.isFlexible) {
    // For flexible shifts, use total hours (work + break might be considered)
    isHalfDay = workHours >= ATTENDANCE_CONSTANTS.FLEXIBLE_MIN_HALF_DAY_TOTAL_HOURS &&
                workHours < ATTENDANCE_CONSTANTS.FLEXIBLE_MIN_FULL_DAY_TOTAL_HOURS;
  } else {
    // For standard shifts, use work hours only
    isHalfDay = workHours >= ATTENDANCE_CONSTANTS.MIN_HALF_DAY_WORK_HOURS &&
                workHours < ATTENDANCE_CONSTANTS.MIN_FULL_DAY_WORK_HOURS;
  }

  return {
    isAbsent: false,
    isLate,
    isHalfDay,
    arrivalTime,
    departureTime,
  };
}

/**
 * Validate punch in time against shift rules
 */
function validatePunchInTime(punchTime, shift, userTimeZone = "UTC") {
  try {
    const now = new Date(punchTime);

    if (!shift || shift.isFlexible) {
      return { isValid: true }; // Flexible shifts allow any time
    }

    if (!shift.start) {
      return { isValid: true }; // No start time restriction
    }

    // Allow punch in at any time - no early restriction
    return { isValid: true };

  } catch (error) {
    console.error("Error validating punch in time:", error);
    return { isValid: true }; // Fail open for availability
  }
}

/**
 * Get comprehensive attendance data using unified calculations
 * This replaces multiple scattered calculation methods
 */
async function getUnifiedAttendanceData(userId, date = null) {
  try {
    const targetDate = date ? new Date(date) : new Date();
    targetDate.setHours(0, 0, 0, 0);

    // Fetch UserStatus for the date
    const userStatus = await UserStatus.findOne({
      userId,
      today: targetDate
    }).lean();

    if (!userStatus) {
      return {
        isAbsent: true,
        isLate: false,
        isHalfDay: false,
        workDurationSeconds: 0,
        breakDurationSeconds: 0,
        arrivalTime: null,
        departureTime: null,
        effectiveShift: await getEffectiveShift(userId, targetDate),
        timeline: [],
        workedSessions: [],
        breakSessions: [],
      };
    }

    // Get effective shift
    const effectiveShift = await getEffectiveShift(userId, targetDate);

    // Calculate durations using unified methods
    const workDurationSeconds = calculateWorkDurationFromSessions(
      userStatus.workedSessions,
      userStatus.currentlyWorking,
      targetDate
    );

    const breakDurationSeconds = calculateBreakDurationFromSessions(
      userStatus.breakSessions,
      userStatus.onBreak,
      targetDate
    );

    // Calculate attendance status from timeline
    const attendanceStatus = calculateAttendanceStatusFromTimeline(
      userStatus.timeline,
      effectiveShift,
      workDurationSeconds
    );

    // Check for leave information
    const leaveInfo = await checkLeaveStatus(userId, targetDate);

    return {
      ...attendanceStatus,
      workDurationSeconds,
      breakDurationSeconds,
      effectiveShift,
      timeline: userStatus.timeline || [],
      workedSessions: userStatus.workedSessions || [],
      breakSessions: userStatus.breakSessions || [],
      currentlyWorking: userStatus.currentlyWorking || false,
      onBreak: userStatus.onBreak || false,
      leaveInfo,
      isWFH: leaveInfo && leaveInfo.type === 'workFromHome',
    };

  } catch (error) {
    console.error("Error getting unified attendance data:", error);
    throw error;
  }
}

/**
 * Check if user is on approved leave for the date
 */
async function checkLeaveStatus(userId, date) {
  try {
    const targetDate = new Date(date);
    targetDate.setHours(0, 0, 0, 0);
    const nextDay = new Date(targetDate);
    nextDay.setDate(nextDay.getDate() + 1);

    const leave = await LeaveRequest.findOne({
      "employee._id": userId,
      status: "Approved",
      "period.start": { $lte: nextDay },
      "period.end": { $gte: targetDate }
    }).lean();

    if (leave) {
      return {
        type: leave.type,
        reason: leave.reason,
        startDate: leave.period.start,
        endDate: leave.period.end,
      };
    }

    return null;
  } catch (error) {
    console.error("Error checking leave status:", error);
    return null;
  }
}

/**
 * DEPRECATED: syncToDailyWorkSafely function removed
 * DailyWork model has been replaced with AttendanceRecord system
 * Use AttendanceService.recordPunchEvent() instead
 */
// Function removed - functionality moved to new AttendanceRecord system

/**
 * Format seconds to human readable format
 */
function formatDuration(seconds) {
  if (!seconds || seconds < 0) return "0h 0m";

  const hours = Math.floor(seconds / 3600);
  const minutes = Math.floor((seconds % 3600) / 60);

  return `${hours}h ${minutes}m`;
}

/**
 * Convert seconds to decimal hours
 */
function secondsToHours(seconds) {
  if (!seconds || seconds < 0) return 0;
  return Math.round((seconds / 3600) * 100) / 100;
}

module.exports = {
  // Core functions
  getEffectiveShift,
  getUnifiedAttendanceData,

  // Calculation functions
  calculateWorkDurationFromSessions,
  calculateBreakDurationFromSessions,
  calculateAttendanceStatusFromTimeline,

  // Validation functions
  validateTimelineEvent,
  validatePunchInTime,

  // Sync functions
  // syncToDailyWorkSafely, // REMOVED - functionality moved to AttendanceRecord system
  checkLeaveStatus,

  // Utility functions
  formatDuration,
  secondsToHours,

  // Constants
  ATTENDANCE_CONSTANTS,
  EVENT_TYPES,
  STANDARD_SHIFTS,
};