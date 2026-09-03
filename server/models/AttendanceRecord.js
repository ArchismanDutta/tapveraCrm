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

    /**
     * Break total BEFORE the speed factor was applied — i.e. the real elapsed
     * time between BREAK_START and BREAK_END.
     *
     * Kept so a scaled figure is never the only record of what happened. With
     * only the scaled value, a day adjusted at 0.75x is indistinguishable from
     * one where the person genuinely took a shorter break, and there would be
     * no way to answer "how long was this break actually?" after the fact.
     */
    breakDurationSecondsBase: { type: Number, default: 0 },

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

    /**
     * True when this shift is a guess, not the employee's real one — the
     * lookup failed or the user could not be read. Persisted so that the
     * verdict survives: recalculateEmployeeData runs again on every read,
     * auto-close and payroll run, and without this the day would be re-stamped
     * late against a 09:00 shift nobody assigned. See
     * AttendanceService.getFallbackShift.
     */
    isFallback: { type: Boolean, default: false },

    type: {
      type: String,
      enum: ['STANDARD', 'FLEXIBLE', 'NIGHT', 'SPLIT'],
      default: 'STANDARD'
    }
  },

  /**
   * The control-machine factor in force when this day was created.
   *
   * Snapshotted per-day rather than read live from the User on each
   * calculation, and that is the whole point: recalculateEmployeeData is
   * called by auto-close, payroll, manual edits and several repair scripts.
   * Reading the live value would mean changing someone's factor silently
   * rescales every past day the next time any of those run — moving finished
   * months and the payroll already computed from them.
   *
   * 1 = real time. See User.controlMachineFactor for the full rationale.
   */
  controlMachineFactor: { type: Number, default: 1 },

  // Leave/Holiday information
  leaveInfo: {
    isOnLeave: { type: Boolean, default: false },
    leaveType: String, // 'SICK', 'CASUAL', 'ANNUAL', 'paid', 'unpaid', 'workFromHome' etc.
    isWFH: { type: Boolean, default: false }, // Work From Home flag
    isPaidLeave: { type: Boolean, default: false }, // Paid Leave flag
    isHalfDayLeave: { type: Boolean, default: false }, // ⭐ Half-Day Leave flag (approved reduced hours)
    isHoliday: { type: Boolean, default: false },
    holidayName: String,

    /**
     * The approved LeaveRequest this stamp came from, when it came from one.
     *
     * Leave reaches a day two ways: an approved request, or an HR edit in the
     * manual attendance screen, which writes the same flags and creates no
     * request. Without knowing which, un-approving a leave would have to
     * either leave a stale stamp behind or blank a day HR had marked by hand.
     * Null means a human set these flags; only a stamp carrying the request's
     * id is cleared when that request stops being approved.
     */
    sourceRequestId: { type: mongoose.Schema.Types.ObjectId, ref: 'LeaveRequest', default: null }
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
  // Local parts, not toISOString().
  //
  // `date` is written at midnight in the server's timezone, so on this IST
  // deployment the 5th of the month is stored as 2026-08-04T18:30:00.000Z and
  // toISOString() reported it as the 4th. Every response carries this virtual
  // (toJSON has virtuals: true), so the day was off by one wherever it was
  // read.
  const d = this.date;
  const month = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${d.getFullYear()}-${month}-${day}`; // YYYY-MM-DD
});

// Method to get employee by userId
AttendanceRecordSchema.methods.getEmployee = function(userId) {
  return this.employees.find(emp => emp.userId.toString() === userId.toString());
};

/**
 * Values that must be assigned whole rather than merged into: dates, ObjectIds
 * and arrays are single values as far as an update is concerned, not bags of
 * fields. Arrays in particular — merging `events` index by index would leave
 * fragments of the old list behind.
 */
function isMergeableObject(value) {
  if (value === null || typeof value !== 'object') return false;
  if (Array.isArray(value)) return false;
  if (value instanceof Date) return false;
  if (value._bsontype) return false;                        // ObjectId, Decimal128, ...
  if (typeof value.toHexString === 'function') return false; // ObjectId, older drivers
  return true;
}

/** Merge `source` into `target` one level at a time, returning a new object. */
function deepMerge(target, source) {
  const merged = { ...target };

  for (const key of Object.keys(source)) {
    const value = source[key];
    // An absent key is not an instruction to blank the stored one.
    if (value === undefined) continue;

    merged[key] = isMergeableObject(value) && isMergeableObject(merged[key])
      ? deepMerge(merged[key], value)
      : value;
  }

  return merged;
}

// Method to add or update employee
AttendanceRecordSchema.methods.upsertEmployee = function(employeeData) {
  const existingIndex = this.employees.findIndex(emp =>
    emp.userId.toString() === employeeData.userId.toString()
  );

  if (existingIndex >= 0) {
    // Update existing employee.
    //
    // Merged field by field, not spread. A top-level spread replaces every
    // nested object wholesale, so a partial write to `calculated` — say
    // { isPresent: false } — silently discarded workDurationSeconds,
    // arrivalTime, lateMinutes and everything else it did not mention. An
    // eight-hour day could be erased by an update that never mentioned hours.
    this.employees[existingIndex] = deepMerge(
      this.employees[existingIndex].toObject(),
      employeeData
    );
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