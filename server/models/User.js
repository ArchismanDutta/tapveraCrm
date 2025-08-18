// models/User.js
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

    // NOTE: plain text (not hashed)
    password: { type: String, required: true, trim: true },

    role: {
      type: String,
      enum: ["super-admin", "admin", "employee"],
      default: "employee",
    },

    department: {
      type: String,
      enum: [
        "executives",
        "development",
        "marketingAndSales",
        "humanResource",
      ],
    },

    designation: { type: String, trim: true },

    outlookEmail: { type: String, trim: true, lowercase: true },

    // stored as encrypted hex (via utils/encryption.js)
    outlookAppPassword: { type: String, trim: true },
  },
  { timestamps: true }
);

module.exports = mongoose.model("User", userSchema);
