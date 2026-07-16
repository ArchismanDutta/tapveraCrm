const express = require("express");
const router = express.Router();
const {
  getEmployeesWithTaskStats,
  activatePayment,
  getMyActivePayment,
  getPendingPayments,
  approvePayment,
  rejectPayment,
  cancelPayment,
  getPaymentHistory,
  getPaymentById,
} = require("../controllers/paymentController");
const { protect, authorize } = require("../middlewares/authMiddleware");
const { uploadToS3 } = require("../config/s3Config");

// HR / Super Admin routes
// Access-management rework (2026-07-03) - Phase 4.5. Standardized to
// hr+super-admin across the whole Payroll & Payments surface per explicit
// decision - this ADDS hr access (was super-admin only before). See
// docs/superpowers/plans/2026-07-03-access-management-rework.md
router.get(
  "/employees-stats",
  protect,
  authorize("hr", "super-admin"),
  getEmployeesWithTaskStats
);

router.post(
  "/activate",
  protect,
  authorize("hr", "super-admin"),
  uploadToS3.single("qrCode"),
  activatePayment
);

router.get(
  "/pending",
  protect,
  authorize("hr", "super-admin"),
  getPendingPayments
);

router.patch(
  "/:paymentId/approve",
  protect,
  authorize("hr", "super-admin"),
  approvePayment
);

router.patch(
  "/:paymentId/reject",
  protect,
  authorize("hr", "super-admin"),
  rejectPayment
);

router.delete(
  "/:paymentId",
  protect,
  authorize("hr", "super-admin"),
  cancelPayment
);

// Employee routes (access own data)
router.get("/my-active", protect, getMyActivePayment);

router.get("/history/:employeeId", protect, getPaymentHistory);

router.get("/:paymentId", protect, getPaymentById);

module.exports = router;
