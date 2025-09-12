// models/EmployeeShiftAssignment.js
const mongoose = require("mongoose");

const PermanentOverrideSchema = new mongoose.Schema({
  shiftId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: "Shift",
    required: true,
  },
  startDate: { type: Date, required: true },
  isPartialWeekly: { type: Boolean, default: false },
  days: [{ type: String }], // e.g. ["Mon", "Wed"], only if isPartialWeekly
});

const EmployeeShiftAssignmentSchema = new mongoose.Schema(
  {
    employeeId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
      unique: true,
    },
    defaultShiftId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Shift",
      required: true,
    },
    weeklyShifts: { type: Map, of: mongoose.Schema.Types.ObjectId }, // key: day (Mon, Tue...), value: shiftId
    permanentOverrides: [PermanentOverrideSchema],
  },
  { timestamps: true }
);

module.exports = mongoose.model(
  "EmployeeShiftAssignment",
  EmployeeShiftAssignmentSchema
);
