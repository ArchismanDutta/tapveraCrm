// File: models/FlexibleShiftRequest.js

const mongoose = require("mongoose");

const flexibleShiftRequestSchema = new mongoose.Schema(
  {
    // Employee submitting the request
    employee: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: [true, "Employee ID is required"],
      index: true, // optimized queries by employee
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
      match: /^([01]\d|2[0-3]):([0-5]\d)$/, // validates "HH:mm" format
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
  },
  {
    timestamps: true, // adds createdAt and updatedAt automatically
  }
);

// Compound index for faster queries by employee and requested date
flexibleShiftRequestSchema.index({ employee: 1, requestedDate: 1 });

module.exports = mongoose.model(
  "FlexibleShiftRequest",
  flexibleShiftRequestSchema
);
