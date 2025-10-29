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
    const { conversationId, message, replyTo, mentions } = req.body;
    const senderId = req.user._id;

    // Parse mentions if sent as JSON string (from FormData)
    let mentionedUserIds = [];
    if (mentions) {
      try {
        mentionedUserIds = typeof mentions === 'string' ? JSON.parse(mentions) : mentions;
      } catch (e) {
        console.warn('Failed to parse mentions:', e);
      }
    }

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
      replyTo || null,
      mentionedUserIds
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
          mentions: savedMessage.mentions || [],
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

// Summarize conversation messages
router.post("/conversations/:conversationId/summarize", protect, async (req, res) => {
  try {
    const { conversationId } = req.params;
    const { days = 7 } = req.body; // Default to last 7 days

    // Calculate date range
    const startDate = new Date();
    startDate.setDate(startDate.getDate() - days);

    const ChatMessage = require("../models/ChatMessage");

    // Fetch messages from the last N days
    const messages = await ChatMessage.find({
      conversationId,
      timestamp: { $gte: startDate }
    })
    .sort({ timestamp: 1 })
    .populate("senderId", "firstName lastName email")
    .lean();

    if (!messages || messages.length === 0) {
      return res.json({ summary: "No messages found in the selected time period." });
    }

    // Format messages for AI
    const formattedMessages = messages.map(msg => {
      const sender = msg.senderId ? `${msg.senderId.firstName} ${msg.senderId.lastName}` : "Unknown";
      const timestamp = new Date(msg.timestamp).toLocaleDateString();
      const hasAttachments = msg.attachments && msg.attachments.length > 0 ? ` [${msg.attachments.length} attachment(s)]` : "";
      return `[${timestamp}] ${sender}: ${msg.message}${hasAttachments}`;
    }).join("\n");

    // Call OpenRouter API with Gemma model
    const response = await fetch("https://openrouter.ai/api/v1/chat/completions", {
      method: "POST",
      headers: {
        "Authorization": `Bearer ${process.env.OPENROUTER_API_KEY}`,
        "Content-Type": "application/json"
      },
      body: JSON.stringify({
        model: process.env.OPENROUTER_MODEL || "google/gemma-2-9b-it:free",
        messages: [
          {
            role: "system",
            content: "You are a helpful assistant that summarizes conversations. Provide a clear, concise summary highlighting key topics discussed, decisions made, action items, and important context. Keep it professional and organized."
          },
          {
            role: "user",
            content: `Please summarize the following conversation from the last ${days} days:\n\n${formattedMessages}`
          }
        ]
      })
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error("OpenRouter API error:", response.status, errorText);
      return res.status(500).json({
        error: "Failed to generate summary from AI service",
        details: errorText,
        status: response.status
      });
    }

    const data = await response.json();
    let summary = data.choices?.[0]?.message?.content || "Unable to generate summary.";

    // Remove <think> tags and their content (AI reasoning artifacts)
    summary = summary.replace(/<think>[\s\S]*?<\/think>/gi, '').trim();

    res.json({
      summary,
      messageCount: messages.length,
      dateRange: {
        from: startDate.toISOString(),
        to: new Date().toISOString()
      }
    });

  } catch (error) {
    console.error("Error summarizing conversation:", error);
    res.status(500).json({ error: "Failed to summarize conversation" });
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
