const express = require("express");
const router = express.Router();
const chatController = require("../controllers/chatController");
const { protect } = require("../middlewares/authMiddleware");

// router.use(authMiddleware);

// Create a new group conversation (admin or super-admin)
router.post("/groups", protect, async (req, res) => {
  try {
    const { name, memberIds } = req.body;
    const createdBy = req.user._id;
    const newGroup = await chatController.createGroupConversation(name, memberIds, createdBy);
    res.status(201).json(newGroup);
  } catch (error) {
    res.status(500).json({ error: "Failed to create group conversation" });
  }
});

// Get all group conversations for the logged-in user
router.get("/groups", protect, async (req, res) => {
  try {
    const userId = req.user._id;
    const groups = await chatController.getGroupConversationsForUser(userId);
    res.json(groups);
  } catch (error) {
    res.status(500).json({ error: "Failed to fetch groups" });
  }
});

// Get messages by conversation ID (one-to-one or group)
router.get("/messages/:conversationId", protect, async (req, res) => {
  try {
    const messages = await chatController.getMessagesByConversation(req.params.conversationId);
    res.json(messages);
  } catch (error) {
    res.status(500).json({ error: "Failed to fetch messages" });
  }
});

// Send a message to a conversation
router.post("/messages", protect, async (req, res) => {
  try {
    const { conversationId, message } = req.body;
    const senderId = req.user._id;
    const savedMessage = await chatController.saveMessage(conversationId, senderId, message);
    res.status(201).json(savedMessage);
  } catch (error) {
    res.status(500).json({ error: "Failed to send message" });
  }
});

// Get or create private conversation between two users
router.post("/private-conversation", protect, async (req, res) => {
  try {
    const { otherUserId } = req.body;
    const userId = req.user._id;
    const conversation = await chatController.getOrCreatePrivateConversation(userId, otherUserId);
    res.json(conversation);
  } catch (error) {
    res.status(500).json({ error: "Failed to get or create private conversation" });
  }
});

module.exports = router;
