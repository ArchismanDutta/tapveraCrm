const Notification = require("../models/Notification");
const { sendNotificationToUser } = require("../utils/websocket");

class NotificationService {
  /**
   * Create and send a notification
   * @param {Object} notificationData - Notification details
   * @returns {Promise<Notification>}
   */
  async createAndSend(notificationData) {
    const {
      userId,
      type,
      channel,
      title,
      body,
      message,
      priority = "normal",
      relatedData = {},
      expiresInDays = 30,
    } = notificationData;

    // Create notification in database
    const notification = await Notification.create({
      userId,
      type,
      channel,
      title,
      body,
      message: message || body,
      priority,
      relatedData,
      expiresAt: new Date(Date.now() + expiresInDays * 24 * 60 * 60 * 1000),
    });

    // Send real-time notification via WebSocket
    try {
      sendNotificationToUser(userId, {
        type: "notification",
        channel,
        title,
        body,
        message: message || body,
        priority,
        notificationId: notification._id,
        ...relatedData,
      });

      // Mark as delivered
      notification.delivered = true;
      notification.deliveredAt = new Date();
      await notification.save();
    } catch (error) {
      console.error("Failed to send WebSocket notification:", error);
      // Don't throw - notification is saved even if WebSocket fails
    }

    return notification;
  }

  /**
   * Get user's notifications
   * @param {String} userId - User ID
   * @param {Object} options - Query options
   * @returns {Promise<Object>} - Notifications and metadata
   */
  async getUserNotifications(userId, options = {}) {
    const {
      unreadOnly = false,
      type = null,
      limit = 50,
      page = 1,
      priority = null,
      search = null,
    } = options;

    const query = { userId };

    if (unreadOnly) {
      query.read = false;
    }

    if (type) {
      query.type = type;
    }

    if (priority) {
      query.priority = priority;
    }

    if (search) {
      query.$or = [
        { title: { $regex: search, $options: "i" } },
        { body: { $regex: search, $options: "i" } },
        { message: { $regex: search, $options: "i" } },
      ];
    }

    const skip = (page - 1) * limit;

    const [notifications, total, unreadCount] = await Promise.all([
      Notification.find(query)
        .sort({ createdAt: -1 })
        .limit(limit)
        .skip(skip)
        .lean(),
      Notification.countDocuments(query),
      Notification.countDocuments({ userId, read: false }),
    ]);

    return {
      notifications,
      pagination: {
        total,
        page,
        limit,
        pages: Math.ceil(total / limit),
      },
      unreadCount,
    };
  }

  /**
   * Get unread notification count
   * @param {String} userId - User ID
   * @returns {Promise<Number>}
   */
  async getUnreadCount(userId) {
    return await Notification.countDocuments({ userId, read: false });
  }

  /**
   * Mark notification as read
   * @param {String} notificationId - Notification ID
   * @param {String} userId - User ID (for security)
   * @returns {Promise<Notification>}
   */
  async markAsRead(notificationId, userId) {
    const notification = await Notification.findOne({
      _id: notificationId,
      userId,
    });

    if (!notification) {
      throw new Error("Notification not found");
    }

    return await notification.markAsRead();
  }

  /**
   * Mark all notifications as read
   * @param {String} userId - User ID
   * @param {Object} options - Filter options
   * @returns {Promise<Number>} - Number of updated notifications
   */
  async markAllAsRead(userId, options = {}) {
    const { type = null } = options;
    const query = { userId, read: false };

    if (type) {
      query.type = type;
    }

    const result = await Notification.updateMany(
      query,
      { read: true, readAt: new Date() }
    );

    return result.modifiedCount;
  }

  /**
   * Delete notification
   * @param {String} notificationId - Notification ID
   * @param {String} userId - User ID (for security)
   * @returns {Promise<void>}
   */
  async deleteNotification(notificationId, userId) {
    const result = await Notification.findOneAndDelete({
      _id: notificationId,
      userId,
    });

    if (!result) {
      throw new Error("Notification not found");
    }
  }

  /**
   * Delete all read notifications
   * @param {String} userId - User ID
   * @returns {Promise<Number>} - Number of deleted notifications
   */
  async deleteAllRead(userId) {
    const result = await Notification.deleteMany({ userId, read: true });
    return result.deletedCount;
  }

  /**
   * Get notification statistics
   * @param {String} userId - User ID
   * @returns {Promise<Object>}
   */
  async getNotificationStats(userId) {
    const stats = await Notification.aggregate([
      { $match: { userId: new mongoose.Types.ObjectId(userId) } },
      {
        $facet: {
          total: [{ $count: "count" }],
          unread: [{ $match: { read: false } }, { $count: "count" }],
          byType: [{ $group: { _id: "$type", count: { $sum: 1 } } }],
          byPriority: [
            { $match: { read: false } },
            { $group: { _id: "$priority", count: { $sum: 1 } } },
          ],
        },
      },
    ]);

    const result = stats[0];

    return {
      total: result.total[0]?.count || 0,
      unread: result.unread[0]?.count || 0,
      byType: Object.fromEntries(
        result.byType.map((t) => [t._id, t.count])
      ),
      byPriority: Object.fromEntries(
        result.byPriority.map((p) => [p._id, p.count])
      ),
    };
  }
}

const mongoose = require("mongoose");
module.exports = new NotificationService();
