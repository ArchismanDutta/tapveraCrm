const express = require("express");
const router = express.Router();
const { protect } = require("../middlewares/authMiddleware");
const {
  getEmployeeList,
  getEmployeeSummary,
} = require("../controllers/allEmpAttendanceController");
// Access-management rework (2026-07-03) - Phase 4.3.
// See docs/superpowers/plans/2026-07-03-access-management-rework.md
const { can } = require("../utils/accessControl");

// Protect all routes and allow admin, hr, super-admin, or anyone whose
// Position is explicitly granted "canManageAttendance" (Admin + HR by
// default - see seedCanonicalHierarchy.js). Additive: the original
// role-string check is kept as-is, this only adds an alternative path.
router.use(protect);
router.use(async (req, res, next) => {
  if (
    ["admin", "hr", "super-admin", "superadmin"].includes(req.user.role) ||
    (await can(req.user, "attendance:manage"))
  ) {
    return next();
  }
  return res.status(403).json({
    message: `Access denied. User role '${req.user.role}' is not authorized.`,
  });
});

// List all employees with optional filters
router.get("/employees", getEmployeeList);

// Get attendance summary for a specific employee
router.get("/employee-summary", getEmployeeSummary);

module.exports = router;
