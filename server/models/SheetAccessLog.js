// models/SheetAccessLog.js
const mongoose = require("mongoose");

const sheetAccessLogSchema = new mongoose.Schema(
  {
    // Sheet reference
    sheet: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Sheet",
      required: true,
      index: true,
    },

    // User who accessed
    user: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
      index: true,
    },

    // Access details
    accessedAt: {
      type: Date,
      default: Date.now,
      index: true,
    },

    // User's permission at time of access
    permissionLevel: {
      type: String,
      enum: ["view", "edit"],
      required: true,
    },

    // Session tracking (optional - for future duration tracking)
    sessionId: {
      type: String,
    },

    // User agent and IP for security auditing
    userAgent: {
      type: String,
    },
    ipAddress: {
      type: String,
    },
  },
  {
    timestamps: true, // Adds createdAt and updatedAt
  }
);

// Compound index for efficient queries
sheetAccessLogSchema.index({ sheet: 1, accessedAt: -1 });
sheetAccessLogSchema.index({ user: 1, accessedAt: -1 });

// Static method to log sheet access
sheetAccessLogSchema.statics.logAccess = async function (
  sheetId,
  userId,
  permissionLevel,
  metadata = {}
) {
  return await this.create({
    sheet: sheetId,
    user: userId,
    permissionLevel,
    userAgent: metadata.userAgent,
    ipAddress: metadata.ipAddress,
    sessionId: metadata.sessionId,
  });
};

// Static method to get access history for a sheet
sheetAccessLogSchema.statics.getSheetHistory = async function (
  sheetId,
  limit = 50
) {
  return await this.find({ sheet: sheetId })
    .populate("user", "name email employeeId")
    .sort({ accessedAt: -1 })
    .limit(limit);
};

// Static method to get access history for a user
sheetAccessLogSchema.statics.getUserHistory = async function (
  userId,
  limit = 50
) {
  return await this.find({ user: userId })
    .populate("sheet", "name type category")
    .sort({ accessedAt: -1 })
    .limit(limit);
};

// Static method to get access statistics for a sheet
sheetAccessLogSchema.statics.getSheetStats = async function (sheetId) {
  const stats = await this.aggregate([
    { $match: { sheet: mongoose.Types.ObjectId(sheetId) } },
    {
      $group: {
        _id: "$user",
        accessCount: { $sum: 1 },
        lastAccess: { $max: "$accessedAt" },
        firstAccess: { $min: "$accessedAt" },
      },
    },
    {
      $lookup: {
        from: "users",
        localField: "_id",
        foreignField: "_id",
        as: "userInfo",
      },
    },
    { $unwind: "$userInfo" },
    {
      $project: {
        user: {
          _id: "$userInfo._id",
          name: "$userInfo.name",
          email: "$userInfo.email",
          employeeId: "$userInfo.employeeId",
        },
        accessCount: 1,
        lastAccess: 1,
        firstAccess: 1,
      },
    },
    { $sort: { accessCount: -1 } },
  ]);

  return stats;
};

module.exports = mongoose.model("SheetAccessLog", sheetAccessLogSchema);
