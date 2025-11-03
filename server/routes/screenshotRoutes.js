const express = require("express");
const router = express.Router();
const multer = require("multer");
const path = require("path");
const fs = require("fs");
const Screenshot = require("../models/Screenshot");
const Project = require("../models/Project");
const { protect, authorize } = require("../middlewares/authMiddleware");

// Configure multer for screenshot uploads
const storage = multer.diskStorage({
  destination: function (req, file, cb) {
    const uploadDir = "uploads/screenshots";
    // Create directory if it doesn't exist
    if (!fs.existsSync(uploadDir)) {
      fs.mkdirSync(uploadDir, { recursive: true });
    }
    cb(null, uploadDir);
  },
  filename: function (req, file, cb) {
    const uniqueSuffix = Date.now() + "-" + Math.round(Math.random() * 1e9);
    cb(
      null,
      "screenshot-" + uniqueSuffix + path.extname(file.originalname)
    );
  },
});

const fileFilter = (req, file, cb) => {
  // Accept images only
  const allowedTypes = /jpeg|jpg|png|gif|webp|bmp/;
  const extname = allowedTypes.test(
    path.extname(file.originalname).toLowerCase()
  );
  const mimetype = allowedTypes.test(file.mimetype);

  if (mimetype && extname) {
    return cb(null, true);
  } else {
    cb(new Error("Only image files are allowed!"));
  }
};

const upload = multer({
  storage: storage,
  limits: { fileSize: 10 * 1024 * 1024 }, // 10MB limit
  fileFilter: fileFilter,
});

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
  upload.single("screenshot"),
  async (req, res) => {
    try {
      const { projectId } = req.params;
      const { title, description, tags } = req.body;

      if (!req.file) {
        return res.status(400).json({ message: "Screenshot file is required" });
      }

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

      // Create screenshot record
      const screenshot = await Screenshot.create({
        project: projectId,
        title: title.trim(),
        description: description?.trim() || "",
        imageUrl: `/uploads/screenshots/${req.file.filename}`,
        uploadedBy: req.user._id,
        fileSize: req.file.size,
        mimeType: req.file.mimetype,
        tags: parsedTags,
      });

      const populatedScreenshot = await Screenshot.findById(
        screenshot._id
      ).populate("uploadedBy", "name email employeeId");

      res.status(201).json({
        success: true,
        message: "Screenshot uploaded successfully",
        data: populatedScreenshot,
      });
    } catch (error) {
      console.error("Error uploading screenshot:", error);
      // Delete uploaded file if database operation fails
      if (req.file) {
        fs.unlink(req.file.path, (err) => {
          if (err) console.error("Error deleting file:", err);
        });
      }
      res.status(500).json({ message: "Server error", error: error.message });
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
