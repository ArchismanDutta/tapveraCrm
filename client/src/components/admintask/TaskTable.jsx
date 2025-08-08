import React, { useState } from "react";
import TaskRow from "./TaskRow";

const TaskTable = ({ tasks, onViewTask, onDeleteTask }) => {
  const [search, setSearch] = useState("");
  const [filter, setFilter] = useState("All Status");

  const filteredTasks = tasks.filter(
    (t) =>
      t.title.toLowerCase().includes(search.toLowerCase()) &&
      (filter === "All Status" || t.status === filter)
  );

  return (
    <div className="bg-white rounded-lg shadow-sm p-5 border">
      {/* Search and filter controls */}
      <div className="flex flex-col md:flex-row md:items-center md:justify-between mb-4 gap-3 md:gap-0">
        <input
          type="text"
          placeholder="Search tasks..."
          aria-label="Search tasks"
          className="border border-yellow-200 focus:border-orange-400 focus:ring-1 focus:ring-orange-300 p-2 rounded-lg w-full md:w-1/3 text-sm transition"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
        />
        <select
          aria-label="Filter tasks by status"
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

      {/* Table */}
      <table className="w-full border-collapse text-gray-700">
        <thead className="bg-yellow-100 sticky top-0 z-10">
          <tr className="border-b text-left text-sm uppercase tracking-wide text-orange-700">
            <th className="p-3">Task Title</th>
            <th className="p-3">Assigned To</th>
            <th className="p-3">Due Date</th>
            <th className="p-3">Priority</th>
            <th className="p-3">Status</th>
            <th className="p-3">Actions</th>
          </tr>
        </thead>
        <tbody>
          {filteredTasks.length > 0 ? (
            filteredTasks.map((task) => (
              <TaskRow
                key={task.id}
                task={task}
                onView={onViewTask}
                onDelete={onDeleteTask}
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
