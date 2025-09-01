// File: routes/statusRoutes.js

const express = require("express");
const router = express.Router();
const { protect } = require("../middlewares/authMiddleware");
const { getTodayStatus, updateTodayStatus } = require("../controllers/statusController");

// ======================
// User Status Routes
// ======================

// GET /api/status
// Fetch today's status for the logged-in user
router.get("/", protect, getTodayStatus);

// PUT /api/status
// Update today's status (punch in/out, break start/end, work/resume)
router.put("/", protect, updateTodayStatus);

module.exports = router;
