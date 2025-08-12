import React, { useState } from "react";
import TaskRow from "./TaskRow";

const TaskTable = ({ tasks, onViewTask, onEditTask, onDeleteTask }) => {
  const [search, setSearch] = useState("");
  const [filter, setFilter] = useState("All Status");

  // Ensure tasks is always an array
  const safeTasks = Array.isArray(tasks) ? tasks : [];

  // Filter tasks by title + status
  const filteredTasks = safeTasks.filter((t) => {
    const titleMatch =
      t?.title?.toLowerCase().includes(search.toLowerCase()) ?? false;
    const statusMatch = filter === "All Status" || t?.status === filter;
    return titleMatch && statusMatch;
  });

  // Format Due Date with time
  const formatDueDateTime = (dateValue) => {
    if (!dateValue) return "No due date";
    const dateObj = new Date(dateValue);
    const dateStr = dateObj.toLocaleDateString();
    const timeStr = dateObj.toLocaleTimeString([], {
      hour: "2-digit",
      minute: "2-digit",
    });
    return `${dateStr} ${timeStr}`;
  };

  return (
    <div className="bg-white rounded-lg shadow-sm p-5 border">
      {/* Search + Filter Controls */}
      <div className="flex flex-col md:flex-row md:items-center md:justify-between mb-4 gap-3">
        <input
          type="text"
          placeholder="Search tasks..."
          className="border border-black-200 focus:border-orange-400 focus:ring-1 focus:ring-orange-300 p-2 rounded-lg w-full md:w-1/3 text-sm"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
        />
        <select
          className="border border-yellow-200 focus:border-orange-400 focus:ring-1 focus:ring-orange-300 p-2 rounded-lg text-sm w-full md:w-auto"
          value={filter}
          onChange={(e) => setFilter(e.target.value)}
        >
          <option>All Status</option>
          <option>Pending</option>
          <option>Completed</option>
          <option>Overdue</option>
        </select>
      </div>

      {/* Task Table */}
      <table className="w-full border-collapse text-gray-700">
        <thead className="bg-yellow-100 sticky top-0 z-10">
          <tr className="border-b text-left text-sm uppercase tracking-wide text-orange-700">
            <th className="p-3">Task Title</th>
            <th className="p-3">Assigned To</th>
            <th className="p-3">Due Date & Time</th>
            <th className="p-3">Priority</th>
            <th className="p-3">Status</th>
            <th className="p-3">Actions</th>
          </tr>
        </thead>
        <tbody>
          {filteredTasks.length > 0 ? (
            filteredTasks.map((task, index) => (
              <TaskRow
                key={task._id || task.id || index}
                task={{
                  ...task,
                  assignedTo:
                    task?.assignedTo && typeof task.assignedTo === "object"
                      ? task.assignedTo.name || "Unassigned"
                      : task?.assignedTo || "Unassigned",
                  dueDate: formatDueDateTime(task?.dueDate),
                }}
                onView={() => onViewTask(task)}
                onEdit={() => onEditTask(task)}
                onDelete={() => onDeleteTask(task._id || task.id)}
              />
            ))
          ) : (
            <tr>
              <td colSpan={6} className="p-5 text-center text-gray-400">
                No tasks found.
              </td>
            </tr>
          )}
        </tbody>
      </table>
    </div>
  );
};

export default TaskTable;
