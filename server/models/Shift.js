// models/Shift.js
const mongoose = require("mongoose");

const ShiftSchema = new mongoose.Schema({
  name: { type: String, required: true }, // e.g., "Morning 9-6", "Evening 8-5", "Night 5:30-2:20"
  start: { type: String, required: true }, // "09:00"
  end: { type: String, required: true }, // "18:00"
  durationHours: { type: Number, required: true, default: 9 },
  isFlexible: { type: Boolean, default: false },
  isActive: { type: Boolean, default: true },
  description: { type: String, trim: true },
}, { timestamps: true });

module.exports = mongoose.model("Shift", ShiftSchema);