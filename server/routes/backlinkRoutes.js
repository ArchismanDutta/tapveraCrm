const express = require("express");
const router = express.Router();
const Backlink = require("../models/Backlink");
const Project = require("../models/Project");
const { protect, authorize } = require("../middlewares/authMiddleware");

// Helper function to detect social media platform from URL
const detectPlatform = (url) => {
  const urlLower = url.toLowerCase();

  if (urlLower.includes('facebook.com')) return 'Facebook';
  if (urlLower.includes('twitter.com') || urlLower.includes('x.com')) return 'Twitter';
  if (urlLower.includes('instagram.com')) return 'Instagram';
  if (urlLower.includes('linkedin.com')) return 'LinkedIn';
  if (urlLower.includes('youtube.com')) return 'YouTube';
  if (urlLower.includes('pinterest.com')) return 'Pinterest';
  if (urlLower.includes('tiktok.com')) return 'TikTok';
  if (urlLower.includes('reddit.com')) return 'Reddit';
  if (urlLower.includes('github.com')) return 'GitHub';
  if (urlLower.includes('medium.com')) return 'Medium';

  return null;
};

// @route   GET /api/projects/:projectId/backlinks
// @desc    Get all backlinks for a project
// @access  Private
router.get("/:projectId/backlinks", protect, async (req, res) => {
  try {
    const { projectId } = req.params;
    const { activeOnly = "true", category } = req.query;

    // Check if project exists
    const project = await Project.findById(projectId);
    if (!project) {
      return res.status(404).json({ message: "Project not found" });
    }

    // Check access
    if (req.user.role === "employee") {
      const isAssigned = project.assignedTo.some(
        (emp) => emp.toString() === req.user._id.toString()
      );
      if (!isAssigned) {
        return res.status(403).json({ message: "Access denied" });
      }
    }

    let filter = { project: projectId };
    if (activeOnly === "true") filter.isActive = true;
    if (category) filter.category = category;

    const backlinks = await Backlink.find(filter)
      .populate("addedBy", "name email employeeId")
      .sort({ createdAt: -1 });

    res.json({
      success: true,
      data: backlinks,
      count: backlinks.length,
    });
  } catch (error) {
    console.error("Error fetching backlinks:", error);
    res.status(500).json({ message: "Server error", error: error.message });
  }
});

// @route   POST /api/projects/:projectId/backlinks
// @desc    Add a new backlink
// @access  Private (Admin, SuperAdmin, or assigned employees)
router.post("/:projectId/backlinks", protect, async (req, res) => {
  try {
    const { projectId } = req.params;
    const { url, category, notes } = req.body;

    if (!url || !category) {
      return res.status(400).json({
        message: "URL and category are required",
      });
    }

    // Check if project exists
    const project = await Project.findById(projectId);
    if (!project) {
      return res.status(404).json({ message: "Project not found" });
    }

    // Check access
    if (req.user.role === "employee") {
      const isAssigned = project.assignedTo.some(
        (emp) => emp.toString() === req.user._id.toString()
      );
      if (!isAssigned) {
        return res.status(403).json({ message: "Access denied" });
      }
    }

    // Detect platform if it's social media
    let platform = null;
    if (category === "Social Media") {
      platform = detectPlatform(url);
    }

    // Create new backlink
    const backlink = await Backlink.create({
      project: projectId,
      url: url.trim(),
      category,
      platform,
      notes,
      addedBy: req.user._id,
    });

    const populatedBacklink = await Backlink.findById(backlink._id).populate(
      "addedBy",
      "name email employeeId"
    );

    res.status(201).json({
      success: true,
      message: "Backlink added successfully",
      data: populatedBacklink,
    });
  } catch (error) {
    console.error("Error adding backlink:", error);
    res.status(500).json({ message: "Server error", error: error.message });
  }
});

// @route   PUT /api/projects/:projectId/backlinks/:backlinkId
// @desc    Update a backlink
// @access  Private (Admin, SuperAdmin, or assigned employees)
router.put("/:projectId/backlinks/:backlinkId", protect, async (req, res) => {
  try {
    const { projectId, backlinkId } = req.params;
    const { url, category, notes } = req.body;

    // Check if project exists
    const project = await Project.findById(projectId);
    if (!project) {
      return res.status(404).json({ message: "Project not found" });
    }

    // Check access
    if (req.user.role === "employee") {
      const isAssigned = project.assignedTo.some(
        (emp) => emp.toString() === req.user._id.toString()
      );
      if (!isAssigned) {
        return res.status(403).json({ message: "Access denied" });
      }
    }

    // Find and update backlink
    const backlink = await Backlink.findById(backlinkId);
    if (!backlink) {
      return res.status(404).json({ message: "Backlink not found" });
    }

    if (backlink.project.toString() !== projectId) {
      return res.status(400).json({
        message: "Backlink does not belong to this project",
      });
    }

    // Update fields
    if (url !== undefined) {
      backlink.url = url.trim();
      // Re-detect platform if category is social media
      if (backlink.category === "Social Media" || category === "Social Media") {
        backlink.platform = detectPlatform(url);
      }
    }
    if (category !== undefined) {
      backlink.category = category;
      if (category === "Social Media") {
        backlink.platform = detectPlatform(backlink.url);
      } else {
        backlink.platform = null;
      }
    }
    if (notes !== undefined) backlink.notes = notes;

    await backlink.save();

    const updatedBacklink = await Backlink.findById(backlinkId).populate(
      "addedBy",
      "name email employeeId"
    );

    res.json({
      success: true,
      message: "Backlink updated successfully",
      data: updatedBacklink,
    });
  } catch (error) {
    console.error("Error updating backlink:", error);
    res.status(500).json({ message: "Server error", error: error.message });
  }
});

// @route   DELETE /api/projects/:projectId/backlinks/:backlinkId
// @desc    Delete/deactivate a backlink
// @access  Private (Admin, SuperAdmin)
router.delete(
  "/:projectId/backlinks/:backlinkId",
  protect,
  authorize("admin", "super-admin"),
  async (req, res) => {
    try {
      const { projectId, backlinkId } = req.params;
      const { permanent = false } = req.query;

      const backlink = await Backlink.findById(backlinkId);
      if (!backlink) {
        return res.status(404).json({ message: "Backlink not found" });
      }

      if (backlink.project.toString() !== projectId) {
        return res.status(400).json({
          message: "Backlink does not belong to this project",
        });
      }

      if (permanent === "true") {
        await backlink.deleteOne();
        res.json({
          success: true,
          message: "Backlink permanently deleted",
        });
      } else {
        backlink.isActive = false;
        await backlink.save();
        res.json({
          success: true,
          message: "Backlink deactivated",
          data: backlink,
        });
      }
    } catch (error) {
      console.error("Error deleting backlink:", error);
      res.status(500).json({ message: "Server error", error: error.message });
    }
  }
);

// @route   GET /api/projects/:projectId/backlinks/stats
// @desc    Get backlink statistics for a project
// @access  Private
router.get("/:projectId/backlinks/stats", protect, async (req, res) => {
  try {
    const { projectId } = req.params;

    // Check if project exists
    const project = await Project.findById(projectId);
    if (!project) {
      return res.status(404).json({ message: "Project not found" });
    }

    // Check access
    if (req.user.role === "employee") {
      const isAssigned = project.assignedTo.some(
        (emp) => emp.toString() === req.user._id.toString()
      );
      if (!isAssigned) {
        return res.status(403).json({ message: "Access denied" });
      }
    }

    const backlinks = await Backlink.find({
      project: projectId,
      isActive: true,
    });

    const stats = {
      totalBacklinks: backlinks.length,
      socialMedia: backlinks.filter((b) => b.category === "Social Media").length,
      others: backlinks.filter((b) => b.category === "Others").length,
    };

    res.json({
      success: true,
      data: stats,
    });
  } catch (error) {
    console.error("Error fetching backlink stats:", error);
    res.status(500).json({ message: "Server error", error: error.message });
  }
});

module.exports = router;
