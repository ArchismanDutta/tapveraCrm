// routes/sheetRoutes.js
const express = require("express");
const router = express.Router();
const Sheet = require("../models/Sheet");
const User = require("../models/User");
const SheetAccessLog = require("../models/SheetAccessLog");
const { protect, authorize } = require("../middlewares/authMiddleware");

// Helper function to convert Google Sheets URL to embed URL
const convertToEmbedUrl = (url, type) => {
  try {
    if (type === "google") {
      // Google Sheets URL pattern: https://docs.google.com/spreadsheets/d/{id}/edit...
      const match = url.match(/\/spreadsheets\/d\/([a-zA-Z0-9-_]+)/);
      if (match) {
        const sheetId = match[1];
        // Create embed URL with FULL edit permissions
        // Removed rm=minimal to allow full editing capabilities
        return `https://docs.google.com/spreadsheets/d/${sheetId}/edit?embedded=true`;
      }
    } else if (type === "excel") {
      // Excel Online URL - ensure it's in edit mode
      if (url.includes("embed")) {
        // If already embedded, ensure it's in edit mode
        return url.replace("/view", "/edit");
      }
      // Convert to edit embed format
      return url.replace("/view", "/edit").replace(/action=view/g, "action=edit");
    }
    return url;
  } catch (error) {
    console.error("Error converting URL:", error);
    return url;
  }
};

// Helper function to detect sheet type from URL
const detectSheetType = (url) => {
  if (url.includes("docs.google.com/spreadsheets")) {
    return "google";
  } else if (
    url.includes("onedrive.live.com") ||
    url.includes("sharepoint.com") ||
    url.includes("office.com")
  ) {
    return "excel";
  }
  return null;
};

// @route   POST /api/sheets
// @desc    Add a new sheet
// @access  Private (Super-admin, Admin)
router.post("/", protect, authorize("super-admin", "admin"), async (req, res) => {
  try {
    const { name, description, originalUrl, category, tags } = req.body;

    // Validate required fields
    if (!name || !originalUrl) {
      return res.status(400).json({
        success: false,
        message: "Name and URL are required",
      });
    }

    // Detect sheet type
    const type = detectSheetType(originalUrl);
    if (!type) {
      return res.status(400).json({
        success: false,
        message: "Invalid sheet URL. Please provide a Google Sheets or Excel Online URL.",
      });
    }

    // Convert to embed URL
    const embedUrl = convertToEmbedUrl(originalUrl, type);

    // Create sheet
    const sheet = await Sheet.create({
      name: name.trim(),
      description: description?.trim() || "",
      originalUrl: originalUrl.trim(),
      embedUrl,
      type,
      category: category?.trim() || "",
      tags: tags || [],
      addedBy: req.user._id,
    });

    const populatedSheet = await Sheet.findById(sheet._id).populate(
      "addedBy",
      "name email employeeId"
    );

    res.status(201).json({
      success: true,
      message: "Sheet added successfully",
      data: populatedSheet,
    });
  } catch (error) {
    console.error("Error adding sheet:", error);
    res.status(500).json({
      success: false,
      message: "Server error",
      error: error.message,
    });
  }
});

// @route   GET /api/sheets
// @desc    Get all sheets accessible by the user
// @access  Private
router.get("/", protect, async (req, res) => {
  try {
    const { category, type, search } = req.query;

    // Get accessible sheets based on user role and permissions
    let sheets = await Sheet.getAccessibleSheets(req.user._id, req.user.role);

    // Apply filters
    if (category) {
      sheets = sheets.filter(
        (sheet) => sheet.category.toLowerCase() === category.toLowerCase()
      );
    }

    if (type) {
      sheets = sheets.filter((sheet) => sheet.type === type);
    }

    if (search) {
      const searchLower = search.toLowerCase();
      sheets = sheets.filter(
        (sheet) =>
          sheet.name.toLowerCase().includes(searchLower) ||
          sheet.description.toLowerCase().includes(searchLower) ||
          sheet.tags.some((tag) => tag.toLowerCase().includes(searchLower))
      );
    }

    res.json({
      success: true,
      count: sheets.length,
      data: sheets,
    });
  } catch (error) {
    console.error("Error fetching sheets:", error);
    res.status(500).json({
      success: false,
      message: "Server error",
      error: error.message,
    });
  }
});

// @route   GET /api/sheets/:id
// @desc    Get a single sheet
// @access  Private
router.get("/:id", protect, async (req, res) => {
  try {
    const sheet = await Sheet.findById(req.params.id)
      .populate("addedBy", "name email employeeId")
      .populate("sharedWith.user", "name email employeeId")
      .populate("sharedWith.sharedBy", "name email")
      .populate("lastAccessedBy", "name email");

    if (!sheet) {
      return res.status(404).json({
        success: false,
        message: "Sheet not found",
      });
    }

    // Check if user has access
    if (!sheet.hasAccess(req.user._id, req.user.role)) {
      return res.status(403).json({
        success: false,
        message: "Access denied",
      });
    }

    // Get user's permission level
    const userPermission = sheet.getUserPermission(req.user._id, req.user.role);

    // Update last accessed info
    await sheet.updateAccess(req.user._id);

    // Log sheet access for audit trail
    try {
      await SheetAccessLog.logAccess(sheet._id, req.user._id, userPermission, {
        userAgent: req.headers["user-agent"],
        ipAddress: req.ip || req.connection.remoteAddress,
      });
    } catch (logError) {
      console.error("Error logging access:", logError);
      // Don't fail the request if logging fails
    }

    // Add permission to response
    const sheetObject = sheet.toObject();
    sheetObject.userPermission = userPermission;

    res.json({
      success: true,
      data: sheetObject,
    });
  } catch (error) {
    console.error("Error fetching sheet:", error);
    res.status(500).json({
      success: false,
      message: "Server error",
      error: error.message,
    });
  }
});

// @route   PUT /api/sheets/:id
// @desc    Update sheet metadata
// @access  Private (Owner, Super-admin)
router.put("/:id", protect, async (req, res) => {
  try {
    const { name, description, category, tags, originalUrl } = req.body;

    const sheet = await Sheet.findById(req.params.id);

    if (!sheet) {
      return res.status(404).json({
        success: false,
        message: "Sheet not found",
      });
    }

    // Check if user is owner or super-admin
    const isSuperAdmin =
      req.user.role === "super-admin" || req.user.role === "superadmin";
    const isOwner = sheet.addedBy.toString() === req.user._id.toString();

    if (!isSuperAdmin && !isOwner) {
      return res.status(403).json({
        success: false,
        message: "Access denied. Only the owner or super-admin can edit.",
      });
    }

    // Update fields
    if (name !== undefined) sheet.name = name.trim();
    if (description !== undefined) sheet.description = description.trim();
    if (category !== undefined) sheet.category = category.trim();
    if (tags !== undefined) sheet.tags = tags;

    // If URL is updated, regenerate embed URL
    if (originalUrl !== undefined) {
      sheet.originalUrl = originalUrl.trim();
      const type = detectSheetType(originalUrl);
      if (type) {
        sheet.type = type;
        sheet.embedUrl = convertToEmbedUrl(originalUrl, type);
      }
    }

    await sheet.save();

    const updatedSheet = await Sheet.findById(sheet._id)
      .populate("addedBy", "name email employeeId")
      .populate("sharedWith.user", "name email employeeId");

    res.json({
      success: true,
      message: "Sheet updated successfully",
      data: updatedSheet,
    });
  } catch (error) {
    console.error("Error updating sheet:", error);
    res.status(500).json({
      success: false,
      message: "Server error",
      error: error.message,
    });
  }
});

// @route   DELETE /api/sheets/:id
// @desc    Delete sheet (soft delete)
// @access  Private (Owner, Super-admin)
router.delete("/:id", protect, async (req, res) => {
  try {
    const sheet = await Sheet.findById(req.params.id);

    if (!sheet) {
      return res.status(404).json({
        success: false,
        message: "Sheet not found",
      });
    }

    // Check if user is owner or super-admin
    const isSuperAdmin =
      req.user.role === "super-admin" || req.user.role === "superadmin";
    const isOwner = sheet.addedBy.toString() === req.user._id.toString();

    if (!isSuperAdmin && !isOwner) {
      return res.status(403).json({
        success: false,
        message: "Access denied. Only the owner or super-admin can delete.",
      });
    }

    // Soft delete
    sheet.isActive = false;
    await sheet.save();

    res.json({
      success: true,
      message: "Sheet deleted successfully",
    });
  } catch (error) {
    console.error("Error deleting sheet:", error);
    res.status(500).json({
      success: false,
      message: "Server error",
      error: error.message,
    });
  }
});

// @route   POST /api/sheets/:id/share
// @desc    Share sheet with users or roles
// @access  Private (Super-admin only)
router.post(
  "/:id/share",
  protect,
  authorize("super-admin"),
  async (req, res) => {
    try {
      const { userShares, roleShares } = req.body;
      // userShares: [{ userId, permission }]
      // roleShares: [{ role, permission }]

      const sheet = await Sheet.findById(req.params.id);

      if (!sheet) {
        return res.status(404).json({
          success: false,
          message: "Sheet not found",
        });
      }

      // Share with specific users
      if (userShares && Array.isArray(userShares) && userShares.length > 0) {
        for (const { userId, permission } of userShares) {
          // Check if user exists
          const userExists = await User.findById(userId);
          if (!userExists) continue;

          // Validate permission
          const validPermission = ["view", "edit"].includes(permission) ? permission : "view";

          // Check if already shared
          const existingShareIndex = sheet.sharedWith.findIndex(
            (share) => share.user.toString() === userId
          );

          if (existingShareIndex >= 0) {
            // Update existing permission
            sheet.sharedWith[existingShareIndex].permission = validPermission;
          } else {
            // Add new share
            sheet.sharedWith.push({
              user: userId,
              permission: validPermission,
              sharedBy: req.user._id,
              sharedAt: new Date(),
            });
          }
        }
      }

      // Share with roles
      if (roleShares && Array.isArray(roleShares) && roleShares.length > 0) {
        for (const { role, permission } of roleShares) {
          // Validate role
          if (!["admin", "hr", "employee"].includes(role)) continue;

          // Validate permission
          const validPermission = ["view", "edit"].includes(permission) ? permission : "view";

          // Check if already shared with this role
          const existingShareIndex = sheet.sharedWithRoles.findIndex(
            (share) => share.role === role
          );

          if (existingShareIndex >= 0) {
            // Update existing permission
            sheet.sharedWithRoles[existingShareIndex].permission = validPermission;
          } else {
            // Add new share
            sheet.sharedWithRoles.push({
              role,
              permission: validPermission,
              sharedBy: req.user._id,
              sharedAt: new Date(),
            });
          }
        }
      }

      await sheet.save();

      const updatedSheet = await Sheet.findById(sheet._id)
        .populate("addedBy", "name email employeeId")
        .populate("sharedWith.user", "name email employeeId")
        .populate("sharedWith.sharedBy", "name email");

      res.json({
        success: true,
        message: "Sheet shared successfully",
        data: updatedSheet,
      });
    } catch (error) {
      console.error("Error sharing sheet:", error);
      res.status(500).json({
        success: false,
        message: "Server error",
        error: error.message,
      });
    }
  }
);

// @route   DELETE /api/sheets/:id/share
// @desc    Remove sharing from users or roles
// @access  Private (Super-admin only)
router.delete(
  "/:id/share",
  protect,
  authorize("super-admin"),
  async (req, res) => {
    try {
      const { userIds, roles } = req.body;

      const sheet = await Sheet.findById(req.params.id);

      if (!sheet) {
        return res.status(404).json({
          success: false,
          message: "Sheet not found",
        });
      }

      // Remove specific users
      if (userIds && Array.isArray(userIds) && userIds.length > 0) {
        sheet.sharedWith = sheet.sharedWith.filter(
          (share) => !userIds.includes(share.user.toString())
        );
      }

      // Remove roles
      if (roles && Array.isArray(roles) && roles.length > 0) {
        sheet.sharedWithRoles = sheet.sharedWithRoles.filter(
          (share) => !roles.includes(share.role)
        );
      }

      await sheet.save();

      const updatedSheet = await Sheet.findById(sheet._id)
        .populate("addedBy", "name email employeeId")
        .populate("sharedWith.user", "name email employeeId")
        .populate("sharedWith.sharedBy", "name email");

      res.json({
        success: true,
        message: "Sharing removed successfully",
        data: updatedSheet,
      });
    } catch (error) {
      console.error("Error removing share:", error);
      res.status(500).json({
        success: false,
        message: "Server error",
        error: error.message,
      });
    }
  }
);

// @route   GET /api/sheets/stats/summary
// @desc    Get sheet statistics
// @access  Private (Super-admin)
router.get(
  "/stats/summary",
  protect,
  authorize("super-admin"),
  async (req, res) => {
    try {
      const totalSheets = await Sheet.countDocuments({ isActive: true });
      const googleSheets = await Sheet.countDocuments({
        isActive: true,
        type: "google",
      });
      const excelSheets = await Sheet.countDocuments({
        isActive: true,
        type: "excel",
      });
      const sharedSheets = await Sheet.countDocuments({
        isActive: true,
        $or: [
          { "sharedWith.0": { $exists: true } },
          { "sharedWithRoles.0": { $exists: true } },
        ],
      });

      res.json({
        success: true,
        data: {
          totalSheets,
          googleSheets,
          excelSheets,
          sharedSheets,
        },
      });
    } catch (error) {
      console.error("Error fetching stats:", error);
      res.status(500).json({
        success: false,
        message: "Server error",
        error: error.message,
      });
    }
  }
);

// @route   GET /api/sheets/:id/access-history
// @desc    Get access history for a sheet
// @access  Private (Super-admin, Admin, Owner)
router.get("/:id/access-history", protect, async (req, res) => {
  try {
    const sheet = await Sheet.findById(req.params.id);

    if (!sheet) {
      return res.status(404).json({
        success: false,
        message: "Sheet not found",
      });
    }

    // Check if user has permission to view history
    const isSuperAdmin =
      req.user.role === "super-admin" || req.user.role === "superadmin";
    const isAdmin = req.user.role === "admin";
    const isOwner = sheet.addedBy.toString() === req.user._id.toString();

    if (!isSuperAdmin && !isAdmin && !isOwner) {
      return res.status(403).json({
        success: false,
        message: "Access denied. Only super-admin, admin, or owner can view access history.",
      });
    }

    // Get access history with optional limit
    const limit = parseInt(req.query.limit) || 50;
    const history = await SheetAccessLog.getSheetHistory(req.params.id, limit);

    res.json({
      success: true,
      count: history.length,
      data: history,
    });
  } catch (error) {
    console.error("Error fetching access history:", error);
    res.status(500).json({
      success: false,
      message: "Server error",
      error: error.message,
    });
  }
});

// @route   GET /api/sheets/:id/access-stats
// @desc    Get access statistics for a sheet
// @access  Private (Super-admin, Admin, Owner)
router.get("/:id/access-stats", protect, async (req, res) => {
  try {
    const sheet = await Sheet.findById(req.params.id);

    if (!sheet) {
      return res.status(404).json({
        success: false,
        message: "Sheet not found",
      });
    }

    // Check if user has permission to view stats
    const isSuperAdmin =
      req.user.role === "super-admin" || req.user.role === "superadmin";
    const isAdmin = req.user.role === "admin";
    const isOwner = sheet.addedBy.toString() === req.user._id.toString();

    if (!isSuperAdmin && !isAdmin && !isOwner) {
      return res.status(403).json({
        success: false,
        message: "Access denied. Only super-admin, admin, or owner can view stats.",
      });
    }

    // Get access statistics
    const stats = await SheetAccessLog.getSheetStats(req.params.id);

    res.json({
      success: true,
      data: stats,
    });
  } catch (error) {
    console.error("Error fetching access stats:", error);
    res.status(500).json({
      success: false,
      message: "Server error",
      error: error.message,
    });
  }
});

// @route   GET /api/sheets/user/:userId/access-history
// @desc    Get access history for a specific user
// @access  Private (Super-admin, Admin, or self)
router.get("/user/:userId/access-history", protect, async (req, res) => {
  try {
    // Check if user has permission
    const isSuperAdmin =
      req.user.role === "super-admin" || req.user.role === "superadmin";
    const isAdmin = req.user.role === "admin";
    const isSelf = req.user._id.toString() === req.params.userId;

    if (!isSuperAdmin && !isAdmin && !isSelf) {
      return res.status(403).json({
        success: false,
        message: "Access denied.",
      });
    }

    // Get user's access history with optional limit
    const limit = parseInt(req.query.limit) || 50;
    const history = await SheetAccessLog.getUserHistory(req.params.userId, limit);

    res.json({
      success: true,
      count: history.length,
      data: history,
    });
  } catch (error) {
    console.error("Error fetching user access history:", error);
    res.status(500).json({
      success: false,
      message: "Server error",
      error: error.message,
    });
  }
});

module.exports = router;
