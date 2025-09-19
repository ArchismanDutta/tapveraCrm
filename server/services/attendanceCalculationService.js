// services/attendanceCalculationService.js
const User = require("../models/User");
const FlexibleShiftRequest = require("../models/FlexibleShiftRequest");

// Constants for attendance rules
const ATTENDANCE_RULES = {
  // Standard rules for work hours (not including break)
  MIN_HALF_DAY_WORK_HOURS: 5,
  MIN_FULL_DAY_WORK_HOURS: 8,

  // FlexiblePermanent rules (total hours including break)
  FLEXIBLE_MIN_HALF_DAY_TOTAL_HOURS: 5,
  FLEXIBLE_MIN_FULL_DAY_TOTAL_HOURS: 9, // 8 work + 1 break

  // Early punch allowance (minutes before shift start)
  EARLY_PUNCH_ALLOWANCE_MINUTES: 120
};

// Standard shift definitions
const STANDARD_SHIFTS = {
  MORNING: { name: "Day Shift (Morning Shift)", start: "09:00", end: "18:00", durationHours: 9 },
  EVENING: { name: "Evening Shift", start: "13:00", end: "22:00", durationHours: 9 },
  NIGHT: { name: "Night Shift", start: "20:00", end: "05:00", durationHours: 9 },
  EARLY: { name: "Early Morning Shift", start: "05:30", end: "14:30", durationHours: 9 }
};

/**
 * Get the effective shift for a user on a specific date
 * Priority: Override > FlexiblePermanent > FlexibleRequest > Standard
 */
async function getEffectiveShift(userId, date) {
  try {
    const targetDate = new Date(date);
    targetDate.setHours(0, 0, 0, 0);
    const dateKey = targetDate.toISOString().slice(0, 10); // YYYY-MM-DD

    const user = await User.findById(userId).lean();
    if (!user) throw new Error("User not found");

    // 1. Check for shift overrides first (highest priority)
    if (user.shiftOverrides && user.shiftOverrides.has && user.shiftOverrides.has(dateKey)) {
      const override = user.shiftOverrides.get(dateKey);
      return {
        start: override.start,
        end: override.end,
        durationHours: override.durationHours,
        isFlexible: override.type === "flexible",
        isFlexiblePermanent: false,
        source: "override",
        type: override.type,
        shiftName: override.name || "Override Shift",
        isOneDayFlexibleOverride: override.type === "flexible" && user.shiftType === "standard"
      };
    }

    // Handle Map stored as plain object (common with MongoDB)
    if (user.shiftOverrides && typeof user.shiftOverrides === "object" && user.shiftOverrides[dateKey]) {
      const override = user.shiftOverrides[dateKey];
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

    // 2. Check if user has flexible permanent shift
    if (user.shiftType === "flexiblePermanent") {
      return {
        start: "00:00",
        end: "23:59",
        durationHours: 9,
        isFlexible: true,
        isFlexiblePermanent: true,
        source: "flexiblePermanent",
        type: "flexiblePermanent",
        shiftName: "FlexiblePermanent Shift",
        isOneDayFlexibleOverride: false
      };
    }

    // 3. Check for approved flexible shift requests for this date (one-day flexible)
    const flexRequest = await FlexibleShiftRequest.findOne({
      employee: userId,
      requestedDate: targetDate,
      status: "approved",
    }).lean();

    if (flexRequest) {
      const duration = flexRequest.durationHours || 9;
      const [startH, startM] = flexRequest.requestedStartTime.split(":").map(Number);

      // Calculate end time
      let endH = startH + Math.floor(duration);
      let endM = startM + Math.round((duration % 1) * 60);

      if (endM >= 60) {
        endH += Math.floor(endM / 60);
        endM = endM % 60;
      }

      if (endH >= 24) {
        endH = endH % 24;
      }

      const endTime = `${String(endH).padStart(2, "0")}:${String(endM).padStart(2, "0")}`;

      return {
        start: flexRequest.requestedStartTime,
        end: endTime,
        durationHours: duration,
        isFlexible: true,
        isFlexiblePermanent: false,
        source: "flexibleRequest",
        type: "flexible",
        shiftName: "Flexible Request",
        isOneDayFlexibleOverride: true // This is a one-day flexible for standard employee
      };
    }

    // 4. Default to user's standard shift
    if (user.shiftType === "standard") {
      // Use the standardShiftType to get predefined shift
      if (user.standardShiftType && STANDARD_SHIFTS[user.standardShiftType.toUpperCase()]) {
        const standardShift = STANDARD_SHIFTS[user.standardShiftType.toUpperCase()];
        return {
          start: standardShift.start,
          end: standardShift.end,
          durationHours: standardShift.durationHours,
          isFlexible: false,
          isFlexiblePermanent: false,
          source: "standard",
          type: "standard",
          shiftName: standardShift.name,
          isOneDayFlexibleOverride: false
        };
      }

      // Fallback to user.shift if standardShiftType is not set
      if (user.shift) {
        return {
          start: user.shift.start,
          end: user.shift.end,
          durationHours: user.shift.durationHours || 9,
          isFlexible: false,
          isFlexiblePermanent: false,
          source: "standard_fallback",
          type: "standard",
          shiftName: user.shift.name || "Standard Shift",
          isOneDayFlexibleOverride: false
        };
      }
    }

    // 5. Ultimate fallback
    return {
      start: "09:00",
      end: "18:00",
      durationHours: 9,
      isFlexible: false,
      isFlexiblePermanent: false,
      source: "default",
      type: "standard",
      shiftName: "Default Shift",
      isOneDayFlexibleOverride: false
    };
  } catch (error) {
    console.error("Error in getEffectiveShift:", error);
    return null;
  }
}

/**
 * Calculate early/late arrival for standard shifts
 */
function calculateEarlyLateArrival(arrivalTime, shiftStartTime, userTimeZone = "UTC") {
  if (!arrivalTime || !shiftStartTime) {
    return { isEarly: false, isLate: false, minutesDifference: 0 };
  }

  try {
    // Parse shift start time
    const [hours, minutes] = shiftStartTime.split(":").map(Number);

    // Create shift start time for the same date as arrival
    const arrivalDate = new Date(arrivalTime);
    const shiftStart = new Date(arrivalDate);
    shiftStart.setUTCHours(hours, minutes, 0, 0);

    // Handle night shift (crosses midnight)
    if (hours < 6 && arrivalDate.getUTCHours() >= 18) {
      // If shift starts early morning (like 5:30 AM) but arrival is in evening, add a day to shift start
      shiftStart.setUTCDate(shiftStart.getUTCDate() + 1);
    } else if (hours >= 20 && arrivalDate.getUTCHours() < 12) {
      // If shift starts at night (like 8:00 PM) but arrival is in morning, subtract a day from shift start
      shiftStart.setUTCDate(shiftStart.getUTCDate() - 1);
    }

    const diffMinutes = Math.floor((arrivalDate - shiftStart) / (1000 * 60));

    return {
      isEarly: diffMinutes < -ATTENDANCE_RULES.EARLY_PUNCH_ALLOWANCE_MINUTES ? false : diffMinutes < 0,
      isLate: diffMinutes > 0,
      minutesDifference: diffMinutes
    };
  } catch (error) {
    console.error("Error calculating early/late arrival:", error);
    return { isEarly: false, isLate: false, minutesDifference: 0 };
  }
}

/**
 * Calculate attendance status based on shift type and work hours
 */
function calculateAttendanceStatus(workDurationSeconds, breakDurationSeconds, effectiveShift) {
  const workHours = workDurationSeconds / 3600;
  const breakHours = breakDurationSeconds / 3600;
  const totalHours = workHours + breakHours;

  let attendanceStatus = {
    isFullDay: false,
    isHalfDay: false,
    isAbsent: false,
    workHours: workHours,
    breakHours: breakHours,
    totalHours: totalHours
  };

  if (effectiveShift?.isFlexiblePermanent || effectiveShift?.isOneDayFlexibleOverride) {
    // FlexiblePermanent or one-day flexible: Use total hours (work + break = 9 hours)
    if (totalHours >= ATTENDANCE_RULES.FLEXIBLE_MIN_FULL_DAY_TOTAL_HOURS) {
      attendanceStatus.isFullDay = true;
    } else if (totalHours >= ATTENDANCE_RULES.FLEXIBLE_MIN_HALF_DAY_TOTAL_HOURS) {
      attendanceStatus.isHalfDay = true;
    } else {
      attendanceStatus.isAbsent = true;
    }
  } else {
    // Standard shift: Use only work hours (8 hours work, break doesn't count toward attendance)
    if (workHours >= ATTENDANCE_RULES.MIN_FULL_DAY_WORK_HOURS) {
      attendanceStatus.isFullDay = true;
    } else if (workHours >= ATTENDANCE_RULES.MIN_HALF_DAY_WORK_HOURS) {
      attendanceStatus.isHalfDay = true;
    } else {
      attendanceStatus.isAbsent = true;
    }
  }

  return attendanceStatus;
}

/**
 * Validate punch in time against shift rules
 */
function validatePunchInTime(punchTime, effectiveShift, userTimeZone = "UTC") {
  // For flexible shifts, no time restrictions
  if (effectiveShift?.isFlexible || effectiveShift?.isFlexiblePermanent || effectiveShift?.isOneDayFlexibleOverride) {
    return { isValid: true, message: "Valid punch in for flexible shift" };
  }

  // For standard shifts, check early punch restriction
  if (effectiveShift?.start) {
    const [hours, minutes] = effectiveShift.start.split(":").map(Number);
    const punchDate = new Date(punchTime);
    const shiftStart = new Date(punchDate);
    shiftStart.setUTCHours(hours, minutes, 0, 0);

    const earliestAllowed = new Date(shiftStart);
    earliestAllowed.setUTCMinutes(earliestAllowed.getUTCMinutes() - ATTENDANCE_RULES.EARLY_PUNCH_ALLOWANCE_MINUTES);

    if (punchDate < earliestAllowed) {
      return {
        isValid: false,
        message: `Cannot punch in earlier than ${ATTENDANCE_RULES.EARLY_PUNCH_ALLOWANCE_MINUTES} minutes before shift start time (${effectiveShift.start})`
      };
    }
  }

  return { isValid: true, message: "Valid punch in time" };
}

/**
 * Get comprehensive attendance data for a user on a specific date
 */
async function getAttendanceData(userId, date, workedSessions = [], breakSessions = [], arrivalTime = null) {
  try {
    const effectiveShift = await getEffectiveShift(userId, date);

    if (!effectiveShift) {
      return {
        error: "No shift assigned for this date",
        effectiveShift: null,
        attendanceStatus: { isAbsent: true, isHalfDay: false, isFullDay: false }
      };
    }

    // Calculate work and break durations
    const now = new Date();
    let workDurationSeconds = 0;
    let breakDurationSeconds = 0;

    // Calculate work duration
    if (Array.isArray(workedSessions)) {
      workedSessions.forEach(session => {
        if (session.start) {
          const start = new Date(session.start);
          const end = session.end ? new Date(session.end) : now;
          workDurationSeconds += Math.max(0, Math.floor((end - start) / 1000));
        }
      });
    }

    // Calculate break duration
    if (Array.isArray(breakSessions)) {
      breakSessions.forEach(session => {
        if (session.start) {
          const start = new Date(session.start);
          const end = session.end ? new Date(session.end) : now;
          breakDurationSeconds += Math.max(0, Math.floor((end - start) / 1000));
        }
      });
    }

    // Calculate attendance status
    const attendanceStatus = calculateAttendanceStatus(workDurationSeconds, breakDurationSeconds, effectiveShift);

    // Calculate early/late arrival for standard shifts
    let earlyLateInfo = { isEarly: false, isLate: false, minutesDifference: 0 };
    if (!effectiveShift.isFlexible && !effectiveShift.isFlexiblePermanent && !effectiveShift.isOneDayFlexibleOverride) {
      earlyLateInfo = calculateEarlyLateArrival(arrivalTime, effectiveShift.start);
    }

    return {
      effectiveShift,
      attendanceStatus: {
        ...attendanceStatus,
        isLate: earlyLateInfo.isLate,
        isEarly: earlyLateInfo.isEarly,
        minutesDifference: earlyLateInfo.minutesDifference
      },
      workDurationSeconds,
      breakDurationSeconds,
      earlyLateInfo
    };
  } catch (error) {
    console.error("Error getting attendance data:", error);
    return {
      error: error.message,
      effectiveShift: null,
      attendanceStatus: { isAbsent: true, isHalfDay: false, isFullDay: false }
    };
  }
}

/**
 * Format duration in seconds to human readable format
 */
function formatDuration(seconds) {
  const hours = Math.floor(seconds / 3600);
  const minutes = Math.floor((seconds % 3600) / 60);
  const secs = seconds % 60;
  return `${hours}h ${minutes.toString().padStart(2, "0")}m ${secs.toString().padStart(2, "0")}s`;
}

/**
 * Format duration in seconds to hours and minutes only
 */
function formatDurationHM(seconds) {
  const hours = Math.floor(seconds / 3600);
  const minutes = Math.floor((seconds % 3600) / 60);
  return `${hours}h ${minutes.toString().padStart(2, "0")}m`;
}

module.exports = {
  getEffectiveShift,
  calculateEarlyLateArrival,
  calculateAttendanceStatus,
  validatePunchInTime,
  getAttendanceData,
  formatDuration,
  formatDurationHM,
  ATTENDANCE_RULES,
  STANDARD_SHIFTS
};