const mongoose = require("mongoose");
const Notification = require("../models/Notification");
const { sendNotificationToUser } = require("../utils/websocket");

/**
 * Notification types that also earn a desktop push.
 *
 * ─── WHY 'chat' IS DELIBERATELY ABSENT ───
 * Chat notifications are created through this service too — see
 * messaging.service._notifyMembers, which calls createAndSend — but they are
 * pushed by messaging.service._maybePush, which knows the thread and can apply
 * the three per-thread rules this generic path cannot: actively-viewing, thread
 * mute, and burst coalescing. Adding "chat" here would push every message
 * twice, once with the good policy and once without.
 *
 * The rest of the enum is left out for signal-to-noise: payslip, attendance,
 * system, achievement and wish are all things you find in your own time. Push
 * is for things someone is waiting on you for.
 */
const PUSH_TYPES = new Set(["task", "leave"]);

/**
 * Fire-and-forget desktop push for a notification that has already been saved.
 *
 * Never awaited and never throws. It holds a 10-second grace window before
 * deciding (see pushPolicy.stillUnread), and no HTTP request should stay open
 * for that — the row is already persisted, so the notification is not at risk
 * either way. A failure here must never fail the action that triggered it:
 * assigning a task has to succeed even if push is misconfigured.
 */
/**
 * The URL a push notification should open.
 *
 * Mirrors client/src/utils/notificationTarget.js exactly — the two are unit
 * tested against each other, so a click on an OS banner and a click on the
 * same notification in the notification centre land on the same screen.
 *
 * The stored `url` is the base path, because some notifications are
 * role-aware (a leave request sends approvers to /admin/leaves and the
 * employee to /leaves), and the identifier is added as a query parameter so
 * the destination page can open the exact item. A push click cannot carry
 * React Router state, so the URL is all there is.
 */
function resolveNotificationUrl(notification) {
  const pick = (key) => {
    if (!notification) return null;
    const nested = notification.relatedData && notification.relatedData[key];
    return nested ?? notification[key] ?? null;
  };

  // Repair paths emitted before the routes settled; old rows still carry them.
  const normalizePath = (path) => {
    if (!path || typeof path !== "string") return null;
    if (path === "/chat") return "/messages";
    if (path === "/payslips") return "/my-payslips";
    return path.replace(/^\/projects\/([^/?#]+)/, "/project/$1");
  };

  const withQuery = (path, key, value) => {
    if (!value) return path;
    const [base, hash] = path.split("#");
    if (new RegExp(`[?&]${key}=`).test(base)) return path;
    const separator = base.includes("?") ? "&" : "?";
    return `${base}${separator}${key}=${encodeURIComponent(value)}${hash ? `#${hash}` : ""}`;
  };

  const url = normalizePath(pick("url"));
  const messageId = pick("messageId");

  const conversationId = pick("conversationId");
  if (conversationId) {
    return withQuery(
      withQuery(url || "/messages", "conversation", conversationId),
      "message",
      messageId
    );
  }

  const projectId = pick("projectId");
  if (projectId) return withQuery(url || `/project/${projectId}`, "message", messageId);

  const taskId = pick("taskId");
  if (taskId) return withQuery(url || "/tasks", "task", taskId);

  const payslipId = pick("payslipId");
  if (payslipId) return withQuery(url || "/my-payslips", "payslip", payslipId);

  const leaveId = pick("leaveId");
  if (leaveId) return withQuery(url || "/leaves", "leave", leaveId);

  return url || "/notifications";
}

function _maybePushNotification(notification) {
  if (!notification || !PUSH_TYPES.has(notification.type)) return;

  // Required lazily: pushPolicy pulls in the socket layer, which is not
  // initialised at module-load time.
  const pushPolicy = require("./messaging/pushPolicy");
  const pushService = require("./pushService");

  (async () => {
    const { push, reason } = await pushPolicy.shouldPushGeneral({
      userId: notification.userId,
      priority: notification.priority,
    });
    if (!push) {
      console.debug?.(`[push] suppressed for ${notification.userId} (${reason})`);
      return;
    }

    // If they saw it in the notification centre during the grace window, the
    // banner is just noise about something they've already dealt with.
    if (!(await pushPolicy.stillUnread(notification._id))) {
      console.debug?.(`[push] suppressed for ${notification.userId} (read_during_grace)`);
      return;
    }

    await pushService.sendToUser(notification.userId, {
      title: notification.title,
      body: notification.body || notification.message || "",
      // Tagged per notification, not per type: two different task assignments
      // are two things you need to know about, so they must not replace each
      // other the way a burst of messages in one thread should.
      tag: `${notification.type}-${notification._id}`,
      // The identifier is appended to the url so the click lands on the thing
      // itself. A push click cannot carry React Router state, so the deep
      // link has to live in the URL.
      url: resolveNotificationUrl(notification),
      data: {
        type: notification.type,
        notificationId: String(notification._id),
      },
    });
  })().catch((err) =>
    console.error(`[push] ${notification.type} pipeline failed: ${err.message}`)
  );
}

/**
 * NotificationService — the single producer for every in-app notification.
 *
 * Any feature that wants to notify someone (tasks, payslips, chat, wishes...)
 * is expected to call into here and nowhere else. Each call does two things,
 * in this order:
 *   1. PERSIST — write the notification row(s) so they survive offline users
 *      and power the notification centre + unread badge.
 *   2. EMIT — push a live Socket.IO signal so anyone currently connected sees
 *      it instantly, without polling.
 *
 * Emitting is best-effort and never allowed to throw: server/utils/websocket.js
 * already swallows its own errors, but the `delivered`/`deliveredAt` bookkeeping
 * below is wrapped too, so a Socket.IO hiccup can never fail the request that
 * triggered the notification. Persistence is the guarantee; the socket is
 * just the "make it feel instant" layer on top.
 *
 * Ported from kha-crm-hrms's notification.service.js, adapted to this
 * project's richer Notification schema (priority, relatedData, expiresAt)
 * and kept backward-compatible with the existing `createAndSend` call sites
 * in taskController.js / chatController.js.
 */
class NotificationService {
  /**
   * Notify a single user. Persists one row and pushes it to that user's
   * personal socket room.
   */
  async notifyUser(notificationData) {
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

    try {
      sendNotificationToUser(userId, {
        channel,
        title,
        body,
        message: message || body,
        priority,
        notificationId: notification._id,
        timestamp: notification.createdAt || new Date(),
        read: false,
        ...relatedData,
      });

      notification.delivered = true;
      notification.deliveredAt = new Date();
      await notification.save();
    } catch (error) {
      console.error("Failed to send WebSocket notification:", error);
      // Don't throw - notification is saved even if the socket push fails.
    }

    _maybePushNotification(notification);

    return notification;
  }

  // Backward-compatible alias — existing call sites (taskController,
  // chatController) already use this name; no need to touch them.
  async createAndSend(notificationData) {
    return this.notifyUser(notificationData);
  }

  /**
   * Notify several specific users at once (e.g. every assignee on a task).
   * Persists one row per recipient (insertMany, so it's one round trip
   * instead of N) then fans the live signal out to each user's room.
   */
  async notifyUsers(userIds, notificationData) {
    const uniqueIds = [...new Set((userIds || []).map(String))];
    if (uniqueIds.length === 0) return [];

    const {
      type,
      channel,
      title,
      body,
      message,
      priority = "normal",
      relatedData = {},
      expiresInDays = 30,
    } = notificationData;

    const now = new Date();
    const expiresAt = new Date(now.getTime() + expiresInDays * 24 * 60 * 60 * 1000);

    const docs = await Notification.insertMany(
      uniqueIds.map((userId) => ({
        userId,
        type,
        channel,
        title,
        body,
        message: message || body,
        priority,
        relatedData,
        expiresAt,
      }))
    );

    docs.forEach((notification) => {
      try {
        sendNotificationToUser(notification.userId, {
          channel,
          title,
          body,
          message: message || body,
          priority,
          notificationId: notification._id,
          timestamp: notification.createdAt || now,
          read: false,
          ...relatedData,
        });
      } catch (error) {
        console.error(`Failed to send WebSocket notification to ${notification.userId}:`, error);
      }

      _maybePushNotification(notification);
    });

    // Best-effort delivered flag; not worth a second round trip failing the caller.
    Notification.updateMany(
      { _id: { $in: docs.map((d) => d._id) } },
      { delivered: true, deliveredAt: now }
    ).catch((err) => console.error("Failed to mark notifications delivered:", err.message));

    return docs;
  }

  /**
   * Notify everyone holding any of `roles` (e.g. all admins/super-admins).
   * Fans out to one persisted row per active user, matching notifyUsers'
   * semantics, so a broadcast-style notification still gets normal per-user
   * read/unread state with no special-casing in the UI.
   *
   * @param {string[]} roles   e.g. ["admin", "super-admin"]
   * @param {object}   payload { type, channel, title, body, priority, relatedData }
   * @param {object}   [opts]
   * @param {string}   [opts.excludeUserId]  don't notify this user (e.g. the actor)
   */
  async notifyRoles(roles, payload, { excludeUserId } = {}) {
    const User = require("../models/User");
    const query = { role: { $in: roles }, status: "active" };
    if (excludeUserId) query._id = { $ne: excludeUserId };

    const recipients = await User.find(query).select("_id").lean();
    if (recipients.length === 0) {
      console.warn(`[Notifications] notifyRoles(${roles.join(",")}) matched no active users.`);
      return [];
    }

    return this.notifyUsers(recipients.map((u) => u._id), payload);
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

module.exports = new NotificationService();
// Exported so it can be unit-tested and so anything else that needs a
// notification's destination uses the same rule.
module.exports.resolveNotificationUrl = resolveNotificationUrl;
