// File: models/DailyWork.js
const mongoose = require("mongoose");

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
  type: { type: String },
});

const ShiftSchema = new mongoose.Schema({
  name: { type: String, default: "" },
  start: { type: String, required: true },
  end: { type: String, required: true },
  isFlexible: { type: Boolean, default: false },
  durationHours: { type: Number, default: 9 },
});

const DailyWorkSchema = new mongoose.Schema(
  {
    userId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
      index: true,
    },
    userStatusId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "UserStatus",
      index: true,
    },
    date: {
      type: Date,
      required: true,
      index: true,
    },
    
    // Shift and timing information
    shift: { type: ShiftSchema, required: true },
    shiftType: {
      type: String,
      enum: ["standard", "flexible", "flexiblePermanent"],
      default: "standard",
    },
    expectedStartTime: { type: String }, // e.g., "09:00"
    
    // Work tracking
    workDurationSeconds: { type: Number, default: 0 },
    breakDurationSeconds: { type: Number, default: 0 },
    
    // Enhanced session tracking
    workedSessions: { type: [WorkedSessionSchema], default: [] },
    breakSessions: { type: [BreakSessionSchema], default: [] },
    
    // Enhanced timeline tracking
    timeline: { type: [TimelineEventSchema], default: [] },
    
    // Enhanced arrival and departure tracking
    arrivalTime: { type: Date, default: null },
    departureTime: { type: Date, default: null },
    
    // Attendance flags
    isLate: { type: Boolean, default: false },
    isHalfDay: { type: Boolean, default: false },
    isAbsent: { type: Boolean, default: false },
    isOnLeave: { type: Boolean, default: false },
    isHoliday: { type: Boolean, default: false },
    
    // Summary information
    weekSummary: {
      totalHours: { type: String, default: "0h 0m" },
      avgDaily: { type: String, default: "0h 0m" },
      onTimeRate: { type: String, default: "0%" },
      breaksTaken: { type: Number, default: 0 },
    },
    
    quickStats: {
      earlyArrivals: { type: Number, default: 0 },
      lateArrivals: { type: Number, default: 0 },
      perfectDays: { type: Number, default: 0 },
    },
    
    // Additional metadata
    notes: { type: String, default: "" },
    location: { type: String, default: "" },
    
    // Performance metrics
    productivity: {
      tasksCompleted: { type: Number, default: 0 },
      hoursLogged: { type: Number, default: 0 },
      efficiency: { type: Number, default: 0 }, // percentage
    },
  },
  {
    timestamps: true,
  }
);

// Compound index for efficient queries
DailyWorkSchema.index({ userId: 1, date: 1 }, { unique: true });
DailyWorkSchema.index({ userId: 1, date: -1 }); // For recent data queries
DailyWorkSchema.index({ date: 1, shiftType: 1 }); // For analytics queries

// Virtual for formatted work duration
DailyWorkSchema.virtual("workDurationFormatted").get(function () {
  const hours = Math.floor(this.workDurationSeconds / 3600);
  const minutes = Math.floor((this.workDurationSeconds % 3600) / 60);
  return `${hours}h ${minutes}m`;
});

// Virtual for formatted break duration
DailyWorkSchema.virtual("breakDurationFormatted").get(function () {
  const hours = Math.floor(this.breakDurationSeconds / 3600);
  const minutes = Math.floor((this.breakDurationSeconds % 3600) / 60);
  return `${hours}h ${minutes}m`;
});

// Method to get the first punch in time from timeline
DailyWorkSchema.methods.getFirstPunchInTime = function () {
  if (!this.timeline || !Array.isArray(this.timeline)) return null;
  
  const punchInEvents = this.timeline.filter(event => 
    event.type && (
      event.type.toLowerCase().includes('punch in') ||
      event.type.toLowerCase().includes('punchin') ||
      event.type.toLowerCase() === 'punch_in' ||
      event.type.toLowerCase() === 'punchIn'
    )
  );
  
  if (punchInEvents.length === 0) return null;
  
  const sortedPunchIns = punchInEvents.sort((a, b) => new Date(a.time) - new Date(b.time));
  return new Date(sortedPunchIns[0].time);
};

// Method to get the last punch out time from timeline
DailyWorkSchema.methods.getLastPunchOutTime = function () {
  if (!this.timeline || !Array.isArray(this.timeline)) return null;
  
  const punchOutEvents = this.timeline.filter(event => 
    event.type && (
      event.type.toLowerCase().includes('punch out') ||
      event.type.toLowerCase().includes('punchout') ||
      event.type.toLowerCase() === 'punch_out' ||
      event.type.toLowerCase() === 'punchOut'
    )
  );
  
  if (punchOutEvents.length === 0) return null;
  
  const sortedPunchOuts = punchOutEvents.sort((a, b) => new Date(b.time) - new Date(a.time));
  return new Date(sortedPunchOuts[0].time);
};

// Method to calculate effective arrival time (priority: arrivalTime > timeline > first session)
DailyWorkSchema.methods.getEffectiveArrivalTime = function () {
  // Priority 1: Direct arrivalTime field
  if (this.arrivalTime) {
    return this.arrivalTime;
  }
  
  // Priority 2: First punch in from timeline
  const timelineArrival = this.getFirstPunchInTime();
  if (timelineArrival) {
    return timelineArrival;
  }
  
  // Priority 3: First worked session start time
  if (this.workedSessions && this.workedSessions.length > 0) {
    const firstSession = this.workedSessions[0];
    if (firstSession.start) {
      return new Date(firstSession.start);
    }
  }
  
  return null;
};

// Method to calculate effective departure time (priority: departureTime > timeline > last session)
DailyWorkSchema.methods.getEffectiveDepartureTime = function () {
  // Priority 1: Direct departureTime field
  if (this.departureTime) {
    return this.departureTime;
  }
  
  // Priority 2: Last punch out from timeline
  const timelineDeparture = this.getLastPunchOutTime();
  if (timelineDeparture) {
    return timelineDeparture;
  }
  
  // Priority 3: Last worked session end time
  if (this.workedSessions && this.workedSessions.length > 0) {
    const lastSession = this.workedSessions[this.workedSessions.length - 1];
    if (lastSession.end) {
      return new Date(lastSession.end);
    }
  }
  
  return null;
};

// Method to update departure time from timeline
DailyWorkSchema.methods.updateDepartureTime = function () {
  const effectiveDeparture = this.getEffectiveDepartureTime();
  if (effectiveDeparture && !this.departureTime) {
    this.departureTime = effectiveDeparture;
  }
};

// Method to recalculate durations from sessions
DailyWorkSchema.methods.recalculateDurations = function () {
  // Recalculate work duration
  this.workDurationSeconds = 0;
  if (this.workedSessions && Array.isArray(this.workedSessions)) {
    this.workedSessions.forEach(session => {
      if (session.start && session.end) {
        const duration = (new Date(session.end) - new Date(session.start)) / 1000;
        this.workDurationSeconds += Math.max(0, Math.floor(duration));
      }
    });
  }
  
  // Recalculate break duration
  this.breakDurationSeconds = 0;
  if (this.breakSessions && Array.isArray(this.breakSessions)) {
    this.breakSessions.forEach(session => {
      if (session.start && session.end) {
        const duration = (new Date(session.end) - new Date(session.start)) / 1000;
        this.breakDurationSeconds += Math.max(0, Math.floor(duration));
      }
    });
  }
};

// Pre-save middleware to ensure data consistency
DailyWorkSchema.pre("save", function (next) {
  // Update departure time if not set
  this.updateDepartureTime();
  
  // Ensure arrival time is set from effective sources
  if (!this.arrivalTime) {
    const effectiveArrival = this.getEffectiveArrivalTime();
    if (effectiveArrival) {
      this.arrivalTime = effectiveArrival;
    }
  }
  
  // Recalculate durations to ensure consistency
  this.recalculateDurations();
  
  // Update attendance flags based on work duration
  const MIN_HALF_DAY_SECONDS = 5 * 3600;
  const MIN_FULL_DAY_SECONDS = 8 * 3600;
  
  this.isAbsent = this.workDurationSeconds < MIN_HALF_DAY_SECONDS;
  this.isHalfDay = this.workDurationSeconds >= MIN_HALF_DAY_SECONDS && this.workDurationSeconds < MIN_FULL_DAY_SECONDS;
  
  next();
});

// Ensure virtuals are included in JSON output
DailyWorkSchema.set("toJSON", { virtuals: true });
DailyWorkSchema.set("toObject", { virtuals: true });

module.exports = mongoose.model("DailyWork", DailyWorkSchema);