import React from "react";
import { FaCheckCircle } from "react-icons/fa";
import TaskItem from "./TaskItem";
import TaskKanban from "./TaskKanban";

const TaskList = ({ tasks, onStatusChange, onTaskUpdated, loading, viewMode = "list" }) => {
  const handleTaskStatusUpdate = (updatedTask) => {
    onTaskUpdated?.(updatedTask);
  };

  if (loading) {
    return (
      <div className="space-y-3" aria-label="Loading tasks">
        {[0, 1, 2].map((item) => (
          <div
            key={item}
            className="h-28 animate-pulse rounded-2xl border border-slate-200 bg-white dark:border-white/10 dark:bg-white/[0.035]"
          />
        ))}
      </div>
    );
  }

  if (viewMode === "kanban") {
    return (
      <TaskKanban
        tasks={tasks}
        onStatusChange={onStatusChange}
        onTaskUpdated={onTaskUpdated}
        loading={loading}
      />
    );
  }

  if (!tasks?.length) {
    return (
      <div className="flex min-h-52 flex-col items-center justify-center rounded-2xl border border-dashed border-slate-300 bg-slate-50 px-6 text-center dark:border-white/10 dark:bg-white/[0.02]">
        <span className="mb-3 grid h-10 w-10 place-items-center rounded-full bg-slate-200 text-slate-500 dark:bg-white/[0.07] dark:text-slate-400">
          <FaCheckCircle size={16} />
        </span>
        <p className="text-sm font-semibold text-slate-800 dark:text-slate-100">No tasks to show</p>
        <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">Try changing the filters, or enjoy the clear list.</p>
      </div>
    );
  }

  return (
    <div className="space-y-3">
      {tasks.map((task, index) => (
        <TaskItem
          key={task._id || `task-${index}`}
          task={task}
          onStatusUpdated={handleTaskStatusUpdate}
        />
      ))}
    </div>
  );
};

export default TaskList;
