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
router.get("/admin", protect, authorize("admin", "hr"), getAllPayslips);
router.get("/stats", protect, authorize("admin", "hr"), getPayslipStats);
router.get("/:employeeId/:month", protect, authorize("admin", "hr"), getEmployeePayslip);
router.get("/history/:employeeId", protect, authorize("admin", "hr"), getEmployeePayslipHistory);

// Super Admin routes (can create, update, delete)
router.post("/", protect, authorize("super-admin"), createPayslip);
router.put("/:id", protect, authorize("super-admin"), updatePayslip);
router.delete("/:id", protect, authorize("super-admin"), deletePayslip);

module.exports = router;