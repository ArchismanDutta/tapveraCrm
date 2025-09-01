const UserStatus = require("../models/UserStatus");
const DailyWork = require("../models/DailyWork");
const User = require("../models/User");
const FlexibleShiftRequest = require("../models/FlexibleShiftRequest");

const MIN_HALF_DAY_SECONDS = 5 * 3600; // 5 hours for half day
const MIN_FULL_DAY_SECONDS = 8 * 3600; // optional: full day threshold

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

// ======================
// Effective Shift
// ======================
async function getEffectiveShift(userId, date) {
  const targetDate = new Date(date);
  targetDate.setHours(0, 0, 0, 0);

  const user = await User.findById(userId);

  if (user.shiftType === "flexiblePermanent") {
    return {
      start: null,
      end: null,
      isFlexiblePermanent: true,
      isFlexible: false,
    };
  }

  const flexShift = await FlexibleShiftRequest.findOne({
    employee: userId,
    requestedDate: targetDate,
    status: "approved",
  });

  if (flexShift) {
    const [startH, startM] = flexShift.requestedStartTime.split(":").map(Number);
    let endH = startH + Math.floor(flexShift.durationHours || 9);
    let endM = startM + Math.round(((flexShift.durationHours || 9) % 1) * 60);
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
    };
  }

  return {
    start: user?.shift?.start || "09:00",
    end: user?.shift?.end || "18:00",
    isFlexible: false,
    isFlexiblePermanent: false,
  };
}

// ======================
// Sync DailyWork
// ======================
async function syncDailyWork(userId, todayStatus) {
  const todayDate = new Date();
  todayDate.setHours(0, 0, 0, 0);

  let effectiveShift = await getEffectiveShift(userId, todayDate);

  if (effectiveShift.isFlexiblePermanent) {
    effectiveShift = {
      ...effectiveShift,
      start: "00:00",
      end: "23:59",
      isFlexible: false,
    };
  }

  let dailyWork = await DailyWork.findOne({ userId, date: todayDate });

  if (!dailyWork) {
    dailyWork = new DailyWork({
      userId,
      date: todayDate,
      arrivalTime: todayStatus.arrivalTime || null,
      expectedStartTime: effectiveShift.start,
      shift: effectiveShift,
      shiftType: effectiveShift.isFlexiblePermanent ? "flexiblePermanent" : "standard",
      workDurationSeconds: 0,
      breakDurationSeconds: 0,
      breakSessions: [],
    });
  } else {
    dailyWork.shift = effectiveShift;
    dailyWork.expectedStartTime = effectiveShift.start;
  }

  dailyWork.workDurationSeconds = getWorkDurationSeconds(todayStatus.workedSessions, todayStatus.currentlyWorking);
  dailyWork.breakDurationSeconds = getBreakDurationSeconds(todayStatus.breakSessions, todayStatus.onBreak, todayStatus.breakStartTime);
  dailyWork.breakSessions = todayStatus.breakSessions || [];

  // Arrival checks
  if (!effectiveShift.isFlexiblePermanent && !dailyWork.arrivalTime && todayStatus.arrivalTime) {
    dailyWork.arrivalTime = todayStatus.arrivalTime;
    const [expHour, expMin] = effectiveShift.start.split(":").map(Number);
    const shiftStart = new Date(dailyWork.arrivalTime);
    shiftStart.setHours(expHour, expMin, 0, 0);

    dailyWork.isLate = dailyWork.arrivalTime > shiftStart;
    dailyWork.isEarly = dailyWork.arrivalTime < shiftStart;
  }

  // Flexible permanent
  if (effectiveShift.isFlexiblePermanent) {
    dailyWork.arrivalTime = todayStatus.arrivalTime || null;
    dailyWork.isLate = false;
    dailyWork.isEarly = false;
  }

  // Half-day / Absent logic
  if (dailyWork.workDurationSeconds >= MIN_HALF_DAY_SECONDS) {
    dailyWork.isHalfDay = dailyWork.workDurationSeconds < MIN_FULL_DAY_SECONDS;
    dailyWork.isAbsent = false;
  } else {
    dailyWork.isHalfDay = false;
    dailyWork.isAbsent = true;
  }

  await dailyWork.save();
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
    const workDurationSeconds = getWorkDurationSeconds(
      todayStatus.workedSessions,
      todayStatus.currentlyWorking
    );
    const breakDurationSeconds = getBreakDurationSeconds(
      todayStatus.breakSessions,
      todayStatus.onBreak,
      todayStatus.breakStartTime
    );

    res.json({
      ...todayStatus.toObject(),
      effectiveShift,
      workDurationSeconds,
      breakDurationSeconds,
      workDuration: secToHMS(workDurationSeconds),
      breakDuration: secToHMS(breakDurationSeconds),
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

    // Timeline events
    if (timelineEvent?.type === "Punch In") {
      if (todayStatus.timeline.some((e) => e.type === "Punch In"))
        return res.status(400).json({ message: "Already punched in today" });
      if (!todayStatus.arrivalTime) todayStatus.arrivalTime = new Date();
      await User.findByIdAndUpdate(userId, { status: "active" });
    }

    if (timelineEvent?.type === "Punch Out") {
      if (todayStatus.timeline.some((e) => e.type === "Punch Out"))
        return res.status(400).json({ message: "Already punched out today" });
      await User.findByIdAndUpdate(userId, { status: "inactive" });
    }

    if (onBreak !== undefined) todayStatus.onBreak = onBreak;
    if (currentlyWorking !== undefined) todayStatus.currentlyWorking = currentlyWorking;
    if (breakStartTime !== undefined) todayStatus.breakStartTime = breakStartTime;

    const ws = todayStatus.workedSessions;
    const bs = todayStatus.breakSessions;

    if (timelineEvent?.type === "Punch In" || timelineEvent?.type === "Resume Work") {
      if (!ws.length || ws[ws.length - 1].end) ws.push({ start: new Date() });
    }

    if (
      timelineEvent?.type?.startsWith("Break Start") ||
      timelineEvent?.type === "Punch Out"
    ) {
      if (ws.length && !ws[ws.length - 1].end) ws[ws.length - 1].end = new Date();
    }

    if (timelineEvent?.type?.startsWith("Break Start")) {
      if (!bs.length || bs[bs.length - 1].end) bs.push({ start: new Date() });
    }

    if (timelineEvent?.type === "Resume Work" || timelineEvent?.type === "Punch Out") {
      if (bs.length && !bs[bs.length - 1].end) bs[bs.length - 1].end = new Date();
    }

    if (timelineEvent?.type && timelineEvent?.time) {
      todayStatus.timeline.push(timelineEvent);
      todayStatus.recentActivities.unshift({
        date: new Date().toLocaleDateString(),
        activity: timelineEvent.type,
        time: timelineEvent.time,
      });
      if (todayStatus.recentActivities.length > 10)
        todayStatus.recentActivities.length = 10;
    }

    todayStatus.workDurationSeconds = getWorkDurationSeconds(ws, todayStatus.currentlyWorking);
    todayStatus.breakDurationSeconds = getBreakDurationSeconds(bs, todayStatus.onBreak, todayStatus.breakStartTime);
    todayStatus.totalWorkMs = todayStatus.workDurationSeconds * 1000;

    await todayStatus.save();
    await syncDailyWork(userId, todayStatus);

    res.json({
      ...todayStatus.toObject(),
      effectiveShift,
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
