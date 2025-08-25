// EmployeeSelector.jsx
import React from "react";

const EmployeeSelector = ({ employees = [], selectedId = "", onSelect }) => {
  const handleChange = (e) => {
    const selectedEmployee = employees.find((emp) => emp._id === e.target.value);
    onSelect?.(selectedEmployee);
  };

  return (
    <div className="mb-8">
      <label htmlFor="employee-select" className="block mb-3 text-xl font-semibold text-indigo-700 tracking-wide">
        Select Employee:
      </label>
      <select
        id="employee-select"
        className="border-2 border-indigo-300 rounded-3xl p-4 w-full text-indigo-800 text-lg font-medium shadow-md focus:outline-none focus:ring-4 focus:ring-indigo-400 focus:border-indigo-500 transition duration-300"
        value={selectedId}
        onChange={handleChange}
      >
        <option value="" disabled className="text-gray-400 font-normal">-- Select an Employee --</option>
        {employees.map((emp) => (
          <option key={emp._id} value={emp._id} className="font-medium">
            {emp.name}
          </option>
        ))}
      </select>
    </div>
  );
};

export default EmployeeSelector;
