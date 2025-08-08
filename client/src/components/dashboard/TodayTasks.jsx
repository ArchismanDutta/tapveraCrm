// src/components/dashboard/TodayTasks.jsx
import React from "react";

const TodayTasks = ({ data, className }) => {
  const colorMap = {
    red: "bg-red-100 text-red-600",
    yellow: "bg-yellow-100 text-yellow-600",
    green: "bg-green-100 text-green-600",
  };

  return (
    <div className={`${className} bg-white rounded-xl shadow p-6`}>
      <h2 className="text-lg font-semibold mb-4">Today's Tasks</h2>
      {data.map((task, idx) => (
        <div key={idx} className="flex justify-between items-center py-2 border-b last:border-none">
          <div className="flex items-center space-x-3">
            <span className={`h-3 w-3 rounded-full bg-${task.color}-500`}></span>
            <div>
              <p className="font-medium">{task.label}</p>
              <p className="text-xs text-gray-500">{task.time}</p>
            </div>
          </div>
          <span className={`text-xs px-2 py-1 rounded-full ${colorMap[task.color]}`}>{task.level}</span>
        </div>
      ))}
    </div>
  );
};

export default TodayTasks;
