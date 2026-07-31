import React from "react";
import { X, AlertTriangle, CheckCircle, Info, AlertCircle } from "lucide-react";

/**
 * ConfirmDialog - Reusable confirmation dialog component
 *
 * @param {boolean} isOpen - Controls dialog visibility
 * @param {function} onClose - Called when dialog is closed without confirming
 * @param {function} onConfirm - Called when user confirms the action
 * @param {string} title - Dialog title
 * @param {string} message - Dialog message/description
 * @param {string} confirmText - Text for confirm button (default: "Confirm")
 * @param {string} cancelText - Text for cancel button (default: "Cancel")
 * @param {string} variant - Dialog variant: "danger", "warning", "success", "info" (default: "warning")
 * @param {boolean} loading - Shows loading state on confirm button
 */
const ConfirmDialog = ({
  isOpen,
  onClose,
  onConfirm,
  title = "Are you sure?",
  message = "This action cannot be undone.",
  confirmText = "Confirm",
  cancelText = "Cancel",
  variant = "warning",
  loading = false,
}) => {
  if (!isOpen) return null;

  const variantConfig = {
    danger: {
      icon: AlertTriangle,
      iconColor: "text-red-500",
      iconBg: "bg-red-500/20",
      confirmButton: "bg-red-600 hover:bg-red-700 focus:ring-red-500",
    },
    warning: {
      icon: AlertCircle,
      iconColor: "text-yellow-500",
      iconBg: "bg-yellow-500/20",
      confirmButton: "bg-yellow-600 hover:bg-yellow-700 focus:ring-yellow-500",
    },
    success: {
      icon: CheckCircle,
      iconColor: "text-green-500",
      iconBg: "bg-green-500/20",
      confirmButton: "bg-green-600 hover:bg-green-700 focus:ring-green-500",
    },
    info: {
      icon: Info,
      iconColor: "text-blue-500",
      iconBg: "bg-blue-500/20",
      confirmButton: "bg-blue-600 hover:bg-blue-700 focus:ring-blue-500",
    },
  };

  const config = variantConfig[variant] || variantConfig.warning;
  const Icon = config.icon;

  const handleBackdropClick = (e) => {
    if (e.target === e.currentTarget) {
      onClose();
    }
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-sm p-4 animate-fade-in"
      onClick={handleBackdropClick}
    >
      <div className="bg-white dark:bg-[#1a1f2e] rounded-xl shadow-2xl border border-gray-200 dark:border-gray-700 w-full max-w-md animate-slide-up">
        {/* Header */}
        <div className="flex items-center justify-between p-6 border-b border-gray-200 dark:border-gray-700">
          <div className="flex items-center gap-3">
            <div className={`p-2 rounded-lg ${config.iconBg}`}>
              <Icon className={`w-6 h-6 ${config.iconColor}`} />
            </div>
            <h2 className="text-xl font-bold text-gray-900 dark:text-white">
              {title}
            </h2>
          </div>
          <button
            onClick={onClose}
            disabled={loading}
            className="p-2 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-lg transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
          >
            <X className="w-5 h-5 text-gray-600 dark:text-gray-400" />
          </button>
        </div>

        {/* Content */}
        <div className="p-6">
          <p className="text-gray-700 dark:text-gray-300 text-base leading-relaxed">
            {message}
          </p>
        </div>

        {/* Footer */}
        <div className="flex items-center justify-end gap-3 p-6 border-t border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-[#0f1419] rounded-b-xl">
          <button
            onClick={onClose}
            disabled={loading}
            className="px-6 py-2.5 bg-gray-200 dark:bg-gray-700 hover:bg-gray-300 dark:hover:bg-gray-600 text-gray-900 dark:text-white rounded-lg transition-colors font-medium disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {cancelText}
          </button>
          <button
            onClick={onConfirm}
            disabled={loading}
            className={`px-6 py-2.5 text-white rounded-lg transition-all font-medium focus:outline-none focus:ring-2 focus:ring-offset-2 disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2 ${config.confirmButton}`}
          >
            {loading && (
              <div className="w-4 h-4 border-2 border-white/20 border-t-white rounded-full animate-spin" />
            )}
            {confirmText}
          </button>
        </div>
      </div>

      <style jsx>{`
        @keyframes fade-in {
          from {
            opacity: 0;
          }
          to {
            opacity: 1;
          }
        }

        @keyframes slide-up {
          from {
            opacity: 0;
            transform: translateY(20px) scale(0.95);
          }
          to {
            opacity: 1;
            transform: translateY(0) scale(1);
          }
        }

        .animate-fade-in {
          animation: fade-in 0.2s ease-out;
        }

        .animate-slide-up {
          animation: slide-up 0.3s ease-out;
        }
      `}</style>
    </div>
  );
};

export default ConfirmDialog;
