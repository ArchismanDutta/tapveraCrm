// src/components/employee/EmployeeFilters.jsx
import React from "react";

const EmployeeFilters = ({ filters, setFilters }) => {
  const updateFilter = (name, value) => {
    setFilters((prev) => ({ ...prev, [name]: value }));
  };

  return (
    <div className="flex gap-2">
      <select
        value={filters.department}
        onChange={(e) => updateFilter("department", e.target.value)}
        className="border rounded-lg px-3 py-2"
      >
        <option value="">Department</option>
        <option value="Engineering">Engineering</option>
        <option value="Marketing">Marketing</option>
        <option value="Design">Design</option>
        <option value="Sales">Sales</option>
        <option value="HR">HR</option>
      </select>

      <select
        value={filters.designation}
        onChange={(e) => updateFilter("designation", e.target.value)}
        className="border rounded-lg px-3 py-2"
      >
        <option value="">Designation</option>
        <option value="Senior Developer">Senior Developer</option>
        <option value="Marketing Manager">Marketing Manager</option>
        <option value="UI/UX Designer">UI/UX Designer</option>
        <option value="Sales Executive">Sales Executive</option>
        <option value="HR Manager">HR Manager</option>
      </select>

      <select
        value={filters.status}
        onChange={(e) => updateFilter("status", e.target.value)}
        className="border rounded-lg px-3 py-2"
      >
        <option value="">Status</option>
        <option value="Active">Active</option>
        <option value="On Leave">On Leave</option>
        <option value="Inactive">Inactive</option>
      </select>
    </div>
  );
};

export default EmployeeFilters;
