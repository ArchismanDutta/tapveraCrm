const express = require("express");
const router = express.Router();
const { protect, authorize } = require("../middlewares/authMiddleware");
const {
  getEmployeeList,
  getEmployeeSummary,
} = require("../controllers/allEmpAttendanceController");

// Protect all routes and allow only admin, hr, super-admin
router.use(protect);
router.use(authorize("admin", "hr", "super-admin"));

// List all employees with optional filters
router.get("/employees", getEmployeeList);

// Get attendance summary for a specific employee
router.get("/employee-summary", getEmployeeSummary);

module.exports = router;
