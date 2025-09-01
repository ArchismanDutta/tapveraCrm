// File: routes/flexibleShiftRoutes.js

const express = require("express");
const router = express.Router();
const {
  getFlexibleShiftRequests,
  createFlexibleShiftRequest,
  updateFlexibleShiftStatus,
  getEmployeeFlexibleRequests,
} = require("../controllers/flexibleShiftController");

const { protect, authorize } = require("../middlewares/authMiddleware");

// ======================
// Flexible Shift Routes
// ======================

// HR/Admin: Fetch all flexible shift requests
// GET /api/flexible-shifts
router.get(
  "/",
  protect,
  authorize("hr", "admin"),
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
  authorize("hr", "admin"),
  updateFlexibleShiftStatus
);

module.exports = router;
