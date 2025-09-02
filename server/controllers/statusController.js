// controllers/statusController.js

const UserStatus = require("../models/UserStatus");
const DailyWork = require("../models/DailyWork");
const User = require("../models/User");
const FlexibleShiftRequest = require("../models/FlexibleShiftRequest");

const MIN_HALF_DAY_SECONDS = 5 * 3600; // 5 hours for half day
const MIN_FULL_DAY_SECONDS = 8 * 3600; // full day threshold

// ======================
// Helpers
// ======================
function getWorkDurationSeconds(workedSessions, currentlyWorking) {
  let total = workedSessions.reduce(
    (sum, s) =>
      s.start && s.end ? sum + (new Date(s.end) - new Date(s.start)) / 1000 : sum,
    0
  );

  if (
    currentlyWorking &&
    workedSessions.length &&
    !workedSessions[workedSessions.length - 1].end
  ) {
    total +=
      (Date.now() -
        new Date(workedSessions[workedSessions.length - 1].start).getTime()) /
      1000;
  }
  return Math.floor(total);
}

function getBreakDurationSeconds(breakSessions, onBreak, breakStartTime) {
  let total = breakSessions.reduce(
    (sum, s) =>
      s.start && s.end ? sum + (new Date(s.end) - new Date(s.start)) / 1000 : sum,
    0
  );
  if (onBreak && breakStartTime) {
    total += (Date.now() - new Date(breakStartTime).getTime()) / 1000;
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

// Format date key for overrides: YYYY-MM-DD
function ymdKey(d) {
  const iso = new Date(d).toISOString();
  return iso.slice(0, 10);
}

// ======================
// Effective Shift
// Returns: { start, end, isFlexible, isFlexiblePermanent }
// - start/end are "HH:MM" strings (or null for permanent flexible if you prefer)
// ======================
async function getEffectiveShift(userId, date) {
  const targetDate = new Date(date);
  targetDate.setHours(0, 0, 0, 0);

  const user = await User.findById(userId).lean();
  if (!user) throw new Error("User not found");

  // 1) If user has a shiftOverrides entry for that date (approved request stored on user),
  //    prefer it. (key stored as "YYYY-MM-DD")
  const key = ymdKey(targetDate);
  if (user.shiftOverrides && user.shiftOverrides[key]) {
    const ov = user.shiftOverrides[key];
    // ov expected: { start: "HH:MM", end: "HH:MM", durationHours: Number }
    return {
      start: ov.start || user?.shift?.start || "09:00",
      end: ov.end || user?.shift?.end || "18:00",
      isFlexible: true,
      isFlexiblePermanent: false,
      durationHours: ov.durationHours || user?.shift?.durationHours || 9,
    };
  }

  // 2) Permanent flexible user: always flexible
  if (user.shiftType === "flexiblePermanent") {
    // represent as full-day flexible
    return {
      start: "00:00",
      end: "23:59",
      isFlexible: true,
      isFlexiblePermanent: true,
      durationHours: user?.shift?.durationHours || 9,
    };
  }

  // 3) Check approved FlexibleShiftRequest for that date
  const flexShift = await FlexibleShiftRequest.findOne({
    employee: userId,
    requestedDate: targetDate,
    status: "approved",
  }).lean();

  if (flexShift) {
    const [startH, startM] = String(flexShift.requestedStartTime)
      .split(":")
      .map(Number);
    const duration = flexShift.durationHours || 9;
    let endH = startH + Math.floor(duration);
    let endM = startM + Math.round(((duration % 1) * 60) || 0);
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

  // 4) Default: standard shift from user.shift
  return {
    start: user?.shift?.start || "09:00",
    end: user?.shift?.end || "18:00",
    isFlexible: false,
    isFlexiblePermanent: false,
    durationHours: user?.shift?.durationHours || 9,
  };
}

// ======================
// Sync DailyWork
// Ensures DailyWork exists for the day and updates flags/durations
// ======================
async function syncDailyWork(userId, todayStatus) {
  const todayStart = new Date();
  todayStart.setHours(0, 0, 0, 0);

  const effectiveShift = await getEffectiveShift(userId, todayStart);

  // Build a shift object matching shiftForDaySchema
  const shiftObj = {
    name: "", // optional, left blank
    start: effectiveShift.start || "00:00",
    end: effectiveShift.end || "23:59",
    isFlexible: Boolean(effectiveShift.isFlexible || effectiveShift.isFlexiblePermanent),
  };

  let dailyWork = await DailyWork.findOne({ userId, date: todayStart });

  const computedShiftType = effectiveShift.isFlexiblePermanent
    ? "flexiblePermanent"
    : effectiveShift.isFlexible
    ? "flexibleRequest"
    : "standard";

  if (!dailyWork) {
    dailyWork = new DailyWork({
      userId,
      date: todayStart,
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

  // Populate durations from todayStatus
  dailyWork.workDurationSeconds = getWorkDurationSeconds(
    todayStatus.workedSessions,
    todayStatus.currentlyWorking
  );
  dailyWork.breakDurationSeconds = getBreakDurationSeconds(
    todayStatus.breakSessions,
    todayStatus.onBreak,
    todayStatus.breakStartTime
  );
  dailyWork.breakSessions = todayStatus.breakSessions || [];

  // Arrival checks: only for non-flexible days
  if (!effectiveShift.isFlexible && !effectiveShift.isFlexiblePermanent) {
    if (!dailyWork.arrivalTime && todayStatus.arrivalTime) {
      dailyWork.arrivalTime = todayStatus.arrivalTime;
    }
    if (dailyWork.arrivalTime && effectiveShift.start) {
      const [expHour, expMin] = String(effectiveShift.start).split(":").map(Number);
      const shiftStart = new Date(dailyWork.arrivalTime);
      shiftStart.setHours(expHour, expMin, 0, 0);

      dailyWork.isLate = dailyWork.arrivalTime > shiftStart;
      dailyWork.isEarly = dailyWork.arrivalTime < shiftStart;
    }
  } else {
    // Flexible days: ignore late/early
    dailyWork.arrivalTime = todayStatus.arrivalTime || dailyWork.arrivalTime || null;
    dailyWork.isLate = false;
    dailyWork.isEarly = false;
  }

  // Half-day / Absent logic (based purely on worked seconds)
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

// ======================
// GET /api/status
// ======================
async function getTodayStatus(req, res) {
  try {
    const userId = req.user._id;
    const todayStart = new Date();
    todayStart.setHours(0, 0, 0, 0);

    let todayStatus = await UserStatus.findOne({ userId, today: todayStart });
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

    const effectiveShift = await getEffectiveShift(userId, todayStart);

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
      lastSessionStart:
        todayStatus.currentlyWorking &&
        todayStatus.workedSessions.length &&
        !todayStatus.workedSessions[todayStatus.workedSessions.length - 1].end
          ? todayStatus.workedSessions[todayStatus.workedSessions.length - 1].start
          : null,
      breakStartTs: todayStatus.onBreak ? todayStatus.breakStartTime : null,
    });
  } catch (err) {
    console.error("Error fetching today's status:", err);
    res.status(500).json({ message: "Server error" });
  }
}

// ======================
// PUT /api/status
// ======================
async function updateTodayStatus(req, res) {
  try {
    const userId = req.user._id;
    const { onBreak, currentlyWorking, timelineEvent, breakStartTime } = req.body;

    const todayStart = new Date();
    todayStart.setHours(0, 0, 0, 0);

    let todayStatus = await UserStatus.findOne({ userId, today: todayStart });
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

    const effectiveShift = await getEffectiveShift(userId, todayStart);

    // Timeline events handling (robust order)
    const ws = todayStatus.workedSessions;
    const bs = todayStatus.breakSessions;

    if (timelineEvent?.type === "Punch In") {
      if (!todayStatus.arrivalTime) todayStatus.arrivalTime = new Date();
      if (!ws.length || ws[ws.length - 1].end) ws.push({ start: new Date() });
      await User.findByIdAndUpdate(userId, { status: "active" });
    }

    if (timelineEvent?.type === "Punch Out") {
      if (ws.length && !ws[ws.length - 1].end) ws[ws.length - 1].end = new Date();
      if (bs.length && !bs[bs.length - 1].end) bs[bs.length - 1].end = new Date();
      await User.findByIdAndUpdate(userId, { status: "inactive" });
    }

    if (timelineEvent?.type?.startsWith("Break Start")) {
      if (!bs.length || bs[bs.length - 1].end) bs.push({ start: new Date() });
      if (ws.length && !ws[ws.length - 1].end) ws[ws.length - 1].end = new Date();
    }

    if (timelineEvent?.type === "Resume Work") {
      if (bs.length && !bs[bs.length - 1].end) bs[bs.length - 1].end = new Date();
      if (!ws.length || ws[ws.length - 1].end) ws.push({ start: new Date() });
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

    // Sync DailyWork (this will create/update DailyWork and apply flags)
    const dailyWork = await syncDailyWork(userId, todayStatus);

    res.json({
      ...todayStatus.toObject(),
      effectiveShift,
      shiftType: dailyWork.shiftType,
      workDurationSeconds: todayStatus.workDurationSeconds,
      breakDurationSeconds: todayStatus.breakDurationSeconds,
      arrivalTimeFormatted: todayStatus.arrivalTime
        ? new Date(todayStatus.arrivalTime).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit", hour12: true })
        : null,
      lastSessionStart:
        todayStatus.currentlyWorking &&
        todayStatus.workedSessions.length &&
        !todayStatus.workedSessions[todayStatus.workedSessions.length - 1].end
          ? todayStatus.workedSessions[todayStatus.workedSessions.length - 1].start
          : null,
      breakStartTs: todayStatus.onBreak ? todayStatus.breakStartTime : null,
    });
  } catch (err) {
    console.error("Error updating today's status:", err);
    res.status(500).json({ message: "Server error" });
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
