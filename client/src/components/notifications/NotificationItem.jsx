import React from "react";
import { Bell, CheckCircle, MessageCircle, DollarSign, Calendar, Briefcase, AlertCircle, X } from "lucide-react";
import { useNavigate } from "react-router-dom";
import { resolveNotificationTarget } from "../../utils/notificationTarget";

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
    const iconClass = "h-5 w-5";
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
        return "border-l-rose-500";
      case "high":
        return "border-l-amber-500";
      case "normal":
        return "border-l-blue-500";
      case "low":
        return "border-l-slate-400";
      default:
        return "border-l-blue-500";
    }
  };

  // Get icon background color
  const getIconBgColor = () => {
    switch (notification.type) {
      case "task":
        return "bg-violet-50 text-violet-600 dark:bg-violet-400/10 dark:text-violet-300";
      case "chat":
        return "bg-blue-50 text-blue-600 dark:bg-blue-400/10 dark:text-blue-300";
      case "payslip":
        return "bg-emerald-50 text-emerald-600 dark:bg-emerald-400/10 dark:text-emerald-300";
      case "leave":
        return "bg-amber-50 text-amber-600 dark:bg-amber-400/10 dark:text-amber-300";
      case "achievement":
        return "bg-cyan-50 text-cyan-600 dark:bg-cyan-400/10 dark:text-cyan-300";
      case "system":
        return "bg-orange-50 text-orange-600 dark:bg-orange-400/10 dark:text-orange-300";
      default:
        return "bg-slate-100 text-slate-500 dark:bg-white/[0.06] dark:text-slate-400";
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

    // Where this notification points is decided in one place, shared with the
    // toast and with OS notifications, so all three land on the same screen.
    try {
      const target = resolveNotificationTarget(notification);
      if (target) navigate(target.path, { state: target.state });
    } catch (error) {
      console.error('Navigation error:', error);
      // If navigation fails (e.g., access denied), show a message
      if (error.message?.includes('403') || error.message?.includes('Access denied')) {
        alert('You do not have access to this resource.');
      }
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
      // Light-mode remaps in index.css match class substrings and cannot see the
      // dark:/hover: prefix, so a bg-white/... or bg-gray-800 spelling here gets
      // repainted in light mode even though it is a dark-mode-only colour. The
      // rgb()/rgba() arbitrary value is the same colour the rule cannot match.
      // Do not "tidy" it back to bg-white/5 or bg-gray-800.
      <div
        onClick={handleClick}
        className={`group relative flex cursor-pointer items-start gap-3 border-l-2 p-3 transition-colors ${getPriorityColor()} ${
          notification.read ? "" : "bg-blue-50/50 dark:bg-blue-400/[0.035]"
        } hover:bg-slate-50 dark:hover:bg-[rgba(255,255,255,0.05)]`}
      >
        <div className={`shrink-0 rounded-lg p-2 ${getIconBgColor()}`}>
          {getIcon()}
        </div>
        <div className="flex-1 min-w-0">
          <div className="flex items-start justify-between gap-2">
            <p className="truncate text-sm font-medium text-slate-900 dark:text-white">{notification.title}</p>
            <span className="whitespace-nowrap text-xs text-slate-400 dark:text-slate-500">{getTimeAgo()}</span>
          </div>
          <p className="mt-1 line-clamp-2 text-xs text-slate-500 dark:text-slate-400">{notification.body}</p>
        </div>
        {!notification.read && (
          <div className="mt-2 h-2 w-2 shrink-0 rounded-full bg-blue-500"></div>
        )}
      </div>
    );
  }

  return (
    <div
      className={`group relative flex items-start gap-3 border-l-2 p-4 transition-colors sm:gap-4 ${getPriorityColor()} ${
        notification.read ? "" : "bg-blue-50/50 dark:bg-blue-400/[0.035]"
      } ${isSelected ? "bg-violet-50 dark:bg-violet-400/[0.08]" : ""} ${
        bulkMode ? "" : "hover:bg-slate-50 dark:hover:bg-[rgba(255,255,255,0.025)]"
      }`}
    >
      {/* Bulk Selection Checkbox */}
      {bulkMode && (
        <div className="flex items-center">
          <input
            type="checkbox"
            checked={isSelected}
            onChange={onToggleSelect}
            className="h-5 w-5 cursor-pointer rounded border-slate-300 bg-white text-violet-600 focus:ring-violet-500 dark:border-white/20 dark:bg-white/[0.06] dark:focus:ring-offset-[#10131c]"
            onClick={(e) => e.stopPropagation()}
          />
        </div>
      )}

      <div className={`shrink-0 rounded-xl p-2.5 sm:p-3 ${getIconBgColor()}`}>
        {getIcon()}
      </div>

      <div
        className={`flex-1 min-w-0 ${bulkMode ? "" : "cursor-pointer"}`}
        onClick={handleClick}
      >
        <div className="flex items-start justify-between gap-2 mb-1">
          <h4 className="text-sm font-semibold text-slate-950 dark:text-white">{notification.title}</h4>
          <span className="whitespace-nowrap text-xs text-slate-400 dark:text-slate-500">{getTimeAgo()}</span>
        </div>
        <p className="mb-2 text-sm leading-5 text-slate-600 dark:text-slate-300">{notification.body}</p>

        <div className="flex items-center gap-2 text-xs">
          <span
            className={`rounded-md px-2 py-1 font-medium capitalize ${
              notification.type === "task"
                ? "bg-violet-50 text-violet-700 dark:bg-violet-400/10 dark:text-violet-300"
                : notification.type === "chat"
                ? "bg-blue-50 text-blue-700 dark:bg-blue-400/10 dark:text-blue-300"
                : notification.type === "payslip"
                ? "bg-emerald-50 text-emerald-700 dark:bg-emerald-400/10 dark:text-emerald-300"
                : notification.type === "leave"
                ? "bg-amber-50 text-amber-700 dark:bg-amber-400/10 dark:text-amber-300"
                : notification.type === "achievement"
                ? "bg-cyan-50 text-cyan-700 dark:bg-cyan-400/10 dark:text-cyan-300"
                : "bg-slate-100 text-slate-600 dark:bg-white/[0.06] dark:text-slate-300"
            }`}
          >
            {notification.type}
          </span>
          {notification.priority !== "normal" && (
            <span className={`rounded-md px-2 py-1 font-medium capitalize ${
              notification.priority === "urgent" ? "bg-rose-50 text-rose-700 dark:bg-rose-400/10 dark:text-rose-300" :
              notification.priority === "high" ? "bg-amber-50 text-amber-700 dark:bg-amber-400/10 dark:text-amber-300" :
              "bg-slate-100 text-slate-600 dark:bg-white/[0.06] dark:text-slate-300"
            }`}>
              {notification.priority}
            </span>
          )}
        </div>
      </div>

      {/* Action Buttons (only show when not in bulk mode) */}
      {!bulkMode && (
        <div className="flex flex-col gap-1 opacity-100 transition-opacity sm:opacity-0 sm:group-focus-within:opacity-100 sm:group-hover:opacity-100">
          {!notification.read && (
            <button
              onClick={(e) => {
                e.stopPropagation();
                onMarkAsRead(notification._id);
              }}
              className="rounded-lg p-2 text-blue-600 transition-colors hover:bg-blue-50 dark:text-blue-300 dark:hover:bg-blue-400/10"
              title="Mark as read"
              aria-label={`Mark ${notification.title} as read`}
            >
              <CheckCircle className="w-4 h-4" />
            </button>
          )}
          <button
            onClick={(e) => {
              e.stopPropagation();
              onDelete(notification._id);
            }}
            className="rounded-lg p-2 text-rose-600 transition-colors hover:bg-rose-50 dark:text-rose-300 dark:hover:bg-rose-400/10"
            title="Delete"
            aria-label={`Delete ${notification.title}`}
          >
            <X className="w-4 h-4" />
          </button>
        </div>
      )}

      {!notification.read && !bulkMode && (
        <div className="absolute right-2 top-2 h-2 w-2 rounded-full bg-blue-500"></div>
      )}
    </div>
  );
};

export default NotificationItem;
