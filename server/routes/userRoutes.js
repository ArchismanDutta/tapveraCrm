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
  updateEmployee,
} = require("../controllers/userController");

// ================================
// User / Employee Routes
// ================================

// Employee Directory - accessible to all logged-in users, with optional filters & search
router.get("/directory", protect, getEmployeeDirectory);

// Current logged-in user info
router.get("/me", protect, getMe);

// Get all users - full info, restricted to admin, hr, super-admin
router.get("/", protect, authorize("admin", "hr", "super-admin"), getAllUsers);

// Get all users - minimal info (id, name, email, role, shift), restricted to admin/hr/super-admin
router.get("/all", protect, authorize("admin", "hr", "super-admin"), async (req, res) => {
  try {
    const users = await User.find({}, "_id name email role shift");
    res.json(users);
  } catch (err) {
    console.error("Fetch all users error:", err);
    res.status(500).json({ error: "Failed to fetch users" });
  }
});

// Create new employee - restricted to admin, hr, super-admin
router.post("/create", protect, authorize("admin", "hr", "super-admin"), createEmployee);

// Get single employee by ID - restricted to admin, hr, super-admin
router.get("/:id", protect, authorize("admin", "hr", "super-admin"), getEmployeeById);

// Update employee details - restricted to super-admin & hr (no restrictions on fields)
router.put("/:id", protect, authorize("super-admin", "hr"), updateEmployee);

// Update employee status (active/inactive) - accessible to admin, hr, super-admin
router.patch("/:id/status", protect, authorize("admin", "hr", "super-admin"), updateEmployeeStatus);

module.exports = router;
