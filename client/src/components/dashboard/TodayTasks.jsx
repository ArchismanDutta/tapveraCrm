import React from "react";

const TodayTasks = ({ data, className }) => {
  const colorMap = {
    red: "bg-red-100 text-red-600",
    yellow: "bg-yellow-100 text-yellow-600",
    green: "bg-green-100 text-green-600",
  };

  return (
    <div className={`space-y-4 ${className || ""}`}>
      {data.length > 0 ? (
        data.map((task, index) => (
          <div
            key={index}
            className="flex flex-col sm:flex-row justify-between items-start sm:items-center bg-white p-4 rounded-lg shadow-sm border border-gray-200"
          >
            {/* Left Section: Task Details */}
            <div className="space-y-2">
              <p className="font-medium text-base">{task.label}</p>

              <p className="text-xs text-gray-500">
                Due:{" "}
                <span className="font-semibold text-gray-800">
                  {task.dueDateTime}
                </span>
              </p>

              <p className="text-xs text-gray-500">
                Assigned By:{" "}
                <span className="font-semibold text-yellow-500">
                  {task.assignedBy}
                </span>
              </p>

              <p className="text-xs text-gray-500">
                Assigned To:{" "}
                <span className="font-semibold text-orange-400">
                  {task.assignedTo}
                </span>
              </p>
            </div>

            {/* Right Section: Priority */}
            <span
              className={`mt-2 sm:mt-0 text-xs px-3 py-1 rounded-full font-medium ${
                colorMap[task.color] || ""
              }`}
            >
              {task.level}
            </span>
          </div>
        ))
      ) : (
        <div className="bg-white p-6 rounded-lg shadow-sm border border-gray-200 text-center text-gray-500 font-medium">
          No Tasks Assigned
        </div>
      )}
    </div>
  );
};

export default TodayTasks;
