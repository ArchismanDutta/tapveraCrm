import React, { useState, useEffect } from "react";
import TaskItem from "./TaskItem";

const TaskList = ({ tasks: initialTasks }) => {
  const [tasks, setTasks] = useState(initialTasks);

  // Ensure tasks update when parent sends new data
  useEffect(() => {
    setTasks(initialTasks);
  }, [initialTasks]);

  return (
    <div className="bg-white rounded-lg shadow p-4">
      <h3 className="font-semibold mb-4">Today's Tasks</h3>
      <div className="flex flex-col gap-4">
        {tasks.length > 0 ? (
          tasks.map((task) => (
            <TaskItem
              key={task._id}
              task={task}
              onStatusUpdated={(updatedTask) => {
                setTasks((prev) =>
                  prev.map((t) => (t._id === updatedTask._id ? updatedTask : t))
                );
              }}
            />
          ))
        ) : (
          <div className="text-center py-6 text-gray-500 font-medium border border-gray-200 rounded-lg">
            No Tasks Assigned
          </div>
        )}
      </div>
    </div>
  );
};

export default TaskList;
