import React, { useState, useEffect } from "react";
import TaskItem from "./TaskItem";

const TaskList = ({ tasks: initialTasks }) => {
  const [tasks, setTasks] = useState(initialTasks);

  useEffect(() => {
    setTasks(initialTasks);
  }, [initialTasks]);

  return (
    <div className="bg-[#181d2a] rounded-lg shadow-lg p-4 border border-blue-950">
      <h3 className="font-semibold mb-4 text-blue-100">Today's Tasks</h3>
      <div className="flex flex-col gap-4">
        {tasks && tasks.length > 0 ? (
          tasks.map((task, index) => (
            <TaskItem
              key={task._id || `task-${index}`}
              task={task}
              onStatusUpdated={(updatedTask) => {
                setTasks((prev) =>
                  prev.map((t) => (t._id === updatedTask._id ? updatedTask : t))
                );
              }}
            />
          ))
        ) : (
          <div className="text-center py-6 text-blue-400 font-medium border border-[#f2f3f5] rounded-lg">
            No Tasks Assigned
          </div>
        )}
      </div>
    </div>
  );
};

export default TaskList;
