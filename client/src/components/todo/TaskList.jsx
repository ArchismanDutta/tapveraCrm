import React, { useState } from "react";

const labelColor = {
  High: "bg-red-900 text-red-300",
  Medium: "bg-yellow-800 text-yellow-300",
  Low: "bg-green-900 text-green-300",
};

const Section = ({ title, tasks, emptyLabel, children }) => {
  const [collapsed, setCollapsed] = useState(false);
  return (
    <section className="mb-8">
      <div
        className="flex justify-between items-center cursor-pointer"
        onClick={() => setCollapsed((v) => !v)}
        tabIndex={0}
        role="button"
        aria-label={`Toggle ${title}`}
      >
        <h2 className="font-semibold text-base text-gray-100">{title}</h2>
        <span className="text-xs rounded-full px-2 py-0.5 bg-[#232945] text-gray-400 ml-2">
          {tasks.length} Tasks
        </span>
        <span className="ml-2 text-sm text-gray-400">{collapsed ? "▲" : "▼"}</span>
      </div>
      <div className={`${collapsed ? "hidden" : ""} mt-2`}>
        {!tasks.length && (
          <p className="text-sm text-gray-500">{emptyLabel}</p>
        )}
        <ul className="space-y-2">
          {children}
        </ul>
      </div>
    </section>
  );
};

const TaskList = ({
  todayTasks = [],
  upcomingTasks = [],
  completedTasks = [],
  onEdit,
  onMarkDone,
}) => (
  <div>
    <Section title="Today's Tasks" tasks={todayTasks} emptyLabel="No tasks for today">
      {todayTasks.map((task) => (
        <li
          key={task._id}
          className="bg-[#181c28] px-4 py-3 rounded-xl flex items-center justify-between shadow border border-[#232945] hover:bg-[#232945] transition"
        >
          <div className="flex items-center gap-3">
            <input
              type="checkbox"
              checked={task.completed}
              onChange={() => onMarkDone(task)}
              className="cursor-pointer h-5 w-5 accent-yellow-400"
              aria-label={`Mark ${task.title} as completed`}
            />
            <span
              className={`font-medium ${
                task.completed ? "line-through text-gray-500" : "text-gray-200"
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
              <span className="ml-2 text-xs text-gray-500 whitespace-nowrap">
                {task.time}
              </span>
            )}
          </div>
          <button
            className="text-gray-400 px-2 py-1 rounded hover:bg-[#232945]"
            onClick={() => onEdit(task)}
            aria-label={`Edit ${task.title}`}
          >
            ⋯
          </button>
        </li>
      ))}
    </Section>
    <Section title="Upcoming Tasks" tasks={upcomingTasks} emptyLabel="No upcoming tasks">
      {upcomingTasks.map((task) => (
        <li
          key={task._id}
          className="bg-[#181c28] px-4 py-3 rounded-xl shadow border border-[#232945] flex items-center justify-between hover:bg-[#232945] transition"
        >
          <div className="flex items-center gap-3">
            <input
              type="checkbox"
              checked={task.completed}
              onChange={() => onMarkDone(task)}
              className="cursor-pointer h-5 w-5 accent-yellow-400"
              aria-label={`Mark ${task.title} as completed`}
            />
            <span className="font-medium text-gray-200">{task.title}</span>
            {task.label && (
              <span
                className={`ml-2 px-2 py-1 rounded text-xs font-semibold ${
                  labelColor[task.label] || ""
                }`}
              >
                {task.label}
              </span>
            )}
            <span className="ml-2 text-xs text-gray-500 whitespace-nowrap">
              {task.time
                ? task.time
                : task.date
                ? `Due: ${new Date(task.date).toLocaleDateString()}`
                : ""}
            </span>
          </div>
          <button
            className="text-gray-400 px-2 py-1 rounded hover:bg-[#232945]"
            onClick={() => onEdit(task)}
            aria-label={`Edit ${task.title}`}
          >
            ⋯
          </button>
        </li>
      ))}
    </Section>
    <Section title="Completed Tasks" tasks={completedTasks} emptyLabel="No completed tasks yet">
      {completedTasks.map((task) => (
        <li
          key={task._id}
          className="bg-green-900 bg-opacity-35 px-4 py-3 rounded-xl shadow border border-green-700 flex items-center justify-between"
        >
          <div>
            <span className="font-medium text-green-300 line-through">
              {task.title}
            </span>
            <span className="ml-2 text-xs text-green-400">
              ✔ Completed at {task.completedAtStr || "--"}
            </span>
          </div>
          <button
            className="text-gray-400 px-2 py-1 rounded hover:bg-[#232945]"
            onClick={() => onEdit(task)}
            aria-label={`Edit ${task.title}`}
          >
            ⋯
          </button>
        </li>
      ))}
    </Section>
  </div>
);

export default TaskList;
