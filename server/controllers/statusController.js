const UserStatus = require("../models/UserStatus");
const DailyWork = require("../models/DailyWork");
const User = require("../models/User");
const FlexibleShiftRequest = require("../models/FlexibleShiftRequest");

const MIN_HALF_DAY_SECONDS = 5 * 3600; // 5 hours
const MIN_FULL_DAY_SECONDS = 8 * 3600; // 8 hours

// Calculate total worked time including ongoing session if any
function getWorkDurationSeconds(workedSessions, currentlyWorking) {
  if (!Array.isArray(workedSessions)) return 0;

  let total = workedSessions.reduce((sum, s) => {
    if (s.start && s.end) return sum + (new Date(s.end) - new Date(s.start)) / 1000;
    return sum;
  }, 0);

  if (currentlyWorking && workedSessions.length && !workedSessions[workedSessions.length - 1].end) {
    total += (Date.now() - new Date(workedSessions[workedSessions.length - 1].start).getTime()) / 1000;
  }

  return Math.floor(total);
}

// Calculate total break time including ongoing break if any
function getBreakDurationSeconds(breakSessions, onBreak, breakStart) {
  if (!Array.isArray(breakSessions)) return 0;

  let total = breakSessions.reduce((sum, s) => {
    if (s.start && s.end) return sum + (new Date(s.end) - new Date(s.start)) / 1000;
    return sum;
  }, 0);

  if (onBreak && breakStart) {
    total += (Date.now() - new Date(breakStart).getTime()) / 1000;
  }

  return Math.floor(total);
}

// Format seconds to 'HHh MMm SSs' string
function secToHMS(sec) {
  const h = Math.floor(sec / 3600);
  const m = Math.floor((sec % 3600) / 60);
  const s = sec % 60;
  return `${h}h ${m.toString().padStart(2, "0")}m ${s.toString().padStart(2, "0")}s`;
}

// Format seconds to 'HHh MMm' string
function secToHM(sec) {
  const h = Math.floor(sec / 3600);
  const m = Math.floor((sec % 3600) / 60);
  return `${h}h ${m.toString().padStart(2, "0")}m`;
}

// Format Date to 'YYYY-MM-DD'
function ymdKey(date) {
  const iso = new Date(date).toISOString();
  return iso.slice(0, 10);
}

// Determine effective shift for a user on a given date
async function getEffectiveShift(userId, date) {
  const targetDate = new Date(date);
  targetDate.setHours(0, 0, 0, 0);

  const user = await User.findById(userId).lean();
  if (!user) throw new Error("User not found");

  const key = ymdKey(targetDate);

  // Day-specific override from shiftOverrides if exists
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

  // Permanent flexible employee default full day shift
  if (user.shiftType === "flexiblePermanent") {
    return {
      start: "00:00",
      end: "23:59",
      isFlexible: true,
      isFlexiblePermanent: true,
      durationHours: user.shift?.durationHours || 9,
    };
  }

  // Approved flexible shift request for that day (for standard users)
  const flexShift = await FlexibleShiftRequest.findOne({
    employee: userId,
    requestedDate: targetDate,
    status: "approved",
  }).lean();

  if (flexShift) {
    const [startH, startM] = String(flexShift.requestedStartTime).split(":").map(Number);
    const duration = flexShift.durationHours || 9;

    let endH = startH + Math.floor(duration);
    let endM = startM + Math.round((duration % 1) * 60);
    if (endM >= 60) {
      endH += 1;
      endM -= 60;
    }
    if (endH >= 24) endH -= 24;

    return {
      start: `${String(startH).padStart(2, "0")}:${String(startM).padStart(2, "0")}`,
      end: `${String(endH).padStart(2, "0")}:${String(endM).padStart(2, "0")}`,
      isFlexible: true,
      isFlexiblePermanent: false,
      durationHours: duration,
    };
  }

  // Default fixed shift for standard user
  return {
    start: user.shift?.start || "09:00",
    end: user.shift?.end || "18:00",
    isFlexible: false,
    isFlexiblePermanent: false,
    durationHours: user.shift?.durationHours || 9,
  };
}

// Sync or create DailyWork document with today’s attendance data
async function syncDailyWork(userId, todayStatus) {
  const today = new Date();
  today.setHours(0, 0, 0, 0);

  const effectiveShift = await getEffectiveShift(userId, today);

  const shiftObj = {
    name: "",
    start: effectiveShift.start || "00:00",
    end: effectiveShift.end || "23:59",
    isFlexible: Boolean(effectiveShift.isFlexible || effectiveShift.isFlexiblePermanent),
  };

  let dailyWork = await DailyWork.findOne({ userId, date: today });

  const computedShiftType = effectiveShift.isFlexiblePermanent ? "flexiblePermanent" : "standard";

  if (!dailyWork) {
    dailyWork = new DailyWork({
      userId,
      date: today,
      arrivalTime: todayStatus.arrivalTime || null,
      expectedStartTime: effectiveShift.isFlexiblePermanent ? null : effectiveShift.start,
      shift: shiftObj,
      shiftType: computedShiftType,
      workDurationSeconds: 0,
      breakDurationSeconds: 0,
      breakSessions: [],
    });
  } else {
    dailyWork.shift = shiftObj;
    dailyWork.expectedStartTime = effectiveShift.isFlexiblePermanent ? null : effectiveShift.start;
    dailyWork.shiftType = computedShiftType;
  }

  dailyWork.workDurationSeconds = getWorkDurationSeconds(todayStatus.workedSessions, todayStatus.currentlyWorking);
  dailyWork.breakDurationSeconds = getBreakDurationSeconds(todayStatus.breakSessions, todayStatus.onBreak, todayStatus.breakStartTime);
  dailyWork.breakSessions = todayStatus.breakSessions || [];

  // Late / early flags only for fixed standard shifts
  if (!effectiveShift.isFlexiblePermanent) {
    if (!dailyWork.arrivalTime && todayStatus.arrivalTime) dailyWork.arrivalTime = todayStatus.arrivalTime;
    if (dailyWork.arrivalTime && effectiveShift.start) {
      const [expH, expM] = effectiveShift.start.split(":").map(Number);
      const expectedArrival = new Date(dailyWork.arrivalTime);
      expectedArrival.setHours(expH, expM, 0, 0);
      dailyWork.isLate = dailyWork.arrivalTime > expectedArrival;
      dailyWork.isEarly = dailyWork.arrivalTime < expectedArrival;
    }
  } else {
    dailyWork.arrivalTime = todayStatus.arrivalTime || dailyWork.arrivalTime || null;
    dailyWork.isLate = false;
    dailyWork.isEarly = false;
  }

  // Half-day / absent evaluation
  if (dailyWork.workDurationSeconds >= MIN_HALF_DAY_SECONDS) {
    dailyWork.isHalfDay = dailyWork.workDurationSeconds < MIN_FULL_DAY_SECONDS;
    dailyWork.isAbsent = false;
  } else {
    dailyWork.isHalfDay = false;
    dailyWork.isAbsent = true;
  }

  await dailyWork.save();
  return dailyWork;
}

// Retrieve today's user status with computed durations and formatted times
async function getTodayStatus(req, res) {
  try {
    const userId = req.user._id;
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    let todayStatus = await UserStatus.findOne({ userId, today });
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

    const effectiveShift = await getEffectiveShift(userId, today);
    const workSecs = getWorkDurationSeconds(todayStatus.workedSessions, todayStatus.currentlyWorking);
    const breakSecs = getBreakDurationSeconds(todayStatus.breakSessions, todayStatus.onBreak, todayStatus.breakStartTime);

    res.json({
      ...todayStatus.toObject(),
      effectiveShift,
      workDurationSeconds: workSecs,
      breakDurationSeconds: breakSecs,
      workDuration: secToHMS(workSecs),
      breakDuration: secToHMS(breakSecs),
      arrivalTimeFormatted: todayStatus.arrivalTime
        ? new Date(todayStatus.arrivalTime).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit", hour12: true })
        : null,
    });
  } catch (err) {
    console.error("Error fetching today's status:", err);
    res.status(500).json({ message: "Server error", error: err.message });
  }
}

// Update user's attendance status for today with timeline events and durations
async function updateTodayStatus(req, res) {
  try {
    const userId = req.user._id;
    const { onBreak, currentlyWorking, timelineEvent, breakStartTime } = req.body;

    const today = new Date();
    today.setHours(0, 0, 0, 0);

    let todayStatus = await UserStatus.findOne({ userId, today });
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

    switch (timelineEvent?.type) {
      case "Punch In":
        if (!todayStatus.arrivalTime) todayStatus.arrivalTime = new Date();
        if (!ws.length || ws[ws.length - 1].end) ws.push({ start: new Date() });
        await User.findByIdAndUpdate(userId, { status: "active" });
        break;
      case "Punch Out":
        if (ws.length && !ws[ws.length - 1].end) ws[ws.length - 1].end = new Date();
        if (bs.length && !bs[bs.length - 1].end) bs[bs.length - 1].end = new Date();
        await User.findByIdAndUpdate(userId, { status: "inactive" });
        break;
      default:
        if (timelineEvent?.type?.startsWith("Break")) {
          if (timelineEvent.type === "Break Start" || timelineEvent.type.startsWith("Break Start")) {
            if (!bs.length || bs[bs.length - 1].end) bs.push({ start: new Date() });
            if (ws.length && !ws[ws.length - 1].end) ws[ws.length - 1].end = new Date();
          } else if (timelineEvent.type === "Resume Work") {
            if (bs.length && !bs[bs.length - 1].end) bs[bs.length - 1].end = new Date();
            if (!ws.length || ws[ws.length - 1].end) ws.push({ start: new Date() });
          }
        }
        break;
    }

    if (onBreak !== undefined) todayStatus.onBreak = onBreak;
    if (currentlyWorking !== undefined) todayStatus.currentlyWorking = currentlyWorking;
    if (breakStartTime !== undefined) todayStatus.breakStartTime = breakStartTime;

    if (timelineEvent?.type && timelineEvent?.time) {
      todayStatus.timeline.push(timelineEvent);
      todayStatus.recentActivities.unshift({
        date: new Date().toLocaleDateString(),
        activity: timelineEvent.type,
        time: timelineEvent.time,
      });
      if (todayStatus.recentActivities.length > 10) todayStatus.recentActivities.length = 10;
    }

    todayStatus.workDurationSeconds = getWorkDurationSeconds(ws, todayStatus.currentlyWorking);
    todayStatus.breakDurationSeconds = getBreakDurationSeconds(bs, todayStatus.onBreak, todayStatus.breakStartTime);
    todayStatus.totalWorkMs = todayStatus.workDurationSeconds * 1000;

    await todayStatus.save();

    const dailyWork = await syncDailyWork(userId, todayStatus);
    const effectiveShift = await getEffectiveShift(userId, today);

    res.json({
      ...todayStatus.toObject(),
      effectiveShift,
      shiftType: dailyWork.shiftType,
      workDurationSeconds: todayStatus.workDurationSeconds,
      breakDurationSeconds: todayStatus.breakDurationSeconds,
      arrivalTimeFormatted: todayStatus.arrivalTime
        ? new Date(todayStatus.arrivalTime).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit", hour12: true })
        : null,
    });
  } catch (err) {
    console.error("Error updating today's status:", err);
    res.status(500).json({ message: "Server error", error: err.message });
  }
}

module.exports = {
  getTodayStatus,
  updateTodayStatus,
  syncDailyWork,
  getEffectiveShift,
  secToHMS,
  secToHM,
};
