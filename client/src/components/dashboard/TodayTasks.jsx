import React from "react";

const TodayTasks = ({ data, className }) => {
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
            key={index}
            className="flex flex-col sm:flex-row justify-between items-start sm:items-center bg-white p-5 rounded-xl shadow-sm border border-gray-100 hover:shadow-md hover:border-gray-200 transition duration-200"
          >
            {/* Left Section: Task Details */}
            <div className="space-y-1">
              <p className="font-semibold text-lg text-gray-800">
                {task.label}
              </p>

              <p className="text-sm text-gray-500">
                <span className="font-medium text-gray-600">Due:</span>{" "}
                <span className="text-gray-800">
                  {formatDateTime(task.dueDateTime)}
                </span>
              </p>

              <p className="text-sm text-gray-500">
                <span className="font-medium text-gray-600">Assigned By:</span>{" "}
                <span className="text-yellow-600 font-medium">
                  {task.assignedBy}
                </span>
              </p>

              <p className="text-sm text-gray-500">
                <span className="font-medium text-gray-600">Assigned To:</span>{" "}
                <span className="text-orange-500 font-medium">
                  {task.assignedTo}
                </span>
              </p>
            </div>

            {/* Right Section: Priority */}
            <span
              className={`mt-3 sm:mt-0 text-xs px-3 py-1 rounded-full font-semibold shadow-sm ${
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
