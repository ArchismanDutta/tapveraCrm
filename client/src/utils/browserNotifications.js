// Browser notification utility for task assignments and changes

class BrowserNotificationManager {
  constructor() {
    this.permission = Notification.permission;
    this.audioContext = null;
    this.notificationSound = null;
    this.initializeAudio();
  }

  // Initialize audio context for notification sounds
  async initializeAudio() {
    try {
      // Create a simple notification sound using Web Audio API
      this.audioContext = new (window.AudioContext || window.webkitAudioContext)();
    } catch (error) {
      console.warn("Audio context not supported:", error);
    }
  }

  // Play notification sound
  playNotificationSound() {
    if (!this.audioContext) return;

    try {
      const oscillator = this.audioContext.createOscillator();
      const gainNode = this.audioContext.createGain();

      oscillator.connect(gainNode);
      gainNode.connect(this.audioContext.destination);

      // Create a pleasant notification sound (two-tone chime)
      oscillator.frequency.setValueAtTime(800, this.audioContext.currentTime);
      oscillator.frequency.setValueAtTime(600, this.audioContext.currentTime + 0.1);

      gainNode.gain.setValueAtTime(0.3, this.audioContext.currentTime);
      gainNode.gain.exponentialRampToValueAtTime(0.01, this.audioContext.currentTime + 0.3);

      oscillator.start(this.audioContext.currentTime);
      oscillator.stop(this.audioContext.currentTime + 0.3);
    } catch (error) {
      console.warn("Could not play notification sound:", error);
    }
  }

  // Vibrate device if supported
  vibrateDevice(pattern = [200, 100, 200]) {
    if ('vibrate' in navigator) {
      navigator.vibrate(pattern);
    }
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
      dir: "auto",
      lang: "en",
      renotify: true,
      ...options
    };

    try {
      const notification = new Notification(title, defaultOptions);

      // Play sound and vibrate for enhanced system integration
      if (!defaultOptions.silent) {
        this.playNotificationSound();
        this.vibrateDevice();
      }

      // Add click handler to focus the browser window
      notification.addEventListener('click', () => {
        window.focus();
        notification.close();

        // Try to bring browser window to front
        if (window.parent) {
          window.parent.focus();
        }
      });

      // Show system toast notification (if available)
      this.showSystemToast(title, defaultOptions.body);

      // Auto-close after 8 seconds (longer for better visibility)
      setTimeout(() => {
        notification.close();
      }, 8000);

      return notification;
    } catch (error) {
      console.error("Error showing notification:", error);
      return null;
    }
  }

  // Show system-level toast notification (experimental)
  showSystemToast(title, message) {
    try {
      // For Windows systems with Chrome, attempt to use the native notification API
      if ('serviceWorker' in navigator && 'showNotification' in ServiceWorkerRegistration.prototype) {
        navigator.serviceWorker.ready.then(registration => {
          registration.showNotification(title, {
            body: message,
            icon: '/favicon.ico',
            badge: '/favicon.ico',
            vibrate: [200, 100, 200],
            requireInteraction: false,
            actions: [
              {
                action: 'view',
                title: 'View Task',
                icon: '/favicon.ico'
              }
            ]
          });
        }).catch(error => {
          console.warn("Service Worker notification failed:", error);
        });
      }
    } catch (error) {
      console.warn("System toast notification not supported:", error);
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

    // Also trigger dynamic in-app notification
    this.showDynamicNotification({
      type: 'task',
      title: title,
      message: `${task.label}\nPriority: ${task.level}\nDue: ${task.dueDateTime || "No due date"}`,
      duration: 8000,
      action: {
        label: 'View Tasks',
        handler: () => {
          window.location.href = '/tasks';
        }
      }
    });

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

    // Also show dynamic notification
    this.showDynamicNotification({
      type: 'info',
      title: title,
      message: message,
      duration: 5000
    });

    return this.showNotification(title, notificationOptions);
  }

  // Show dynamic in-app notification
  showDynamicNotification(notification) {
    try {
      window.dispatchEvent(new CustomEvent('show-dynamic-notification', {
        detail: notification
      }));
    } catch (error) {
      console.warn("Could not show dynamic notification:", error);
    }
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