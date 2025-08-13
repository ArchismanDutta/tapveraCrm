const mongoose = require("mongoose");

const userSchema = new mongoose.Schema(
  {
    name: { type: String, required: true, trim: true },
    email: {
      type: String,
      required: true,
      unique: true,
      lowercase: true,
      trim: true,
    },
    contact: { type: String, required: true, trim: true },
    dob: { type: Date, required: true },
    gender: { type: String, enum: ["male", "female", "other"], required: true },
    password: { type: String, required: true },
    role: {
      type: String,
      enum: ["super-admin", "admin", "employee"],
      default: "employee",
    },
    department: {
      type: String,
      enum: ["executives", "development", "marketingAndSales", "humanResource"],
    },
    designation: {
      type: String,
      trim: true,
    },
  },
  { timestamps: true }
);

module.exports = mongoose.model("User", userSchema);
