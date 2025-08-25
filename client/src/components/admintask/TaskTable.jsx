// src/components/admintask/TaskTable.jsx
import React, { useState } from "react";
import TaskRow from "./TaskRow";

const TaskTable = ({ tasks = [], onViewTask, onEditTask, onDeleteTask }) => {
  const [search, setSearch] = useState("");
  const [filter, setFilter] = useState("All Status");

  // Defensive check
  const safeTasks = Array.isArray(tasks) ? tasks : [];

  // Filter + search logic
  const filteredTasks = safeTasks.filter((task) => {
    const titleMatch =
      task?.title?.toLowerCase().includes(search.toLowerCase()) ?? false;
    const statusMatch = filter === "All Status" || task?.status === filter;
    return titleMatch && statusMatch;
  });

  // Safe date formatting
  const formatDueDateTime = (dateValue) => {
    if (!dateValue) return "No due date";
    const dateObj = new Date(dateValue);
    if (isNaN(dateObj.getTime())) return "Invalid date";
    return `${dateObj.toLocaleDateString()} ${dateObj.toLocaleTimeString([], {
      hour: "2-digit",
      minute: "2-digit",
    })}`;
  };

  return (
    <div className="rounded-2xl p-6">
      {/* Filters */}
      <div className="flex flex-col md:flex-row md:items-center md:justify-between mb-5 gap-3">
        <input
          type="text"
          placeholder="🔍 Search tasks..."
          className="border border-gray-200 focus:border-orange-400 focus:ring focus:ring-orange-100 rounded-xl px-4 py-2 w-full md:w-1/3 text-sm transition-all duration-200 cursor-pointer"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
        />
        <select
          className="border border-gray-200 focus:border-orange-400 focus:ring focus:ring-orange-100 rounded-xl px-4 py-2 text-sm w-full md:w-auto transition-all duration-200 bg-white cursor-pointer"
          value={filter}
          onChange={(e) => setFilter(e.target.value)}
        >
          <option>All Status</option>
          <option>pending</option>
          <option>in-progress</option>
          <option>completed</option>
        </select>
      </div>

      {/* Table */}
      <div className="overflow-x-auto rounded-xl border border-gray-100">
        <table className="w-full border-collapse text-gray-700">
          <thead className="bg-gradient-to-r from-orange-50 to-yellow-50 sticky top-0 z-10">
            <tr className="border-b border-gray-200 text-left text-xs uppercase tracking-wider text-orange-600">
              <th className="p-4">Task Title</th>
              <th className="p-4">Assigned To</th>
              <th className="p-4">Due Date & Time</th>
              <th className="p-4">Priority</th>
              <th className="p-4">Status</th>
              <th className="p-4 text-center">Actions</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-100">
            {filteredTasks.length > 0 ? (
              filteredTasks.map((task, index) => (
                <TaskRow
                  key={task._id || index}
                  task={{
                    ...task,
                    assignedTo: Array.isArray(task.assignedTo)
                      ? task.assignedTo
                      : [],
                    dueDate: formatDueDateTime(task?.dueDate),
                  }}
                  onView={() => onViewTask(task)}
                  onEdit={() => onEditTask(task)}
                  onDelete={() => onDeleteTask(task._id)}
                />
              ))
            ) : (
              <tr>
                <td
                  colSpan={6}
                  className="p-6 text-center text-gray-400 italic"
                >
                  No tasks found.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
};

export default TaskTable;
