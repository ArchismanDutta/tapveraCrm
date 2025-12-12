const express = require("express");
const router = express.Router();
const { protect, authorize } = require("../middlewares/authMiddleware");
const {
  transferCallback,
  getMyTransfers,
  updateTransferStatus,
  getAllTransfers,
  cancelTransfer,
} = require("../controllers/transferController");

// @route   POST /api/transfers/callback/:callbackId
// @desc    Transfer a callback to supervisor/team lead
// @access  Private (Web Consultants, Supervisors)
router.post("/callback/:callbackId", protect, transferCallback);

// @route   GET /api/transfers/my-transfers
// @desc    Get all transfers for logged-in supervisor/team lead
// @access  Private (Supervisors, Team Leads)
router.get("/my-transfers", protect, getMyTransfers);

// @route   PUT /api/transfers/:transferId/status
// @desc    Update transfer status and add remarks
// @access  Private (Supervisors, Team Leads)
router.put("/:transferId/status", protect, updateTransferStatus);

// @route   GET /api/transfers/all
// @desc    Get all transfers with statistics
// @access  Private (Super Admin only)
router.get("/all", protect, authorize("super-admin"), getAllTransfers);

// @route   PUT /api/transfers/:transferId/cancel
// @desc    Cancel a transfer
// @access  Private (Person who initiated the transfer)
router.put("/:transferId/cancel", protect, cancelTransfer);

module.exports = router;
