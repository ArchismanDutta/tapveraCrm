// controllers/statusController.js
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

  // handle ongoing session
  if (currentlyWorking && workedSessions.length) {
    const last = workedSessions[workedSessions.length - 1];
    if (!last.end && last.start) {
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

  // handle ongoing break
  if (onBreak) {
    const last = breakSessions.length ? breakSessions[breakSessions.length - 1] : null;
    if (last && !last.end && last.start) {
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
  const iso = new Date(date).toISOString();
  return iso.slice(0, 10);
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
    const [startH, startM] = String(flexShift.requestedStartTime).split(":").map(Number);
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
// Sync DailyWork
// -----------------------
async function syncDailyWork(userId, todayStatus) {
  const today = new Date();
  today.setHours(0, 0, 0, 0);

  const effectiveShift = await getEffectiveShift(userId, today);

  const shiftObj = {
    name: "",
    start: effectiveShift.start || "00:00",
    end: effectiveShift.end || "23:59",
    isFlexible: Boolean(effectiveShift.isFlexible || effectiveShift.isFlexiblePermanent),
    durationHours: effectiveShift.durationHours || 9,
  };

  let dailyWork = await DailyWork.findOne({ userId, date: today });

  const computedShiftType = effectiveShift.isFlexiblePermanent ? "flexiblePermanent" : "standard";

  if (!dailyWork) {
    dailyWork = new DailyWork({
      userId,
      userStatusId: todayStatus._id,
      date: today,
      expectedStartTime: effectiveShift.isFlexiblePermanent || effectiveShift.isFlexible ? null : effectiveShift.start,
      shift: shiftObj,
      shiftType: computedShiftType,
      workDurationSeconds: 0,
      breakDurationSeconds: 0,
      breakSessions: [],
    });
  } else {
    dailyWork.shift = shiftObj;
    dailyWork.expectedStartTime = effectiveShift.isFlexiblePermanent || effectiveShift.isFlexible ? null : effectiveShift.start;
    dailyWork.shiftType = computedShiftType;
    dailyWork.userStatusId = todayStatus._id;
  }

  dailyWork.workDurationSeconds = getWorkDurationSeconds(todayStatus.workedSessions, todayStatus.currentlyWorking);
  dailyWork.breakDurationSeconds = getBreakDurationSeconds(todayStatus.breakSessions, todayStatus.onBreak, todayStatus.breakStartTime);

  dailyWork.breakSessions = (todayStatus.breakSessions || []).map(b => ({
    start: b.start,
    end: b.end || null,
    type: b.type || undefined,
  }));

  await dailyWork.save();
  return dailyWork;
}

// -----------------------
// Get Today's Status
// -----------------------
async function getTodayStatus(req, res) {
  try {
    const userId = req.user._id;
    const todayStart = new Date();
    todayStart.setHours(0, 0, 0, 0);
    const todayEnd = new Date();
    todayEnd.setHours(23, 59, 59, 999);

    let todayStatus = await UserStatus.findOne({ userId, today: { $gte: todayStart, $lte: todayEnd } });
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

    const payload = {
      ...todayStatus.toObject(),
      effectiveShift,
      workDurationSeconds: workSecs,
      breakDurationSeconds: breakSecs,
      workDuration: secToHMS(workSecs),
      breakDuration: secToHMS(breakSecs),
      arrivalTimeFormatted: todayStatus.arrivalTime ? new Date(todayStatus.arrivalTime).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit", hour12: true }) : null,
    };

    res.json(payload);
  } catch (err) {
    console.error("Error fetching today's status:", err);
    res.status(500).json({ message: "Server error", error: err.message });
  }
}

// -----------------------
// Update Today's Status
// -----------------------
async function updateTodayStatus(req, res) {
  try {
    const userId = req.user._id;
    const { timelineEvent } = req.body;

    const todayStart = new Date();
    todayStart.setHours(0, 0, 0, 0);
    const todayEnd = new Date();
    todayEnd.setHours(23, 59, 59, 999);

    let todayStatus = await UserStatus.findOne({ userId, today: { $gte: todayStart, $lte: todayEnd } });
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

      // ---------- punch in ----------
      if (lower.includes("punch in")) {
        if (!todayStatus.arrivalTime) todayStatus.arrivalTime = now;
        if (!ws.length || ws[ws.length - 1].end) ws.push({ start: now });
        todayStatus.currentlyWorking = true;
        todayStatus.onBreak = false;
        todayStatus.breakStartTime = null;
        await User.findByIdAndUpdate(userId, { status: "active" }).catch(() => {});
      }

      // ---------- punch out ----------
      else if (lower.includes("punch out")) {
        if (ws.length && !ws[ws.length - 1].end) ws[ws.length - 1].end = now;
        else if (!ws.length) ws.push({ start: now, end: now });

        if (bs.length && !bs[bs.length - 1].end) bs[bs.length - 1].end = now;

        todayStatus.currentlyWorking = false;
        todayStatus.onBreak = false;
        todayStatus.breakStartTime = null;
        await User.findByIdAndUpdate(userId, { status: "inactive" }).catch(() => {});
      }

      // ---------- break start ----------
      else if (lower.includes("break start")) {
        if (!bs.length || bs[bs.length - 1].end) {
          const newBreak = { start: now };
          if (breakType) newBreak.type = breakType;
          bs.push(newBreak);
        }
        if (ws.length && !ws[ws.length - 1].end) ws[ws.length - 1].end = now;
        todayStatus.currentlyWorking = false;
        todayStatus.onBreak = true;
        todayStatus.breakStartTime = now;
      }

      // ---------- resume work ----------
      else if (lower.includes("resume")) {
        if (bs.length && !bs[bs.length - 1].end) bs[bs.length - 1].end = now;
        if (!ws.length || ws[ws.length - 1].end) ws.push({ start: now });
        todayStatus.currentlyWorking = true;
        todayStatus.onBreak = false;
        todayStatus.breakStartTime = null;
      }

      todayStatus.timeline = todayStatus.timeline || [];
      todayStatus.timeline.push({ type: rawType, time: now });

      todayStatus.recentActivities = todayStatus.recentActivities || [];
      todayStatus.recentActivities.unshift({
        date: now.toLocaleDateString(),
        activity: rawType,
        time: now.toLocaleTimeString(),
      });
      if (todayStatus.recentActivities.length > 10) todayStatus.recentActivities.length = 10;
    }

    todayStatus.workDurationSeconds = getWorkDurationSeconds(ws, todayStatus.currentlyWorking);
    todayStatus.breakDurationSeconds = getBreakDurationSeconds(bs, todayStatus.onBreak, todayStatus.breakStartTime);
    todayStatus.totalWorkMs = todayStatus.workDurationSeconds * 1000;

    todayStatus.workedSessions = ws;
    todayStatus.breakSessions = bs;

    await todayStatus.save();

    // sync daily work (skip expectedStartTime for flexible employees)
    const dailyWork = await syncDailyWork(userId, todayStatus).catch(e => {
      console.error("syncDailyWork error:", e);
      return null;
    });

    const effectiveShift = await getEffectiveShift(userId, todayStart);

    const payload = {
      ...todayStatus.toObject(),
      effectiveShift,
      shiftType: dailyWork ? dailyWork.shiftType : (todayStatus.shiftType || "standard"),
      workDurationSeconds: todayStatus.workDurationSeconds,
      breakDurationSeconds: todayStatus.breakDurationSeconds,
      workDuration: secToHMS(todayStatus.workDurationSeconds),
      breakDuration: secToHMS(todayStatus.breakDurationSeconds),
      arrivalTimeFormatted: todayStatus.arrivalTime ? new Date(todayStatus.arrivalTime).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit", hour12: true }) : null,
      dailyWork: dailyWork ? {
        id: dailyWork._id,
        date: dailyWork.date,
        workDurationSeconds: dailyWork.workDurationSeconds,
        breakDurationSeconds: dailyWork.breakDurationSeconds,
        breakSessions: dailyWork.breakSessions || [],
        shift: dailyWork.shift || {},
        shiftType: dailyWork.shiftType || "standard",
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
  secToHMS,
  secToHM,
};
