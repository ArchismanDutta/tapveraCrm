import React from "react";

const TaskStats = ({ totalTasks }) => {
  return (
    <div className="bg-white rounded-lg shadow p-4 mb-6">
      <p className="text-3xl font-bold text-orange-400">{totalTasks}</p>
      <p className="text-gray-500 text-sm">Tasks Due Today</p>
    </div>
  );
};

export default TaskStats;
