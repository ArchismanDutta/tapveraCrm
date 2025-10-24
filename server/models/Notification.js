const mongoose = require("mongoose");

const notificationSchema = new mongoose.Schema(
  {
    // Recipient
    userId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
      index: true,
    },

    // Notification Content
    type: {
      type: String,
      enum: ["task", "chat", "payslip", "leave", "attendance", "system", "achievement"],
      required: true,
      index: true,
    },

    channel: {
      type: String,
      required: true,
    },

    title: {
      type: String,
      required: true,
    },

    body: {
      type: String,
      required: true,
    },

    message: {
      type: String,
    },

    // Status
    read: {
      type: Boolean,
      default: false,
      index: true,
    },

    readAt: {
      type: Date,
    },

    // Priority
    priority: {
      type: String,
      enum: ["low", "normal", "high", "urgent"],
      default: "normal",
      index: true,
    },

    // Related Data (for navigation)
    relatedData: {
      taskId: mongoose.Schema.Types.ObjectId,
      conversationId: mongoose.Schema.Types.ObjectId,
      payslipId: mongoose.Schema.Types.ObjectId,
      leaveId: mongoose.Schema.Types.ObjectId,
      projectId: mongoose.Schema.Types.ObjectId,
      url: String, // Direct URL for navigation
    },

    // Delivery Status
    delivered: {
      type: Boolean,
      default: false,
    },

    deliveredAt: {
      type: Date,
    },

    // Expiry (auto-delete old notifications)
    expiresAt: {
      type: Date,
      index: true,
    },
  },
  {
    timestamps: true,
  }
);

// Indexes for performance
notificationSchema.index({ userId: 1, read: 1, createdAt: -1 });
notificationSchema.index({ userId: 1, type: 1, createdAt: -1 });
notificationSchema.index({ expiresAt: 1 }, { expireAfterSeconds: 0 }); // Auto-delete expired

// Mark as read
notificationSchema.methods.markAsRead = async function () {
  this.read = true;
  this.readAt = new Date();
  return await this.save();
};

// Check if notification is urgent
notificationSchema.methods.isUrgent = function () {
  return this.priority === "urgent" || this.priority === "high";
};

module.exports = mongoose.model("Notification", notificationSchema);
