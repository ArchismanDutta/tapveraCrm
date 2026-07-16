const express = require("express");
const router  = express.Router();
const { protect, authorize } = require("../middlewares/authMiddleware");
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

// ── Employee routes (published payslips only) ────────────────────────────────────
router.get("/my/history",     protect, getMyPayslipHistory);
router.get("/my/:month",      protect, getMyPayslip);

// ── Admin routes ──────────────────────────────────────────────────────────────────
// Access-management rework (2026-07-03) - Phase 4.5. Standardized to
// hr+super-admin across the whole Payroll & Payments surface (payslips,
// auto-payroll, payments) per explicit decision - this deliberately removes
// plain "admin" access, unlike every other Phase 4 module which was
// additive-only. See docs/superpowers/plans/2026-07-03-access-management-rework.md
router.get("/",               protect, authorize("hr", "super-admin"), getAllPayslips);
router.get("/stats",          protect, authorize("hr", "super-admin"), getPayslipStats);
router.get("/:id",            protect, authorize("hr", "super-admin"), getPayslipById);
router.get("/employee/:employeeId", protect, authorize("hr", "super-admin"), getEmployeePayslipHistory);

// ── Mutation routes ───────────────────────────────────────────────────────────────
router.post("/",              protect, authorize("hr", "super-admin"), createPayslip);
router.post("/preview",       protect, authorize("hr", "super-admin"), calculatePreview);
router.put("/:id",            protect, authorize("hr", "super-admin"), updatePayslip);
router.patch("/:id/publish",  protect, authorize("hr", "super-admin"), togglePublish);
router.delete("/:id",         protect, authorize("hr", "super-admin"), deletePayslip);

module.exports = router;
