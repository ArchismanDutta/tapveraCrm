import React from "react";

const EmployeeSelector = ({ employees, selected, onSelect }) => {
  return (
    <select
      className="w-full p-2 rounded border bg-gray-800 text-white"
      value={selected?._id || ""}
      onChange={(e) => {
        const emp = employees.find(emp => emp._id === e.target.value);
        onSelect(emp || null);
      }}
    >
      <option value="" disabled>
        Select Employee
      </option>
      {employees.map((emp) => (
        <option key={emp._id} value={emp._id}>
          {emp.name} ({emp.department || "N/A"})
        </option>
      ))}
    </select>
  );
};

export default EmployeeSelector;
