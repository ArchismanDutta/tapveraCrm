// File: routes/userRoutes.js

const express = require("express");
const router = express.Router();

const { protect } = require("../middlewares/authMiddleware");
const { authorize } = require("../middlewares/roleMiddleware");
const User = require("../models/User");
const { getAllEmployeesWithWorkload } = require("../services/workloadService");
// Access-management rework (2026-07-03) - Phase 4.7.
// See docs/superpowers/plans/2026-07-03-access-management-rework.md
const { can } = require("../utils/accessControl");

// Additive: admin/hr/super-admin keep exactly what they had (authorize(...)
// below is left in place). Adds an alternative path for anyone whose
// Position is explicitly granted "canManageUsers" (Admin + HR by default -
// see seedCanonicalHierarchy.js).
const requireUserManage = (roles) => async (req, res, next) => {
  if (await can(req.user, "users:manage")) return next();
  return authorize(...roles)(req, res, next);
};

// Additive: admin/super-admin keep exactly what they had. Adds an
// alternative path for anyone with "tasks:assign" authority (e.g.
// PM/Supervisor/TL) - workload visibility is what they need it for.
const requireWorkloadView = async (req, res, next) => {
  if (await can(req.user, "tasks:assign")) return next();
  return authorize("admin", "super-admin")(req, res, next);
};

const {
  createEmployee,
  getAllUsers,
  getMe,
  getMyPermissions,
  getEmployeeDirectory,
  getEmployeeById,
  updateEmployeeStatus,
  updateEmployee,
  getNextEmployeeId,
} = require("../controllers/userController");

// ================================
// User / Employee Routes
// ================================

// Employee Directory - accessible to all logged-in users, with optional filters & search
router.get("/directory", protect, getEmployeeDirectory);

// Get all employees with workload information - for task assignment
router.get("/workload", protect, requireWorkloadView, async (req, res) => {
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

// Resolved permissions for the logged-in user (Access-management rework,
// Phase 5.1) - the frontend's single source of truth for what to show/hide.
router.get("/me/permissions", protect, getMyPermissions);

// Get all users - full info, restricted to admin, hr, super-admin
router.get("/", protect, requireUserManage(["admin", "hr", "super-admin"]), getAllUsers);

// Get all users - minimal info (id, name, email, role, shift), restricted to admin/hr/super-admin
router.get("/all", protect, requireUserManage(["admin", "hr", "super-admin"]), async (req, res) => {
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

// Assignable users list — minimal info (id, name, email, designation) for task assignment
// Accessible to any authenticated user so all roles can create and assign tasks
router.get("/assignable", protect, async (req, res) => {
  try {
    const users = await User.find(
      { status: { $nin: ["terminated", "absconded"] } },
      "_id name email designation role"
    ).sort({ name: 1 });
    res.json(users);
  } catch (err) {
    console.error("Fetch assignable users error:", err);
    res.status(500).json({ error: "Failed to fetch users" });
  }
});

// Get next auto-generated employee ID - restricted to admin, hr, super-admin
router.get("/next-id", protect, requireUserManage(["admin", "hr", "super-admin"]), getNextEmployeeId);

// Create new employee - restricted to admin, hr, super-admin
router.post("/create", protect, requireUserManage(["admin", "hr", "super-admin"]), createEmployee);

// Get single employee by ID - restricted to admin, hr, super-admin
router.get("/:id", protect, requireUserManage(["admin", "hr", "super-admin"]), getEmployeeById);

// Update employee details - restricted to super-admin & hr (no restrictions on fields)
// NOTE (2026-07-03, Phase 4.7): deliberately NOT additively expanded like its
// siblings above - this one excludes plain "admin" already (unlike every
// other route in this file), and both Admin and HR get canManageUsers by
// default (seedCanonicalHierarchy.js), so reusing users:manage here would
// silently hand Admin-position holders edit rights this route currently
// withholds from them. Left untouched pending a deliberate decision, same
// category as the Phase 4.5 payroll question.
router.put("/:id", protect, authorize("super-admin", "hr"), updateEmployee);

// Update employee status (active/terminated/absconded) - accessible to admin, hr, super-admin
router.patch("/:id/status", protect, requireUserManage(["admin", "hr", "super-admin"]), updateEmployeeStatus);
router.put("/:id/status", protect, requireUserManage(["admin", "hr", "super-admin"]), updateEmployeeStatus);

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
