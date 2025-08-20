const express = require("express");
const router = express.Router();
const { protect } = require("../middlewares/authMiddleware");
const { getTodayStatus, updateTodayStatus } = require("../controllers/statusController");

router.get("/", protect, getTodayStatus);
router.put("/", protect, updateTodayStatus);

module.exports = router;
