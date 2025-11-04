// models/Sheet.js
const mongoose = require("mongoose");

const sheetSchema = new mongoose.Schema(
  {
    // Basic Information
    name: {
      type: String,
      required: [true, "Sheet name is required"],
      trim: true,
    },
    description: {
      type: String,
      trim: true,
      default: "",
    },

    // Sheet URLs
    originalUrl: {
      type: String,
      required: [true, "Sheet URL is required"],
      trim: true,
    },
    embedUrl: {
      type: String,
      required: true,
      trim: true,
    },

    // Sheet Type
    type: {
      type: String,
      enum: ["google", "excel"],
      required: true,
    },

    // Ownership & Access
    addedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
    },

    // Sharing - Users who have access
    sharedWith: [
      {
        user: {
          type: mongoose.Schema.Types.ObjectId,
          ref: "User",
        },
        permission: {
          type: String,
          enum: ["view", "edit"],
          default: "view",
        },
        sharedAt: {
          type: Date,
          default: Date.now,
        },
        sharedBy: {
          type: mongoose.Schema.Types.ObjectId,
          ref: "User",
        },
      },
    ],

    // Sharing - Roles that have access (e.g., "admin", "hr", "employee")
    sharedWithRoles: [
      {
        role: {
          type: String,
          enum: ["super-admin", "admin", "hr", "employee"],
        },
        permission: {
          type: String,
          enum: ["view", "edit"],
          default: "view",
        },
        sharedAt: {
          type: Date,
          default: Date.now,
        },
        sharedBy: {
          type: mongoose.Schema.Types.ObjectId,
          ref: "User",
        },
      },
    ],

    // Additional Metadata
    category: {
      type: String,
      trim: true,
      default: "",
    },
    tags: [
      {
        type: String,
        trim: true,
      },
    ],

    // Visibility
    isActive: {
      type: Boolean,
      default: true,
    },

    // Last accessed tracking
    lastAccessedAt: {
      type: Date,
    },
    lastAccessedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
    },
  },
  {
    timestamps: true, // Adds createdAt and updatedAt
  }
);

// Indexes for faster queries
sheetSchema.index({ addedBy: 1, isActive: 1 });
sheetSchema.index({ "sharedWith.user": 1, isActive: 1 });
sheetSchema.index({ "sharedWithRoles.role": 1, isActive: 1 });
sheetSchema.index({ type: 1 });
sheetSchema.index({ category: 1 });

// Virtual to check if sheet is shared with anyone
sheetSchema.virtual("isShared").get(function () {
  return this.sharedWith.length > 0 || this.sharedWithRoles.length > 0;
});

// Method to check if user has access to this sheet
sheetSchema.methods.hasAccess = function (userId, userRole) {
  // Owner always has access
  // Handle both populated and non-populated addedBy field
  const ownerId = this.addedBy._id || this.addedBy;
  if (ownerId.toString() === userId.toString()) {
    return true;
  }

  // Super-admin always has access
  if (userRole === "super-admin" || userRole === "superadmin") {
    return true;
  }

  // Check if shared with specific user
  const sharedWithUser = this.sharedWith.some((share) => {
    // Handle both populated and non-populated user field
    const shareUserId = share.user._id || share.user;
    return shareUserId.toString() === userId.toString();
  });
  if (sharedWithUser) return true;

  // Check if shared with user's role
  const sharedWithRole = this.sharedWithRoles.some(
    (share) => share.role === userRole
  );
  if (sharedWithRole) return true;

  return false;
};

// Method to get user's permission level for this sheet
sheetSchema.methods.getUserPermission = function (userId, userRole) {
  // Owner always has edit permission
  // Handle both populated and non-populated addedBy field
  const ownerId = this.addedBy._id || this.addedBy;
  if (ownerId.toString() === userId.toString()) {
    return "edit";
  }

  // Super-admin always has edit permission
  if (userRole === "super-admin" || userRole === "superadmin") {
    return "edit";
  }

  // Check permission from specific user share
  const userShare = this.sharedWith.find((share) => {
    // Handle both populated and non-populated user field
    const shareUserId = share.user._id || share.user;
    return shareUserId.toString() === userId.toString();
  });
  if (userShare) {
    return userShare.permission || "view";
  }

  // Check permission from role share
  const roleShare = this.sharedWithRoles.find(
    (share) => share.role === userRole
  );
  if (roleShare) {
    return roleShare.permission || "view";
  }

  // No access
  return null;
};

// Method to update last accessed info
sheetSchema.methods.updateAccess = async function (userId) {
  this.lastAccessedAt = new Date();
  this.lastAccessedBy = userId;
  await this.save();
};

// Static method to get sheets accessible by user
sheetSchema.statics.getAccessibleSheets = async function (userId, userRole) {
  const query = {
    isActive: true,
    $or: [
      { addedBy: userId }, // Sheets created by user
      { "sharedWith.user": userId }, // Sheets shared with user
      { "sharedWithRoles.role": userRole }, // Sheets shared with user's role
    ],
  };

  // Super-admin sees all sheets
  if (userRole === "super-admin" || userRole === "superadmin") {
    return await this.find({ isActive: true })
      .populate("addedBy", "name email employeeId")
      .populate("sharedWith.user", "name email employeeId")
      .populate("sharedWith.sharedBy", "name email")
      .populate("lastAccessedBy", "name email")
      .sort({ updatedAt: -1 });
  }

  return await this.find(query)
    .populate("addedBy", "name email employeeId")
    .populate("sharedWith.user", "name email employeeId")
    .populate("sharedWith.sharedBy", "name email")
    .populate("lastAccessedBy", "name email")
    .sort({ updatedAt: -1 });
};

module.exports = mongoose.model("Sheet", sheetSchema);
