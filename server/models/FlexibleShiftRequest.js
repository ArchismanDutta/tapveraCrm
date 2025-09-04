const mongoose = require("mongoose");

// ======================
// Flexible Shift Request Schema
// ======================
const flexibleShiftRequestSchema = new mongoose.Schema(
  {
    // Employee submitting the request
    employee: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: [true, "Employee ID is required"],
      index: true,
    },

    // Requested date for flexible shift
    requestedDate: {
      type: Date,
      required: [true, "Requested date is required"],
      index: true,
    },

    // Requested start time in "HH:mm" format
    requestedStartTime: {
      type: String,
      required: [true, "Requested start time is required"],
      match: [/^([01]\d|2[0-3]):([0-5]\d)$/, "Start time must be in HH:mm format"],
    },

    // Duration of shift in hours (default 9)
    durationHours: {
      type: Number,
      default: 9,
      min: [1, "Duration must be at least 1 hour"],
      max: [24, "Duration cannot exceed 24 hours"],
    },

    // Optional reason for the request
    reason: {
      type: String,
      trim: true,
      maxlength: [500, "Reason cannot exceed 500 characters"],
      default: "",
    },

    // Status of the request
    status: {
      type: String,
      enum: ["pending", "approved", "rejected"],
      default: "pending",
    },

    // HR/Admin who reviewed the request
    reviewedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      default: null,
    },

    // Timestamp when HR/Admin reviewed the request
    reviewedAt: {
      type: Date,
      default: null,
    },

    // Shift type: always "flexibleRequest"
    shiftType: {
      type: String,
      enum: ["flexibleRequest"],
      default: "flexibleRequest",
    },
  },
  {
    timestamps: true,
  }
);

// Compound unique index: one request per employee per date
flexibleShiftRequestSchema.index({ employee: 1, requestedDate: 1 }, { unique: true });

// ======================
// Export the Model
// ======================
module.exports = mongoose.model(
  "FlexibleShiftRequest",
  flexibleShiftRequestSchema
);
