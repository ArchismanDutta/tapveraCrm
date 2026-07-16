const express = require("express");
const router = express.Router();
const holidayController = require("../controllers/holidayController");
const { protect, authorize } = require("../middlewares/authMiddleware");
// Access-management rework (2026-07-03) - Phase 4.7.
// See docs/superpowers/plans/2026-07-03-access-management-rework.md
const { can } = require("../utils/accessControl");

// Additive: admin/hr/super-admin keep exactly what they had (authorize(...)
// below is left in place). Adds an alternative path for anyone with
// "attendance:manage" authority (Admin + HR by default - see
// seedCanonicalHierarchy.js) - holidays feed directly into attendance/leave
// calculations (see the sandwich-policy route below), so this reuses that
// permission rather than inventing a new one.
const requireHolidayManage = async (req, res, next) => {
  if (await can(req.user, "attendance:manage")) return next();
  return authorize("admin", "super-admin", "hr")(req, res, next);
};

// Public holiday routes
router.get("/", holidayController.getHolidays);
router.get("/check", holidayController.checkIfHoliday);

// Protected routes for Admin / HR only
router.post(
  "/",
  protect,
  requireHolidayManage,
  holidayController.createHoliday
);
router.put(
  "/:id",
  protect,
  requireHolidayManage,
  holidayController.updateHoliday
);
router.delete(
  "/:id",
  protect,
  requireHolidayManage,
  holidayController.removeHoliday
);

// Sandwich policy applied in payroll logic
router.post(
  "/sandwich",
  protect,
  requireHolidayManage,
  holidayController.applySandwich
);

module.exports = router;
