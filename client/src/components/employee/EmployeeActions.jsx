// src/components/employee/EmployeeActions.jsx
import React from "react";
import { Download, Plus } from "lucide-react";

const EmployeeActions = ({ onAdd, onExport }) => {
  return (
    <div className="flex gap-2">
      <button
        onClick={onExport}
        className="flex items-center gap-2 border px-3 py-2 rounded-lg hover:bg-gray-100"
      >
        <Download size={16} /> Export Data
      </button>
      <button
        onClick={onAdd}
        className="flex items-center gap-2 bg-blue-500 text-white px-3 py-2 rounded-lg hover:bg-blue-600"
      >
        <Plus size={16} /> Add New Employee
      </button>
    </div>
  );
};

export default EmployeeActions;
