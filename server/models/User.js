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

    // Store hashed password here
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

    // Optional - you were saving this during signup
    outlookAppPassword: {
      type: String,
      trim: true, // Plain or encrypted, depending on your logic
    },
  },
  { timestamps: true }
);

module.exports = mongoose.model("User", userSchema);
