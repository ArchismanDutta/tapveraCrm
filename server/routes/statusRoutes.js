// server/routes/statusRoutes.js
const express = require("express");
const router = express.Router();
const { protect } = require("../middlewares/authMiddleware");
const { getTodayStatus, updateTodayStatus } = require("../controllers/statusController");

// GET /api/status -> get today's status for logged-in user
router.get("/", protect, getTodayStatus);

// PUT /api/status -> update today's status (e.g., break start/resume)
router.put("/", protect, updateTodayStatus);

module.exports = router;
