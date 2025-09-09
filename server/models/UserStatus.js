const mongoose = require("mongoose");

const TimelineEventSchema = new mongoose.Schema({
  type: { type: String, required: true },
  time: { type: Date, required: true },
});

const WorkedSessionSchema = new mongoose.Schema({
  start: { type: Date, required: true },
  end: { type: Date, default: null },
});

const BreakSessionSchema = new mongoose.Schema({
  start: { type: Date, required: true },
  end: { type: Date, default: null },
  type: { type: String },
});

const QuickStatsSchema = new mongoose.Schema({
  earlyArrivals: { type: Number, default: 0 },
  lateArrivals: { type: Number, default: 0 },
  perfectDays: { type: Number, default: 0 },
});

const UserStatusSchema = new mongoose.Schema(
  {
    userId: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true, index: true },

    flexibleRequest: { type: Boolean, default: false },

    workDuration: { type: String, default: "0h 0m" },
    workDurationSeconds: { type: Number, default: 0 },
    totalWorkMs: { type: Number, default: 0 },
    breakDuration: { type: String, default: "0h 0m" },
    breakDurationSeconds: { type: Number, default: 0 },

    arrivalTime: { type: Date, default: null },
    currentlyWorking: { type: Boolean, default: false },
    onBreak: { type: Boolean, default: false },
    breakStartTime: { type: Date, default: null },

    workedSessions: { type: [WorkedSessionSchema], default: [] },
    breakSessions: { type: [BreakSessionSchema], default: [] },
    timeline: { type: [TimelineEventSchema], default: [] },

    weekSummary: {
      totalHours: { type: String, default: "0h 0m" },
      avgDaily: { type: String, default: "0h 0m" },
      onTimeRate: { type: String, default: "0%" },
      breaksTaken: { type: Number, default: 0 },
      quickStats: { type: QuickStatsSchema, default: () => ({}) },
    },

    recentActivities: { type: [{ date: Date, activity: String, time: String }], default: [] },

    today: {
      type: Date,
      default: () => {
        const d = new Date();
        d.setHours(0, 0, 0, 0);
        return d;
      },
      index: true,
    },

    isLate: { type: Boolean, default: false },
    isHalfDay: { type: Boolean, default: false },
    isAbsent: { type: Boolean, default: false },
  },
  { timestamps: true }
);

UserStatusSchema.index({ userId: 1, today: 1 }, { unique: true });

UserStatusSchema.pre("save", function (next) {
  if (this.timeline && this.timeline.length > 0) {
    this.timeline = this.timeline.map((e) => ({
      type: e.type,
      time: e.time instanceof Date ? e.time : new Date(e.time),
    }));
  }
  next();
});

// -----------------------------
// Utility to recalc durations
// -----------------------------
UserStatusSchema.methods.recalculateDurations = function () {
  const now = new Date();

  // Work duration
  let workSecs = 0;
  this.workedSessions.forEach((s) => {
    const start = new Date(s.start);
    const end = s.end ? new Date(s.end) : (this.currentlyWorking ? now : start);
    workSecs += Math.max(0, Math.floor((end - start) / 1000));
  });
  this.workDurationSeconds = workSecs;
  this.totalWorkMs = workSecs * 1000;
  this.workDuration = `${Math.floor(workSecs / 3600)}h ${Math.floor((workSecs % 3600) / 60)
    }m`;

  // Break duration
  let breakSecs = 0;
  this.breakSessions.forEach((b) => {
    const start = new Date(b.start);
    const end = b.end ? new Date(b.end) : (this.onBreak ? now : start);
    breakSecs += Math.max(0, Math.floor((end - start) / 1000));
  });
  this.breakDurationSeconds = breakSecs;
  this.breakDuration = `${Math.floor(breakSecs / 3600)}h ${Math.floor((breakSecs % 3600) / 60)}m`;
};

// -----------------------------
// Punch / Break Methods
// -----------------------------
UserStatusSchema.methods.punchIn = async function () {
  if (this.currentlyWorking) throw new Error("Already punched in");

  const now = new Date();
  this.arrivalTime = now;
  this.currentlyWorking = true;
  this.onBreak = false;
  this.breakStartTime = null;

  this.timeline.push({ type: "punchIn", time: now });
  this.workedSessions.push({ start: now });

  this.recalculateDurations();
  await this.save();
};

UserStatusSchema.methods.punchOut = async function () {
  if (!this.currentlyWorking) throw new Error("Not currently working");

  const now = new Date();
  const lastWork = this.workedSessions[this.workedSessions.length - 1];
  if (!lastWork.end) lastWork.end = now;

  this.currentlyWorking = false;
  this.onBreak = false;
  this.breakStartTime = null;

  this.timeline.push({ type: "punchOut", time: now });

  this.recalculateDurations();
  await this.save();
};

UserStatusSchema.methods.startBreak = async function (type) {
  const now = new Date();

  if (!this.currentlyWorking) throw new Error("Cannot start break when not working");

  this.onBreak = true;
  this.currentlyWorking = false;
  this.breakStartTime = now;

  // Close last work session
  const lastWork = this.workedSessions[this.workedSessions.length - 1];
  if (lastWork && !lastWork.end) lastWork.end = now;

  const newBreak = { start: now };
  if (type) newBreak.type = type;
  this.breakSessions.push(newBreak);

  this.timeline.push({ type: "breakStart", time: now });

  this.recalculateDurations();
  await this.save();
};

UserStatusSchema.methods.resumeWork = async function () {
  const now = new Date();

  if (!this.onBreak) throw new Error("Not on break");

  this.onBreak = false;
  this.currentlyWorking = true;
  this.breakStartTime = null;

  // Close last break
  const lastBreak = this.breakSessions[this.breakSessions.length - 1];
  if (lastBreak && !lastBreak.end) lastBreak.end = now;

  this.workedSessions.push({ start: now });

  this.timeline.push({ type: "resumeWork", time: now });

  this.recalculateDurations();
  await this.save();
};

// -----------------------------
// Late / Half-Day / Absent calculation
// -----------------------------
UserStatusSchema.methods.updateAttendanceFlags = function (effectiveShift) {
  // Skip for flexible permanent
  if (effectiveShift.isFlexiblePermanent) {
    this.isLate = false;
    this.isHalfDay = false;
    this.isAbsent = false;
    return;
  }

  const minHalf = 5 * 3600;
  const minFull = 8 * 3600;

  // Late
  if (effectiveShift.start && this.arrivalTime) {
    const shiftStart = new Date(this.today);
    const [h, m] = effectiveShift.start.split(":").map(Number);
    shiftStart.setHours(h, m, 0, 0);
    this.isLate = this.arrivalTime > shiftStart;
  } else this.isLate = false;

  // Half day / absent
  this.isHalfDay = this.workDurationSeconds >= minHalf && this.workDurationSeconds < minFull;
  this.isAbsent = this.workDurationSeconds < minHalf;
};

module.exports = mongoose.model("UserStatus", UserStatusSchema);
