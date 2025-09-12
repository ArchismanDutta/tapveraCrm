import React, { useState, useEffect } from "react";

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
        {!tasks.length && <p className="text-sm text-gray-500">{emptyLabel}</p>}
        <ul className="space-y-2">{children}</ul>
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
  onDelete,
  onUndoDelete,
  recentlyDeletedTask,
}) => {
  const [showUndo, setShowUndo] = useState(false);

  useEffect(() => {
    if (recentlyDeletedTask) {
      setShowUndo(true);
      const timer = setTimeout(() => setShowUndo(false), 5000);
      return () => clearTimeout(timer);
    }
  }, [recentlyDeletedTask]);

  const renderTask = (task) => (
    <li
      key={task._id}
      className={`px-4 py-3 rounded-xl flex items-center justify-between shadow border transition ${
        task.completed
          ? "bg-green-900 bg-opacity-35 border-green-700"
          : "bg-[#181c28] border-[#232945] hover:bg-[#232945]"
      }`}
    >
      <div className="flex items-center gap-3">
        <input
          type="checkbox"
          checked={task.completed}
          onChange={() => onMarkDone(task)}
          className="cursor-pointer h-5 w-5 accent-yellow-400"
          aria-label={`Mark ${task.title} as ${task.completed ? "incomplete" : "completed"}`}
        />
        <span
          className={`font-medium ${
            task.completed ? "line-through text-green-300" : "text-gray-200"
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
        {task.time && !task.completed && (
          <span className="ml-2 text-xs text-gray-500 whitespace-nowrap">{task.time}</span>
        )}
        {task.completed && task.completedAtStr && (
          <span className="ml-2 text-xs text-green-400 whitespace-nowrap">
            ✔ Completed at {task.completedAtStr}
          </span>
        )}
      </div>
      <div className="flex gap-2">
        <button
          className="text-gray-400 px-2 py-1 rounded hover:bg-[#232945]"
          onClick={() => onEdit(task)}
          aria-label={`Edit ${task.title}`}
        >
          ⋯
        </button>
        <button
          className="text-red-400 px-2 py-1 rounded hover:bg-[#232945]"
          onClick={() => onDelete(task._id)}
          aria-label={`Delete ${task.title}`}
        >
          🗑
        </button>
      </div>
    </li>
  );

  return (
    <div>
      <Section title="Today's Tasks" tasks={todayTasks} emptyLabel="No tasks for today">
        {todayTasks.map(renderTask)}
      </Section>

      <Section title="Upcoming Tasks" tasks={upcomingTasks} emptyLabel="No upcoming tasks">
        {upcomingTasks.map(renderTask)}
      </Section>

      <Section title="Completed Tasks" tasks={completedTasks} emptyLabel="No completed tasks yet">
        {completedTasks.map(renderTask)}
      </Section>

      {showUndo && recentlyDeletedTask && (
        <div className="fixed bottom-6 right-6 bg-blue-800/90 text-white px-4 py-3 rounded-lg shadow-lg flex items-center gap-4">
          <span>Task "{recentlyDeletedTask.title}" deleted</span>
          <button
            onClick={() => onUndoDelete()}
            className="px-3 py-1 bg-blue-500 rounded hover:bg-blue-600 transition"
          >
            Undo
          </button>
        </div>
      )}
    </div>
  );
};

export default TaskList;
