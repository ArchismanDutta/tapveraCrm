import React, { useState, useEffect, useCallback } from 'react';

const DynamicNotificationOverlay = () => {
  const [notifications, setNotifications] = useState([]);

  // Add a new notification
  const addNotification = useCallback((notification) => {
    const id = Date.now() + Math.random();
    const newNotification = {
      id,
      timestamp: new Date(),
      ...notification
    };

    setNotifications(prev => [newNotification, ...prev.slice(0, 4)]); // Keep max 5 notifications

    // Auto-remove after duration
    setTimeout(() => {
      removeNotification(id);
    }, notification.duration || 6000);
  }, []);

  // Remove notification
  const removeNotification = useCallback((id) => {
    setNotifications(prev => prev.filter(n => n.id !== id));
  }, []);

  // Listen for custom notification events
  useEffect(() => {
    const handleCustomNotification = (event) => {
      addNotification(event.detail);
    };

    window.addEventListener('show-dynamic-notification', handleCustomNotification);
    return () => window.removeEventListener('show-dynamic-notification', handleCustomNotification);
  }, [addNotification]);

  // Notification types with styles
  const getNotificationStyle = (type) => {
    const baseStyle = "transform transition-all duration-500 ease-in-out mb-3 rounded-lg shadow-2xl border-l-4 backdrop-blur-sm";

    switch (type) {
      case 'task':
        return `${baseStyle} bg-blue-900/90 border-l-blue-400 text-blue-100`;
      case 'success':
        return `${baseStyle} bg-green-900/90 border-l-green-400 text-green-100`;
      case 'warning':
        return `${baseStyle} bg-yellow-900/90 border-l-yellow-400 text-yellow-100`;
      case 'error':
        return `${baseStyle} bg-red-900/90 border-l-red-400 text-red-100`;
      case 'info':
        return `${baseStyle} bg-indigo-900/90 border-l-indigo-400 text-indigo-100`;
      default:
        return `${baseStyle} bg-gray-900/90 border-l-gray-400 text-gray-100`;
    }
  };

  // Get icon for notification type
  const getNotificationIcon = (type) => {
    switch (type) {
      case 'task':
        return '📋';
      case 'success':
        return '✅';
      case 'warning':
        return '⚠️';
      case 'error':
        return '❌';
      case 'info':
        return 'ℹ️';
      default:
        return '🔔';
    }
  };

  if (notifications.length === 0) return null;

  return (
    <div className="fixed top-4 right-4 z-[9999] max-w-sm w-full pointer-events-none">
      {notifications.map((notification, index) => (
        <div
          key={notification.id}
          className={`${getNotificationStyle(notification.type)} pointer-events-auto animate-slide-in-right`}
          style={{
            animationDelay: `${index * 100}ms`,
            transform: `translateY(${index * 5}px) scale(${1 - index * 0.05})`
          }}
        >
          <div className="p-4 flex items-start space-x-3">
            <div className="flex-shrink-0 text-2xl">
              {getNotificationIcon(notification.type)}
            </div>
            <div className="flex-1 min-w-0">
              <div className="flex items-center justify-between">
                <h4 className="text-sm font-semibold truncate">
                  {notification.title}
                </h4>
                <button
                  onClick={() => removeNotification(notification.id)}
                  className="ml-2 text-gray-400 hover:text-white transition-colors"
                >
                  ×
                </button>
              </div>
              <p className="text-xs text-gray-300 mt-1 line-clamp-2">
                {notification.message}
              </p>
              <div className="flex items-center justify-between mt-2">
                <span className="text-xs text-gray-400">
                  {notification.timestamp.toLocaleTimeString()}
                </span>
                {notification.action && (
                  <button
                    onClick={notification.action.handler}
                    className="text-xs bg-white/20 hover:bg-white/30 px-2 py-1 rounded transition-colors"
                  >
                    {notification.action.label}
                  </button>
                )}
              </div>
            </div>
          </div>

          {/* Progress bar for auto-dismiss */}
          <div className="w-full bg-gray-700/50 h-1">
            <div
              className="h-full bg-gradient-to-r from-blue-400 to-purple-400 animate-progress-bar"
              style={{ animationDuration: `${notification.duration || 6000}ms` }}
            />
          </div>
        </div>
      ))}

      <style jsx>{`
        @keyframes slide-in-right {
          from {
            opacity: 0;
            transform: translateX(100%);
          }
          to {
            opacity: 1;
            transform: translateX(0);
          }
        }

        @keyframes progress-bar {
          from {
            width: 100%;
          }
          to {
            width: 0%;
          }
        }

        .animate-slide-in-right {
          animation: slide-in-right 0.5s ease-out;
        }

        .animate-progress-bar {
          animation: progress-bar linear;
        }

        .line-clamp-2 {
          display: -webkit-box;
          -webkit-line-clamp: 2;
          -webkit-box-orient: vertical;
          overflow: hidden;
        }
      `}</style>
    </div>
  );
};

// Utility function to show notifications from anywhere in the app
export const showDynamicNotification = (notification) => {
  window.dispatchEvent(new CustomEvent('show-dynamic-notification', {
    detail: notification
  }));
};

export default DynamicNotificationOverlay;