// controllers/wishController.js
const Wish = require("../models/Wish");
const User = require("../models/User");
const notificationService = require("../services/notificationService");

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

    // Persisted + real-time notification to the recipient. (This used to
    // reach for a `global.users` socket map that was never actually
    // populated anywhere, so wishes never made it to the recipient in
    // real time — this now goes through the same centralized path as
    // every other notification.)
    notificationService
      .notifyUser({
        userId: recipientId,
        type: "wish",
        channel: "wish",
        title: `You received a ${type}!`,
        body: message,
        relatedData: { wishId: wish._id },
      })
      .catch((err) => console.error("Wish notification failed:", err));

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
