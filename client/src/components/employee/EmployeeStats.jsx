// src/components/employee/EmployeeStats.jsx
import React from "react";
import { Users, UserCheck, UserMinus, UserPlus } from "lucide-react";

const StatCard = ({ icon: Icon, label, value, color, onClick }) => (
  <div
    onClick={onClick}
    className="flex items-center gap-4 p-4 bg-white rounded-xl shadow hover:shadow-md transition cursor-pointer"
  >
    <div className={`p-3 rounded-lg ${color} bg-opacity-20`}>
      <Icon className={`w-6 h-6 ${color.replace("bg-", "text-")}`} />
    </div>
    <div>
      <p className="text-gray-500 text-sm">{label}</p>
      <p className="text-lg font-semibold">{value}</p>
    </div>
  </div>
);

const EmployeeStats = ({ stats, onFilterByStatus }) => {
  return (
    <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
      <StatCard
        icon={Users}
        label="Total Employees"
        value={stats.total}
        color="bg-blue-500"
        onClick={() => onFilterByStatus("")}
      />
      <StatCard
        icon={UserCheck}
        label="Active Employees"
        value={stats.active}
        color="bg-green-500"
        onClick={() => onFilterByStatus("Active")}
      />
      <StatCard
        icon={UserMinus}
        label="On Leave Today"
        value={stats.onLeave}
        color="bg-yellow-500"
        onClick={() => onFilterByStatus("On Leave")}
      />
      <StatCard
        icon={UserPlus}
        label="New Hires This Month"
        value={stats.newHires}
        color="bg-purple-500"
      />
    </div>
  );
};

export default EmployeeStats;
