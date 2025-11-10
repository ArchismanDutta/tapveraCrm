// routes/projectRoutes.js
const express = require("express");
const router = express.Router();
const fetch = require("node-fetch"); // Polyfill for Node.js < 18
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
    if (client) filter.clients = client; // Filter projects that include this client
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

    // Region-based filtering (for admin and hr)
    const user = req.user;
    let accessibleClientIds = null;

    console.log(`\n========== PROJECT FILTERING START ==========`);
    console.log(`[Project Filtering] User: ${user.email}, Role: ${user.role}`);
    console.log(`[Project Filtering] user.regions:`, user.regions);
    console.log(`[Project Filtering] user.region:`, user.region);

    // Check if user has region restrictions
    const hasGlobalAccess = user.role === 'super-admin' || user.role === 'superadmin' ||
                           (user.regions && user.regions.includes('Global')) ||
                           (user.region === 'Global');

    console.log(`[Project Filtering] Is super-admin: ${user.role === 'super-admin' || user.role === 'superadmin'}`);
    console.log(`[Project Filtering] Has Global in regions array: ${user.regions && user.regions.includes('Global')}`);
    console.log(`[Project Filtering] Has Global in region field: ${user.region === 'Global'}`);
    console.log(`[Project Filtering] Final hasGlobalAccess: ${hasGlobalAccess}`);

    if (!hasGlobalAccess) {
      // Get clients in user's regions (strict filtering - NO Global fallback)
      const Client = require("../models/Client");
      let regionQuery;

      if (user.regions && user.regions.length > 0) {
        // New multi-region field - strict filtering
        regionQuery = { region: { $in: user.regions } };
        console.log('[Project Filtering] Strict filtering by regions:', user.regions);
      } else if (user.region) {
        // Fallback for old single region field (backwards compatibility)
        regionQuery = { region: user.region };
        console.log('[Project Filtering] Strict filtering by single region:', user.region);
      }

      if (regionQuery) {
        console.log('[Project Filtering] Region query:', JSON.stringify(regionQuery));
        const accessibleClients = await Client.find(regionQuery).select('_id');
        accessibleClientIds = accessibleClients.map(c => c._id);

        console.log(`[Project Filtering] Found ${accessibleClientIds.length} accessible clients:`, accessibleClientIds);

        // IMPORTANT: Only skip region filtering for employees
        // Admins/HR with region restrictions MUST have region filtering applied even if assignedTo is set
        if (user.role === 'employee') {
          // Employees already filtered by assignedTo on line 52, no need for region filtering
          console.log('[Project Filtering] Employee role - skipping region filter (already filtered by assignedTo)');
        } else {
          // Strict filtering: ONLY show projects from clients in user's regions
          // This applies to admins/HR even if they use assignedTo filter
          filter.$and = filter.$and || [];
          const projectFilter = {
            clients: { $in: accessibleClientIds }  // ONLY clients in assigned regions
          };
          filter.$and.push(projectFilter);
          console.log('[Project Filtering] Applied STRICT project filter (no assignment override):', JSON.stringify(projectFilter));
        }
      }
    }

    console.log('[Project Filtering] Final filter:', JSON.stringify(filter));

    const projects = await Project.find(filter)
      .populate("assignedTo", "name email employeeId designation status")
      .populate("client", "clientName businessName email region")  // ✅ Populate old field (backwards compatibility)
      .populate("clients", "clientName businessName email region")
      .populate("createdBy", "name email")
      .populate("tasks", "title status priority dueDate")  // ✅ Populate tasks for progress calculation
      .sort({ createdAt: -1 });

    console.log(`[Project Filtering] Found ${projects.length} projects matching filter`);

    // Log details of each project to understand why they're showing
    console.log(`\n--- PROJECTS RETURNED ---`);
    projects.forEach((project, index) => {
      const clientNames = project.clients?.map(c => c.clientName || c.businessName).join(', ') || 'NO CLIENTS';
      const clientRegions = project.clients?.map(c => c.region).join(', ') || 'NO REGIONS';
      const isAssignedToUser = project.assignedTo?.some(emp => emp._id.toString() === user._id.toString());
      console.log(`${index + 1}. "${project.projectName}"`);
      console.log(`   Clients: "${clientNames}" | Regions: "${clientRegions}" | Assigned to user: ${isAssignedToUser}`);
    });
    console.log(`========== PROJECT FILTERING END ==========\n`);

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
      .populate("assignedTo", "name email role employeeId designation status")
      .populate("client", "clientName businessName email")  // ✅ Populate old field (backwards compatibility)
      .populate("clients", "clientName businessName email")
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
      clients,
      startDate,
      endDate,
      description,
      remarks,
      budget,
      priority,
      status,
    } = req.body;

    // Validation
    if (!projectName || !type || !assignedTo || !clients || !startDate || !endDate) {
      return res.status(400).json({ message: "Please provide all required fields" });
    }

    // Validate that clients is an array and not empty
    if (!Array.isArray(clients) || clients.length === 0) {
      return res.status(400).json({ message: "Please select at least one client" });
    }

    // Validate that type is an array and not empty
    if (!Array.isArray(type) || type.length === 0) {
      return res.status(400).json({ message: "Please select at least one service type" });
    }

    // Validate dates
    if (new Date(endDate) < new Date(startDate)) {
      return res.status(400).json({ message: "End date must be after start date" });
    }

    // Validate that all assigned employees are active
    if (assignedTo && assignedTo.length > 0) {
      const User = require("../models/User");
      const employees = await User.find({
        _id: { $in: assignedTo },
        status: { $ne: "active" }
      }).select("name status");

      if (employees.length > 0) {
        const inactiveNames = employees.map(emp => `${emp.name} (${emp.status})`).join(", ");
        return res.status(400).json({
          message: `Cannot assign project to inactive employees: ${inactiveNames}. Please select only active employees.`,
          inactiveEmployees: employees
        });
      }
    }

    const project = await Project.create({
      projectName,
      type,
      assignedTo,
      clients,
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
      .populate("assignedTo", "name email employeeId designation status")
      .populate("client", "clientName businessName email")  // ✅ Populate old field (backwards compatibility)
      .populate("clients", "clientName businessName email")
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
      clients,
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

    // Validate clients if provided
    if (clients !== undefined) {
      if (!Array.isArray(clients) || clients.length === 0) {
        return res.status(400).json({ message: "Please select at least one client" });
      }
    }

    // Validate that all assigned employees are active (if assignedTo is being updated)
    if (assignedTo && assignedTo.length > 0) {
      const User = require("../models/User");
      const employees = await User.find({
        _id: { $in: assignedTo },
        status: { $ne: "active" }
      }).select("name status");

      if (employees.length > 0) {
        const inactiveNames = employees.map(emp => `${emp.name} (${emp.status})`).join(", ");
        return res.status(400).json({
          message: `Cannot assign project to inactive employees: ${inactiveNames}. Please select only active employees.`,
          inactiveEmployees: employees
        });
      }
    }

    // Update fields
    if (projectName) project.projectName = projectName;
    if (type) project.type = type;
    if (assignedTo) project.assignedTo = assignedTo;
    if (clients) project.clients = clients;
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
      .populate("assignedTo", "name email employeeId designation status")
      .populate("client", "clientName businessName email")  // ✅ Populate old field (backwards compatibility)
      .populate("clients", "clientName businessName email")
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
      .populate("assignedTo", "name email employeeId designation status")
      .populate("client", "clientName businessName email")  // ✅ Populate old field (backwards compatibility)
      .populate("clients", "clientName businessName email");

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
      .populate("assignedTo", "name email employeeId designation status")
      .populate("client", "clientName businessName email")  // ✅ Populate old field (backwards compatibility)
      .populate("clients", "clientName businessName email")
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
    const projects = await Project.find({ clients: req.params.clientId })
      .populate("assignedTo", "name email employeeId designation status")
      .populate("client", "clientName businessName email")  // ✅ Populate old field (backwards compatibility)
      .populate("clients", "clientName businessName email")
      .populate("tasks", "title status priority dueDate")
      .sort({ createdAt: -1 });

    res.json(projects);
  } catch (error) {
    console.error("Error fetching client projects:", error);
    res.status(500).json({ message: "Server error", error: error.message });
  }
});

// @route   GET /api/projects/:id/messages/unread-count
// @desc    Get unread message count for a project
// @access  Private
router.get("/:id/messages/unread-count", protect, async (req, res) => {
  try {
    const Message = require("../models/Message");
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

    const userId = req.user._id.toString();
    const userModel = req.user.role === "client" ? "Client" : "User";

    // Count messages that the user hasn't read
    const unreadCount = await Message.countDocuments({
      project: req.params.id,
      // Exclude messages sent by the user themselves
      sentBy: { $ne: req.user._id },
      // Check if user is NOT in the readBy array
      $nor: [
        {
          readBy: {
            $elemMatch: {
              user: req.user._id,
              userModel: userModel
            }
          }
        }
      ]
    });

    res.json({ unreadCount });
  } catch (error) {
    console.error("Error fetching unread count:", error);
    res.status(500).json({ message: "Server error", error: error.message });
  }
});

// @route   PATCH /api/projects/:id/messages/mark-read
// @desc    Mark all messages in a project as read
// @access  Private
router.patch("/:id/messages/mark-read", protect, async (req, res) => {
  try {
    const Message = require("../models/Message");
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

    const userModel = req.user.role === "client" ? "Client" : "User";

    // Find all unread messages for this user in this project
    const unreadMessages = await Message.find({
      project: req.params.id,
      sentBy: { $ne: req.user._id },
      $nor: [
        {
          readBy: {
            $elemMatch: {
              user: req.user._id,
              userModel: userModel
            }
          }
        }
      ]
    });

    // Mark each message as read
    const updatePromises = unreadMessages.map(message => {
      message.readBy.push({
        user: req.user._id,
        userModel: userModel,
        readAt: new Date()
      });
      return message.save();
    });

    await Promise.all(updatePromises);

    res.json({
      message: "Messages marked as read",
      count: unreadMessages.length
    });
  } catch (error) {
    console.error("Error marking messages as read:", error);
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
      .populate({
        path: "mentions.user",
        select: "name email clientName",
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
// Helper to parse @mentions from message text
const parseMentionsFromMessage = async (messageText, projectId) => {
  if (!messageText) return [];

  const User = require("../models/User");
  const Client = require("../models/Client");

  // Match @mentions in the format @Name or @FirstName LastName
  const mentionPattern = /@(\w+(?:\s+\w+)*)/g;
  const matches = [...messageText.matchAll(mentionPattern)];

  if (matches.length === 0) return [];

  // Extract mentioned names
  const mentionedNames = matches.map(match => match[1].toLowerCase());

  // Find users and clients by name (case-insensitive)
  const users = await User.find({
    $or: mentionedNames.map(name => ({
      name: { $regex: new RegExp(`^${name}$`, 'i') }
    }))
  }, '_id');

  const clients = await Client.find({
    $or: mentionedNames.map(name => ({
      clientName: { $regex: new RegExp(`^${name}$`, 'i') }
    }))
  }, '_id');

  const mentions = [
    ...users.map(user => ({ user: user._id, userModel: 'User' })),
    ...clients.map(client => ({ user: client._id, userModel: 'Client' }))
  ];

  return mentions;
};

router.post("/:id/messages", protect, uploadToS3.array("files", 5), async (req, res) => {
  try {
    const Message = require("../models/Message");
    const { message, sentBy, senderType, replyTo, mentions } = req.body;

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

    // Parse mentions if sent as JSON string (from FormData)
    let mentionedUsers = [];
    if (mentions) {
      try {
        mentionedUsers = typeof mentions === 'string' ? JSON.parse(mentions) : mentions;
      } catch (e) {
        console.warn('Failed to parse mentions:', e);
      }
    }

    // If no mentions provided, parse from message text
    if (mentionedUsers.length === 0) {
      mentionedUsers = await parseMentionsFromMessage(message, req.params.id);
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
      mentions: mentionedUsers,
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
      })
      .populate({
        path: "mentions.user",
        select: "name email clientName",
      });

    // Send notifications to all project members
    const notificationService = require('../services/notificationService');
    const senderName = req.user.name || req.user.clientName || 'Someone';

    // Get all project members (assigned employees + clients)
    const recipientIds = new Set();

    // Add assigned employees
    if (project.assignedTo && project.assignedTo.length > 0) {
      project.assignedTo.forEach(userId => recipientIds.add(String(userId)));
    }

    // Add all clients
    if (project.clients && project.clients.length > 0) {
      project.clients.forEach(clientId => recipientIds.add(String(clientId)));
    }

    // Send notification to all members except the sender
    for (const recipientId of recipientIds) {
      if (String(recipientId) !== String(req.user._id)) {
        // Check if user was mentioned for priority
        const wasMentioned = mentionedUsers.some(m => String(m.user) === String(recipientId));
        const priority = wasMentioned ? 'high' : 'normal';
        const channel = wasMentioned ? 'mention' : 'message';

        try {
          await notificationService.createAndSend({
            userId: recipientId,
            type: 'chat',
            channel: channel,
            title: wasMentioned
              ? `${senderName} mentioned you in ${project.projectName}`
              : `New message in ${project.projectName}`,
            body: message.slice(0, 100) + (message.length > 100 ? '...' : ''),
            relatedData: {
              projectId: req.params.id,
              messageId: newMessage._id
            },
            priority: priority
          });
        } catch (notifError) {
          console.error('Failed to send project message notification:', notifError);
        }
      }
    }

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

    const project = await Project.findById(req.params.id).select('projectName assignedTo clients createdBy');
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