// controllers/statusController.js
// Replaced date-fns-tz with native Intl-based TZ conversion helpers
const UserStatus = require("../models/UserStatus");
const DailyWork = require("../models/DailyWork");
const User = require("../models/User");
const FlexibleShiftRequest = require("../models/FlexibleShiftRequest");

// -----------------------
// Configurable grace / early punch
// -----------------------
const EARLY_PUNCH_MINUTES = 40; // allow punch-in up to 40 min before shift start

// -----------------------
// Native timezone conversion helpers (replaces date-fns-tz)
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

/**
 * Returns the signed difference (in ms) between the given timezone and UTC
 * at the moment represented by `date`.
 * i.e. offsetMs = dateInTZ - dateInUTC
 */
function getTimeZoneOffsetMilliseconds(dateInput, timeZone) {
  const date = new Date(dateInput);
  const partsUTC = formatPartsFor(date, "UTC");
  const partsTZ = formatPartsFor(date, timeZone);

  const utcMs = Date.UTC(
    Number(partsUTC.year),
    Number(partsUTC.month) - 1,
    Number(partsUTC.day),
    Number(partsUTC.hour),
    Number(partsUTC.minute),
    Number(partsUTC.second)
  );

  const tzMs = Date.UTC(
    Number(partsTZ.year),
    Number(partsTZ.month) - 1,
    Number(partsTZ.day),
    Number(partsTZ.hour),
    Number(partsTZ.minute),
    Number(partsTZ.second)
  );

  return new Date(
    `${map.year}-${map.month}-${map.day}T${map.hour}:${map.minute}:${map.second}`
  );
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

// -----------------------
// Standard shift definitions (should match the User model)
const STANDARD_SHIFTS = {
  MORNING: { name: "Morning", start: "09:00", end: "18:00", durationHours: 9 },
  NIGHT: { name: "Night", start: "20:00", end: "05:00", durationHours: 9 },
  EARLY: { name: "Early", start: "05:30", end: "14:20", durationHours: 8.83 }
};

function ymdKey(date) {
  const d = new Date(date);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(
    d.getDate()
  ).padStart(2, "0")}`;
}

// -----------------------
// Time constants
// -----------------------
const MIN_HALF_DAY_SECONDS = 5 * 3600; // 5 hours
const MIN_FULL_DAY_SECONDS = 8 * 3600; // 8 hours

// -----------------------
// Helpers
// -----------------------
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
    const last = breakSessions.length ? breakSessions[breakSessions.length - 1] : null;
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
// Timezone-safe late/half-day/absent calculation
// -----------------------
function calculateLateAndHalfDay(
  workedSecs,
  shiftStartTime,
  arrivalTimeUTC,
  userTimeZone = "UTC"
) {
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
// Updated getEffectiveShift function integrated here
// -----------------------
async function getEffectiveShift(userId, date) {
  try {
    const targetDate = new Date(date);
    targetDate.setHours(0, 0, 0, 0);
    const dateKey = ymdKey(targetDate);

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
        shiftName: override.name || ""
      };
    }
    // Handle Map stored as plain object (common with MongoDB)
    if (user.shiftOverrides && typeof user.shiftOverrides === 'object' && user.shiftOverrides[dateKey]) {
      const override = user.shiftOverrides[dateKey];
      return {
        start: override.start || user.shift?.start || "09:00",
        end: override.end || user.shift?.end || "18:00",
        durationHours: override.durationHours || user.shift?.durationHours || 9,
        isFlexible: override.type === "flexible",
        isFlexiblePermanent: false,
        source: "override",
        type: override.type,
        shiftName: override.name || ""
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
        type: "flexible",
        shiftName: "Flexible Permanent"
      };
    }

    // 3. Check for approved flexible shift requests for this date
    const flexRequest = await FlexibleShiftRequest.findOne({
      employee: userId,
      requestedDate: targetDate,
      status: "approved"
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
        shiftName: "Flexible Request"
      };
    }

    // 4. Default to user's standard shift if exists (updated as requested)
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
          shiftName: standardShift.name
        };
      }
      // Fallback to user.shift if standardShiftType is not set
      if (user.shift) {
        return {
          start: user.shift.start,
          end: user.shift.end,
          durationHours: user.shift.durationHours,
          isFlexible: false,
          isFlexiblePermanent: false,
          source: "standard_fallback",
          type: "standard",
          shiftName: user.shift.name || "Standard"
        };
      }
    }

    // 5. Ultimate fallback - return null to indicate no shift assigned
    return null;
  } catch (error) {
    console.error("Error in getEffectiveShift:", error);
    // Return null to indicate error - let calling code handle it
    return null;
  }
}

// -----------------------
// Sync DailyWork with enhanced timeline data
// -----------------------
async function syncDailyWork(userId, todayStatus, userTimeZone = "UTC") {
  const todayLocal = new Date();
  todayLocal.setHours(0, 0, 0, 0);
  const todayUTC = zonedTimeToUtc(todayLocal, userTimeZone);

  const effectiveShift = await getEffectiveShift(userId, todayUTC);

  // Handle case where no shift is assigned
  if (!effectiveShift) {
    console.warn(`No shift assigned for user ${userId} on ${todayUTC}`);
    return; // Skip sync if no shift is assigned
  }

  const shiftObj = {
    name: effectiveShift.shiftName || "",
    start: effectiveShift.start || "00:00",
    end: effectiveShift.end || "23:59",
    isFlexible: Boolean(
      effectiveShift.isFlexible || effectiveShift.isFlexiblePermanent
    ),
    durationHours: effectiveShift.durationHours || 9,
  };

  let dailyWork = await DailyWork.findOne({ userId, date: todayUTC });
  const computedShiftType = effectiveShift.isFlexiblePermanent
    ? "flexiblePermanent"
    : "standard";

  if (!dailyWork) {
    dailyWork = new DailyWork({
      userId,
      userStatusId: todayStatus._id,
      date: todayUTC,
      expectedStartTime:
        effectiveShift.isFlexiblePermanent || effectiveShift.isFlexible
          ? null
          : effectiveShift.start,
      shift: shiftObj,
      shiftType: computedShiftType,
      workDurationSeconds: todayStatus.workDurationSeconds || 0,
      breakDurationSeconds: todayStatus.breakDurationSeconds || 0,
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
      effectiveShift.isFlexiblePermanent || effectiveShift.isFlexible
        ? null
        : effectiveShift.start;
    dailyWork.shiftType = computedShiftType;
    dailyWork.userStatusId = todayStatus._id;
    dailyWork.workDurationSeconds = todayStatus.workDurationSeconds || 0;
    dailyWork.breakDurationSeconds = todayStatus.breakDurationSeconds || 0;
    dailyWork.breakSessions = todayStatus.breakSessions || [];
    dailyWork.workedSessions = todayStatus.workedSessions || [];
    dailyWork.timeline = todayStatus.timeline || [];
    dailyWork.arrivalTime = arrivalTime;
  }

  const { isLate, isHalfDay, isAbsent } = calculateLateAndHalfDay(
    todayStatus.workDurationSeconds || 0,
    effectiveShift.start,
    arrivalTime,
    userTimeZone
  );

  dailyWork.isLate = isLate;
  dailyWork.isHalfDay = isHalfDay;
  dailyWork.isAbsent = isAbsent;

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

    let todayStatus = await UserStatus.findOne({
      userId,
      today: { $gte: todayUTC },
    });
    if (!todayStatus) {
      todayStatus = await UserStatus.create({
        userId,
        currentlyWorking: false,
        onBreak: false,
        workedSessions: [],
        breakSessions: [],
        timeline: [],
        recentActivities: [],
      });
    }

    const effectiveShift = await getEffectiveShift(userId, todayUTC);
    
    // Handle case where no shift is assigned
    if (!effectiveShift) {
      return res.status(400).json({ 
        message: "No shift assigned to this employee. Please assign a shift first." 
      });
    }
    
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
      effectiveShift.start,
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
        ? utcToZonedTime(todayStatus.arrivalTime, userTimeZone).toLocaleTimeString(
            [],
            {
              hour: "2-digit",
              minute: "2-digit",
              hour12: true,
            }
          )
        : null,
    };

    res.json(payload);
  } catch (err) {
    console.error("Error fetching today's status:", err);
    res.status(500).json({ message: "Server error", error: err.message });
  }
}

// -----------------------
// Update Today's Status with enhanced timeline tracking
// -----------------------
async function updateTodayStatus(req, res) {
  try {
    const userId = req.user._id;
    const { timelineEvent } = req.body;
    const user = await User.findById(userId).lean();
    const userTimeZone = user?.timeZone || "UTC";

    const todayLocal = new Date();
    todayLocal.setHours(0, 0, 0, 0);
    const todayUTC = zonedTimeToUtc(todayLocal, userTimeZone);

    let todayStatus = await UserStatus.findOne({
      userId,
      today: { $gte: todayUTC },
    });
    if (!todayStatus) {
      todayStatus = await UserStatus.create({
        userId,
        currentlyWorking: false,
        onBreak: false,
        workedSessions: [],
        breakSessions: [],
        timeline: [],
        recentActivities: [],
      });
    }

    const ws = todayStatus.workedSessions || [];
    const bs = todayStatus.breakSessions || [];

    if (timelineEvent && timelineEvent.type) {
      const now = new Date();
      const rawType = String(timelineEvent.type || "").trim();
      const lower = rawType.toLowerCase();
      const breakTypeMatch = rawType.match(/\(([^)]+)\)/);
      const breakType = breakTypeMatch ? breakTypeMatch[1].trim() : undefined;

      if (lower.includes("punch in")) {
        // --- Early punch check ---
        const effectiveShift = await getEffectiveShift(userId, todayUTC);
        
        // Handle case where no shift is assigned
        if (!effectiveShift) {
          return res.status(400).json({ 
            message: "No shift assigned to this employee. Please assign a shift first." 
          });
        }
        if (effectiveShift.start) {
          const [h, m] = effectiveShift.start.split(":").map(Number);
          const shiftStartLocal = new Date(utcToZonedTime(now, userTimeZone));
          shiftStartLocal.setHours(h, m, 0, 0);
          const earliestAllowed = new Date(shiftStartLocal);
          earliestAllowed.setMinutes(earliestAllowed.getMinutes() - EARLY_PUNCH_MINUTES);

          if (now < earliestAllowed) {
            return res.status(400).json({
              message: `Cannot punch in earlier than ${EARLY_PUNCH_MINUTES} minutes before shift start`
            });
          }
        }

        if (!todayStatus.arrivalTime) todayStatus.arrivalTime = now;
        if (!ws.length || ws[ws.length - 1].end) ws.push({ start: now });
        todayStatus.currentlyWorking = true;
        todayStatus.onBreak = false;
        todayStatus.breakStartTime = null;
        await User.findByIdAndUpdate(userId, { status: "active" }).catch(() => {});
      } else if (lower.includes("punch out")) {
        if (ws.length && !ws[ws.length - 1].end) ws[ws.length - 1].end = now;
        else if (!ws.length) ws.push({ start: now, end: now });
        if (bs.length && !bs[bs.length - 1].end) bs[bs.length - 1].end = now;
        todayStatus.currentlyWorking = false;
        todayStatus.onBreak = false;
        todayStatus.breakStartTime = null;
        await User.findByIdAndUpdate(userId, { status: "inactive" }).catch(() => {});
      } else if (lower.includes("break start")) {
        if (!bs.length || bs[bs.length - 1].end) {
          const newBreak = { start: now };
          if (breakType) newBreak.type = breakType;
          bs.push(newBreak);
        }
        if (ws.length && !ws[ws.length - 1].end) ws[ws.length - 1].end = now;
        todayStatus.currentlyWorking = false;
        todayStatus.onBreak = true;
        todayStatus.breakStartTime = now;
      } else if (lower.includes("resume")) {
        if (bs.length && !bs[bs.length - 1].end) bs[bs.length - 1].end = now;
        if (!ws.length || ws[ws.length - 1].end) ws.push({ start: now });
        todayStatus.currentlyWorking = true;
        todayStatus.onBreak = false;
        todayStatus.breakStartTime = null;
      }

      // Enhanced timeline tracking with proper event structure
      todayStatus.timeline = todayStatus.timeline || [];
      todayStatus.timeline.push({ 
        type: rawType, 
        time: now,
        _id: require('mongoose').Types.ObjectId() // Ensure proper _id for timeline events
      });

      todayStatus.recentActivities = todayStatus.recentActivities || [];
      todayStatus.recentActivities.unshift({
        date: now.toLocaleDateString(),
        activity: rawType,
        time: now.toLocaleTimeString([], {
          hour: "2-digit",
          minute: "2-digit",
          hour12: true,
        }),
      });
      if (todayStatus.recentActivities.length > 10)
        todayStatus.recentActivities.length = 10;
    }

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

    await todayStatus.save();

    const dailyWork = await syncDailyWork(
      userId,
      todayStatus,
      userTimeZone
    ).catch((e) => {
      console.error("syncDailyWork error:", e);
      return null;
    });

    const effectiveShift = await getEffectiveShift(userId, todayUTC);

    // Enhanced arrival time logic
    let arrivalTime = todayStatus.arrivalTime;
    if (!arrivalTime && todayStatus.timeline) {
      const timelineArrival = getFirstPunchInTime(todayStatus.timeline);
      if (timelineArrival) {
        arrivalTime = timelineArrival;
      }
    }

    const payload = {
      ...todayStatus.toObject(),
      effectiveShift: effectiveShift || { message: "No shift assigned" },
      shiftType: dailyWork ? dailyWork.shiftType : todayStatus.shiftType || "standard",
      workDurationSeconds: todayStatus.workDurationSeconds,
      breakDurationSeconds: todayStatus.breakDurationSeconds,
      workDuration: secToHMS(todayStatus.workDurationSeconds),
      breakDuration: secToHMS(todayStatus.breakDurationSeconds),
      arrivalTimeFormatted: todayStatus.arrivalTime
        ? utcToZonedTime(todayStatus.arrivalTime, userTimeZone).toLocaleTimeString(
            [],
            {
              hour: "2-digit",
              minute: "2-digit",
              hour12: true,
            }
          )
        : null,
      isLate: dailyWork?.isLate || false,
      isHalfDay: dailyWork?.isHalfDay || false,
      isAbsent: dailyWork?.isAbsent || false,
      dailyWork: dailyWork
        ? {
            id: dailyWork._id,
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

    return res.json(payload);
  } catch (err) {
    console.error("Error updating today's status:", err);
    return res.status(500).json({ message: "Server error", error: err.message });
  }
}

module.exports = {
  getTodayStatus,
  updateTodayStatus,
  syncDailyWork,
  getEffectiveShift,
  getFirstPunchInTime,
  getLastPunchOutTime,
  secToHMS,
  secToHM,
};