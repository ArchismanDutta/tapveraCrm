// File: routes/flexibleShiftRoutes.js

const express = require("express");
const router = express.Router();
const {
  getFlexibleShiftRequests,
  createFlexibleShiftRequest,
  updateFlexibleShiftStatus,
  getEmployeeFlexibleRequests,
  deleteFlexibleShiftRequest
} = require("../controllers/flexibleShiftController");

const { protect, authorize } = require("../middlewares/authMiddleware");
// Access-management rework (2026-07-03) - Phase 4.4.
// See docs/superpowers/plans/2026-07-03-access-management-rework.md
const { can } = require("../utils/accessControl");

// Additive: hr/admin/super-admin keep exactly what they had (authorize(...)
// below is left in place). Adds an alternative path for anyone whose
// Position is explicitly granted "canApproveShifts" (HR by default - see
// seedCanonicalHierarchy.js).
const requireShiftApprove = async (req, res, next) => {
  if (await can(req.user, "shifts:approve")) return next();
  return authorize("hr", "admin", "super-admin")(req, res, next);
};

// ======================
// Flexible Shift Routes
// ======================

// HR/Admin: Fetch all flexible shift requests with optional filters
// GET /api/flexible-shifts?status=pending&startDate=2024-01-01&endDate=2024-01-31
router.get(
  "/",
  protect,
  requireShiftApprove,
  getFlexibleShiftRequests
);

// Employee: Fetch their own flexible shift requests
// GET /api/flexible-shifts/my-requests
router.get("/my-requests", protect, getEmployeeFlexibleRequests);

// Employee: Submit a new flexible shift request
// POST /api/flexible-shifts/request
router.post("/request", protect, createFlexibleShiftRequest);

// HR/Admin: Approve or reject a flexible shift request
// PUT /api/flexible-shifts/:requestId/status
router.put(
  "/:requestId/status",
  protect,
  requireShiftApprove,
  updateFlexibleShiftStatus
);

// Employee/HR/Admin: Delete a flexible shift request
// DELETE /api/flexible-shifts/:requestId
router.delete("/:requestId", protect, deleteFlexibleShiftRequest);

module.exports = router;

