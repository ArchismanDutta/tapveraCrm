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
    <div className="rounded-xl overflow-hidden">
      {/* Filters */}
      <div className="flex flex-col md:flex-row md:items-center md:justify-between mb-4 gap-2">
        <input
          type="text"
          placeholder="🔍 Search tasks..."
          className="bg-[rgba(22,28,48,0.8)] border border-[rgba(84,123,209,0.4)] rounded-xl px-2 py-1 w-full md:w-1/3 text-xs text-blue-100 placeholder-blue-400 focus:outline-none focus:ring-2 focus:ring-[#bf6f2f] duration-200"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
        />
        <select
          className="bg-[rgba(22,28,48,0.8)] border border-[rgba(84,123,209,0.4)] rounded-xl px-2 py-1 text-xs w-full md:w-auto text-blue-100 focus:outline-none focus:ring-2 focus:ring-[#bf6f2f] transition duration-200"
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
      <div className="rounded-xl border border-[rgba(84,123,209,0.4)] shadow-lg overflow-x-auto">
        <table className="w-full border-collapse text-blue-100 table-fixed">
          <thead className="bg-[rgba(191,111,47,0.15)]">
            <tr className="text-left text-xs uppercase tracking-wide text-[#bf6f2f]">
              <th className="p-2 w-[180px] max-w-[180px]">Task Title</th>
              <th className="p-2 w-[110px] max-w-[110px]">Assigned To</th>
              <th className="p-2 w-[110px] max-w-[110px]">Assigned By</th>
              <th className="p-2 w-[95px] max-w-[95px]">Due Date & Time</th>
              <th className="p-2 w-[55px] max-w-[60px]">Priority</th>
              <th className="p-2 w-[60px] max-w-[70px]">Status</th>
              <th className="p-2 w-[65px] max-w-[70px] text-center">Actions</th>
            </tr>
          </thead>
          <tbody className="text-xs">
            {filteredTasks.length > 0 ? (
              filteredTasks.map((task, index) => (
                <TaskRow
                  key={task._id || index}
                  task={{
                    ...task,
                    assignedTo: Array.isArray(task.assignedTo) ? task.assignedTo : [],
                    assignedBy: task.assignedBy || null,
                    dueDate: formatDueDateTime(task?.dueDate),
                  }}
                  onView={() => onViewTask(task)}
                  onEdit={() => onEditTask(task)}
                  onDelete={() => onDeleteTask(task._id)}
                />
              ))
            ) : (
              <tr>
                <td colSpan={7} className="p-4 text-center text-blue-400 italic">
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
