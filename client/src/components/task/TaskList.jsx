import React from "react";
import TaskItem from "./TaskItem";
import TaskKanban from "./TaskKanban";

const TaskList = ({ tasks, onStatusChange, onTaskUpdated, loading, viewMode = 'list', setViewMode }) => {
  // Parent owns the task list; pass server-updated tasks straight up
  const handleTaskStatusUpdate = (updatedTask) => {
    if (onTaskUpdated) onTaskUpdated(updatedTask);
  };

  if (loading) {
    return (
      <div className="bg-[#181d2a] rounded-lg shadow-lg p-4 border border-blue-950">
        <h3 className="font-semibold mb-4 text-blue-100">Tasks</h3>
        <div className="flex items-center justify-center py-8">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-[#ff8000]"></div>
          <span className="ml-3 text-blue-400">Loading tasks...</span>
        </div>
      </div>
    );
  }

  return (
    <div className="bg-[#181d2a] rounded-lg shadow-lg p-4 border border-blue-950">
      <h3 className="font-semibold mb-4 text-blue-100">
        Tasks {viewMode === 'kanban' ? '(Kanban View)' : '(List View)'}
      </h3>

      {viewMode === 'list' ? (
        <div className="flex flex-col gap-4">
          {tasks && tasks.length > 0 ? (
            tasks.map((task, index) => (
              <TaskItem
                key={task._id || `task-${index}`}
                task={task}
                onStatusUpdated={handleTaskStatusUpdate}
              />
            ))
          ) : (
            <div className="text-center py-8 text-blue-400 font-medium bg-[#141a29] border border-blue-950 rounded-lg">
              <p className="text-lg mb-2">📝 No Tasks Found</p>
              <p className="text-sm opacity-75">
                No tasks match the current filters
              </p>
            </div>
          )}
        </div>
      ) : (
        // Kanban view
        <TaskKanban
          tasks={tasks}
          onStatusChange={onStatusChange}
          onTaskUpdated={onTaskUpdated}
          loading={loading}
        />
      )}
    </div>
  );
};

export default TaskList;
