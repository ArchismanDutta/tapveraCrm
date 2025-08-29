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
// Includes shift info if set
// ======================
router.get("/me", protect, getMe);

// ======================
// Get all users (for assigning tasks)
// Accessible only by admin, hr & super-admin
// ======================
router.get("/", protect, authorize("admin", "hr", "super-admin"), getAllUsers);

// ======================
// Get all users (custom endpoint)
// Includes minimal info + shift
// Must be before '/:id' to avoid route conflicts
// ======================
router.get("/all", protect, async (req, res) => {
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
// Accepts shift: { start: "09:00", end: "18:00" }
// Accessible only by admin, hr & super-admin
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
// Accessible only by admin, hr & super-admin
// ======================
router.get(
  "/:id",
  protect,
  authorize("admin", "hr", "super-admin"),
  getEmployeeById
);

// ======================
// Update employee status
// Accessible only by admin, hr & super-admin
// ======================
router.patch(
  "/:id/status",
  protect,
  authorize("admin", "hr", "super-admin"),
  updateEmployeeStatus
);

module.exports = router;
