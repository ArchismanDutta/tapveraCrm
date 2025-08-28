// models/Shift.js
const mongoose = require("mongoose");

const ShiftSchema = new mongoose.Schema({
  name: { type: String, required: true }, // e.g., "Morning 9-6"
  startTime: { type: String, required: true }, // "09:00"
  durationHours: { type: Number, required: true, default: 9 },
  isFlexible: { type: Boolean, default: false }, // flexible or fixed
});

module.exports = mongoose.model("Shift", ShiftSchema);
