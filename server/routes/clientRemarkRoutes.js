const express = require("express");
const router = express.Router();
const { protect } = require("../middlewares/authMiddleware");
const ClientRemark = require("../models/ClientRemark");
const Project = require("../models/Project");

// @route   GET /api/projects/:projectId/client-remarks
// @desc    Get all client remarks for a project (optionally filtered by section)
// @access  Private (Client, Employee assigned to project, Admin, Super Admin)
router.get("/:projectId/client-remarks", protect, async (req, res) => {
  try {
    const { projectId } = req.params;
    const { section } = req.query;

    // Check if project exists
    const project = await Project.findById(projectId);
    if (!project) {
      return res.status(404).json({ message: "Project not found" });
    }

    // Check access
    const isClient = req.user.role === "client" && project.client.toString() === req.user._id.toString();
    const isAssignedEmployee = req.user.role === "employee" && project.assignedTo.some(
      (emp) => emp.toString() === req.user._id.toString()
    );
    const isAdmin = ["admin", "super-admin", "superadmin"].includes(req.user.role);

    if (!isClient && !isAssignedEmployee && !isAdmin) {
      return res.status(403).json({ message: "Access denied" });
    }

    // Build query
    const query = {
      project: projectId,
      isActive: true,
    };

    // Add section filter if provided
    if (section && ["keywords", "blogs", "backlinks", "screenshots"].includes(section)) {
      query.section = section;
    }

    // Fetch remarks
    const remarks = await ClientRemark.find(query)
      .populate("addedBy", "name email clientName")
      .sort({ createdAt: -1 });

    res.status(200).json({
      success: true,
      data: remarks,
    });
  } catch (error) {
    console.error("Error fetching client remarks:", error);
    res.status(500).json({ message: "Server error", error: error.message });
  }
});

// @route   POST /api/projects/:projectId/client-remarks
// @desc    Add a new client remark
// @access  Private (Client, Admin, Super Admin)
router.post("/:projectId/client-remarks", protect, async (req, res) => {
  try {
    const { projectId } = req.params;
    const { remark, section } = req.body;

    // Validation
    if (!remark || !remark.trim()) {
      return res.status(400).json({ message: "Remark text is required" });
    }

    if (!section || !["keywords", "blogs", "backlinks", "screenshots"].includes(section)) {
      return res.status(400).json({ message: "Valid section is required (keywords, blogs, backlinks, screenshots)" });
    }

    // Check if project exists
    const project = await Project.findById(projectId);
    if (!project) {
      return res.status(404).json({ message: "Project not found" });
    }

    // Check access - only client can add remarks
    const isClient = req.user.role === "client" && project.client.toString() === req.user._id.toString();

    if (!isClient) {
      return res.status(403).json({
        message: "Only the client can add remarks"
      });
    }

    // Create new remark
    const newRemark = await ClientRemark.create({
      project: projectId,
      section: section,
      remark: remark.trim(),
      addedBy: req.user._id,
      addedByModel: "Client", // Clients are stored in Client model
      addedByRole: req.user.role,
    });

    // Populate the addedBy field with both name and clientName
    await newRemark.populate("addedBy", "name email clientName");

    res.status(201).json({
      success: true,
      message: "Remark added successfully",
      data: newRemark,
    });
  } catch (error) {
    console.error("Error adding client remark:", error);
    res.status(500).json({ message: "Server error", error: error.message });
  }
});

// @route   DELETE /api/projects/:projectId/client-remarks/:remarkId
// @desc    Delete a client remark (soft delete)
// @access  Private (Admin, Super Admin, or the user who created it)
router.delete("/:projectId/client-remarks/:remarkId", protect, async (req, res) => {
  try {
    const { projectId, remarkId } = req.params;

    const remark = await ClientRemark.findById(remarkId);
    if (!remark) {
      return res.status(404).json({ message: "Remark not found" });
    }

    // Check access - clients can delete their own remarks, admins can delete any (for moderation)
    const isOwner = remark.addedBy.toString() === req.user._id.toString();
    const isClient = req.user.role === "client";
    const isAdmin = ["admin", "super-admin", "superadmin"].includes(req.user.role);

    if (!((isOwner && isClient) || isAdmin)) {
      return res.status(403).json({ message: "Access denied" });
    }

    // Soft delete
    remark.isActive = false;
    await remark.save();

    res.status(200).json({
      success: true,
      message: "Remark deleted successfully",
    });
  } catch (error) {
    console.error("Error deleting client remark:", error);
    res.status(500).json({ message: "Server error", error: error.message });
  }
});

// @route   GET /api/projects/:projectId/client-remarks/stats
// @desc    Get stats for client remarks
// @access  Private
router.get("/:projectId/client-remarks/stats", protect, async (req, res) => {
  try {
    const { projectId } = req.params;

    const totalRemarks = await ClientRemark.countDocuments({
      project: projectId,
      isActive: true,
    });

    const clientRemarks = await ClientRemark.countDocuments({
      project: projectId,
      isActive: true,
      addedByRole: "client",
    });

    const adminRemarks = await ClientRemark.countDocuments({
      project: projectId,
      isActive: true,
      addedByRole: { $in: ["admin", "super-admin", "superadmin"] },
    });

    res.status(200).json({
      success: true,
      data: {
        total: totalRemarks,
        byClient: clientRemarks,
        byAdmin: adminRemarks,
      },
    });
  } catch (error) {
    console.error("Error fetching remarks stats:", error);
    res.status(500).json({ message: "Server error", error: error.message });
  }
});

module.exports = router;
