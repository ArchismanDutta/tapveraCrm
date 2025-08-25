// routes/userRoutes.js
const express = require("express");
const router = express.Router();
const { protect } = require("../middlewares/authMiddleware");
const { authorize } = require("../middlewares/roleMiddleware");
const userController = require("../controllers/userController");
const User = require("../models/User")

// Route to create new employee (admin/hr/super-admin only)
router.post(
  "/create",
  protect,
  authorize("admin", "super-admin", "hr"),
  userController.createEmployee
);

// Route to get current logged-in user
router.get("/me", protect, userController.getMe);

router.get("/all", protect, async (req, res) => {
  try {
    // Fetch all active users ignoring roles
    const users = await User.find({}, "_id name email role"); // select necessary fields
    res.json(users);
  } catch (err) {
    res.status(500).json({ error: "Failed to fetch users" });
  }
});

module.exports = router;
