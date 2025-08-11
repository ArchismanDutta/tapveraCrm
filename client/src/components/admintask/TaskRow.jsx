import React from "react";
import { Eye, Trash2, Edit3 } from "lucide-react";

const priorityColors = {
  High: "bg-red-100 text-red-700 border border-red-200",
  Medium: "bg-yellow-100 text-yellow-700 border border-yellow-200",
  Low: "bg-green-100 text-green-700 border border-green-200",
};

const statusColors = {
  Pending: "bg-blue-100 text-blue-700 border border-blue-200",
  Completed: "bg-green-100 text-green-700 border border-green-200",
  Overdue: "bg-red-100 text-red-700 border border-red-200",
};

const TaskRow = ({ task, onView, onEdit, onDelete }) => {
  return (
    <tr className="border-b text-sm hover:bg-yellow-50 transition-colors duration-200">
      <td className="p-3 font-medium text-gray-800">{task.title}</td>

      <td className="p-3 flex items-center gap-2">
        <img
          src={task.assignedAvatar}
          alt={task.assignedTo}
          className="w-7 h-7 rounded-full border-2 border-yellow-300"
        />
        <span className="text-gray-700">{task.assignedTo}</span>
      </td>

      <td className="p-3 text-gray-600">{task.dueDate}</td>

      <td className="p-3">
        <span
          className={`px-2 py-0.5 rounded-full text-xs font-semibold ${priorityColors[task.priority]}`}
        >
          {task.priority}
        </span>
      </td>

      <td className="p-3">
        <span
          className={`px-2 py-0.5 rounded-full text-xs font-semibold ${statusColors[task.status]}`}
        >
          {task.status}
        </span>
      </td>

      <td className="p-3 flex gap-2">
        <button
          onClick={onView}
          className="p-1.5 rounded-lg text-blue-600 hover:bg-blue-50"
          title="View Task"
        >
          <Eye size={16} />
        </button>
        <button
          onClick={onEdit}
          className="p-1.5 rounded-lg text-green-600 hover:bg-green-50"
          title="Edit Task"
        >
          <Edit3 size={16} />
        </button>
        <button
          onClick={onDelete}
          className="p-1.5 rounded-lg text-red-600 hover:bg-red-50"
          title="Delete Task"
        >
          <Trash2 size={16} />
        </button>
      </td>
    </tr>
  );
};

export default TaskRow;
