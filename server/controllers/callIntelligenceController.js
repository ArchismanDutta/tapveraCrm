const CallRecording = require("../models/CallRecording");
const User = require("../models/User");
const Position = require("../models/Position");
const {
  getAccessibleUserIds,
  canAccessUserData,
} = require("../utils/hierarchyUtils");
const callAnalysisService = require("../services/callAnalysisService");
const vicidialService = require("../services/vicidialService");

// Helper: Check if user can access call intelligence
const canAccessCallIntelligence = async (user) => {
  if (user.role === "super-admin" || user.role === "admin") return true;
  if (user.department === "marketingAndSales") return true;

  if (user.position && user.position.trim() !== "") {
    try {
      const position = await Position.findOne({
        name: user.position,
        status: "active",
      });
      if (
        position &&
        (position.permissions?.canViewSubordinateLeads ||
          position.permissions?.canViewDepartmentLeads)
      ) {
        return true;
      }
    } catch (error) {
      console.error("Error checking position permissions:", error);
    }
  }

  return false;
};

// @desc    Get all call recordings (with role-based filtering)
// @route   GET /api/call-intelligence
// @access  Private
exports.getCallRecordings = async (req, res) => {
  try {
    if (!(await canAccessCallIntelligence(req.user))) {
      return res.status(403).json({
        message: "Access denied. Call Intelligence is only available to Super Admin, Marketing & Sales department, or users with lead management permissions.",
      });
    }

    const {
      search,
      agentUser,
      analysisStatus,
      callOutcome,
      sentiment,
      startDate,
      endDate,
      linkedLead,
      linkedCallback,
      page = 1,
      limit = 10,
    } = req.query;

    const filter = {};

    // Hierarchical access control
    const accessibleUserIds = await getAccessibleUserIds(req.user);

    if (agentUser) {
      const canAccess = await canAccessUserData(req.user, agentUser);
      if (!canAccess) {
        return res.status(403).json({
          message: "You don't have permission to view recordings for this user",
        });
      }
      filter.agentUser = agentUser;
    } else {
      filter.agentUser = { $in: accessibleUserIds };
    }

    if (analysisStatus) filter.analysisStatus = analysisStatus;
    if (callOutcome) filter.callOutcome = callOutcome;
    if (sentiment) filter.clientSentiment = sentiment;
    if (linkedLead) filter.linkedLead = linkedLead;
    if (linkedCallback) filter.linkedCallback = linkedCallback;

    // Date range filter
    if (startDate || endDate) {
      filter.callDate = {};
      if (startDate) filter.callDate.$gte = new Date(startDate);
      if (endDate) filter.callDate.$lte = new Date(endDate);
    }

    // Search
    if (search) {
      filter.$or = [
        { callRecordingId: { $regex: search, $options: "i" } },
        { phoneNumber: { $regex: search, $options: "i" } },
        { summary: { $regex: search, $options: "i" } },
      ];
    }

    const skip = (page - 1) * limit;

    const recordings = await CallRecording.find(filter)
      .populate("agentUser", "name email employeeId")
      .populate("linkedLead", "leadId clientName businessName phone")
      .populate("linkedCallback", "callbackId callbackDate callbackType")
      .sort({ callDate: -1 })
      .skip(skip)
      .limit(parseInt(limit));

    const total = await CallRecording.countDocuments(filter);

    res.json({
      success: true,
      data: recordings,
      pagination: {
        total,
        page: parseInt(page),
        pages: Math.ceil(total / limit),
        limit: parseInt(limit),
      },
    });
  } catch (error) {
    console.error("Error fetching call recordings:", error);
    res.status(500).json({
      message: "Failed to fetch call recordings",
      error: error.message,
    });
  }
};

// @desc    Get call recording statistics
// @route   GET /api/call-intelligence/stats
// @access  Private
exports.getCallRecordingStats = async (req, res) => {
  try {
    if (!(await canAccessCallIntelligence(req.user))) {
      return res.status(403).json({ message: "Access denied." });
    }

    const accessibleUserIds = await getAccessibleUserIds(req.user);
    const filter = { agentUser: { $in: accessibleUserIds } };

    const [
      totalRecordings,
      analyzedCount,
      pendingCount,
      outcomeStats,
      sentimentStats,
      performanceAvg,
    ] = await Promise.all([
      CallRecording.countDocuments(filter),
      CallRecording.countDocuments({ ...filter, analysisStatus: "Completed" }),
      CallRecording.countDocuments({ ...filter, analysisStatus: "Pending" }),
      CallRecording.aggregate([
        { $match: { ...filter, analysisStatus: "Completed" } },
        { $group: { _id: "$callOutcome", count: { $sum: 1 } } },
      ]),
      CallRecording.aggregate([
        { $match: { ...filter, analysisStatus: "Completed" } },
        { $group: { _id: "$clientSentiment", count: { $sum: 1 } } },
      ]),
      CallRecording.aggregate([
        {
          $match: {
            ...filter,
            analysisStatus: "Completed",
            agentPerformanceScore: { $ne: null },
          },
        },
        {
          $group: {
            _id: null,
            avgScore: { $avg: "$agentPerformanceScore" },
            avgSentiment: { $avg: "$sentimentScore" },
          },
        },
      ]),
    ]);

    res.json({
      success: true,
      data: {
        totalRecordings,
        analyzedCount,
        pendingCount,
        failedCount: await CallRecording.countDocuments({
          ...filter,
          analysisStatus: "Failed",
        }),
        byOutcome: outcomeStats,
        bySentiment: sentimentStats,
        avgPerformanceScore: performanceAvg[0]?.avgScore
          ? Math.round(performanceAvg[0].avgScore)
          : null,
        avgSentimentScore: performanceAvg[0]?.avgSentiment
          ? parseFloat(performanceAvg[0].avgSentiment.toFixed(2))
          : null,
      },
    });
  } catch (error) {
    console.error("Error fetching call recording stats:", error);
    res.status(500).json({
      message: "Failed to fetch statistics",
      error: error.message,
    });
  }
};

// @desc    Get single call recording by ID
// @route   GET /api/call-intelligence/:id
// @access  Private
exports.getCallRecordingById = async (req, res) => {
  try {
    if (!(await canAccessCallIntelligence(req.user))) {
      return res.status(403).json({ message: "Access denied." });
    }

    const recording = await CallRecording.findById(req.params.id)
      .populate("agentUser", "name email employeeId department")
      .populate("linkedLead", "leadId clientName businessName phone email status")
      .populate("linkedCallback", "callbackId callbackDate callbackType status remarks");

    if (!recording) {
      return res.status(404).json({ message: "Call recording not found" });
    }

    const canAccess = await canAccessUserData(req.user, recording.agentUser._id);
    if (!canAccess) {
      return res.status(403).json({
        message: "Access denied. You can only view your own call recordings or those of your subordinates.",
      });
    }

    res.json({ success: true, data: recording });
  } catch (error) {
    console.error("Error fetching call recording:", error);
    res.status(500).json({
      message: "Failed to fetch call recording",
      error: error.message,
    });
  }
};

// @desc    Get recordings linked to a lead
// @route   GET /api/call-intelligence/lead/:leadId
// @access  Private
exports.getRecordingsForLead = async (req, res) => {
  try {
    if (!(await canAccessCallIntelligence(req.user))) {
      return res.status(403).json({ message: "Access denied." });
    }

    const accessibleUserIds = await getAccessibleUserIds(req.user);

    const recordings = await CallRecording.find({
      linkedLead: req.params.leadId,
      agentUser: { $in: accessibleUserIds },
    })
      .populate("agentUser", "name email")
      .sort({ callDate: -1 })
      .limit(10);

    res.json({ success: true, data: recordings });
  } catch (error) {
    console.error("Error fetching recordings for lead:", error);
    res.status(500).json({
      message: "Failed to fetch recordings",
      error: error.message,
    });
  }
};

// @desc    Get recordings linked to a callback
// @route   GET /api/call-intelligence/callback/:callbackId
// @access  Private
exports.getRecordingsForCallback = async (req, res) => {
  try {
    if (!(await canAccessCallIntelligence(req.user))) {
      return res.status(403).json({ message: "Access denied." });
    }

    const accessibleUserIds = await getAccessibleUserIds(req.user);

    const recordings = await CallRecording.find({
      linkedCallback: req.params.callbackId,
      agentUser: { $in: accessibleUserIds },
    })
      .populate("agentUser", "name email")
      .sort({ callDate: -1 })
      .limit(10);

    res.json({ success: true, data: recordings });
  } catch (error) {
    console.error("Error fetching recordings for callback:", error);
    res.status(500).json({
      message: "Failed to fetch recordings",
      error: error.message,
    });
  }
};

// @desc    Get most recent call summary for a phone number
// @route   GET /api/call-intelligence/phone-summary/:phoneNumber
// @access  Private
exports.getRecentSummaryForPhone = async (req, res) => {
  try {
    if (!(await canAccessCallIntelligence(req.user))) {
      return res.status(403).json({ message: "Access denied." });
    }

    const { phoneNumber } = req.params;
    const accessibleUserIds = await getAccessibleUserIds(req.user);

    const recording = await CallRecording.findOne({
      phoneNumber: { $regex: phoneNumber.replace(/[^\d+]/g, ""), $options: "i" },
      analysisStatus: "Completed",
      agentUser: { $in: accessibleUserIds },
    })
      .populate("agentUser", "name email")
      .sort({ callDate: -1 });

    if (!recording) {
      return res.json({ success: true, data: null });
    }

    res.json({ success: true, data: recording });
  } catch (error) {
    console.error("Error fetching phone summary:", error);
    res.status(500).json({
      message: "Failed to fetch phone summary",
      error: error.message,
    });
  }
};

// @desc    Link recording to lead/callback
// @route   PUT /api/call-intelligence/:id/link
// @access  Private (admin/super-admin)
exports.linkToEntity = async (req, res) => {
  try {
    if (
      req.user.role !== "super-admin" &&
      req.user.role !== "admin"
    ) {
      return res.status(403).json({
        message: "Only admins can link recordings to entities.",
      });
    }

    const { linkedLead, linkedCallback } = req.body;

    const recording = await CallRecording.findById(req.params.id);
    if (!recording) {
      return res.status(404).json({ message: "Call recording not found" });
    }

    if (linkedLead !== undefined) recording.linkedLead = linkedLead || null;
    if (linkedCallback !== undefined) recording.linkedCallback = linkedCallback || null;

    await recording.save();

    const updated = await CallRecording.findById(recording._id)
      .populate("agentUser", "name email")
      .populate("linkedLead", "leadId clientName businessName")
      .populate("linkedCallback", "callbackId callbackDate");

    res.json({
      success: true,
      message: "Recording linked successfully",
      data: updated,
    });
  } catch (error) {
    console.error("Error linking recording:", error);
    res.status(500).json({
      message: "Failed to link recording",
      error: error.message,
    });
  }
};

// @desc    Retry failed analysis
// @route   POST /api/call-intelligence/:id/retry-analysis
// @access  Private (admin/super-admin)
exports.retryAnalysis = async (req, res) => {
  try {
    if (
      req.user.role !== "super-admin" &&
      req.user.role !== "admin"
    ) {
      return res.status(403).json({
        message: "Only admins can retry analysis.",
      });
    }

    const recording = await CallRecording.findById(req.params.id);
    if (!recording) {
      return res.status(404).json({ message: "Call recording not found" });
    }

    if (recording.analysisStatus === "Processing") {
      return res.status(400).json({
        message: "Recording is currently being processed.",
      });
    }

    recording.analysisStatus = "Pending";
    await recording.save();

    // Process immediately
    try {
      await callAnalysisService.analyzeRecording(recording._id);
      const updated = await CallRecording.findById(recording._id);
      res.json({
        success: true,
        message: "Analysis completed successfully",
        data: updated,
      });
    } catch (analysisError) {
      res.status(500).json({
        success: false,
        message: "Analysis failed: " + analysisError.message,
      });
    }
  } catch (error) {
    console.error("Error retrying analysis:", error);
    res.status(500).json({
      message: "Failed to retry analysis",
      error: error.message,
    });
  }
};

// @desc    Manually trigger Vicidial sync
// @route   POST /api/call-intelligence/sync
// @access  Private (admin/super-admin)
exports.triggerSync = async (req, res) => {
  try {
    if (
      req.user.role !== "super-admin" &&
      req.user.role !== "admin"
    ) {
      return res.status(403).json({
        message: "Only admins can trigger sync.",
      });
    }

    if (!vicidialService.isConfigured()) {
      return res.status(400).json({
        message: "Vicidial is not configured. Please set VICIDIAL_SERVER_URL, VICIDIAL_API_USER, and VICIDIAL_API_PASS environment variables.",
      });
    }

    const result = await vicidialService.syncRecordings();

    res.json({
      success: true,
      message: `Sync completed: ${result.synced} synced, ${result.skipped} skipped, ${result.errors} errors`,
      data: result,
    });
  } catch (error) {
    console.error("Error triggering sync:", error);
    res.status(500).json({
      message: "Failed to trigger sync",
      error: error.message,
    });
  }
};
