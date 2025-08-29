// File: controllers/statusController.js

const UserStatus = require("../models/UserStatus");
const DailyWork = require("../models/DailyWork");
const User = require("../models/User");
const FlexibleShiftRequest = require("../models/FlexibleShiftRequest");

// ======================
// Helpers
// ======================
function getWorkDurationSeconds(workedSessions, currentlyWorking) {
  let total = workedSessions.reduce(
    (sum, s) => (s.start && s.end ? sum + (s.end - s.start) / 1000 : sum),
    0
  );
  if (
    currentlyWorking &&
    workedSessions.length &&
    !workedSessions[workedSessions.length - 1].end
  ) {
    total +=
      (Date.now() - new Date(workedSessions[workedSessions.length - 1].start).getTime()) / 1000;
  }
  return Math.floor(total);
}

function getBreakDurationSeconds(breakSessions, onBreak, breakStartTime) {
  let total = breakSessions.reduce(
    (sum, s) => (s.start && s.end ? sum + (s.end - s.start) / 1000 : sum),
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
  return `${h}h ${m.toString().padStart(2, "0")}m ${s.toString().padStart(2, "0")}s`;
}

// ======================
// Get effective shift
// ======================
async function getEffectiveShift(userId, date) {
  const todayDate = new Date(date);
  todayDate.setHours(0, 0, 0, 0);

  const flexShift = await FlexibleShiftRequest.findOne({
    employee: userId,
    requestedDate: todayDate,
    status: "approved",
  });

  if (flexShift) {
    const [startHour, startMin] = flexShift.requestedStartTime.split(":").map(Number);
    const start = `${String(startHour).padStart(2, "0")}:${String(startMin).padStart(2, "0")}`;
    const endHour = startHour + (flexShift.durationHours || 9);
    const end = `${String(endHour).padStart(2, "0")}:${String(startMin).padStart(2, "0")}`;
    return { start, end };
  }

  const user = await User.findById(userId);
  return { start: user?.shift?.start || "09:00", end: user?.shift?.end || "18:00" };
}

// ======================
// Sync DailyWork with UserStatus
// ======================
async function syncDailyWork(userId, todayStatus) {
  const todayDate = new Date();
  todayDate.setHours(0, 0, 0, 0);

  const effectiveShift = await getEffectiveShift(userId, todayDate);

  let dailyWork = await DailyWork.findOne({ userId, date: todayDate });

  if (!dailyWork) {
    // Create new DailyWork
    dailyWork = new DailyWork({
      userId,
      date: todayDate,
      arrivalTime: todayStatus.arrivalTime || null,
      expectedStartTime: effectiveShift.start,
      shift: effectiveShift, // <--- ADD SHIFT HERE
      workDurationSeconds: 0,
      breakDurationSeconds: 0,
      breakSessions: [],
    });
  } else {
    // Update existing DailyWork
    dailyWork.shift = effectiveShift; // <-- ensure shift is always up-to-date
    dailyWork.expectedStartTime = effectiveShift.start;
  }

  // Update durations
  dailyWork.workDurationSeconds = getWorkDurationSeconds(
    todayStatus.workedSessions,
    todayStatus.currentlyWorking
  );
  dailyWork.breakDurationSeconds = getBreakDurationSeconds(
    todayStatus.breakSessions,
    todayStatus.onBreak,
    todayStatus.breakStartTime
  );

  // Arrival time logic
  if (!dailyWork.arrivalTime && todayStatus.arrivalTime) {
    dailyWork.arrivalTime = todayStatus.arrivalTime;

    const [expHour, expMin] = effectiveShift.start.split(":").map(Number);
    const shiftStart = new Date(dailyWork.arrivalTime);
    shiftStart.setHours(expHour, expMin, 0, 0);

    dailyWork.isLate = dailyWork.arrivalTime > shiftStart;
    dailyWork.isEarly = dailyWork.arrivalTime < shiftStart;
  }

  // Update break sessions
  dailyWork.breakSessions = todayStatus.breakSessions || [];

  await dailyWork.save();
}

// ======================
// GET /api/status
// ======================
async function getTodayStatus(req, res) {
  try {
    const userId = req.user._id;
    if (!userId) return res.status(401).json({ message: "Unauthorized" });

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

    const workDurationSeconds = getWorkDurationSeconds(todayStatus.workedSessions, todayStatus.currentlyWorking);
    const breakDurationSeconds = getBreakDurationSeconds(todayStatus.breakSessions, todayStatus.onBreak, todayStatus.breakStartTime);

    const effectiveShift = await getEffectiveShift(userId, todayStart);

    res.json({
      ...todayStatus.toObject(),
      effectiveShift,
      arrivalTimeFormatted: todayStatus.arrivalTime
        ? new Date(todayStatus.arrivalTime).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit", hour12: true })
        : null,
      workDurationSeconds,
      breakDurationSeconds,
      workDuration: secToHMS(workDurationSeconds),
      breakDuration: secToHMS(breakDurationSeconds),
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
    if (!userId) return res.status(401).json({ message: "Unauthorized" });

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

    // Punch In
    if (timelineEvent?.type === "Punch In") {
      if (todayStatus.timeline.some((e) => e.type === "Punch In"))
        return res.status(400).json({ message: "Already punched in today" });

      if (!todayStatus.arrivalTime) todayStatus.arrivalTime = new Date();
      await User.findByIdAndUpdate(userId, { status: "active" });
    }

    // Punch Out
    if (timelineEvent?.type === "Punch Out") {
      if (todayStatus.timeline.some((e) => e.type === "Punch Out"))
        return res.status(400).json({ message: "Already punched out today" });

      await User.findByIdAndUpdate(userId, { status: "inactive" });
    }

    // Update break & working flags
    if (onBreak !== undefined) todayStatus.onBreak = onBreak;
    if (currentlyWorking !== undefined) todayStatus.currentlyWorking = currentlyWorking;
    if (breakStartTime !== undefined) todayStatus.breakStartTime = breakStartTime;

    // Handle work & break sessions
    const ws = todayStatus.workedSessions;
    const bs = todayStatus.breakSessions;

    if (timelineEvent?.type === "Punch In" || timelineEvent?.type === "Resume Work") {
      if (!ws.length || ws[ws.length - 1].end) ws.push({ start: new Date() });
    }
    if (timelineEvent?.type?.startsWith("Break Start") || timelineEvent?.type === "Punch Out") {
      if (ws.length && !ws[ws.length - 1].end) ws[ws.length - 1].end = new Date();
    }
    if (timelineEvent?.type?.startsWith("Break Start")) {
      if (!bs.length || bs[bs.length - 1].end) bs.push({ start: new Date() });
    }
    if (timelineEvent?.type === "Resume Work" || timelineEvent?.type === "Punch Out") {
      if (bs.length && !bs[bs.length - 1].end) bs[bs.length - 1].end = new Date();
    }

    // Timeline + recent activities
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

    const workDurationSeconds = getWorkDurationSeconds(todayStatus.workedSessions, todayStatus.currentlyWorking);
    const breakDurationSeconds = getBreakDurationSeconds(todayStatus.breakSessions, todayStatus.onBreak, todayStatus.breakStartTime);

    todayStatus.totalWorkMs = workDurationSeconds * 1000;
    todayStatus.breakDurationSeconds = breakDurationSeconds;

    await todayStatus.save();
    await syncDailyWork(userId, todayStatus); // <-- DailyWork now includes shift

    res.json({
      ...todayStatus.toObject(),
      effectiveShift,
      workDurationSeconds,
      breakDurationSeconds,
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

// ======================
// Exports
// ======================
module.exports = { getTodayStatus, updateTodayStatus, syncDailyWork, getEffectiveShift };
