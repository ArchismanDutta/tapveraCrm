const Callback = require("../models/Callback");
const User = require("../models/User");

/**
 * Transfer a callback to supervisor or team lead
 * POST /api/transfers/callback/:callbackId
 */
exports.transferCallback = async (req, res) => {
  try {
    const { callbackId } = req.params;
    const { transferredTo } = req.body;
    const transferredBy = req.user._id;

    // Validate callback exists
    const callback = await Callback.findById(callbackId);
    if (!callback) {
      return res.status(404).json({ success: false, message: "Callback not found" });
    }

    // Verify user can transfer (must be assigned to them)
    if (callback.assignedTo.toString() !== transferredBy.toString()) {
      return res.status(403).json({
        success: false,
        message: "You can only transfer callbacks assigned to you"
      });
    }

    // Validate transferredTo user exists and has supervisor/team lead role
    const targetUser = await User.findById(transferredTo);
    if (!targetUser) {
      return res.status(404).json({ success: false, message: "Target user not found" });
    }

    // Check if target user is supervisor or team lead
    const validPositions = ["supervisor", "team lead", "manager"];
    const hasValidPosition = targetUser.position &&
      validPositions.some(pos => targetUser.position.toLowerCase().includes(pos));

    if (!hasValidPosition) {
      return res.status(400).json({
        success: false,
        message: "Can only transfer to Supervisor or Team Lead"
      });
    }

    // Update callback with transfer info
    callback.transferStatus = "Transferred";
    callback.transferredTo = transferredTo;
    callback.transferredBy = transferredBy;
    callback.transferredAt = new Date();

    await callback.save();

    console.log(`Callback ${callbackId} transferred from ${transferredBy} to ${transferredTo}`);

    // Populate for response
    await callback.populate("transferredTo", "name employeeId position");
    await callback.populate("transferredBy", "name employeeId position");

    res.status(200).json({
      success: true,
      message: "Callback transferred successfully",
      data: callback,
    });
  } catch (error) {
    console.error("Transfer callback error:", error);
    res.status(500).json({
      success: false,
      message: "Error transferring callback",
      error: error.message
    });
  }
};

/**
 * Get all transfers for logged-in supervisor/team lead
 * GET /api/transfers/my-transfers
 */
exports.getMyTransfers = async (req, res) => {
  try {
    const userId = req.user._id;

    console.log("Fetching transfers for user:", userId);

    // Find all callbacks transferred to this user
    const transfers = await Callback.find({
      transferredTo: userId,
      transferStatus: { $ne: "Not Transferred" }
    })
      .populate("leadId", "leadId clientName businessName email phone")
      .populate("assignedTo", "name employeeId position")
      .populate("transferredBy", "name employeeId position department")
      .populate("transferredTo", "name employeeId position")
      .sort({ transferredAt: -1 });

    console.log(`Found ${transfers.length} transfers`);

    res.status(200).json({
      success: true,
      count: transfers.length,
      data: transfers,
    });
  } catch (error) {
    console.error("Get my transfers error:", error);
    res.status(500).json({
      success: false,
      message: "Error fetching transfers",
      error: error.message
    });
  }
};

/**
 * Update transfer status and add remarks
 * PUT /api/transfers/:transferId/status
 */
exports.updateTransferStatus = async (req, res) => {
  try {
    const { transferId } = req.params;
    const { transferStatus, transferRemarks } = req.body;
    const userId = req.user._id;

    const callback = await Callback.findById(transferId);
    if (!callback) {
      return res.status(404).json({ success: false, message: "Transfer not found" });
    }

    // Verify user is the recipient of the transfer
    if (callback.transferredTo.toString() !== userId.toString()) {
      return res.status(403).json({
        success: false,
        message: "You can only update transfers assigned to you"
      });
    }

    // Update status and remarks
    callback.transferStatus = transferStatus;
    if (transferRemarks) {
      callback.transferRemarks = transferRemarks;
    }

    if (transferStatus === "Completed") {
      callback.transferCompletedAt = new Date();
      callback.transferCompletedBy = userId;
    }

    await callback.save();

    // Populate for response
    await callback.populate("transferredTo", "name employeeId position");
    await callback.populate("transferredBy", "name employeeId position");
    await callback.populate("leadId", "leadId clientName businessName");

    res.status(200).json({
      success: true,
      message: "Transfer status updated successfully",
      data: callback,
    });
  } catch (error) {
    console.error("Update transfer status error:", error);
    res.status(500).json({
      success: false,
      message: "Error updating transfer status",
      error: error.message
    });
  }
};

/**
 * Get all transfers (Super Admin only)
 * GET /api/transfers/all
 */
exports.getAllTransfers = async (req, res) => {
  try {
    // Fetch all transferred callbacks
    const transfers = await Callback.find({
      transferStatus: { $ne: "Not Transferred" }
    })
      .populate("leadId", "leadId clientName businessName email phone")
      .populate("assignedTo", "name employeeId position department")
      .populate("transferredBy", "name employeeId position department")
      .populate("transferredTo", "name employeeId position department")
      .populate("transferCompletedBy", "name employeeId")
      .sort({ transferredAt: -1 });

    // Calculate statistics
    const stats = {
      totalTransfers: transfers.length,
      pending: transfers.filter(t => t.transferStatus === "Transferred").length,
      accepted: transfers.filter(t => t.transferStatus === "Accepted").length,
      rejected: transfers.filter(t => t.transferStatus === "Rejected").length,
      completed: transfers.filter(t => t.transferStatus === "Completed").length,
    };

    // Group by transferredBy (who gave transfers)
    const transfersByUser = {};
    transfers.forEach(transfer => {
      const userId = transfer.transferredBy?._id.toString();
      if (userId) {
        if (!transfersByUser[userId]) {
          transfersByUser[userId] = {
            user: transfer.transferredBy,
            count: 0,
            transfers: []
          };
        }
        transfersByUser[userId].count++;
        transfersByUser[userId].transfers.push(transfer);
      }
    });

    // Group by transferredTo (who received transfers)
    const transfersToUser = {};
    transfers.forEach(transfer => {
      const userId = transfer.transferredTo?._id.toString();
      if (userId) {
        if (!transfersToUser[userId]) {
          transfersToUser[userId] = {
            user: transfer.transferredTo,
            count: 0,
            transfers: []
          };
        }
        transfersToUser[userId].count++;
        transfersToUser[userId].transfers.push(transfer);
      }
    });

    res.status(200).json({
      success: true,
      stats,
      data: transfers,
      transfersByUser: Object.values(transfersByUser),
      transfersToUser: Object.values(transfersToUser),
    });
  } catch (error) {
    console.error("Get all transfers error:", error);
    res.status(500).json({
      success: false,
      message: "Error fetching all transfers",
      error: error.message
    });
  }
};

/**
 * Cancel/Remove transfer (return to Not Transferred)
 * PUT /api/transfers/:transferId/cancel
 */
exports.cancelTransfer = async (req, res) => {
  try {
    const { transferId } = req.params;
    const userId = req.user._id;

    const callback = await Callback.findById(transferId);
    if (!callback) {
      return res.status(404).json({ success: false, message: "Callback not found" });
    }

    // Only the person who transferred can cancel
    if (callback.transferredBy.toString() !== userId.toString()) {
      return res.status(403).json({
        success: false,
        message: "Only the person who initiated the transfer can cancel it"
      });
    }

    // Can only cancel if still in Transferred status
    if (callback.transferStatus !== "Transferred") {
      return res.status(400).json({
        success: false,
        message: `Cannot cancel transfer with status: ${callback.transferStatus}`
      });
    }

    // Reset transfer fields
    callback.transferStatus = "Not Transferred";
    callback.transferredTo = undefined;
    callback.transferredBy = undefined;
    callback.transferredAt = undefined;
    callback.transferRemarks = undefined;

    await callback.save();

    res.status(200).json({
      success: true,
      message: "Transfer cancelled successfully",
      data: callback,
    });
  } catch (error) {
    console.error("Cancel transfer error:", error);
    res.status(500).json({
      success: false,
      message: "Error cancelling transfer",
      error: error.message
    });
  }
};
