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

// Apply authentication middleware to all routes
router.use(protect);

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
