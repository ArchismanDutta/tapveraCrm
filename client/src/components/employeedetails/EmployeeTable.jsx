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

  if (!currentUser) return null;

  const sortedEmployees = [...employees].sort((a, b) => {
    if (a._id === String(currentUser._id)) return -1;
    if (b._id === String(currentUser._id)) return 1;
    return 0;
  });

  return (
    <div className="overflow-x-auto border border-[#1c2235] rounded-xl shadow bg-[#13182b]">
      <table className="min-w-full border-collapse text-sm">
        <thead>
          <tr className="bg-gradient-to-r from-orange-900 via-orange-800 to-orange-700 border-b border-orange-700">
            <th className="px-4 py-3 font-bold text-left text-orange-200">
              Employee
            </th>
            <th className="px-3 py-3 font-bold text-left text-orange-200">
              Employee ID
            </th>
            <th className="px-3 py-3 font-bold text-left text-orange-200">
              Email
            </th>
            <th className="px-3 py-3 font-bold text-left text-orange-200">
              Department
            </th>
            <th className="px-3 py-3 font-bold text-left text-orange-200">
              Designation
            </th>
            <th className="px-3 py-3 font-bold text-center text-orange-200">
              Actions
            </th>
          </tr>
        </thead>
        <tbody>
          {sortedEmployees.length === 0 ? (
            <tr>
              <td colSpan="6" className="px-6 py-8 text-center text-gray-500">
                No employees found.
              </td>
            </tr>
          ) : (
            sortedEmployees.map((emp) => {
              const isCurrentUser = emp._id === String(currentUser._id);
              const rowBg = isCurrentUser
                ? "bg-gradient-to-r from-blue-200 to-blue-100 text-gray-800 font-bold"
                : emp.status === "active"
                ? "bg-[#172933] hover:bg-[#174144]"
                : "bg-[#151d2b] hover:bg-[#101425]";

              return (
                <tr
                  key={emp._id}
                  className={`transition-colors duration-100 border-b border-[#19213a] ${rowBg}`}
                >
                  <td className="px-4 py-3">{emp.name}</td>
                  <td className="px-3 py-3">{emp.employeeId}</td>
                  <td className="px-3 py-3">{emp.email}</td>
                  <td className="px-3 py-3">{emp.department}</td>
                  <td className="px-3 py-3">{emp.designation}</td>
                  <td className="px-3 py-3 text-center">
                    <button
                      className="inline-flex gap-1 items-center px-2 py-1 rounded text-blue-400 hover:bg-blue-900 hover:text-blue-200 transition"
                      onClick={() => handleView(emp)}
                      title="View"
                    >
                      <FaEye size={15} />{" "}
                      <span className="hidden md:inline">View</span>
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
