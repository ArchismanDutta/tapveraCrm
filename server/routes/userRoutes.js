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
// Employee Directory
// Accessible by all logged-in users
// Supports filters & search
// ======================
router.get("/directory", protect, getEmployeeDirectory);

// ======================
// Current logged-in user info
// Includes shift info
// ======================
router.get("/me", protect, getMe);

// ======================
// Get all users (full info for admin/hr/super-admin)
// For assigning tasks or management purposes
// ======================
router.get("/", protect, authorize("admin", "hr", "super-admin"), getAllUsers);

// ======================
// Get all users (minimal info + shift)
// Accessible only by admin/hr/super-admin
// Must be before '/:id' to avoid route conflicts
// ======================
router.get("/all", protect, authorize("admin", "hr", "super-admin"), async (req, res) => {
  try {
    const users = await User.find({}, "_id name email role shift");
    res.json(users);
  } catch (err) {
    console.error("Fetch all users error:", err);
    res.status(500).json({ error: "Failed to fetch users" });
  }
});

// ======================
// Create new employee
// Optional shift: { start, end, isFlexible }
// Accessible by admin/hr/super-admin
// ======================
router.post(
  "/create",
  protect,
  authorize("admin", "hr", "super-admin"),
  createEmployee
);

// ======================
// Get single employee by ID
// Includes shift info
// Accessible by admin/hr/super-admin
// ======================
router.get("/:id", protect, authorize("admin", "hr", "super-admin"), getEmployeeById);

// ======================
// Update employee status
// Accessible by admin/hr/super-admin
// ======================
router.patch("/:id/status", protect, authorize("admin", "hr", "super-admin"), updateEmployeeStatus);

module.exports = router;
