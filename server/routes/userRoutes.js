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

// Employee Directory - accessible to all logged-in users, with filters & search
router.get("/directory", protect, getEmployeeDirectory);

// Current logged-in user info
router.get("/me", protect, getMe);

// Get all users - full info, for admin, hr, super-admin only
router.get("/", protect, authorize("admin", "hr", "super-admin"), getAllUsers);

// Get all users - minimal info (id, name, email, role, shift), for admin/hr/super-admin
router.get("/all", protect, authorize("admin", "hr", "super-admin"), async (req, res) => {
  try {
    const users = await User.find({}, "_id name email role shift");
    res.json(users);
  } catch (err) {
    console.error("Fetch all users error:", err);
    res.status(500).json({ error: "Failed to fetch users" });
  }
});

// Create new employee - accessible to admin, hr, super-admin only
router.post("/create", protect, authorize("admin", "hr", "super-admin"), createEmployee);

// Get single employee by ID - admin, hr, super-admin only
router.get("/:id", protect, authorize("admin", "hr", "super-admin"), getEmployeeById);

// Update employee status (active/inactive) - admin, hr, super-admin only
router.patch("/:id/status", protect, authorize("admin", "hr", "super-admin"), updateEmployeeStatus);

module.exports = router;
