const mongoose = require("mongoose");

// ======================
// Sub-schema: Break Session
// ======================
const breakSessionSchema = new mongoose.Schema({
  start: { type: Date },
  end: { type: Date },
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
    validate: function (v) {
      if (!this.start) return true;
      const [startH, startM] = this.start.split(":").map(Number);
      const [endH, endM] = v.split(":").map(Number);
      return endH > startH || (endH === startH && endM > startM);
    },
    message: "Shift end time must be after start time",
  },
  isFlexible: { type: Boolean, default: false },
});

// ======================
// Main DailyWork Schema
// ======================
const DailyWorkSchema = new mongoose.Schema({
  userId: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true },
  date: { type: Date, required: true },
  arrivalTime: { type: Date, default: null },
  expectedStartTime: { type: String, default: null }, // new field
  shift: { type: shiftForDaySchema, required: true },
  shiftType: { 
    type: String, 
    enum: ["standard", "flexibleRequest", "flexible9", "flexiblePermanent"],
    default: "standard" 
  },
  workDurationSeconds: { type: Number, default: 0 },
  breakDurationSeconds: { type: Number, default: 0 },
  breakSessions: [breakSessionSchema],
  isLate: { type: Boolean, default: false },
  isEarly: { type: Boolean, default: false },
  isHalfDay: { type: Boolean, default: false },  // new
  isAbsent: { type: Boolean, default: false },   // new
});

// ======================
// Index to avoid duplicates
// ======================
DailyWorkSchema.index({ userId: 1, date: 1 }, { unique: true });

// ======================
// Export the Model
// ======================
module.exports = mongoose.model("DailyWork", DailyWorkSchema);
