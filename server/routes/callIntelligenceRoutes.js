const express = require("express");
const router = express.Router();
const { protect } = require("../middlewares/authMiddleware");
const {
  getCallRecordings,
  getCallRecordingById,
  getCallRecordingStats,
  getRecordingsForLead,
  getRecordingsForCallback,
  getRecentSummaryForPhone,
  linkToEntity,
  retryAnalysis,
  triggerSync,
} = require("../controllers/callIntelligenceController");

// Apply authentication middleware to all routes
router.use(protect);

// Static routes (must be before /:id)
router.get("/stats", getCallRecordingStats);
router.get("/lead/:leadId", getRecordingsForLead);
router.get("/callback/:callbackId", getRecordingsForCallback);
router.get("/phone-summary/:phoneNumber", getRecentSummaryForPhone);
router.post("/sync", triggerSync);

// Main routes
router.route("/").get(getCallRecordings);
router.route("/:id").get(getCallRecordingById);
router.put("/:id/link", linkToEntity);
router.post("/:id/retry-analysis", retryAnalysis);

module.exports = router;
