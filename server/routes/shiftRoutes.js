const express = require("express");
const router = express.Router();
const {
  getAllShifts,
  createShift,
  updateShift,
  deleteShift,
  assignShiftToEmployee,
  getEmployeesByShift,
  initializeDefaultShifts,
  fixExistingShifts
} = require("../controllers/shiftController");

const { protect, authorize } = require("../middlewares/authMiddleware");

// ======================
// Shift Management Routes
// ======================

// Get all shifts
router.get("/", protect, getAllShifts);

// Fix existing shifts (add missing isActive field)
router.post("/fix", protect, authorize("hr", "admin", "super-admin"), fixExistingShifts);

// Initialize default shifts (HR/Admin/Super Admin)
router.post("/initialize", protect, authorize("hr", "admin", "super-admin"), initializeDefaultShifts);

// Create new shift (HR/Admin only)
router.post("/", protect, authorize("hr", "admin", "super-admin"), createShift);

// Update shift (HR/Admin only)
router.put("/:id", protect, authorize("hr", "admin", "super-admin"), updateShift);

// Delete shift (HR/Admin only)
router.delete("/:id", protect, authorize("hr", "admin", "super-admin"), deleteShift);

// Assign shift to employee (HR/Admin only)
router.put("/assign/:userId", protect, authorize("hr", "admin", "super-admin"), assignShiftToEmployee);

// Get employees by shift (HR/Admin only)
router.get("/:id/employees", protect, authorize("hr", "admin", "super-admin"), getEmployeesByShift);

module.exports = router;