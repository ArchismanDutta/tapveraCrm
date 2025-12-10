import React, { useState } from "react";
import { FaClock, FaUserTie, FaCommentDots } from "react-icons/fa";
import axios from "axios";
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
  const [status, setStatus] = useState(task.status);
  const [loading, setLoading] = useState(false);
  const [showRemarks, setShowRemarks] = useState(false);
  const [remarks, setRemarks] = useState(task.remarks || []);
  const { triggerAchievement } = useAchievements();

  const API_BASE = import.meta.env.VITE_API_BASE || "http://localhost:5000";

  // ---------------- Update Task Status ----------------
  const handleStatusChange = async (newStatus) => {
    setStatus(newStatus);
    setLoading(true);
    try {
      const token = localStorage.getItem("token");
      const res = await axios.patch(
        `${API_BASE}/api/tasks/${task._id}/status`,
        { status: newStatus },
        { headers: { Authorization: `Bearer ${token}` } }
      );
      setStatus(res.data.status);

      // Trigger achievements when task is completed
      if (newStatus === 'completed' && task.status !== 'completed') {
        const wasOverdue = task.dueDate && dayjs().isAfter(dayjs(task.dueDate));
        triggerAchievement('TASK_COMPLETED', {
          priority: task.priority,
          wasOverdue: wasOverdue
        });
      }

      if (onStatusUpdated) onStatusUpdated(res.data);
    } catch (err) {
      console.error("Status update failed:", err);
      const errorMessage = err.response?.data?.message || "Failed to update status.";
      alert(errorMessage);
      setStatus(task.status); // revert
    } finally {
      setLoading(false);
    }
  };

  // ---------------- Add Remark ----------------
  const handleAddRemark = async (comment) => {
    try {
      const token = localStorage.getItem("token");
      const res = await axios.post(
        `${API_BASE}/api/tasks/${task._id}/remarks`,
        { comment },
        { headers: { Authorization: `Bearer ${token}` } }
      );
      setRemarks(res.data.remarks || []);

      // Trigger achievement for adding comments
      triggerAchievement('COMMENT_ADDED');
    } catch (err) {
      console.error("Failed to add remark:", err);
      alert("Could not add remark.");
    }
  };

  return (
    <div className={`border rounded-xl shadow-md hover:shadow-lg transition-all duration-200 border-blue-950 ${
      isKanbanCard
        ? 'p-4 bg-[#1a2137] hover:bg-[#1e2442] cursor-move'
        : 'p-5 bg-[#181d2a]'
    }`}>
      {/* -------- Header -------- */}
      <div className="flex justify-between items-center mb-3">
        <h4 className={`font-semibold text-blue-100 ${isKanbanCard ? 'text-base' : 'text-lg'}`}>
          {task.title}
        </h4>
        <span
          className={`px-2 py-1 text-xs font-medium rounded-full ${
            priorityColors[task.priority]
          }`}
        >
          {task.priority}
        </span>
      </div>

      {/* -------- Assigned By -------- */}
      <div className="flex items-center text-blue-400 text-sm mb-2">
        <FaUserTie className="mr-2" />
        <span>
          <strong>Assigned By:</strong> {task.assignedBy?.name || "Unknown"}
        </span>
      </div>

      {/* -------- Project Name -------- */}
      {task.project && (
        <div className="flex items-center text-blue-400 text-sm mb-2">
          <svg className="w-4 h-4 mr-2" fill="currentColor" viewBox="0 0 20 20">
            <path d="M2 6a2 2 0 012-2h5l2 2h5a2 2 0 012 2v6a2 2 0 01-2 2H4a2 2 0 01-2-2V6z" />
          </svg>
          <span>
            <strong>Project:</strong> {task.project?.projectName || "Unknown"}
          </span>
        </div>
      )}

      {/* -------- Due Date -------- */}
      <div className="flex items-center text-blue-400 text-sm mb-3">
        <FaClock className="mr-2" />
        Due:{" "}
        {task.dueDate
          ? dayjs(task.dueDate).format("DD MMM YYYY, hh:mm A")
          : "No due date"}
      </div>

      {/* -------- Description -------- */}
      <p className="text-blue-300 text-sm mb-4 leading-relaxed">
        {task.description}
      </p>

      {/* -------- Rejection Info (if rejected) -------- */}
      {task.status === "rejected" && (
        <div className="mb-4 p-4 bg-red-900/40 border-2 border-red-500/70 rounded-lg shadow-lg">
          <div className="flex items-start gap-3">
            <div className="mt-0.5 flex-shrink-0">
              <svg className="w-6 h-6 text-red-400" fill="currentColor" viewBox="0 0 20 20">
                <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.707 7.293a1 1 0 00-1.414 1.414L8.586 10l-1.293 1.293a1 1 0 101.414 1.414L10 11.414l1.293 1.293a1 1 0 001.414-1.414L11.414 10l1.293-1.293a1 1 0 00-1.414-1.414L10 8.586 8.707 7.293z" clipRule="evenodd" />
              </svg>
            </div>
            <div className="flex-1">
              <p className="text-red-300 font-bold text-base mb-2 flex items-center gap-2">
                ❌ Task Rejected by Admin
              </p>
              <div className="bg-red-950/50 border border-red-700/50 rounded-md p-3 mb-2">
                <p className="text-red-100 text-sm font-semibold mb-1">Rejection Reason:</p>
                <p className="text-red-200 text-sm leading-relaxed">
                  {task.rejectionReason || "No reason provided"}
                </p>
              </div>
              {task.rejectedAt && (
                <p className="text-red-300 text-xs flex items-center gap-1">
                  <svg className="w-3 h-3" fill="currentColor" viewBox="0 0 20 20">
                    <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm1-12a1 1 0 10-2 0v4a1 1 0 00.293.707l2.828 2.829a1 1 0 101.415-1.415L11 9.586V6z" clipRule="evenodd" />
                  </svg>
                  Rejected on: {dayjs(task.rejectedAt).format("DD MMM YYYY, hh:mm A")}
                </p>
              )}
              <p className="text-yellow-200 text-xs mt-2 italic">
                💡 You can update the task and mark it as complete again once you've addressed the feedback.
              </p>
            </div>
          </div>
        </div>
      )}

      {/* -------- Status + Actions -------- */}
      <div className={`flex ${isKanbanCard ? 'flex-col gap-2' : 'justify-between items-center gap-2'}`}>
        {!isKanbanCard && (
          /* Status pill - only show in list view */
          <span
            className={`px-3 py-1 text-xs font-medium rounded-full ${
              statusColors[status]
            }`}
          >
            {status.replace("-", " ").toUpperCase()}
          </span>
        )}

        <div className={`flex ${isKanbanCard ? 'justify-between' : 'gap-2'}`}>
          {!isKanbanCard && (
            /* Status dropdown - only show in list view */
            <>
              {status === 'completed' ? (
                /* Show locked status when completed - cannot be changed by employee */
                <div className="flex items-center gap-2 px-3 py-1.5 text-sm bg-[#141a29] shadow-sm border border-blue-950 text-blue-100 rounded-lg opacity-75">
                  <svg className="w-4 h-4 text-green-400" fill="currentColor" viewBox="0 0 20 20">
                    <path fillRule="evenodd" d="M5 9V7a5 5 0 0110 0v2a2 2 0 012 2v5a2 2 0 01-2 2H5a2 2 0 01-2-2v-5a2 2 0 012-2zm8-2v2H7V7a3 3 0 016 0z" clipRule="evenodd" />
                  </svg>
                  <span>Completed (Locked)</span>
                </div>
              ) : status === 'rejected' ? (
                /* Show rejected status - can be changed after rejection */
                <select
                  value={status}
                  onChange={(e) => handleStatusChange(e.target.value)}
                  disabled={loading}
                  className="rounded-lg px-3 py-1.5 text-sm bg-[#141a29] shadow-sm border border-red-600 text-blue-100 focus:outline-none focus:ring-2 focus:ring-[#ff8000] transition"
                >
                  <option value="pending">Pending</option>
                  <option value="in-progress">In Progress</option>
                  <option value="completed">Completed</option>
                  <option value="rejected">Rejected</option>
                </select>
              ) : (
                /* Normal status dropdown for pending/in-progress */
                <select
                  value={status}
                  onChange={(e) => handleStatusChange(e.target.value)}
                  disabled={loading}
                  className="rounded-lg px-3 py-1.5 text-sm bg-[#141a29] shadow-sm border border-blue-950 text-blue-100 focus:outline-none focus:ring-2 focus:ring-[#ff8000] transition"
                >
                  <option value="pending">Pending</option>
                  <option value="in-progress">In Progress</option>
                  <option value="completed">Completed</option>
                </select>
              )}
            </>
          )}

          {/* Remarks button */}
          <button
            onClick={() => setShowRemarks(true)}
            className={`flex items-center gap-1 rounded bg-[#bf6f2f] hover:bg-[#a65e28] text-white text-sm transition ${
              isKanbanCard ? 'px-2 py-1' : 'px-3 py-1.5'
            }`}
          >
            <FaCommentDots />
            {isKanbanCard ? remarks.length : `Remarks (${remarks.length})`}
          </button>
        </div>
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
