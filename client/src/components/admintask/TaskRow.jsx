import React from "react";
import { Eye, Trash2, Edit3 } from "lucide-react";

const priorityColors = {
  High: "bg-red-700 text-red-100 border border-red-600",
  Medium: "bg-yellow-500 text-yellow-900 border border-yellow-400",
  Low: "bg-green-600 text-green-100 border border-green-500",
};

const statusColors = {
  pending: "bg-blue-600 text-blue-100 border border-blue-500",
  "in-progress": "bg-purple-600 text-purple-100 border border-purple-500",
  completed: "bg-green-600 text-green-100 border border-green-500",
};

const TaskRow = ({ task, onView, onEdit, onDelete }) => {
  return (
    <tr className="border-b text-sm hover:bg-[rgba(255,128,0,0.1)] transition-colors duration-200 text-blue-100">
      <td className="p-3 font-medium">{task.title}</td>

      <td className="p-3 flex flex-wrap items-center gap-2">
        {Array.isArray(task.assignedTo) && task.assignedTo.length > 0 ? (
          task.assignedTo.map((user, idx) => (
            <div key={idx} className="flex items-center gap-1">
              <img
                src={`https://i.pravatar.cc/40?u=${user._id || user}`}
                alt={user.name || "User"}
                className="w-7 h-7 rounded-full border-2 border-yellow-400"
                onError={(e) => {
                  e.target.onerror = null;
                  e.target.src = "https://i.pravatar.cc/40";
                }}
              />
              <span>{user.name || user.email || "Unknown"}</span>
            </div>
          ))
        ) : (
          <span className="text-blue-400">Unassigned</span>
        )}
      </td>

      <td className="p-3 text-blue-300">{task.dueDate}</td>

      <td className="p-3">
        <span className={`px-2 py-0.5 rounded-full text-xs font-semibold ${priorityColors[task.priority]}`}>
          {task.priority}
        </span>
      </td>

      <td className="p-3">
        <span className={`px-2 py-0.5 rounded-full text-xs font-semibold ${statusColors[task.status]}`}>
          {task.status}
        </span>
      </td>

      <td className="p-3 flex gap-2 justify-center">
        <button onClick={onView} className="p-1.5 rounded-lg text-blue-400 hover:bg-blue-900 cursor-pointer">
          <Eye size={16} />
        </button>
        <button onClick={onEdit} className="p-1.5 rounded-lg text-green-400 hover:bg-green-900 cursor-pointer">
          <Edit3 size={16} />
        </button>
        <button onClick={onDelete} className="p-1.5 rounded-lg text-red-500 hover:bg-red-900 cursor-pointer">
          <Trash2 size={16} />
        </button>
      </td>
    </tr>
  );
};

export default TaskRow;
