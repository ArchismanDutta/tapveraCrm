// TaskList.jsx
import React from "react";

const labelColor = {
  High: "bg-red-100 text-red-700",
  Medium: "bg-yellow-100 text-yellow-700",
  Low: "bg-green-100 text-green-700",
};

const TaskList = ({
  todayTasks = [],
  upcomingTasks = [],
  completedTasks = [],
  onEdit,
  onMarkDone,
}) => (
  <div>
    {/* Today's Tasks */}
    <section>
      <h2 className="font-semibold text-base mb-2">Today's Tasks</h2>
      {!todayTasks.length && (
        <p className="text-sm text-gray-400 mb-2">No tasks for today</p>
      )}
      <ul className="space-y-2">
        {todayTasks.map((task) => (
          <li
            key={task._id}
            className="bg-white px-4 py-3 rounded flex items-center justify-between shadow border"
          >
            <div className="flex items-center gap-3">
              <input
                type="checkbox"
                checked={task.completed}
                onChange={() => onMarkDone(task)}
                className="cursor-pointer h-5 w-5 accent-yellow-500"
                aria-label={`Mark ${task.title} as completed`}
              />
              <span
                className={`font-medium ${
                  task.completed ? "line-through text-gray-400" : ""
                }`}
              >
                {task.title}
              </span>
              {task.label && (
                <span
                  className={`ml-2 px-2 py-1 rounded text-xs font-semibold ${
                    labelColor[task.label] || ""
                  }`}
                >
                  {task.label}
                </span>
              )}
              {task.time && (
                <span className="ml-2 text-xs text-gray-400 whitespace-nowrap">
                  {task.time}
                </span>
              )}
            </div>
            <button
              className="text-gray-500 px-2 py-1 rounded hover:bg-gray-100"
              onClick={() => onEdit(task)}
              aria-label={`Edit ${task.title}`}
            >
              ⋯
            </button>
          </li>
        ))}
      </ul>
    </section>

    {/* Upcoming Tasks */}
    <section className="mt-6">
      <h2 className="font-semibold text-base mb-2">Upcoming Tasks</h2>
      {!upcomingTasks.length && (
        <p className="text-sm text-gray-400 mb-2">No upcoming tasks</p>
      )}
      <ul className="space-y-2">
        {upcomingTasks.map((task) => (
          <li
            key={task._id}
            className="bg-white px-4 py-3 rounded shadow border flex items-center justify-between"
          >
            <div className="flex items-center gap-3">
              <input
                type="checkbox"
                checked={task.completed}
                onChange={() => onMarkDone(task)}
                className="cursor-pointer h-5 w-5 accent-yellow-500"
                aria-label={`Mark ${task.title} as completed`}
              />
              <span className="font-medium">{task.title}</span>
              {task.label && (
                <span
                  className={`ml-2 px-2 py-1 rounded text-xs font-semibold ${
                    labelColor[task.label] || ""
                  }`}
                >
                  {task.label}
                </span>
              )}
              <span className="ml-2 text-xs text-gray-400 whitespace-nowrap">
                {task.time
                  ? task.time
                  : task.date
                  ? `Due: ${new Date(task.date).toLocaleDateString()}`
                  : ""}
              </span>
            </div>
            <button
              className="text-gray-500 px-2 py-1 rounded hover:bg-gray-100"
              onClick={() => onEdit(task)}
              aria-label={`Edit ${task.title}`}
            >
              ⋯
            </button>
          </li>
        ))}
      </ul>
    </section>

    {/* Completed Tasks */}
    <section className="mt-6">
      <h2 className="font-semibold text-base mb-2">Completed Tasks</h2>
      {!completedTasks.length && (
        <p className="text-sm text-gray-400">No completed tasks yet</p>
      )}
      <ul className="space-y-2">
        {completedTasks.map((task) => (
          <li
            key={task._id}
            className="bg-green-50 px-4 py-3 rounded shadow border flex items-center justify-between"
          >
            <div>
              <span className="font-medium text-green-800 line-through">
                {task.title}
              </span>
              <span className="ml-2 text-xs text-gray-500">
                ✔ Completed at {task.completedAtStr || "--"}
              </span>
            </div>
            <button
              className="text-gray-500 px-2 py-1 rounded hover:bg-gray-100"
              onClick={() => onEdit(task)}
              aria-label={`Edit ${task.title}`}
            >
              ⋯
            </button>
          </li>
        ))}
      </ul>
    </section>
  </div>
);

export default TaskList;
