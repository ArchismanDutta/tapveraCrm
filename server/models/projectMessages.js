const express = require("express");
const router = express.Router();
const Message = require("../models/Message");
const Project = require("../models/Project");
const User = require("../models/User");
const Client = require("../models/Client");
const { authenticateToken } = require("../middleware/auth");
const { uploadToS3, getFileType, convertToCloudFrontUrl, isS3Configured } = require("../config/s3Config");

// Get all messages for a project
router.get(
  "/api/projects/:projectId/messages",
  authenticateToken,
  async (req, res) => {
    try {
      const { projectId } = req.params;

      // Verify project exists and user has access
      const project = await Project.findById(projectId);
      if (!project) {
        return res.status(404).json({ message: "Project not found" });
      }

      // Check if user has access to this project
      const userId = req.user.id;
      const userRole = req.user.role;

      if (userRole === "client") {
        // Check if client owns this project
        if (project.client.toString() !== userId) {
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
  authenticateToken,
  uploadToS3.array("files", 5), // Allow up to 5 files
  async (req, res) => {
    try {
      const { projectId } = req.params;
      const { message, senderType, replyTo } = req.body;
      const userId = req.user.id;
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
        if (project.client.toString() !== userId) {
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

          attachments.push({
            filename: file.originalname,
            url: fileUrl,
            size: file.size,
            mimeType: file.mimetype,
            fileType: getFileType(file.mimetype),
            uploadedAt: new Date(),
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
  authenticateToken,
  async (req, res) => {
    try {
      const { projectId } = req.params;
      const userId = req.user.id;
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
  authenticateToken,
  async (req, res) => {
    try {
      const { projectId, messageId } = req.params;
      const userId = req.user.id;
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
  authenticateToken,
  async (req, res) => {
    try {
      const { projectId } = req.params;
      const userId = req.user.id;

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

module.exports = router;
