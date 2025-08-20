const mongoose = require("mongoose");

const DailyWorkSchema = new mongoose.Schema({
  userId: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true },
  date: { type: Date, required: true },
  arrivalTime: { type: Date, default: null },
  expectedStartTime: { type: String, default: "09:00" }, // Added expectedStartTime default
  workDurationSeconds: { type: Number, default: 0 },
  breakDurationSeconds: { type: Number, default: 0 },
  breakSessions: [
    {
      start: Date,
      end: Date
    }
  ]
});

module.exports = mongoose.model("DailyWork", DailyWorkSchema);
