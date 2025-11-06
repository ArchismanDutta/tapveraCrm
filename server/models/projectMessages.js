const express = require("express");
const router = express.Router();
const Message = require("../models/Message");
const Project = require("../models/Project");
const User = require("../models/User");
const Client = require("../models/Client");
const { protect } = require("../middlewares/authMiddleware");
const { uploadToS3, getFileType, convertToCloudFrontUrl, isS3Configured } = require("../config/s3Config");

// Get all messages for a project
router.get(
  "/api/projects/:projectId/messages",
  protect,
  async (req, res) => {
    try {
      const { projectId } = req.params;

      // Verify project exists and user has access
      const project = await Project.findById(projectId);
      if (!project) {
        return res.status(404).json({ message: "Project not found" });
      }

      // Check if user has access to this project
      const userId = req.user._id;
      const userRole = req.user.role;

      if (userRole === "client") {
        // Check if client is part of this project
        const isClient = project.clients.some(
          (clientId) => clientId.toString() === userId.toString()
        );
        if (!isClient) {
          return res.status(403).json({ message: "Access denied" });
        }
      } else if (userRole === "employee") {
        // Check if employee is assigned to this project
        const isAssigned = project.assignedTo.some(
          (emp) => emp.toString() === userId
        );
        if (!isAssigned) {
          return res.status(403).json({ message: "Access denied" });
        }
      }
      // Superadmins have access to all projects

      // Extract query parameters for search
      const { search, startDate, endDate, senderName } = req.query;

      // Build filter
      const filter = { project: projectId };

      // Search in message text
      if (search) {
        filter.message = { $regex: search, $options: "i" };
      }

      // Filter by date range
      if (startDate || endDate) {
        filter.createdAt = {};
        if (startDate) {
          filter.createdAt.$gte = new Date(startDate);
        }
        if (endDate) {
          filter.createdAt.$lte = new Date(endDate);
        }
      }

      const messages = await Message.find(filter)
        .populate({
          path: "sentBy",
          select: "name email clientName",
        })
        .populate({
          path: "replyTo",
          select: "message sentBy createdAt",
          populate: {
            path: "sentBy",
            select: "name email clientName",
          },
        })
        .sort({ createdAt: 1 });

      // Filter by sender name if provided
      let filteredMessages = messages;
      if (senderName) {
        filteredMessages = messages.filter((msg) => {
          const name = msg.sentBy?.name || msg.sentBy?.clientName || "";
          return name.toLowerCase().includes(senderName.toLowerCase());
        });
      }

      res.json(filteredMessages);
    } catch (error) {
      console.error("Error fetching messages:", error);
      res.status(500).json({ message: "Server error" });
    }
  }
);

// Send a message with optional file attachments
router.post(
  "/api/projects/:projectId/messages",
  protect,
  uploadToS3.array("files", 5), // Allow up to 5 files
  async (req, res) => {
    try {
      const { projectId } = req.params;
      const { message, senderType, replyTo } = req.body;
      const userId = req.user._id;
      const userRole = req.user.role;

      if (!message || !message.trim()) {
        return res.status(400).json({ message: "Message cannot be empty" });
      }

      // Verify project exists and user has access
      const project = await Project.findById(projectId);
      if (!project) {
        return res.status(404).json({ message: "Project not found" });
      }

      // Verify access
      if (userRole === "client") {
        const isClient = project.clients.some(
          (clientId) => clientId.toString() === userId.toString()
        );
        if (!isClient) {
          return res.status(403).json({ message: "Access denied" });
        }
      } else if (userRole === "employee") {
        const isAssigned = project.assignedTo.some(
          (emp) => emp.toString() === userId
        );
        if (!isAssigned) {
          return res.status(403).json({ message: "Access denied" });
        }
      }

      // Determine sender model
      const senderModel = userRole === "client" ? "Client" : "User";

      // Process attachments from S3 or local storage
      const attachments = [];
      if (req.files && req.files.length > 0) {
        for (const file of req.files) {
          const fileUrl = isS3Configured
            ? convertToCloudFrontUrl(file.location) // CloudFront URL
            : `/uploads/messages/${file.filename}`; // Local URL

          // Extract S3 key from file location for deletion
          const s3Key = isS3Configured && file.key ? file.key : null;

          attachments.push({
            filename: file.originalname,
            url: fileUrl,
            size: file.size,
            mimeType: file.mimetype,
            fileType: getFileType(file.mimetype),
            uploadedAt: new Date(),
            isImportant: false, // Default to not important
            s3Key: s3Key, // Store S3 key for future deletion
          });
        }
      }

      const newMessage = new Message({
        project: projectId,
        message: message.trim(),
        sentBy: userId,
        senderModel,
        senderType: senderType || userRole,
        replyTo: replyTo || null,
        attachments: attachments,
      });

      await newMessage.save();

      // Populate sender info and reply before sending response
      await newMessage.populate([
        {
          path: "sentBy",
          select: "name email clientName",
        },
        {
          path: "replyTo",
          select: "message sentBy createdAt",
          populate: {
            path: "sentBy",
            select: "name email clientName",
          },
        },
      ]);

      res.status(201).json(newMessage);
    } catch (error) {
      console.error("Error sending message:", error);
      res.status(500).json({ message: "Server error" });
    }
  }
);

// Mark messages as read
router.patch(
  "/api/projects/:projectId/messages/mark-read",
  protect,
  async (req, res) => {
    try {
      const { projectId } = req.params;
      const userId = req.user._id;
      const userRole = req.user.role;

      const senderModel = userRole === "client" ? "Client" : "User";

      // Get all unread messages for this user
      const messages = await Message.find({
        project: projectId,
        "readBy.user": { $ne: userId },
      });

      // Mark each message as read
      for (const message of messages) {
        message.readBy.push({
          user: userId,
          userModel: senderModel,
          readAt: new Date(),
        });
        await message.save();
      }

      res.json({ message: "Messages marked as read", count: messages.length });
    } catch (error) {
      console.error("Error marking messages as read:", error);
      res.status(500).json({ message: "Server error" });
    }
  }
);

// Delete a message (only sender or superadmin)
router.delete(
  "/api/projects/:projectId/messages/:messageId",
  protect,
  async (req, res) => {
    try {
      const { projectId, messageId } = req.params;
      const userId = req.user._id;
      const userRole = req.user.role;

      const message = await Message.findById(messageId);
      if (!message) {
        return res.status(404).json({ message: "Message not found" });
      }

      // Check if user can delete (must be sender or superadmin)
      if (message.sentBy.toString() !== userId && userRole !== "superadmin") {
        return res.status(403).json({ message: "Access denied" });
      }

      await Message.findByIdAndDelete(messageId);
      res.json({ message: "Message deleted successfully" });
    } catch (error) {
      console.error("Error deleting message:", error);
      res.status(500).json({ message: "Server error" });
    }
  }
);

// Get unread message count for a project
router.get(
  "/api/projects/:projectId/messages/unread-count",
  protect,
  async (req, res) => {
    try {
      const { projectId } = req.params;
      const userId = req.user._id;

      const count = await Message.countDocuments({
        project: projectId,
        sentBy: { $ne: userId },
        "readBy.user": { $ne: userId },
      });

      res.json({ count });
    } catch (error) {
      console.error("Error getting unread count:", error);
      res.status(500).json({ message: "Server error" });
    }
  }
);

// Add or remove reaction to a message
router.post(
  "/api/projects/:projectId/messages/:messageId/react",
  protect,
  async (req, res) => {
    try {
      const { messageId } = req.params;
      const { emoji } = req.body;
      const userId = req.user._id;
      const userRole = req.user.role;

      if (!emoji) {
        return res.status(400).json({ message: "Emoji is required" });
      }

      const message = await Message.findById(messageId);
      if (!message) {
        return res.status(404).json({ message: "Message not found" });
      }

      const userModel = userRole === "client" ? "Client" : "User";

      // Find if this emoji already exists
      const emojiReaction = message.reactions.find((r) => r.emoji === emoji);

      if (emojiReaction) {
        // Check if user already reacted with this emoji
        const userReactionIndex = emojiReaction.users.findIndex(
          (u) => u.user.toString() === userId
        );

        if (userReactionIndex > -1) {
          // Remove user's reaction
          emojiReaction.users.splice(userReactionIndex, 1);

          // If no users left, remove the emoji entirely
          if (emojiReaction.users.length === 0) {
            message.reactions = message.reactions.filter((r) => r.emoji !== emoji);
          }
        } else {
          // Add user's reaction
          emojiReaction.users.push({
            user: userId,
            userModel: userModel,
          });
        }
      } else {
        // Create new emoji reaction
        message.reactions.push({
          emoji: emoji,
          users: [
            {
              user: userId,
              userModel: userModel,
            },
          ],
        });
      }

      await message.save();

      // Populate and return updated message
      await message.populate([
        {
          path: "sentBy",
          select: "name email clientName",
        },
        {
          path: "reactions.users.user",
          select: "name email clientName",
        },
      ]);

      res.json(message);
    } catch (error) {
      console.error("Error adding reaction:", error);
      res.status(500).json({ message: "Server error" });
    }
  }
);

module.exports = router;
