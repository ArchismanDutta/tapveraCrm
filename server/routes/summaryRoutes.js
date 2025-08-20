const express = require("express");
const router = express.Router();
const { protect } = require("../middlewares/authMiddleware");
const { getWeeklySummary } = require("../controllers/summaryController");

router.get("/week", protect, getWeeklySummary);

module.exports = router;
