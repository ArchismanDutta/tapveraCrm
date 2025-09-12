const mongoose = require("mongoose");
const Shift = require("../models/Shift");
const EmployeeShiftAssignment = require("../models/EmployeeShiftAssignment");
const ShiftChangeRequest = require("../models/ShiftChangeRequest");

// Middleware helper (could be improved with real auth middleware)
function getEmployeeId(req) {
  return req.user._id;
}

// Calculate effective shift considering precedence rules
async function calculateEffectiveShift(employeeId, date) {
  try {
    const targetDate = new Date(date);
    targetDate.setHours(0, 0, 0, 0);

    const dayNames = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
    const dayName = dayNames[targetDate.getDay()];

    // 1. Highest priority: approved temporary requests for the date
    const tempRequest = await ShiftChangeRequest.findOne({
      employeeId: mongoose.Types.ObjectId(employeeId),
      type: "temporary",
      status: "approved",
      startDate: { $lte: targetDate },
      endDate: { $gte: targetDate },
    }).lean();

    if (tempRequest) {
      const shift = await Shift.findById(tempRequest.requestedShiftId).lean();
      if (shift) return shift;
    }

    // 2. Permanent overrides effective on or before targetDate
    const assignment = await EmployeeShiftAssignment.findOne({
      employeeId,
    }).lean();
    if (assignment && Array.isArray(assignment.permanentOverrides)) {
      const sortedOverrides = assignment.permanentOverrides
        .filter((o) => new Date(o.startDate) <= targetDate)
        .sort((a, b) => new Date(b.startDate) - new Date(a.startDate));

      for (const override of sortedOverrides) {
        if (override.isPartialWeekly) {
          // Check day match for partial weekly overrides
          if (override.days && override.days.includes(dayName)) {
            const shift = await Shift.findById(override.shiftId).lean();
            if (shift) return shift;
          }
        } else {
          // Full permanent override
          const shift = await Shift.findById(override.shiftId).lean();
          if (shift) return shift;
        }
      }
    }

    // 3. Weekly shift by day
    if (assignment && assignment.weeklyShifts) {
      const weeklyShiftId = assignment.weeklyShifts.get(dayName);
      if (weeklyShiftId) {
        const shift = await Shift.findById(weeklyShiftId).lean();
        if (shift) return shift;
      }
    }

    // 4. Default shift
    if (assignment && assignment.defaultShiftId) {
      const shift = await Shift.findById(assignment.defaultShiftId).lean();
      if (shift) return shift;
    }

    // No applicable shift found
    return null;
  } catch (err) {
    console.error("Error calculating effective shift:", err);
    throw err;
  }
}

exports.createShift = async (req, res) => {
  try {
    const shift = new Shift(req.body);
    await shift.save();
    res.status(201).json(shift);
  } catch (err) {
    console.error("Error creating shift:", err);
    res.status(400).json({ error: err.message });
  }
};

exports.getAllShifts = async (req, res) => {
  try {
    const shifts = await Shift.find();
    res.json(shifts);
  } catch (err) {
    console.error("Error fetching shifts:", err);
    res.status(500).json({ error: err.message });
  }
};

exports.assignShiftToEmployee = async (req, res) => {
  try {
    const employeeId = getEmployeeId(req);
    const { defaultShiftId, weeklyShifts } = req.body;

    let assignment = await EmployeeShiftAssignment.findOne({ employeeId });
    if (!assignment) {
      assignment = new EmployeeShiftAssignment({
        employeeId,
        defaultShiftId,
        weeklyShifts,
      });
    } else {
      assignment.defaultShiftId = defaultShiftId;
      assignment.weeklyShifts = weeklyShifts;
    }
    await assignment.save();
    res.json(assignment);
  } catch (err) {
    console.error("Error assigning shift:", err);
    res.status(400).json({ error: err.message });
  }
};

exports.submitShiftChangeRequest = async (req, res) => {
  try {
    const employeeId = getEmployeeId(req);
    const { type, requestedShiftId, startDate, endDate, days } = req.body;

    const request = new ShiftChangeRequest({
      employeeId,
      type,
      requestedShiftId,
      startDate,
      endDate,
      days,
      status: "pending",
    });
    await request.save();
    res.status(201).json(request);
  } catch (err) {
    console.error("Error submitting shift change request:", err);
    res.status(400).json({ error: err.message });
  }
};

exports.getEffectiveShift = async (req, res) => {
  try {
    const employeeId = getEmployeeId(req);
    const date = new Date(req.params.date);

    const effectiveShift = await calculateEffectiveShift(employeeId, date);
    if (!effectiveShift) {
      return res
        .status(404)
        .json({ message: "No shift found for the specified date" });
    }

    res.json(effectiveShift);
  } catch (err) {
    console.error("Error fetching effective shift:", err);
    res.status(500).json({ error: err.message });
  }
};

module.exports = {
  createShift: exports.createShift,
  getAllShifts: exports.getAllShifts,
  assignShiftToEmployee: exports.assignShiftToEmployee,
  submitShiftChangeRequest: exports.submitShiftChangeRequest,
  getEffectiveShift: exports.getEffectiveShift,
  calculateEffectiveShift,
};
