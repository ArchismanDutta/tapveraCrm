const mongoose = require("mongoose");

// ======================
// Sub-schema: Break Session
// ======================
const breakSessionSchema = new mongoose.Schema({
  start: { type: Date, required: true },
  end: { type: Date, default: null },
});

// ======================
// Sub-schema: Shift for the day
// ======================
const shiftForDaySchema = new mongoose.Schema({
  name: { type: String, trim: true, default: "" },
  start: {
    type: String,
    trim: true,
    required: true,
    validate: {
      validator: (v) => /^\d{2}:\d{2}$/.test(v),
      message: "Shift start must be in HH:MM format",
    },
  },
  end: {
    type: String,
    trim: true,
    required: true,
    validate: {
      validator: function (v) {
        if (!this.start || !v) return true;

        // Parse times
        const [startH, startM] = this.start.split(":").map(Number);
        const [endH, endM] = v.split(":").map(Number);
        const startMinutes = startH * 60 + startM;
        const endMinutes = endH * 60 + endM;

        // Allow distinct start and end times (including overnight)
        return endMinutes !== startMinutes;
      },
      message:
        "Shift end time must be different from start time (same-day or overnight allowed)",
    },
  },
  durationHours: { type: Number, default: 9, min: 1, max: 24 },
  isFlexible: { type: Boolean, default: false }, // true for flexibleRequest or flexiblePermanent
});

// ======================
// Main DailyWork Schema
// ======================
const DailyWorkSchema = new mongoose.Schema({
  userId: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true },
  date: { type: Date, required: true },
  arrivalTime: { type: Date, default: null },
  expectedStartTime: { type: String, default: null }, // for flexible requests
  shift: { type: shiftForDaySchema, required: true },

  // Shift Type: standard | flexibleRequest | flexiblePermanent
  shiftType: {
    type: String,
    enum: ["standard", "flexibleRequest", "flexiblePermanent"],
    default: "standard",
  },

  // Work / Break Tracking
  workDurationSeconds: { type: Number, default: 0 }, // includes total work
  breakDurationSeconds: { type: Number, default: 0 }, // includes total breaks
  breakSessions: [breakSessionSchema],

  // Attendance Flags
  isLate: { type: Boolean, default: false }, // only for standard shifts
  isEarly: { type: Boolean, default: false }, // only for standard shifts
  isHalfDay: { type: Boolean, default: false },
  isAbsent: { type: Boolean, default: false },
});

// ======================
// Helper methods
// ======================

// Compute attendance flags for flexiblePermanent employees based on hours worked + breaks (+1h break buffer)
DailyWorkSchema.methods.evaluateFlexibleAttendance = function () {
  if (this.shiftType !== "flexiblePermanent") return;

  const totalWorkedHours = this.workDurationSeconds / 3600;
  const totalWithBreak = totalWorkedHours + this.breakDurationSeconds / 3600 + 1;

  if (totalWithBreak < 5) {
    this.isAbsent = true;
    this.isHalfDay = false;
  } else if (totalWithBreak >= 5 && totalWithBreak < 9) {
    this.isHalfDay = true;
    this.isAbsent = false;
  } else {
    this.isHalfDay = false;
    this.isAbsent = false;
  }
};

// ======================
// Index for uniqueness per user & day
// ======================
DailyWorkSchema.index({ userId: 1, date: 1 }, { unique: true });

// ======================
// Export Model
// ======================
module.exports = mongoose.model("DailyWork", DailyWorkSchema);
