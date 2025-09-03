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

// Shift
const shiftSchema = new mongoose.Schema({
  name: { type: String, trim: true },
  start: { type: String, trim: true },
  end: { type: String, trim: true },
  durationHours: { type: Number, default: 9, min: 1, max: 24 },
  isFlexible: { type: Boolean, default: false },
});

// ======================
// Main User Schema
// ======================

const userSchema = new mongoose.Schema(
  {
    employeeId: {
      type: String,
      required: true,
      unique: true,
      trim: true,
      uppercase: true,
      index: true,
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
    contact: {
      type: String,
      required: true,
      trim: true,
      match: [/^\+?\d{7,15}$/, "Invalid contact number"],
    },
    dob: {
      type: Date,
      required: true,
      validate: {
        validator: v => v <= new Date(),
        message: "DOB cannot be a future date",
      },
    },
    gender: {
      type: String,
      enum: ["male", "female", "other"],
      required: true,
    },
    bloodGroup: { type: String, trim: true },
    permanentAddress: { type: String, trim: true },
    currentAddress: { type: String, trim: true },
    emergencyContact: { type: String, trim: true },
    ps: { type: String, trim: true },
    doj: {
      type: Date,
      required: true,
      validate: {
        validator: v => v <= new Date(),
        message: "DOJ cannot be a future date",
      },
    },
    salary: { type: salarySchema, default: () => ({}) },
    ref: { type: String, trim: true },
    status: { type: String, enum: ["active", "inactive"], default: "active" },
    totalPl: { type: Number, default: 0, min: 0 },
    password: { type: String, required: true },
    role: {
      type: String,
      enum: ["super-admin", "admin", "hr", "employee"],
      default: "employee",
    },
    department: {
      type: String,
      enum: ["executives", "development", "marketingAndSales", "humanResource", ""],
      default: "",
    },
    designation: { type: String, trim: true, default: "" },
    jobLevel: {
      type: String,
      enum: ["intern", "junior", "mid", "senior", "lead", "director", "executive"],
      default: "junior",
    },
    employmentType: {
      type: String,
      enum: ["full-time", "part-time", "contract", "internship"],
      default: "full-time",
    },
    skills: [{ type: String, trim: true }],
    qualifications: [qualificationSchema],
    outlookEmail: { type: String, lowercase: true, trim: true },
    outlookAppPassword: { type: String, trim: true },
    location: { type: String, trim: true, default: "India" },
    avatar: { type: String, trim: true, default: "" },

    // Shift Type
    shiftType: {
      type: String,
      enum: ["standard", "flexiblePermanent"],
      default: "standard",
    },

    // Shift sub-document
    shift: {
      type: shiftSchema,
      default: () => ({}), // Will be set properly in pre-save hook
    },

    // Flexible shift requests for standard employees
    flexibleShiftRequests: [
      { type: mongoose.Schema.Types.ObjectId, ref: "FlexibleShiftRequest" },
    ],
  },
  { timestamps: true }
);

// ======================
// Pre-save hook to set shift properly
// ======================
userSchema.pre("save", function (next) {
  if (this.isNew) {
    if (this.shiftType === "flexiblePermanent") {
      // Permanent flexible employee
      this.shift = {
        name: "Flexible 9h/day",
        start: null,
        end: null,
        durationHours: 9,
        isFlexible: true,
      };
    } else if (this.shiftType === "standard") {
      // Standard employee gets default Morning shift
      this.shift = {
        name: "Morning 9-6",
        start: "09:00",
        end: "18:00",
        durationHours: 9,
        isFlexible: false,
      };
    }
  }
  next();
});

// ======================
// Methods
// ======================

// Compute attendance for flexiblePermanent users
userSchema.methods.computeFlexibleAttendance = function (workHours, breakHours = 0) {
  if (this.shiftType !== "flexiblePermanent") return null;
  const total = workHours + breakHours;
  if (total < 5) return "absent";
  if (total < 9) return "half-day";
  return "full-day";
};

// Hide sensitive info in JSON output
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
