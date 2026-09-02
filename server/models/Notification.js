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
      enum: ["task", "chat", "payslip", "leave", "attendance", "system", "achievement", "wish"],
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
    //
    // Mixed, not a declared sub-path. As a declared path Mongoose silently
    // dropped every key not listed here on save - messageId, wishId,
    // keywordId and the rest - so a chat notification read back from the API
    // had lost the message it was about, while the same notification
    // delivered live over the socket still carried it. The two paths
    // disagreed about the same event.
    //
    // Keys in use (see client/src/utils/notificationTarget.js, which decides
    // where a notification navigates to):
    //   taskId, conversationId, messageId, payslipId, leaveId, projectId,
    //   wishId, and url - the destination path, with identifiers appended as
    //   query parameters.
    relatedData: {
      type: mongoose.Schema.Types.Mixed,
      default: () => ({}),
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
