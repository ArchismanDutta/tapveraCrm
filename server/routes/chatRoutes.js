const express = require("express");
const router = express.Router();
const { protect } = require("../middlewares/authMiddleware");
const chatController = require("../controllers/chatController");

// Get all users
router.get("/users", protect, chatController.getAllUsers);

// Get or create conversation with a user
router.post("/conversation", protect, chatController.getOrCreateConversation);

// Get messages (polling)
router.get("/messages/:conversationId", protect, chatController.getMessages);

// Send a new message
router.post("/messages/:conversationId", protect, chatController.postMessage);

module.exports = router;
