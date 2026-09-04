const mongoose = require("mongoose");

// ======================
// Sub-schemas
// ======================

// Qualification
const qualificationSchema = new mongoose.Schema({
  school: { type: String, trim: true, required: true },
  degree: { type: String, trim: true, required: true },
  year: { type: Number, min: 1900, max: new Date().getFullYear(), required: true },
  marks: { type: String, trim: true },
});

// Salary
const salarySchema = new mongoose.Schema({
  basic: { type: Number, default: 0, min: 0 },
  total: { type: Number, default: 0, min: 0 },
  paymentMode: { type: String, enum: ["bank", "cash"], default: "bank" },
});

// Shift Override Schema (for temporary flexible shifts)
const shiftOverrideSchema = new mongoose.Schema({
  start: { type: String, required: true },
  end: { type: String, required: true },
  durationHours: { type: Number, min: 1, max: 24, required: true },
  type: { type: String, enum: ["flexible", "standard"], default: "flexible" },
  name: { type: String, default: "" },
  approvedBy: { type: mongoose.Schema.Types.ObjectId, ref: "User" },
  approvedAt: { type: Date }
}, { _id: false });

// ======================
// Main User Schema
// ======================
const userSchema = new mongoose.Schema(
  {
    employeeId: { type: String, required: true, unique: true, trim: true, uppercase: true, index: true },
    // ====== BIOMETRIC ATTENDANCE INTEGRATION (Identix / ZKTeco ADMS) ======
    // The PIN / User ID enrolled on the fingerprint device for this employee.
    // The device only knows this number — it has no concept of our Mongo _id or
    // employeeId — so every ATTLOG push is resolved back to a user through this
    // field. Optional + sparse so existing users are unaffected and unmapped
    // employees simply don't produce device attendance.
    // See docs/biometric-attendance-integration.md
    biometricPin: {
      type: String,
      trim: true,
      default: undefined,
      index: { unique: true, sparse: true },
    },
    name: { type: String, required: true, trim: true },
    email: {
      type: String,
      required: true,
      unique: true,
      lowercase: true,
      trim: true,
      match: [/^\S+@\S+\.\S+$/, "Invalid email format"],
    },
    contact: { type: String, required: true, trim: true, match: [/^\+?\d{7,15}$/, "Invalid contact number"] },
    dob: { type: Date, required: true, validate: { validator: v => v <= new Date(), message: "DOB cannot be a future date" } },
    gender: { type: String, enum: ["male", "female", "other"], required: true },
    bloodGroup: { type: String, trim: true },
    permanentAddress: { type: String, trim: true },
    currentAddress: { type: String, trim: true },
    emergencyContact: { type: String, trim: true },
    ps: { type: String, trim: true },
    doj: { type: Date, required: true },
    salary: { type: salarySchema, default: () => ({}) },
    ref: { type: String, trim: true },
    status: { type: String, enum: ["active", "inactive", "terminated", "absconded"], default: "active" },

    // Messaging presence (S3). Written on final socket disconnect only — never
    // per heartbeat, which would be a write per user every 25s for a field
    // that is only ever read while someone is offline. Additive and optional:
    // absent on every existing user until their first disconnect, and
    // services/messaging/presence.js treats absent as "unknown", not "never".
    lastSeenAt: { type: Date, default: null },

    // ─── Break-timer speed factor ─────────────────────────────────────────
    //
    // Scales how fast this user's break time accrues. 1 = real time (the
    // default, and what every existing account has). 0.75 means a real
    // 100-minute break is recorded as 75; 2 means it accrues twice as fast.
    //
    // ─── WHAT THIS DOES AND DOES NOT TOUCH ───
    // It never alters punch events — BREAK_START/BREAK_END timestamps remain
    // exactly as recorded, and the unscaled total is kept alongside the
    // scaled one on every day (calculated.breakDurationSecondsBase). The
    // factor is a stated adjustment on a derived figure, not a rewrite of
    // what happened.
    //
    // It also deliberately does NOT convert the difference into work time.
    // At 0.75 the "missing" 25 minutes simply do not count as break; hours
    // worked are unchanged. Moving them into work would inflate paid hours,
    // which is a much larger claim than adjusting a break allowance.
    //
    // Applied FORWARD ONLY: each attendance day snapshots the factor in force
    // when it was created, so changing this never silently rewrites history
    // (and past payroll) on the next recalculation.
    controlMachineFactor: { type: Number, default: 1, min: 0.1, max: 10 },

    /** Audit — this affects recorded attendance, so it is attributable. */
    controlMachineMeta: {
      reason: { type: String, default: null },
      setBy: { type: mongoose.Schema.Types.ObjectId, ref: "User", default: null },
      setByName: { type: String, default: null },
      setAt: { type: Date, default: null },
    },

    totalPl: { type: Number, default: 0, min: 0 },
    password: { type: String, required: true },
    role: { type: String, enum: ["super-admin", "admin", "hr", "employee"], default: "employee" },
    department: { type: String, enum: ["executives", "development", "marketingAndSales", "humanResource", ""], default: "" },
    // ====== ACCESS-MANAGEMENT REWORK (2026-07-03) ======
    // Additive reference fields — see docs/superpowers/specs/2026-07-03-access-management-design.md
    // `department` and `position` (string fields above/below) are left untouched for backward
    // compatibility during the transition. New code should prefer departmentRef/positionRef;
    // they're populated via server/scripts/migrateToPositionRefs.js and kept in sync by the
    // Access Management page going forward.
    departmentRef: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Department",
      default: null
    },
    positionRef: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Position",
      default: null
    },
    designation: {
      type: String,
      trim: true,
      default: ""
    },
    position: {
      type: String,
      trim: true,
      default: "",
      index: true
    },
    positionLevel: {
      type: Number,
      default: 0,
      min: 0,
      max: 100
    },

    // ====== ROLE & DEPARTMENT HIERARCHY REVAMP v2 (2026-07-27) ======
    // Additive — see docs/superpowers/specs/2026-07-27-role-hierarchy-revamp-design.md
    // Rare, explicit per-user exceptions layered on top of the resolved
    // Position's permissions in accessControl.js's evaluate(). Keys are
    // Position.permissions flag names (e.g. "canApproveLeaves"); an entry
    // here wins over the Position default when present. Subject to the same
    // ceiling rule as everything else in the delegated-access system — see
    // canManageAccessFor(). Kept intentionally small: the Access Overview
    // tab flags any user with a non-empty map so it can't silently sprawl
    // into unaudited one-offs — if overrides become the common case for a
    // role, that's a signal to make it a real Position instead.
    permissionOverrides: {
      type: Map,
      of: Boolean,
      default: () => new Map()
    },

    jobLevel: { type: String, enum: ["intern", "junior", "mid", "senior", "lead", "director", "executive"], default: "junior" },
    employmentType: { type: String, enum: ["full-time", "part-time", "contract", "internship"], default: "full-time" },
    skills: [{ type: String, trim: true }],
    qualifications: [qualificationSchema],
    outlookEmail: { type: String, lowercase: true, trim: true },
    outlookAppPassword: { type: String, trim: true },

    // ====== CRM CREDENTIALS (Super-Admin Access Only) ======
    // REMOVED: crmUsername / crmPassword.
    // Nothing in the codebase ever assigned them, so they held the empty
    // default for every user and made the CRM Credentials modal show "Not set"
    // for everyone. The CRM login username is `email` (above); the password is
    // the bcrypt-hashed `password` field and is issued, never read back, via
    // POST /api/users/:id/crm-password.

    location: { type: String, trim: true, default: "India" },
    avatar: { type: String, trim: true, default: "" },
    timeZone: { type: String, default: "Asia/Kolkata" }, // Added timezone support

    // ====== STATUTORY / PAYROLL FIELDS ======
    pan:              { type: String, trim: true, uppercase: true, default: "" },
    // The PF-Y/N and ESI-Y/N columns on the payroll sheet.
    //
    // null means "apply the statutory rule" (PF by the wage ceiling, ESI by
    // the wage ceiling plus the contribution-period lock). An explicit true or
    // false is an HR decision that overrides it — needed for an existing EPF
    // member whose basic has risen past ₹15,000 and who must stay enrolled,
    // for voluntary coverage, for genuinely excluded employees, and for the
    // higher ESI ceiling that applies to an employee with a disability.
    pfEligible:       { type: Boolean, default: null },
    esiEligible:      { type: Boolean, default: null },

    uan:              { type: String, trim: true, default: "" },
    pfNumber:         { type: String, trim: true, default: "" },
    esiNumber:        { type: String, trim: true, default: "" },
    bankAccountNumber:{ type: String, trim: true, default: "" },
    bankName:         { type: String, trim: true, default: "" },
    ifscCode:         { type: String, trim: true, uppercase: true, default: "" },

    // ====== REGION-BASED ACCESS CONTROL ======

    // Array of regions the user can access (e.g., ['USA', 'CANADA', 'Global'])
    regions: {
      type: [{
        type: String,
        enum: ['USA', 'AUS', 'CANADA', 'IND', 'Global']
      }],
      default: ['Global'],
      required: true
    },

    // ====== GEOFENCED LOGIN (2026-08-07) ======
    // Additive and inert by default — see
    // docs/superpowers/specs/2026-08-07-geofenced-login-design.md
    //
    // Every existing user gets `enabled: false` and an empty location list,
    // so nothing about anyone's ability to log in changes until a Super Admin
    // explicitly turns this on for a specific person. There is deliberately no
    // global "fence everybody" switch: a bug in this feature locks people out
    // of their jobs, so the blast radius of any mistake is capped at whoever
    // was individually opted in.
    geofence: {
      enabled: { type: Boolean, default: false },

      // A union, not an intersection — the user may sign in from ANY one of
      // these. See evaluate() in server/utils/geofence.js.
      //
      // Refs rather than embedded coordinates so that when an office moves,
      // one GeofenceLocation document changes and every assigned employee
      // follows automatically. Embedded copies would drift the first time
      // someone edited one of them.
      locations: [{
        type: mongoose.Schema.Types.ObjectId,
        ref: "GeofenceLocation"
      }],

      // Audit trail for the restriction itself: who imposed it and when.
      // "Why am I fenced?" is a question someone will ask, and the answer
      // should not require reading application logs.
      assignedBy: { type: mongoose.Schema.Types.ObjectId, ref: "User", default: null },
      assignedAt: { type: Date, default: null },
    },

    // ====== SHIFT MANAGEMENT ======

    // Primary shift type
    shiftType: { 
      type: String, 
      enum: ["standard", "flexiblePermanent"], 
      default: "standard" 
    },

    // For standard shifts - reference to predefined shifts
    assignedShift: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Shift",
      default: null
    },

    // Standard shift type enum (for predefined shifts)
    standardShiftType: {
      type: String,
      enum: ["morning", "evening", "night"],
      default: null
    },

    // Flexible shift overrides for specific dates (YYYY-MM-DD format as keys)
    shiftOverrides: {
      type: Map,
      of: shiftOverrideSchema,
      default: new Map()
    },

    // Flexible shift requests (references)
    flexibleShiftRequests: [{ 
      type: mongoose.Schema.Types.ObjectId, 
      ref: "FlexibleShiftRequest" 
    }],

    // Legacy shift field (kept for backward compatibility)
    shift: {
      name: { type: String, trim: true },
      start: { type: String, trim: true },
      end: { type: String, trim: true },
      durationHours: { type: Number, default: 9, min: 1, max: 24 },
      isFlexible: { type: Boolean, default: false },
      shiftId: { type: mongoose.Schema.Types.ObjectId, ref: "Shift" },
    },

    // ====== WORKLOAD TRACKING ======
    workload: {
      // Current capacity status
      capacity: {
        type: String,
        enum: ['available', 'busy', 'overloaded', 'offline'],
        default: 'available'
      },

      // Workload percentage (0-100%)
      workloadPercentage: {
        type: Number,
        default: 0,
        min: 0,
        max: 100
      },

      // When they'll be available next
      nextAvailable: {
        type: Date,
        default: Date.now
      },

      // Count of active tasks
      activeTaskCount: {
        type: Number,
        default: 0,
        min: 0
      },

      // Last calculated timestamp
      lastCalculated: {
        type: Date,
        default: Date.now
      }
    }
  },
  { timestamps: true }
);

// ======================
// Indexes for better performance
// ======================
userSchema.index({ shiftType: 1, assignedShift: 1 });
userSchema.index({ department: 1, designation: 1 });
userSchema.index({ status: 1 });
userSchema.index({ departmentRef: 1 });
userSchema.index({ positionRef: 1 });
// Geofenced login (2026-08-07): powers the admin's "who is currently fenced?"
// list and the referential-integrity check that stops a location being deleted
// while users still point at it (geofenceController.deleteLocation).
userSchema.index({ "geofence.enabled": 1 });
userSchema.index({ "geofence.locations": 1 });

// ======================
// Pre-save hook to ensure consistent shift data
// ======================
userSchema.pre("save", async function (next) {
  // Ensure shift consistency based on shiftType
  if (this.shiftType === "flexiblePermanent") {
    // For flexible permanent employees
    this.assignedShift = null;
    this.standardShiftType = null;
    this.shift = {
      name: "Flexible 9h/day",
      start: "00:00",
      end: "23:59",
      durationHours: 9,
      isFlexible: true,
      shiftId: null
    };
  } else if (this.shiftType === "standard" && this.assignedShift) {
    // For standard shift employees, sync legacy shift field with assignedShift
    // This ensures backward compatibility
    try {
      const Shift = require("./Shift");
      const assignedShift = await Shift.findById(this.assignedShift);
      if (assignedShift) {
        this.shift = {
          name: assignedShift.name,
          start: assignedShift.start,
          end: assignedShift.end,
          durationHours: assignedShift.durationHours,
          isFlexible: false,
          shiftId: assignedShift._id
        };
      }
    } catch (error) {
      console.error("Error syncing shift data in pre-save hook:", error);
      // Continue without throwing - let the save proceed
    }
  }

  next();
});

// ======================
// Methods
// ======================

// Get effective shift for a specific date
userSchema.methods.getEffectiveShift = async function(date) {
  const dateKey = new Date(date).toISOString().slice(0, 10); // YYYY-MM-DD
  
  // 1. Check for shift overrides first (highest priority)
  if (this.shiftOverrides && this.shiftOverrides.has(dateKey)) {
    const override = this.shiftOverrides.get(dateKey);
    return {
      start: override.start,
      end: override.end,
      durationHours: override.durationHours,
      isFlexible: override.type === "flexible",
      source: "override",
      name: override.name || "Shift Override"
    };
  }

  // 2. Check if user has flexible permanent shift
  if (this.shiftType === "flexiblePermanent") {
    return {
      start: "00:00",
      end: "23:59",
      durationHours: 9,
      isFlexible: true,
      source: "flexiblePermanent",
      name: "Flexible Permanent"
    };
  }

  // 3. Check for approved flexible shift requests for this date
  const FlexibleShiftRequest = require("./FlexibleShiftRequest");
  const flexRequest = await FlexibleShiftRequest.findOne({
    employee: this._id,
    requestedDate: new Date(date),
    status: "approved"
  }).lean();

  if (flexRequest) {
    const duration = flexRequest.durationHours || 9;
    const [startH, startM] = flexRequest.requestedStartTime.split(":").map(Number);

    // Calculate end time
    let endH = startH + Math.floor(duration);
    let endM = startM + Math.round((duration % 1) * 60);

    if (endM >= 60) {
      endH += Math.floor(endM / 60);
      endM = endM % 60;
    }

    if (endH >= 24) {
      endH = endH % 24;
    }

    const endTime = `${String(endH).padStart(2, "0")}:${String(endM).padStart(2, "0")}`;

    return {
      start: flexRequest.requestedStartTime,
      end: endTime,
      durationHours: duration,
      isFlexible: true,
      source: "flexibleRequest",
      name: "Flexible Request"
    };
  }

  // 4. Default to assigned standard shift
  if (this.assignedShift) {
    const Shift = require("./Shift");
    const assignedShift = await Shift.findById(this.assignedShift).lean();
    if (assignedShift) {
      return {
        start: assignedShift.start,
        end: assignedShift.end,
        durationHours: assignedShift.durationHours,
        // The Shift document's own flag. This was hardcoded false, so a shift
        // saved with isFlexible: true was loaded from the database and had the
        // answer thrown away — leaving the lateness checks to fall back on a
        // substring test for "flexible" in the shift's NAME. Whether an
        // employee could be late therefore depended on what their shift was
        // called: "Anytime 9h" marked everyone late every morning, and
        // renaming it "Anytime Flexible 9h" made the lateness disappear.
        isFlexible: Boolean(assignedShift.isFlexible),
        source: "assigned",
        name: assignedShift.name
      };
    }
  }

    // 5. Fallback to legacy shift or default
  if (this.shift && this.shift.start && this.shift.end) {
    return {
      start: this.shift.start,
      end: this.shift.end,
      durationHours: this.shift.durationHours || 9,
      isFlexible: this.shift.isFlexible || false,
      source: "legacy",
      name: this.shift.name || "Legacy Shift"
    };
  }

  // 6. Ultimate fallback - return null to indicate no shift assigned
  return null;
};

// Check if user can work flexible hours on a specific date
userSchema.methods.canWorkFlexible = async function(date) {
  // Permanent flexible employees can always work flexible
  if (this.shiftType === "flexiblePermanent") {
    return { canWork: true, reason: "permanent_flexible" };
  }

  // Check for approved flexible requests
  const FlexibleShiftRequest = require("./FlexibleShiftRequest");
  const approvedRequest = await FlexibleShiftRequest.findOne({
    employee: this._id,
    requestedDate: new Date(date),
    status: "approved"
  });

  if (approvedRequest) {
    return { canWork: true, reason: "approved_request" };
  }

  // Check shift overrides
  const dateKey = new Date(date).toISOString().slice(0, 10);
  if (this.shiftOverrides && this.shiftOverrides.has(dateKey)) {
    const override = this.shiftOverrides.get(dateKey);
    return { 
      canWork: override.type === "flexible", 
      reason: override.type === "flexible" ? "override" : "standard_override" 
    };
  }

  return { canWork: false, reason: "standard_shift_only" };
};

// Compute flexible attendance
userSchema.methods.computeFlexibleAttendance = function (workHours, breakHours = 0) {
  if (this.shiftType !== "flexiblePermanent") return null;
  const total = workHours + breakHours;
  if (total < 5) return "absent";
  if (total < 8) return "half-day";
  return "full-day";
};

// ======================
// Hide sensitive info
// ======================
userSchema.set("toJSON", {
  transform: (doc, ret) => {
    delete ret.password;
    delete ret.outlookAppPassword;
    return ret;
  }
});

module.exports = mongoose.model("User", userSchema);
