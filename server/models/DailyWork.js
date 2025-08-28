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
  name: { type: String, trim: true, default: "" }, // e.g., "Morning 9-6"
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
  isFlexible: { type: Boolean, default: false }, // for flexible shift requests
});

// ======================
// Main DailyWork Schema
// ======================
const DailyWorkSchema = new mongoose.Schema({
  userId: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true },
  date: { type: Date, required: true },
  arrivalTime: { type: Date, default: null },
  shift: { type: shiftForDaySchema, required: true }, // shift assigned for this day
  workDurationSeconds: { type: Number, default: 0 },
  breakDurationSeconds: { type: Number, default: 0 },
  breakSessions: [breakSessionSchema],
  isLate: { type: Boolean, default: false }, // calculated based on shift
  isEarly: { type: Boolean, default: false }, // calculated based on shift
});

// ======================
// Index to avoid duplicates
// ======================
DailyWorkSchema.index({ userId: 1, date: 1 }, { unique: true });

// ======================
// Export the Model
// ======================
module.exports = mongoose.model("DailyWork", DailyWorkSchema);
