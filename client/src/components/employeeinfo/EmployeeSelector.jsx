import React from "react";

const EmployeeSelector = ({ employees = [], selectedId = "", onSelect }) => {
  const handleChange = (e) => {
    const selectedEmployee = employees.find((emp) => emp._id === e.target.value);
    onSelect?.(selectedEmployee);
  };

  return (
    <div className="mb-8">
      <label
        htmlFor="employee-select"
        className="block mb-3 text-xl font-semibold text-indigo-400 tracking-wide"
      >
        Select Employee:
      </label>
      <select
        id="employee-select"
        className="border-2 border-indigo-600 rounded-3xl p-4 w-full text-indigo-300 bg-[#1e293b] shadow-lg
                   focus:outline-none focus:ring-4 focus:ring-indigo-500 focus:border-indigo-600 transition duration-300"
        value={selectedId}
        onChange={handleChange}
      >
        <option value="" disabled className="text-gray-500 font-normal">
          -- Select an Employee --
        </option>
        {employees.map((emp) => (
          <option
            key={emp._id}
            value={emp._id}
            className="font-medium bg-[#1e293b] text-indigo-300"
          >
            {emp.name}
          </option>
        ))}
      </select>
    </div>
  );
};

export default EmployeeSelector;
