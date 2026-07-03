import React, { useEffect, useState } from "react";
import {
  AlertCircle,
  BadgeCheck,
  CalendarDays,
  CheckCircle2,
  ChevronDown,
  Clock3,
  Edit3,
  ListChecks,
  Trash2,
} from "lucide-react";

const priorityStyles = {
  high: "border-rose-200 bg-rose-50 text-rose-700 dark:border-rose-400/20 dark:bg-rose-400/10 dark:text-rose-200",
  medium:
    "border-amber-200 bg-amber-50 text-amber-700 dark:border-amber-400/20 dark:bg-amber-400/10 dark:text-amber-200",
  low: "border-emerald-200 bg-emerald-50 text-emerald-700 dark:border-emerald-400/20 dark:bg-emerald-400/10 dark:text-emerald-200",
};

const getTaskTitle = (task) => task.title || task.text || "Untitled task";

const getPriority = (task) =>
  String(task.label || task.priority || "").trim().toLowerCase();

const formatTaskDate = (date) => {
  if (!date) return "";
  const parsed = new Date(date);
  if (Number.isNaN(parsed.getTime())) return "";

  return parsed.toLocaleDateString("en-IN", {
    day: "numeric",
    month: "short",
    year: "numeric",
  });
};

const PriorityBadge = ({ task }) => {
  const priority = getPriority(task);
  if (!priority) return null;

  return (
    <span
      className={`inline-flex items-center gap-1 rounded-md border px-2 py-1 text-[10px] font-semibold capitalize ${
        priorityStyles[priority] ||
        "border-slate-200 bg-slate-50 text-slate-600 dark:border-white/10 dark:bg-white/[0.04] dark:text-slate-300"
      }`}
    >
      <AlertCircle className="h-3 w-3" />
      {priority}
    </span>
  );
};

const TaskActions = ({ task, onEdit, onDelete }) => {
  const title = getTaskTitle(task);

  return (
    <div className="flex shrink-0 items-center gap-1">
      <button
        type="button"
        onClick={() => onEdit(task)}
        className="inline-flex h-8 w-8 items-center justify-center rounded-lg text-slate-400 transition hover:bg-blue-50 hover:text-blue-700 dark:hover:bg-blue-400/10 dark:hover:text-blue-200"
        aria-label={`Edit ${title}`}
      >
        <Edit3 className="h-3.5 w-3.5" />
      </button>
      <button
        type="button"
        onClick={() => onDelete(task._id)}
        className="inline-flex h-8 w-8 items-center justify-center rounded-lg text-slate-400 transition hover:bg-rose-50 hover:text-rose-700 dark:hover:bg-rose-400/10 dark:hover:text-rose-200"
        aria-label={`Delete ${title}`}
      >
        <Trash2 className="h-3.5 w-3.5" />
      </button>
    </div>
  );
};

const TaskMeta = ({ task }) => (
  <div className="flex flex-wrap items-center gap-x-4 gap-y-2 text-[11px] text-slate-500 dark:text-slate-400">
    {task.date && (
      <span className="inline-flex items-center gap-1.5">
        <CalendarDays className="h-3.5 w-3.5" />
        {formatTaskDate(task.date)}
      </span>
    )}
    {task.time && !task.completed && (
      <span className="inline-flex items-center gap-1.5 text-amber-700 dark:text-amber-200">
        <Clock3 className="h-3.5 w-3.5" />
        {task.time}
      </span>
    )}
    {task.completed && task.completedAtStr && (
      <span className="inline-flex items-center gap-1.5 text-emerald-700 dark:text-emerald-200">
        <CheckCircle2 className="h-3.5 w-3.5" />
        Completed {task.completedAtStr}
      </span>
    )}
  </div>
);

const TaskCard = ({ task, onEdit, onMarkDone, onDelete }) => {
  const title = getTaskTitle(task);

  return (
    <article
      className={`rounded-xl border p-4 transition ${
        task.completed
          ? "border-emerald-200 bg-emerald-50/60 dark:border-emerald-400/20 dark:bg-emerald-400/[0.07]"
          : "border-slate-200 bg-slate-50/70 hover:border-blue-200 hover:bg-white dark:border-white/10 dark:bg-white/[0.025] dark:hover:border-blue-400/20 dark:hover:bg-white/[0.04]"
      }`}
    >
      <div className="flex items-start gap-3">
        <input
          type="checkbox"
          checked={Boolean(task.completed)}
          onChange={() => onMarkDone(task)}
          className="mt-1 h-4 w-4 shrink-0 cursor-pointer rounded border-slate-300 accent-emerald-600"
          aria-label={`Mark ${title} as ${
            task.completed ? "incomplete" : "completed"
          }`}
        />
        <div className="min-w-0 flex-1">
          <div className="flex items-start justify-between gap-2">
            <h3
              className={`min-w-0 break-words text-sm font-semibold ${
                task.completed
                  ? "text-emerald-800 line-through dark:text-emerald-200"
                  : "text-slate-950 dark:text-white"
              }`}
            >
              {title}
            </h3>
            <TaskActions task={task} onEdit={onEdit} onDelete={onDelete} />
          </div>

          {task.description && (
            <p
              className={`mt-2 line-clamp-3 text-sm leading-5 ${
                task.completed
                  ? "text-emerald-700/70 dark:text-emerald-200/60"
                  : "text-slate-600 dark:text-slate-300"
              }`}
            >
              {task.description}
            </p>
          )}

          <div className="mt-4 flex flex-wrap items-end justify-between gap-3 border-t border-slate-200 pt-3 dark:border-white/10">
            <TaskMeta task={task} />
            <PriorityBadge task={task} />
          </div>
        </div>
      </div>
    </article>
  );
};

const TaskRow = ({ task, onEdit, onMarkDone, onDelete }) => {
  const title = getTaskTitle(task);

  return (
    <li
      className={`rounded-xl border p-3 transition ${
        task.completed
          ? "border-emerald-200 bg-emerald-50/60 dark:border-emerald-400/20 dark:bg-emerald-400/[0.07]"
          : "border-slate-200 bg-slate-50/70 hover:bg-white dark:border-white/10 dark:bg-white/[0.025] dark:hover:bg-white/[0.04]"
      }`}
    >
      <div className="flex items-start gap-3">
        <input
          type="checkbox"
          checked={Boolean(task.completed)}
          onChange={() => onMarkDone(task)}
          className="mt-1 h-4 w-4 shrink-0 cursor-pointer rounded border-slate-300 accent-emerald-600"
          aria-label={`Mark ${title} as ${
            task.completed ? "incomplete" : "completed"
          }`}
        />
        <div className="min-w-0 flex-1">
          <div className="flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
            <div className="min-w-0">
              <div className="flex flex-wrap items-center gap-2">
                <h3
                  className={`break-words text-sm font-semibold ${
                    task.completed
                      ? "text-emerald-800 line-through dark:text-emerald-200"
                      : "text-slate-950 dark:text-white"
                  }`}
                >
                  {title}
                </h3>
                <PriorityBadge task={task} />
              </div>
              {task.description && (
                <p className="mt-1 line-clamp-2 text-xs leading-5 text-slate-500 dark:text-slate-400">
                  {task.description}
                </p>
              )}
            </div>
            <TaskActions task={task} onEdit={onEdit} onDelete={onDelete} />
          </div>
          <div className="mt-3">
            <TaskMeta task={task} />
          </div>
        </div>
      </div>
    </li>
  );
};

const Section = ({
  title,
  description,
  tasks,
  emptyLabel,
  viewMode,
  icon,
  children,
}) => {
  const [collapsed, setCollapsed] = useState(false);
  const Icon = icon;

  return (
    <section className="mb-4 overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm last:mb-0 dark:border-white/10 dark:bg-[#10131c]">
      <button
        type="button"
        className="flex w-full items-center justify-between gap-3 px-4 py-3 text-left transition hover:bg-slate-50 dark:hover:bg-white/[0.025]"
        onClick={() => setCollapsed((current) => !current)}
        aria-expanded={!collapsed}
      >
        <div className="flex min-w-0 items-center gap-3">
          <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg border border-slate-200 bg-slate-50 text-slate-600 dark:border-white/10 dark:bg-white/[0.04] dark:text-slate-300">
            <Icon className="h-4 w-4" />
          </span>
          <span className="min-w-0">
            <span className="block text-sm font-semibold text-slate-950 dark:text-white">
              {title}
            </span>
            <span className="block truncate text-[11px] text-slate-500 dark:text-slate-400">
              {description}
            </span>
          </span>
        </div>
        <span className="flex shrink-0 items-center gap-2">
          <span className="rounded-md border border-slate-200 bg-slate-50 px-2 py-1 text-[11px] font-semibold text-slate-600 dark:border-white/10 dark:bg-white/[0.04] dark:text-slate-300">
            {tasks.length}
          </span>
          <ChevronDown
            className={`h-4 w-4 text-slate-400 transition-transform ${
              collapsed ? "-rotate-90" : ""
            }`}
          />
        </span>
      </button>

      {!collapsed && (
        <div className="border-t border-slate-200 p-4 dark:border-white/10">
          {tasks.length === 0 ? (
            <div className="py-8 text-center">
              <div className="mx-auto flex h-10 w-10 items-center justify-center rounded-lg border border-slate-200 bg-slate-50 text-slate-400 dark:border-white/10 dark:bg-white/[0.03]">
                <CheckCircle2 className="h-4 w-4" />
              </div>
              <p className="mt-3 text-sm font-medium text-slate-700 dark:text-slate-300">
                {emptyLabel}
              </p>
              <p className="mt-1 text-xs text-slate-400">
                Nothing needs your attention in this section.
              </p>
            </div>
          ) : viewMode === "cards" ? (
            <div className="grid gap-3 md:grid-cols-2 2xl:grid-cols-3">
              {children}
            </div>
          ) : (
            <ul className="space-y-2">{children}</ul>
          )}
        </div>
      )}
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
    if (!recentlyDeletedTask) {
      setShowUndo(false);
      return undefined;
    }

    setShowUndo(true);
    const timer = setTimeout(() => setShowUndo(false), 5000);
    return () => clearTimeout(timer);
  }, [recentlyDeletedTask]);

  const renderTask = (task) =>
    viewMode === "cards" ? (
      <TaskCard
        key={task._id}
        task={task}
        onEdit={onEdit}
        onMarkDone={onMarkDone}
        onDelete={onDelete}
      />
    ) : (
      <TaskRow
        key={task._id}
        task={task}
        onEdit={onEdit}
        onMarkDone={onMarkDone}
        onDelete={onDelete}
      />
    );

  return (
    <>
      <Section
        title="Today"
        description="Tasks scheduled for the current day"
        tasks={todayTasks}
        emptyLabel="Today is clear"
        viewMode={viewMode}
        icon={ListChecks}
      >
        {todayTasks.map(renderTask)}
      </Section>

      <Section
        title="Upcoming"
        description="Work scheduled after today"
        tasks={upcomingTasks}
        emptyLabel="No upcoming tasks"
        viewMode={viewMode}
        icon={CalendarDays}
      >
        {upcomingTasks.map(renderTask)}
      </Section>

      <Section
        title="Completed"
        description="Recently finished work"
        tasks={completedTasks}
        emptyLabel="No completed tasks yet"
        viewMode={viewMode}
        icon={BadgeCheck}
      >
        {completedTasks.map(renderTask)}
      </Section>

      {showUndo && recentlyDeletedTask && (
        <div
          className="fixed bottom-4 left-3 right-3 z-50 flex items-center justify-between gap-3 rounded-xl border border-white/10 bg-slate-950 px-4 py-3 text-sm text-white shadow-2xl sm:left-auto sm:right-5 sm:max-w-md"
          role="status"
        >
          <span className="min-w-0 truncate">
            “{getTaskTitle(recentlyDeletedTask)}” deleted
          </span>
          <button
            type="button"
            onClick={onUndoDelete}
            className="shrink-0 rounded-lg bg-white/10 px-3 py-1.5 text-xs font-semibold transition hover:bg-white/20"
          >
            Undo
          </button>
        </div>
      )}
    </>
  );
};

export default TaskList;
