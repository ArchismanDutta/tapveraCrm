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

// Super Admin only routes
router.get(
  "/employees-stats",
  protect,
  authorize("super-admin"),
  getEmployeesWithTaskStats
);

router.post(
  "/activate",
  protect,
  authorize("super-admin"),
  uploadToS3.single("qrCode"),
  activatePayment
);

router.get(
  "/pending",
  protect,
  authorize("super-admin"),
  getPendingPayments
);

router.patch(
  "/:paymentId/approve",
  protect,
  authorize("super-admin"),
  approvePayment
);

router.patch(
  "/:paymentId/reject",
  protect,
  authorize("super-admin"),
  rejectPayment
);

router.delete(
  "/:paymentId",
  protect,
  authorize("super-admin"),
  cancelPayment
);

// Employee routes (access own data)
router.get("/my-active", protect, getMyActivePayment);

router.get("/history/:employeeId", protect, getPaymentHistory);

router.get("/:paymentId", protect, getPaymentById);

module.exports = router;
