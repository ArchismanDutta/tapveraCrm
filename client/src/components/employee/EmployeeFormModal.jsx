import React, { useState, useEffect } from "react";

const initialFormData = {
  id: "",
  name: "",
  department: "",
  designation: "",
  status: "Active",
  attendance: "",
  salary: "",
  avatar: ""
};

const EmployeeFormModal = ({ isEditing, employee, onClose, onSubmit, existingIds }) => {
  const [formData, setFormData] = useState(initialFormData);

  useEffect(() => {
    if (isEditing && employee) {
      setFormData(employee);
    } else {
      // When adding new employee, ensure form is blank
      setFormData(initialFormData);
    }
  }, [isEditing, employee]);

  const handleChange = (e) => {
    const { name, value } = e.target;
    setFormData((prev) => ({ ...prev, [name]: value }));
  };

  const handleSave = (e) => {
    e.preventDefault();

    // Simple validation
    if (!formData.id || !formData.name || !formData.department || !formData.designation) {
      alert("Please fill all required fields.");
      return;
    }

    if (!isEditing && existingIds.includes(formData.id)) {
      alert("Employee ID already exists.");
      return;
    }

    onSubmit({
      ...formData,
      attendance: Number(formData.attendance),
      salary: Number(formData.salary)
    });

    // Reset form only when adding (not editing)
    if (!isEditing) {
      setFormData(initialFormData);
    }
  };

  return (
    <div className="fixed inset-0 bg-black bg-opacity-40 flex items-center justify-center z-50">
      <div className="bg-white rounded-xl shadow-lg w-full max-w-lg p-6">
        <h2 className="text-xl font-semibold mb-4">
          {isEditing ? "Edit Employee" : "Add New Employee"}
        </h2>
        <form className="space-y-4" onSubmit={handleSave}>
          <div className="grid grid-cols-2 gap-4">
            <input
              type="text"
              name="id"
              placeholder="Employee ID"
              value={formData.id}
              onChange={handleChange}
              disabled={isEditing}
              className="border rounded-lg px-3 py-2 w-full"
            />
            <input
              type="text"
              name="name"
              placeholder="Full Name"
              value={formData.name}
              onChange={handleChange}
              className="border rounded-lg px-3 py-2 w-full"
            />
            <select
              name="department"
              value={formData.department}
              onChange={handleChange}
              className="border rounded-lg px-3 py-2 w-full"
            >
              <option value="">Select Department</option>
              <option>Engineering</option>
              <option>Marketing</option>
              <option>Design</option>
              <option>Sales</option>
              <option>HR</option>
            </select>
            <select
              name="designation"
              value={formData.designation}
              onChange={handleChange}
              className="border rounded-lg px-3 py-2 w-full"
            >
              <option value="">Select Designation</option>
              <option>Senior Developer</option>
              <option>Marketing Manager</option>
              <option>UI/UX Designer</option>
              <option>Sales Executive</option>
              <option>HR Manager</option>
            </select>
            <select
              name="status"
              value={formData.status}
              onChange={handleChange}
              className="border rounded-lg px-3 py-2 w-full"
            >
              <option>Active</option>
              <option>On Leave</option>
              <option>Inactive</option>
            </select>
            <input
              type="number"
              name="attendance"
              placeholder="Attendance %"
              value={formData.attendance}
              onChange={handleChange}
              className="border rounded-lg px-3 py-2 w-full"
            />
            <input
              type="number"
              name="salary"
              placeholder="Salary"
              value={formData.salary}
              onChange={handleChange}
              className="border rounded-lg px-3 py-2 w-full"
            />
            <input
              type="url"
              name="avatar"
              placeholder="Avatar Image URL"
              value={formData.avatar}
              onChange={handleChange}
              className="border rounded-lg px-3 py-2 w-full col-span-2"
            />
          </div>

          <div className="flex justify-end gap-3">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 rounded-lg border hover:bg-gray-100"
            >
              Cancel
            </button>
            <button
              type="submit"
              className="px-4 py-2 rounded-lg bg-blue-500 text-white hover:bg-blue-600"
            >
              {isEditing ? "Update" : "Add"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

export default EmployeeFormModal;
