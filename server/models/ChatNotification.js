// models/ChatNotification.js
const mongoose = require('mongoose');

/**
 * ChatNotification Model
 * Tracks daily chat initiation email notifications to prevent spam
 * One notification per user per conversation per day
 */
const chatNotificationSchema = new mongoose.Schema({
  // User who receives the notification
  userId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true,
    index: true
  },

  // Conversation/Project chat
  conversationId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Conversation',
    required: true,
    index: true
  },

  // Project reference (if applicable)
  projectId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Project',
    index: true
  },

  // Type of notification sent
  notificationType: {
    type: String,
    enum: ['daily_chat_initiation', 'chat_summary'],
    default: 'daily_chat_initiation'
  },

  // Date when notification was sent (stored as start of day in UTC)
  notificationDate: {
    type: Date,
    required: true,
    index: true
  },

  // When the notification was actually sent
  sentAt: {
    type: Date,
    default: Date.now
  },

  // Message that triggered the notification
  triggeredByMessage: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'ChatMessage'
  },

  // Who sent the message that triggered notification
  triggeredByUser: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User'
  },

  // Email delivery status
  emailStatus: {
    type: String,
    enum: ['pending', 'sent', 'failed', 'bounced'],
    default: 'pending'
  },

  // Error message if email failed
  errorMessage: String,

  // Number of messages included in the notification
  messageCount: {
    type: Number,
    default: 1
  }
}, {
  timestamps: true
});

// Compound index for efficient lookups
chatNotificationSchema.index({ userId: 1, conversationId: 1, notificationDate: 1 }, { unique: true });

// Index for cleanup queries
chatNotificationSchema.index({ notificationDate: 1 });

/**
 * Check if user was already notified today for this conversation
 */
chatNotificationSchema.statics.wasNotifiedToday = async function(userId, conversationId) {
  const startOfDay = new Date();
  startOfDay.setHours(0, 0, 0, 0);

  const notification = await this.findOne({
    userId,
    conversationId,
    notificationDate: startOfDay
  });

  return !!notification;
};

/**
 * Record a new notification
 */
chatNotificationSchema.statics.recordNotification = async function(data) {
  const startOfDay = new Date();
  startOfDay.setHours(0, 0, 0, 0);

  const notification = await this.findOneAndUpdate(
    {
      userId: data.userId,
      conversationId: data.conversationId,
      notificationDate: startOfDay
    },
    {
      $set: {
        projectId: data.projectId,
        triggeredByMessage: data.triggeredByMessage,
        triggeredByUser: data.triggeredByUser,
        emailStatus: data.emailStatus || 'sent',
        sentAt: new Date()
      },
      $inc: { messageCount: 1 }
    },
    {
      upsert: true,
      new: true
    }
  );

  return notification;
};

/**
 * Clean up old notifications (older than 30 days)
 */
chatNotificationSchema.statics.cleanupOldNotifications = async function(daysToKeep = 30) {
  const cutoffDate = new Date();
  cutoffDate.setDate(cutoffDate.getDate() - daysToKeep);

  const result = await this.deleteMany({
    notificationDate: { $lt: cutoffDate }
  });

  return result.deletedCount;
};

/**
 * Get notification stats for a user
 */
chatNotificationSchema.statics.getUserNotificationStats = async function(userId, days = 7) {
  const startDate = new Date();
  startDate.setDate(startDate.getDate() - days);
  startDate.setHours(0, 0, 0, 0);

  const stats = await this.aggregate([
    {
      $match: {
        userId: mongoose.Types.ObjectId(userId),
        notificationDate: { $gte: startDate }
      }
    },
    {
      $group: {
        _id: '$notificationDate',
        count: { $sum: 1 },
        totalMessages: { $sum: '$messageCount' }
      }
    },
    {
      $sort: { _id: 1 }
    }
  ]);

  return stats;
};

const ChatNotification = mongoose.model('ChatNotification', chatNotificationSchema);

module.exports = ChatNotification;
