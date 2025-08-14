import React from "react";

const EmployeeDetailsModal = ({ employee, onClose }) => {
  if (!employee) return null;

  return (
    <div className="fixed inset-0 bg-black bg-opacity-40 flex items-center justify-center z-50">
      <div className="bg-white rounded-xl shadow-lg w-full max-w-md p-6">
        <h2 className="text-xl font-semibold mb-4">Employee Details</h2>

        <div className="flex flex-col items-center">
          <img
            src={employee.avatar}
            alt={employee.name}
            className="w-20 h-20 rounded-full mb-3"
          />
          <h3 className="text-lg font-medium">{employee.name}</h3>
          <p className="text-gray-500">{employee.designation}</p>
        </div>

        <div className="mt-4 space-y-2">
          <p><strong>ID:</strong> {employee.id}</p>
          <p><strong>Department:</strong> {employee.department}</p>
          <p><strong>Status:</strong> {employee.status}</p>
          <p><strong>Attendance:</strong> {employee.attendance}%</p>
          <p><strong>Salary:</strong> ${employee.salary.toLocaleString()}</p>
        </div>

        <div className="flex justify-end mt-6">
          <button
            onClick={onClose}
            className="px-4 py-2 rounded-lg border hover:bg-gray-100"
          >
            Close
          </button>
        </div>
      </div>
    </div>
  );
};

export default EmployeeDetailsModal;
