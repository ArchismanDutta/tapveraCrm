import React from "react";

const colorMap = {
  red: "bg-red-300 text-black border-red-700",
  yellow: "bg-yellow-300 text-black border-yellow-700",
  green: "bg-green-400 text-black border-green-700",

  lightRed: "bg-red-300 text-black border-red-700",
  lightYellow: "bg-yellow-300 text-black border-yellow-700",
  lightGreen: "bg-green-400 text-black border-green-700",
};

const getColorClass = (color) => {
  // Use brighter pastel backgrounds similar to traffic light colors with strong borders
  switch (color) {
    case "red":
      return colorMap.lightRed;
    case "yellow":
      return colorMap.lightYellow;
    case "green":
      return colorMap.lightGreen;
    default:
      return colorMap.lightGreen; // default to bright green pastel
  }
};

const TodayTasks = ({ data = [], className }) => {
  // Newest tasks on top
  const tasksToRender = [...data].reverse();

  return (
    <div className={`space-y-4 ${className || ""}`}>
      {tasksToRender.length > 0 ? (
        tasksToRender.map((task, index) => (
          <div
            key={task.id || index}
            className="flex flex-col sm:flex-row justify-between items-start sm:items-center px-6 py-4 rounded-2xl shadow-xl bg-gradient-to-r from-[#13161c] via-[#181c22] to-[#181d2a]/95 border border-[#232943] hover:shadow-2xl hover:border-[#3f4660] hover:bg-[#232945]/90 transition-all duration-200 ease-out group"
          >
            {/* Left Task Details */}
            <div className="space-y-1">
              <p className="font-semibold text-base text-gray-100 tracking-tight">{task.label}</p>
              <div className="flex flex-wrap gap-4 text-xs text-gray-400 mt-1">
                <span>
                  Due:{" "}
                  <span className="font-semibold text-green-400">
                    {task.dueDateTime || "No due date"}
                  </span>
                </span>
                <span>
                  Assigned By:{" "}
                  <span className="font-semibold text-gray-300">
                    {task.assignedBy || "Unknown"}
                  </span>
                </span>
                <span>
                  Assigned To:{" "}
                  <span className="font-semibold text-gray-400">
                    {Array.isArray(task.assignedTo) ? task.assignedTo.join(", ") : task.assignedTo || "Unknown"}
                  </span>
                </span>
              </div>
            </div>
            {/* Priority Badge */}
            <span
              className={`mt-3 sm:mt-0 ml-0 sm:ml-6 text-xs min-w-[72px] px-4 py-1 rounded-full font-bold border-2 text-center
                ${getColorClass(task.color)}
                group-hover:scale-105 transition-all duration-200`}
            >
              {task.level || "Normal"}
            </span>
          </div>
        ))
      ) : (
        <div className="bg-gradient-to-r from-[#202335] to-[#171b2b] p-6 rounded-2xl shadow-xl border border-[#232945] text-center text-gray-400 font-semibold">
          No Tasks Assigned
        </div>
      )}
    </div>
  );
};

export default TodayTasks;
