// controllers/statusController.js

const UserStatus = require("../models/UserStatus");
const DailyWork = require("../models/DailyWork");

// Helpers
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
    total += (Date.now() - new Date(workedSessions[workedSessions.length - 1].start).getTime()) / 1000;
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

async function syncDailyWork(userId, todayStatus) {
  const todayDate = new Date();
  todayDate.setHours(0, 0, 0, 0);

  let dailyWork = await DailyWork.findOne({ userId, date: todayDate });
  if (!dailyWork) {
    dailyWork = new DailyWork({
      userId,
      date: todayDate,
      arrivalTime: todayStatus.arrivalTime || null,
      expectedStartTime: "09:00",
      workDurationSeconds: 0,
      breakDurationSeconds: 0,
      breakSessions: [],
    });
  }

  dailyWork.workDurationSeconds = getWorkDurationSeconds(todayStatus.workedSessions, todayStatus.currentlyWorking);
  dailyWork.breakDurationSeconds = getBreakDurationSeconds(todayStatus.breakSessions, todayStatus.onBreak, todayStatus.breakStartTime);

  if (!dailyWork.arrivalTime && todayStatus.arrivalTime) {
    dailyWork.arrivalTime = todayStatus.arrivalTime;
  }
  if (!dailyWork.expectedStartTime) {
    dailyWork.expectedStartTime = "09:00";
  }

  dailyWork.breakSessions = todayStatus.breakSessions || [];

  await dailyWork.save();
}

// GET /api/status
exports.getTodayStatus = async (req, res) => {
  try {
    const userId = req.user._id;
    if (!userId) return res.status(401).json({ message: "Unauthorized" });

    const todayStart = new Date();
    todayStart.setHours(0, 0, 0, 0);
    const tomorrowStart = new Date(todayStart);
    tomorrowStart.setDate(todayStart.getDate() + 1);

    let todayStatus = await UserStatus.findOne({
      userId,
      today: { $gte: todayStart, $lt: tomorrowStart },
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

    const workDurationSeconds = getWorkDurationSeconds(todayStatus.workedSessions, todayStatus.currentlyWorking);
    const breakDurationSeconds = getBreakDurationSeconds(todayStatus.breakSessions, todayStatus.onBreak, todayStatus.breakStartTime);

    res.json({
      ...todayStatus.toObject(),
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
};

// PUT /api/status
exports.updateTodayStatus = async (req, res) => {
  try {
    const userId = req.user._id;
    if (!userId) return res.status(401).json({ message: "Unauthorized" });

    const { onBreak, currentlyWorking, timelineEvent, breakStartTime } = req.body;

    const todayStart = new Date();
    todayStart.setHours(0, 0, 0, 0);
    const tomorrowStart = new Date(todayStart);
    tomorrowStart.setDate(todayStart.getDate() + 1);

    let todayStatus = await UserStatus.findOne({
      userId,
      today: { $gte: todayStart, $lt: tomorrowStart },
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

    // Validation for punch in/out duplication
    if (timelineEvent?.type === "Punch In") {
      if (todayStatus.timeline.some((e) => e.type === "Punch In")) {
        return res.status(400).json({ message: "Already punched in today" });
      }
      if (!todayStatus.arrivalTime) {
        todayStatus.arrivalTime = new Date();
      }
    }
    if (timelineEvent?.type === "Punch Out") {
      if (todayStatus.timeline.some((e) => e.type === "Punch Out")) {
        return res.status(400).json({ message: "Already punched out today" });
      }
    }

    if (onBreak !== undefined) todayStatus.onBreak = onBreak;
    if (currentlyWorking !== undefined) todayStatus.currentlyWorking = currentlyWorking;
    if (breakStartTime !== undefined) todayStatus.breakStartTime = breakStartTime;

    // Update workedSessions based on timeline event
    if (timelineEvent?.type === "Punch In" || timelineEvent?.type === "Resume Work") {
      const ws = todayStatus.workedSessions;
      if (!ws.length || ws[ws.length - 1].end) ws.push({ start: new Date() });
    }
    if (timelineEvent?.type.startsWith("Break Start") || timelineEvent?.type === "Punch Out") {
      const ws = todayStatus.workedSessions;
      if (ws.length && !ws[ws.length - 1].end) ws[ws.length - 1].end = new Date();
    }

    // Update breakSessions based on timeline event
    if (timelineEvent?.type.startsWith("Break Start")) {
      const bs = todayStatus.breakSessions;
      if (!bs.length || bs[bs.length - 1].end) bs.push({ start: new Date() });
    }
    if (timelineEvent?.type === "Resume Work" || timelineEvent?.type === "Punch Out") {
      const bs = todayStatus.breakSessions;
      if (bs.length && !bs[bs.length - 1].end) bs[bs.length - 1].end = new Date();
    }

    // Add to timeline and recentActivities
    if (timelineEvent?.type && timelineEvent?.time) {
      todayStatus.timeline.push(timelineEvent);
      todayStatus.recentActivities.unshift({
        date: new Date().toLocaleDateString(),
        activity: timelineEvent.type,
        time: timelineEvent.time,
      });
      if (todayStatus.recentActivities.length > 10) todayStatus.recentActivities.length = 10;
    }

    const workDurationSeconds = getWorkDurationSeconds(todayStatus.workedSessions, todayStatus.currentlyWorking);
    const breakDurationSeconds = getBreakDurationSeconds(todayStatus.breakSessions, todayStatus.onBreak, todayStatus.breakStartTime);

    todayStatus.totalWorkMs = workDurationSeconds * 1000;
    todayStatus.breakDurationSeconds = breakDurationSeconds;

    await todayStatus.save();
    await syncDailyWork(userId, todayStatus);

    res.json({
      ...todayStatus.toObject(),
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
};
