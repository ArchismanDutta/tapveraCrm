const Lead = require("../models/Lead");
const User = require("../models/User");
const Position = require("../models/Position");
const {
  getAccessibleUserIds,
  canAccessUserData,
  hasPermission,
  buildHierarchicalQuery
} = require("../utils/hierarchyUtils");

// Helper function to check if user has access to Lead Management
const canAccessLeadManagement = async (user) => {
  // Super-admin and admin always have access
  if (user.role === "super-admin" || user.role === "admin") {
    return true;
  }

  // Marketing & Sales department has access
  if (user.department === "marketingAndSales") {
    return true;
  }

  // Check if user has a position with lead management permissions
  if (user.position && user.position.trim() !== "") {
    try {
      const position = await Position.findOne({
        name: user.position,
        status: "active"
      });

      if (position) {
        // If user has any lead-related permissions, grant access
        if (
          position.permissions?.canViewSubordinateLeads ||
          position.permissions?.canEditSubordinateLeads ||
          position.permissions?.canViewDepartmentLeads
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

// @desc    Create a new lead
// @route   POST /api/leads
// @access  Private (Super-admin and Marketing & Sales employees)
exports.createLead = async (req, res) => {
  try {
    // Check access permissions
    if (!(await canAccessLeadManagement(req.user))) {
      return res.status(403).json({
        message: "Access denied. Lead management is only available to Super Admin, Marketing & Sales department, or users with lead management permissions."
      });
    }

    const {
      clientName,
      businessName,
      email,
      phone,
      alternatePhone,
      source,
      status,
      priority,
      industry,
      expectedRevenue,
      address,
      city,
      state,
      country,
      zipCode,
      assignedTo,
      notes,
      tags,
      nextFollowUpDate,
    } = req.body;

    // Validate required fields
    if (!clientName || !businessName || !email || !phone) {
      return res.status(400).json({
        message: "Please provide all required fields: clientName, businessName, email, phone",
      });
    }

    // Determine who to assign the lead to
    let assignedToUser = assignedTo;
    const isSuperAdmin = req.user.role === "super-admin" || req.user.role === "admin";

    if (!assignedToUser) {
      // If not provided, assign to current user
      assignedToUser = req.user._id;
    } else {
      // Validate assignedTo user exists
      const userExists = await User.findById(assignedToUser);
      if (!userExists) {
        return res.status(404).json({ message: "Assigned user not found" });
      }

      // Check if user can assign to this target user
      if (assignedToUser !== req.user._id.toString()) {
        // Not assigning to self, check permissions
        const canAssignToSubordinates = await hasPermission(req.user, "canAssignToSubordinates");

        if (!isSuperAdmin && !canAssignToSubordinates) {
          return res.status(403).json({
            message: "You can only assign leads to yourself. Supervisors and admins can assign to subordinates."
          });
        }

        // Check if target user is accessible (subordinate or team member)
        const canAccessTarget = await canAccessUserData(req.user, assignedToUser);
        if (!canAccessTarget && !isSuperAdmin) {
          return res.status(403).json({
            message: "You can only assign leads to yourself or your subordinates."
          });
        }
      }
    }

    // Create lead
    const lead = await Lead.create({
      clientName,
      businessName,
      email,
      phone,
      alternatePhone,
      source,
      status,
      priority,
      industry,
      expectedRevenue,
      address,
      city,
      state,
      country,
      zipCode,
      assignedTo: assignedToUser,
      assignedBy: req.user._id,
      notes,
      tags,
      nextFollowUpDate,
    });

    const populatedLead = await Lead.findById(lead._id)
      .populate("assignedTo", "name email employeeId")
      .populate("assignedBy", "name email employeeId");

    res.status(201).json({
      success: true,
      message: "Lead created successfully",
      data: populatedLead,
    });
  } catch (error) {
    console.error("Error creating lead:", error);
    res.status(500).json({
      message: "Failed to create lead",
      error: error.message,
    });
  }
};

// @desc    Get all leads (with role-based filtering)
// @route   GET /api/leads
// @access  Private (Super-admin and Marketing & Sales)
exports.getLeads = async (req, res) => {
  try {
    // Check access permissions
    if (!(await canAccessLeadManagement(req.user))) {
      return res.status(403).json({
        message: "Access denied. Lead management is only available to Super Admin, Marketing & Sales department, or users with lead management permissions."
      });
    }

    const { status, priority, source, search, assignedTo, page = 1, limit = 10 } = req.query;

    // Build filter
    const filter = {};

    // Hierarchical access control
    const accessibleUserIds = await getAccessibleUserIds(req.user);

    // Apply hierarchical filtering
    if (assignedTo) {
      // If specific user requested, check if current user can access them
      const canAccess = await canAccessUserData(req.user, assignedTo);
      if (!canAccess) {
        return res.status(403).json({
          message: "You don't have permission to view leads for this user"
        });
      }
      filter.assignedTo = assignedTo;
    } else {
      // Show leads for all accessible users (self + subordinates based on position)
      filter.assignedTo = { $in: accessibleUserIds };
    }

    // Additional filters
    if (status) filter.status = status;
    if (priority) filter.priority = priority;
    if (source) filter.source = source;

    // Search functionality
    if (search) {
      filter.$or = [
        { clientName: { $regex: search, $options: "i" } },
        { businessName: { $regex: search, $options: "i" } },
        { email: { $regex: search, $options: "i" } },
        { leadId: { $regex: search, $options: "i" } },
      ];
    }

    // Pagination
    const skip = (page - 1) * limit;

    const leads = await Lead.find(filter)
      .populate("assignedTo", "name email employeeId")
      .populate("assignedBy", "name email employeeId")
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(parseInt(limit));

    const total = await Lead.countDocuments(filter);

    res.json({
      success: true,
      data: leads,
      pagination: {
        total,
        page: parseInt(page),
        pages: Math.ceil(total / limit),
        limit: parseInt(limit),
      },
    });
  } catch (error) {
    console.error("Error fetching leads:", error);
    res.status(500).json({
      message: "Failed to fetch leads",
      error: error.message,
    });
  }
};

// @desc    Get single lead by ID
// @route   GET /api/leads/:id
// @access  Private (Super-admin and Marketing & Sales)
exports.getLeadById = async (req, res) => {
  try {
    // Check access permissions
    if (!(await canAccessLeadManagement(req.user))) {
      return res.status(403).json({
        message: "Access denied. Lead management is only available to Super Admin, Marketing & Sales department, or users with lead management permissions."
      });
    }

    const lead = await Lead.findById(req.params.id)
      .populate("assignedTo", "name email employeeId department")
      .populate("assignedBy", "name email employeeId");

    if (!lead) {
      return res.status(404).json({ message: "Lead not found" });
    }

    // Check hierarchical access permissions
    const canAccess = await canAccessUserData(req.user, lead.assignedTo._id);
    if (!canAccess) {
      return res.status(403).json({
        message: "Access denied. You can only view leads assigned to you or your subordinates."
      });
    }

    res.json({
      success: true,
      data: lead,
    });
  } catch (error) {
    console.error("Error fetching lead:", error);
    res.status(500).json({
      message: "Failed to fetch lead",
      error: error.message,
    });
  }
};

// @desc    Update lead
// @route   PUT /api/leads/:id
// @access  Private (Super-admin and assigned employee)
exports.updateLead = async (req, res) => {
  try {
    // Check access permissions
    if (!(await canAccessLeadManagement(req.user))) {
      return res.status(403).json({
        message: "Access denied. Lead management is only available to Super Admin, Marketing & Sales department, or users with lead management permissions."
      });
    }

    let lead = await Lead.findById(req.params.id);

    if (!lead) {
      return res.status(404).json({ message: "Lead not found" });
    }

    // Check hierarchical access permissions
    const canAccess = await canAccessUserData(req.user, lead.assignedTo);
    if (!canAccess) {
      return res.status(403).json({
        message: "Access denied. You can only edit leads assigned to you or your subordinates."
      });
    }

    // Check if user can edit subordinate leads
    const isOwnLead = lead.assignedTo.toString() === req.user._id.toString();
    const canEditSubordinate = await hasPermission(req.user, "canEditSubordinateLeads");
    const isSuperAdmin = req.user.role === "super-admin" || req.user.role === "admin";

    if (!isOwnLead && !canEditSubordinate && !isSuperAdmin) {
      return res.status(403).json({
        message: "You don't have permission to edit subordinate leads. Contact your supervisor."
      });
    }

    // Check if user can reassign leads
    if (req.body.assignedTo && req.body.assignedTo !== lead.assignedTo.toString()) {
      const canAssignToSubordinates = await hasPermission(req.user, "canAssignToSubordinates");

      if (!isSuperAdmin && !canAssignToSubordinates) {
        return res.status(403).json({
          message: "You don't have permission to reassign leads. Only supervisors and admins can reassign."
        });
      }

      // If user can reassign, check if target user is accessible
      const canAccessTarget = await canAccessUserData(req.user, req.body.assignedTo);
      if (!canAccessTarget) {
        return res.status(403).json({
          message: "You can only reassign leads to yourself or your subordinates."
        });
      }
    }

    // Update last contacted date if status changed to contacted
    if (req.body.status === "Contacted" && lead.status !== "Contacted") {
      req.body.lastContactedDate = new Date();
    }

    // Track conversion
    if (req.body.status === "Won" && !lead.convertedToCustomer) {
      req.body.convertedToCustomer = true;
      req.body.convertedDate = new Date();
    }

    lead = await Lead.findByIdAndUpdate(req.params.id, req.body, {
      new: true,
      runValidators: true,
    })
      .populate("assignedTo", "name email employeeId")
      .populate("assignedBy", "name email employeeId");

    res.json({
      success: true,
      message: "Lead updated successfully",
      data: lead,
    });
  } catch (error) {
    console.error("Error updating lead:", error);
    res.status(500).json({
      message: "Failed to update lead",
      error: error.message,
    });
  }
};

// @desc    Delete lead
// @route   DELETE /api/leads/:id
// @access  Private (Super-admin only)
exports.deleteLead = async (req, res) => {
  try {
    // Check access permissions
    if (!(await canAccessLeadManagement(req.user))) {
      return res.status(403).json({
        message: "Access denied. Lead management is only available to Super Admin, Marketing & Sales department, or users with lead management permissions."
      });
    }

    const lead = await Lead.findById(req.params.id);

    if (!lead) {
      return res.status(404).json({ message: "Lead not found" });
    }

    // Only super-admin can delete
    if (req.user.role !== "super-admin" && req.user.role !== "admin") {
      return res.status(403).json({ message: "Access denied. Only Super Admin can delete leads." });
    }

    await lead.deleteOne();

    res.json({
      success: true,
      message: "Lead deleted successfully",
    });
  } catch (error) {
    console.error("Error deleting lead:", error);
    res.status(500).json({
      message: "Failed to delete lead",
      error: error.message,
    });
  }
};

// @desc    Get lead statistics
// @route   GET /api/leads/stats
// @access  Private (Super-admin and Marketing & Sales)
exports.getLeadStats = async (req, res) => {
  try {
    // Check access permissions
    if (!(await canAccessLeadManagement(req.user))) {
      return res.status(403).json({
        message: "Access denied. Lead management is only available to Super Admin, Marketing & Sales department, or users with lead management permissions."
      });
    }

    // Hierarchical access control for stats
    const accessibleUserIds = await getAccessibleUserIds(req.user);
    const filter = {
      assignedTo: { $in: accessibleUserIds }
    };

    const stats = await Lead.aggregate([
      { $match: filter },
      {
        $group: {
          _id: "$status",
          count: { $sum: 1 },
          totalRevenue: { $sum: "$expectedRevenue" },
        },
      },
    ]);

    const totalLeads = await Lead.countDocuments(filter);
    const convertedLeads = await Lead.countDocuments({ ...filter, convertedToCustomer: true });

    res.json({
      success: true,
      data: {
        totalLeads,
        convertedLeads,
        conversionRate: totalLeads > 0 ? ((convertedLeads / totalLeads) * 100).toFixed(2) : 0,
        byStatus: stats,
      },
    });
  } catch (error) {
    console.error("Error fetching lead stats:", error);
    res.status(500).json({
      message: "Failed to fetch lead statistics",
      error: error.message,
    });
  }
};

// @desc    Lookup a lead by ID, email, client name, or business name
// @route   GET /api/leads/lookup?query=value
// @access  Private (Super-admin only)
exports.lookupLead = async (req, res) => {
  try {
    // Check access permissions
    if (!(await canAccessLeadManagement(req.user))) {
      return res.status(403).json({
        message: "Access denied. Lead management is only available to Super Admin, Marketing & Sales department, or users with lead management permissions."
      });
    }

    // Only super-admin and admin can use lookup
    if (req.user.role !== "super-admin" && req.user.role !== "admin") {
      return res.status(403).json({
        message: "Access denied. Lead lookup is only available to Super Admin and Admin."
      });
    }

    const { query } = req.query;

    if (!query || query.trim() === "") {
      return res.status(400).json({
        message: "Please provide a search query"
      });
    }

    // Search for lead by multiple criteria
    const lead = await Lead.findOne({
      $or: [
        { leadId: { $regex: query, $options: "i" } },
        { clientName: { $regex: query, $options: "i" } },
        { businessName: { $regex: query, $options: "i" } },
        { email: { $regex: query, $options: "i" } }
      ]
    }).populate("assignedTo", "name email employeeId");

    if (!lead) {
      return res.status(404).json({
        success: false,
        message: "No lead found matching your search"
      });
    }

    res.json({
      success: true,
      data: lead
    });

  } catch (error) {
    console.error("Error looking up lead:", error);
    res.status(500).json({
      message: "Failed to lookup lead",
      error: error.message,
    });
  }
};