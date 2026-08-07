import React, { useRef, useEffect } from "react";
import { X, User, Calendar, Clock, Target, AlertCircle, MessageSquare, FileText } from "lucide-react";

const ViewTaskDetailsModal = ({ task, onClose }) => {
  const modalRef = useRef(null);

  const priorityColors = {
    High: "bg-red-100 dark:bg-red-900/30 text-red-800 dark:text-red-300 border-red-200 dark:border-red-800",
    Medium: "bg-orange-100 dark:bg-orange-900/30 text-orange-800 dark:text-orange-300 border-orange-200 dark:border-orange-800",
    Low: "bg-gray-100 dark:bg-gray-700 text-gray-800 dark:text-gray-300 border-gray-200 dark:border-gray-600",
  };

  const statusColors = {
    pending: "bg-yellow-100 dark:bg-yellow-900/30 text-yellow-800 dark:text-yellow-300 border-yellow-200 dark:border-yellow-800",
    "in-progress": "bg-blue-100 dark:bg-blue-900/30 text-blue-800 dark:text-blue-300 border-blue-200 dark:border-blue-800",
    completed: "bg-green-100 dark:bg-green-900/30 text-green-800 dark:text-green-300 border-green-200 dark:border-green-800",
    rejected: "bg-red-100 dark:bg-red-900/30 text-red-800 dark:text-red-300 border-red-200 dark:border-red-800",
  };

  // Handle click outside to close
  useEffect(() => {
    const handleClickOutside = (event) => {
      if (modalRef.current && !modalRef.current.contains(event.target)) {
        onClose();
      }
    };

    document.addEventListener("mousedown", handleClickOutside);
    return () => {
      document.removeEventListener("mousedown", handleClickOutside);
    };
  }, [onClose]);

  // Handle ESC key
  useEffect(() => {
    const handleEsc = (e) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", handleEsc);
    return () => window.removeEventListener("keydown", handleEsc);
  }, [onClose]);

  if (!task) return null;

  return (
    <div className="fixed inset-0 z-50 bg-black/50 backdrop-blur-sm overflow-y-auto">
      <div className="min-h-[100dvh] flex items-center justify-center p-4">
        <div
          ref={modalRef}
          className="relative bg-white dark:bg-gray-800 rounded-lg shadow-xl w-full max-w-2xl overflow-hidden"
        >
          {/* Header */}
          <div className="bg-gradient-to-r from-blue-600 to-blue-700 p-6 border-b border-blue-800">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="p-2 bg-white/20 rounded-lg">
                  <Target className="w-6 h-6 text-white" />
                </div>
                <div>
                  <h2 className="text-2xl font-bold text-white">Task Details</h2>
                  <p className="text-sm text-blue-100">Complete task information</p>
                </div>
              </div>
              <button
                onClick={onClose}
                className="p-2 hover:bg-white/10 rounded-lg transition-colors"
              >
                <X className="w-6 h-6 text-white" />
              </button>
            </div>
          </div>

          {/* Content */}
          <div className="p-6 max-h-[70vh] overflow-y-auto">
            {/* Task Title & Status */}
            <div className="mb-6">
              <div className="flex items-start justify-between gap-4 mb-3">
                <h3 className="text-2xl font-bold text-gray-900 dark:text-white flex-1">{task.title}</h3>
                <span
                  className={`px-3 py-1 text-sm font-semibold rounded-full border ${
                    statusColors[task.status]
                  }`}
                >
                  {task.status.replace("-", " ").toUpperCase()}
                </span>
              </div>
              {task.description && (
                <div className="bg-gray-50 dark:bg-gray-700 p-4 rounded-lg border border-gray-200 dark:border-gray-600">
                  <div className="flex items-start gap-2 mb-2">
                    <FileText className="w-4 h-4 text-gray-600 dark:text-gray-400 mt-0.5" />
                    <span className="text-sm font-medium text-gray-700 dark:text-gray-300">Description</span>
                  </div>
                  <p className="text-gray-700 dark:text-gray-300 text-sm leading-relaxed">{task.description}</p>
                </div>
              )}
            </div>

            {/* Task Details Grid */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-6">
              {/* Priority */}
              <div className="bg-gray-50 dark:bg-gray-700 p-4 rounded-lg border border-gray-200 dark:border-gray-600">
                <div className="flex items-center gap-2 mb-2">
                  <AlertCircle className="w-4 h-4 text-gray-600 dark:text-gray-400" />
                  <span className="text-sm font-medium text-gray-700 dark:text-gray-300">Priority</span>
                </div>
                <span
                  className={`inline-block px-3 py-1 text-sm font-semibold rounded-lg border ${
                    priorityColors[task.priority]
                  }`}
                >
                  {task.priority}
                </span>
              </div>

              {/* Due Date */}
              <div className="bg-gray-50 dark:bg-gray-700 p-4 rounded-lg border border-gray-200 dark:border-gray-600">
                <div className="flex items-center gap-2 mb-2">
                  <Calendar className="w-4 h-4 text-gray-600 dark:text-gray-400" />
                  <span className="text-sm font-medium text-gray-700 dark:text-gray-300">Due Date</span>
                </div>
                <p className="text-gray-900 dark:text-white font-medium">
                  {task.dueDate
                    ? new Date(task.dueDate).toLocaleDateString("en-US", {
                        month: "long",
                        day: "numeric",
                        year: "numeric",
                      })
                    : "No due date"}
                </p>
              </div>

              {/* Assigned To */}
              {task.assignedTo && task.assignedTo.length > 0 && (
                <div className="bg-gray-50 dark:bg-gray-700 p-4 rounded-lg border border-gray-200 dark:border-gray-600">
                  <div className="flex items-center gap-2 mb-2">
                    <User className="w-4 h-4 text-gray-600 dark:text-gray-400" />
                    <span className="text-sm font-medium text-gray-700 dark:text-gray-300">Assigned To</span>
                  </div>
                  <div className="space-y-1">
                    {task.assignedTo.map((assignee, idx) => (
                      <p key={idx} className="text-gray-900 dark:text-white font-medium">
                        {assignee.name || "N/A"}
                      </p>
                    ))}
                  </div>
                </div>
              )}

              {/* Assigned By */}
              {task.assignedBy && (
                <div className="bg-gray-50 dark:bg-gray-700 p-4 rounded-lg border border-gray-200 dark:border-gray-600">
                  <div className="flex items-center gap-2 mb-2">
                    <User className="w-4 h-4 text-gray-600 dark:text-gray-400" />
                    <span className="text-sm font-medium text-gray-700 dark:text-gray-300">Assigned By</span>
                  </div>
                  <p className="text-gray-900 dark:text-white font-medium">{task.assignedBy.name || "N/A"}</p>
                </div>
              )}

              {/* Created At */}
              <div className="bg-gray-50 dark:bg-gray-700 p-4 rounded-lg border border-gray-200 dark:border-gray-600">
                <div className="flex items-center gap-2 mb-2">
                  <Clock className="w-4 h-4 text-gray-600 dark:text-gray-400" />
                  <span className="text-sm font-medium text-gray-700 dark:text-gray-300">Created</span>
                </div>
                <p className="text-gray-900 dark:text-white font-medium">
                  {new Date(task.createdAt).toLocaleDateString("en-US", {
                    month: "short",
                    day: "numeric",
                    year: "numeric",
                  })}
                </p>
              </div>

              {/* Last Updated */}
              <div className="bg-gray-50 dark:bg-gray-700 p-4 rounded-lg border border-gray-200 dark:border-gray-600">
                <div className="flex items-center gap-2 mb-2">
                  <Clock className="w-4 h-4 text-gray-600 dark:text-gray-400" />
                  <span className="text-sm font-medium text-gray-700 dark:text-gray-300">Last Updated</span>
                </div>
                <p className="text-gray-900 dark:text-white font-medium">
                  {new Date(task.updatedAt).toLocaleDateString("en-US", {
                    month: "short",
                    day: "numeric",
                    year: "numeric",
                  })}
                </p>
              </div>
            </div>

            {/* Remarks Section */}
            {task.remarks && task.remarks.length > 0 && (
              <div className="bg-blue-50 dark:bg-blue-900/20 p-4 rounded-lg border border-blue-200 dark:border-blue-800">
                <div className="flex items-center gap-2 mb-3">
                  <MessageSquare className="w-4 h-4 text-blue-600 dark:text-blue-400" />
                  <span className="text-sm font-semibold text-blue-900 dark:text-blue-300">
                    Remarks ({task.remarks.length})
                  </span>
                </div>
                <div className="space-y-3 max-h-60 overflow-y-auto">
                  {task.remarks.map((remark, idx) => (
                    <div key={idx} className="bg-white dark:bg-gray-700 p-3 rounded-lg border border-blue-100 dark:border-blue-800/50">
                      <p className="text-sm text-gray-900 dark:text-gray-100 mb-2">{remark.text}</p>
                      <div className="flex items-center justify-between text-xs text-gray-600 dark:text-gray-400">
                        <span className="font-medium">{remark.user?.name || "Unknown"}</span>
                        <span>
                          {new Date(remark.createdAt).toLocaleString("en-US", {
                            month: "short",
                            day: "numeric",
                            hour: "2-digit",
                            minute: "2-digit",
                          })}
                        </span>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>

          {/* Footer */}
          <div className="bg-gray-50 dark:bg-gray-700 px-6 py-4 border-t border-gray-200 dark:border-gray-600 flex justify-end">
            <button
              onClick={onClose}
              className="px-6 py-2 bg-gray-200 dark:bg-gray-600 hover:bg-gray-300 dark:hover:bg-gray-500 text-gray-800 dark:text-white font-medium rounded-lg transition-colors"
            >
              Close
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

export default ViewTaskDetailsModal;
