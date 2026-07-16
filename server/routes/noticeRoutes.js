// routes/noticeRoutes.js
const express = require("express");
const router = express.Router();
const noticeController = require("../controllers/noticeController");
const { protect, authorize } = require("../middlewares/authMiddleware");
// Access-management rework (2026-07-03) - Phase 4.7.
// See docs/superpowers/plans/2026-07-03-access-management-rework.md
const { can } = require("../utils/accessControl");

// Additive: admin/hr/super-admin keep exactly what they had (authorize(...)
// below is left in place). Adds an alternative path for anyone with
// "users:manage" authority (Admin + HR by default - see
// seedCanonicalHierarchy.js).
const requireNoticeManage = async (req, res, next) => {
  if (await can(req.user, "users:manage")) return next();
  return authorize("admin", "super-admin", "hr")(req, res, next);
};

// Create notice (only admin/super-admin)
router.post(
  "/",
  protect,
  requireNoticeManage,
  noticeController.createNotice
);

// Get active notice (any logged-in user)
router.get("/", protect, noticeController.getActiveNotice);

// Deactivate notice (only admin/super-admin)
router.patch(
  "/:id/deactivate",
  protect,
  requireNoticeManage,
  noticeController.deactivateNotice
);

module.exports = router;
