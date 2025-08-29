// File: models/User.js
const mongoose = require("mongoose");

// ======================
// Sub-schema: Qualification
// ======================
const qualificationSchema = new mongoose.Schema({
  school: { type: String, trim: true, required: true },
  degree: { type: String, trim: true, required: true },
  year: {
    type: Number,
    min: 1900,
    max: new Date().getFullYear(),
    required: true,
  },
  marks: { type: String, trim: true }, // percentage or CGPA
});

// ======================
// Sub-schema: Shift Timing
// ======================
const shiftSchema = new mongoose.Schema({
  name: { type: String, trim: true, default: "Morning 9-6" },
  start: {
    type: String,
    trim: true,
    default: "09:00",
    required: true,
    validate: {
      validator: (v) => /^\d{2}:\d{2}$/.test(v),
      message: "Shift start must be in HH:MM format",
    },
  },
  end: {
    type: String,
    trim: true,
    default: "18:00",
    required: true,
    validate: {
      validator: function (v) {
        if (!this.start) return true;
        const [startH, startM] = this.start.split(":").map(Number);
        const [endH, endM] = v.split(":").map(Number);
        return endH > startH || (endH === startH && endM > startM);
      },
      message: "Shift end time must be after start time",
    },
  },
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
      match: [/^\S+@\S+\.\S+$/, "Please provide a valid email"],
    },

    contact: {
      type: String,
      required: true,
      trim: true,
      match: [/^\+?\d{7,15}$/, "Please provide a valid phone number"],
    },

    dob: {
      type: Date,
      required: true,
      validate: {
        validator: (v) => v <= new Date(),
        message: "Date of birth cannot be in the future",
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
    emergencyNo: { type: String, trim: true },
    ps: { type: String, trim: true },

    doj: {
      type: Date,
      required: true,
      validate: {
        validator: (v) => v <= new Date(),
        message: "Date of joining cannot be in the future",
      },
    },

    salary: { type: Number, default: 0, min: 0 },
    ref: { type: String, trim: true },

    status: {
      type: String,
      enum: ["active", "inactive"],
      default: "active",
    },

    totalPl: { type: Number, default: 0, min: 0 },

    password: { type: String, required: true, minlength: 1 }, // store hashed in production

    role: {
      type: String,
      enum: ["super-admin", "admin", "hr", "employee"],
      default: "employee",
    },

    department: {
      type: String,
      enum: [
        "executives",
        "development",
        "marketingAndSales",
        "humanResource",
        "",
      ],
      default: "",
    },

    designation: { type: String, trim: true, default: "" },

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

    // ======================
    // Shift Timing (Strict/Flexible)
    // ======================
    shift: { type: shiftSchema, default: () => ({}) },

    // ======================
    // Flexible Shift Requests
    // ======================
    flexibleShiftRequests: [
      {
        type: mongoose.Schema.Types.ObjectId,
        ref: "FlexibleShiftRequest",
      },
    ],
  },
  { timestamps: true }
);

// ======================
// Remove sensitive fields in JSON/Objects
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

// ======================
// Export the User Model
// ======================
module.exports = mongoose.model("User", userSchema);
