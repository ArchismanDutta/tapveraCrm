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
router.get("/",               protect, authorize("admin", "hr", "super-admin"), getAllPayslips);
router.get("/stats",          protect, authorize("admin", "hr", "super-admin"), getPayslipStats);
router.get("/:id",            protect, authorize("admin", "hr", "super-admin"), getPayslipById);
router.get("/employee/:employeeId", protect, authorize("admin", "hr", "super-admin"), getEmployeePayslipHistory);

// ── Mutation routes ───────────────────────────────────────────────────────────────
router.post("/",              protect, authorize("admin", "hr", "super-admin"), createPayslip);
router.post("/preview",       protect, authorize("admin", "hr", "super-admin"), calculatePreview);
router.put("/:id",            protect, authorize("admin", "hr", "super-admin"), updatePayslip);
router.patch("/:id/publish",  protect, authorize("admin", "hr", "super-admin"), togglePublish);
router.delete("/:id",         protect, authorize("admin", "hr", "super-admin"), deletePayslip);

module.exports = router;
