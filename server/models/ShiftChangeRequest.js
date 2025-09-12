// models/ShiftChangeRequest.js
const mongoose = require("mongoose");

const ShiftChangeRequestSchema = new mongoose.Schema({
  employeeId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: "User",
    required: true,
  },
  type: {
    type: String,
    enum: ["temporary", "permanent", "partialWeekly"],
    required: true,
  },
  requestedShiftId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: "Shift",
    required: true,
  },
  startDate: { type: Date, required: true },
  endDate: { type: Date }, // For temporary requests, optional for permanent
  days: [{ type: String }], // For partial weekly request, e.g. ["Mon", "Wed"]
  status: {
    type: String,
    enum: ["pending", "approved", "rejected"],
    default: "pending",
  },
  createdAt: { type: Date, default: Date.now },
});

module.exports = mongoose.model("ShiftChangeRequest", ShiftChangeRequestSchema);
