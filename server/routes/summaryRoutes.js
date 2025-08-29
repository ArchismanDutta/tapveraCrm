// File: routes/summaryRoutes.js

const express = require("express");
const router = express.Router();
const { protect } = require("../middlewares/authMiddleware");
const { getWeeklySummary } = require("../controllers/summaryController");

// ======================
// Weekly Summary Route
// ======================

// GET /api/summary/week
// Fetch weekly summary for the logged-in user
router.get("/week", protect, getWeeklySummary);

module.exports = router;
