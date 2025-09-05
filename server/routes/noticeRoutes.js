// routes/noticeRoutes.js
const express = require("express");
const router = express.Router();
const noticeController = require("../controllers/noticeController");
const { protect, authorize } = require("../middlewares/authMiddleware");

// Create notice (only admin/super-admin)
router.post(
  "/",
  protect,
  authorize("admin", "super-admin", "hr"),
  noticeController.createNotice
);

// Get active notice (any logged-in user)
router.get("/", protect, noticeController.getActiveNotice);

// Deactivate notice (only admin/super-admin)
router.patch(
  "/:id/deactivate",
  protect,
  authorize("admin", "super-admin", "hr"),
  noticeController.deactivateNotice
);

module.exports = router;
