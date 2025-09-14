// models/FlexibleShiftRequest.js
const mongoose = require("mongoose");

const flexibleShiftRequestSchema = new mongoose.Schema({
  employee: {
    type: mongoose.Schema.Types.ObjectId,
    ref: "User",
    required: true,
    index: true
  },
  requestedDate: {
    type: Date,
    required: true,
    index: true
  },
  requestedStartTime: {
    type: String,
    required: true,
    match: /^([01]\d|2[0-3]):([0-5]\d)$/ // HH:MM format
  },
  durationHours: {
    type: Number,
    default: 9,
    min: 1,
    max: 24
  },
  reason: {
    type: String,
    trim: true,
    maxLength: 500
  },
  status: {
    type: String,
    enum: ["pending", "approved", "rejected"],
    default: "pending",
    index: true
  },
  reviewedBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: "User"
  },
  reviewedAt: {
    type: Date
  },
  remarks: {
    type: String,
    trim: true,
    maxLength: 500
  }
}, {
  timestamps: true
});

// Compound index for unique requests per employee per date
flexibleShiftRequestSchema.index(
  { employee: 1, requestedDate: 1 }, 
  { unique: true }
);

// Index for efficient querying
flexibleShiftRequestSchema.index({ status: 1, createdAt: -1 });

module.exports = mongoose.model("FlexibleShiftRequest", flexibleShiftRequestSchema);