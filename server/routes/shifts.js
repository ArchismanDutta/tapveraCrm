const express = require("express");
const router = express.Router();
const shiftsController = require("../controllers/shiftsController");

// Create shift
router.post("/shifts", shiftsController.createShift);

// Get all shifts
router.get("/shifts", shiftsController.getAllShifts);

// Assign shift to employee
router.post("/employee-shift", shiftsController.assignShiftToEmployee);

// Submit shift change request
router.post("/shift-change-request", shiftsController.submitShiftChangeRequest);

// Get effective shift for employee on date
router.get(
  "/employee-shift/effective/:date",
  shiftsController.getEffectiveShift
);

module.exports = router;
