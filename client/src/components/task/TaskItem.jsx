import React, { useState } from "react";
import { FaClock } from "react-icons/fa";
import axios from "axios";

const priorityColors = {
  High: "bg-red-100 text-red-600 border border-red-200",
  Medium: "bg-yellow-100 text-yellow-700 border border-yellow-200",
  Low: "bg-green-100 text-green-600 border border-green-200",
};

const TaskItem = ({ task, onStatusUpdated }) => {
  const [loading, setLoading] = useState(false);
  const [status, setStatus] = useState(task.status);

  const handleStatusChange = async (newStatus) => {
    setStatus(newStatus); // Optimistic update
    setLoading(true);
    try {
      const token = localStorage.getItem("token"); // If using JWT auth
      const res = await axios.patch(
        `http://localhost:5000/api/tasks/${task.id}/status`,
        { status: newStatus },
        {
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${token}`, // optional if protected
          },
        }
      );

      if (onStatusUpdated) {
        onStatusUpdated(res.data); // Let parent refresh if needed
      }
    } catch (err) {
      console.error(err);
      alert("Failed to update status.");
      setStatus(task.status); // revert on error
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="border rounded-xl p-5 bg-white shadow-sm hover:shadow-md transition-all duration-200">
      {/* Header */}
      <div className="flex justify-between items-center">
        <h4 className="font-semibold text-gray-800 text-base">{task.title}</h4>
        <span
          className={`px-3 py-1 text-xs font-medium rounded-full shadow-sm ${
            priorityColors[task.priority]
          }`}
        >
          {task.priority}
        </span>
      </div>

      {/* Time */}
      <div className="flex items-center text-gray-500 text-sm mt-1">
        <FaClock className="mr-1" />
        {task.time}
      </div>

      {/* Description */}
      <p className="text-sm text-gray-600 mt-3 leading-relaxed">
        {task.description}
      </p>

      {/* Status Selector */}
      <div className="flex justify-end mt-4">
        <select
          value={status}
          onChange={(e) => handleStatusChange(e.target.value)}
          disabled={loading}
          className="border border-gray-300 rounded-lg px-3 py-1.5 text-sm bg-white shadow-sm focus:outline-none focus:ring-2 focus:ring-pinkAccent focus:border-pinkAccent transition"
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
