import React from "react";

const TaskStats = ({ totalTasks }) => {
  return (
    <div className="bg-[#181d2a] rounded-lg shadow-lg p-4 mb-6 border border-blue-950">
      <p className="text-3xl font-bold text-[#ff8000]">{totalTasks}</p>
      <p className="text-blue-400 text-sm">Tasks Assigned</p>
    </div>
  );
};

export default TaskStats;
