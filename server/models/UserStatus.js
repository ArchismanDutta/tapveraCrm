const mongoose = require('mongoose');

const TimelineEventSchema = new mongoose.Schema({
  type: { type: String },     // e.g. "Punch In", "Break Start"
  time: { type: String }      // e.g. "9:15 AM"
});

const QuickStatsSchema = new mongoose.Schema({
  earlyArrivals: Number,
  lateArrivals: Number,
  perfectDays: Number
});

const UserStatusSchema = new mongoose.Schema({
  userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  workDuration: String,
  breakTime: String,
  arrivalTime: String,
  currentlyWorking: Boolean,
  breakDuration: String,
  onBreak: Boolean,
  timeline: [TimelineEventSchema],
  weekSummary: {
    totalHours: String,
    avgDaily: String,
    onTimeRate: String,
    breaksTaken: Number,
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
