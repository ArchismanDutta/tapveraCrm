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
// Access-management rework (2026-07-03) - Phase 4.4.
// See docs/superpowers/plans/2026-07-03-access-management-rework.md
const { can } = require("../utils/accessControl");

// Additive: hr/admin/super-admin keep exactly what they had (authorize(...)
// below is left in place). Adds an alternative path for anyone whose
// Position is explicitly granted "canApproveShifts" (HR by default - see
// seedCanonicalHierarchy.js). Reuses the shifts:approve action for shift
// *administration* too, rather than introducing a separate permission flag.
const requireShiftManage = async (req, res, next) => {
  if (await can(req.user, "shifts:approve")) return next();
  return authorize("hr", "admin", "super-admin")(req, res, next);
};

// ======================
// Shift Management Routes
// ======================

// Get all shifts
router.get("/", protect, getAllShifts);

// Fix existing shifts (add missing isActive field)
router.post("/fix", protect, requireShiftManage, fixExistingShifts);

// Initialize default shifts (HR/Admin/Super Admin)
router.post("/initialize", protect, requireShiftManage, initializeDefaultShifts);

// Create new shift (HR/Admin only)
router.post("/", protect, requireShiftManage, createShift);

// Update shift (HR/Admin only)
router.put("/:id", protect, requireShiftManage, updateShift);

// Delete shift (HR/Admin only)
router.delete("/:id", protect, requireShiftManage, deleteShift);

// Assign shift to employee (HR/Admin only)
router.put("/assign/:userId", protect, requireShiftManage, assignShiftToEmployee);

// Get employees by shift (HR/Admin only)
router.get("/:id/employees", protect, requireShiftManage, getEmployeesByShift);

module.exports = router;