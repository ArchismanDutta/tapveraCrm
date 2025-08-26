const express = require("express");
const router = express.Router();
const ChatController = require("../controllers/chatController");
const { protect } = require("../middlewares/authMiddleware");

// router.use(authMiddleware);

router.get("/:otherUserId", protect, async (req, res) => {
  try {
    console.log(
      "API request by:",
      req.user._id,
      "for chat with:",
      req.params.otherUserId
    );
    const userId = req.user._id; // assuming authMiddleware sets req.user
    const otherUserId = req.params.otherUserId;
    const messages = await ChatController.getMessages(userId, otherUserId);
    res.json(messages);
  } catch (error) {
    res.status(500).json({ error: "Failed to get messages" });
  }
});

module.exports = router;
