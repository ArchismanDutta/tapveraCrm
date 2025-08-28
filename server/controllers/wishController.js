// controllers/wishController.js
const Wish = require("../models/Wish");
const User = require("../models/User");

// HR sends a wish
exports.sendWish = async (req, res) => {
  try {
    const { recipientId, type, message } = req.body;
    const senderId = req.user._id;

    if (!recipientId || !type || !message) {
      return res.status(400).json({ message: "All fields are required" });
    }

    const recipient = await User.findById(recipientId);
    if (!recipient) return res.status(404).json({ message: "Recipient not found" });

    const wish = new Wish({ type, message, senderId, recipientId });
    await wish.save();

    // Optional: send via WebSocket to live recipient
    if (global.users && global.users[recipientId]) {
      global.users[recipientId].send(
        JSON.stringify({ type: "wish", wish })
      );
    }

    res.status(201).json({ message: "Wish sent", wish });
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: "Server error" });
  }
};

// Get all unread wishes for current employee
exports.getEmployeeWishes = async (req, res) => {
  try {
    const wishes = await Wish.find({ recipientId: req.user._id, read: false })
      .populate("senderId", "name avatar")
      .sort({ createdAt: -1 });
    res.json(wishes);
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: "Server error" });
  }
};

// Mark a wish as read
exports.markWishRead = async (req, res) => {
  try {
    const { wishId } = req.params;
    const wish = await Wish.findByIdAndUpdate(wishId, { read: true }, { new: true });
    if (!wish) return res.status(404).json({ message: "Wish not found" });
    res.json({ message: "Wish marked as read", wish });
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: "Server error" });
  }
};
