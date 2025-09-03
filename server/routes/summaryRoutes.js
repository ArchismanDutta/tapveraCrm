const express = require("express");
const router = express.Router();
const { protect } = require("../middlewares/authMiddleware");
const { getWeeklySummary } = require("../controllers/summaryController");

// ======================
// Weekly Summary Route
// ======================
// GET /api/summary/week
// Fetches weekly summary data for the logged-in user
// Optional query params: startDate, endDate (YYYY-MM-DD)
// ======================
router.get("/week", protect, getWeeklySummary);

module.exports = router;
