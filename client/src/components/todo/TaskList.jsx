import React, { useState, useEffect } from "react";
import { Calendar, Clock, Tag, CheckCircle, Edit3, Trash2, AlertCircle } from "lucide-react";

const labelColor = {
  High: "bg-red-900 text-red-300",
  Medium: "bg-yellow-800 text-yellow-300",
  Low: "bg-green-900 text-green-300",
};

const Section = ({ title, tasks, emptyLabel, viewMode, children }) => {
  const [collapsed, setCollapsed] = useState(false);

  return (
    <section className="mb-8">
      <div
        className="flex justify-between items-center cursor-pointer p-4 bg-gradient-to-r from-slate-800/40 to-slate-900/40 backdrop-blur-sm border border-slate-600/30 rounded-2xl mb-4 hover:from-slate-700/40 hover:to-slate-800/40 transition-all duration-300"
        onClick={() => setCollapsed((v) => !v)}
        tabIndex={0}
        role="button"
        aria-label={`Toggle ${title}`}
      >
        <h2 className="font-bold text-xl text-white">{title}</h2>
        <div className="flex items-center gap-3">
          <span className="text-sm rounded-full px-4 py-2 bg-gradient-to-r from-cyan-500/20 to-blue-500/20 text-cyan-300 border border-cyan-500/30 font-medium">
            {tasks.length} {tasks.length === 1 ? 'Task' : 'Tasks'}
          </span>
          <span className="text-lg text-gray-400 transition-transform duration-300" style={{ transform: collapsed ? 'rotate(180deg)' : 'rotate(0deg)' }}>
            ▼
          </span>
        </div>
      </div>
      <div className={`${collapsed ? "hidden" : ""} transition-all duration-300`}>
        {!tasks.length && (
          <div className="text-center py-12">
            <p className="text-gray-400 text-lg">{emptyLabel}</p>
          </div>
        )}
        {viewMode === "cards" ? (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {children}
          </div>
        ) : (
          <ul className="space-y-3">{children}</ul>
        )}
      </div>
    </section>
  );
};

const TaskList = ({
  todayTasks = [],
  upcomingTasks = [],
  completedTasks = [],
  viewMode = "cards",
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

  // Card view rendering
  const renderTaskCard = (task) => (
    <div
      key={task._id}
      className={`p-6 rounded-2xl shadow-lg border transition-all duration-300 hover:scale-[1.02] ${
        task.completed
          ? "bg-gradient-to-br from-emerald-900/40 to-green-900/40 border-emerald-700/50"
          : "bg-gradient-to-br from-slate-800/60 to-slate-900/60 border-slate-600/30 hover:border-slate-500/50"
      }`}
    >
      <div className="flex items-start justify-between mb-4">
        <div className="flex items-center gap-3">
          <input
            type="checkbox"
            checked={task.completed}
            onChange={() => onMarkDone(task)}
            className="cursor-pointer h-5 w-5 accent-emerald-400 rounded"
            aria-label={`Mark ${task.title} as ${task.completed ? "incomplete" : "completed"}`}
          />
          <h3
            className={`font-semibold text-lg ${
              task.completed ? "line-through text-emerald-300" : "text-white"
            }`}
          >
            {task.title}
          </h3>
        </div>
        <div className="flex items-center gap-2">
          {task.label && (
            <span
              className={`px-3 py-1 rounded-full text-xs font-semibold flex items-center gap-1 ${
                labelColor[task.label] || "bg-gray-700 text-gray-300"
              }`}
            >
              <AlertCircle className="h-3 w-3" />
              {task.label}
            </span>
          )}
          <button
            className="text-gray-400 hover:text-blue-400 p-2 rounded-lg hover:bg-slate-700/50 transition-colors"
            onClick={() => onEdit(task)}
            aria-label={`Edit ${task.title}`}
          >
            <Edit3 className="h-4 w-4" />
          </button>
          <button
            className="text-gray-400 hover:text-red-400 p-2 rounded-lg hover:bg-slate-700/50 transition-colors"
            onClick={() => onDelete(task._id)}
            aria-label={`Delete ${task.title}`}
          >
            <Trash2 className="h-4 w-4" />
          </button>
        </div>
      </div>

      {task.description && (
        <p className={`text-sm mb-4 ${task.completed ? "text-emerald-200/70" : "text-gray-300"}`}>
          {task.description}
        </p>
      )}

      <div className="flex items-center justify-between text-xs">
        <div className="flex items-center gap-4">
          {task.date && (
            <div className="flex items-center gap-1 text-gray-400">
              <Calendar className="h-3 w-3" />
              {new Date(task.date).toLocaleDateString()}
            </div>
          )}
          {task.time && !task.completed && (
            <div className="flex items-center gap-1 text-amber-400">
              <Clock className="h-3 w-3" />
              {task.time}
            </div>
          )}
        </div>
        {task.completed && task.completedAtStr && (
          <div className="flex items-center gap-1 text-emerald-400">
            <CheckCircle className="h-3 w-3" />
            <span>Completed {task.completedAtStr}</span>
          </div>
        )}
      </div>
    </div>
  );

  // List view rendering
  const renderTaskList = (task) => (
    <li
      key={task._id}
      className={`px-4 py-3 rounded-xl flex items-center justify-between shadow border transition-all duration-300 ${
        task.completed
          ? "bg-emerald-900/35 border-emerald-700/50"
          : "bg-slate-800/50 border-slate-600/30 hover:bg-slate-700/50"
      }`}
    >
      <div className="flex items-center gap-3 flex-1">
        <input
          type="checkbox"
          checked={task.completed}
          onChange={() => onMarkDone(task)}
          className="cursor-pointer h-5 w-5 accent-emerald-400"
          aria-label={`Mark ${task.title} as ${task.completed ? "incomplete" : "completed"}`}
        />
        <div className="flex-1">
          <span
            className={`font-medium ${
              task.completed ? "line-through text-emerald-300" : "text-gray-200"
            }`}
          >
            {task.title}
          </span>
          {task.description && (
            <p className={`text-sm mt-1 ${task.completed ? "text-emerald-200/70" : "text-gray-400"}`}>
              {task.description}
            </p>
          )}
        </div>
        <div className="flex items-center gap-2">
          {task.label && (
            <span
              className={`px-2 py-1 rounded-full text-xs font-semibold ${
                labelColor[task.label] || "bg-gray-700 text-gray-300"
              }`}
            >
              {task.label}
            </span>
          )}
          {task.time && !task.completed && (
            <span className="text-xs text-amber-400 whitespace-nowrap flex items-center gap-1">
              <Clock className="h-3 w-3" />
              {task.time}
            </span>
          )}
          {task.completed && task.completedAtStr && (
            <span className="text-xs text-emerald-400 whitespace-nowrap flex items-center gap-1">
              <CheckCircle className="h-3 w-3" />
              {task.completedAtStr}
            </span>
          )}
        </div>
      </div>
      <div className="flex gap-2">
        <button
          className="text-gray-400 hover:text-blue-400 px-2 py-1 rounded hover:bg-slate-700/50 transition-colors"
          onClick={() => onEdit(task)}
          aria-label={`Edit ${task.title}`}
        >
          <Edit3 className="h-4 w-4" />
        </button>
        <button
          className="text-gray-400 hover:text-red-400 px-2 py-1 rounded hover:bg-slate-700/50 transition-colors"
          onClick={() => onDelete(task._id)}
          aria-label={`Delete ${task.title}`}
        >
          <Trash2 className="h-4 w-4" />
        </button>
      </div>
    </li>
  );

  const renderFunction = viewMode === "cards" ? renderTaskCard : renderTaskList;

  return (
    <div>
      <Section title="Today's Tasks" tasks={todayTasks} emptyLabel="No tasks for today" viewMode={viewMode}>
        {todayTasks.map(renderFunction)}
      </Section>

      <Section title="Upcoming Tasks" tasks={upcomingTasks} emptyLabel="No upcoming tasks" viewMode={viewMode}>
        {upcomingTasks.map(renderFunction)}
      </Section>

      <Section title="Completed Tasks" tasks={completedTasks} emptyLabel="No completed tasks yet" viewMode={viewMode}>
        {completedTasks.map(renderFunction)}
      </Section>

      {showUndo && recentlyDeletedTask && (
        <div className="fixed bottom-6 right-6 bg-gradient-to-r from-blue-600 to-purple-600 text-white px-6 py-4 rounded-2xl shadow-2xl flex items-center gap-4 backdrop-blur-sm border border-blue-500/30 z-50">
          <span className="font-medium">Task "{recentlyDeletedTask.title}" deleted</span>
          <button
            onClick={() => onUndoDelete()}
            className="px-4 py-2 bg-white/20 hover:bg-white/30 rounded-xl font-semibold transition-all duration-300 hover:scale-105"
          >
            Undo
          </button>
        </div>
      )}
    </div>
  );
};

export default TaskList;
