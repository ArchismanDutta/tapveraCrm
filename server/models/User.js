const mongoose = require("mongoose");

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
    // Default should be INACTIVE as per requirement
    status: { type: String, enum: ["active", "inactive"], default: "inactive" },
    totalPl: { type: Number, default: 0 },

    password: { type: String, required: true },
    role: { type: String, enum: ["super-admin", "admin", "hr", "employee"], default: "employee" },

    department: {
      type: String,
      enum: ["executives", "development", "marketingAndSales", "humanResource"],
      // no invalid empty-string default; omit by default
      required: false,
    },
    designation: { type: String, trim: true, default: "" },

    outlookEmail: { type: String, lowercase: true, trim: true },
    outlookAppPassword: { type: String, trim: true },
  },
  { timestamps: true }
);

// No bcrypt hashing here since you don't want password hashing

module.exports = mongoose.model("User", userSchema);
