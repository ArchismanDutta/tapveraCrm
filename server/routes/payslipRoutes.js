const express = require("express");
const router = express.Router();
const { protect, authorize } = require("../middlewares/authMiddleware");
const {
  createPayslip,
  updatePayslip,
  getMyPayslip,
  getEmployeePayslip,
  getAllPayslips,
  getEmployeePayslipHistory,
  deletePayslip,
  getPayslipStats
} = require("../controllers/payslipController");

// Employee routes
router.get("/my/:month", protect, getMyPayslip);

// Admin routes (can view any employee's payslip)
router.get("/admin", protect, authorize("admin", "hr", "super-admin"), getAllPayslips);
router.get("/stats", protect, authorize("admin", "hr", "super-admin"), getPayslipStats);
router.get("/:employeeId/:month", protect, authorize("admin", "hr", "super-admin"), getEmployeePayslip);
router.get("/history/:employeeId", protect, authorize("admin", "hr", "super-admin"), getEmployeePayslipHistory);

// Super Admin and HR routes (can create, update, delete) - Uses automated calculation
router.post("/", protect, authorize("super-admin", "hr"), createPayslip);
router.put("/:id", protect, authorize("super-admin", "hr"), updatePayslip);
router.delete("/:id", protect, authorize("super-admin", "hr"), deletePayslip);

module.exports = router;