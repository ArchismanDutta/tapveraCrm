// controllers/statusController.js
// Replaced date-fns-tz with native Intl-based TZ conversion helpers
const UserStatus = require("../models/UserStatus");
const DailyWork = require("../models/DailyWork");
const User = require("../models/User");
const FlexibleShiftRequest = require("../models/FlexibleShiftRequest");

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

  return tzMs - utcMs;
}

/**
 * Interpret the wall-clock time of `dateInput` in `timeZone` and return the
 * corresponding UTC Date object.
 *
 * Example: zonedTimeToUtc("2025-09-12T09:00:00", "Asia/Kolkata") -> Date object at UTC equivalent.
 */
function zonedTimeToUtc(dateInput, timeZone) {
  const date = new Date(dateInput);
  const parts = formatPartsFor(date, timeZone);

  // Build UTC timestamp for the wall clock fields (treat them as if they were UTC)
  const localAsUtcMs = Date.UTC(
    Number(parts.year),
    Number(parts.month) - 1,
    Number(parts.day),
    Number(parts.hour),
    Number(parts.minute),
    Number(parts.second)
  );

  // offset (tz - utc) in ms at that instant
  const tzOffsetMs = getTimeZoneOffsetMilliseconds(date, timeZone);

  // The real UTC instant for that wall-clock is: localAsUtcMs - tzOffsetMs
  return new Date(localAsUtcMs - tzOffsetMs);
}

/**
 * Convert a UTC (or any instant) Date to a Date representing the wall-clock time
 * in the provided timezone. Implementation returns a Date whose timestamp is
 * shifted so that its fields correspond to the target timezone's local time.
 *
 * NOTE: This returns a Date object you can use for comparisons of "local" times
 * (e.g. comparing arrivalLocal.setHours(...) etc.)
 */
function utcToZonedTime(dateInput, timeZone) {
  const date = new Date(dateInput);
  const tzOffsetMs = getTimeZoneOffsetMilliseconds(date, timeZone);
  // Shift the instant by offset (tz - utc). Adding offset moves the UTC instant
  // to the timezone's wall-clock representation.
  return new Date(date.getTime() + tzOffsetMs);
}

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

function ymdKey(dateInput) {
  const d = new Date(dateInput);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(
    2,
    "0"
  )}-${String(d.getDate()).padStart(2, "0")}`;
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
    const [startH, startM] = String(flexShift.requestedStartTime || "09:00")
      .split(":")
      .map(Number);
    const duration = flexShift.durationHours || 9;

    let endH = startH + Math.floor(duration);
    let endM = startM + Math.round((duration % 1) * 60);
    if (endM >= 60) {
      endH += 1;
      endM -= 60;
    }
    if (endH >= 24) endH -= 24;

    return {
      start: `${String(startH).padStart(2, "0")}:${String(startM).padStart(
        2,
        "0"
      )}`,
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
async function syncDailyWork(userId, todayStatus, userTimeZone = "UTC") {
  const todayLocal = new Date();
  todayLocal.setHours(0, 0, 0, 0);
  const todayUTC = zonedTimeToUtc(todayLocal, userTimeZone);

  const effectiveShift = await getEffectiveShift(userId, todayUTC);

  const shiftObj = {
    name: "",
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
  }

  const { isLate, isHalfDay, isAbsent } = calculateLateAndHalfDay(
    todayStatus.workDurationSeconds || 0,
    effectiveShift.start,
    todayStatus.arrivalTime,
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
// Update Today's Status
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
        if (!todayStatus.arrivalTime) todayStatus.arrivalTime = now;
        if (!ws.length || ws[ws.length - 1].end) ws.push({ start: now });
        todayStatus.currentlyWorking = true;
        todayStatus.onBreak = false;
        todayStatus.breakStartTime = null;
        await User.findByIdAndUpdate(userId, { status: "active" }).catch(
          () => {}
        );
      } else if (lower.includes("punch out")) {
        if (ws.length && !ws[ws.length - 1].end) ws[ws.length - 1].end = now;
        else if (!ws.length) ws.push({ start: now, end: now });
        if (bs.length && !bs[bs.length - 1].end) bs[bs.length - 1].end = now;
        todayStatus.currentlyWorking = false;
        todayStatus.onBreak = false;
        todayStatus.breakStartTime = null;
        await User.findByIdAndUpdate(userId, { status: "inactive" }).catch(
          () => {}
        );
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

      todayStatus.timeline = todayStatus.timeline || [];
      todayStatus.timeline.push({ type: rawType, time: now });

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

    const payload = {
      ...todayStatus.toObject(),
      effectiveShift,
      shiftType: dailyWork
        ? dailyWork.shiftType
        : todayStatus.shiftType || "standard",
      workDurationSeconds: todayStatus.workDurationSeconds,
      breakDurationSeconds: todayStatus.breakDurationSeconds,
      workDuration: secToHMS(todayStatus.workDurationSeconds),
      breakDuration: secToHMS(todayStatus.breakDurationSeconds),
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
      isLate: dailyWork?.isLate || false,
      isHalfDay: dailyWork?.isHalfDay || false,
      isAbsent: dailyWork?.isAbsent || false,
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

    return res.json(payload);
  } catch (err) {
    console.error("Error updating today's status:", err);
    return res
      .status(500)
      .json({ message: "Server error", error: err.message });
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
