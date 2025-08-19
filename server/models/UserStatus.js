// server/models/UserStatus.js
const mongoose = require('mongoose');

const TimelineEventSchema = new mongoose.Schema({
  type: { type: String }, // e.g., "Punch In", "Break Start"
  time: { type: String }  // e.g., "9:15 AM"
});

const QuickStatsSchema = new mongoose.Schema({
  earlyArrivals: { type: Number, default: 0 },
  lateArrivals: { type: Number, default: 0 },
  perfectDays: { type: Number, default: 0 }
});

const UserStatusSchema = new mongoose.Schema({
  userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  workDuration: { type: String, default: "0h 0m" },
  breakTime: { type: String, default: "0m" },
  arrivalTime: { type: String, default: "" },
  currentlyWorking: { type: Boolean, default: true },
  breakDuration: { type: String, default: "0m" },
  onBreak: { type: Boolean, default: false },
  breakStartTime: Date,
  timeline: [TimelineEventSchema],
  weekSummary: {
    totalHours: { type: String, default: "0h 0m" },
    avgDaily: { type: String, default: "0h 0m" },
    onTimeRate: { type: String, default: "0%" },
    breaksTaken: { type: Number, default: 0 },
    quickStats: QuickStatsSchema
  },
  recentActivities: [{
    date: String,
    activity: String,
    time: String
  }],
  today: { type: Date, default: Date.now }
});

module.exports = mongoose.model('UserStatus', UserStatusSchema);
