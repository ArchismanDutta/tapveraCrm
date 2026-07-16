const express = require("express");
const router = express.Router();
const { protect, authorize } = require("../middlewares/authMiddleware");
const {
  sendWish,
  getEmployeeWishes,
  markWishRead,
} = require("../controllers/wishController");
// Access-management rework (2026-07-03) - Phase 4.7.
// See docs/superpowers/plans/2026-07-03-access-management-rework.md
const { can } = require("../utils/accessControl");

// ==========================
// HR/Admin/Super-admin sends wishes
// ==========================
// Additive: hr/admin/super-admin keep exactly what they had (authorize(...)
// below is left in place). Adds an alternative path for anyone with
// "users:manage" authority (Admin + HR by default).
router.post(
  "/",
  protect,
  async (req, res, next) => {
    if (await can(req.user, "users:manage")) return next();
    return authorize("hr", "admin", "super-admin")(req, res, next);
  },
  sendWish
);

// ==========================
// Employee fetches unread wishes
// ==========================
// /api/wishes/ -> returns unread wishes for logged-in employee
router.get("/", protect, authorize("employee"), getEmployeeWishes);

// Alias /me to match frontend calls
router.get("/me", protect, authorize("employee"), getEmployeeWishes);

// ==========================
// Employee marks a wish as read
// PATCH /api/wishes/:wishId/read
// ==========================
router.patch(
  "/:wishId/read",
  protect,
  authorize("employee"),
  markWishRead
);

module.exports = router;
