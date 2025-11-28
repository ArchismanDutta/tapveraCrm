const express = require("express");
const router = express.Router();
const path = require("path");
const fs = require("fs");
const Screenshot = require("../models/Screenshot");
const Project = require("../models/Project");
const { protect, authorize } = require("../middlewares/authMiddleware");
const { uploadToS3, convertToCloudFrontUrl } = require("../config/s3Config");

// @route   GET /api/projects/:projectId/screenshots
// @desc    Get all screenshots for a project
// @access  Private
router.get("/:projectId/screenshots", protect, async (req, res) => {
  try {
    const { projectId } = req.params;
    const { activeOnly = "true" } = req.query;

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

    const screenshots = await Screenshot.find(filter)
      .populate("uploadedBy", "name email employeeId")
      .sort({ createdAt: -1 });

    res.json({
      success: true,
      data: screenshots,
      count: screenshots.length,
    });
  } catch (error) {
    console.error("Error fetching screenshots:", error);
    res.status(500).json({ message: "Server error", error: error.message });
  }
});

// @route   POST /api/projects/:projectId/screenshots
// @desc    Upload a new screenshot
// @access  Private (Admin, SuperAdmin, or assigned employees)
router.post(
  "/:projectId/screenshots",
  protect,
  uploadToS3.single("screenshot"),
  async (req, res) => {
    try {
      const { projectId } = req.params;
      const { title, description, tags } = req.body;

      console.log("[Screenshot Upload] Request received for project:", projectId);
      console.log("[Screenshot Upload] File received:", req.file ? "Yes" : "No");

      if (!req.file) {
        console.error("[Screenshot Upload] No file in request");
        return res.status(400).json({ message: "Screenshot file is required" });
      }

      console.log("[Screenshot Upload] File details:", {
        location: req.file.location,
        key: req.file.key,
        filename: req.file.filename,
        size: req.file.size,
        mimetype: req.file.mimetype
      });

      if (!title) {
        return res.status(400).json({ message: "Title is required" });
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

      // Parse tags if provided
      let parsedTags = [];
      if (tags) {
        try {
          parsedTags = JSON.parse(tags);
        } catch (e) {
          parsedTags = tags.split(",").map((tag) => tag.trim());
        }
      }

      // Get file URL from S3 or local storage
      let fileUrl;
      if (req.file.location) {
        // S3 upload - location contains the S3 URL
        fileUrl = req.file.location;
      } else if (req.file.key) {
        // S3 upload with key instead of location
        fileUrl = `https://${process.env.AWS_S3_BUCKET_NAME}.s3.${process.env.AWS_REGION}.amazonaws.com/${req.file.key}`;
      } else {
        // Local storage fallback
        fileUrl = `/uploads/screenshots/${req.file.filename}`;
      }
      const cloudFrontUrl = convertToCloudFrontUrl(fileUrl);

      console.log("[Screenshot Upload] File URLs:", {
        originalUrl: fileUrl,
        cloudFrontUrl: cloudFrontUrl
      });

      // Create screenshot record
      const screenshot = await Screenshot.create({
        project: projectId,
        title: title.trim(),
        description: description?.trim() || "",
        imageUrl: cloudFrontUrl,
        uploadedBy: req.user._id,
        fileSize: req.file.size,
        mimeType: req.file.mimetype,
        tags: parsedTags,
      });

      const populatedScreenshot = await Screenshot.findById(
        screenshot._id
      ).populate("uploadedBy", "name email employeeId");

      console.log("[Screenshot Upload] Success! Screenshot ID:", screenshot._id);

      res.status(201).json({
        success: true,
        message: "Screenshot uploaded successfully",
        data: populatedScreenshot,
      });
    } catch (error) {
      console.error("[Screenshot Upload] Error:", error);
      console.error("[Screenshot Upload] Error stack:", error.stack);
      res.status(500).json({
        message: "Server error",
        error: error.message,
        details: process.env.NODE_ENV === 'development' ? error.stack : undefined
      });
    }
  }
);

// @route   PUT /api/projects/:projectId/screenshots/:screenshotId
// @desc    Update screenshot details
// @access  Private (Admin, SuperAdmin, or assigned employees)
router.put(
  "/:projectId/screenshots/:screenshotId",
  protect,
  async (req, res) => {
    try {
      const { projectId, screenshotId } = req.params;
      const { title, description, tags } = req.body;

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

      // Find and update screenshot
      const screenshot = await Screenshot.findById(screenshotId);
      if (!screenshot) {
        return res.status(404).json({ message: "Screenshot not found" });
      }

      if (screenshot.project.toString() !== projectId) {
        return res.status(400).json({
          message: "Screenshot does not belong to this project",
        });
      }

      // Update fields
      if (title !== undefined) screenshot.title = title.trim();
      if (description !== undefined) screenshot.description = description.trim();
      if (tags !== undefined) {
        let parsedTags = [];
        try {
          parsedTags = JSON.parse(tags);
        } catch (e) {
          parsedTags = tags.split(",").map((tag) => tag.trim());
        }
        screenshot.tags = parsedTags;
      }

      await screenshot.save();

      const updatedScreenshot = await Screenshot.findById(screenshotId).populate(
        "uploadedBy",
        "name email employeeId"
      );

      res.json({
        success: true,
        message: "Screenshot updated successfully",
        data: updatedScreenshot,
      });
    } catch (error) {
      console.error("Error updating screenshot:", error);
      res.status(500).json({ message: "Server error", error: error.message });
    }
  }
);

// @route   DELETE /api/projects/:projectId/screenshots/:screenshotId
// @desc    Delete/deactivate a screenshot
// @access  Private (Admin, SuperAdmin)
router.delete(
  "/:projectId/screenshots/:screenshotId",
  protect,
  authorize("admin", "super-admin"),
  async (req, res) => {
    try {
      const { projectId, screenshotId } = req.params;
      const { permanent = false } = req.query;

      const screenshot = await Screenshot.findById(screenshotId);
      if (!screenshot) {
        return res.status(404).json({ message: "Screenshot not found" });
      }

      if (screenshot.project.toString() !== projectId) {
        return res.status(400).json({
          message: "Screenshot does not belong to this project",
        });
      }

      if (permanent === "true") {
        // Delete physical file
        const filePath = path.join(__dirname, "..", screenshot.imageUrl);
        if (fs.existsSync(filePath)) {
          fs.unlinkSync(filePath);
        }

        await screenshot.deleteOne();
        res.json({
          success: true,
          message: "Screenshot permanently deleted",
        });
      } else {
        screenshot.isActive = false;
        await screenshot.save();
        res.json({
          success: true,
          message: "Screenshot deactivated",
          data: screenshot,
        });
      }
    } catch (error) {
      console.error("Error deleting screenshot:", error);
      res.status(500).json({ message: "Server error", error: error.message });
    }
  }
);

// @route   GET /api/projects/:projectId/screenshots/stats
// @desc    Get screenshot statistics for a project
// @access  Private
router.get("/:projectId/screenshots/stats", protect, async (req, res) => {
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

    const screenshots = await Screenshot.find({
      project: projectId,
      isActive: true,
    });

    const totalSize = screenshots.reduce((sum, s) => sum + (s.fileSize || 0), 0);

    const stats = {
      totalScreenshots: screenshots.length,
      totalSize: totalSize,
      totalSizeMB: (totalSize / (1024 * 1024)).toFixed(2),
    };

    res.json({
      success: true,
      data: stats,
    });
  } catch (error) {
    console.error("Error fetching screenshot stats:", error);
    res.status(500).json({ message: "Server error", error: error.message });
  }
});

module.exports = router;
