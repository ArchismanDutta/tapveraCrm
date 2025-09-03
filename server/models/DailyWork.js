const mongoose = require("mongoose");

// ======================
// Sub-schema: Break Session
// ======================
const breakSessionSchema = new mongoose.Schema({
  start: { type: Date, required: true },
  end: { type: Date, default: null },
});

// ======================
// Main DailyWork Schema
// ======================
const DailyWorkSchema = new mongoose.Schema({
  userId: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true, index: true },
  userStatusId: { type: mongoose.Schema.Types.ObjectId, ref: "UserStatus", required: true },
  date: { type: Date, required: true },

  // Break sessions for this day
  breakSessions: { type: [breakSessionSchema], default: [] },

  // Computed daily durations
  workDurationSeconds: { type: Number, default: 0 },
  breakDurationSeconds: { type: Number, default: 0 },
});

// ======================
// Virtuals for easier access
// ======================
DailyWorkSchema.virtual("totalWorkedMinutes").get(function () {
  return Math.floor(this.workDurationSeconds / 60);
});

DailyWorkSchema.virtual("totalBreakMinutes").get(function () {
  return Math.floor(this.breakDurationSeconds / 60);
});

// ======================
// Compute durations from UserStatus
// ======================
DailyWorkSchema.methods.computeDurations = function (userStatus) {
  if (!userStatus) return;

  // Work duration
  const ws = userStatus.workedSessions || [];
  let workSecs = ws.reduce((sum, s) => {
    if (s.start && s.end) return sum + (new Date(s.end) - new Date(s.start)) / 1000;
    return sum;
  }, 0);
  if (userStatus.currentlyWorking && ws.length && !ws[ws.length - 1].end) {
    workSecs += (Date.now() - new Date(ws[ws.length - 1].start).getTime()) / 1000;
  }

  // Break duration
  const bs = userStatus.breakSessions || [];
  let breakSecs = bs.reduce((sum, s) => {
    if (s.start && s.end) return sum + (new Date(s.end) - new Date(s.start)) / 1000;
    return sum;
  }, 0);
  if (userStatus.onBreak && userStatus.breakStartTime) {
    breakSecs += (Date.now() - new Date(userStatus.breakStartTime).getTime()) / 1000;
  }

  this.workDurationSeconds = Math.floor(workSecs);
  this.breakDurationSeconds = Math.floor(breakSecs);
};

// ======================
// Static helper: create DailyWork from UserStatus
// ======================
DailyWorkSchema.statics.createFromStatus = async function (userStatus) {
  if (!userStatus || !userStatus.userId) throw new Error("Invalid UserStatus");

  const today = new Date();
  today.setHours(0, 0, 0, 0);

  let existing = await this.findOne({ userId: userStatus.userId, date: today });
  if (existing) return existing;

  const dailyWork = new this({
    userId: userStatus.userId,
    userStatusId: userStatus._id,
    date: today,
    breakSessions: userStatus.breakSessions || [],
  });

  dailyWork.computeDurations(userStatus);
  await dailyWork.save();
  return dailyWork;
};

// ======================
// Export Model
// ======================
module.exports = mongoose.model("DailyWork", DailyWorkSchema);
