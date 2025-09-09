import React from "react";
import { useNavigate } from "react-router-dom";

const EmployeeFilters = ({ filters, setFilters }) => {
  const navigate = useNavigate();

  return (
    <div className="flex flex-wrap gap-3 items-center bg-[#171d2f] p-3 rounded-lg shadow border border-[#1c2235] mb-4">
      <input
        type="text"
        placeholder="Search employees..."
        value={filters.search}
        onChange={(e) => setFilters((f) => ({ ...f, search: e.target.value }))}
        className="border border-[#232e47] bg-[#101425] text-gray-200 px-3 py-2 rounded focus:ring-1 focus:ring-orange-400 text-sm w-56 placeholder-gray-500"
        autoComplete="off"
      />

      <select
        value={filters.department}
        onChange={(e) => setFilters((f) => ({ ...f, department: e.target.value }))}
        className="border border-[#232e47] bg-[#101425] text-gray-200 px-3 py-2 rounded focus:ring-1 focus:ring-orange-400 text-sm"
      >
        <option value="all">All Departments</option>
        <option value="executives">Executives</option>
        <option value="development">Development</option>
        <option value="marketingAndSales">Marketing & Sales</option>
        <option value="humanResource">Human Resource</option>
      </select>

      <button
        onClick={() => navigate("/signup", { state: { fromDirectory: true } })}
        className="bg-gradient-to-tr from-blue-600 to-orange-400 hover:bg-gradient-to-tr hover:from-orange-500 hover:to-blue-400 px-4 py-2 rounded shadow text-white text-sm font-bold ml-auto transition"
      >
        + Create Employee
      </button>
    </div>
  );
};

export default EmployeeFilters;
