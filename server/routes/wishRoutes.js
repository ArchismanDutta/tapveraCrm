const express = require("express");
const router = express.Router();
const { protect, authorize } = require("../middlewares/authMiddleware");
const {
  sendWish,
  getEmployeeWishes,
  markWishRead,
} = require("../controllers/wishController");

// ==========================
// HR/Admin/Super-admin sends wishes
// ==========================
router.post(
  "/",
  protect,
  authorize("hr", "admin", "super-admin"),
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
