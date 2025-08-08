import React from "react";
import TaskItem from "./TaskItem";

const TaskList = ({ tasks, onStatusChange }) => {
  return (
    <div className="bg-white rounded-lg shadow p-4">
      <h3 className="font-semibold mb-4">Today's Tasks</h3>
      <div className="flex flex-col gap-4">
        {tasks.map((task) => (
          <TaskItem key={task.id} task={task} onStatusChange={onStatusChange} />
        ))}
      </div>
    </div>
  );
};

export default TaskList;
