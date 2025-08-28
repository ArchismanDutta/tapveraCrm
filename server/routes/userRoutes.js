// File: routes/userRoutes.js
const express = require("express");
const router = express.Router();

const { protect } = require("../middlewares/authMiddleware");
const { authorize } = require("../middlewares/roleMiddleware");
const User = require("../models/User");

const {
  createEmployee,
  getAllUsers,
  getMe,
  getEmployeeDirectory,
  getEmployeeById,
  updateEmployeeStatus,
} = require("../controllers/userController");

// ======================
// Employee Directory (accessible by all logged-in users)
// ======================
router.get("/directory", protect, getEmployeeDirectory);

// ======================
// Get current logged-in user
// ======================
router.get("/me", protect, getMe);

// ======================
// Get all users (for assigning tasks) — admin, hr & super-admin only
// ======================
router.get("/", protect, authorize("admin", "hr", "super-admin"), getAllUsers);

// ======================
// Get all users (ignoring roles, custom endpoint)
// Must be before '/:id' to avoid route conflict
// ======================
router.get("/all", protect, async (req, res) => {
  try {
    const users = await User.find({}, "_id name email role"); // select necessary fields
    res.json(users);
  } catch (err) {
    console.error("Fetch all users error:", err);
    res.status(500).json({ error: "Failed to fetch users" });
  }
});

// ======================
// Create new employee (admin/hr/super-admin only)
// ======================
router.post(
  "/create",
  protect,
  authorize("admin", "hr", "super-admin"),
  createEmployee
);

// ======================
// Get single employee by ID (admin/hr/super-admin only)
// ======================
router.get(
  "/:id",
  protect,
  authorize("admin", "hr", "super-admin"),
  getEmployeeById
);

// ======================
// Update employee status (admin/hr/super-admin only)
// ======================
router.patch(
  "/:id/status",
  protect,
  authorize("admin", "hr", "super-admin"),
  updateEmployeeStatus
);

module.exports = router;
