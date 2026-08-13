const express = require("express");
const router = express.Router();
const { protect } = require("../middlewares/authMiddleware");
const {
  createCallback,
  getCallbacks,
  getCallbackById,
  updateCallback,
  deleteCallback,
  getCallbackStats,
  getCallbacksByLead,
} = require("../controllers/callbackController");
const callbackAlarms = require("../services/callbackAlarmService");

// Apply authentication middleware to all routes
router.use(protect);

// ── Alarms ────────────────────────────────────────────────────────────────
//
// Mounted above `/:id` — Express matches in declaration order, so "/alarms"
// registered later would be swallowed by "/:id" and arrive as a lookup for a
// callback whose id is the literal string "alarms".
//
// Polled by the client rather than pushed over the socket. See
// services/callbackAlarmService.js for why an alarm must be derived from
// state instead of fired as an event.
router.get("/alarms", async (req, res) => {
  try {
    res.json(await callbackAlarms.getActiveAlarms(req.user._id));
  } catch (error) {
    console.error("Error loading callback alarms:", error);
    res.status(500).json({ message: "Failed to load alarms" });
  }
});

router.post("/:id/snooze", async (req, res) => {
  try {
    res.json(await callbackAlarms.snooze(req.user._id, req.params.id, req.body?.minutes));
  } catch (error) {
    if (error?.statusCode) {
      return res.status(error.statusCode).json({ message: error.message });
    }
    console.error("Error snoozing callback:", error);
    res.status(500).json({ message: "Failed to snooze" });
  }
});

router.post("/:id/dismiss-alarm", async (req, res) => {
  try {
    res.json(await callbackAlarms.dismiss(req.user._id, req.params.id));
  } catch (error) {
    if (error?.statusCode) {
      return res.status(error.statusCode).json({ message: error.message });
    }
    console.error("Error dismissing callback alarm:", error);
    res.status(500).json({ message: "Failed to dismiss" });
  }
});

// Marks the 5-minute heads-up as shown so it fires once rather than on every
// poll for the whole five minutes.
router.post("/alarms/heads-up-shown", async (req, res) => {
  try {
    const ids = Array.isArray(req.body?.callbackIds) ? req.body.callbackIds : [];
    res.json(await callbackAlarms.markHeadsUpShown(req.user._id, ids));
  } catch (error) {
    console.error("Error marking heads-up shown:", error);
    res.status(500).json({ message: "Failed to update reminder state" });
  }
});

// Statistics route (must be before /:id route)
router.get("/stats", getCallbackStats);

// Get callbacks for a specific lead
router.get("/lead/:leadId", getCallbacksByLead);

// Main CRUD routes
router.route("/")
  .get(getCallbacks)
  .post(createCallback);

router.route("/:id")
  .get(getCallbackById)
  .put(updateCallback)
  .delete(deleteCallback);

module.exports = router;
