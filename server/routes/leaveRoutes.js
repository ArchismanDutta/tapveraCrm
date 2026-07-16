const express = require("express");
const router = express.Router();
const leaveController = require("../controllers/leaveController");
const { protect, authorize } = require("../middlewares/authMiddleware");
const upload = require("../middlewares/upload");
// Access-management rework (2026-07-03) - Phase 4.4.
// See docs/superpowers/plans/2026-07-03-access-management-rework.md
const { can } = require("../utils/accessControl");

// Additive: admin/super-admin/hr keep exactly what they had (authorize(...)
// below is left in place). Adds an alternative path for anyone whose
// Position is explicitly granted "canApproveLeaves" (HR by default - see
// seedCanonicalHierarchy.js).
const requireLeaveApprove = async (req, res, next) => {
  if (await can(req.user, "leaves:approve")) return next();
  return authorize("admin", "super-admin", "hr")(req, res, next);
};

// Employee routes
router.post(
  "/",
  protect,
  authorize("employee", "admin", "super-admin", "hr"),
  upload.single("document"),
  leaveController.createLeave
);
router.get(
  "/mine",
  protect,
  authorize("employee", "admin", "super-admin", "hr"),
  leaveController.getUserLeaves
);
router.get("/team", protect, authorize("employee", "admin", "super-admin", "hr"), leaveController.getTeamLeaves);
router.put(
  "/:id",
  protect,
  authorize("employee", "admin", "super-admin", "hr"),
  upload.single("document"),
  leaveController.updateLeave
);

// Admin routes
router.get("/", protect, requireLeaveApprove, leaveController.getAllLeaves);
router.get("/employee/:employeeId", protect, requireLeaveApprove, leaveController.getEmployeeLeaves);
router.patch("/:id", protect, requireLeaveApprove, leaveController.updateLeaveStatus);

// Delete leave request
router.delete("/:id", protect, leaveController.deleteLeave);

module.exports = router;
