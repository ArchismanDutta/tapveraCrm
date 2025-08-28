import React from "react";
import { FaEye } from "react-icons/fa";
import { useNavigate } from "react-router-dom";

const EmployeeTable = ({ employees = [], currentUser }) => {
  const navigate = useNavigate();

  const handleView = (emp) => {
    if (emp && emp._id) {
      navigate(`/employee/${emp._id}`);
    }
  };

  if (!currentUser) return null; // Wait until currentUser is loaded

  // Sort so current user comes first
  const sortedEmployees = [...employees].sort((a, b) => {
    if (a._id === String(currentUser._id)) return -1;
    if (b._id === String(currentUser._id)) return 1;
    return 0;
  });

  return (
    <div className="overflow-x-auto border rounded-xl shadow-md bg-gray-800">
      <table className="min-w-full border-collapse">
        <thead className="bg-orange-800 border-b-2 border-orange-600">
          <tr>
            <th className="px-6 py-3 text-left text-sm font-semibold text-gray-200 uppercase tracking-wider">
              Employee
            </th>
            <th className="px-6 py-3 text-left text-sm font-semibold text-gray-200 uppercase tracking-wider">
              Employee ID
            </th>
            <th className="px-6 py-3 text-left text-sm font-semibold text-gray-200 uppercase tracking-wider">
              Email
            </th>
            <th className="px-6 py-3 text-left text-sm font-semibold text-gray-200 uppercase tracking-wider">
              Department
            </th>
            <th className="px-6 py-3 text-left text-sm font-semibold text-gray-200 uppercase tracking-wider">
              Designation
            </th>
            <th className="px-6 py-3 text-left text-sm font-semibold text-gray-200 uppercase tracking-wider">
              Status
            </th>
            <th className="px-6 py-3 text-left text-sm font-semibold text-gray-200 uppercase tracking-wider">
              Actions
            </th>
          </tr>
        </thead>
        <tbody>
          {sortedEmployees.length === 0 ? (
            <tr>
              <td
                colSpan="7"
                className="px-6 py-10 text-center text-gray-400 text-sm"
              >
                No employees found.
              </td>
            </tr>
          ) : (
            sortedEmployees.map((emp) => {
              const isCurrentUser = emp._id === String(currentUser._id);

              return (
                <tr
                  key={emp._id}
                  className={`transition-colors duration-200 ${
                    isCurrentUser
                      ? "bg-gradient-to-r from-blue-200 to-blue-400 text-gray-900 font-bold"
                      : "bg-gray-800 hover:bg-gray-700"
                  }`}
                >
                  <td className="px-6 py-4">{emp.name || "-"}</td>
                  <td className="px-6 py-4">{emp.employeeId || "-"}</td>
                  <td className="px-6 py-4">{emp.email || "-"}</td>
                  <td className="px-6 py-4">{emp.department || "-"}</td>
                  <td className="px-6 py-4">{emp.designation || "-"}</td>
                  <td className="px-6 py-4">
                    <span
                      className={`px-3 py-1 text-xs font-semibold rounded-full ${
                        emp.status === "active"
                          ? "bg-green-700 text-green-300"
                          : "bg-red-700 text-red-300"
                      }`}
                    >
                      {emp.status
                        ? emp.status.charAt(0).toUpperCase() +
                          emp.status.slice(1)
                        : "Inactive"}
                    </span>
                  </td>
                  <td className="px-6 py-4">
                    <button
                      className="text-blue-400 hover:text-blue-600 flex items-center gap-1"
                      onClick={() => handleView(emp)}
                      title="View"
                    >
                      <FaEye /> View
                    </button>
                  </td>
                </tr>
              );
            })
          )}
        </tbody>
      </table>
    </div>
  );
};

export default EmployeeTable;
