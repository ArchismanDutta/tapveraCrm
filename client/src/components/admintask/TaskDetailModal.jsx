import React, { useRef, useEffect } from "react";
import { X, User, Calendar, Clock, Target, AlertCircle, History, MessageSquare } from "lucide-react";
import dayjs from "dayjs";

const TaskDetailModal = ({ task, onClose }) => {
  const modalRef = useRef(null);

  if (!task) return null;

  // Debug logging
  console.log("TaskDetailModal - Full task data:", task);
  console.log("TaskDetailModal - statusHistory:", task.statusHistory);

  const priorityColors = {
    High: "text-red-400 bg-red-500/10 border-red-500/30",
    Medium: "text-yellow-400 bg-yellow-500/10 border-yellow-500/30",
    Low: "text-green-400 bg-green-500/10 border-green-500/30",
  };

  const statusColors = {
    pending: "text-gray-400 bg-gray-500/10 border-gray-500/30",
    "in-progress": "text-blue-400 bg-blue-500/10 border-blue-500/30",
    completed: "text-green-400 bg-green-500/10 border-green-500/30",
    rejected: "text-red-400 bg-red-500/10 border-red-500/30",
  };

  const getStatusIcon = (status) => {
    switch(status) {
      case 'completed': return '✅';
      case 'rejected': return '❌';
      case 'in-progress': return '🔄';
      case 'pending': return '⏳';
      default: return '📝';
    }
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

  return (
    <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-xl overflow-y-auto">
      <div className="min-h-screen flex items-start justify-center p-4 pt-8">
        <div
          ref={modalRef}
          className="relative bg-gradient-to-br from-slate-800/95 to-slate-900/95 backdrop-blur-xl border border-slate-600/50 rounded-3xl shadow-2xl w-full max-w-3xl overflow-hidden"
        >
        {/* Header */}
        <div className="bg-gradient-to-r from-cyan-500/20 to-blue-600/20 p-4 border-b border-slate-600/50">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <div className="p-1.5 bg-blue-500/20 rounded-lg">
                <Target className="w-5 h-5 text-blue-400" />
              </div>
              <div>
                <h2 className="text-xl font-bold text-white">Task Details</h2>
                <p className="text-xs text-blue-300">Complete task information and history</p>
              </div>
            </div>
            <button
              onClick={onClose}
              className="p-1.5 hover:bg-white/10 rounded-lg transition-colors"
            >
              <X className="w-5 h-5 text-gray-400 hover:text-white" />
            </button>
          </div>
        </div>

        {/* Content */}
        <div className="p-4">
          {/* Task Title & Status */}
          <div className="mb-4">
            <div className="flex items-start justify-between gap-4 mb-2">
              <h3 className="text-xl font-bold text-white flex-1">{task.title}</h3>
              <span className={`px-2 py-1 text-xs font-semibold rounded-full border ${statusColors[task.status]}`}>
                {getStatusIcon(task.status)} {task.status.replace("-", " ").toUpperCase()}
              </span>
            </div>
            {task.description && (
              <p className="text-blue-200 text-sm leading-relaxed bg-blue-950/30 p-3 rounded-lg border border-blue-900/30">
                {task.description}
              </p>
            )}
          </div>

          {/* Task Details Grid */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3 mb-4">
            {/* Priority */}
            <div className="bg-gradient-to-br from-slate-700/50 to-slate-800/50 p-3 rounded-xl border border-slate-600/30">
              <div className="flex items-center gap-2 mb-1">
                <AlertCircle className="w-4 h-4 text-blue-400" />
                <span className="text-xs text-gray-400">Priority</span>
              </div>
              <span className={`inline-block px-2 py-0.5 text-xs font-semibold rounded-lg border ${priorityColors[task.priority]}`}>
                {task.priority}
              </span>
            </div>

            {/* Due Date */}
            <div className="bg-gradient-to-br from-slate-700/50 to-slate-800/50 p-3 rounded-xl border border-slate-600/30">
              <div className="flex items-center gap-2 mb-1">
                <Calendar className="w-4 h-4 text-blue-400" />
                <span className="text-xs text-gray-400">Due Date</span>
              </div>
              <p className="text-white text-sm font-medium">
                {task.dueDate ? dayjs(task.dueDate).format("DD MMM YYYY, hh:mm A") : "No due date"}
              </p>
            </div>

            {/* Assigned By */}
            <div className="bg-gradient-to-br from-slate-700/50 to-slate-800/50 p-3 rounded-xl border border-slate-600/30">
              <div className="flex items-center gap-2 mb-1">
                <User className="w-4 h-4 text-blue-400" />
                <span className="text-xs text-gray-400">Assigned By</span>
              </div>
              <p className="text-white text-sm font-medium">{task.assignedBy?.name || "Unknown"}</p>
              <p className="text-xs text-gray-400">{task.assignedBy?.email || ""}</p>
            </div>

            {/* Created At */}
            <div className="bg-gradient-to-br from-slate-700/50 to-slate-800/50 p-3 rounded-xl border border-slate-600/30">
              <div className="flex items-center gap-2 mb-1">
                <Clock className="w-4 h-4 text-blue-400" />
                <span className="text-xs text-gray-400">Created At</span>
              </div>
              <p className="text-white text-sm font-medium">
                {dayjs(task.createdAt).format("DD MMM YYYY, hh:mm A")}
              </p>
            </div>
          </div>

          {/* Assigned To */}
          <div className="bg-gradient-to-br from-slate-700/50 to-slate-800/50 p-3 rounded-xl border border-slate-600/30 mb-4">
            <div className="flex items-center gap-2 mb-2">
              <User className="w-4 h-4 text-blue-400" />
              <span className="text-xs font-semibold text-gray-300">Assigned To ({task.assignedTo?.length || 0})</span>
            </div>
            <div className="flex flex-wrap gap-2">
              {task.assignedTo && task.assignedTo.length > 0 ? (
                task.assignedTo.map((user, idx) => (
                  <div
                    key={idx}
                    className="flex items-center gap-2 bg-blue-900/30 px-2 py-1.5 rounded-lg border border-blue-700/30"
                  >
                    <div className="w-6 h-6 rounded-full bg-gradient-to-br from-blue-500 to-purple-500 flex items-center justify-center text-white font-semibold text-xs">
                      {user.name?.charAt(0).toUpperCase() || "U"}
                    </div>
                    <div>
                      <p className="text-white text-xs font-medium">{user.name || "Unknown"}</p>
                      <p className="text-xs text-gray-400">{user.email || ""}</p>
                    </div>
                  </div>
                ))
              ) : (
                <p className="text-gray-400 text-xs">No users assigned</p>
              )}
            </div>
          </div>

          {/* Status History */}
          <div className="bg-gradient-to-br from-slate-700/50 to-slate-800/50 p-3 rounded-xl border border-slate-600/30 mb-4">
            <div className="flex items-center gap-2 mb-2">
              <History className="w-4 h-4 text-blue-400" />
              <span className="text-sm font-semibold text-white">Status History</span>
              <span className="text-xs text-gray-400">
                ({task.statusHistory?.length || 0} updates)
              </span>
            </div>

            {task.statusHistory && task.statusHistory.length > 0 ? (
              <div className="space-y-2">
                {task.statusHistory.map((history, idx) => (
                  <div
                    key={idx}
                    className="flex items-start gap-2 p-2 bg-slate-900/50 rounded-lg border border-slate-700/30 hover:border-blue-700/40 transition-colors"
                  >
                    {/* Timeline dot */}
                    <div className="flex flex-col items-center mt-1">
                      <div className={`w-2 h-2 rounded-full ${statusColors[history.status]?.replace('text-', 'bg-').replace('bg-', 'bg-').split(' ')[0]}`}></div>
                      {idx < task.statusHistory.length - 1 && (
                        <div className="w-0.5 h-full bg-slate-700 mt-1"></div>
                      )}
                    </div>

                    {/* Content */}
                    <div className="flex-1">
                      <div className="flex items-center gap-2 mb-0.5">
                        <span className={`text-xs font-semibold ${statusColors[history.status]?.split(' ')[0]}`}>
                          {getStatusIcon(history.status)} {history.status.replace("-", " ").toUpperCase()}
                        </span>
                        <span className="text-xs text-gray-500">•</span>
                        <span className="text-xs text-gray-400">
                          {dayjs(history.changedAt).format("DD MMM YYYY, hh:mm A")}
                        </span>
                      </div>
                      <p className="text-xs text-blue-200 mb-0.5">
                        Changed by: <span className="font-medium text-white">{history.changedBy?.name || "Unknown"}</span>
                      </p>
                      {history.note && (
                        <p className="text-xs text-gray-400 italic bg-slate-950/50 p-1.5 rounded border border-slate-800">
                          {history.note}
                        </p>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <p className="text-gray-400 text-xs">No status history available</p>
            )}
          </div>

          {/* Remarks */}
          {task.remarks && task.remarks.length > 0 && (
            <div className="bg-gradient-to-br from-slate-700/50 to-slate-800/50 p-3 rounded-xl border border-slate-600/30 mb-4">
              <div className="flex items-center gap-2 mb-2">
                <MessageSquare className="w-4 h-4 text-blue-400" />
                <span className="text-sm font-semibold text-white">Remarks</span>
                <span className="text-xs text-gray-400">({task.remarks.length})</span>
              </div>
              <div className="space-y-2">
                {task.remarks.map((remark, idx) => (
                  <div
                    key={idx}
                    className="p-2 bg-slate-900/50 rounded-lg border border-slate-700/30"
                  >
                    <div className="flex items-center gap-2 mb-1">
                      <div className="w-5 h-5 rounded-full bg-gradient-to-br from-green-500 to-teal-500 flex items-center justify-center text-white font-semibold text-xs">
                        {remark.user?.name?.charAt(0).toUpperCase() || "U"}
                      </div>
                      <span className="text-xs font-medium text-white">{remark.user?.name || "Unknown"}</span>
                      <span className="text-xs text-gray-500">•</span>
                      <span className="text-xs text-gray-400">
                        {dayjs(remark.createdAt).format("DD MMM YYYY, hh:mm A")}
                      </span>
                    </div>
                    <p className="text-xs text-blue-200 ml-7">{remark.comment}</p>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Rejection Info */}
          {task.status === "rejected" && task.rejectionReason && (
            <div className="bg-gradient-to-br from-red-900/30 to-red-950/30 p-3 rounded-xl border-2 border-red-500/50">
              <div className="flex items-start gap-2">
                <div className="mt-0.5">
                  <AlertCircle className="w-5 h-5 text-red-400" />
                </div>
                <div className="flex-1">
                  <p className="text-red-300 font-bold text-sm mb-1.5">❌ Rejection Details</p>
                  <div className="bg-red-950/50 border border-red-700/50 rounded-md p-2 mb-1.5">
                    <p className="text-red-100 text-xs font-semibold mb-0.5">Reason:</p>
                    <p className="text-red-200 text-xs leading-relaxed">{task.rejectionReason}</p>
                  </div>
                  {task.rejectedAt && (
                    <p className="text-red-300 text-xs">
                      Rejected on: {dayjs(task.rejectedAt).format("DD MMM YYYY, hh:mm A")}
                    </p>
                  )}
                </div>
              </div>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="flex items-center justify-end gap-3 p-3 border-t border-slate-600/50 bg-gradient-to-r from-slate-900/50 to-slate-800/50">
          <button
            onClick={onClose}
            className="px-6 py-2 bg-gradient-to-r from-blue-600 to-blue-700 hover:from-blue-700 hover:to-blue-800 text-white rounded-lg font-medium transition-all duration-200 shadow-lg hover:shadow-blue-500/50"
          >
            Close
          </button>
        </div>
        </div>
      </div>
    </div>
  );
};

export default TaskDetailModal;
