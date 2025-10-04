const Callback = require("../models/Callback");
const Lead = require("../models/Lead");
const User = require("../models/User");

// Helper function to check if user has access to Callback Management
const canAccessCallbackManagement = (user) => {
  return user.role === "super-admin" || user.department === "marketingAndSales";
};

// @desc    Create a new callback
// @route   POST /api/callbacks
// @access  Private (Super-admin and Marketing & Sales employees for their leads)
exports.createCallback = async (req, res) => {
  try {
    // Check access permissions
    if (!canAccessCallbackManagement(req.user)) {
      return res.status(403).json({
        message: "Access denied. Callback management is only available to Super Admin and Marketing & Sales department."
      });
    }

    const {
      leadId,
      callbackDate,
      callbackTime,
      callbackType,
      status,
      assignedTo,
      remarks,
      priority,
    } = req.body;

    // Validate required fields
    if (!leadId || !callbackDate || !callbackTime) {
      return res.status(400).json({
        message: "Please provide leadId, callbackDate, and callbackTime",
      });
    }

    // Fetch lead details
    const lead = await Lead.findById(leadId);
    if (!lead) {
      return res.status(404).json({ message: "Lead not found" });
    }

    // Check if user has access to this lead
    if (req.user.role !== "super-admin" && lead.assignedTo.toString() !== req.user._id.toString()) {
      return res.status(403).json({ message: "Access denied. You can only create callbacks for your assigned leads." });
    }

    // Determine who the callback should be assigned to
    let assignedToUser = assignedTo;
    if (!assignedToUser) {
      // If not specified, assign to current user (for employees) or lead's assigned user (for super-admin)
      assignedToUser = req.user.role === "super-admin" ? lead.assignedTo : req.user._id;
    } else if (req.user.role !== "super-admin") {
      // Non-super-admin users can only assign to themselves
      if (assignedTo !== req.user._id.toString()) {
        return res.status(403).json({ message: "You can only assign callbacks to yourself. Super Admin can assign to anyone." });
      }
    } else {
      // Super-admin: Validate assignedTo user exists
      const userExists = await User.findById(assignedToUser);
      if (!userExists) {
        return res.status(404).json({ message: "Assigned user not found" });
      }
    }

    // Create callback
    const callback = await Callback.create({
      leadId: lead._id,
      clientName: lead.clientName,
      businessName: lead.businessName,
      callbackDate,
      callbackTime,
      callbackType,
      status: status || "Pending",
      assignedTo: assignedToUser,
      assignedBy: req.user._id,
      remarks,
      priority: priority || lead.priority || "Medium",
    });

    // Update lead's next follow-up date
    await Lead.findByIdAndUpdate(leadId, {
      nextFollowUpDate: callbackDate,
    });

    const populatedCallback = await Callback.findById(callback._id)
      .populate("leadId", "leadId clientName businessName email phone")
      .populate("assignedTo", "name email employeeId")
      .populate("assignedBy", "name email employeeId");

    res.status(201).json({
      success: true,
      message: "Callback created successfully",
      data: populatedCallback,
    });
  } catch (error) {
    console.error("Error creating callback:", error);
    res.status(500).json({
      message: "Failed to create callback",
      error: error.message,
    });
  }
};

// @desc    Get all callbacks (with role-based filtering)
// @route   GET /api/callbacks
// @access  Private (Super-admin and Marketing & Sales)
exports.getCallbacks = async (req, res) => {
  try {
    // Check access permissions
    if (!canAccessCallbackManagement(req.user)) {
      return res.status(403).json({
        message: "Access denied. Callback management is only available to Super Admin and Marketing & Sales department."
      });
    }

    const {
      status,
      callbackType,
      search,
      assignedTo,
      leadId,
      startDate,
      endDate,
      page = 1,
      limit = 10,
    } = req.query;

    // Build filter
    const filter = {};

    // Filter by leadId if provided (for lookup functionality)
    if (leadId) {
      filter.leadId = leadId;
    }

    // Role-based filtering
    if (req.user.role !== "super-admin") {
      // Non-super-admin users can only see their assigned callbacks
      filter.assignedTo = req.user._id;
    } else if (assignedTo) {
      // Super-admins can filter by assignedTo
      filter.assignedTo = assignedTo;
    }

    // Additional filters
    if (status) filter.status = status;
    if (callbackType) filter.callbackType = callbackType;

    // Date range filter
    if (startDate || endDate) {
      filter.callbackDate = {};
      if (startDate) filter.callbackDate.$gte = new Date(startDate);
      if (endDate) filter.callbackDate.$lte = new Date(endDate);
    }

    // Search functionality
    if (search) {
      filter.$or = [
        { clientName: { $regex: search, $options: "i" } },
        { businessName: { $regex: search, $options: "i" } },
        { callbackId: { $regex: search, $options: "i" } },
      ];
    }

    // Pagination
    const skip = (page - 1) * limit;

    const callbacks = await Callback.find(filter)
      .populate("leadId", "leadId clientName businessName email phone status")
      .populate("assignedTo", "name email employeeId")
      .populate("assignedBy", "name email employeeId")
      .sort({ callbackDate: 1, callbackTime: 1 })
      .skip(skip)
      .limit(parseInt(limit));

    const total = await Callback.countDocuments(filter);

    res.json({
      success: true,
      data: callbacks,
      pagination: {
        total,
        page: parseInt(page),
        pages: Math.ceil(total / limit),
        limit: parseInt(limit),
      },
    });
  } catch (error) {
    console.error("Error fetching callbacks:", error);
    res.status(500).json({
      message: "Failed to fetch callbacks",
      error: error.message,
    });
  }
};

// @desc    Get single callback by ID
// @route   GET /api/callbacks/:id
// @access  Private (Super-admin and Marketing & Sales)
exports.getCallbackById = async (req, res) => {
  try {
    // Check access permissions
    if (!canAccessCallbackManagement(req.user)) {
      return res.status(403).json({
        message: "Access denied. Callback management is only available to Super Admin and Marketing & Sales department."
      });
    }

    const callback = await Callback.findById(req.params.id)
      .populate("leadId")
      .populate("assignedTo", "name email employeeId department")
      .populate("assignedBy", "name email employeeId")
      .populate("completedBy", "name email employeeId");

    if (!callback) {
      return res.status(404).json({ message: "Callback not found" });
    }

    // Check access permissions
    if (
      req.user.role !== "super-admin" &&
      callback.assignedTo._id.toString() !== req.user._id.toString()
    ) {
      return res.status(403).json({ message: "Access denied. You can only view your assigned callbacks." });
    }

    res.json({
      success: true,
      data: callback,
    });
  } catch (error) {
    console.error("Error fetching callback:", error);
    res.status(500).json({
      message: "Failed to fetch callback",
      error: error.message,
    });
  }
};

// @desc    Update callback
// @route   PUT /api/callbacks/:id
// @access  Private (Super-admin and assigned employee)
exports.updateCallback = async (req, res) => {
  try {
    // Check access permissions
    if (!canAccessCallbackManagement(req.user)) {
      return res.status(403).json({
        message: "Access denied. Callback management is only available to Super Admin and Marketing & Sales department."
      });
    }

    let callback = await Callback.findById(req.params.id);

    if (!callback) {
      return res.status(404).json({ message: "Callback not found" });
    }

    // Check permissions
    const isAssigned = callback.assignedTo.toString() === req.user._id.toString();
    const isSuperAdmin = req.user.role === "super-admin";

    if (!isAssigned && !isSuperAdmin) {
      return res.status(403).json({ message: "Access denied. You can only edit your assigned callbacks." });
    }

    // Non-super-admin cannot reassign callbacks to others
    if (!isSuperAdmin && req.body.assignedTo && req.body.assignedTo !== req.user._id.toString()) {
      return res.status(403).json({ message: "You cannot reassign callbacks. Only Super Admin can reassign." });
    }

    // Track rescheduling
    if (req.body.callbackDate && req.body.callbackDate !== callback.callbackDate.toISOString()) {
      req.body.rescheduledFrom = callback.callbackDate;
      req.body.rescheduledCount = (callback.rescheduledCount || 0) + 1;
      if (callback.status !== "Rescheduled") {
        req.body.status = "Rescheduled";
      }
    }

    // Track completion
    if (req.body.status === "Completed" && callback.status !== "Completed") {
      req.body.completedDate = new Date();
      req.body.completedBy = req.user._id;

      // Update lead's last contacted date
      await Lead.findByIdAndUpdate(callback.leadId, {
        lastContactedDate: new Date(),
      });
    }

    callback = await Callback.findByIdAndUpdate(req.params.id, req.body, {
      new: true,
      runValidators: true,
    })
      .populate("leadId", "leadId clientName businessName")
      .populate("assignedTo", "name email employeeId")
      .populate("assignedBy", "name email employeeId")
      .populate("completedBy", "name email employeeId");

    res.json({
      success: true,
      message: "Callback updated successfully",
      data: callback,
    });
  } catch (error) {
    console.error("Error updating callback:", error);
    res.status(500).json({
      message: "Failed to update callback",
      error: error.message,
    });
  }
};

// @desc    Delete callback
// @route   DELETE /api/callbacks/:id
// @access  Private (Super-admin only)
exports.deleteCallback = async (req, res) => {
  try {
    // Check access permissions
    if (!canAccessCallbackManagement(req.user)) {
      return res.status(403).json({
        message: "Access denied. Callback management is only available to Super Admin and Marketing & Sales department."
      });
    }

    const callback = await Callback.findById(req.params.id);

    if (!callback) {
      return res.status(404).json({ message: "Callback not found" });
    }

    // Only super-admin can delete
    if (req.user.role !== "super-admin") {
      return res.status(403).json({ message: "Access denied. Only Super Admin can delete callbacks." });
    }

    await callback.deleteOne();

    res.json({
      success: true,
      message: "Callback deleted successfully",
    });
  } catch (error) {
    console.error("Error deleting callback:", error);
    res.status(500).json({
      message: "Failed to delete callback",
      error: error.message,
    });
  }
};

// @desc    Get callback statistics
// @route   GET /api/callbacks/stats
// @access  Private (Super-admin and Marketing & Sales)
exports.getCallbackStats = async (req, res) => {
  try {
    // Check access permissions
    if (!canAccessCallbackManagement(req.user)) {
      return res.status(403).json({
        message: "Access denied. Callback management is only available to Super Admin and Marketing & Sales department."
      });
    }

    const filter = {};

    // Filter by user role
    if (req.user.role !== "super-admin") {
      filter.assignedTo = req.user._id;
    }

    const stats = await Callback.aggregate([
      { $match: filter },
      {
        $group: {
          _id: "$status",
          count: { $sum: 1 },
        },
      },
    ]);

    const totalCallbacks = await Callback.countDocuments(filter);
    const pendingCallbacks = await Callback.countDocuments({ ...filter, status: "Pending" });
    const completedCallbacks = await Callback.countDocuments({ ...filter, status: "Completed" });

    // Get overdue callbacks
    const now = new Date();
    const overdueCallbacks = await Callback.countDocuments({
      ...filter,
      status: { $in: ["Pending", "Rescheduled"] },
      callbackDate: { $lt: now },
    });

    // Get today's callbacks
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const tomorrow = new Date(today);
    tomorrow.setDate(tomorrow.getDate() + 1);

    const todayCallbacks = await Callback.countDocuments({
      ...filter,
      callbackDate: { $gte: today, $lt: tomorrow },
    });

    res.json({
      success: true,
      data: {
        totalCallbacks,
        pendingCallbacks,
        completedCallbacks,
        overdueCallbacks,
        todayCallbacks,
        completionRate: totalCallbacks > 0 ? ((completedCallbacks / totalCallbacks) * 100).toFixed(2) : 0,
        byStatus: stats,
      },
    });
  } catch (error) {
    console.error("Error fetching callback stats:", error);
    res.status(500).json({
      message: "Failed to fetch callback statistics",
      error: error.message,
    });
  }
};

// @desc    Get callbacks for a specific lead
// @route   GET /api/callbacks/lead/:leadId
// @access  Private (Super-admin and Marketing & Sales)
exports.getCallbacksByLead = async (req, res) => {
  try {
    // Check access permissions
    if (!canAccessCallbackManagement(req.user)) {
      return res.status(403).json({
        message: "Access denied. Callback management is only available to Super Admin and Marketing & Sales department."
      });
    }

    const { leadId } = req.params;

    // Check if lead exists
    const lead = await Lead.findById(leadId);
    if (!lead) {
      return res.status(404).json({ message: "Lead not found" });
    }

    // Check access permissions
    if (
      req.user.role !== "super-admin" &&
      lead.assignedTo.toString() !== req.user._id.toString()
    ) {
      return res.status(403).json({ message: "Access denied. You can only view callbacks for your assigned leads." });
    }

    const callbacks = await Callback.find({ leadId })
      .populate("assignedTo", "name email employeeId")
      .populate("assignedBy", "name email employeeId")
      .populate("completedBy", "name email employeeId")
      .sort({ callbackDate: -1 });

    res.json({
      success: true,
      data: callbacks,
    });
  } catch (error) {
    console.error("Error fetching callbacks for lead:", error);
    res.status(500).json({
      message: "Failed to fetch callbacks for lead",
      error: error.message,
    });
  }
};