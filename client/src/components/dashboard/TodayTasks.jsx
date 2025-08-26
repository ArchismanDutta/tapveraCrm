import React from "react";

const colorMap = {
  red: "bg-gradient-to-r from-red-800 via-red-900 to-red-800 text-red-200 border border-red-900 shadow-red-900/30",
  yellow: "bg-gradient-to-r from-yellow-800 via-yellow-900 to-yellow-800 text-yellow-200 border border-yellow-900 shadow-yellow-900/30",
  green: "bg-gradient-to-r from-green-800 via-green-900 to-green-800 text-green-200 border border-green-900 shadow-green-900/30",
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
                  <span className="font-semibold text-orange-400">
                    {task.dueDateTime || "No due date"}
                  </span>
                </span>
                <span>
                  Assigned By:{" "}
                  <span className="font-semibold text-yellow-300">
                    {task.assignedBy || "Unknown"}
                  </span>
                </span>
                <span>
                  Assigned To:{" "}
                  <span className="font-semibold text-blue-200">
                    {Array.isArray(task.assignedTo) ? task.assignedTo.join(", ") : task.assignedTo || "Unknown"}
                  </span>
                </span>
              </div>
            </div>
            {/* Priority Badge */}
            <span
              className={`mt-3 sm:mt-0 ml-0 sm:ml-6 text-xs min-w-[72px] px-4 py-1 rounded-full font-bold shadow-lg border-2 text-center
              ${colorMap[task.color] || "bg-[#171c28] text-blue-200 border border-[#232945] shadow-blue-800/20"}
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
