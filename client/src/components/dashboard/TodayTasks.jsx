import React from "react";

const TodayTasks = ({ data = [], className }) => {
  const colorMap = {
    red: "bg-red-100 text-red-700",
    yellow: "bg-yellow-100 text-yellow-700",
    green: "bg-green-100 text-green-700",
  };

  const formatDateTime = (dateTime) => {
    if (!dateTime) return "N/A";
    const date = new Date(dateTime);
    return date.toLocaleString("en-GB", {
      day: "2-digit",
      month: "short",
      year: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    });
  };

  return (
    <div className={`space-y-4 ${className || ""}`}>
      {data.length > 0 ? (
        data.map((task, index) => (
          <div

            key={task.id || index}
            className="flex flex-col sm:flex-row justify-between items-start sm:items-center bg-white p-4 rounded-lg shadow-sm border border-gray-200 hover:shadow-md transition-shadow"
          >
            {/* Left Section: Task Details */}
            <div className="space-y-2">
              {/* Task title */}
              <p className="font-medium text-base text-gray-800">
                {task.label}
              </p>

              {/* Due date */}
              <p className="text-xs text-gray-500">
                Due:{" "}
                <span className="font-semibold text-gray-800">
                  {task.dueDateTime || "No due date"}
                </span>
              </p>

              {/* Assigned By */}
              <p className="text-xs text-gray-500">
                Assigned By:{" "}
                <span className="font-semibold text-yellow-500">
                  {task.assignedBy || "Unknown"}
                </span>
              </p>

              {/* Assigned To */}
              <p className="text-xs text-gray-500">
                Assigned To:{" "}
                <span className="font-semibold text-orange-400">
                  {Array.isArray(task.assignedTo)
                    ? task.assignedTo.join(", ")
                    : task.assignedTo || "Unknown"}

                </span>
              </p>
            </div>

            {/* Right Section: Priority */}
            <span
              className={`mt-3 sm:mt-0 text-xs px-3 py-1 rounded-full font-semibold shadow-sm ${
                colorMap[task.color] || ""
              }`}
            >
              {task.level || "Normal"}
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
