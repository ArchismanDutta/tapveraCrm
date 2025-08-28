const mongoose = require("mongoose");

// ======================
// Sub-schema: Qualification
// ======================
const qualificationSchema = new mongoose.Schema({
  school: { type: String, trim: true, required: true },
  degree: { type: String, trim: true, required: true },
  year: { type: Number, min: 1900, max: new Date().getFullYear() },
  marks: { type: String, trim: true }, // percentage or CGPA
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

    contact: { type: String, required: true, trim: true },

    dob: { type: Date, required: true },

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

    doj: { type: Date, required: true },
    salary: { type: Number, default: 0, min: 0 },
    ref: { type: String, trim: true },
    status: {
      type: String,
      enum: ["active", "inactive"],
      default: "active",
    },
    totalPl: { type: Number, default: 0, min: 0 },

    password: { type: String, required: true, minlength: 1 }, // plain-text

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
  },
  { timestamps: true }
);

// ======================
// Remove sensitive fields in JSON
// ======================
userSchema.set("toJSON", {
  transform: (doc, ret) => {
    delete ret.outlookAppPassword;
    return ret;
  },
});

userSchema.set("toObject", {
  transform: (doc, ret) => {
    delete ret.outlookAppPassword;
    return ret;
  },
});

// ======================
// Export the User Model
// ======================
module.exports = mongoose.model("User", userSchema);
