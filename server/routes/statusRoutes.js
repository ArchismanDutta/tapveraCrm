// File: routes/statusRoutes.js

const express = require("express");
const router = express.Router();
const { protect } = require("../middlewares/authMiddleware");
const {
  getTodayStatus,
  updateTodayStatus,
} = require("../controllers/statusController");

// ======================
// User Status Routes
// ======================

// GET /api/status/today
// Fetch today's status for the logged-in user
router.get("/today", protect, getTodayStatus);

// PUT /api/status/today
// Update today's status (punch in/out, break start/end, work/resume)
router.put("/today", protect, updateTodayStatus);

module.exports = router;
