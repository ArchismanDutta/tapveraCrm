// SuperAdminDashboard.jsx (Updated for no horizontal scroll and compact spacing)

import React, { useEffect, useState } from "react";
import axios from "axios";
import EmployeeRow from "../components/superadmin/EmployeeRow";
import Sidebar from "../components/dashboard/Sidebar";

const API_BASE = import.meta.env.VITE_API_BASE || "http://localhost:5000";

const SuperAdminDashboard = () => {
  const [employees, setEmployees] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [selectedDate, setSelectedDate] = useState(
    new Date().toISOString().split("T")[0]
  );
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);

  const fetchEmployees = async (date) => {
    try {
      setLoading(true);
      setError(null);
      const res = await axios.get(`${API_BASE}/api/super-admin/employees-today`, {
        params: { date },
      });

      let empData = res.data || [];
      empData.sort((a, b) => {
        if (a.currentlyWorking && !b.currentlyWorking) return -1;
        if (!a.currentlyWorking && b.currentlyWorking) return 1;
        if (a.onBreak && !b.onBreak) return -1;
        if (!a.onBreak && b.onBreak) return 1;
        return 0;
      });

      setEmployees(empData);
    } catch (err) {
      console.error(err);
      setError("Failed to fetch employees. Please try again.");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchEmployees(selectedDate);
  }, [selectedDate]);

  const handleLogout = () => {
    console.log("Logout clicked");
  };

  return (
    <div className="flex h-screen bg-[#181C2F]">
      {/* Sidebar */}
      <Sidebar
        collapsed={sidebarCollapsed}
        setCollapsed={setSidebarCollapsed}
        onLogout={handleLogout}
        userRole="superadmin"
        className="border-r border-[#2e3151] shadow-md"
      />

      {/* Main Content */}
      <main
        className={`flex-1 transition-all duration-300 ease-in-out p-4 overflow-auto ${
          sidebarCollapsed ? "ml-16" : "ml-56"
        }`}
      >
        <div className="bg-[#232848] rounded-2xl shadow-lg p-4 border border-slate-700/40 max-w-full">
          <div className="flex justify-between items-center mb-4">
            <h1 className="text-base font-semibold tracking-wide uppercase text-white select-none">
              Employees Attendance
            </h1>
            <input
              type="date"
              value={selectedDate}
              onChange={(e) => setSelectedDate(e.target.value)}
              className="rounded-full bg-[#202446] font-semibold text-slate-200 px-3 py-1 border-none shadow focus:outline-none focus:ring-2 focus:ring-blue-400 focus:shadow-lg transition duration-300 text-sm"
              title="Select date to view attendance"
              max={new Date().toISOString().split("T")[0]}
            />
          </div>

          {loading && (
            <div className="flex justify-center py-8">
              <div className="loader ease-linear rounded-full border-4 border-t-4 border-gray-700 h-6 w-6 animate-spin"></div>
            </div>
          )}

          {error && (
            <div className="text-red-400 mb-4 font-semibold text-center text-sm">
              {error}
            </div>
          )}

          {!loading && !error && (
            <>
              {employees.length === 0 ? (
                <p className="text-gray-400 italic text-center py-8 select-none text-sm">
                  No employees found for this date.
                </p>
              ) : (
                <div>
                  <table className="w-full table-auto bg-[#232848] text-white rounded-lg border border-[#3C3F6B]">
                    <thead>
                      <tr className="bg-[#21253a] shadow-[inset_0_-2px_0_0_#abe1ff]">
                        {[
                          "Emp ID",
                          "Name",
                          "Punch In",
                          "Punch Out",
                          "On Break?",
                          "Break Type",
                          "Break (m)",
                          "Work (h:m)",
                          "Working?",
                        ].map((header) => (
                          <th
                            key={header}
                            className="py-2 px-2 font-semibold text-xs uppercase tracking-wide select-none text-slate-300 text-left whitespace-normal"
                          >
                            {header}
                          </th>
                        ))}
                      </tr>
                    </thead>
                    <tbody>
                      {employees.map((emp, idx) => (
                        <EmployeeRow key={emp.userId || idx} employee={emp} />
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </>
          )}
        </div>
      </main>

      {/* Spinner CSS */}
      <style>{`
        .loader {
          border-top-color: #abe1ff;
        }
      `}</style>
    </div>
  );
};

export default SuperAdminDashboard;
