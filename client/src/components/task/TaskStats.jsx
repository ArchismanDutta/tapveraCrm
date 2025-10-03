import React from "react";
import { FaTasks, FaClock, FaCheckCircle, FaExclamationTriangle, FaChartLine } from "react-icons/fa";

const TaskStats = ({ tasks = [] }) => {
  const totalTasks = tasks.length;
  const completedTasks = tasks.filter(task => task.status === 'completed').length;
  const inProgressTasks = tasks.filter(task => task.status === 'in-progress').length;
  const pendingTasks = tasks.filter(task => task.status === 'pending').length;

  // Calculate overdue tasks (due date passed and not completed)
  const now = new Date();
  const overdueTasks = tasks.filter(task =>
    task.dueDate &&
    new Date(task.dueDate) < now &&
    task.status !== 'completed'
  ).length;

  // Calculate completion rate
  const completionRate = totalTasks > 0 ? Math.round((completedTasks / totalTasks) * 100) : 0;

  const statsCards = [
    {
      icon: FaTasks,
      label: "Total Tasks",
      value: totalTasks,
      color: "text-blue-400",
      bgColor: "bg-blue-500/10 border-blue-500/20"
    },
    {
      icon: FaCheckCircle,
      label: "Completed",
      value: completedTasks,
      color: "text-green-400",
      bgColor: "bg-green-500/10 border-green-500/20"
    },
    {
      icon: FaClock,
      label: "In Progress",
      value: inProgressTasks,
      color: "text-yellow-400",
      bgColor: "bg-yellow-500/10 border-yellow-500/20"
    },
    {
      icon: FaExclamationTriangle,
      label: "Overdue",
      value: overdueTasks,
      color: "text-red-400",
      bgColor: "bg-red-500/10 border-red-500/20"
    }
  ];

  return (
    <div className="space-y-4">
      {/* Main Stats Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        {statsCards.map((stat, index) => (
          <div key={index} className={`bg-[#181d2a] rounded-lg shadow-lg p-4 border ${stat.bgColor} hover:scale-105 transition-all duration-200`}>
            <div className="flex items-center justify-between">
              <div>
                <p className={`text-2xl font-bold ${stat.color}`}>{stat.value}</p>
                <p className="text-blue-400 text-sm">{stat.label}</p>
              </div>
              <stat.icon className={`text-2xl ${stat.color} opacity-70`} />
            </div>
          </div>
        ))}
      </div>

      {/* Progress Bar */}
      <div className="bg-[#181d2a] rounded-lg shadow-lg p-4 border border-blue-950">
        <div className="flex items-center justify-between mb-2">
          <div className="flex items-center gap-2">
            <FaChartLine className="text-[#ff8000]" />
            <span className="text-blue-100 font-semibold">Overall Progress</span>
          </div>
          <span className="text-2xl font-bold text-[#ff8000]">{completionRate}%</span>
        </div>

        <div className="w-full bg-gray-700 rounded-full h-3 overflow-hidden">
          <div
            className="bg-gradient-to-r from-[#ff8000] to-[#ffb366] h-full rounded-full transition-all duration-500 ease-out"
            style={{ width: `${completionRate}%` }}
          ></div>
        </div>

        <div className="flex justify-between text-xs text-blue-400 mt-2">
          <span>{completedTasks} of {totalTasks} tasks completed</span>
          {overdueTasks > 0 && (
            <span className="text-red-400 font-medium">
              {overdueTasks} overdue
            </span>
          )}
        </div>
      </div>
    </div>
  );
};

export default TaskStats;
