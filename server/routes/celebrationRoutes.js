const express = require("express");
const router = express.Router();
const { protect } = require("../middlewares/authMiddleware");
const User = require("../models/User");

// GET /api/celebrations/today - Get today's birthdays and anniversaries
router.get("/today", protect, async (req, res) => {
  try {
    const today = new Date();
    const todayMonth = today.getMonth() + 1; // JavaScript months are 0-indexed
    const todayDay = today.getDate();

    console.log(`Fetching celebrations for ${todayMonth}/${todayDay}`);

    // Find all users with birthdays or anniversaries today
    const users = await User.find({
      $or: [
        {
          $expr: {
            $and: [
              { $eq: [{ $month: "$dob" }, todayMonth] },
              { $eq: [{ $dayOfMonth: "$dob" }, todayDay] }
            ]
          }
        },
        {
          $expr: {
            $and: [
              { $eq: [{ $month: "$doj" }, todayMonth] },
              { $eq: [{ $dayOfMonth: "$doj" }, todayDay] }
            ]
          }
        }
      ]
    }).select("name designation department dob doj avatar");

    const celebrations = [];

    users.forEach(user => {
      // Check for birthday
      if (user.dob) {
        const dobMonth = new Date(user.dob).getMonth() + 1;
        const dobDay = new Date(user.dob).getDate();
        if (dobMonth === todayMonth && dobDay === todayDay) {
          const age = today.getFullYear() - new Date(user.dob).getFullYear();
          celebrations.push({
            type: "birthday",
            user: {
              _id: user._id,
              name: user.name,
              designation: user.designation,
              department: user.department,
              avatar: user.avatar || `https://ui-avatars.com/api/?name=${encodeURIComponent(user.name)}&background=random`
            },
            age: age,
            message: `🎉 Happy ${age}th Birthday!`
          });
        }
      }

      // Check for work anniversary
      if (user.doj) {
        const dojMonth = new Date(user.doj).getMonth() + 1;
        const dojDay = new Date(user.doj).getDate();
        if (dojMonth === todayMonth && dojDay === todayDay) {
          const years = today.getFullYear() - new Date(user.doj).getFullYear();
          if (years > 0) { // Don't show anniversary for first day of work
            celebrations.push({
              type: "anniversary",
              user: {
                _id: user._id,
                name: user.name,
                designation: user.designation,
                department: user.department,
                avatar: user.avatar || `https://ui-avatars.com/api/?name=${encodeURIComponent(user.name)}&background=random`
              },
              years: years,
              message: `🎊 Celebrating ${years} year${years > 1 ? 's' : ''} with us!`
            });
          }
        }
      }
    });

    console.log(`Found ${celebrations.length} celebrations today`);

    res.json({
      date: today.toISOString().split('T')[0],
      celebrations: celebrations,
      hasCelebrations: celebrations.length > 0
    });

  } catch (error) {
    console.error("Error fetching today's celebrations:", error);
    res.status(500).json({
      error: "Failed to fetch celebrations",
      message: error.message
    });
  }
});

// POST /api/celebrations/mark-seen - Mark celebrations as seen for today
router.post("/mark-seen", protect, async (req, res) => {
  try {
    const userId = req.user._id;
    const today = new Date().toISOString().split('T')[0];

    // Store in localStorage on frontend, but we can also track in database if needed
    // For now, just return success - frontend will handle localStorage

    res.json({
      success: true,
      message: "Celebrations marked as seen",
      date: today,
      userId: userId
    });

  } catch (error) {
    console.error("Error marking celebrations as seen:", error);
    res.status(500).json({
      error: "Failed to mark celebrations as seen",
      message: error.message
    });
  }
});

module.exports = router;