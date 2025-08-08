import React from "react";
import { FaClock } from "react-icons/fa";

const priorityColors = {
  High: "bg-red-100 text-red-600 border border-red-200",
  Medium: "bg-yellow-100 text-yellow-700 border border-yellow-200",
  Low: "bg-green-100 text-green-600 border border-green-200",
};

const TaskItem = ({ task, onStatusChange }) => {
  return (
    <div className="border rounded-xl p-5 bg-white shadow-sm hover:shadow-md transition-all duration-200">
      {/* Header */}
      <div className="flex justify-between items-center">
        <h4 className="font-semibold text-gray-800 text-base">{task.title}</h4>
        <span
          className={`px-3 py-1 text-xs font-medium rounded-full shadow-sm ${priorityColors[task.priority]}`}
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
          value={task.status}
          onChange={(e) => onStatusChange(task.id, e.target.value)}
          className="border border-gray-300 rounded-lg px-3 py-1.5 text-sm bg-white shadow-sm focus:outline-none focus:ring-2 focus:ring-pinkAccent focus:border-pinkAccent transition"
        >
          <option>Assigned</option>
          <option>In Progress</option>
          <option>Completed</option>
        </select>
      </div>
    </div>
  );
};

export default TaskItem;
