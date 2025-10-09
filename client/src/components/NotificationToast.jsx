import React, { useEffect, useState } from "react";
import { X, FileText, Bell } from "lucide-react";

const NotificationToast = ({ notification, onClose }) => {
  const [isVisible, setIsVisible] = useState(false);

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

  const getIcon = () => {
    if (notification.channel === "payslip") {
      return <FileText className="w-6 h-6 text-green-400" />;
    }
    return <Bell className="w-6 h-6 text-blue-400" />;
  };

  const getBgColor = () => {
    if (notification.channel === "payslip") {
      return "from-green-900/90 to-green-800/90 border-green-500/50";
    }
    return "from-blue-900/90 to-blue-800/90 border-blue-500/50";
  };

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
            <p className="text-gray-200 text-sm mt-1 leading-snug">
              {notification.message}
            </p>

            {/* Additional Info */}
            {notification.netPayment && (
              <div className="mt-2 pt-2 border-t border-white/20">
                <p className="text-xs text-gray-300">
                  Net Salary: <span className="font-bold text-green-300">
                    {new Intl.NumberFormat('en-IN', {
                      style: 'currency',
                      currency: 'INR',
                      minimumFractionDigits: 0
                    }).format(notification.netPayment)}
                  </span>
                </p>
              </div>
            )}

            {/* Action Button */}
            {notification.action === "view_payslip" && (
              <button
                onClick={() => {
                  window.location.hash = "#payslip";
                  handleClose();
                }}
                className="mt-3 w-full py-2 px-3 bg-white/20 hover:bg-white/30 text-white text-sm font-medium rounded-lg transition-colors"
              >
                View Payslip
              </button>
            )}
          </div>
        </div>

        {/* Progress bar for auto-close */}
        <div className="mt-3 h-1 bg-white/20 rounded-full overflow-hidden">
          <div
            className="h-full bg-white/60 rounded-full animate-shrink"
            style={{
              animation: "shrink 10s linear forwards"
            }}
          />
        </div>
      </div>

      <style jsx>{`
        @keyframes shrink {
          from {
            width: 100%;
          }
          to {
            width: 0%;
          }
        }
      `}</style>
    </div>
  );
};

export default NotificationToast;
