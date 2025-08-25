import React from "react";
import { FaEye } from "react-icons/fa";

const EmployeeTable = ({ employees, onView }) => {
  return (
    <div className="overflow-x-auto border rounded-xl shadow-md">
      <table className="min-w-full bg-white border-collapse">
        <thead className="bg-orange-100 border-b-2 border-orange-300">
          <tr>
            <th className="px-6 py-3 text-left text-sm font-semibold text-gray-700 uppercase tracking-wider">
              Employee
            </th>
            <th className="px-6 py-3 text-left text-sm font-semibold text-gray-700 uppercase tracking-wider">
              Employee ID
            </th>
            <th className="px-6 py-3 text-left text-sm font-semibold text-gray-700 uppercase tracking-wider">
              Email
            </th>
            <th className="px-6 py-3 text-left text-sm font-semibold text-gray-700 uppercase tracking-wider">
              Department
            </th>
            <th className="px-6 py-3 text-left text-sm font-semibold text-gray-700 uppercase tracking-wider">
              Designation
            </th>
            <th className="px-6 py-3 text-left text-sm font-semibold text-gray-700 uppercase tracking-wider">
              Status
            </th>
            <th className="px-6 py-3 text-left text-sm font-semibold text-gray-700 uppercase tracking-wider">
              Actions
            </th>
          </tr>
        </thead>
        <tbody className="divide-y divide-gray-100">
          {employees.length === 0 ? (
            <tr>
              <td
                colSpan="7"
                className="px-6 py-10 text-center text-gray-500 text-sm"
              >
                No employees found.
              </td>
            </tr>
          ) : (
            employees.map((emp, index) => (
              <tr
                key={emp._id}
                className={`hover:bg-orange-50 ${
                  index % 2 === 0 ? "bg-gray-50" : "bg-white"
                } transition-colors duration-200`}
              >
                <td className="px-6 py-4 text-gray-800 font-medium">{emp.name}</td>
                <td className="px-6 py-4 text-gray-700">{emp.employeeId}</td>
                <td className="px-6 py-4 text-gray-700">{emp.email}</td>
                <td className="px-6 py-4 text-gray-700">{emp.department}</td>
                <td className="px-6 py-4 text-gray-700">{emp.designation}</td>
                <td className="px-6 py-4">
                  <span
                    className={`px-3 py-1 text-xs font-semibold rounded-full ${
                      emp.status === "active"
                        ? "bg-green-100 text-green-800"
                        : "bg-red-100 text-red-800"
                    }`}
                  >
                    {emp.status.charAt(0).toUpperCase() + emp.status.slice(1)}
                  </span>
                </td>
                <td className="px-6 py-4">
                  <button
                    className="text-blue-600 hover:text-blue-800 flex items-center gap-1"
                    onClick={() => onView(emp)}
                    title="View"
                  >
                    <FaEye /> View
                  </button>
                </td>
              </tr>
            ))
          )}
        </tbody>
      </table>
    </div>
  );
};

export default EmployeeTable;
