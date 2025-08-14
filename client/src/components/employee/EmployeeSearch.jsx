// src/components/employee/EmployeeSearch.jsx
import React from "react";
import { Search } from "lucide-react";

const EmployeeSearch = ({ query, onSearch }) => {
  return (
    <div className="relative w-full md:w-72">
      <Search className="absolute left-3 top-3 text-gray-400" size={18} />
      <input
        type="text"
        placeholder="Search employees..."
        value={query}
        onChange={(e) => onSearch(e.target.value)}
        className="pl-10 pr-3 py-2 w-full border rounded-lg focus:ring focus:ring-blue-200"
      />
    </div>
  );
};

export default EmployeeSearch;
