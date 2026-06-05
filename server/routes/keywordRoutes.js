const express        = require("express");
const router         = express.Router();
const KeywordRank    = require("../models/KeywordRank");
const Project        = require("../models/Project");
const { protect, authorize } = require("../middlewares/authMiddleware");
const hybridRankService = require("../services/hybridRankService");

// ─── Helper: check employee is assigned to a project ─────────────────────────
function isEmployeeAssigned(project, userId) {
  return project.assignedTo.some((e) => e.toString() === userId.toString());
}

// ─── GET /api/projects/:projectId/keywords ────────────────────────────────────
// List all keywords for a project
router.get("/:projectId/keywords", protect, async (req, res) => {
  try {
    const { projectId } = req.params;
    const { activeOnly = "true", historyLimit = "10" } = req.query;

    const project = await Project.findById(projectId);
    if (!project) return res.status(404).json({ message: "Project not found" });

    if (req.user.role === "employee" && !isEmployeeAssigned(project, req.user._id)) {
      return res.status(403).json({ message: "Access denied" });
    }

    const filter = { project: projectId };
    if (activeOnly === "true") filter.isActive = true;

    const limit = parseInt(historyLimit) || 10;

    // Fetch keywords with limited rankHistory
    const keywords = await KeywordRank.find(filter)
      .populate("createdBy", "name email employeeId")
      .sort({ createdAt: -1 })
      .lean();

    // Manually compute virtuals + limit rankHistory
    const optimizedKeywords = keywords.map(kw => {
      const history = kw.rankHistory || [];
      const currentRank  = history.length >= 1 ? history[history.length - 1] : null;
      const previousRank = history.length >= 2 ? history[history.length - 2] : null;
      const pastRank     = history.length >= 3 ? history[history.length - 3] : null;

      // Mirrors calculateRankChange in the model
      let rankChange = 0;
      if (currentRank && previousRank) {
        const p = previousRank.rank, c = currentRank.rank;
        const pUnranked = p === 0 || p >= 101;
        const cUnranked = c === 0 || c >= 101;
        if      ( pUnranked && !cUnranked) rankChange =  100 - c;
        else if (!pUnranked &&  cUnranked) rankChange = -(100 + p);
        else if (!pUnranked && !cUnranked) rankChange =  p - c;
      }
      const rankTrend = rankChange > 0 ? "improved" : rankChange < 0 ? "declined" : "stable";

      return {
        ...kw,
        rankHistory: history.slice(0, limit),
        currentRank,
        previousRank,
        pastRank,
        rankChange,
        rankTrend,
      };
    });

    res.json({ success: true, data: optimizedKeywords, count: optimizedKeywords.length });
  } catch (error) {
    console.error("Error fetching keywords:", error);
    res.status(500).json({ message: "Server error", error: error.message });
  }
});

// ─── POST /api/projects/:projectId/keywords ───────────────────────────────────
// Add a new keyword to track
router.post("/:projectId/keywords", protect, async (req, res) => {
  try {
    const { projectId } = req.params;
    const {
      keyword, initialRank, targetUrl,
      keywordLink, blogLink, backlink,
      searchEngine, location, category, notes,
      // New fields
      city, country, countryCode,
      priority, device, fetchFrequency,
    } = req.body;

    if (!keyword || initialRank === undefined) {
      return res.status(400).json({ message: "Keyword and initial rank are required" });
    }

    const project = await Project.findById(projectId);
    if (!project) return res.status(404).json({ message: "Project not found" });

    if (req.user.role === "employee" && !isEmployeeAssigned(project, req.user._id)) {
      return res.status(403).json({ message: "Access denied" });
    }

    // Prevent duplicate keyword+category within the same project
    const existing = await KeywordRank.findOne({
      project: projectId,
      keyword: keyword.trim(),
      category: category || "SEO",
      isActive: true,
    });
    if (existing) {
      return res.status(400).json({
        message: `This keyword is already being tracked in the ${category || "SEO"} category`,
      });
    }

    const keywordRank = await KeywordRank.create({
      project:        projectId,
      keyword:        keyword.trim(),
      targetUrl:      targetUrl      || "",
      keywordLink:    keywordLink    || "",
      blogLink:       blogLink       || "",
      backlink:       backlink       || "",
      searchEngine:   searchEngine   || "Google",
      location:       location       || "Global",
      category:       category       || "SEO",
      // New fields
      city:           city           || "",
      country:        country        || "Global",
      countryCode:    countryCode    || "",
      priority:       priority       || "normal",
      device:         device         || "desktop",
      fetchFrequency: fetchFrequency || "weekly",
      rankHistory: [{
        rank:       initialRank,
        recordedBy: req.user._id,
        recordedAt: new Date(),
        notes:      notes || "Initial rank",
        source:     "manual",
        device:     device || "desktop",
      }],
      createdBy: req.user._id,
    });

    const populated = await KeywordRank.findById(keywordRank._id)
      .populate("createdBy", "name email employeeId")
      .populate("rankHistory.recordedBy", "name email employeeId");

    res.status(201).json({ success: true, message: "Keyword added successfully", data: populated });
  } catch (error) {
    console.error("Error adding keyword:", error);
    res.status(500).json({ message: "Server error", error: error.message });
  }
});

// ─── POST /api/projects/:projectId/keywords/:keywordId/rank ──────────────────
// Manually add a new rank entry (existing flow — unchanged)
router.post("/:projectId/keywords/:keywordId/rank", protect, async (req, res) => {
  try {
    const { projectId, keywordId } = req.params;
    const { rank, notes } = req.body;

    if (rank === undefined) return res.status(400).json({ message: "Rank is required" });

    const project = await Project.findById(projectId);
    if (!project) return res.status(404).json({ message: "Project not found" });

    if (req.user.role === "employee" && !isEmployeeAssigned(project, req.user._id)) {
      return res.status(403).json({ message: "Access denied" });
    }

    const keyword = await KeywordRank.findById(keywordId);
    if (!keyword) return res.status(404).json({ message: "Keyword not found" });
    if (keyword.project.toString() !== projectId) {
      return res.status(400).json({ message: "Keyword does not belong to this project" });
    }

    await keyword.addRank(rank, req.user._id, notes, "manual", keyword.device || "desktop");

    const updated = await KeywordRank.findById(keywordId)
      .populate("createdBy", "name email employeeId")
      .populate("rankHistory.recordedBy", "name email employeeId");

    res.json({ success: true, message: "Rank updated successfully", data: updated });
  } catch (error) {
    console.error("Error updating rank:", error);
    res.status(500).json({ message: "Server error", error: error.message });
  }
});

// ─── POST /api/projects/:projectId/keywords/:keywordId/fetch-rank ─────────────
// Trigger an automated rank fetch via SerpAPI → Playwright hybrid
router.post("/:projectId/keywords/:keywordId/fetch-rank", protect, async (req, res) => {
  try {
    const { projectId, keywordId } = req.params;

    const project = await Project.findById(projectId);
    if (!project) return res.status(404).json({ message: "Project not found" });

    if (req.user.role === "employee" && !isEmployeeAssigned(project, req.user._id)) {
      return res.status(403).json({ message: "Access denied" });
    }

    const keyword = await KeywordRank.findById(keywordId);
    if (!keyword) return res.status(404).json({ message: "Keyword not found" });
    if (keyword.project.toString() !== projectId) {
      return res.status(400).json({ message: "Keyword does not belong to this project" });
    }
    if (!keyword.targetUrl) {
      return res.status(400).json({
        message: "No Target URL set on this keyword. Edit the keyword to add one before fetching.",
      });
    }
    if (keyword.searchEngine !== "Google") {
      return res.status(400).json({
        message: `Automated fetch supports Google only. This keyword uses ${keyword.searchEngine}.`,
      });
    }

    const result = await hybridRankService.fetchAndSave(keyword, req.user._id.toString());

    if (!result.saved) {
      const statusMap = { captcha: 503, quota_exceeded_not_top: 429, no_target_url: 400 };
      const status = statusMap[result.reason] || 502;
      return res.status(status).json({ message: result.message, reason: result.reason });
    }

    const updated = await KeywordRank.findById(keywordId)
      .populate("createdBy", "name email employeeId")
      .populate("rankHistory.recordedBy", "name email employeeId");

    res.json({
      success: true,
      message: result.message,
      fetchedRank: result.rank,
      source:      result.source,
      fromCache:   result.fromCache || false,
      data:        updated,
    });
  } catch (error) {
    console.error("Error in fetch-rank:", error);
    res.status(500).json({ message: "Server error", error: error.message });
  }
});

// ─── PUT /api/projects/:projectId/keywords/:keywordId ────────────────────────
// Update keyword metadata (not rank)
router.put("/:projectId/keywords/:keywordId", protect, async (req, res) => {
  try {
    const { projectId, keywordId } = req.params;
    const {
      keyword, targetUrl, keywordLink, blogLink, backlink,
      searchEngine, location, category, isActive,
      // New fields
      city, country, countryCode, priority, device, fetchFrequency,
    } = req.body;

    const project = await Project.findById(projectId);
    if (!project) return res.status(404).json({ message: "Project not found" });

    if (req.user.role === "employee" && !isEmployeeAssigned(project, req.user._id)) {
      return res.status(403).json({ message: "Access denied" });
    }

    const keywordRank = await KeywordRank.findById(keywordId);
    if (!keywordRank) return res.status(404).json({ message: "Keyword not found" });
    if (keywordRank.project.toString() !== projectId) {
      return res.status(400).json({ message: "Keyword does not belong to this project" });
    }

    // Prevent duplicate keyword+category
    if (keyword !== undefined || category !== undefined) {
      const updatedKeyword   = keyword   !== undefined ? keyword.trim()  : keywordRank.keyword;
      const updatedCategory  = category  !== undefined ? category        : keywordRank.category;

      const dup = await KeywordRank.findOne({
        project: projectId,
        keyword: updatedKeyword,
        category: updatedCategory,
        isActive: true,
        _id: { $ne: keywordId },
      });
      if (dup) {
        return res.status(400).json({
          message: `Keyword already tracked in ${updatedCategory} category for this project`,
        });
      }
    }

    // Apply updates
    if (keyword       !== undefined) keywordRank.keyword       = keyword.trim();
    if (targetUrl     !== undefined) keywordRank.targetUrl     = targetUrl;
    if (keywordLink   !== undefined) keywordRank.keywordLink   = keywordLink;
    if (blogLink      !== undefined) keywordRank.blogLink      = blogLink;
    if (backlink      !== undefined) keywordRank.backlink      = backlink;
    if (searchEngine  !== undefined) keywordRank.searchEngine  = searchEngine;
    if (location      !== undefined) keywordRank.location      = location;
    if (category      !== undefined) keywordRank.category      = category;
    if (isActive      !== undefined) keywordRank.isActive      = isActive;
    // New fields
    if (city          !== undefined) keywordRank.city          = city;
    if (country       !== undefined) keywordRank.country       = country;
    if (countryCode   !== undefined) keywordRank.countryCode   = countryCode.toLowerCase();
    if (priority      !== undefined) keywordRank.priority      = priority;
    if (device        !== undefined) keywordRank.device        = device;
    if (fetchFrequency !== undefined) keywordRank.fetchFrequency = fetchFrequency;

    await keywordRank.save();

    const updated = await KeywordRank.findById(keywordId)
      .populate("createdBy", "name email employeeId")
      .populate("rankHistory.recordedBy", "name email employeeId");

    res.json({ success: true, message: "Keyword updated successfully", data: updated });
  } catch (error) {
    console.error("Error updating keyword:", error);
    res.status(500).json({ message: "Server error", error: error.message });
  }
});

// ─── DELETE /api/projects/:projectId/keywords/:keywordId ─────────────────────
// Soft-delete (deactivate) or permanent delete (admin only)
router.delete(
  "/:projectId/keywords/:keywordId",
  protect,
  authorize("admin", "super-admin"),
  async (req, res) => {
    try {
      const { projectId, keywordId } = req.params;
      const { permanent = false } = req.query;

      const keyword = await KeywordRank.findById(keywordId);
      if (!keyword) return res.status(404).json({ message: "Keyword not found" });
      if (keyword.project.toString() !== projectId) {
        return res.status(400).json({ message: "Keyword does not belong to this project" });
      }

      if (permanent === "true") {
        await keyword.deleteOne();
        res.json({ success: true, message: "Keyword permanently deleted" });
      } else {
        keyword.isActive = false;
        await keyword.save();
        res.json({ success: true, message: "Keyword deactivated", data: keyword });
      }
    } catch (error) {
      console.error("Error deleting keyword:", error);
      res.status(500).json({ message: "Server error", error: error.message });
    }
  }
);

// ─── GET /api/projects/:projectId/keywords/stats ─────────────────────────────
router.get("/:projectId/keywords/stats", protect, async (req, res) => {
  try {
    const { projectId } = req.params;

    const project = await Project.findById(projectId);
    if (!project) return res.status(404).json({ message: "Project not found" });

    if (req.user.role === "employee" && !isEmployeeAssigned(project, req.user._id)) {
      return res.status(403).json({ message: "Access denied" });
    }

    const keywords = await KeywordRank.find({ project: projectId, isActive: true });

    let improved = 0, declined = 0, stable = 0, totalRankChange = 0;
    keywords.forEach((kw) => {
      const trend = kw.rankTrend;
      if (trend === "improved")      improved++;
      else if (trend === "declined") declined++;
      else                           stable++;
      totalRankChange += kw.rankChange || 0;
    });

    res.json({
      success: true,
      data: {
        totalKeywords: keywords.length,
        improved, declined, stable,
        averageRankChange: keywords.length > 0
          ? (totalRankChange / keywords.length).toFixed(2)
          : 0,
      },
    });
  } catch (error) {
    console.error("Error fetching keyword stats:", error);
    res.status(500).json({ message: "Server error", error: error.message });
  }
});

// ─── GET /api/projects/:projectId/keywords/velocity ──────────────────────────
router.get("/:projectId/keywords/velocity", protect, async (req, res) => {
  try {
    const { projectId } = req.params;

    const project = await Project.findById(projectId);
    if (!project) return res.status(404).json({ message: "Project not found" });

    if (req.user.role === "employee" && !isEmployeeAssigned(project, req.user._id)) {
      return res.status(403).json({ message: "Access denied" });
    }

    const insights = await KeywordRank.getVelocityInsights(projectId);
    res.json({ success: true, data: insights });
  } catch (error) {
    console.error("Error fetching velocity insights:", error);
    res.status(500).json({ message: "Server error", error: error.message });
  }
});

module.exports = router;
