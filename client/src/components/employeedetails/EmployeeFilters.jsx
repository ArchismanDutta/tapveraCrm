import React from "react";
import { useNavigate } from "react-router-dom";

const EmployeeFilters = ({ filters, setFilters }) => {
  const navigate = useNavigate();

  return (
    <div className="flex flex-wrap gap-4 items-center bg-gray-800 p-4 rounded-xl shadow-md border border-gray-700 mb-6 justify-between text-gray-200">
      <div className="flex flex-wrap gap-4 items-center">
        {/* Search */}
        <input
          type="text"
          placeholder="Search employees..."
          value={filters.search}
          onChange={(e) => setFilters((f) => ({ ...f, search: e.target.value.trimStart() }))}
          className="border border-gray-600 bg-gray-700 px-4 py-2 rounded-lg shadow-sm w-64 focus:outline-none focus:ring-2 focus:ring-orange-400 transition text-gray-200 placeholder-gray-400"
          autoComplete="off"
        />

        {/* Department */}
        <select
          value={filters.department}
          onChange={(e) => setFilters((f) => ({ ...f, department: e.target.value }))}
          className="border border-gray-600 bg-gray-700 px-4 py-2 rounded-lg shadow-sm focus:outline-none focus:ring-2 focus:ring-orange-400 transition text-gray-200"
        >
          <option value="all">All Departments</option>
          <option value="executives">Executives</option>
          <option value="development">Development</option>
          <option value="marketingAndSales">Marketing & Sales</option>
          <option value="humanResource">Human Resource</option>
        </select>

        {/* Status */}
        <select
          value={filters.status}
          onChange={(e) => setFilters((f) => ({ ...f, status: e.target.value }))}
          className="border border-gray-600 bg-gray-700 px-4 py-2 rounded-lg shadow-sm focus:outline-none focus:ring-2 focus:ring-orange-400 transition text-gray-200"
        >
          <option value="all">All Statuses</option>
          <option value="active">Active</option>
          <option value="inactive">Inactive</option>
        </select>
      </div>

      {/* Create Employee Button */}
      <div>
        <button
          onClick={() => navigate("/signup", { state: { fromDirectory: true } })}
          className="bg-blue-400 hover:bg-gray-400 text-white px-4 py-2 rounded shadow transition"
        >
          + Create Employee
        </button>
      </div>
    </div>
  );
};

export default EmployeeFilters;
