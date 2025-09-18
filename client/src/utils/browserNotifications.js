// Browser notification utility for task assignments and changes

class BrowserNotificationManager {
  constructor() {
    this.permission = Notification.permission;
  }

  // Request notification permission
  async requestPermission() {
    if (!("Notification" in window)) {
      console.warn("This browser does not support notifications");
      return false;
    }

    if (this.permission === "granted") {
      return true;
    }

    if (this.permission === "denied") {
      console.warn("Notification permission denied");
      return false;
    }

    try {
      const permission = await Notification.requestPermission();
      this.permission = permission;
      return permission === "granted";
    } catch (error) {
      console.error("Error requesting notification permission:", error);
      return false;
    }
  }

  // Show a browser notification
  showNotification(title, options = {}) {
    if (this.permission !== "granted") {
      console.warn("Notification permission not granted");
      return null;
    }

    const defaultOptions = {
      icon: "/favicon.ico", // You can change this to your app icon
      badge: "/favicon.ico",
      tag: "tapvera-task", // Prevents duplicate notifications
      requireInteraction: false,
      silent: false,
      ...options
    };

    try {
      const notification = new Notification(title, defaultOptions);

      // Auto-close after 5 seconds if not interacted with
      setTimeout(() => {
        notification.close();
      }, 5000);

      return notification;
    } catch (error) {
      console.error("Error showing notification:", error);
      return null;
    }
  }

  // Show task assignment notification
  showTaskAssigned(task) {
    const title = "New Task Assigned";
    const options = {
      body: `${task.label}\nDue: ${task.dueDateTime || "No due date"}`,
      icon: "/favicon.ico",
      tag: `task-${task.id}`,
      data: { taskId: task.id, type: "task_assigned" }
    };

    return this.showNotification(title, options);
  }

  // Show task update notification
  showTaskUpdated(task) {
    const title = "Task Updated";
    const options = {
      body: `${task.label}\nStatus: ${task.status}`,
      icon: "/favicon.ico",
      tag: `task-update-${task.id}`,
      data: { taskId: task.id, type: "task_updated" }
    };

    return this.showNotification(title, options);
  }

  // Show general notification
  showGeneral(title, message, options = {}) {
    const notificationOptions = {
      body: message,
      icon: "/favicon.ico",
      tag: "general",
      ...options
    };

    return this.showNotification(title, notificationOptions);
  }

  // Check if notifications are supported and enabled
  isSupported() {
    return "Notification" in window;
  }

  // Check if permission is granted
  isEnabled() {
    return this.permission === "granted";
  }

  // Get current permission status
  getPermissionStatus() {
    return this.permission;
  }
}

// Create singleton instance
const notificationManager = new BrowserNotificationManager();

export default notificationManager;