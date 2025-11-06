// File: routes/userRoutes.js

const express = require("express");
const router = express.Router();

const { protect } = require("../middlewares/authMiddleware");
const { authorize } = require("../middlewares/roleMiddleware");
const User = require("../models/User");
const { getAllEmployeesWithWorkload } = require("../services/workloadService");

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

// Get all employees with workload information - for task assignment
router.get("/workload", protect, authorize("admin", "super-admin"), async (req, res) => {
  try {
    const employeesWithWorkload = await getAllEmployeesWithWorkload();
    res.json(employeesWithWorkload);
  } catch (error) {
    console.error("Error fetching employee workload:", error);
    res.status(500).json({ message: "Server error fetching employee workload" });
  }
});

// Current logged-in user info
router.get("/me", protect, getMe);

// Get all users - full info, restricted to admin, hr, super-admin
router.get("/", protect, authorize("admin", "hr", "super-admin"), getAllUsers);

// Get all users - minimal info (id, name, email, role, shift), restricted to admin/hr/super-admin
router.get("/all", protect, authorize("admin", "hr", "super-admin"), async (req, res) => {
  try {
    // Exclude terminated and absconded employees by default
    const includeInactive = req.query.includeInactive === 'true';
    const filter = includeInactive
      ? {}
      : { status: { $nin: ['terminated', 'absconded'] } };

    const users = await User.find(filter, "_id name email role shift status");
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

// Update employee status (active/terminated/absconded) - accessible to admin, hr, super-admin
router.patch("/:id/status", protect, authorize("admin", "hr", "super-admin"), updateEmployeeStatus);
router.put("/:id/status", protect, authorize("admin", "hr", "super-admin"), updateEmployeeStatus);

// Cleanup corrupted attendance data - for emergency data fixes
router.post("/cleanup-attendance", protect, authorize("super-admin"), async (req, res) => {
  try {
    const UserStatus = require('../models/UserStatus');

    // Get today's date range
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const todayEnd = new Date(today);
    todayEnd.setHours(23, 59, 59, 999);

    // Find all UserStatus records
    const statuses = await UserStatus.find({});
    let fixedCount = 0;

    for (const status of statuses) {
      let needsUpdate = false;

      // Clean work sessions - only keep today's sessions
      if (status.workedSessions && status.workedSessions.length > 0) {
        const originalCount = status.workedSessions.length;
        status.workedSessions = status.workedSessions.filter(session => {
          if (!session || !session.start) return false;
          const sessionStart = new Date(session.start);
          return sessionStart >= today && sessionStart <= todayEnd;
        });

        if (status.workedSessions.length !== originalCount) {
          needsUpdate = true;
          console.log(`🧹 User ${status.userId}: Cleaned ${originalCount - status.workedSessions.length} old work sessions`);
        }
      }

      // Clean break sessions - only keep today's sessions
      if (status.breakSessions && status.breakSessions.length > 0) {
        const originalCount = status.breakSessions.length;
        status.breakSessions = status.breakSessions.filter(session => {
          if (!session || !session.start) return false;
          const sessionStart = new Date(session.start);
          return sessionStart >= today && sessionStart <= todayEnd;
        });

        if (status.breakSessions.length !== originalCount) {
          needsUpdate = true;
          console.log(`🧹 User ${status.userId}: Cleaned ${originalCount - status.breakSessions.length} old break sessions`);
        }
      }

      // Recalculate work duration from cleaned sessions
      if (needsUpdate) {
        let newWorkDuration = 0;
        if (status.workedSessions && status.workedSessions.length > 0) {
          for (const session of status.workedSessions) {
            if (session.start && session.end) {
              const duration = Math.min((new Date(session.end) - new Date(session.start)) / 1000, 86400);
              newWorkDuration += duration;
            }
          }
        }

        // Cap at 24 hours maximum
        newWorkDuration = Math.min(newWorkDuration, 86400);

        status.workDurationSeconds = Math.floor(newWorkDuration);
        status.totalWorkMs = status.workDurationSeconds * 1000;

        await status.save();
        fixedCount++;
        console.log(`✅ User ${status.userId}: Fixed work duration from corrupted data`);
      }
    }

    res.json({
      success: true,
      message: `Successfully cleaned up attendance data for ${fixedCount} users`,
      fixedCount,
      totalChecked: statuses.length
    });
  } catch (error) {
    console.error('❌ Error cleaning attendance data:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to cleanup attendance data',
      message: error.message
    });
  }
});

module.exports = router;
