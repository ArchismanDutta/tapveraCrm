const express = require("express");
const router = express.Router();
const { protect, authorize } = require("../middlewares/authMiddleware");
const { getEmployeeList, getEmployeeSummary } = require("../controllers/allEmpAttendanceController");

router.use(protect);
router.use(authorize("admin", "hr", "super-admin"));

router.get("/employees", getEmployeeList);
router.get("/employee-summary", getEmployeeSummary);

module.exports = router;
