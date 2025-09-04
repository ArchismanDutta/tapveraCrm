const mongoose = require("mongoose");

// ======================
// Sub-schemas
// ======================
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
});

const QuickStatsSchema = new mongoose.Schema({
  earlyArrivals: { type: Number, default: 0 },
  lateArrivals: { type: Number, default: 0 },
  perfectDays: { type: Number, default: 0 },
});

// ======================
// Main UserStatus Schema
// ======================
const UserStatusSchema = new mongoose.Schema(
  {
    userId: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true, index: true },

    // Flag for single-day flexible request for standard employees
    flexibleRequest: { type: Boolean, default: false },

    // Daily durations
    workDuration: { type: String, default: "0h 0m" },
    workDurationSeconds: { type: Number, default: 0 },
    totalWorkMs: { type: Number, default: 0 },
    breakDuration: { type: String, default: "0h 0m" },
    breakDurationSeconds: { type: Number, default: 0 },

    // Punch / status flags
    arrivalTime: { type: Date, default: null },
    currentlyWorking: { type: Boolean, default: false },
    onBreak: { type: Boolean, default: false },
    breakStartTime: { type: Date, default: null },

    // Session tracking
    workedSessions: { type: [WorkedSessionSchema], default: [] },
    breakSessions: { type: [BreakSessionSchema], default: [] },
    timeline: { type: [TimelineEventSchema], default: [] },

    // Weekly summary & quick stats
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

    // Attendance flags
    isLate: { type: Boolean, default: false },
    isHalfDay: { type: Boolean, default: false },
    isAbsent: { type: Boolean, default: false },
  },
  { timestamps: true }
);

// Compound index: unique per user per day
UserStatusSchema.index({ userId: 1, today: 1 }, { unique: true });

// ======================
// Pre-save hook: ensure timeline entries are Date objects
// ======================
UserStatusSchema.pre("save", function (next) {
  if (this.timeline && this.timeline.length > 0) {
    this.timeline = this.timeline.map((e) => ({
      type: e.type,
      time: e.time instanceof Date ? e.time : new Date(e.time),
    }));
  }
  next();
});

// ======================
// Static helper: create or fetch today's status
// ======================
UserStatusSchema.statics.createOrFetchToday = async function (userId, applyFlexibleRequest = false) {
  const startOfDay = new Date();
  startOfDay.setHours(0, 0, 0, 0);

  const endOfDay = new Date();
  endOfDay.setHours(23, 59, 59, 999);

  let status = await this.findOne({
    userId,
    today: { $gte: startOfDay, $lte: endOfDay },
  });

  if (!status) {
    status = new this({ userId, flexibleRequest: applyFlexibleRequest });
    await status.save();
  } else if (applyFlexibleRequest) {
    status.flexibleRequest = true;
    await status.save();
  }

  return status;
};

// ======================
// Instance helper: punch in
// ======================
UserStatusSchema.methods.punchIn = async function () {
  if (this.currentlyWorking) throw new Error("Already punched in");

  const now = new Date();
  this.arrivalTime = now;
  this.currentlyWorking = true;
  this.timeline.push({ type: "punchIn", time: now });
  this.workedSessions.push({ start: now });
  await this.save();
};

// ======================
// Instance helper: punch out
// ======================
UserStatusSchema.methods.punchOut = async function () {
  const now = new Date();

  if (!this.currentlyWorking) throw new Error("Not currently working");

  // Close last worked session
  if (this.workedSessions.length > 0) {
    const lastSession = this.workedSessions[this.workedSessions.length - 1];
    if (!lastSession.end) lastSession.end = now;
  } else {
    this.workedSessions.push({ start: now, end: now });
  }

  // Calculate total worked seconds
  const totalSeconds = this.workedSessions.reduce((acc, session) => {
    const start = session.start instanceof Date ? session.start : new Date(session.start);
    const end = session.end instanceof Date ? session.end : now;
    return acc + Math.max(0, Math.floor((end - start) / 1000));
  }, 0);

  this.workDurationSeconds = totalSeconds;
  const hours = Math.floor(totalSeconds / 3600);
  const minutes = Math.floor((totalSeconds % 3600) / 60);
  this.workDuration = `${hours}h ${minutes}m`;

  this.currentlyWorking = false;
  this.timeline.push({ type: "punchOut", time: now });

  await this.save();
};

module.exports = mongoose.model("UserStatus", UserStatusSchema);
