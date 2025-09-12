// controllers/statusController.js
const { utcToZonedTime, zonedTimeToUtc } = require("date-fns-tz");
const UserStatus = require("../models/UserStatus");
const DailyWork = require("../models/DailyWork");
const User = require("../models/User");
const FlexibleShiftRequest = require("../models/FlexibleShiftRequest");

const MIN_HALF_DAY_SECONDS = 5 * 3600; // 5 hours
const MIN_FULL_DAY_SECONDS = 8 * 3600; // 8 hours

// -----------------------
// Helpers
// -----------------------
function getWorkDurationSeconds(workedSessions, currentlyWorking) {
  if (!Array.isArray(workedSessions)) return 0;

  let total = workedSessions.reduce((sum, s) => {
    if (s.start && s.end) return sum + (new Date(s.end) - new Date(s.start)) / 1000;
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
    if (s.start && s.end) return sum + (new Date(s.end) - new Date(s.start)) / 1000;
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
  return `${h}h ${m.toString().padStart(2, "0")}m ${s.toString().padStart(2, "0")}s`;
}

function secToHM(sec) {
  const h = Math.floor(sec / 3600);
  const m = Math.floor((sec % 3600) / 60);
  return `${h}h ${m.toString().padStart(2, "0")}m`;
}

function ymdKey(date) {
  const d = new Date(date);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

// Enhanced helper to get first punch in time from timeline
function getFirstPunchInTime(timeline) {
  if (!Array.isArray(timeline)) return null;
  
  const punchInEvents = timeline.filter(event => 
    event.type && (
      event.type.toLowerCase().includes('punch in') ||
      event.type.toLowerCase().includes('punchin') ||
      event.type.toLowerCase() === 'punch_in' ||
      event.type.toLowerCase() === 'punchIn'
    )
  );
  
  if (punchInEvents.length === 0) return null;
  
  // Get the earliest punch in time
  const sortedPunchIns = punchInEvents.sort((a, b) => new Date(a.time) - new Date(b.time));
  return new Date(sortedPunchIns[0].time);
}

// Enhanced helper to get last punch out time from timeline
function getLastPunchOutTime(timeline) {
  if (!Array.isArray(timeline)) return null;
  
  const punchOutEvents = timeline.filter(event => 
    event.type && (
      event.type.toLowerCase().includes('punch out') ||
      event.type.toLowerCase().includes('punchout') ||
      event.type.toLowerCase() === 'punch_out' ||
      event.type.toLowerCase() === 'punchOut'
    )
  );
  
  if (punchOutEvents.length === 0) return null;
  
  // Get the latest punch out time
  const sortedPunchOuts = punchOutEvents.sort((a, b) => new Date(b.time) - new Date(a.time));
  return new Date(sortedPunchOuts[0].time);
}

// -----------------------
// Timezone-safe late/half-day/absent calculation
// -----------------------
function calculateLateAndHalfDay(workedSecs, shiftStartTime, arrivalTimeUTC, userTimeZone = "UTC") {
  const result = { isLate: false, isHalfDay: false, isAbsent: false };

  if (!arrivalTimeUTC) {
    result.isAbsent = true;
    return result;
  }

  const arrivalLocal = utcToZonedTime(new Date(arrivalTimeUTC), userTimeZone);

  if (shiftStartTime) {
    const [h, m] = shiftStartTime.split(":").map(Number);
    const shiftStartLocal = new Date(arrivalLocal);
    shiftStartLocal.setHours(h || 0, m || 0, 0, 0);

    if (arrivalLocal > shiftStartLocal) result.isLate = true;
  }

  if (workedSecs < MIN_HALF_DAY_SECONDS) result.isHalfDay = true;
  if (workedSecs === 0) result.isAbsent = true;

  return result;
}

// -----------------------
// Effective Shift
// -----------------------
async function getEffectiveShift(userId, date) {
  const targetDate = new Date(date);
  targetDate.setHours(0, 0, 0, 0);

  const user = await User.findById(userId).lean();
  if (!user) throw new Error("User not found");

  const key = ymdKey(targetDate);

  // Shift override
  if (user.shiftOverrides && user.shiftOverrides[key]) {
    const ov = user.shiftOverrides[key];
    return {
      start: ov.start || user.shift?.start || "09:00",
      end: ov.end || user.shift?.end || "18:00",
      isFlexible: true,
      isFlexiblePermanent: false,
      durationHours: ov.durationHours || user.shift?.durationHours || 9,
    };
  }

  // Flexible permanent shift
  if (user.shiftType === "flexiblePermanent") {
    return {
      start: "00:00",
      end: "23:59",
      isFlexible: true,
      isFlexiblePermanent: true,
      durationHours: user.shift?.durationHours || 9,
    };
  }

  // Flexible shift requests
  const flexShift = await FlexibleShiftRequest.findOne({
    employee: userId,
    requestedDate: targetDate,
    status: "approved",
  }).lean();

  if (flexShift) {
    const [startH, startM] = String(flexShift.requestedStartTime || "09:00").split(":").map(Number);
    const duration = flexShift.durationHours || 9;

    let endH = startH + Math.floor(duration);
    let endM = startM + Math.round((duration % 1) * 60);
    if (endM >= 60) { endH += 1; endM -= 60; }
    if (endH >= 24) endH -= 24;

    return {
      start: `${String(startH).padStart(2, "0")}:${String(startM).padStart(2, "0")}`,
      end: `${String(endH).padStart(2, "0")}:${String(endM).padStart(2, "0")}`,
      isFlexible: true,
      isFlexiblePermanent: false,
      durationHours: duration,
    };
  }

  return {
    start: user.shift?.start || "09:00",
    end: user.shift?.end || "18:00",
    isFlexible: false,
    isFlexiblePermanent: false,
    durationHours: user.shift?.durationHours || 9,
  };
}

// -----------------------
// Sync DailyWork with enhanced timeline data
// -----------------------
async function syncDailyWork(userId, todayStatus, userTimeZone = "UTC") {
  const todayLocal = new Date();
  todayLocal.setHours(0, 0, 0, 0);
  const todayUTC = zonedTimeToUtc(todayLocal, userTimeZone);

  const effectiveShift = await getEffectiveShift(userId, todayUTC);

  const shiftObj = {
    name: "",
    start: effectiveShift.start || "00:00",
    end: effectiveShift.end || "23:59",
    isFlexible: Boolean(effectiveShift.isFlexible || effectiveShift.isFlexiblePermanent),
    durationHours: effectiveShift.durationHours || 9,
  };

  let dailyWork = await DailyWork.findOne({ userId, date: todayUTC });
  const computedShiftType = effectiveShift.isFlexiblePermanent ? "flexiblePermanent" : "standard";

  // Enhanced arrival time determination with multiple fallbacks
  let arrivalTime = todayStatus.arrivalTime;
  if (!arrivalTime && todayStatus.timeline) {
    // Try to get from timeline if not set
    const timelineArrival = getFirstPunchInTime(todayStatus.timeline);
    if (timelineArrival) {
      arrivalTime = timelineArrival;
      // Update the status object for consistency
      todayStatus.arrivalTime = timelineArrival;
    }
  }

  if (!dailyWork) {
    dailyWork = new DailyWork({
      userId,
      userStatusId: todayStatus._id,
      date: todayUTC,
      expectedStartTime: effectiveShift.isFlexiblePermanent || effectiveShift.isFlexible ? null : effectiveShift.start,
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
    dailyWork.expectedStartTime = effectiveShift.isFlexiblePermanent || effectiveShift.isFlexible ? null : effectiveShift.start;
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

    let todayStatus = await UserStatus.findOne({ userId, today: { $gte: todayUTC } });
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
    const workSecs = getWorkDurationSeconds(todayStatus.workedSessions, todayStatus.currentlyWorking);
    const breakSecs = getBreakDurationSeconds(todayStatus.breakSessions, todayStatus.onBreak, todayStatus.breakStartTime);

    // Enhanced arrival time logic
    let arrivalTime = todayStatus.arrivalTime;
    if (!arrivalTime && todayStatus.timeline) {
      const timelineArrival = getFirstPunchInTime(todayStatus.timeline);
      if (timelineArrival) {
        arrivalTime = timelineArrival;
      }
    }

    const { isLate, isHalfDay, isAbsent } = calculateLateAndHalfDay(workSecs, effectiveShift.start, arrivalTime, userTimeZone);

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
      arrivalTime: arrivalTime,
      arrivalTimeFormatted: arrivalTime ? utcToZonedTime(arrivalTime, userTimeZone).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit", hour12: true }) : null,
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

    let todayStatus = await UserStatus.findOne({ userId, today: { $gte: todayUTC } });
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
        // Set arrival time if this is the first punch in of the day
        if (!todayStatus.arrivalTime) {
          todayStatus.arrivalTime = now;
        }
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
        time: now.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit", hour12: true }),
      });
      if (todayStatus.recentActivities.length > 10) todayStatus.recentActivities.length = 10;
    }

    todayStatus.workDurationSeconds = getWorkDurationSeconds(ws, todayStatus.currentlyWorking);
    todayStatus.breakDurationSeconds = getBreakDurationSeconds(bs, todayStatus.onBreak, todayStatus.breakStartTime);
    todayStatus.totalWorkMs = todayStatus.workDurationSeconds * 1000;
    todayStatus.workedSessions = ws;
    todayStatus.breakSessions = bs;

    await todayStatus.save();

    const dailyWork = await syncDailyWork(userId, todayStatus, userTimeZone).catch(e => {
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
      effectiveShift,
      shiftType: dailyWork ? dailyWork.shiftType : (todayStatus.shiftType || "standard"),
      workDurationSeconds: todayStatus.workDurationSeconds,
      breakDurationSeconds: todayStatus.breakDurationSeconds,
      workDuration: secToHMS(todayStatus.workDurationSeconds),
      breakDuration: secToHMS(todayStatus.breakDurationSeconds),
      arrivalTime: arrivalTime,
      arrivalTimeFormatted: arrivalTime ? utcToZonedTime(arrivalTime, userTimeZone).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit", hour12: true }) : null,
      isLate: dailyWork?.isLate || false,
      isHalfDay: dailyWork?.isHalfDay || false,
      isAbsent: dailyWork?.isAbsent || false,
      dailyWork: dailyWork ? {
        id: dailyWork._id,
        date: dailyWork.date,
        workDurationSeconds: dailyWork.workDurationSeconds,
        breakDurationSeconds: dailyWork.breakDurationSeconds,
        breakSessions: dailyWork.breakSessions || [],
        workedSessions: dailyWork.workedSessions || [],
        timeline: dailyWork.timeline || [],
        arrivalTime: dailyWork.arrivalTime,
        shift: dailyWork.shift || {},
        shiftType: dailyWork.shiftType || "standard",
        isLate: dailyWork.isLate,
        isHalfDay: dailyWork.isHalfDay,
        isAbsent: dailyWork.isAbsent,
      } : null,
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