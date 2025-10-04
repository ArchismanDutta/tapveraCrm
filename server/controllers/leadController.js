const Lead = require("../models/Lead");
const User = require("../models/User");

// Helper function to check if user has access to Lead Management
const canAccessLeadManagement = (user) => {
  return user.role === "super-admin" || user.department === "marketingAndSales";
};

// @desc    Create a new lead
// @route   POST /api/leads
// @access  Private (Super-admin and Marketing & Sales employees)
exports.createLead = async (req, res) => {
  try {
    // Check access permissions
    if (!canAccessLeadManagement(req.user)) {
      return res.status(403).json({
        message: "Access denied. Lead management is only available to Super Admin and Marketing & Sales department."
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
      companySize,
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
    
    if (req.user.role === "super-admin") {
      // Super-admin can assign to anyone
      if (!assignedToUser) {
        // If not provided, assign to current user
        assignedToUser = req.user._id;
      } else {
        // Validate assignedTo user exists
        const userExists = await User.findById(assignedToUser);
        if (!userExists) {
          return res.status(404).json({ message: "Assigned user not found" });
        }
      }
    } else {
      // Non-super-admin employees can only assign to themselves
      assignedToUser = req.user._id;
      if (assignedTo && assignedTo !== req.user._id.toString()) {
        return res.status(403).json({ message: "You can only assign leads to yourself. Super Admin can assign to anyone." });
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
      companySize,
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
    if (!canAccessLeadManagement(req.user)) {
      return res.status(403).json({
        message: "Access denied. Lead management is only available to Super Admin and Marketing & Sales department."
      });
    }

    const { status, priority, source, search, assignedTo, page = 1, limit = 10 } = req.query;

    // Build filter
    const filter = {};

    // Role-based filtering
    if (req.user.role !== "super-admin") {
      // Non-super-admin users can only see their assigned leads
      filter.assignedTo = req.user._id;
    } else if (assignedTo) {
      // Super-admins can filter by assignedTo
      filter.assignedTo = assignedTo;
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
    if (!canAccessLeadManagement(req.user)) {
      return res.status(403).json({
        message: "Access denied. Lead management is only available to Super Admin and Marketing & Sales department."
      });
    }

    const lead = await Lead.findById(req.params.id)
      .populate("assignedTo", "name email employeeId department")
      .populate("assignedBy", "name email employeeId");

    if (!lead) {
      return res.status(404).json({ message: "Lead not found" });
    }

    // Check access permissions for assigned leads
    if (
      req.user.role !== "super-admin" &&
      lead.assignedTo._id.toString() !== req.user._id.toString()
    ) {
      return res.status(403).json({ message: "Access denied. You can only view your assigned leads." });
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
    if (!canAccessLeadManagement(req.user)) {
      return res.status(403).json({
        message: "Access denied. Lead management is only available to Super Admin and Marketing & Sales department."
      });
    }

    let lead = await Lead.findById(req.params.id);

    if (!lead) {
      return res.status(404).json({ message: "Lead not found" });
    }

    // Check permissions
    const isAssigned = lead.assignedTo.toString() === req.user._id.toString();
    const isSuperAdmin = req.user.role === "super-admin";

    if (!isAssigned && !isSuperAdmin) {
      return res.status(403).json({ message: "Access denied. You can only edit your assigned leads." });
    }

    // Non-super-admin cannot reassign leads to others
    if (!isSuperAdmin && req.body.assignedTo && req.body.assignedTo !== req.user._id.toString()) {
      return res.status(403).json({ message: "You cannot reassign leads. Only Super Admin can reassign." });
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
    if (!canAccessLeadManagement(req.user)) {
      return res.status(403).json({
        message: "Access denied. Lead management is only available to Super Admin and Marketing & Sales department."
      });
    }

    const lead = await Lead.findById(req.params.id);

    if (!lead) {
      return res.status(404).json({ message: "Lead not found" });
    }

    // Only super-admin can delete
    if (req.user.role !== "super-admin") {
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
    if (!canAccessLeadManagement(req.user)) {
      return res.status(403).json({
        message: "Access denied. Lead management is only available to Super Admin and Marketing & Sales department."
      });
    }

    const filter = {};

    // Filter by user role
    if (req.user.role !== "super-admin") {
      filter.assignedTo = req.user._id;
    }

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
    // Only super-admin can use lookup
    if (req.user.role !== "super-admin") {
      return res.status(403).json({
        message: "Access denied. Lead lookup is only available to Super Admin."
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