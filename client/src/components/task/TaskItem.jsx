import React, { useState } from "react";
import { FaClock, FaUserTie } from "react-icons/fa";
import axios from "axios";
import dayjs from "dayjs";

const priorityColors = {
  High: "bg-red-700 text-red-200 border border-red-600",
  Medium: "bg-yellow-700 text-yellow-200 border border-yellow-600",
  Low: "bg-green-700 text-green-200 border border-green-600",
};

const statusColors = {
  pending: "bg-gray-700 text-white-300 border border-gray-600",
  "in-progress": "bg-blue-700 text-white-300 border border-blue-600",
  completed: "bg-green-700 text-white-300 border border-green-600",
};

const TaskItem = ({ task, onStatusUpdated }) => {
  const [loading, setLoading] = useState(false);
  const [status, setStatus] = useState(task.status);

  // API base URL with fallback
  const API_BASE = import.meta.env.VITE_API_BASE || "http://localhost:5000";

  const handleStatusChange = async (newStatus) => {
    setStatus(newStatus);
    setLoading(true);
    try {
      const token = localStorage.getItem("token");
      const res = await axios.patch(
        `${API_BASE}/api/tasks/${task._id}/status`,
        { status: newStatus },
        {
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${token}`,
          },
        }
      );
      if (onStatusUpdated) {
        onStatusUpdated(res.data);
      }
    } catch (err) {
      console.error(err);
      alert("Failed to update status.");
      setStatus(task.status);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="border rounded-xl p-5 bg-[#181d2a] shadow-md hover:shadow-lg transition-all duration-200 border-blue-950">
      {/* Header */}
      <div className="flex justify-between items-center mb-3">
        <h4 className="font-semibold text-blue-100 text-lg">{task.title}</h4>
        <span
          className={`px-3 py-1 text-xs font-medium rounded-full ${
            priorityColors[task.priority]
          }`}
        >
          {task.priority}
        </span>
      </div>

      {/* Assigned By */}
      <div className="flex items-center text-blue-400 text-sm mb-2">
        <FaUserTie className="mr-2" />
        <span>
          <strong>Assigned By:</strong> {task.assignedBy?.name || "Unknown"}
        </span>
      </div>

      {/* Time & Due Date */}
      <div className="flex items-center text-blue-400 text-sm mb-3">
        <FaClock className="mr-2" />
        Due: {dayjs(task.dueDate).format("DD MMM YYYY, hh:mm A")}
      </div>

      {/* Description */}
      <p className="text-blue-300 text-sm mb-4 leading-relaxed">
        {task.description}
      </p>

      {/* Status Selector */}
      <div className="flex justify-between items-center">
        <span
          className={`px-3 py-1 text-xs font-medium rounded-full ${statusColors[status]}`}
        >
          {status.replace("-", " ").toUpperCase()}
        </span>
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
      </div>
    </div>
  );
};

export default TaskItem;
