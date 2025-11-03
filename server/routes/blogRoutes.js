const express = require("express");
const router = express.Router();
const BlogUpdate = require("../models/BlogUpdate");
const Project = require("../models/Project");
const { protect, authorize } = require("../middlewares/authMiddleware");

// @route   GET /api/projects/:projectId/blogs
// @desc    Get all blog updates for a project
// @access  Private
router.get("/:projectId/blogs", protect, async (req, res) => {
  try {
    const { projectId } = req.params;
    const { activeOnly = "true" } = req.query;

    // Check if project exists
    const project = await Project.findById(projectId);
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

    const blogs = await BlogUpdate.getProjectBlogUpdates(
      projectId,
      activeOnly === "true"
    );

    res.json({
      success: true,
      data: blogs,
      count: blogs.length,
    });
  } catch (error) {
    console.error("Error fetching blog updates:", error);
    res.status(500).json({ message: "Server error", error: error.message });
  }
});

// @route   POST /api/projects/:projectId/blogs
// @desc    Add a new blog update
// @access  Private (Admin, SuperAdmin, or assigned employees)
router.post("/:projectId/blogs", protect, async (req, res) => {
  try {
    const { projectId } = req.params;
    const {
      title,
      url,
      description,
      category,
      status,
      publishedDate,
      wordCount,
      targetKeywords,
      notes,
    } = req.body;

    if (!title || !url) {
      return res.status(400).json({
        message: "Title and URL are required",
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

    // Create new blog update
    const blogUpdate = await BlogUpdate.create({
      project: projectId,
      title: title.trim(),
      url: url.trim(),
      description,
      category: category || "Blog Post",
      status: status || "Published",
      publishedDate: publishedDate || new Date(),
      wordCount,
      targetKeywords: targetKeywords || [],
      notes,
      addedBy: req.user._id,
    });

    const populatedBlog = await BlogUpdate.findById(blogUpdate._id).populate(
      "addedBy",
      "name email employeeId"
    );

    res.status(201).json({
      success: true,
      message: "Blog update added successfully",
      data: populatedBlog,
    });
  } catch (error) {
    console.error("Error adding blog update:", error);
    res.status(500).json({ message: "Server error", error: error.message });
  }
});

// @route   PUT /api/projects/:projectId/blogs/:blogId
// @desc    Update a blog update
// @access  Private (Admin, SuperAdmin, or assigned employees)
router.put("/:projectId/blogs/:blogId", protect, async (req, res) => {
  try {
    const { projectId, blogId } = req.params;
    const {
      title,
      url,
      description,
      category,
      status,
      publishedDate,
      wordCount,
      targetKeywords,
      notes,
      metrics,
    } = req.body;

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

    // Find and update blog
    const blogUpdate = await BlogUpdate.findById(blogId);
    if (!blogUpdate) {
      return res.status(404).json({ message: "Blog update not found" });
    }

    if (blogUpdate.project.toString() !== projectId) {
      return res.status(400).json({
        message: "Blog update does not belong to this project",
      });
    }

    // Update fields
    if (title !== undefined) blogUpdate.title = title.trim();
    if (url !== undefined) blogUpdate.url = url.trim();
    if (description !== undefined) blogUpdate.description = description;
    if (category !== undefined) blogUpdate.category = category;
    if (status !== undefined) blogUpdate.status = status;
    if (publishedDate !== undefined) blogUpdate.publishedDate = publishedDate;
    if (wordCount !== undefined) blogUpdate.wordCount = wordCount;
    if (targetKeywords !== undefined) blogUpdate.targetKeywords = targetKeywords;
    if (notes !== undefined) blogUpdate.notes = notes;
    if (metrics !== undefined) blogUpdate.metrics = metrics;

    await blogUpdate.save();

    const updatedBlog = await BlogUpdate.findById(blogId).populate(
      "addedBy",
      "name email employeeId"
    );

    res.json({
      success: true,
      message: "Blog update updated successfully",
      data: updatedBlog,
    });
  } catch (error) {
    console.error("Error updating blog update:", error);
    res.status(500).json({ message: "Server error", error: error.message });
  }
});

// @route   DELETE /api/projects/:projectId/blogs/:blogId
// @desc    Delete/deactivate a blog update
// @access  Private (Admin, SuperAdmin)
router.delete(
  "/:projectId/blogs/:blogId",
  protect,
  authorize("admin", "super-admin"),
  async (req, res) => {
    try {
      const { projectId, blogId } = req.params;
      const { permanent = false } = req.query;

      const blogUpdate = await BlogUpdate.findById(blogId);
      if (!blogUpdate) {
        return res.status(404).json({ message: "Blog update not found" });
      }

      if (blogUpdate.project.toString() !== projectId) {
        return res.status(400).json({
          message: "Blog update does not belong to this project",
        });
      }

      if (permanent === "true") {
        await blogUpdate.deleteOne();
        res.json({
          success: true,
          message: "Blog update permanently deleted",
        });
      } else {
        blogUpdate.isActive = false;
        await blogUpdate.save();
        res.json({
          success: true,
          message: "Blog update deactivated",
          data: blogUpdate,
        });
      }
    } catch (error) {
      console.error("Error deleting blog update:", error);
      res.status(500).json({ message: "Server error", error: error.message });
    }
  }
);

// @route   GET /api/projects/:projectId/blogs/stats
// @desc    Get blog statistics for a project
// @access  Private
router.get("/:projectId/blogs/stats", protect, async (req, res) => {
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

    const blogs = await BlogUpdate.find({
      project: projectId,
      isActive: true,
    });

    const stats = {
      totalBlogs: blogs.length,
      published: blogs.filter((b) => b.status === "Published").length,
      draft: blogs.filter((b) => b.status === "Draft").length,
      updated: blogs.filter((b) => b.status === "Updated").length,
      archived: blogs.filter((b) => b.status === "Archived").length,
      totalWordCount: blogs.reduce((sum, b) => sum + (b.wordCount || 0), 0),
      avgWordCount:
        blogs.length > 0
          ? Math.round(
              blogs.reduce((sum, b) => sum + (b.wordCount || 0), 0) /
                blogs.length
            )
          : 0,
      totalViews: blogs.reduce((sum, b) => sum + (b.metrics?.views || 0), 0),
      totalShares: blogs.reduce((sum, b) => sum + (b.metrics?.shares || 0), 0),
      totalBacklinks: blogs.reduce(
        (sum, b) => sum + (b.metrics?.backlinks || 0),
        0
      ),
    };

    res.json({
      success: true,
      data: stats,
    });
  } catch (error) {
    console.error("Error fetching blog stats:", error);
    res.status(500).json({ message: "Server error", error: error.message });
  }
});

module.exports = router;
