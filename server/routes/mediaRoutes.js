// routes/mediaRoutes.js
const express = require("express");
const router = express.Router();
const { protect } = require("../middlewares/authMiddleware");
const { authorize } = require("../middlewares/roleMiddleware");
const { getMediaStats, cleanupOldMedia } = require("../services/mediaCleanupService");
const { runManualCleanup } = require("../jobs/cronJobs");

// Get media storage statistics (admin only)
router.get("/stats", protect, authorize("admin", "super-admin"), async (req, res) => {
  try {
    const stats = await getMediaStats();
    res.json(stats);
  } catch (error) {
    console.error("Error getting media stats:", error);
    res.status(500).json({ message: "Server error" });
  }
});

// Manually trigger media cleanup (admin only)
router.post("/cleanup", protect, authorize("admin", "super-admin"), async (req, res) => {
  try {
    const result = await runManualCleanup();
    res.json(result);
  } catch (error) {
    console.error("Error running manual cleanup:", error);
    res.status(500).json({ message: "Server error" });
  }
});

module.exports = router;
