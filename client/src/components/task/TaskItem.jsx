import React, { useState } from "react";
import { FaClock, FaUserTie, FaCommentDots } from "react-icons/fa";
import taskApi from "../../api/taskApi";
import dayjs from "dayjs";
import TaskRemarksModal from "./TaskRemarksModal";
import { useAchievements } from "../../contexts/AchievementContext";

const priorityColors = {
  High: "bg-red-700 text-red-200 border border-red-600",
  Medium: "bg-yellow-700 text-yellow-200 border border-yellow-600",
  Low: "bg-green-700 text-green-200 border border-green-600",
};

const statusColors = {
  pending: "bg-gray-700 text-gray-200 border border-gray-600",
  "in-progress": "bg-blue-700 text-blue-200 border border-blue-600",
  completed: "bg-green-700 text-green-200 border border-green-600",
  rejected: "bg-red-700 text-red-200 border border-red-600",
};

const TaskItem = ({ task, onStatusUpdated, isKanbanCard = false }) => {
  // Status comes from the task prop (parent owns state) — no local copy to drift
  const status = task.status;
  const [loading, setLoading] = useState(false);
  const [showRemarks, setShowRemarks] = useState(false);
  const [remarks, setRemarks] = useState(task.remarks || []);
  const { triggerAchievement } = useAchievements();

  // ---------------- Update Task Status ----------------
  const handleStatusChange = async (newStatus) => {
    if (newStatus === status) return;
    setLoading(true);
    try {
      const updated = await taskApi.updateStatus(task._id, newStatus);

      // Trigger achievements when task is completed
      if (newStatus === 'completed' && task.status !== 'completed') {
        const wasOverdue = task.dueDate && dayjs().isAfter(dayjs(task.dueDate));
        triggerAchievement('TASK_COMPLETED', {
          priority: task.priority,
          wasOverdue: wasOverdue
        });
      }

      if (onStatusUpdated) onStatusUpdated(updated);
    } catch (err) {
      console.error("Status update failed:", err);
      alert(err.response?.data?.message || "Failed to update status.");
    } finally {
      setLoading(false);
    }
  };

  // ---------------- Add Remark ----------------
  const handleAddRemark = async (comment) => {
    try {
      const updated = await taskApi.addRemark(task._id, comment);
      setRemarks(updated.remarks || []);

      // Trigger achievement for adding comments
      triggerAchievement('COMMENT_ADDED');
    } catch (err) {
      console.error("Failed to add remark:", err);
      alert(err.response?.data?.message || "Could not add remark.");
    }
  };

  const overdue = task.dueDate && !["completed", "rejected"].includes(status) && dayjs().isAfter(dayjs(task.dueDate));
  const assignees = Array.isArray(task.assignedTo) ? task.assignedTo : [];

  const accentColor =
    status === "completed" ? "bg-green-500"
    : status === "rejected" ? "bg-red-500"
    : status === "in-progress" ? "bg-blue-500"
    : overdue ? "bg-orange-500"
    : "bg-[rgba(84,123,209,0.5)]";

  return (
    <div className={`border rounded-2xl shadow-md hover:shadow-xl transition-all duration-200 overflow-hidden ${
      isKanbanCard
        ? `cursor-move border-blue-900/50 ${status === "completed" ? "bg-[#111827] opacity-55 hover:opacity-75" : "bg-[#1a2137] hover:bg-[#1e2442]"}`
        : status === "completed"
          ? "bg-[#0f1520] border-[rgba(84,123,209,0.08)] opacity-60 hover:opacity-80"
          : "bg-[#141c2e] border-[rgba(84,123,209,0.15)] hover:border-[rgba(84,123,209,0.35)]"
    }`}>

      {/* ── Accent bar ── */}
      <div className={`h-1 w-full ${accentColor}`} />

      <div className={isKanbanCard ? "p-4" : "p-5"}>

        {/* ── Kanban: compact vertical layout ── */}
        {isKanbanCard ? (
          <>
            <div className="flex items-start justify-between gap-2 mb-2">
              <h4 className="font-semibold text-white text-sm leading-snug">{task.title}</h4>
              <span className={`flex-shrink-0 px-2 py-0.5 text-xs font-semibold rounded-full border ${priorityColors[task.priority]}`}>
                {task.priority}
              </span>
            </div>
            {task.description && (
              <p className="text-gray-400 text-xs leading-relaxed whitespace-pre-wrap border-l-2 border-[rgba(84,123,209,0.2)] pl-2 mb-2">
                {task.description}
              </p>
            )}
            <div className="bg-[#0d1220] rounded-lg p-2 space-y-1.5 mb-2 text-xs">
              <div className="flex items-center gap-1.5">
                <FaClock className={overdue ? "text-orange-400" : "text-gray-500"} size={10} />
                <span className={overdue ? "text-orange-300 font-medium" : "text-gray-400"}>
                  {task.dueDate ? dayjs(task.dueDate).format("DD MMM YYYY") : "No due date"}
                  {overdue && " · Overdue"}
                </span>
              </div>
              {assignees.length > 0 && (
                <div className="flex flex-wrap gap-1">
                  {assignees.map((u, i) => (
                    <span key={u._id || i} className="px-1.5 py-0.5 rounded-full bg-blue-900/40 border border-blue-700/30 text-blue-200 text-xs">
                      {u.name || u.email}
                    </span>
                  ))}
                </div>
              )}
            </div>
            <div className="flex justify-end">
              <button onClick={() => setShowRemarks(true)}
                className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg bg-orange-600/20 hover:bg-orange-600/30 border border-orange-600/30 text-orange-300 text-xs font-medium transition">
                <FaCommentDots size={10} />
                {remarks.length}
              </button>
            </div>
          </>
        ) : (
          /* ── List view: two-column layout ── */
          <>
            <div className="flex gap-4">

              {/* LEFT — content */}
              <div className="flex-1 min-w-0 flex flex-col gap-2">
                <h4 className="font-semibold text-white text-base leading-snug">{task.title}</h4>

                {task.description ? (
                  <div className="border-l-2 border-[rgba(84,123,209,0.25)] pl-2.5">
                    <p className="text-gray-400 text-xs leading-relaxed whitespace-pre-wrap break-words">
                      {task.description}
                    </p>
                  </div>
                ) : (
                  <p className="text-gray-600 text-xs italic pl-2.5 border-l-2 border-[rgba(84,123,209,0.1)]">
                    No description provided.
                  </p>
                )}

                {/* Rejection block */}
                {status === "rejected" && (
                  <div className="mt-1 p-2.5 bg-red-900/25 border border-red-500/30 rounded-xl text-xs">
                    <p className="text-red-300 font-semibold mb-1 flex items-center gap-1.5">
                      <svg className="w-3 h-3 flex-shrink-0" fill="currentColor" viewBox="0 0 20 20"><path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.707 7.293a1 1 0 00-1.414 1.414L8.586 10l-1.293 1.293a1 1 0 101.414 1.414L10 11.414l1.293 1.293a1 1 0 001.414-1.414L11.414 10l1.293-1.293a1 1 0 00-1.414-1.414L10 8.586 8.707 7.293z" clipRule="evenodd"/></svg>
                      Rejected by Admin
                    </p>
                    <p className="text-red-200 leading-relaxed whitespace-pre-wrap">{task.rejectionReason || "No reason provided"}</p>
                    {task.rejectedAt && (
                      <p className="text-red-400 mt-1">{dayjs(task.rejectedAt).format("DD MMM YYYY, hh:mm A")}</p>
                    )}
                    <p className="text-yellow-300 mt-1.5 italic">💡 Fix the issue and re-submit as completed.</p>
                  </div>
                )}
              </div>

              {/* RIGHT — attributes */}
              <div className="w-52 flex-shrink-0">
                <div className="bg-[#0d1220] rounded-xl p-3 space-y-2.5 text-xs">

                  {/* Status + Priority */}
                  <div className="flex items-center gap-1.5 flex-wrap">
                    <span className={`px-2 py-0.5 text-xs font-semibold rounded-full border ${statusColors[status]}`}>
                      {status.replace("-", " ").toUpperCase()}
                    </span>
                    <span className={`px-2 py-0.5 text-xs font-semibold rounded-full border ${priorityColors[task.priority]}`}>
                      {task.priority}
                    </span>
                    {overdue && <span className="px-2 py-0.5 text-xs font-semibold rounded-full border bg-orange-500/15 text-orange-300 border-orange-500/30">Overdue</span>}
                  </div>

                  <div className="border-t border-white/5" />

                  {/* Created by */}
                  <div className="flex items-center gap-1.5">
                    <FaUserTie className="text-gray-500 flex-shrink-0" size={10} />
                    <span className="text-gray-500">By:</span>
                    <span className="text-gray-200 font-medium truncate">{task.assignedBy?.name || "Unknown"}</span>
                  </div>

                  {/* Created on */}
                  {task.createdAt && (
                    <div className="flex items-center gap-1.5">
                      <svg className="w-3 h-3 text-indigo-400 flex-shrink-0" fill="currentColor" viewBox="0 0 20 20">
                        <path fillRule="evenodd" d="M6 2a1 1 0 00-1 1v1H4a2 2 0 00-2 2v10a2 2 0 002 2h12a2 2 0 002-2V6a2 2 0 00-2-2h-1V3a1 1 0 10-2 0v1H7V3a1 1 0 00-1-1zm0 5a1 1 0 000 2h8a1 1 0 100-2H6z" clipRule="evenodd"/>
                      </svg>
                      <span className="text-gray-500">Created:</span>
                      <span className="text-indigo-300 font-medium">{dayjs(task.createdAt).format("DD MMM YYYY")}</span>
                    </div>
                  )}

                  {/* Due date */}
                  <div className="flex items-center gap-1.5">
                    <FaClock className={`flex-shrink-0 ${overdue ? "text-orange-400" : "text-gray-500"}`} size={10} />
                    <span className="text-gray-500">Due:</span>
                    <span className={`font-medium ${overdue ? "text-orange-300" : "text-gray-200"}`}>
                      {task.dueDate ? dayjs(task.dueDate).format("DD MMM YYYY") : "—"}
                    </span>
                  </div>

                  {/* Assigned to */}
                  {assignees.length > 0 && (
                    <div className="space-y-1">
                      <div className="flex items-center gap-1.5 text-gray-500">
                        <svg className="w-3 h-3 flex-shrink-0" fill="currentColor" viewBox="0 0 20 20">
                          <path d="M9 6a3 3 0 11-6 0 3 3 0 016 0zM17 6a3 3 0 11-6 0 3 3 0 016 0zM12.93 17c.046-.327.07-.66.07-1a6.97 6.97 0 00-1.5-4.33A5 5 0 0119 16v1h-6.07zM6 11a5 5 0 015 5v1H1v-1a5 5 0 015-5z"/>
                        </svg>
                        <span>Assigned to:</span>
                      </div>
                      <div className="flex flex-wrap gap-1 pl-4">
                        {assignees.map((u, i) => (
                          <span key={u._id || i}
                            className="inline-flex items-center px-2 py-0.5 rounded-full bg-blue-900/40 border border-blue-700/30 text-blue-200 text-xs">
                            {u.name || u.email || "Unknown"}
                          </span>
                        ))}
                      </div>
                    </div>
                  )}

                  {/* Project */}
                  {task.project && (
                    <div className="flex items-center gap-1.5">
                      <svg className="w-3 h-3 text-cyan-500 flex-shrink-0" fill="currentColor" viewBox="0 0 20 20">
                        <path d="M2 6a2 2 0 012-2h5l2 2h5a2 2 0 012 2v6a2 2 0 01-2 2H4a2 2 0 01-2-2V6z"/>
                      </svg>
                      <span className="text-gray-500">Project:</span>
                      <span className="text-cyan-400 font-medium truncate">{task.project?.projectName || "Unknown"}</span>
                    </div>
                  )}
                </div>
              </div>

            </div>

            {/* ── Footer: status dropdown + remarks ── */}
            <div className="flex items-center justify-between gap-2 pt-3 mt-3 border-t border-[rgba(84,123,209,0.1)]">
              {status === "completed" ? (
                <div className="flex items-center gap-1.5 px-3 py-1.5 text-xs bg-[#0d1220] border border-green-700/40 text-green-300 rounded-lg opacity-80">
                  <svg className="w-3.5 h-3.5" fill="currentColor" viewBox="0 0 20 20"><path fillRule="evenodd" d="M5 9V7a5 5 0 0110 0v2a2 2 0 012 2v5a2 2 0 01-2 2H5a2 2 0 01-2-2v-5a2 2 0 012-2zm8-2v2H7V7a3 3 0 016 0z" clipRule="evenodd"/></svg>
                  Completed (Locked)
                </div>
              ) : status === "rejected" ? (
                <select value="" onChange={(e) => e.target.value && handleStatusChange(e.target.value)}
                  disabled={loading}
                  className="rounded-lg px-3 py-1.5 text-xs bg-[#0d1220] border border-red-600/60 text-white focus:outline-none cursor-pointer">
                  <option value="" disabled>Move to…</option>
                  <option value="pending">Pending</option>
                  <option value="in-progress">In Progress</option>
                  <option value="completed">Completed</option>
                </select>
              ) : (
                <select value={status} onChange={(e) => handleStatusChange(e.target.value)}
                  disabled={loading}
                  className="rounded-lg px-3 py-1.5 text-xs bg-[#0d1220] border border-[rgba(84,123,209,0.3)] text-white focus:outline-none cursor-pointer">
                  <option value="pending">Pending</option>
                  <option value="in-progress">In Progress</option>
                  <option value="completed">Completed</option>
                </select>
              )}

              <button onClick={() => setShowRemarks(true)}
                className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-orange-600/20 hover:bg-orange-600/30 border border-orange-600/30 text-orange-300 text-xs font-medium transition">
                <FaCommentDots size={11} />
                Remarks ({remarks.length})
              </button>
            </div>
          </>
        )}
      </div>

      {/* -------- Remarks Modal -------- */}
      {showRemarks && (
        <TaskRemarksModal
          task={{ ...task, remarks }}
          onClose={() => setShowRemarks(false)}
          onAddRemark={handleAddRemark}
        />
      )}
    </div>
  );
};

export default TaskItem;
