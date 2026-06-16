// src/components/employee/EmployeeTable.jsx
import React from "react";
import { Edit, Trash2, Eye } from "lucide-react";

const statusColors = {
  Active: "bg-green-100 text-green-700",
  "On Leave": "bg-yellow-100 text-yellow-700",
  Inactive: "bg-red-100 text-red-700",
};

const EmployeeTable = ({ employees, onEdit, onDelete, onViewDetails, regions, onRegionChange }) => {
  return (
    <div className="bg-white rounded-xl shadow overflow-x-auto">
      <table className="w-full text-left">
        <thead>
          <tr className="bg-gray-50 border-b">
            <th className="p-3">Employee</th>
            <th className="p-3">Employee ID</th>
            <th className="p-3">Department</th>
            <th className="p-3">Designation</th>
            <th className="p-3">Region</th>
            <th className="p-3">Status</th>
            <th className="p-3">Attendance</th>
            <th className="p-3">Salary</th>
            <th className="p-3">Actions</th>
          </tr>
        </thead>
        <tbody>
          {employees.map((emp) => (
            <tr key={emp.id} className="border-b hover:bg-gray-50">
              <td className="p-3 flex items-center gap-3">
                {emp.avatar ? (
                  <img
                    src={emp.avatar}
                    alt={emp.name || 'Employee'}
                    className="w-10 h-10 rounded-full"
                  />
                ) : (
                  <div className="w-10 h-10 rounded-full bg-gradient-to-br from-cyan-500 to-blue-500 flex items-center justify-center text-white font-semibold">
                    {emp.name?.charAt(0)?.toUpperCase() || '?'}
                  </div>
                )}
                {emp.name || 'Unknown'}
              </td>
              <td className="p-3">{emp.id}</td>
              <td className="p-3">{emp.department}</td>
              <td className="p-3">{emp.designation}</td>
              <td className="p-3">
                <select
                  value={emp.region || 'Global'}
                  onChange={(e) => onRegionChange(emp.id, e.target.value)}
                  className="px-2 py-1 rounded border border-gray-300 text-sm focus:outline-none focus:border-blue-500"
                >
                  {Array.isArray(regions) && regions.length > 0 ? regions.map(region => (
                    <option key={region} value={region}>
                      {region === 'Global' ? '🌍 Global' : `📍 ${region}`}
                    </option>
                  )) : (
                    <option value="Global">Global</option>
                  )}
                </select>
              </td>
              <td className="p-3">
                <span
                  className={`px-2 py-1 rounded-full text-sm ${statusColors[emp.status]}`}
                >
                  {emp.status}
                </span>
              </td>
              <td className="p-3">{emp.attendance}%</td>
              <td className="p-3">${emp.salary ? emp.salary.toLocaleString() : 'N/A'}</td>
              <td className="p-3 flex gap-2">
                <button
                  className="text-green-500 hover:text-green-700"
                  onClick={() => onViewDetails(emp)}
                >
                  <Eye size={16} />
                </button>
                <button
                  className="text-blue-500 hover:text-blue-700"
                  onClick={() => onEdit(emp)}
                >
                  <Edit size={16} />
                </button>
                <button
                  className="text-red-500 hover:text-red-700"
                  onClick={() => onDelete(emp.id)}
                >
                  <Trash2 size={16} />
                </button>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
};

export default EmployeeTable;
