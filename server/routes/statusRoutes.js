// File: routes/statusRoutes.js

const express = require("express");
const router = express.Router();
const { protect } = require("../middlewares/authMiddleware");
const statusController = require("../controllers/statusController")

// ======================
// User Status Routes
// ======================

// GET /api/status/today
// Fetch today's status for the logged-in user
router.get("/today", protect, statusController.getTodayStatus);

// GET /api/status/today/:employeeId
// Fetch today's status for a specific employee (admin/super-admin only)
router.get("/today/:employeeId", protect, statusController.getEmployeeTodayStatus);

// PUT /api/status/today
// Update today's status (punch in/out, break start/end, work/resume)
router.put("/today", protect, statusController.updateTodayStatus);

module.exports = router;
