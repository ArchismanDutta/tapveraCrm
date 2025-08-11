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
        <div
          key={idx}
          className="flex flex-col sm:flex-row sm:justify-between sm:items-center py-3 border-b border-gray-300 last:border-none hover:scale-[1.01] transition"
        >
          {/* Left Section: Title + Meta */}
          <div className="flex items-start space-x-3">
            <span
              className={`h-3 w-3 rounded-full bg-${task.color}-500`}
            ></span>
            <div>
              <p className="font-medium">{task.label}</p>
              <p className="text-xs text-gray-500">
                Due:{" "}
                <span className="font-semibold text-gray-800">
                  {task.dueDateTime}
                </span>
              </p>
              <p className="text-xs text-gray-500">
                Assigned By:{" "}
                <span className="font-semibold text-blue-600">
                  {task.assignedBy}
                </span>{" "}
                | Assigned To:{" "}
                <span className="font-semibold text-green-600">
                  {task.assignedTo}
                </span>
              </p>
            </div>
          </div>

          {/* Right Section: Priority */}
          <span
            className={`mt-2 sm:mt-0 text-xs px-2 py-1 rounded-full ${
              colorMap[task.color]
            }`}
          >
            {task.level}
          </span>
        </div>
      ))}
    </div>
  );
};

export default TodayTasks;
