// controllers/statusController.js
// Replaced date-fns-tz with native Intl-based TZ conversion helpers
const UserStatus = require("../models/UserStatus");
const DailyWork = require("../models/DailyWork");
const User = require("../models/User");
const FlexibleShiftRequest = require("../models/FlexibleShiftRequest");
const attendanceService = require("../services/attendanceCalculationService");

// -----------------------
// Constants
// -----------------------
const EARLY_PUNCH_MINUTES = 120; // allow punch-in up to 120 min before shift start
const MIN_HALF_DAY_SECONDS = 5 * 3600; // 5 hours
const MIN_FULL_DAY_SECONDS = 8 * 3600; // 8 hours

// Event types constants for consistency
const EVENT_TYPES = {
  PUNCH_IN: "Punch In",
  PUNCH_OUT: "Punch Out",
  BREAK_START: "Break Start",
  RESUME_WORK: "Resume Work",
};

// -----------------------
// Standard shift definitions
// -----------------------
const STANDARD_SHIFTS = {
  MORNING: { name: "Morning", start: "09:00", end: "18:00", durationHours: 9 },
  EVENING: { name: "Evening", start: "13:00", end: "22:00", durationHours: 9 },
  NIGHT: { name: "Night", start: "20:00", end: "05:00", durationHours: 9 },
  EARLY: { name: "Early", start: "05:30", end: "14:20", durationHours: 8.83 },
};

// -----------------------
// Native timezone conversion helpers
// -----------------------
function formatPartsFor(date, timeZone) {
  const dtf = new Intl.DateTimeFormat("en-US", {
    hour12: false,
    timeZone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
  });
  const parts = dtf.formatToParts(date);
  const map = {};
  parts.forEach(({ type, value }) => {
    map[type] = value;
  });
  return map;
}

function getTimeZoneOffsetMilliseconds(date, timeZone) {
  const dtfUTC = new Intl.DateTimeFormat("en-US", {
    timeZone: "UTC",
    hour12: false,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
  });
  const dtfTZ = new Intl.DateTimeFormat("en-US", {
    timeZone,
    hour12: false,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
  });

  const partsUTC = dtfUTC.formatToParts(date);
  const partsTZ = dtfTZ.formatToParts(date);

  function partsToDate(parts) {
    const map = {};
    parts.forEach(({ type, value }) => {
      map[type] = value;
    });
    return new Date(
      `${map.year}-${map.month}-${map.day}T${map.hour}:${map.minute}:${map.second}Z`
    );
  }

  const dateUTC = partsToDate(partsUTC);
  const dateTZ = partsToDate(partsTZ);

  return dateTZ.getTime() - dateUTC.getTime();
}

/**
 * Convert a local date in a specific timezone to UTC
 */
function zonedTimeToUtc(date, timeZone) {
  const localParts = formatPartsFor(date, timeZone);

  // Create UTC date from the local parts
  const utcDate = new Date(
    Date.UTC(
      parseInt(localParts.year),
      parseInt(localParts.month) - 1, // Month is 0-indexed
      parseInt(localParts.day),
      parseInt(localParts.hour),
      parseInt(localParts.minute),
      parseInt(localParts.second)
    )
  );

  return utcDate;
}

/**
 * Convert a UTC date to a local date in a specific timezone
 */
function utcToZonedTime(utcDate, timeZone) {
  const offsetMs = getTimeZoneOffsetMilliseconds(utcDate, timeZone);
  return new Date(utcDate.getTime() + offsetMs);
}

// -----------------------
// Utility functions
// -----------------------
function ymdKey(date) {
  const d = new Date(date);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(
    2,
    "0"
  )}-${String(d.getDate()).padStart(2, "0")}`;
}

function getWorkDurationSeconds(workedSessions, currentlyWorking) {
  if (!Array.isArray(workedSessions)) return 0;

  let total = workedSessions.reduce((sum, s) => {
    if (s && s.start && s.end)
      return (
        sum + (new Date(s.end).getTime() - new Date(s.start).getTime()) / 1000
      );
    return sum;
  }, 0);

  if (currentlyWorking && workedSessions.length) {
    const last = workedSessions[workedSessions.length - 1];
    if (last && last.start && !last.end) {
      total += (Date.now() - new Date(last.start).getTime()) / 1000;
    }
  }

  return Math.floor(total);
}

function getBreakDurationSeconds(breakSessions, onBreak, breakStart) {
  if (!Array.isArray(breakSessions)) return 0;

  let total = breakSessions.reduce((sum, s) => {
    if (s && s.start && s.end)
      return (
        sum + (new Date(s.end).getTime() - new Date(s.start).getTime()) / 1000
      );
    return sum;
  }, 0);

  if (onBreak) {
    const last = breakSessions.length
      ? breakSessions[breakSessions.length - 1]
      : null;
    if (last && last.start && !last.end) {
      total += (Date.now() - new Date(last.start).getTime()) / 1000;
    } else if (breakStart) {
      total += (Date.now() - new Date(breakStart).getTime()) / 1000;
    }
  }

  return Math.floor(total);
}

function secToHMS(sec) {
  const h = Math.floor(sec / 3600);
  const m = Math.floor((sec % 3600) / 60);
  const s = sec % 60;
  return `${h}h ${m.toString().padStart(2, "0")}m ${s
    .toString()
    .padStart(2, "0")}s`;
}

function secToHM(sec) {
  const h = Math.floor(sec / 3600);
  const m = Math.floor((sec % 3600) / 60);
  return `${h}h ${m.toString().padStart(2, "0")}m`;
}

// -----------------------
// Enhanced Timeline helper functions with better validation
// -----------------------
function validateTimelineEvent(event) {
  if (!event || typeof event !== "object") {
    console.warn("Invalid timeline event structure:", event);
    return false;
  }
  if (!event.type || typeof event.type !== "string") {
    console.warn("Missing or invalid event type:", event);
    return false;
  }
  if (!event.time) {
    console.warn("Missing event time:", event);
    return false;
  }

  const timeDate = new Date(event.time);
  if (isNaN(timeDate.getTime())) {
    console.warn("Invalid event time:", event.time);
    return false;
  }

  return true;
}

function getFirstPunchInTime(timeline = []) {
  if (!Array.isArray(timeline)) return null;
  const punchIn = timeline.find(
    (ev) =>
      validateTimelineEvent(ev) &&
      typeof ev.type === "string" &&
      ev.type.toLowerCase().includes("punch in")
  );
  return punchIn ? punchIn.time : null;
}

function getLastPunchOutTime(timeline = []) {
  if (!Array.isArray(timeline)) return null;
  const punchOuts = timeline.filter(
    (ev) =>
      validateTimelineEvent(ev) &&
      typeof ev.type === "string" &&
      ev.type.toLowerCase().includes("punch out")
  );
  return punchOuts.length ? punchOuts[punchOuts.length - 1].time : null;
}

function hasEventTypeToday(timeline = [], eventType) {
  if (!Array.isArray(timeline)) return false;
  const today = new Date().toISOString().slice(0, 10);

  return timeline.some((ev) => {
    if (!validateTimelineEvent(ev)) return false;

    try {
      const eventDate = new Date(ev.time).toISOString().slice(0, 10);
      const matchesDate = eventDate === today;

      // More robust type matching
      const normalizedEventType = ev.type.toLowerCase().trim();
      const normalizedTargetType = eventType.toLowerCase().trim();

      const matchesType = normalizedEventType.includes(normalizedTargetType);

      return matchesDate && matchesType;
    } catch (error) {
      console.error("Error checking timeline event:", error, ev);
      return false;
    }
  });
}

function getTodayTimeline(timeline = []) {
  if (!Array.isArray(timeline)) return [];
  const today = new Date().toISOString().slice(0, 10);

  return timeline.filter((ev) => {
    if (!validateTimelineEvent(ev)) return false;

    try {
      const eventDate = new Date(ev.time).toISOString().slice(0, 10);
      return eventDate === today;
    } catch (error) {
      console.error("Error filtering timeline for today:", error, ev);
      return false;
    }
  });
}

// -----------------------
// Late/half-day/absent calculation (DEPRECATED - Use attendanceService instead)
// -----------------------
function calculateLateAndHalfDay(
  workedSecs,
  shiftStartTime,
  arrivalTimeUTC,
  userTimeZone = "UTC"
) {
  // This function is deprecated. Use attendanceService.calculateAttendanceStatus instead
  console.warn("calculateLateAndHalfDay is deprecated. Use attendanceService.calculateAttendanceStatus instead");

  const result = { isLate: false, isHalfDay: false, isAbsent: false };

  if (!arrivalTimeUTC) {
    result.isAbsent = true;
    return result;
  }

  const arrivalLocal = utcToZonedTime(new Date(arrivalTimeUTC), userTimeZone);

  if (shiftStartTime) {
    const [h, m] = String(shiftStartTime).split(":").map(Number);
    const shiftStartLocal = new Date(arrivalLocal);
    shiftStartLocal.setHours(h || 0, m || 0, 0, 0);

    if (arrivalLocal > shiftStartLocal) result.isLate = true;
  }

  if (workedSecs < MIN_HALF_DAY_SECONDS) result.isHalfDay = true;
  if (workedSecs === 0) result.isAbsent = true;

  return result;
}

// -----------------------
// Get effective shift function (DEPRECATED - Use attendanceService instead)
// -----------------------
async function getEffectiveShift(userId, date) {
  // This function is deprecated. Use attendanceService.getEffectiveShift instead
  console.warn("getEffectiveShift is deprecated. Use attendanceService.getEffectiveShift instead");
  return await attendanceService.getEffectiveShift(userId, date);
}

// -----------------------
// Sync DailyWork with enhanced timeline data
// -----------------------
async function syncDailyWork(userId, todayStatus, userTimeZone = "UTC") {
  const todayLocal = new Date();
  todayLocal.setHours(0, 0, 0, 0);
  const todayUTC = zonedTimeToUtc(todayLocal, userTimeZone);

  // Use the new attendance service for comprehensive calculations
  const attendanceData = await attendanceService.getAttendanceData(
    userId,
    todayUTC,
    todayStatus.workedSessions || [],
    todayStatus.breakSessions || [],
    todayStatus.arrivalTime
  );

  if (attendanceData.error) {
    console.warn(`Error getting attendance data for user ${userId} on ${todayUTC}:`, attendanceData.error);
    return null;
  }

  const { effectiveShift, attendanceStatus } = attendanceData;

  const shiftObj = {
    name: effectiveShift.shiftName || "",
    start: effectiveShift.start || "00:00",
    end: effectiveShift.end || "23:59",
    isFlexible: Boolean(
      effectiveShift.isFlexible || effectiveShift.isFlexiblePermanent
    ),
    durationHours: effectiveShift.durationHours || 9,
  };

  // Get arrival time from todayStatus or timeline
  let arrivalTime = todayStatus.arrivalTime;
  if (!arrivalTime && todayStatus.timeline) {
    const timelineArrival = getFirstPunchInTime(todayStatus.timeline);
    if (timelineArrival) {
      arrivalTime = timelineArrival;
    }
  }

  let dailyWork = await DailyWork.findOne({ userId, date: todayUTC });

  // Determine shift type based on effective shift
  let computedShiftType = "standard";
  if (effectiveShift.isFlexiblePermanent) {
    computedShiftType = "flexiblePermanent";
  } else if (effectiveShift.isFlexible || effectiveShift.isOneDayFlexibleOverride) {
    computedShiftType = "flexible";
  }

  if (!dailyWork) {
    dailyWork = new DailyWork({
      userId,
      userStatusId: todayStatus._id,
      date: todayUTC,
      expectedStartTime:
        effectiveShift.isFlexiblePermanent || effectiveShift.isFlexible || effectiveShift.isOneDayFlexibleOverride
          ? null
          : effectiveShift.start,
      shift: shiftObj,
      shiftType: computedShiftType,
      workDurationSeconds: attendanceData.workDurationSeconds || 0,
      breakDurationSeconds: attendanceData.breakDurationSeconds || 0,
      breakSessions: todayStatus.breakSessions || [],
      workedSessions: todayStatus.workedSessions || [],
      timeline: todayStatus.timeline || [],
      arrivalTime: arrivalTime,
      weekSummary: todayStatus.weekSummary || {},
      quickStats: todayStatus.quickStats || {},
    });
  } else {
    dailyWork.shift = shiftObj;
    dailyWork.expectedStartTime =
      effectiveShift.isFlexiblePermanent || effectiveShift.isFlexible || effectiveShift.isOneDayFlexibleOverride
        ? null
        : effectiveShift.start;
    dailyWork.shiftType = computedShiftType;
    dailyWork.userStatusId = todayStatus._id;
    dailyWork.workDurationSeconds = attendanceData.workDurationSeconds || 0;
    dailyWork.breakDurationSeconds = attendanceData.breakDurationSeconds || 0;
    dailyWork.breakSessions = todayStatus.breakSessions || [];
    dailyWork.workedSessions = todayStatus.workedSessions || [];
    dailyWork.timeline = todayStatus.timeline || [];
    dailyWork.arrivalTime = arrivalTime;
  }

  // Use the new attendance status calculations
  dailyWork.isLate = attendanceStatus.isLate || false;
  dailyWork.isHalfDay = attendanceStatus.isHalfDay || false;
  dailyWork.isAbsent = attendanceStatus.isAbsent || false;

  await dailyWork.save();
  return dailyWork;
}

// -----------------------
// Get Today's Status
// -----------------------
async function getTodayStatus(req, res) {
  try {
    const userId = req.user._id;
    const user = await User.findById(userId).lean();
    const userTimeZone = user?.timeZone || "UTC";

    const todayLocal = new Date();
    todayLocal.setHours(0, 0, 0, 0);
    const todayUTC = zonedTimeToUtc(todayLocal, userTimeZone);

    let todayStatus = await UserStatus.findOneAndUpdate(
      { userId, today: { $gte: todayUTC } },
      {
        $setOnInsert: {
          userId,
          today: todayUTC,
          currentlyWorking: false,
          onBreak: false,
          workedSessions: [],
          breakSessions: [],
          timeline: [],
          recentActivities: [],
        },
      },
      { upsert: true, new: true }
    );

    // Use the new attendance service for comprehensive calculations
    const attendanceData = await attendanceService.getAttendanceData(
      userId,
      todayUTC,
      todayStatus.workedSessions || [],
      todayStatus.breakSessions || [],
      todayStatus.arrivalTime
    );

    let effectiveShift = null;
    let attendanceStatus = { isAbsent: true, isHalfDay: false, isFullDay: false, isLate: false };
    let workSecs = 0;
    let breakSecs = 0;

    if (attendanceData.error) {
      console.warn(`Error getting attendance data: ${attendanceData.error}`);
      // Fallback to legacy calculation
      effectiveShift = await getEffectiveShift(userId, todayUTC);
      workSecs = getWorkDurationSeconds(
        todayStatus.workedSessions,
        todayStatus.currentlyWorking
      );
      breakSecs = getBreakDurationSeconds(
        todayStatus.breakSessions,
        todayStatus.onBreak,
        todayStatus.breakStartTime
      );
      const legacy = calculateLateAndHalfDay(
        workSecs,
        effectiveShift?.start,
        todayStatus.arrivalTime,
        userTimeZone
      );
      attendanceStatus = {
        isAbsent: legacy.isAbsent,
        isHalfDay: legacy.isHalfDay,
        isFullDay: !legacy.isHalfDay && !legacy.isAbsent,
        isLate: legacy.isLate
      };
    } else {
      effectiveShift = attendanceData.effectiveShift;
      attendanceStatus = attendanceData.attendanceStatus;
      workSecs = attendanceData.workDurationSeconds;
      breakSecs = attendanceData.breakDurationSeconds;
    }

    const payload = {
      ...todayStatus.toObject(),
      effectiveShift,
      workDurationSeconds: workSecs,
      breakDurationSeconds: breakSecs,
      workDuration: attendanceService.formatDuration(workSecs),
      breakDuration: attendanceService.formatDuration(breakSecs),
      isLate: attendanceStatus.isLate,
      isHalfDay: attendanceStatus.isHalfDay,
      isAbsent: attendanceStatus.isAbsent,
      isFullDay: attendanceStatus.isFullDay,
      arrivalTimeFormatted: todayStatus.arrivalTime
        ? utcToZonedTime(
            todayStatus.arrivalTime,
            userTimeZone
          ).toLocaleTimeString([], {
            hour: "2-digit",
            minute: "2-digit",
            hour12: true,
          })
        : null,
    };

    res.json(payload);
  } catch (err) {
    console.error("Error fetching today's status:", err);
    res.status(500).json({ message: "Server error", error: err.message });
  }
}

// -----------------------
// Enhanced Update Today's Status with comprehensive validation and error handling
// -----------------------
async function updateTodayStatus(req, res) {
  try {
    const userId = req.user._id;
    const { timelineEvent } = req.body;
    console.log("Update request body:", req.body);
    console.log("Timeline event:", timelineEvent);

    const user = await User.findById(userId).lean();
    const userTimeZone = user?.timeZone || "UTC";

    const todayLocal = new Date();
    todayLocal.setHours(0, 0, 0, 0);
    const todayUTC = zonedTimeToUtc(todayLocal, userTimeZone);

    // Use findOneAndUpdate with upsert to handle the unique index properly
    let todayStatus = await UserStatus.findOneAndUpdate(
      { userId, today: { $gte: todayUTC } },
      {
        $setOnInsert: {
          userId,
          today: todayUTC,
          currentlyWorking: false,
          onBreak: false,
          workedSessions: [],
          breakSessions: [],
          timeline: [],
          recentActivities: [],
        },
      },
      { upsert: true, new: true }
    );

    const ws = todayStatus.workedSessions || [];
    const bs = todayStatus.breakSessions || [];

    if (timelineEvent && timelineEvent.type) {
      // Validate timeline event
      if (!validateTimelineEvent(timelineEvent)) {
        return res.status(400).json({
          message: "Invalid timeline event format",
        });
      }

      // Use the provided time or current time
      const now = timelineEvent.time
        ? new Date(timelineEvent.time)
        : new Date();

      // Additional time validation
      if (isNaN(now.getTime())) {
        return res.status(400).json({
          message: "Invalid time provided in timeline event",
        });
      }

      const rawType = String(timelineEvent.type || "").trim();
      const lower = rawType.toLowerCase();
      const breakTypeMatch = rawType.match(/\(([^)]+)\)/);
      const breakType = breakTypeMatch ? breakTypeMatch[1].trim() : undefined;

      // Get today's timeline for validation
      const todayTimeline = getTodayTimeline(todayStatus.timeline);

      if (lower.includes("punch in")) {
        // Enhanced punch-in validation
        const alreadyPunchedIn = todayTimeline.some((e) =>
          e.type.toLowerCase().includes("punch in")
        );
        const alreadyPunchedOut = todayTimeline.some((e) =>
          e.type.toLowerCase().includes("punch out")
        );

        if (alreadyPunchedIn) {
          return res.status(400).json({
            message: "Already punched in today",
          });
        }

        if (alreadyPunchedOut) {
          return res.status(400).json({
            message: "Cannot punch in after punching out for the day",
          });
        }

        if (todayStatus.currentlyWorking) {
          return res.status(400).json({
            message: "Already working",
          });
        }

        // Enhanced punch in validation using attendance service
        const effectiveShift = await attendanceService.getEffectiveShift(userId, todayUTC);
        const punchValidation = attendanceService.validatePunchInTime(now, effectiveShift, userTimeZone);

        if (!punchValidation.isValid) {
          return res.status(400).json({
            message: punchValidation.message,
          });
        }

        if (!todayStatus.arrivalTime) todayStatus.arrivalTime = now;
        if (!ws.length || ws[ws.length - 1].end) ws.push({ start: now });
        todayStatus.currentlyWorking = true;
        todayStatus.onBreak = false;
        todayStatus.breakStartTime = null;

        try {
          await User.findByIdAndUpdate(userId, { status: "active" });
        } catch (updateErr) {
          console.warn("Failed to update user status:", updateErr);
        }
      } else if (lower.includes("punch out")) {
        // Enhanced punch-out validation
        const alreadyPunchedOut = todayTimeline.some((e) =>
          e.type.toLowerCase().includes("punch out")
        );

        if (alreadyPunchedOut) {
          return res.status(400).json({
            message: "Already punched out today",
          });
        }

        // Check if currently working or on break
        if (!todayStatus.currentlyWorking && !todayStatus.onBreak) {
          return res.status(400).json({
            message: "Cannot punch out when not working or on break",
          });
        }

        // Close any open work sessions
        if (ws.length && !ws[ws.length - 1].end) {
          ws[ws.length - 1].end = now;
        } else if (!ws.length) {
          // Edge case: punch out without punch in (shouldn't happen but handle it)
          ws.push({ start: now, end: now });
        }

        // Close any open break sessions
        if (bs.length && !bs[bs.length - 1].end) {
          bs[bs.length - 1].end = now;
        }

        todayStatus.currentlyWorking = false;
        todayStatus.onBreak = false;
        todayStatus.breakStartTime = null;

        try {
          await User.findByIdAndUpdate(userId, { status: "inactive" });
        } catch (updateErr) {
          console.warn("Failed to update user status:", updateErr);
        }
      } else if (lower.includes("break start")) {
        // Enhanced break start validation
        if (!todayStatus.currentlyWorking) {
          return res.status(400).json({
            message: "Cannot start break when not working",
          });
        }

        if (todayStatus.onBreak) {
          return res.status(400).json({
            message: "Already on break",
          });
        }

        // Check if already punched out
        const alreadyPunchedOut = todayTimeline.some((e) =>
          e.type.toLowerCase().includes("punch out")
        );

        if (alreadyPunchedOut) {
          return res.status(400).json({
            message: "Cannot start break after punching out for the day",
          });
        }

        // Start new break session
        if (!bs.length || bs[bs.length - 1].end) {
          const newBreak = { start: now };
          if (breakType) newBreak.type = breakType;
          bs.push(newBreak);
        }

        // Close current work session
        if (ws.length && !ws[ws.length - 1].end) {
          ws[ws.length - 1].end = now;
        }

        todayStatus.currentlyWorking = false;
        todayStatus.onBreak = true;
        todayStatus.breakStartTime = req.body.breakStartTime
          ? new Date(req.body.breakStartTime)
          : now;
      } else if (lower.includes("resume")) {
        // Enhanced resume work validation
        if (!todayStatus.onBreak) {
          return res.status(400).json({
            message: "Cannot resume work when not on break",
          });
        }

        // Check if already punched out
        const alreadyPunchedOut = todayTimeline.some((e) =>
          e.type.toLowerCase().includes("punch out")
        );

        if (alreadyPunchedOut) {
          return res.status(400).json({
            message: "Cannot resume work after punching out for the day",
          });
        }

        // Close current break session
        if (bs.length && !bs[bs.length - 1].end) {
          bs[bs.length - 1].end = now;
        }

        // Start new work session
        if (!ws.length || ws[ws.length - 1].end) {
          ws.push({ start: now });
        }

        todayStatus.currentlyWorking = true;
        todayStatus.onBreak = false;
        todayStatus.breakStartTime = null;
      }

      // Enhanced timeline tracking with proper event structure
      todayStatus.timeline = todayStatus.timeline || [];
      todayStatus.timeline.push({
        type: rawType,
        time: now,
      });

      // Enhanced recent activities tracking
      todayStatus.recentActivities = todayStatus.recentActivities || [];
      todayStatus.recentActivities.unshift({
        date: now,
        activity: rawType,
        time: now.toLocaleTimeString([], {
          hour: "2-digit",
          minute: "2-digit",
          hour12: true,
        }),
      });

      if (todayStatus.recentActivities.length > 10) {
        todayStatus.recentActivities.length = 10;
      }
    }

    // Update calculated durations
    todayStatus.workDurationSeconds = getWorkDurationSeconds(
      ws,
      todayStatus.currentlyWorking
    );
    todayStatus.breakDurationSeconds = getBreakDurationSeconds(
      bs,
      todayStatus.onBreak,
      todayStatus.breakStartTime
    );
    todayStatus.totalWorkMs = todayStatus.workDurationSeconds * 1000;
    todayStatus.workedSessions = ws;
    todayStatus.breakSessions = bs;

    // Save status with enhanced error handling
    try {
      await todayStatus.save();
    } catch (saveError) {
      console.error("Error saving status:", saveError);
      if (saveError.name === "ValidationError") {
        return res.status(400).json({
          message: "Invalid data format",
          error: saveError.message,
        });
      }
      return res.status(500).json({
        message: "Failed to save status",
        error: saveError.message,
      });
    }

    // Sync daily work data
    const dailyWork = await syncDailyWork(
      userId,
      todayStatus,
      userTimeZone
    ).catch((e) => {
      console.error("syncDailyWork error:", e);
      return null;
    });

    // Get updated attendance data after all operations
    const finalAttendanceData = await attendanceService.getAttendanceData(
      userId,
      todayUTC,
      todayStatus.workedSessions || [],
      todayStatus.breakSessions || [],
      todayStatus.arrivalTime
    );

    let effectiveShift = null;
    let attendanceStatus = { isAbsent: true, isHalfDay: false, isFullDay: false, isLate: false };

    if (finalAttendanceData.error) {
      console.warn(`Error getting final attendance data: ${finalAttendanceData.error}`);
      effectiveShift = await getEffectiveShift(userId, todayUTC);
      attendanceStatus = {
        isLate: dailyWork?.isLate || false,
        isHalfDay: dailyWork?.isHalfDay || false,
        isAbsent: dailyWork?.isAbsent || false,
        isFullDay: !(dailyWork?.isHalfDay || dailyWork?.isAbsent) || false
      };
    } else {
      effectiveShift = finalAttendanceData.effectiveShift;
      attendanceStatus = finalAttendanceData.attendanceStatus;
    }

    // Enhanced arrival time logic
    let arrivalTime = todayStatus.arrivalTime;
    if (!arrivalTime && todayStatus.timeline) {
      const timelineArrival = getFirstPunchInTime(todayStatus.timeline);
      if (timelineArrival) {
        arrivalTime = timelineArrival;
      }
    }

    // Build comprehensive response payload
    const payload = {
      ...todayStatus.toObject(),
      effectiveShift: effectiveShift || { message: "No shift assigned" },
      shiftType: dailyWork
        ? dailyWork.shiftType
        : todayStatus.shiftType || "standard",
      workDurationSeconds: todayStatus.workDurationSeconds,
      breakDurationSeconds: todayStatus.breakDurationSeconds,
      workDuration: attendanceService.formatDuration(todayStatus.workDurationSeconds),
      breakDuration: attendanceService.formatDuration(todayStatus.breakDurationSeconds),
      arrivalTimeFormatted: todayStatus.arrivalTime
        ? utcToZonedTime(
            todayStatus.arrivalTime,
            userTimeZone
          ).toLocaleTimeString([], {
            hour: "2-digit",
            minute: "2-digit",
            hour12: true,
          })
        : null,
      isLate: attendanceStatus.isLate,
      isHalfDay: attendanceStatus.isHalfDay,
      isAbsent: attendanceStatus.isAbsent,
      isFullDay: attendanceStatus.isFullDay,
      dailyWork: dailyWork
        ? {
            id: dailyWork._id,
            date: dailyWork.date,
            workDurationSeconds: dailyWork.workDurationSeconds,
            breakDurationSeconds: dailyWork.breakDurationSeconds,
            breakSessions: dailyWork.breakSessions || [],
            shift: dailyWork.shift || {},
            shiftType: dailyWork.shiftType || "standard",
            isLate: dailyWork.isLate,
            isHalfDay: dailyWork.isHalfDay,
            isAbsent: dailyWork.isAbsent,
          }
        : null,
    };

    console.log("Sending response payload:", payload);
    return res.json(payload);
  } catch (err) {
    console.error("Error updating today's status:", err);
    return res
      .status(500)
      .json({ message: "Server error", error: err.message });
  }
}

// Get today's status for a specific employee (admin/super-admin only)
async function getEmployeeTodayStatus(req, res) {
  try {
    const { employeeId } = req.params;

    if (!employeeId) {
      return res.status(400).json({ message: "Employee ID is required" });
    }

    // Check if the requesting user has admin privileges
    const requestingUser = req.user;
    if (!["admin", "super-admin", "hr"].includes(requestingUser.role)) {
      return res
        .status(403)
        .json({ message: "Access denied. Admin privileges required." });
    }

    const user = await User.findById(employeeId).lean();
    if (!user) {
      return res.status(404).json({ message: "Employee not found" });
    }

    const userTimeZone = user?.timeZone || "UTC";

    const todayLocal = new Date();
    todayLocal.setHours(0, 0, 0, 0);
    const todayUTC = zonedTimeToUtc(todayLocal, userTimeZone);

    let todayStatus = await UserStatus.findOne({
      userId: employeeId,
      today: { $gte: todayUTC },
    });

    if (!todayStatus) {
      // Return default status if no status found
      return res.json({
        userId: employeeId,
        currentlyWorking: false,
        onBreak: false,
        workedSessions: [],
        breakSessions: [],
        timeline: [],
        recentActivities: [],
        workDurationSeconds: 0,
        breakDurationSeconds: 0,
        workDuration: "0h 00m 00s",
        breakDuration: "0h 00m 00s",
        arrivalTime: null,
        arrivalTimeFormatted: null,
        isLate: false,
        isHalfDay: false,
        isAbsent: true,
        effectiveShift: null,
      });
    }

    const effectiveShift = await getEffectiveShift(employeeId, todayUTC);

    const workSecs = getWorkDurationSeconds(
      todayStatus.workedSessions,
      todayStatus.currentlyWorking
    );
    const breakSecs = getBreakDurationSeconds(
      todayStatus.breakSessions,
      todayStatus.onBreak,
      todayStatus.breakStartTime
    );

    const { isLate, isHalfDay, isAbsent } = calculateLateAndHalfDay(
      workSecs,
      effectiveShift?.start,
      todayStatus.arrivalTime,
      userTimeZone
    );

    const payload = {
      ...todayStatus.toObject(),
      effectiveShift,
      workDurationSeconds: workSecs,
      breakDurationSeconds: breakSecs,
      workDuration: secToHMS(workSecs),
      breakDuration: secToHMS(breakSecs),
      isLate,
      isHalfDay,
      isAbsent,
      arrivalTimeFormatted: todayStatus.arrivalTime
        ? utcToZonedTime(
            todayStatus.arrivalTime,
            userTimeZone
          ).toLocaleTimeString([], {
            hour: "2-digit",
            minute: "2-digit",
            hour12: true,
          })
        : null,
    };

    res.json(payload);
  } catch (err) {
    console.error("Error fetching employee's today status:", err);
    res.status(500).json({ message: "Server error", error: err.message });
  }
}

module.exports = {
  getTodayStatus,
  getEmployeeTodayStatus,
  updateTodayStatus,
  syncDailyWork,
  getEffectiveShift,
  getFirstPunchInTime,
  getLastPunchOutTime,
  secToHMS,
  secToHM,
  validateTimelineEvent,
  hasEventTypeToday,
  getTodayTimeline,
};
