const express = require("express");
const router = express.Router();
const KeywordRank = require("../models/KeywordRank");
const Project = require("../models/Project");
const { protect, authorize } = require("../middlewares/authMiddleware");

// @route   GET /api/projects/:projectId/keywords
// @desc    Get all keywords for a project
// @access  Private
router.get("/:projectId/keywords", protect, async (req, res) => {
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

    const keywords = await KeywordRank.getProjectKeywords(
      projectId,
      activeOnly === "true"
    );

    res.json({
      success: true,
      data: keywords,
      count: keywords.length,
    });
  } catch (error) {
    console.error("Error fetching keywords:", error);
    res.status(500).json({ message: "Server error", error: error.message });
  }
});

// @route   POST /api/projects/:projectId/keywords
// @desc    Add a new keyword to track
// @access  Private (Admin, SuperAdmin, or assigned employees)
router.post("/:projectId/keywords", protect, async (req, res) => {
  try {
    const { projectId } = req.params;
    const {
      keyword,
      initialRank,
      targetUrl,
      searchEngine,
      location,
      notes,
    } = req.body;

    if (!keyword || initialRank === undefined) {
      return res.status(400).json({
        message: "Keyword and initial rank are required",
      });
    }

    // Check if project exists
    const project = await Project.findById(projectId);
    if (!project) {
      return res.status(404).json({ message: "Project not found" });
    }

    // Check access - only admin, super-admin, or assigned employees can add
    if (req.user.role === "employee") {
      const isAssigned = project.assignedTo.some(
        (emp) => emp.toString() === req.user._id.toString()
      );
      if (!isAssigned) {
        return res.status(403).json({ message: "Access denied" });
      }
    }

    // Check if keyword already exists for this project
    const existingKeyword = await KeywordRank.findOne({
      project: projectId,
      keyword: keyword.trim(),
      isActive: true,
    });

    if (existingKeyword) {
      return res.status(400).json({
        message: "This keyword is already being tracked for this project",
      });
    }

    // Create new keyword with initial rank
    const keywordRank = await KeywordRank.create({
      project: projectId,
      keyword: keyword.trim(),
      targetUrl,
      searchEngine: searchEngine || "Google",
      location: location || "Global",
      rankHistory: [
        {
          rank: initialRank,
          recordedBy: req.user._id,
          recordedAt: new Date(),
          notes: notes || "Initial rank",
        },
      ],
      createdBy: req.user._id,
    });

    const populatedKeyword = await KeywordRank.findById(keywordRank._id)
      .populate("createdBy", "name email employeeId")
      .populate("rankHistory.recordedBy", "name email employeeId");

    res.status(201).json({
      success: true,
      message: "Keyword added successfully",
      data: populatedKeyword,
    });
  } catch (error) {
    console.error("Error adding keyword:", error);
    res.status(500).json({ message: "Server error", error: error.message });
  }
});

// @route   POST /api/projects/:projectId/keywords/:keywordId/rank
// @desc    Add a new rank update for a keyword
// @access  Private (Admin, SuperAdmin, or assigned employees)
router.post("/:projectId/keywords/:keywordId/rank", protect, async (req, res) => {
  try {
    const { projectId, keywordId } = req.params;
    const { rank, notes } = req.body;

    if (rank === undefined) {
      return res.status(400).json({ message: "Rank is required" });
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

    // Find keyword
    const keyword = await KeywordRank.findById(keywordId);
    if (!keyword) {
      return res.status(404).json({ message: "Keyword not found" });
    }

    if (keyword.project.toString() !== projectId) {
      return res.status(400).json({
        message: "Keyword does not belong to this project",
      });
    }

    // Add new rank
    await keyword.addRank(rank, req.user._id, notes);

    const updatedKeyword = await KeywordRank.findById(keywordId)
      .populate("createdBy", "name email employeeId")
      .populate("rankHistory.recordedBy", "name email employeeId");

    res.json({
      success: true,
      message: "Rank updated successfully",
      data: updatedKeyword,
    });
  } catch (error) {
    console.error("Error updating rank:", error);
    res.status(500).json({ message: "Server error", error: error.message });
  }
});

// @route   PUT /api/projects/:projectId/keywords/:keywordId
// @desc    Update keyword details (not rank)
// @access  Private (Admin, SuperAdmin, or assigned employees)
router.put("/:projectId/keywords/:keywordId", protect, async (req, res) => {
  try {
    const { projectId, keywordId } = req.params;
    const { keyword, targetUrl, searchEngine, location, isActive } = req.body;

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

    // Find and update keyword
    const keywordRank = await KeywordRank.findById(keywordId);
    if (!keywordRank) {
      return res.status(404).json({ message: "Keyword not found" });
    }

    if (keywordRank.project.toString() !== projectId) {
      return res.status(400).json({
        message: "Keyword does not belong to this project",
      });
    }

    // Update fields
    if (keyword !== undefined) keywordRank.keyword = keyword.trim();
    if (targetUrl !== undefined) keywordRank.targetUrl = targetUrl;
    if (searchEngine !== undefined) keywordRank.searchEngine = searchEngine;
    if (location !== undefined) keywordRank.location = location;
    if (isActive !== undefined) keywordRank.isActive = isActive;

    await keywordRank.save();

    const updatedKeyword = await KeywordRank.findById(keywordId)
      .populate("createdBy", "name email employeeId")
      .populate("rankHistory.recordedBy", "name email employeeId");

    res.json({
      success: true,
      message: "Keyword updated successfully",
      data: updatedKeyword,
    });
  } catch (error) {
    console.error("Error updating keyword:", error);
    res.status(500).json({ message: "Server error", error: error.message });
  }
});

// @route   DELETE /api/projects/:projectId/keywords/:keywordId
// @desc    Delete/deactivate a keyword
// @access  Private (Admin, SuperAdmin)
router.delete("/:projectId/keywords/:keywordId", protect, authorize("admin", "super-admin"), async (req, res) => {
  try {
    const { projectId, keywordId } = req.params;
    const { permanent = false } = req.query;

    const keyword = await KeywordRank.findById(keywordId);
    if (!keyword) {
      return res.status(404).json({ message: "Keyword not found" });
    }

    if (keyword.project.toString() !== projectId) {
      return res.status(400).json({
        message: "Keyword does not belong to this project",
      });
    }

    if (permanent === "true") {
      await keyword.deleteOne();
      res.json({
        success: true,
        message: "Keyword permanently deleted",
      });
    } else {
      keyword.isActive = false;
      await keyword.save();
      res.json({
        success: true,
        message: "Keyword deactivated",
        data: keyword,
      });
    }
  } catch (error) {
    console.error("Error deleting keyword:", error);
    res.status(500).json({ message: "Server error", error: error.message });
  }
});

// @route   GET /api/projects/:projectId/keywords/stats
// @desc    Get keyword statistics for a project
// @access  Private
router.get("/:projectId/keywords/stats", protect, async (req, res) => {
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

    const keywords = await KeywordRank.find({
      project: projectId,
      isActive: true,
    });

    let improved = 0;
    let declined = 0;
    let stable = 0;
    let totalRankChange = 0;

    keywords.forEach((kw) => {
      const trend = kw.rankTrend;
      if (trend === "improved") improved++;
      else if (trend === "declined") declined++;
      else stable++;

      totalRankChange += kw.rankChange || 0;
    });

    res.json({
      success: true,
      data: {
        totalKeywords: keywords.length,
        improved,
        declined,
        stable,
        averageRankChange:
          keywords.length > 0 ? (totalRankChange / keywords.length).toFixed(2) : 0,
      },
    });
  } catch (error) {
    console.error("Error fetching keyword stats:", error);
    res.status(500).json({ message: "Server error", error: error.message });
  }
});

module.exports = router;
