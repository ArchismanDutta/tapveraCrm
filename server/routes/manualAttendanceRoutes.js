const express = require("express");
const router = express.Router();
const { protect } = require("../middlewares/authMiddleware");
const {
  createManualAttendance,
  updateManualAttendance,
  deleteManualAttendance,
  getManualAttendanceRecords,
  getAttendanceByUserAndDate,
  setBreakPolicyOverride
} = require("../controllers/manualAttendanceController");
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

// ======================
// Manual Attendance Routes
// ======================

/**
 * @route   POST /api/admin/manual-attendance
 * @desc    Create manual attendance entry for an employee
 * @access  Admin, HR, Super-Admin
 * @body    {
 *            userId: String (required),
 *            date: String (required, YYYY-MM-DD),
 *            punchInTime: String (optional, ISO datetime),
 *            punchOutTime: String (optional, ISO datetime),
 *            breakSessions: Array (optional, [{ start: datetime, end: datetime, type: string }]),
 *            notes: String (optional),
 *            isOnLeave: Boolean (optional, default: false),
 *            isHoliday: Boolean (optional, default: false),
 *            overrideExisting: Boolean (optional, default: false)
 *          }
 */
router.post("/", createManualAttendance);

/**
 * @route   GET /api/admin/manual-attendance
 * @desc    Get manual attendance records with filters
 * @access  Admin, HR, Super-Admin
 * @query   {
 *            userId: String (optional),
 *            startDate: String (optional, YYYY-MM-DD),
 *            endDate: String (optional, YYYY-MM-DD),
 *            page: Number (optional, default: 1),
 *            limit: Number (optional, default: 50),
 *            sortBy: String (optional, default: "date"),
 *            sortOrder: String (optional, "asc" | "desc", default: "desc")
 *          }
 */
router.get("/", getManualAttendanceRecords);

/**
 * @route   GET /api/admin/manual-attendance/user/:userId/date/:date
 * @desc    Get attendance record for a specific user and date
 * @access  Admin, HR, Super-Admin
 * @params  userId: MongoDB ObjectId, date: YYYY-MM-DD
 */
router.get("/user/:userId/date/:date", getAttendanceByUserAndDate);

/**
 * @route   POST /api/admin/manual-attendance/break-policy-override
 * @desc    Restore a day that the break-duration policy marked absent
 *          (>1h40m or <15m total break), or withdraw a previous override.
 *          Declared before "/:id" so it isn't swallowed by that param route.
 * @access  Admin, HR, Super-Admin
 * @body    {
 *            userId: String (required),
 *            date: String (required, YYYY-MM-DD),
 *            isOverridden: Boolean (optional, default: true),
 *            reason: String (required when isOverridden is true)
 *          }
 */
router.post("/break-policy-override", setBreakPolicyOverride);

/**
 * @route   PUT /api/admin/manual-attendance/:id
 * @desc    Update existing manual attendance entry
 * @access  Admin, HR, Super-Admin
 * @params  id: MongoDB ObjectId of DailyWork record
 * @body    {
 *            punchInTime: String (optional, ISO datetime),
 *            punchOutTime: String (optional, ISO datetime),
 *            breakSessions: Array (optional, [{ start: datetime, end: datetime, type: string }]),
 *            notes: String (optional),
 *            isOnLeave: Boolean (optional),
 *            isHoliday: Boolean (optional)
 *          }
 */
router.put("/:id", updateManualAttendance);

/**
 * @route   DELETE /api/admin/manual-attendance/:id
 * @desc    Delete manual attendance entry
 * @access  Admin, HR, Super-Admin
 * @params  id: MongoDB ObjectId of DailyWork record
 */
router.delete("/:id", deleteManualAttendance);

module.exports = router;