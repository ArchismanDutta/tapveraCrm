import React, { useState } from "react";
import TaskRow from "./TaskRow";

const TaskTable = ({ tasks = [], onViewTask, onEditTask, onDeleteTask }) => {
  const [search, setSearch] = useState("");
  const [filter, setFilter] = useState("All Status");

  const safeTasks = Array.isArray(tasks) ? tasks : [];

  const filteredTasks = safeTasks.filter((task) => {
    const titleMatch = task?.title?.toLowerCase().includes(search.toLowerCase()) ?? false;
    const statusMatch = filter === "All Status" || task?.status === filter;
    return titleMatch && statusMatch;
  });

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
    <div className="rounded-3xl overflow-hidden">
      {/* Filters */}
      <div className="flex flex-col md:flex-row md:items-center md:justify-between mb-6 gap-4">
        <input
          type="text"
          placeholder="🔍 Search tasks..."
          className="bg-[rgba(22,28,48,0.8)] border border-[rgba(84,123,209,0.4)] rounded-2xl px-4 py-2 w-full md:w-1/3 text-sm text-blue-100 placeholder-blue-400 focus:outline-none focus:ring-2 focus:ring-[#bf6f2f] duration-200 cursor-pointer"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
        />
        <select
          className="bg-[rgba(22,28,48,0.8)] border border-[rgba(84,123,209,0.4)] rounded-2xl px-4 py-2 text-sm w-full md:w-auto text-blue-100 cursor-pointer focus:outline-none focus:ring-2 focus:ring-[#bf6f2f] transition duration-200"
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
      <div className="overflow-x-auto rounded-3xl border border-[rgba(84,123,209,0.4)] shadow-lg">
        <table className="w-full border-collapse text-blue-100">
          <thead className="bg-[rgba(191,111,47,0.15)] sticky top-0 z-10">
            <tr className="border-b border-[rgba(191,111,47,0.3)] text-left text-xs uppercase tracking-wide text-[#bf6f2f]">
              <th className="p-4">Task Title</th>
              <th className="p-4">Assigned To</th>
              <th className="p-4">Due Date & Time</th>
              <th className="p-4">Priority</th>
              <th className="p-4">Status</th>
              <th className="p-4 text-center">Actions</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-[rgba(84,123,209,0.4)]">
            {filteredTasks.length > 0 ? (
              filteredTasks.map((task, index) => (
                <TaskRow
                  key={task._id || index}
                  task={{
                    ...task,
                    assignedTo: Array.isArray(task.assignedTo) ? task.assignedTo : [],
                    dueDate: formatDueDateTime(task?.dueDate),
                  }}
                  onView={() => onViewTask(task)}
                  onEdit={() => onEditTask(task)}
                  onDelete={() => onDeleteTask(task._id)}
                />
              ))
            ) : (
              <tr>
                <td colSpan={6} className="p-6 text-center text-blue-400 italic">
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
