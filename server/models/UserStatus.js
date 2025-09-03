const mongoose = require("mongoose");

// ======================
// Sub-schemas
// ======================

// Timeline event for punch-in/out or custom events
const TimelineEventSchema = new mongoose.Schema({
  type: { type: String, required: true }, // e.g., "Punch In", "Punch Out", "Break Start"
  time: { type: String, required: true }, // "HH:mm" format
});

// Worked session schema
const WorkedSessionSchema = new mongoose.Schema({
  start: { type: Date, required: true },
  end: { type: Date, default: null },
});

// Break session schema
const BreakSessionSchema = new mongoose.Schema({
  start: { type: Date, required: true },
  end: { type: Date, default: null },
});

// Quick weekly stats schema
const QuickStatsSchema = new mongoose.Schema({
  earlyArrivals: { type: Number, default: 0 },
  lateArrivals: { type: Number, default: 0 },
  perfectDays: { type: Number, default: 0 },
});

// Shift sub-schema
const ShiftSchema = new mongoose.Schema({
  name: { type: String, trim: true, default: "Morning 9-6" },
  start: {
    type: String,
    trim: true,
    default: "09:00",
    validate: {
      validator: (v) => /^\d{2}:\d{2}$/.test(v),
      message: "Shift start must be in HH:MM format",
    },
  },
  end: {
    type: String,
    trim: true,
    default: "18:00",
    validate: {
      validator: function (v) {
        if (!this.start || !v) return true;
        const [startH, startM] = this.start.split(":").map(Number);
        const [endH, endM] = v.split(":").map(Number);
        return startH !== endH || startM !== endM;
      },
      message: "Shift end time must differ from start time",
    },
  },
  durationHours: { type: Number, default: 9, min: 1, max: 24 },
  isFlexible: { type: Boolean, default: false }, // true for permanent flexible employees
});

// ======================
// Main UserStatus Schema
// ======================
const UserStatusSchema = new mongoose.Schema(
  {
    userId: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true, index: true },

    // Effective shift for the day
    shift: { type: ShiftSchema, default: () => ({}) },

    // Shift type: only two types now
    shiftType: {
      type: String,
      enum: ["standard", "flexiblePermanent"],
      default: "standard",
    },

    // Daily durations
    workDuration: { type: String, default: "0h 0m" }, // formatted string
    workDurationSeconds: { type: Number, default: 0 }, // numeric seconds
    totalWorkMs: { type: Number, default: 0 }, // precise ms
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

    // Optional recent activities (for dashboard)
    recentActivities: {
      type: [
        {
          date: { type: String, default: "" },
          activity: { type: String, default: "" },
          time: { type: String, default: "" },
        },
      ],
      default: [],
    },

    // Reference day (date normalized to start)
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
    isLate: { type: Boolean, default: false }, // only for standard shifts
    isHalfDay: { type: Boolean, default: false },
    isAbsent: { type: Boolean, default: false },
  },
  { timestamps: true }
);

// Compound index to ensure unique record per user per day
UserStatusSchema.index({ userId: 1, today: 1 }, { unique: true });

module.exports = mongoose.model("UserStatus", UserStatusSchema);
