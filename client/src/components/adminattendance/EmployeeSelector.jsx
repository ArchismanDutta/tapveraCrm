// File: components/dashboard/EmployeeSelector.jsx
import React from "react";

const EmployeeSelector = ({
  employees = [],
  selected = null,
  onSelect = () => {},
}) => {
  // Handle selection change
  const handleChange = (e) => {
    const selectedEmployee = employees.find((emp) => emp._id === e.target.value);
    onSelect(selectedEmployee || null);
  };

  return (
    <div className="flex flex-col w-full">
      <label
        htmlFor="employee-select"
        className="text-gray-300 text-sm mb-1 font-medium"
      >
        Select Employee
      </label>
      <select
        id="employee-select"
        className="w-full p-2 rounded-lg border border-gray-600 bg-gray-800 text-white focus:outline-none focus:ring-2 focus:ring-pink-500 transition-all disabled:opacity-50 disabled:cursor-not-allowed"
        value={selected?._id || ""}
        onChange={handleChange}
        disabled={employees.length === 0}
      >
        {employees.length === 0 ? (
          <option value="">No employees available</option>
        ) : (
          <>
            <option value="" disabled>
              -- Select Employee --
            </option>
            {employees.map((emp) => (
              <option key={emp._id} value={emp._id}>
                {emp.name} ({emp.department || "N/A"})
              </option>
            ))}
          </>
        )}
      </select>
    </div>
  );
};

export default EmployeeSelector;
