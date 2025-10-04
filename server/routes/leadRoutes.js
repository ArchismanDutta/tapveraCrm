const express = require("express");
const router = express.Router();
const { protect } = require("../middlewares/authMiddleware");
const {
  createLead,
  getLeads,
  getLeadById,
  updateLead,
  deleteLead,
  getLeadStats,
  lookupLead,
} = require("../controllers/leadController");

// Apply authentication middleware to all routes
router.use(protect);

// Statistics route (must be before /:id route)
router.get("/stats", getLeadStats);

// Lookup route (must be before /:id route)
router.get("/lookup", lookupLead);

// Main CRUD routes
router.route("/")
  .get(getLeads)
  .post(createLead);

router.route("/:id")
  .get(getLeadById)
  .put(updateLead)
  .delete(deleteLead);

module.exports = router;
