// File: models/UserStatus.js
const mongoose = require("mongoose");

// ======================
// Sub-schemas
// ======================
const TimelineEventSchema = new mongoose.Schema({
  type: { type: String, required: true },
  time: { type: String, required: true }, // format: HH:mm or "Punch In"/"Punch Out"
});

const WorkedSessionSchema = new mongoose.Schema({
  start: { type: Date, required: true },
  end: { type: Date },
});

const BreakSessionSchema = new mongoose.Schema({
  start: { type: Date, required: true },
  end: { type: Date },
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
    userId: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true },

    // Daily durations
    workDuration: { type: String, default: "0h 0m 0s" },
    totalWorkMs: { type: Number, default: 0 },
    breakDuration: { type: String, default: "0h 0m 0s" },
    breakDurationSeconds: { type: Number, default: 0 },
    workDurationSeconds: { type: Number, default: 0 },

    arrivalTime: { type: Date, default: null },
    currentlyWorking: { type: Boolean, default: false },
    onBreak: { type: Boolean, default: false },
    breakStartTime: { type: Date, default: null },

    workedSessions: [WorkedSessionSchema],
    breakSessions: [BreakSessionSchema],
    timeline: [TimelineEventSchema],

    // Weekly summary & quick stats
    weekSummary: {
      totalHours: { type: String, default: "0h 0m" },
      avgDaily: { type: String, default: "0h 0m" },
      onTimeRate: { type: String, default: "0%" },
      breaksTaken: { type: Number, default: 0 },
      quickStats: { type: QuickStatsSchema, default: () => ({}) },
    },

    // Recent activities
    recentActivities: [
      {
        date: { type: String },
        activity: { type: String },
        time: { type: String },
      },
    ],

    today: {
      type: Date,
      default: () => {
        const d = new Date();
        d.setHours(0, 0, 0, 0);
        return d;
      },
      index: true,
    },
  },
  { timestamps: true }
);

module.exports = mongoose.model("UserStatus", UserStatusSchema);
