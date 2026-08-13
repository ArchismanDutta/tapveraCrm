// models/AttendanceRecord.js
// New date-centric attendance model - stores all employees' attendance data per date
const mongoose = require("mongoose");

// Individual punch event schema
const PunchEventSchema = new mongoose.Schema({
  type: {
    type: String,
    enum: ['PUNCH_IN', 'PUNCH_OUT', 'BREAK_START', 'BREAK_END'],
    required: true
  },
  timestamp: {
    type: Date,
    required: true
  },
  location: {
    type: String,
    default: null
  },
  ipAddress: String,
  device: String,
  manual: {
    type: Boolean,
    default: false
  },
  approvedBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: "User",
    default: null
  },
  notes: String
});

// Employee's daily attendance schema
const EmployeeAttendanceSchema = new mongoose.Schema({
  userId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: "User",
    required: true,
    index: true
  },

  // Punch events - single source of truth
  events: [PunchEventSchema],

  // Calculated fields (auto-computed from events)
  calculated: {
    // Time tracking
    arrivalTime: Date,
    departureTime: Date,
    workDurationSeconds: { type: Number, default: 0 },
    breakDurationSeconds: { type: Number, default: 0 },
    totalDurationSeconds: { type: Number, default: 0 }, // work + break

    // Formatted durations for display
    workDuration: { type: String, default: "0h 0m" },
    breakDuration: { type: String, default: "0h 0m" },
    totalDuration: { type: String, default: "0h 0m" },

    // Status flags
    isPresent: { type: Boolean, default: false },
    isAbsent: { type: Boolean, default: true },
    isLate: { type: Boolean, default: false },
    lateMinutes: { type: Number, default: 0 }, // ⭐ Minutes late (0 if on-time)
    isHalfDay: { type: Boolean, default: false },
    isFullDay: { type: Boolean, default: false },
    isOvertime: { type: Boolean, default: false },
    isWFH: { type: Boolean, default: false }, // ⭐ Work From Home flag
    isPaidLeave: { type: Boolean, default: false }, // ⭐ Paid Leave flag

    // ─── Break-duration absence (policy) ──────────────────────────────────
    //
    // A day is marked absent when the total break is over 1h40m or under
    // 15m. Recorded as its own flag rather than only flipping `isAbsent`,
    // because "absent because they never came in" and "absent because their
    // break was out of policy" are different facts: the second needs an
    // explanation in the portal and is the one HR can override.
    isBreakPolicyAbsent: { type: Boolean, default: false },

    /** Human-readable cause, e.g. "Break of 2h 10m exceeds the 1h 40m limit". */
    breakPolicyReason: { type: String, default: null },

    // Current status (for real-time tracking)
    currentlyWorking: { type: Boolean, default: false },
    onBreak: { type: Boolean, default: false },
    currentStatus: {
      type: String,
      enum: ['NOT_STARTED', 'WORKING', 'ON_BREAK', 'FINISHED'],
      default: 'NOT_STARTED'
    },

    // Session tracking
    totalWorkSessions: { type: Number, default: 0 },
    totalBreakSessions: { type: Number, default: 0 },
    longestWorkSession: { type: Number, default: 0 }, // in seconds
    longestBreakSession: { type: Number, default: 0 }, // in seconds
  },

  // Shift information
  assignedShift: {
    name: String,
    startTime: String, // "09:00"
    endTime: String,   // "18:00"
    durationHours: { type: Number, default: 9 },
    isFlexible: { type: Boolean, default: false },
    type: {
      type: String,
      enum: ['STANDARD', 'FLEXIBLE', 'NIGHT', 'SPLIT'],
      default: 'STANDARD'
    }
  },

  // Leave/Holiday information
  leaveInfo: {
    isOnLeave: { type: Boolean, default: false },
    leaveType: String, // 'SICK', 'CASUAL', 'ANNUAL', 'paid', 'unpaid', 'workFromHome' etc.
    isWFH: { type: Boolean, default: false }, // Work From Home flag
    isPaidLeave: { type: Boolean, default: false }, // Paid Leave flag
    isHalfDayLeave: { type: Boolean, default: false }, // ⭐ Half-Day Leave flag (approved reduced hours)
    isHoliday: { type: Boolean, default: false },
    holidayName: String
  },

  // ─── HR override of the break-duration absence ──────────────────────────
  //
  // Every HR edit to a day runs through recalculateEmployeeData, which
  // re-derives the status flags from the punch events. Without a persisted
  // marker, an HR correction would be undone by the very next recalculation
  // (auto-close, payroll run, another edit) and the day would silently flip
  // back to absent — the kind of bug nobody notices until payroll is wrong.
  //
  // So the override lives on the record and the calculation reads it.
  breakPolicyOverride: {
    /** Set by HR/super-admin to keep this day's normal attendance. */
    isOverridden: { type: Boolean, default: false },

    /** Why. Required at the API — this changes pay, so it is attributable. */
    reason: { type: String, default: null },

    overriddenBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User', default: null },
    overriddenByName: { type: String, default: null },
    overriddenAt: { type: Date, default: null },

    /**
     * What the rule concluded before HR intervened.
     *
     * Kept so the portal can still show "this would be absent — 2h 10m break"
     * next to the override. Discarding it would leave a day looking perfectly
     * ordinary with no trace of why anyone touched it.
     */
    originalReason: { type: String, default: null }
  },

  // Performance metrics
  performance: {
    punctualityScore: { type: Number, default: 0 }, // 0-100
    attendanceScore: { type: Number, default: 0 },  // 0-100
    productivityHours: { type: Number, default: 0 },
    efficiencyRating: { type: Number, default: 0 }  // 0-5
  },

  // Metadata
  metadata: {
    lastUpdated: { type: Date, default: Date.now },
    version: { type: Number, default: 1 },
    syncStatus: {
      type: String,
      enum: ['SYNCED', 'PENDING', 'ERROR'],
      default: 'SYNCED'
    }
  }
});

// Main date-based attendance schema
const AttendanceRecordSchema = new mongoose.Schema({
  // Primary date key (start of day in UTC)
  date: {
    type: Date,
    required: true,
    unique: true,
    index: true
  },

  // All employees' attendance for this date
  employees: [EmployeeAttendanceSchema],

  // Daily aggregate statistics
  dailyStats: {
    totalEmployees: { type: Number, default: 0 },
    present: { type: Number, default: 0 },
    absent: { type: Number, default: 0 },
    late: { type: Number, default: 0 },
    halfDay: { type: Number, default: 0 },
    fullDay: { type: Number, default: 0 },
    onLeave: { type: Number, default: 0 },
    onHoliday: { type: Number, default: 0 },

    // Real-time stats
    currentlyWorking: { type: Number, default: 0 },
    onBreak: { type: Number, default: 0 },
    finished: { type: Number, default: 0 },

    // Time aggregates
    totalWorkHours: { type: Number, default: 0 },
    totalBreakHours: { type: Number, default: 0 },
    averageWorkHours: { type: Number, default: 0 },
    averageArrivalTime: String, // "09:15"
    averageDepartureTime: String, // "18:30"

    // Performance aggregates
    averagePunctualityScore: { type: Number, default: 0 },
    averageAttendanceScore: { type: Number, default: 0 },
    totalOvertimeHours: { type: Number, default: 0 }
  },

  // Department-wise breakdown
  departmentStats: [{
    departmentName: String,
    totalEmployees: Number,
    present: Number,
    absent: Number,
    averageHours: Number
  }],

  // Special day information
  specialDay: {
    isHoliday: { type: Boolean, default: false },
    holidayName: String,
    isWeekend: { type: Boolean, default: false },
    isWorkingDay: { type: Boolean, default: true }
  }
}, {
  timestamps: true
});

// Indexes for efficient querying
AttendanceRecordSchema.index({ date: -1 }); // Recent dates first
AttendanceRecordSchema.index({ date: 1, "employees.userId": 1 }); // User attendance lookup
AttendanceRecordSchema.index({ date: 1, "employees.calculated.isLate": 1 }); // Late reports
AttendanceRecordSchema.index({ date: 1, "employees.calculated.currentlyWorking": 1 }); // Active employees
AttendanceRecordSchema.index({ "employees.userId": 1, date: -1 }); // User's recent attendance

// Compound index for department reports
AttendanceRecordSchema.index({
  date: 1,
  "departmentStats.departmentName": 1
});

// Pre-save middleware to ensure data integrity
AttendanceRecordSchema.pre('save', function(next) {
  // Ensure date is normalized to start of day
  this.date.setHours(0, 0, 0, 0);

  // Update timestamps for all employees
  this.employees.forEach(employee => {
    employee.metadata.lastUpdated = new Date();
  });

  next();
});

// Virtual for formatted date
AttendanceRecordSchema.virtual('dateFormatted').get(function() {
  return this.date.toISOString().split('T')[0]; // YYYY-MM-DD
});

// Method to get employee by userId
AttendanceRecordSchema.methods.getEmployee = function(userId) {
  return this.employees.find(emp => emp.userId.toString() === userId.toString());
};

// Method to add or update employee
AttendanceRecordSchema.methods.upsertEmployee = function(employeeData) {
  const existingIndex = this.employees.findIndex(emp =>
    emp.userId.toString() === employeeData.userId.toString()
  );

  if (existingIndex >= 0) {
    // Update existing employee
    this.employees[existingIndex] = { ...this.employees[existingIndex].toObject(), ...employeeData };
  } else {
    // Add new employee
    this.employees.push(employeeData);
  }

  return this.employees[existingIndex >= 0 ? existingIndex : this.employees.length - 1];
};

// Ensure virtuals are included in JSON output
AttendanceRecordSchema.set('toJSON', { virtuals: true });
AttendanceRecordSchema.set('toObject', { virtuals: true });

module.exports = mongoose.model("AttendanceRecord", AttendanceRecordSchema);