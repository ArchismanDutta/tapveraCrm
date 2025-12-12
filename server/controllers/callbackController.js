const Callback = require("../models/Callback");
const Lead = require("../models/Lead");
const User = require("../models/User");
const Position = require("../models/Position");
const {
  getAccessibleUserIds,
  canAccessUserData,
  hasPermission
} = require("../utils/hierarchyUtils");

// Helper function to check if user has access to Callback Management
const canAccessCallbackManagement = async (user) => {
  // Super-admin and admin always have access
  if (user.role === "super-admin" || user.role === "admin") {
    return true;
  }

  // Marketing & Sales department has access
  if (user.department === "marketingAndSales") {
    return true;
  }

  // Check if user has a position with callback management permissions
  if (user.position && user.position.trim() !== "") {
    try {
      const position = await Position.findOne({
        name: user.position,
        status: "active"
      });

      if (position) {
        // If user has any callback-related permissions, grant access
        if (
          position.permissions?.canViewSubordinateCallbacks ||
          position.permissions?.canEditSubordinateCallbacks ||
          position.permissions?.canViewDepartmentCallbacks
        ) {
          return true;
        }
      }
    } catch (error) {
      console.error("Error checking position permissions:", error);
    }
  }

  return false;
};

// @desc    Create a new callback
// @route   POST /api/callbacks
// @access  Private (Super-admin and Marketing & Sales employees for their leads)
exports.createCallback = async (req, res) => {
  try {
    // Check access permissions
    if (!(await canAccessCallbackManagement(req.user))) {
      return res.status(403).json({
        message: "Access denied. Callback management is only available to Super Admin, Marketing & Sales department, or users with callback management permissions."
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

    // Check hierarchical access to this lead
    const canAccessLead = await canAccessUserData(req.user, lead.assignedTo);
    if (!canAccessLead) {
      return res.status(403).json({
        message: "Access denied. You can only create callbacks for leads assigned to you or your subordinates."
      });
    }

    // Determine who the callback should be assigned to
    let assignedToUser = assignedTo;
    const isSuperAdmin = req.user.role === "super-admin" || req.user.role === "admin";

    if (!assignedToUser) {
      // If not specified, assign to lead's assigned user
      assignedToUser = lead.assignedTo;
    } else {
      // Validate assignedTo user exists
      const userExists = await User.findById(assignedToUser);
      if (!userExists) {
        return res.status(404).json({ message: "Assigned user not found" });
      }

      // Check if user can assign to this target user
      if (assignedToUser.toString() !== req.user._id.toString()) {
        const canAssignToSubordinates = await hasPermission(req.user, "canAssignToSubordinates");

        if (!isSuperAdmin && !canAssignToSubordinates) {
          return res.status(403).json({
            message: "You can only assign callbacks to yourself. Supervisors and admins can assign to subordinates."
          });
        }

        // Check if target user is accessible
        const canAccessTarget = await canAccessUserData(req.user, assignedToUser);
        if (!canAccessTarget && !isSuperAdmin) {
          return res.status(403).json({
            message: "You can only assign callbacks to yourself or your subordinates."
          });
        }
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
    if (!(await canAccessCallbackManagement(req.user))) {
      return res.status(403).json({
        message: "Access denied. Callback management is only available to Super Admin, Marketing & Sales department, or users with callback management permissions."
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

    // Hierarchical access control
    const accessibleUserIds = await getAccessibleUserIds(req.user);

    // Apply hierarchical filtering
    if (assignedTo) {
      // If specific user requested, check if current user can access them
      const canAccess = await canAccessUserData(req.user, assignedTo);
      if (!canAccess) {
        return res.status(403).json({
          message: "You don't have permission to view callbacks for this user"
        });
      }
      filter.assignedTo = assignedTo;
    } else {
      // Show callbacks for all accessible users (self + subordinates based on position)
      filter.assignedTo = { $in: accessibleUserIds };
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
      .populate("assignedTo", "name email employeeId position")
      .populate("assignedBy", "name email employeeId")
      .populate("transferredTo", "name email employeeId position")
      .populate("transferredBy", "name email employeeId")
      .populate("transferCompletedBy", "name email employeeId")
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
    if (!(await canAccessCallbackManagement(req.user))) {
      return res.status(403).json({
        message: "Access denied. Callback management is only available to Super Admin, Marketing & Sales department, or users with callback management permissions."
      });
    }

    const callback = await Callback.findById(req.params.id)
      .populate("leadId")
      .populate("assignedTo", "name email employeeId department position")
      .populate("assignedBy", "name email employeeId")
      .populate("completedBy", "name email employeeId")
      .populate("transferredTo", "name email employeeId position")
      .populate("transferredBy", "name email employeeId")
      .populate("transferCompletedBy", "name email employeeId");

    if (!callback) {
      return res.status(404).json({ message: "Callback not found" });
    }

    // Check hierarchical access permissions
    const canAccess = await canAccessUserData(req.user, callback.assignedTo._id);
    if (!canAccess) {
      return res.status(403).json({
        message: "Access denied. You can only view callbacks assigned to you or your subordinates."
      });
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
    if (!(await canAccessCallbackManagement(req.user))) {
      return res.status(403).json({
        message: "Access denied. Callback management is only available to Super Admin, Marketing & Sales department, or users with callback management permissions."
      });
    }

    let callback = await Callback.findById(req.params.id);

    if (!callback) {
      return res.status(404).json({ message: "Callback not found" });
    }

    // Check hierarchical access permissions
    const canAccess = await canAccessUserData(req.user, callback.assignedTo);
    if (!canAccess) {
      return res.status(403).json({
        message: "Access denied. You can only edit callbacks assigned to you or your subordinates."
      });
    }

    // Check if user can edit subordinate callbacks
    const isOwnCallback = callback.assignedTo.toString() === req.user._id.toString();
    const canEditSubordinate = await hasPermission(req.user, "canEditSubordinateCallbacks");
    const isSuperAdmin = req.user.role === "super-admin" || req.user.role === "admin";

    if (!isOwnCallback && !canEditSubordinate && !isSuperAdmin) {
      return res.status(403).json({
        message: "You don't have permission to edit subordinate callbacks. Contact your supervisor."
      });
    }

    // Check if user can reassign callbacks
    if (req.body.assignedTo && req.body.assignedTo !== callback.assignedTo.toString()) {
      const canAssignToSubordinates = await hasPermission(req.user, "canAssignToSubordinates");

      if (!isSuperAdmin && !canAssignToSubordinates) {
        return res.status(403).json({
          message: "You don't have permission to reassign callbacks. Only supervisors and admins can reassign."
        });
      }

      // If user can reassign, check if target user is accessible
      const canAccessTarget = await canAccessUserData(req.user, req.body.assignedTo);
      if (!canAccessTarget) {
        return res.status(403).json({
          message: "You can only reassign callbacks to yourself or your subordinates."
        });
      }
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
    if (!(await canAccessCallbackManagement(req.user))) {
      return res.status(403).json({
        message: "Access denied. Callback management is only available to Super Admin, Marketing & Sales department, or users with callback management permissions."
      });
    }

    const callback = await Callback.findById(req.params.id);

    if (!callback) {
      return res.status(404).json({ message: "Callback not found" });
    }

    // Only super-admin can delete
    if (req.user.role !== "super-admin" && req.user.role !== "admin") {
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
    if (!(await canAccessCallbackManagement(req.user))) {
      return res.status(403).json({
        message: "Access denied. Callback management is only available to Super Admin, Marketing & Sales department, or users with callback management permissions."
      });
    }

    // Hierarchical access control for stats
    const accessibleUserIds = await getAccessibleUserIds(req.user);
    const filter = {
      assignedTo: { $in: accessibleUserIds }
    };

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
    if (!(await canAccessCallbackManagement(req.user))) {
      return res.status(403).json({
        message: "Access denied. Callback management is only available to Super Admin, Marketing & Sales department, or users with callback management permissions."
      });
    }

    const { leadId } = req.params;

    // Check if lead exists
    const lead = await Lead.findById(leadId);
    if (!lead) {
      return res.status(404).json({ message: "Lead not found" });
    }

    // Check hierarchical access to this lead
    const canAccessLead = await canAccessUserData(req.user, lead.assignedTo);
    if (!canAccessLead) {
      return res.status(403).json({
        message: "Access denied. You can only view callbacks for leads assigned to you or your subordinates."
      });
    }

    const callbacks = await Callback.find({ leadId })
      .populate("assignedTo", "name email employeeId position")
      .populate("assignedBy", "name email employeeId")
      .populate("completedBy", "name email employeeId")
      .populate("transferredTo", "name email employeeId position")
      .populate("transferredBy", "name email employeeId")
      .populate("transferCompletedBy", "name email employeeId")
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