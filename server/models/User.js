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
    doj: { type: Date, required: true, validate: { validator: v => v <= new Date(), message: "DOJ cannot be a future date" } },
    salary: { type: salarySchema, default: () => ({}) },
    ref: { type: String, trim: true },
    status: { type: String, enum: ["active", "inactive", "terminated", "absconded"], default: "active" },
    totalPl: { type: Number, default: 0, min: 0 },
    password: { type: String, required: true },
    role: { type: String, enum: ["super-admin", "admin", "hr", "employee"], default: "employee" },
    department: { type: String, enum: ["executives", "development", "marketingAndSales", "humanResource", ""], default: "" },
    designation: { type: String, trim: true, default: "" },
    jobLevel: { type: String, enum: ["intern", "junior", "mid", "senior", "lead", "director", "executive"], default: "junior" },
    employmentType: { type: String, enum: ["full-time", "part-time", "contract", "internship"], default: "full-time" },
    skills: [{ type: String, trim: true }],
    qualifications: [qualificationSchema],
    outlookEmail: { type: String, lowercase: true, trim: true },
    outlookAppPassword: { type: String, trim: true },
    location: { type: String, trim: true, default: "India" },
    avatar: { type: String, trim: true, default: "" },
    timeZone: { type: String, default: "Asia/Kolkata" }, // Added timezone support

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

// ======================
// Pre-save hook to ensure consistent shift data
// ======================
userSchema.pre("save", function (next) {
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
    // For standard shift employees, ensure legacy shift field is updated
    // This will be populated by the shift assignment controller
    // Don't set default values here - let the assignment controller handle it
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
        isFlexible: false,
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
  },
});

userSchema.set("toObject", {
  transform: (doc, ret) => {
    delete ret.password;
    delete ret.outlookAppPassword;
    return ret;
  },
});

module.exports = mongoose.model("User", userSchema);
