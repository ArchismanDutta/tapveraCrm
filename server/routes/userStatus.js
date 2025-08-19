const express = require('express');
const router = express.Router();
const UserStatus = require('../models/UserStatus');
// const authMiddleware = require('../middleware/auth'); // Uncomment and configure your auth middleware

// Helper: get today’s date at midnight for accurate matching
const getTodayMidnight = () => {
  const now = new Date();
  return new Date(now.getFullYear(), now.getMonth(), now.getDate());
};

// GET today's status, timeline, break info
router.get('/today-status', /* authMiddleware, */ async (req, res) => {
  try {
    const userId = req.user ? req.user.id : req.query.userId;
    if (!userId) return res.status(400).json({ error: "Missing userId" });

    const today = getTodayMidnight();

    let status = await UserStatus.findOne({ userId, today });
    if (!status) {
      return res.json({
        workDuration: "0h",
        breakTime: "0m",
        arrivalTime: "--",
        currentlyWorking: false,
        breakDuration: "00:00:00",
        onBreak: false,
        timeline: [],
      });
    }

    res.json({
      workDuration: status.workDuration,
      breakTime: status.breakTime,
      arrivalTime: status.arrivalTime,
      currentlyWorking: status.currentlyWorking,
      breakDuration: status.breakDuration,
      onBreak: status.onBreak,
      timeline: status.timeline,
    });
  } catch (err) {
    console.error("Error in /today-status:", err);
    res.status(500).json({ error: "Server error fetching today status" });
  }
});

// GET week summary
router.get('/week-summary', /* authMiddleware, */ async (req, res) => {
  try {
    const userId = req.user ? req.user.id : req.query.userId;
    if (!userId) return res.status(400).json({ error: "Missing userId" });

    const status = await UserStatus.findOne({ userId }).sort({ today: -1 });
    if (!status) return res.json({});

    res.json(status.weekSummary);
  } catch (err) {
    console.error("Error in /week-summary:", err);
    res.status(500).json({ error: "Server error fetching week summary" });
  }
});

// GET recent activities
router.get('/recent-activities', /* authMiddleware, */ async (req, res) => {
  try {
    const userId = req.user ? req.user.id : req.query.userId;
    if (!userId) return res.status(400).json({ error: "Missing userId" });

    const status = await UserStatus.findOne({ userId }).sort({ today: -1 });
    if (!status) return res.json({ activities: [] });

    res.json({ activities: status.recentActivities });
  } catch (err) {
    console.error("Error in /recent-activities:", err);
    res.status(500).json({ error: "Server error fetching recent activities" });
  }
});

// POST start break
router.post('/start-break', /* authMiddleware, */ async (req, res) => {
  try {
    const userId = req.user ? req.user.id : req.body.userId;
    if (!userId) return res.status(400).json({ error: "Missing userId" });

    const today = getTodayMidnight();

    await UserStatus.findOneAndUpdate(
      { userId, today },
      { $set: { onBreak: true } },
      { upsert: true, new: true }
    );

    res.json({ success: true });
  } catch (err) {
    console.error("Error in /start-break:", err);
    res.status(500).json({ error: "Failed to start break" });
  }
});

// POST end break
router.post('/end-break', /* authMiddleware, */ async (req, res) => {
  try {
    const userId = req.user ? req.user.id : req.body.userId;
    if (!userId) return res.status(400).json({ error: "Missing userId" });

    const today = getTodayMidnight();

    await UserStatus.findOneAndUpdate(
      { userId, today },
      { $set: { onBreak: false } },
      { upsert: true, new: true }
    );

    res.json({ success: true });
  } catch (err) {
    console.error("Error in /end-break:", err);
    res.status(500).json({ error: "Failed to end break" });
  }
});

// POST punch in
router.post('/punch-in', /* authMiddleware, */ async (req, res) => {
  try {
    const userId = req.user ? req.user.id : req.body.userId;
    if (!userId) return res.status(400).json({ error: "Missing userId" });

    const today = getTodayMidnight();
    const time = new Date().toLocaleTimeString();

    await UserStatus.findOneAndUpdate(
      { userId, today },
      { $set: { currentlyWorking: true, arrivalTime: time } },
      { upsert: true, new: true }
    );

    res.json({ success: true });
  } catch (err) {
    console.error("Error in /punch-in:", err);
    res.status(500).json({ error: "Failed to punch in" });
  }
});

// POST punch out
router.post('/punch-out', /* authMiddleware, */ async (req, res) => {
  try {
    const userId = req.user ? req.user.id : req.body.userId;
    if (!userId) return res.status(400).json({ error: "Missing userId" });

    const today = getTodayMidnight();

    await UserStatus.findOneAndUpdate(
      { userId, today },
      { $set: { currentlyWorking: false } },
      { upsert: true, new: true }
    );

    res.json({ success: true });
  } catch (err) {
    console.error("Error in /punch-out:", err);
    res.status(500).json({ error: "Failed to punch out" });
  }
});

module.exports = router;
