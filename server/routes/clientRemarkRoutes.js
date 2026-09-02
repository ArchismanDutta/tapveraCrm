const express = require("express");
const router = express.Router();
const mongoose = require("mongoose");
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

    // Validate ObjectId
    if (!mongoose.Types.ObjectId.isValid(projectId)) {
      return res.status(400).json({ message: "Invalid project ID" });
    }

    // Check if project exists
    const project = await Project.findById(projectId);
    if (!project) {
      return res.status(404).json({ message: "Project not found" });
    }

    // Check access
    const isClient = req.user.role === "client" && project.clients.some(
      (client) => client.toString() === req.user._id.toString()
    );
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
    const isClient = req.user.role === "client" && project.clients.some(
      (client) => client.toString() === req.user._id.toString()
    );

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

    // Real-time: push the new remark to anyone viewing this project/section
    // right now, and to all admins for the live counter badge on the
    // projects list. Best-effort — a broadcast failure must never fail the
    // request that already succeeded in saving the remark.
    try {
      const { broadcastProjectRemark } = require("../utils/websocket");
      broadcastProjectRemark(projectId, { remark: newRemark, section });
    } catch (wsError) {
      console.warn("WebSocket broadcast failed (client remark added):", wsError.message);
    }

    // Tell the team assigned to this project.
    //
    // These remarks are client feedback — only a client can post one (see the
    // access check above) — so this is a customer waiting on a response, and
    // the broadcast alone reaches only whoever happens to have that project's
    // section open. No author exclusion is needed: the author is the client,
    // and `assignedTo` holds staff.
    const teamIds = (project.assignedTo || []).map(String);
    if (teamIds.length) {
      const notificationService = require("../services/notificationService");
      const authorName =
        newRemark.addedBy?.clientName || newRemark.addedBy?.name || "The client";

      notificationService
        .notifyUsers(teamIds, {
          type: "system",
          channel: "project",
          title: `${authorName} commented on ${project.projectName}`,
          body: `${section}: ${newRemark.remark.slice(0, 200)}`,
          priority: "normal",
          // The project detail route is singular: /project/:projectId
          relatedData: { projectId, url: `/project/${projectId}` },
        })
        .catch((err) => console.error("Project-remark notification failed:", err));
    }

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

    // Real-time: let anyone viewing this project/section (and the projects
    // list's live counter) know this remark is gone, without waiting on a
    // refetch. Best-effort, same reasoning as the POST handler above.
    try {
      const { broadcastProjectRemarkDeleted } = require("../utils/websocket");
      broadcastProjectRemarkDeleted(projectId, {
        remarkId: remark._id,
        section: remark.section,
      });
    } catch (wsError) {
      console.warn("WebSocket broadcast failed (client remark deleted):", wsError.message);
    }

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

// @route   GET /api/projects/remarks/counts
// @desc    Bulk live remark counts for the projects list (ProjectCard badge).
//          Scoped to whatever project IDs the caller passes in — those IDs
//          already came from the caller's own role-filtered GET /api/projects
//          response, so there's no separate access check to duplicate here.
// @access  Private
router.get("/remarks/counts", protect, async (req, res) => {
  try {
    const { projectIds } = req.query;
    if (!projectIds) {
      return res.status(200).json({ success: true, data: {} });
    }

    const ids = String(projectIds)
      .split(",")
      .map((id) => id.trim())
      .filter((id) => mongoose.Types.ObjectId.isValid(id))
      .map((id) => new mongoose.Types.ObjectId(id));

    if (ids.length === 0) {
      return res.status(200).json({ success: true, data: {} });
    }

    const counts = await ClientRemark.aggregate([
      { $match: { project: { $in: ids }, isActive: true } },
      { $group: { _id: "$project", count: { $sum: 1 } } },
    ]);

    const data = {};
    counts.forEach((row) => {
      data[row._id.toString()] = row.count;
    });

    res.status(200).json({ success: true, data });
  } catch (error) {
    console.error("Error fetching bulk remark counts:", error);
    res.status(500).json({ message: "Server error", error: error.message });
  }
});

module.exports = router;
