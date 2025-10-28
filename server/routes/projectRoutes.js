// routes/projectRoutes.js
const express = require("express");
const router = express.Router();
const Project = require("../models/Project");
const { protect, authorize } = require("../middlewares/authMiddleware");
const { uploadToS3, getFileType, convertToCloudFrontUrl, isS3Configured } = require("../config/s3Config");
const emailNotificationService = require("../services/emailNotificationService");

// @route   GET /api/projects
// @desc    Get all projects (with filters and population)
// @access  Private
router.get("/", protect, async (req, res) => {
  try {
    const {
      type,
      status,
      assignedTo,
      client,
      startDate,
      endDate,
      priority,
      search,
    } = req.query;

    // Build filter object
    let filter = {};

    if (type) filter.type = type;
    if (status) filter.status = status;
    if (assignedTo) filter.assignedTo = assignedTo;
    if (client) filter.client = client;
    if (priority) filter.priority = priority;

    // Date range filters
    if (startDate || endDate) {
      filter.endDate = {};
      if (startDate) filter.endDate.$gte = new Date(startDate);
      if (endDate) filter.endDate.$lte = new Date(endDate);
    }

    // Search functionality
    if (search) {
      filter.$or = [
        { projectName: { $regex: search, $options: "i" } },
        { description: { $regex: search, $options: "i" } },
      ];
    }

    // Role-based filtering
    if (req.user.role === "employee") {
      filter.assignedTo = req.user._id;
    }

    const projects = await Project.find(filter)
      .populate("assignedTo", "name email employeeId designation")
      .populate("client", "clientName businessName email")
      .populate("createdBy", "name email")
      .populate("tasks", "title status priority dueDate")  // ✅ Populate tasks for progress calculation
      .sort({ createdAt: -1 });

    res.json(projects);
  } catch (error) {
    console.error("Error fetching projects:", error);
    res.status(500).json({ message: "Server error", error: error.message });
  }
});

// @route   GET /api/projects/stats
// @desc    Get project statistics
// @access  Private (Admin/SuperAdmin)
router.get("/stats", protect, authorize("admin", "superadmin"), async (req, res) => {
  try {
    const today = new Date();

    // Overall stats
    const totalProjects = await Project.countDocuments();
    const newProjects = await Project.countDocuments({ status: "new" });
    const ongoingProjects = await Project.countDocuments({ status: "ongoing" });
    const completedProjects = await Project.countDocuments({ status: "completed" });
    const expiredProjects = await Project.countDocuments({ status: "expired" });

    // Projects needing renewal (projects past end date that are not completed)
    const needsRenewal = await Project.countDocuments({
      status: { $ne: "completed" },
      endDate: { $lt: today },
    });

    // Stats by type
    const types = ["Website", "SEO", "Google Marketing", "SMO", "Hosting", "Invoice App"];
    const statsByType = {};

    for (const type of types) {
      const typeTotal = await Project.countDocuments({ type });
      const typeNew = await Project.countDocuments({ type, status: "new" });
      const typeOngoing = await Project.countDocuments({ type, status: "ongoing" });
      const typeCompleted = await Project.countDocuments({ type, status: "completed" });
      const typeExpired = await Project.countDocuments({ type, status: "expired" });
      const typeNeedsRenewal = await Project.countDocuments({
        type,
        status: { $ne: "completed" },
        endDate: { $lt: today },
      });

      statsByType[type] = {
        total: typeTotal,
        new: typeNew,
        ongoing: typeOngoing,
        completed: typeCompleted,
        expired: typeExpired,
        needsRenewal: typeNeedsRenewal,
      };
    }

    // Projects ending soon (within 30 days)
    const thirtyDaysFromNow = new Date();
    thirtyDaysFromNow.setDate(today.getDate() + 30);
    const endingSoon = await Project.countDocuments({
      status: { $in: ["new", "ongoing"] },
      endDate: { $gte: today, $lte: thirtyDaysFromNow },
    });

    res.json({
      overall: {
        total: totalProjects,
        new: newProjects,
        ongoing: ongoingProjects,
        completed: completedProjects,
        expired: expiredProjects,
        needsRenewal,
        endingSoon,
      },
      byType: statsByType,
    });
  } catch (error) {
    console.error("Error fetching project stats:", error);
    res.status(500).json({ message: "Server error", error: error.message });
  }
});

// @route   GET /api/projects/:id
// @desc    Get single project by ID
// @access  Private
router.get("/:id", protect, async (req, res) => {
  try {
    const project = await Project.findById(req.params.id)
      .populate("assignedTo", "name email role employeeId designation")
      .populate("client", "clientName businessName email")
      .populate("createdBy", "name email")
      .populate("notes.createdBy", "name email")
      .populate("attachments.uploadedBy", "name email")
      .populate("tasks", "title description status priority dueDate assignedTo");

    if (!project) {
      return res.status(404).json({ message: "Project not found" });
    }

    // Check if employee can access this project
    if (req.user.role === "employee") {
      const isAssigned = project.assignedTo.some(
        (emp) => emp._id.toString() === req.user._id.toString()
      );
      if (!isAssigned) {
        return res.status(403).json({ message: "Access denied" });
      }
    }

    res.json(project);
  } catch (error) {
    console.error("Error fetching project:", error);
    res.status(500).json({ message: "Server error", error: error.message });
  }
});

// @route   POST /api/projects
// @desc    Create new project
// @access  Private (Admin/SuperAdmin)
router.post("/", protect, authorize("admin", "superadmin"), async (req, res) => {
  try {
    const {
      projectName,
      type,
      assignedTo,
      client,
      startDate,
      endDate,
      description,
      remarks,
      budget,
      priority,
      status,
    } = req.body;

    // Validation
    if (!projectName || !type || !assignedTo || !client || !startDate || !endDate) {
      return res.status(400).json({ message: "Please provide all required fields" });
    }

    // Validate that type is an array and not empty
    if (!Array.isArray(type) || type.length === 0) {
      return res.status(400).json({ message: "Please select at least one service type" });
    }

    // Validate dates
    if (new Date(endDate) < new Date(startDate)) {
      return res.status(400).json({ message: "End date must be after start date" });
    }

    const project = await Project.create({
      projectName,
      type,
      assignedTo,
      client,
      startDate,
      endDate,
      description,
      remarks,
      budget,
      priority: priority || "Medium",
      status: status || "new",
      createdBy: req.user._id,
    });

    const populatedProject = await Project.findById(project._id)
      .populate("assignedTo", "name email employeeId designation")
      .populate("client", "clientName businessName email")
      .populate("createdBy", "name email");

    res.status(201).json(populatedProject);
  } catch (error) {
    console.error("Error creating project:", error);
    res.status(500).json({ message: "Server error", error: error.message });
  }
});

// @route   PUT /api/projects/:id
// @desc    Update project
// @access  Private (Admin/SuperAdmin)
router.put("/:id", protect, authorize("admin", "superadmin"), async (req, res) => {
  try {
    const {
      projectName,
      type,
      assignedTo,
      client,
      startDate,
      endDate,
      description,
      remarks,
      budget,
      priority,
      status,
    } = req.body;

    const project = await Project.findById(req.params.id);

    if (!project) {
      return res.status(404).json({ message: "Project not found" });
    }

    // Validate dates if both are provided
    if (endDate && startDate) {
      if (new Date(endDate) < new Date(startDate)) {
        return res.status(400).json({ message: "End date must be after start date" });
      }
    }

    // Validate type if provided
    if (type !== undefined) {
      if (!Array.isArray(type) || type.length === 0) {
        return res.status(400).json({ message: "Please select at least one service type" });
      }
    }

    // Update fields
    if (projectName) project.projectName = projectName;
    if (type) project.type = type;
    if (assignedTo) project.assignedTo = assignedTo;
    if (client) project.client = client;
    if (startDate) project.startDate = startDate;
    if (endDate) project.endDate = endDate;
    if (description !== undefined) project.description = description;
    if (remarks !== undefined) project.remarks = remarks;
    if (budget !== undefined) project.budget = budget;
    if (priority) project.priority = priority;
    if (status) {
      project.status = status;
      if (status === "completed" && !project.completedDate) {
        project.completedDate = new Date();
      }
    }

    await project.save();

    const updatedProject = await Project.findById(project._id)
      .populate("assignedTo", "name email employeeId designation")
      .populate("client", "clientName businessName email")
      .populate("createdBy", "name email");

    res.json(updatedProject);
  } catch (error) {
    console.error("Error updating project:", error);
    res.status(500).json({ message: "Server error", error: error.message });
  }
});

// @route   PATCH /api/projects/:id/status
// @desc    Update project status
// @access  Private (Admin/SuperAdmin)
router.patch("/:id/status", protect, authorize("admin", "superadmin"), async (req, res) => {
  try {
    const { status } = req.body;
    const project = await Project.findById(req.params.id);

    if (!project) {
      return res.status(404).json({ message: "Project not found" });
    }

    // Validate status
    const validStatuses = ["new", "ongoing", "completed", "expired"];
    if (status && !validStatuses.includes(status)) {
      return res.status(400).json({ message: "Invalid status value" });
    }

    // Update status
    if (status) {
      project.status = status;
      if (status === "completed" && !project.completedDate) {
        project.completedDate = new Date();
      }
    }

    await project.save();

    const updatedProject = await Project.findById(project._id)
      .populate("assignedTo", "name email employeeId designation")
      .populate("client", "clientName businessName email");

    res.json(updatedProject);
  } catch (error) {
    console.error("Error updating status:", error);
    res.status(500).json({ message: "Server error", error: error.message });
  }
});

// @route   DELETE /api/projects/:id
// @desc    Delete project
// @access  Private (Admin/SuperAdmin)
router.delete("/:id", protect, authorize("admin", "superadmin"), async (req, res) => {
  try {
    const project = await Project.findById(req.params.id);

    if (!project) {
      return res.status(404).json({ message: "Project not found" });
    }

    await project.deleteOne();

    res.json({ message: "Project deleted successfully" });
  } catch (error) {
    console.error("Error deleting project:", error);
    res.status(500).json({ message: "Server error", error: error.message });
  }
});

// @route   POST /api/projects/:id/notes
// @desc    Add note to project
// @access  Private
router.post("/:id/notes", protect, async (req, res) => {
  try {
    const { content } = req.body;

    if (!content) {
      return res.status(400).json({ message: "Note content is required" });
    }

    const project = await Project.findById(req.params.id);

    if (!project) {
      return res.status(404).json({ message: "Project not found" });
    }

    // Check access for employees
    if (req.user.role === "employee") {
      const isAssigned = project.assignedTo.some(
        (emp) => emp.toString() === req.user._id.toString()
      );
      if (!isAssigned) {
        return res.status(403).json({ message: "Access denied" });
      }
    }

    project.notes.push({
      content,
      createdBy: req.user._id,
    });

    await project.save();

    const updatedProject = await Project.findById(project._id)
      .populate("notes.createdBy", "name email");

    res.json(updatedProject);
  } catch (error) {
    console.error("Error adding note:", error);
    res.status(500).json({ message: "Server error", error: error.message });
  }
});

// @route   POST /api/projects/:id/milestones
// @desc    Add milestone to project
// @access  Private (Admin/SuperAdmin)
router.post("/:id/milestones", protect, authorize("admin", "superadmin"), async (req, res) => {
  try {
    const { title, description, dueDate } = req.body;

    if (!title || !dueDate) {
      return res.status(400).json({ message: "Title and due date are required" });
    }

    const project = await Project.findById(req.params.id);

    if (!project) {
      return res.status(404).json({ message: "Project not found" });
    }

    project.milestones.push({
      title,
      description,
      dueDate,
    });

    await project.save();

    res.json(project);
  } catch (error) {
    console.error("Error adding milestone:", error);
    res.status(500).json({ message: "Server error", error: error.message });
  }
});

// @route   PATCH /api/projects/:id/milestones/:milestoneId
// @desc    Update milestone status
// @access  Private
router.patch("/:id/milestones/:milestoneId", protect, async (req, res) => {
  try {
    const { completed } = req.body;

    const project = await Project.findById(req.params.id);

    if (!project) {
      return res.status(404).json({ message: "Project not found" });
    }

    const milestone = project.milestones.id(req.params.milestoneId);

    if (!milestone) {
      return res.status(404).json({ message: "Milestone not found" });
    }

    milestone.completed = completed;
    if (completed) {
      milestone.completedDate = new Date();
    } else {
      milestone.completedDate = undefined;
    }

    await project.save();

    res.json(project);
  } catch (error) {
    console.error("Error updating milestone:", error);
    res.status(500).json({ message: "Server error", error: error.message });
  }
});

// @route   GET /api/projects/employee/:employeeId
// @desc    Get projects assigned to specific employee
// @access  Private
router.get("/employee/:employeeId", protect, async (req, res) => {
  try {
    const projects = await Project.find({ assignedTo: req.params.employeeId })
      .populate("assignedTo", "name email employeeId designation")
      .populate("client", "clientName businessName email")
      .populate("tasks", "title status priority dueDate")
      .sort({ createdAt: -1 });

    res.json(projects);
  } catch (error) {
    console.error("Error fetching employee projects:", error);
    res.status(500).json({ message: "Server error", error: error.message });
  }
});

// @route   GET /api/projects/client/:clientId
// @desc    Get projects for specific client
// @access  Private
router.get("/client/:clientId", protect, async (req, res) => {
  try {
    const projects = await Project.find({ client: req.params.clientId })
      .populate("assignedTo", "name email employeeId designation")
      .populate("client", "clientName businessName email")
      .populate("tasks", "title status priority dueDate")
      .sort({ createdAt: -1 });

    res.json(projects);
  } catch (error) {
    console.error("Error fetching client projects:", error);
    res.status(500).json({ message: "Server error", error: error.message });
  }
});

// @route   GET /api/projects/:id/messages
// @desc    Get all messages for a project with search and filter support
// @access  Private
router.get("/:id/messages", protect, async (req, res) => {
  try {
    const Message = require("../models/Message");
    const project = await Project.findById(req.params.id);

    if (!project) {
      return res.status(404).json({ message: "Project not found" });
    }

    // Check access - employees must be assigned, clients must own the project
    if (req.user.role === "employee") {
      const isAssigned = project.assignedTo.some(
        (emp) => emp.toString() === req.user._id.toString()
      );
      if (!isAssigned) {
        return res.status(403).json({ message: "Access denied" });
      }
    }

    // Extract query parameters for search
    const { search, startDate, endDate, senderName } = req.query;

    // Build filter
    const filter = { project: req.params.id };

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
      .populate("sentBy", "name email clientName")
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
    res.status(500).json({ message: "Server error", error: error.message });
  }
});

// @route   POST /api/projects/:id/messages
// @desc    Send a message to a project with optional file attachments
// @access  Private
router.post("/:id/messages", protect, uploadToS3.array("files", 5), async (req, res) => {
  try {
    const Message = require("../models/Message");
    const { message, sentBy, senderType, replyTo } = req.body;

    if (!message || !message.trim()) {
      return res.status(400).json({ message: "Message content is required" });
    }

    const project = await Project.findById(req.params.id);

    if (!project) {
      return res.status(404).json({ message: "Project not found" });
    }

    // Check access - employees must be assigned
    if (req.user.role === "employee") {
      const isAssigned = project.assignedTo.some(
        (emp) => emp.toString() === req.user._id.toString()
      );
      if (!isAssigned) {
        return res.status(403).json({ message: "Access denied" });
      }
    }

    // Determine sender model based on user type
    const senderModel = req.user.role === "client" ? "Client" : "User";

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

    const newMessage = await Message.create({
      project: req.params.id,
      message: message.trim(),
      sentBy: sentBy || req.user._id,
      senderModel: senderModel,
      senderType: senderType || req.user.role,
      replyTo: replyTo || null,
      attachments: attachments,
    });

    const populatedMessage = await Message.findById(newMessage._id)
      .populate("sentBy", "name email clientName")
      .populate({
        path: "replyTo",
        select: "message sentBy createdAt",
        populate: {
          path: "sentBy",
          select: "name email clientName",
        },
      });

    // Send email notification (non-blocking)
    emailNotificationService.sendProjectMessageEmail(populatedMessage).catch(err => {
      console.error('Failed to send project message email:', err);
    });

    res.status(201).json(populatedMessage);
  } catch (error) {
    console.error("Error sending message:", error);
    res.status(500).json({ message: "Server error", error: error.message });
  }
});

// @route   POST /api/projects/:id/messages/:messageId/react
// @desc    Add or remove reaction to a message
// @access  Private
router.post("/:id/messages/:messageId/react", protect, async (req, res) => {
  try {
    const Message = require("../models/Message");
    const { emoji } = req.body;

    if (!emoji) {
      return res.status(400).json({ message: "Emoji is required" });
    }

    const message = await Message.findById(req.params.messageId);

    if (!message) {
      return res.status(404).json({ message: "Message not found" });
    }

    // Verify message belongs to the project
    if (message.project.toString() !== req.params.id) {
      return res.status(403).json({ message: "Message does not belong to this project" });
    }

    const userId = req.user._id.toString();
    const userModel = req.user.role === "client" ? "Client" : "User";

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
    const populatedMessage = await Message.findById(message._id)
      .populate("sentBy", "name email clientName")
      .populate({
        path: "reactions.users.user",
        select: "name email clientName",
      });

    res.json(populatedMessage);
  } catch (error) {
    console.error("Error adding reaction:", error);
    res.status(500).json({ message: "Server error", error: error.message });
  }
});

// @route   PATCH /api/projects/:id/messages/:messageId/attachments/:attachmentId/toggle-important
// @desc    Toggle attachment importance (mark as favorite to prevent auto-deletion)
// @access  Private
router.patch("/:id/messages/:messageId/attachments/:attachmentId/toggle-important", protect, async (req, res) => {
  try {
    const Message = require("../models/Message");
    const { messageId, attachmentId } = req.params;

    const message = await Message.findById(messageId);
    if (!message) {
      return res.status(404).json({ message: "Message not found" });
    }

    // Verify message belongs to the project
    if (message.project.toString() !== req.params.id) {
      return res.status(403).json({ message: "Message does not belong to this project" });
    }

    // Find the attachment
    const attachment = message.attachments.id(attachmentId);
    if (!attachment) {
      return res.status(404).json({ message: "Attachment not found" });
    }

    // Toggle the importance flag
    attachment.isImportant = !attachment.isImportant;
    await message.save();

    // Populate and return updated message
    const populatedMessage = await Message.findById(message._id)
      .populate("sentBy", "name email clientName");

    res.json({
      message: "Attachment importance toggled",
      isImportant: attachment.isImportant,
      attachment: attachment,
    });
  } catch (error) {
    console.error("Error toggling attachment importance:", error);
    res.status(500).json({ message: "Server error", error: error.message });
  }
});

// @route   POST /api/projects/:id/messages/summarize
// @desc    Summarize project messages using AI
// @access  Private
router.post("/:id/messages/summarize", protect, async (req, res) => {
  try {
    const { days = 7 } = req.body; // Default to last 7 days

    const project = await Project.findById(req.params.id).select('name assignedTo client');
    if (!project) {
      return res.status(404).json({ message: "Project not found" });
    }

    const projectName = project.name || "Untitled Project";

    // Authorization check - match the same logic as POST /messages
    if (req.user.role === "employee") {
      const isAssigned = project.assignedTo?.some(
        (emp) => emp.toString() === req.user._id.toString()
      );
      if (!isAssigned) {
        return res.status(403).json({ message: "Access denied" });
      }
    }
    // Super-admin and clients have access, admins have access

    // Calculate date range
    const startDate = new Date();
    startDate.setDate(startDate.getDate() - days);

    const Message = require("../models/Message");

    // Fetch messages from the last N days
    const messages = await Message.find({
      project: req.params.id,
      createdAt: { $gte: startDate }
    })
    .sort({ createdAt: 1 })
    .populate("sentBy", "firstName lastName email")
    .lean();

    if (!messages || messages.length === 0) {
      return res.json({ summary: "No messages found in the selected time period." });
    }

    // Format messages for AI
    const formattedMessages = messages.map(msg => {
      let sender = "Unknown";
      if (msg.sentBy) {
        if (msg.sentBy.firstName && msg.sentBy.lastName) {
          sender = `${msg.sentBy.firstName} ${msg.sentBy.lastName}`;
        } else if (msg.sentBy.email) {
          sender = msg.sentBy.email;
        }
      }

      const timestamp = new Date(msg.createdAt).toLocaleDateString();
      const hasAttachments = msg.attachments && msg.attachments.length > 0 ? ` [${msg.attachments.length} attachment(s)]` : "";
      return `[${timestamp}] ${sender} (${msg.senderType}): ${msg.message}${hasAttachments}`;
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
            content: `You are a helpful assistant that summarizes project conversations. Provide a clear, concise summary highlighting:
- Key topics discussed
- Decisions made
- Action items and tasks
- Important context for continuing the project
- Client requests or concerns
- Employee updates or blockers
Keep it professional and organized. Use markdown formatting with headers and bullet points.`
          },
          {
            role: "user",
            content: `Please summarize the following project conversation from the last ${days} days for "${projectName}":\n\n${formattedMessages}`
          }
        ]
      })
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error("OpenRouter API error:", response.status, errorText);
      return res.status(500).json({
        message: "Failed to generate summary from AI service",
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
      projectName: projectName,
      dateRange: {
        from: startDate.toISOString(),
        to: new Date().toISOString()
      }
    });

  } catch (error) {
    console.error("Error summarizing project messages:", error);
    res.status(500).json({ message: "Server error", error: error.message });
  }
});

module.exports = router;