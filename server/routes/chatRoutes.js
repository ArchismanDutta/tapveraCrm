const express = require("express");
const router = express.Router();
const chatController = require("../controllers/chatController");
const { protect } = require("../middlewares/authMiddleware");
const { uploadToS3, getFileType, convertToCloudFrontUrl } = require("../config/s3Config");
const { broadcastMessageToConversation } = require("../utils/websocket");

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

// Send a message to a conversation (with optional file attachments)
router.post("/messages", protect, uploadToS3.array("files", 5), async (req, res) => {
  try {
    const { conversationId, message, replyTo } = req.body;
    const senderId = req.user._id;

    // Process file attachments
    const attachments = [];
    if (req.files && req.files.length > 0) {
      for (const file of req.files) {
        const fileUrl = file.location || `/uploads/messages/${file.filename}`;
        const cloudFrontUrl = convertToCloudFrontUrl(fileUrl);

        attachments.push({
          filename: file.originalname,
          url: cloudFrontUrl,
          size: file.size,
          mimeType: file.mimetype,
          fileType: getFileType(file.mimetype),
          uploadedAt: new Date(),
        });
      }
    }

    const savedMessage = await chatController.saveMessage(
      conversationId,
      senderId,
      message,
      attachments,
      replyTo || null
    );

    // Populate replyTo if exists
    if (savedMessage.replyTo) {
      await savedMessage.populate("replyTo");
    }

    // Broadcast message to all conversation members via WebSocket
    try {
      const conversation = await chatController.getConversationById(conversationId);
      if (conversation && conversation.members) {
        const payload = {
          _id: savedMessage._id,
          conversationId: savedMessage.conversationId,
          senderId: savedMessage.senderId,
          message: savedMessage.message,
          timestamp: savedMessage.timestamp,
          attachments: savedMessage.attachments || [],
          replyTo: savedMessage.replyTo || null,
        };

        broadcastMessageToConversation(conversationId, conversation.members, payload);
      }
    } catch (broadcastError) {
      console.error("Error broadcasting message:", broadcastError);
      // Don't fail the request if broadcast fails
    }

    res.status(201).json(savedMessage);
  } catch (error) {
    console.error("Error sending message:", error);
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

// Delete a conversation and its messages
router.delete("/conversations/:id", protect, async (req, res) => {
  try {
    const conversationId = req.params.id;

    // Optionally: Add authorization checks if needed to allow only members or admins to delete

    const deletedConversation = await chatController.deleteConversation(
      conversationId
    );

    if (!deletedConversation) {
      return res.status(404).json({ error: "Conversation not found" });
    }

    res.json({ message: "Conversation and its messages deleted successfully" });
  } catch (error) {
    console.error("Delete conversation error:", error);
    res.status(500).json({ error: "Failed to delete conversation" });
  }
});

// Add or remove reaction to a chat message
router.post("/messages/:messageId/react", protect, async (req, res) => {
  try {
    const { messageId } = req.params;
    const { emoji } = req.body;
    const userId = req.user._id.toString();

    if (!emoji) {
      return res.status(400).json({ error: "Emoji is required" });
    }

    const ChatMessage = require("../models/ChatMessage");
    const message = await ChatMessage.findById(messageId);

    if (!message) {
      return res.status(404).json({ error: "Message not found" });
    }

    // Find if this emoji already exists
    const emojiReaction = message.reactions.find((r) => r.emoji === emoji);

    if (emojiReaction) {
      // Check if user already reacted with this emoji
      const userReactionIndex = emojiReaction.users.indexOf(userId);

      if (userReactionIndex > -1) {
        // Remove user's reaction
        emojiReaction.users.splice(userReactionIndex, 1);

        // If no users left, remove the emoji entirely
        if (emojiReaction.users.length === 0) {
          message.reactions = message.reactions.filter((r) => r.emoji !== emoji);
        }
      } else {
        // Add user's reaction
        emojiReaction.users.push(userId);
      }
    } else {
      // Create new emoji reaction
      message.reactions.push({
        emoji: emoji,
        users: [userId],
      });
    }

    await message.save();

    // Broadcast reaction update via WebSocket
    try {
      const conversation = await chatController.getConversationById(message.conversationId);
      if (conversation && conversation.members) {
        const payload = {
          type: "reaction",
          messageId: message._id,
          reactions: message.reactions,
        };
        broadcastMessageToConversation(message.conversationId, conversation.members, payload);
      }
    } catch (broadcastError) {
      console.error("Error broadcasting reaction:", broadcastError);
    }

    res.json(message);
  } catch (error) {
    console.error("Error adding reaction:", error);
    res.status(500).json({ error: "Failed to add reaction" });
  }
});

module.exports = router;
