const express = require("express");
const router = express.Router();
const notificationService = require("../services/notificationService");
const { protect } = require("../middlewares/authMiddleware");

// All routes require authentication
router.use(protect);

// GET /api/notifications - Get user's notifications
router.get("/", async (req, res) => {
  try {
    const { unreadOnly, type, limit, page, priority, search } = req.query;

    const result = await notificationService.getUserNotifications(
      req.user._id,
      {
        unreadOnly: unreadOnly === "true",
        type,
        limit: parseInt(limit) || 50,
        page: parseInt(page) || 1,
        priority,
        search,
      }
    );

    res.json({
      success: true,
      ...result,
    });
  } catch (error) {
    console.error("Error fetching notifications:", error);
    res.status(500).json({
      success: false,
      message: "Failed to fetch notifications",
      error: error.message,
    });
  }
});

// GET /api/notifications/unread-count - Get unread count
router.get("/unread-count", async (req, res) => {
  try {
    const count = await notificationService.getUnreadCount(req.user._id);

    res.json({
      success: true,
      count,
    });
  } catch (error) {
    console.error("Error fetching unread count:", error);
    res.status(500).json({
      success: false,
      message: "Failed to fetch unread count",
      error: error.message,
    });
  }
});

// GET /api/notifications/stats - Get notification statistics
router.get("/stats", async (req, res) => {
  try {
    const stats = await notificationService.getNotificationStats(req.user._id);

    res.json({
      success: true,
      data: stats,
    });
  } catch (error) {
    console.error("Error fetching notification stats:", error);
    res.status(500).json({
      success: false,
      message: "Failed to fetch notification statistics",
      error: error.message,
    });
  }
});

// PUT /api/notifications/:id/read - Mark as read
router.put("/:id/read", async (req, res) => {
  try {
    const notification = await notificationService.markAsRead(
      req.params.id,
      req.user._id
    );

    res.json({
      success: true,
      message: "Notification marked as read",
      data: notification,
    });
  } catch (error) {
    console.error("Error marking notification as read:", error);
    res.status(404).json({
      success: false,
      message: error.message || "Failed to mark notification as read",
    });
  }
});

// PUT /api/notifications/mark-all-read - Mark all as read
router.put("/mark-all-read", async (req, res) => {
  try {
    const { type } = req.body;
    const count = await notificationService.markAllAsRead(req.user._id, {
      type,
    });

    res.json({
      success: true,
      message: `Marked ${count} notification${count !== 1 ? "s" : ""} as read`,
      count,
    });
  } catch (error) {
    console.error("Error marking all as read:", error);
    res.status(500).json({
      success: false,
      message: "Failed to mark all notifications as read",
      error: error.message,
    });
  }
});

// DELETE /api/notifications/delete-all-read - Delete all read notifications
// IMPORTANT: This must come BEFORE /:id route to avoid matching "delete-all-read" as an ID
router.delete("/delete-all-read", async (req, res) => {
  try {
    const count = await notificationService.deleteAllRead(req.user._id);

    res.json({
      success: true,
      message: `Deleted ${count} read notification${count !== 1 ? "s" : ""}`,
      count,
    });
  } catch (error) {
    console.error("Error deleting read notifications:", error);
    res.status(500).json({
      success: false,
      message: "Failed to delete read notifications",
      error: error.message,
    });
  }
});

// DELETE /api/notifications/:id - Delete notification
router.delete("/:id", async (req, res) => {
  try {
    await notificationService.deleteNotification(req.params.id, req.user._id);

    res.json({
      success: true,
      message: "Notification deleted",
    });
  } catch (error) {
    console.error("Error deleting notification:", error);
    res.status(404).json({
      success: false,
      message: error.message || "Failed to delete notification",
    });
  }
});

module.exports = router;
