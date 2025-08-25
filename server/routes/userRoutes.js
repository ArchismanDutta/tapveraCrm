const express = require("express");
const router = express.Router();

const { protect } = require("../middlewares/authMiddleware");
const { authorize } = require("../middlewares/roleMiddleware");
const {
  createEmployee,
  getAllUsers,
  getMe,
  getEmployeeDirectory,
  updateEmployeeStatus,
} = require("../controllers/userController");

// ---------------------------
// Employee Directory (all authenticated users)
// ---------------------------
router.get("/directory", protect, getEmployeeDirectory);

// ---------------------------
// Get all users (admin & super-admin only)
// ---------------------------
router.get("/", protect, authorize("admin", "super-admin"), getAllUsers);

// ---------------------------
// Get current logged-in user info
// ---------------------------
router.get("/me", protect, getMe);

// ---------------------------
// Create new employee (admin, hr, super-admin only)
// ---------------------------
router.post(
  "/create",
  protect,
  authorize("admin", "hr", "super-admin"),
  createEmployee
);

// ---------------------------
// Update employee status (admin, hr, super-admin only)
// ---------------------------
router.patch(
  "/:id/status",
  protect,
  authorize("admin", "hr", "super-admin"),
  updateEmployeeStatus
);

module.exports = router;
