import React, { useState } from "react";

const tasksData = [
  { id: 1, title: "Prepare Monthly Report", status: "Assigned" },
  { id: 2, title: "Fix Dashboard UI Bugs", status: "Working on it" },
  { id: 3, title: "Update Client Records", status: "Submitted" },
];

const TaskList = () => {
  const [tasks, setTasks] = useState(tasksData);

  const updateStatus = (id, newStatus) => {
    setTasks(tasks.map(task => 
      task.id === id ? { ...task, status: newStatus } : task
    ));
  };

  return (
    <ul className="space-y-4">
      {tasks.map(task => (
        <li
          key={task.id}
          className="flex justify-between items-center bg-gray-100 p-3 rounded-lg"
        >
          <span>{task.title}</span>
          <div className="relative">
            <select
              value={task.status}
              onChange={(e) => updateStatus(task.id, e.target.value)}
              className="bg-white border rounded-lg px-3 py-1 text-sm shadow-sm"
            >
              <option>Assigned</option>
              <option>Working on it</option>
              <option>Submitted</option>
            </select>
          </div>
        </li>
      ))}
    </ul>
  );
};

export default TaskList;
