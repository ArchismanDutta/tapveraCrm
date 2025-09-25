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

/**
 * Standardized break time calculation from timeline events
 */
function calculateBreakTimeFromTimeline(timeline) {
  if (!Array.isArray(timeline) || timeline.length === 0) {
    return 0;
  }

  let totalBreakSeconds = 0;
  let currentBreakStart = null;

  // Sort timeline events by time
  const sortedEvents = timeline
    .filter(event => event.time && event.type)
    .sort((a, b) => new Date(a.time) - new Date(b.time));

  for (const event of sortedEvents) {
    const eventType = event.type.toLowerCase();
    const eventTime = new Date(event.time);

    if (eventType.includes('break start')) {
      currentBreakStart = eventTime;
    } else if ((eventType.includes('break end') || eventType.includes('resume work')) && currentBreakStart) {
      const breakDuration = (eventTime - currentBreakStart) / 1000; // in seconds
      totalBreakSeconds += breakDuration;
      currentBreakStart = null;
    }
  }

  return Math.round(totalBreakSeconds);
}

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
 * Calculate attendance status based on shift type, work hours, and leave status
 */
function calculateAttendanceStatus(workDurationSeconds, breakDurationSeconds, effectiveShift, leaveInfo = null) {
  const workHours = workDurationSeconds / 3600;
  const breakHours = breakDurationSeconds / 3600;
  const totalHours = workHours + breakHours;

  let attendanceStatus = {
    isFullDay: false,
    isHalfDay: false,
    isAbsent: false,
    isWFH: false,
    workHours: workHours,
    breakHours: breakHours,
    totalHours: totalHours,
    leaveType: null
  };

  // Handle WFH (Work From Home) approved leaves
  if (leaveInfo && leaveInfo.type === 'workFromHome' && leaveInfo.status === 'Approved') {
    attendanceStatus.isWFH = true;
    attendanceStatus.leaveType = 'workFromHome';

    // For WFH, assume full day unless explicitly marked as half day
    if (leaveInfo.type === 'halfDay' || (workHours > 0 && workHours < ATTENDANCE_RULES.MIN_FULL_DAY_WORK_HOURS)) {
      attendanceStatus.isHalfDay = true;
    } else {
      // WFH is considered a full working day regardless of logged hours
      attendanceStatus.isFullDay = true;
    }
    return attendanceStatus;
  }

  // Handle Half Day approved leaves
  if (leaveInfo && leaveInfo.type === 'halfDay' && leaveInfo.status === 'Approved') {
    attendanceStatus.leaveType = 'halfDay';

    // For approved half day leaves, check if they also worked
    if (workHours > 0) {
      // If they worked during half day leave, it's still a half day but counts as present
      attendanceStatus.isHalfDay = true;
    } else {
      // Half day leave with no work logged
      attendanceStatus.isHalfDay = true;
    }
    return attendanceStatus;
  }

  // Handle other approved leaves (sick, paid, unpaid, maternity)
  if (leaveInfo && ['sick', 'paid', 'unpaid', 'maternity'].includes(leaveInfo.type) && leaveInfo.status === 'Approved') {
    attendanceStatus.leaveType = leaveInfo.type;
    // These are considered absent for attendance calculation but are approved absences
    attendanceStatus.isAbsent = true;
    return attendanceStatus;
  }

  // Standard attendance calculation for regular working days
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

    // Create shift start time for the same date as punch time
    const shiftStart = new Date(punchDate);
    // Use local time methods instead of UTC since shift times are typically in local time
    shiftStart.setHours(hours, minutes, 0, 0);

    const earliestAllowed = new Date(shiftStart);
    earliestAllowed.setMinutes(earliestAllowed.getMinutes() - ATTENDANCE_RULES.EARLY_PUNCH_ALLOWANCE_MINUTES);

    console.log('Punch validation debug:', {
      punchTime: punchDate.toISOString(),
      shiftStart: shiftStart.toISOString(),
      earliestAllowed: earliestAllowed.toISOString(),
      shiftStartTime: effectiveShift.start,
      isEarlierThanAllowed: punchDate < earliestAllowed
    });

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
async function getAttendanceData(userId, date, workedSessions = [], breakSessions = [], arrivalTime = null, leaveInfo = null) {
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

    // Calculate work duration with validation - FILTER BY TARGET DATE
    // Extract date string to avoid timezone conversion issues
    const targetDateStr = typeof date === 'string' && date.includes('T') ?
      date.split('T')[0] :
      new Date(date).toISOString().split('T')[0];

    console.log(`🔍 Filtering sessions for target date: ${targetDateStr} (input: ${date})`);

    if (Array.isArray(workedSessions)) {
      // Filter sessions to only include those for the target date using string comparison
      const targetDateSessions = workedSessions.filter(session => {
        if (!session || !session.start) return false;

        // Extract session date string safely
        const sessionDateStr = typeof session.start === 'string' && session.start.includes('T') ?
          session.start.split('T')[0] :
          new Date(session.start).toISOString().split('T')[0];

        const matches = sessionDateStr === targetDateStr;

        if (!matches) {
          console.log(`⏭️ Filtering out session from different date: ${sessionDateStr} != ${targetDateStr}`);
        }

        return matches;
      });

      console.log(`📅 Processing ${targetDateSessions.length} work sessions for ${date} (filtered from ${workedSessions.length} total)`);

      targetDateSessions.forEach(session => {
        if (session.start) {
          const start = new Date(session.start);

          let end;
          if (session.end) {
            end = new Date(session.end);
          } else {
            // For current day, use current time. For past days, there's likely a data issue
            const today = new Date();
            today.setHours(0, 0, 0, 0);

            const targetDate = new Date(date);
            targetDate.setHours(0, 0, 0, 0);

            if (targetDate.getTime() === today.getTime()) {
              // Current day - use current time
              end = now;
            } else {
              // Past day with no end time - likely data corruption, skip or cap at reasonable hours
              console.warn(`⚠️ Work session without end time found for past date ${date}:`, {
                sessionStart: session.start,
                userId
              });
              // Assume 8 hour work day as fallback
              end = new Date(start.getTime() + (8 * 60 * 60 * 1000));
            }
          }

          const durationSeconds = Math.max(0, Math.floor((end - start) / 1000));

          // Cap at 24 hours (86400 seconds) to prevent unrealistic values
          if (durationSeconds > 86400) {
            console.warn(`⚠️ Work session exceeds 24 hours, capping duration:`, {
              originalSeconds: durationSeconds,
              cappedSeconds: 86400,
              sessionStart: session.start,
              sessionEnd: session.end,
              userId,
              date
            });
            workDurationSeconds += 86400;
          } else {
            workDurationSeconds += durationSeconds;
          }
        }
      });
    }

    // Calculate break duration - FILTER BY TARGET DATE
    if (Array.isArray(breakSessions)) {
      // Filter break sessions to only include those for the target date using string comparison
      const targetDateBreakSessions = breakSessions.filter(session => {
        if (!session || !session.start) return false;

        // Extract session date string safely
        const sessionDateStr = typeof session.start === 'string' && session.start.includes('T') ?
          session.start.split('T')[0] :
          new Date(session.start).toISOString().split('T')[0];

        const matches = sessionDateStr === targetDateStr;

        if (!matches) {
          console.log(`⏭️ Filtering out break session from different date: ${sessionDateStr} != ${targetDateStr}`);
        }

        return matches;
      });

      console.log(`📅 Processing ${targetDateBreakSessions.length} break sessions for ${date} (filtered from ${breakSessions.length} total)`);

      targetDateBreakSessions.forEach(session => {
        if (session.start) {
          const start = new Date(session.start);
          let end;

          if (session.end) {
            end = new Date(session.end);
          } else {
            // Handle ongoing break sessions
            const today = new Date();
            today.setHours(0, 0, 0, 0);

            const targetDate = new Date(date);
            targetDate.setHours(0, 0, 0, 0);

            if (targetDate.getTime() === today.getTime()) {
              // Current day - use current time
              end = now;
            } else {
              // Past day with no end time - assume short break
              console.warn(`⚠️ Break session without end time found for past date ${date}:`, {
                sessionStart: session.start,
                userId
              });
              end = new Date(start.getTime() + (30 * 60 * 1000)); // 30 min default
            }
          }

          const breakDuration = Math.max(0, Math.floor((end - start) / 1000));

          // Cap break duration at 4 hours to prevent corruption
          if (breakDuration > 14400) {
            console.warn(`⚠️ Break session exceeds 4 hours, capping:`, {
              originalSeconds: breakDuration,
              cappedSeconds: 14400,
              sessionStart: session.start,
              sessionEnd: session.end,
              userId,
              date
            });
            breakDurationSeconds += 14400;
          } else {
            breakDurationSeconds += breakDuration;
          }
        }
      });
    }

    // Final validation: cap durations to prevent any corruption from being returned
    const maxDailyWorkSeconds = 86400; // 24 hours
    const maxDailyBreakSeconds = 14400; // 4 hours

    if (workDurationSeconds > maxDailyWorkSeconds) {
      console.warn(`⚠️ Final capping: Work duration exceeds 24 hours for ${date}:`, {
        originalWorkSeconds: workDurationSeconds,
        cappedWorkSeconds: maxDailyWorkSeconds,
        userId
      });
      workDurationSeconds = maxDailyWorkSeconds;
    }

    if (breakDurationSeconds > maxDailyBreakSeconds) {
      console.warn(`⚠️ Final capping: Break duration exceeds 4 hours for ${date}:`, {
        originalBreakSeconds: breakDurationSeconds,
        cappedBreakSeconds: maxDailyBreakSeconds,
        userId
      });
      breakDurationSeconds = maxDailyBreakSeconds;
    }

    // Calculate attendance status including leave information
    const attendanceStatus = calculateAttendanceStatus(workDurationSeconds, breakDurationSeconds, effectiveShift, leaveInfo);

    // Calculate early/late arrival for standard shifts
    let earlyLateInfo = { isEarly: false, isLate: false, minutesDifference: 0 };
    if (!effectiveShift.isFlexible && !effectiveShift.isFlexiblePermanent && !effectiveShift.isOneDayFlexibleOverride) {
      earlyLateInfo = calculateEarlyLateArrival(arrivalTime, effectiveShift.start);
    }

    console.log(`✅ Attendance calculated for ${date}: ${(workDurationSeconds/3600).toFixed(1)}h work, ${(breakDurationSeconds/3600).toFixed(1)}h break`);

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