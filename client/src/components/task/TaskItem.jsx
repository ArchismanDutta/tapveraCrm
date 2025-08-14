import React, { useState } from "react";
import { FaClock, FaUserTie } from "react-icons/fa";
import axios from "axios";
import dayjs from "dayjs";

const priorityColors = {
  High: "bg-red-100 text-red-600 border border-red-200",
  Medium: "bg-yellow-100 text-yellow-700 border border-yellow-200",
  Low: "bg-green-100 text-green-600 border border-green-200",
};

const statusColors = {
  pending: "bg-gray-100 text-gray-600 border border-gray-200",
  "in-progress": "bg-blue-100 text-blue-600 border border-blue-200",
  completed: "bg-green-100 text-green-600 border border-green-200",
};



const TaskItem = ({ task, onStatusUpdated }) => {
  const [loading, setLoading] = useState(false);
  const [status, setStatus] = useState(task.status);
  
  const handleStatusChange = async (newStatus) => {
    setStatus(newStatus);
    setLoading(true);
    try {
      const token = localStorage.getItem("token");
      const res = await axios.patch(
        `http://localhost:5000/api/tasks/${task._id}/status`,
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
    <div className="border rounded-xl p-5 bg-white shadow-md hover:shadow-lg transition-all duration-200">
      {/* Header */}
      <div className="flex justify-between items-center mb-3">
        <h4 className="font-semibold text-gray-800 text-lg">{task.title}</h4>
        <span
          className={`px-3 py-1 text-xs font-medium rounded-full ${
            priorityColors[task.priority]
          }`}
        >
          {task.priority}
        </span>
      </div>

      {/* Assigned By */}
      <div className="flex items-center text-gray-500 text-sm mb-2">
        <FaUserTie className="mr-2 text-gray-400" />
        <span>
          <strong>Assigned By:</strong> {task.assignedBy?.name || "Unknown"}
        </span>
      </div>

      {/* Time & Due Date */}
      <div className="flex items-center text-gray-500 text-sm mb-3">
        <FaClock className="mr-2" />
        Due: {dayjs(task.dueDate).format("DD MMM YYYY, hh:mm A")}
      </div>

      {/* Description */}
      <p className="text-sm text-gray-600 mb-4 leading-relaxed">
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
          className="rounded-lg px-3 py-1.5 text-sm bg-white shadow-sm border border-gray-300 focus:outline-none focus:ring-2 focus:ring-pink-400 transition"
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
