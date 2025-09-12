// models/Shift.js
const mongoose = require("mongoose");

const ShiftSchema = new mongoose.Schema(
  {
    name: { type: String, required: true },
    start: { type: String, required: true }, // HH:mm format
    end: { type: String, required: true }, // HH:mm format
    durationHours: { type: Number, required: true },
    activeDays: [{ type: String }], // e.g. ["Mon", "Tue", "Wed"]
    isFlexible: { type: Boolean, default: false },
    isNightShift: { type: Boolean, default: false },
  },
  { timestamps: true }
);

module.exports = mongoose.model("Shift", ShiftSchema);
