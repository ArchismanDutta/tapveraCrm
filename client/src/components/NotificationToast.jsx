import React, { useEffect, useState } from "react";
import { X, FileText, Bell, MessageSquare, CheckSquare, AtSign } from "lucide-react";
import { useNavigate } from "react-router-dom";

const NotificationToast = ({ notification, onClose }) => {
  const [isVisible, setIsVisible] = useState(false);
  const navigate = useNavigate();

  useEffect(() => {
    setIsVisible(true);

    // Auto-close after 10 seconds
    const timer = setTimeout(() => {
      handleClose();
    }, 10000);

    return () => clearTimeout(timer);
  }, []);

  const handleClose = () => {
    setIsVisible(false);
    setTimeout(() => onClose(), 300); // Wait for animation
  };

  const channel = (notification.channel || "").toLowerCase();

  const getIcon = () => {
    if (channel === "payslip") return <FileText className="w-6 h-6 text-green-400" />;
    if (channel === "chat")    return <MessageSquare className="w-6 h-6 text-blue-400" />;
    if (channel === "task")    return <CheckSquare className="w-6 h-6 text-purple-400" />;
    if (channel === "mention") return <AtSign className="w-6 h-6 text-orange-400" />;
    return <Bell className="w-6 h-6 text-blue-400" />;
  };

  const getBgColor = () => {
    if (channel === "payslip") return "from-green-900/90 to-green-800/90 border-green-500/50";
    if (channel === "chat")    return "from-blue-900/90 to-blue-800/90 border-blue-500/50";
    if (channel === "task")    return "from-purple-900/90 to-purple-800/90 border-purple-500/50";
    if (channel === "mention") return "from-orange-900/90 to-orange-800/90 border-orange-500/50";
    return "from-slate-900/90 to-slate-800/90 border-slate-500/50";
  };

  // Click-to-navigate for actionable notification types
  const handleActionClick = () => {
    if (channel === "payslip") {
      window.location.hash = "#payslip";
    } else if (channel === "chat" && notification.conversationId) {
      navigate("/chat");
    } else if (channel === "task") {
      navigate("/tasks");
    }
    handleClose();
  };

  const hasAction = ["payslip", "chat", "task"].includes(channel);
  const actionLabel =
    channel === "payslip" ? "View Payslip" :
    channel === "chat"    ? "Open Chat" :
    channel === "task"    ? "View Tasks" : null;

  // Server sends `body`; fall back to `message` for older payloads
  const bodyText = notification.body || notification.message || "";

  return (
    <div
      className={`fixed top-4 right-4 z-[9999] transition-all duration-300 transform ${
        isVisible ? "translate-x-0 opacity-100" : "translate-x-full opacity-0"
      }`}
      style={{ width: "360px" }}
    >
      <div
        className={`bg-gradient-to-r ${getBgColor()} border-2 rounded-xl shadow-2xl p-4 backdrop-blur-sm`}
      >
        <div className="flex items-start gap-3">
          {/* Icon */}
          <div className="flex-shrink-0 mt-1">{getIcon()}</div>

          {/* Content */}
          <div className="flex-1 min-w-0">
            <div className="flex items-start justify-between gap-2">
              <h4 className="text-white font-semibold text-sm leading-tight">
                {notification.title}
              </h4>
              <button
                onClick={handleClose}
                className="flex-shrink-0 p-1 hover:bg-white/10 rounded transition-colors"
              >
                <X className="w-4 h-4 text-gray-300" />
              </button>
            </div>
            <p className="text-gray-200 text-sm mt-1 leading-snug">{bodyText}</p>

            {/* Payslip net salary detail */}
            {notification.netPayment && (
              <div className="mt-2 pt-2 border-t border-white/20">
                <p className="text-xs text-gray-300">
                  Net Salary:{" "}
                  <span className="font-bold text-green-300">
                    {new Intl.NumberFormat("en-IN", {
                      style: "currency",
                      currency: "INR",
                      minimumFractionDigits: 0,
                    }).format(notification.netPayment)}
                  </span>
                </p>
              </div>
            )}

            {/* Action Button */}
            {hasAction && actionLabel && (
              <button
                onClick={handleActionClick}
                className="mt-3 w-full py-2 px-3 bg-white/20 hover:bg-white/30 text-white text-sm font-medium rounded-lg transition-colors"
              >
                {actionLabel}
              </button>
            )}
          </div>
        </div>

        {/* Progress bar for auto-close */}
        <div className="mt-3 h-1 bg-white/20 rounded-full overflow-hidden">
          <div
            className="h-full bg-white/60 rounded-full"
            style={{ animation: "toast-shrink 10s linear forwards" }}
          />
        </div>
      </div>

      <style>{`
        @keyframes toast-shrink {
          from { width: 100%; }
          to   { width: 0%; }
        }
      `}</style>
    </div>
  );
};

export default NotificationToast;
