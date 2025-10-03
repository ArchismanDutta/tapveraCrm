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
      alert("Failed to update status.");
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
