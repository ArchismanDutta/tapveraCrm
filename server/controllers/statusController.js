// server/controllers/statusController.js
const UserStatus = require("../models/UserStatus");

// GET today's status
exports.getTodayStatus = async (req, res) => {
  try {
    const userId = req.user._id;
    let todayStatus = await UserStatus.findOne({ userId, today: { $gte: new Date().setHours(0, 0, 0, 0) } });

    // If no status exists for today, create one
    if (!todayStatus) {
      todayStatus = await UserStatus.create({ userId, currentlyWorking: true, onBreak: false });
    }

    res.json(todayStatus);
  } catch (err) {
    console.error("Error fetching today's status:", err);
    res.status(500).json({ message: "Server error" });
  }
};

// PUT update today's status
exports.updateTodayStatus = async (req, res) => {
  try {
    const userId = req.user._id;
    const { onBreak, currentlyWorking, timelineEvent, arrivalTime, breakStartTime } = req.body;

    let todayStatus = await UserStatus.findOne({ userId, today: { $gte: new Date().setHours(0, 0, 0, 0) } });
    if (!todayStatus) {
      todayStatus = await UserStatus.create({ userId, currentlyWorking: true, onBreak: false });
    }

    if (onBreak !== undefined) todayStatus.onBreak = onBreak;
    if (currentlyWorking !== undefined) todayStatus.currentlyWorking = currentlyWorking;

    if (arrivalTime !== undefined) todayStatus.arrivalTime = arrivalTime;
    if (breakStartTime !== undefined) todayStatus.breakStartTime = breakStartTime;

    if (timelineEvent && timelineEvent.type && timelineEvent.time) {
      todayStatus.timeline.push(timelineEvent);
    }

    await todayStatus.save();

    res.json(todayStatus);
  } catch (err) {
    console.error("Error updating today's status:", err);
    res.status(500).json({ message: "Server error" });
  }
};
