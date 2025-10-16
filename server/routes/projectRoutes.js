// routes/projectRoutes.js
const express = require("express");
const router = express.Router();
const Project = require("../models/Project");
const { protect, authorize } = require("../middlewares/authMiddleware");
const { uploadToS3, getFileType, convertToCloudFrontUrl, isS3Configured } = require("../config/s3Config");

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
      .populate("assignedTo", "name email")
      .populate("client", "clientName businessName email")
      .populate("createdBy", "name email")
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
    const activeProjects = await Project.countDocuments({ status: "Active" });
    const inactiveProjects = await Project.countDocuments({ status: "Inactive" });
    const completedProjects = await Project.countDocuments({ status: "Completed" });

    // Projects needing renewal (Active projects past end date)
    const needsRenewal = await Project.countDocuments({
      status: "Active",
      endDate: { $lt: today },
    });

    // Stats by type
    const types = ["Website", "SEO", "Google Marketing", "SMO", "Hosting", "Invoice App"];
    const statsByType = {};

    for (const type of types) {
      const typeTotal = await Project.countDocuments({ type });
      const typeActive = await Project.countDocuments({ type, status: "Active" });
      const typeInactive = await Project.countDocuments({ type, status: "Inactive" });
      const typeCompleted = await Project.countDocuments({ type, status: "Completed" });
      const typeNeedsRenewal = await Project.countDocuments({
        type,
        status: "Active",
        endDate: { $lt: today },
      });

      statsByType[type] = {
        total: typeTotal,
        active: typeActive,
        inactive: typeInactive,
        completed: typeCompleted,
        needsRenewal: typeNeedsRenewal,
      };
    }

    // Projects ending soon (within 30 days)
    const thirtyDaysFromNow = new Date();
    thirtyDaysFromNow.setDate(today.getDate() + 30);
    const endingSoon = await Project.countDocuments({
      status: "Active",
      endDate: { $gte: today, $lte: thirtyDaysFromNow },
    });

    res.json({
      overall: {
        total: totalProjects,
        active: activeProjects,
        inactive: inactiveProjects,
        completed: completedProjects,
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
      .populate("assignedTo", "name email role")
      .populate("client", "clientName businessName email")
      .populate("createdBy", "name email")
      .populate("notes.createdBy", "name email")
      .populate("attachments.uploadedBy", "name email");

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
      budget,
      priority,
    } = req.body;

    // Validation
    if (!projectName || !type || !assignedTo || !client || !startDate || !endDate) {
      return res.status(400).json({ message: "Please provide all required fields" });
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
      budget,
      priority: priority || "Medium",
      createdBy: req.user._id,
    });

    const populatedProject = await Project.findById(project._id)
      .populate("assignedTo", "name email")
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

    // Update fields
    if (projectName) project.projectName = projectName;
    if (type) project.type = type;
    if (assignedTo) project.assignedTo = assignedTo;
    if (client) project.client = client;
    if (startDate) project.startDate = startDate;
    if (endDate) project.endDate = endDate;
    if (description !== undefined) project.description = description;
    if (budget !== undefined) project.budget = budget;
    if (priority) project.priority = priority;
    if (status) {
      project.status = status;
      if (status === "Completed" && !project.completedDate) {
        project.completedDate = new Date();
      }
    }

    await project.save();

    const updatedProject = await Project.findById(project._id)
      .populate("assignedTo", "name email")
      .populate("client", "clientName businessName email")
      .populate("createdBy", "name email");

    res.json(updatedProject);
  } catch (error) {
    console.error("Error updating project:", error);
    res.status(500).json({ message: "Server error", error: error.message });
  }
});

// @route   PATCH /api/projects/:id/status
// @desc    Toggle project status
// @access  Private (Admin/SuperAdmin)
router.patch("/:id/status", protect, authorize("admin", "superadmin"), async (req, res) => {
  try {
    const project = await Project.findById(req.params.id);

    if (!project) {
      return res.status(404).json({ message: "Project not found" });
    }

    // Toggle status
    if (project.status === "Active") {
      project.status = "Inactive";
    } else if (project.status === "Inactive") {
      project.status = "Active";
    } else {
      project.status = "Active";
    }

    await project.save();

    const updatedProject = await Project.findById(project._id)
      .populate("assignedTo", "name email")
      .populate("client", "clientName businessName email");

    res.json(updatedProject);
  } catch (error) {
    console.error("Error toggling status:", error);
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
      .populate("assignedTo", "name email")
      .populate("client", "clientName businessName email")
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
      .populate("assignedTo", "name email")
      .populate("client", "clientName businessName email")
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

module.exports = router;