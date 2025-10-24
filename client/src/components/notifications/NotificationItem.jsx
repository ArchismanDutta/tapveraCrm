import React from "react";
import { Bell, CheckCircle, MessageCircle, DollarSign, Calendar, Briefcase, AlertCircle, X } from "lucide-react";
import { useNavigate } from "react-router-dom";

const NotificationItem = ({
  notification,
  onMarkAsRead,
  onDelete,
  compact = false,
  bulkMode = false,
  isSelected = false,
  onToggleSelect
}) => {
  const navigate = useNavigate();

  // Get icon based on notification type
  const getIcon = () => {
    const iconClass = "w-5 h-5";
    switch (notification.type) {
      case "task":
        return <Briefcase className={iconClass} />;
      case "chat":
        return <MessageCircle className={iconClass} />;
      case "payslip":
        return <DollarSign className={iconClass} />;
      case "leave":
        return <Calendar className={iconClass} />;
      case "achievement":
        return <CheckCircle className={iconClass} />;
      case "system":
        return <AlertCircle className={iconClass} />;
      default:
        return <Bell className={iconClass} />;
    }
  };

  // Get color based on priority
  const getPriorityColor = () => {
    switch (notification.priority) {
      case "urgent":
        return "border-l-red-500 bg-red-500/5";
      case "high":
        return "border-l-orange-500 bg-orange-500/5";
      case "normal":
        return "border-l-blue-500 bg-blue-500/5";
      case "low":
        return "border-l-gray-500 bg-gray-500/5";
      default:
        return "border-l-blue-500 bg-blue-500/5";
    }
  };

  // Get icon background color
  const getIconBgColor = () => {
    switch (notification.type) {
      case "task":
        return "bg-purple-500/20 text-purple-400";
      case "chat":
        return "bg-blue-500/20 text-blue-400";
      case "payslip":
        return "bg-green-500/20 text-green-400";
      case "leave":
        return "bg-yellow-500/20 text-yellow-400";
      case "achievement":
        return "bg-cyan-500/20 text-cyan-400";
      case "system":
        return "bg-orange-500/20 text-orange-400";
      default:
        return "bg-gray-500/20 text-gray-400";
    }
  };

  // Handle click - navigate to related content
  const handleClick = async (e) => {
    // Don't navigate if in bulk mode or clicking on action buttons/checkboxes
    if (bulkMode || e.target.closest('button') || e.target.closest('input[type="checkbox"]')) {
      return;
    }

    e.stopPropagation(); // Prevent event bubbling

    // Mark as read first if unread
    if (!notification.read) {
      await onMarkAsRead(notification._id);
    }

    // Small delay to ensure state updates
    await new Promise(resolve => setTimeout(resolve, 100));

    // Navigate based on notification type
    if (notification.relatedData?.url) {
      navigate(notification.relatedData.url);
    } else if (notification.relatedData?.taskId) {
      navigate(`/tasks`);
    } else if (notification.relatedData?.conversationId) {
      navigate(`/messages`);
    } else if (notification.relatedData?.payslipId) {
      navigate(`/payslips`);
    }
  };

  // Format time ago
  const getTimeAgo = () => {
    const now = new Date();
    const notificationDate = new Date(notification.createdAt);
    const diffMs = now - notificationDate;
    const diffMins = Math.floor(diffMs / 60000);
    const diffHours = Math.floor(diffMins / 60);
    const diffDays = Math.floor(diffHours / 24);

    if (diffMins < 1) return "Just now";
    if (diffMins < 60) return `${diffMins}m ago`;
    if (diffHours < 24) return `${diffHours}h ago`;
    if (diffDays < 7) return `${diffDays}d ago`;
    return notificationDate.toLocaleDateString();
  };

  if (compact) {
    return (
      <div
        onClick={handleClick}
        className={`flex items-start gap-3 p-3 border-l-4 ${getPriorityColor()} ${
          notification.read ? "opacity-60" : ""
        } hover:bg-slate-700/50 cursor-pointer transition-all group relative`}
      >
        <div className={`p-2 rounded-lg ${getIconBgColor()} flex-shrink-0`}>
          {getIcon()}
        </div>
        <div className="flex-1 min-w-0">
          <div className="flex items-start justify-between gap-2">
            <p className="text-sm font-medium text-white truncate">{notification.title}</p>
            <span className="text-xs text-gray-400 whitespace-nowrap">{getTimeAgo()}</span>
          </div>
          <p className="text-xs text-gray-400 mt-1 line-clamp-2">{notification.body}</p>
        </div>
        {!notification.read && (
          <div className="w-2 h-2 bg-blue-500 rounded-full flex-shrink-0 mt-2"></div>
        )}
      </div>
    );
  }

  return (
    <div
      className={`flex items-start gap-4 p-4 border-l-4 ${getPriorityColor()} ${
        notification.read ? "opacity-70" : ""
      } ${isSelected ? "bg-purple-900/20 border-purple-500/50" : ""} ${
        bulkMode ? "" : "hover:bg-slate-700/30"
      } transition-all group relative rounded-r-lg`}
    >
      {/* Bulk Selection Checkbox */}
      {bulkMode && (
        <div className="flex items-center">
          <input
            type="checkbox"
            checked={isSelected}
            onChange={onToggleSelect}
            className="w-5 h-5 rounded border-slate-600 bg-slate-700 text-purple-600 focus:ring-purple-500 focus:ring-offset-slate-800 cursor-pointer"
            onClick={(e) => e.stopPropagation()}
          />
        </div>
      )}

      <div className={`p-3 rounded-lg ${getIconBgColor()} flex-shrink-0`}>
        {getIcon()}
      </div>

      <div
        className={`flex-1 min-w-0 ${bulkMode ? "" : "cursor-pointer"}`}
        onClick={handleClick}
      >
        <div className="flex items-start justify-between gap-2 mb-1">
          <h4 className="text-sm font-semibold text-white">{notification.title}</h4>
          <span className="text-xs text-gray-400 whitespace-nowrap">{getTimeAgo()}</span>
        </div>
        <p className="text-sm text-gray-300 mb-2">{notification.body}</p>

        <div className="flex items-center gap-2 text-xs">
          <span
            className={`px-2 py-1 rounded ${
              notification.type === "task"
                ? "bg-purple-500/20 text-purple-400"
                : notification.type === "chat"
                ? "bg-blue-500/20 text-blue-400"
                : notification.type === "payslip"
                ? "bg-green-500/20 text-green-400"
                : notification.type === "leave"
                ? "bg-yellow-500/20 text-yellow-400"
                : notification.type === "achievement"
                ? "bg-cyan-500/20 text-cyan-400"
                : "bg-gray-500/20 text-gray-400"
            }`}
          >
            {notification.type}
          </span>
          {notification.priority !== "normal" && (
            <span className={`px-2 py-1 rounded ${
              notification.priority === "urgent" ? "bg-red-500/20 text-red-400" :
              notification.priority === "high" ? "bg-orange-500/20 text-orange-400" :
              "bg-gray-500/20 text-gray-400"
            }`}>
              {notification.priority}
            </span>
          )}
        </div>
      </div>

      {/* Action Buttons (only show when not in bulk mode) */}
      {!bulkMode && (
        <div className="flex flex-col gap-2 opacity-0 group-hover:opacity-100 transition-opacity">
          {!notification.read && (
            <button
              onClick={(e) => {
                e.stopPropagation();
                onMarkAsRead(notification._id);
              }}
              className="p-2 hover:bg-blue-500/20 rounded-lg text-blue-400 transition-colors"
              title="Mark as read"
            >
              <CheckCircle className="w-4 h-4" />
            </button>
          )}
          <button
            onClick={(e) => {
              e.stopPropagation();
              onDelete(notification._id);
            }}
            className="p-2 hover:bg-red-500/20 rounded-lg text-red-400 transition-colors"
            title="Delete"
          >
            <X className="w-4 h-4" />
          </button>
        </div>
      )}

      {!notification.read && !bulkMode && (
        <div className="absolute right-2 top-2 w-2 h-2 bg-blue-500 rounded-full animate-pulse"></div>
      )}
    </div>
  );
};

export default NotificationItem;
