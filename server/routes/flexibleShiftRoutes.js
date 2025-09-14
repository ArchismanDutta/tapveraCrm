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

// ======================
// Flexible Shift Routes
// ======================

// HR/Admin: Fetch all flexible shift requests with optional filters
// GET /api/flexible-shifts?status=pending&startDate=2024-01-01&endDate=2024-01-31
router.get(
  "/",
  protect,
  authorize("hr", "admin", "super-admin"),
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
  authorize("hr", "admin", "super-admin"),
  updateFlexibleShiftStatus
);

// Employee/HR/Admin: Delete a flexible shift request
// DELETE /api/flexible-shifts/:requestId
router.delete("/:requestId", protect, deleteFlexibleShiftRequest);

module.exports = router;