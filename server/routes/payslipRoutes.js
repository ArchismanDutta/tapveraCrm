const express = require("express");
const router  = express.Router();
const { protect, authorize } = require("../middlewares/authMiddleware");
const { can } = require("../utils/accessControl");
const {
  createPayslip,
  updatePayslip,
  togglePublish,
  calculatePreview,
  getMyPayslip,
  getMyPayslipHistory,
  getAllPayslips,
  getPayslipById,
  getEmployeePayslipHistory,
  deletePayslip,
  getPayslipStats,
} = require("../controllers/payslipController");

// Additive: hr/super-admin keep exactly what they had. Also allows any
// Position explicitly granted canManageSalary via Access Management.
const requireSalaryManage = async (req, res, next) => {
  if (await can(req.user, "salary:manage")) return next();
  return authorize("hr", "super-admin")(req, res, next);
};

// ── Employee routes (published payslips only) ────────────────────────────────────
router.get("/my/history",     protect, getMyPayslipHistory);
router.get("/my/:month",      protect, getMyPayslip);

// ── Admin routes ──────────────────────────────────────────────────────────────────
router.get("/",               protect, requireSalaryManage, getAllPayslips);
router.get("/stats",          protect, requireSalaryManage, getPayslipStats);
router.get("/:id",            protect, requireSalaryManage, getPayslipById);
router.get("/employee/:employeeId", protect, requireSalaryManage, getEmployeePayslipHistory);

// ── Mutation routes ───────────────────────────────────────────────────────────────
router.post("/",              protect, requireSalaryManage, createPayslip);
router.post("/preview",       protect, requireSalaryManage, calculatePreview);
router.put("/:id",            protect, requireSalaryManage, updatePayslip);
router.patch("/:id/publish",  protect, requireSalaryManage, togglePublish);
router.delete("/:id",         protect, requireSalaryManage, deletePayslip);

module.exports = router;
