const express = require("express");
const router = express.Router();
const { protect, authorize } = require("../middlewares/authMiddleware");
const {
  createManualAttendance,
  updateManualAttendance,
  deleteManualAttendance,
  getManualAttendanceRecords,
  getAttendanceByUserAndDate
} = require("../controllers/manualAttendanceController");

// Protect all routes and allow only admin, hr, super-admin
router.use(protect);
router.use(authorize("admin", "hr", "super-admin"));

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