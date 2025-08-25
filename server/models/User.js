// models/User.js
const mongoose = require("mongoose");

// ======================
// Sub-schema: Qualification
// ======================
const qualificationSchema = new mongoose.Schema({
  school: { type: String, trim: true },
  degree: { type: String, trim: true },
  year: { type: Number },
  marks: { type: String, trim: true }, // e.g., percentage or CGPA
});

// ======================
// Main User Schema
// ======================
const userSchema = new mongoose.Schema(
  {
    employeeId: { type: String, required: true, unique: true, trim: true },
    name: { type: String, required: true, trim: true },
    email: { type: String, required: true, unique: true, lowercase: true, trim: true },
    contact: { type: String, required: true, trim: true },
    dob: { type: Date, required: true },
    gender: { type: String, enum: ["male", "female", "other"], required: true },

    bloodGroup: { type: String, trim: true },
    permanentAddress: { type: String, trim: true },
    currentAddress: { type: String, trim: true },
    emergencyNo: { type: String, trim: true },
    ps: { type: String, trim: true },

    doj: { type: Date, required: true },
    salary: { type: Number, default: 0 },
    ref: { type: String, trim: true },
    status: { type: String, enum: ["active", "inactive"], default: "active" },
    totalPl: { type: Number, default: 0 },

    password: { type: String, required: true },
    role: { type: String, enum: ["super-admin", "admin", "hr", "employee"], default: "employee" },

    department: {
      type: String,
      enum: ["executives", "development", "marketingAndSales", "humanResource", ""],
      default: "",
    },
    designation: { type: String, trim: true, default: "" },
    employmentType: { type: String, enum: ["full-time", "part-time", "contract", "internship"], default: "full-time" },

    skills: [{ type: String, trim: true }], // array of strings
    qualifications: [qualificationSchema], // array of qualifications

    outlookEmail: { type: String, lowercase: true, trim: true },
    outlookAppPassword: { type: String, trim: true },
    location: { type: String, trim: true, default: "India" },
  },
  { timestamps: true }
);

// ======================
// Export the User Model
// ======================
module.exports = mongoose.model("User", userSchema);
