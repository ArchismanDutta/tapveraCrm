import React, { useEffect, useState } from "react";
import axios from "axios";
import EmployeeRow from "../components/superadmin/EmployeeRow";
import Sidebar from "../components/dashboard/Sidebar";

const API_BASE = import.meta.env.VITE_API_BASE || "http://localhost:5000";

const SuperAdminDashboard = ({ onLogout }) => {
  const [employees, setEmployees] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [selectedDate, setSelectedDate] = useState(
    new Date().toISOString().split("T")[0]
  );
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);

  const token = localStorage.getItem("token");
  const axiosConfig = {
    headers: { Authorization: `Bearer ${token}` },
  };

  const fetchEmployees = async (date) => {
    try {
      setLoading(true);
      setError(null);
      console.log("Fetching employees for date:", date);

      const res = await axios.get(
        `${API_BASE}/api/super-admin/employees-today`,
        {
          ...axiosConfig,
          params: { date },
        }
      );

      console.log("Employees data received:", res.data);
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
      console.error("Error fetching employees:", err);
      setError("Failed to fetch employees. Please try again.");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchEmployees(selectedDate);
  }, [selectedDate]);

  // Auto-refresh every 30 seconds for today's data
  useEffect(() => {
    const isToday = selectedDate === new Date().toISOString().split("T")[0];
    if (!isToday) return;

    const interval = setInterval(() => {
      console.log("Auto-refreshing employee data...");
      fetchEmployees(selectedDate);
    }, 30000); // Refresh every 30 seconds

    return () => clearInterval(interval);
  }, [selectedDate]);

  // Manual refresh function
  const handleRefresh = () => {
    console.log("Manual refresh triggered");
    fetchEmployees(selectedDate);
  };

  return (
    <div className="min-h-screen bg-[#101525] text-gray-100 flex">
      {/* Sidebar */}
      <Sidebar
        collapsed={sidebarCollapsed}
        setCollapsed={setSidebarCollapsed}
        onLogout={onLogout}
        userRole="superadmin"
      />

      {/* Main Content */}
      <main
        className={`flex-1 max-w-7xl mx-auto p-6 transition-all duration-300 ease-in-out overflow-auto ${
          sidebarCollapsed ? "ml-16" : "ml-56"
        }`}
      >
        {/* Header Section */}
        <div className="mb-8">
          <h1 className="text-3xl font-bold text-white mb-2">
            Employee Attendance
          </h1>
          <p className="text-gray-400">
            Manage employee shifts and schedules efficiently
          </p>
        </div>

        {/* Main Card */}
        <div className="bg-[#17203b] rounded-lg shadow-md mb-6 border border-gray-700 p-6">
          <div className="flex justify-between items-center mb-6">
            <h2 className="text-xl font-semibold text-white">
              📊 Attendance Overview
            </h2>
            <div className="flex items-center space-x-3">
              <button
                onClick={handleRefresh}
                disabled={loading}
                className="px-4 py-2 bg-blue-600 hover:bg-blue-700 disabled:bg-blue-400 text-white rounded-md text-sm font-medium transition-colors duration-200 flex items-center space-x-2"
                title="Refresh data"
              >
                <span>🔄</span>
                <span>{loading ? "Refreshing..." : "Refresh"}</span>
              </button>
              <label
                className="text-gray-400 text-sm font-medium"
                htmlFor="date"
              >
                Select Date:
              </label>
              <input
                id="date"
                type="date"
                value={selectedDate}
                onChange={(e) => setSelectedDate(e.target.value)}
                className="rounded-md bg-gray-800 text-white px-4 py-2 border border-gray-600 focus:outline-none focus:ring-2 focus:ring-blue-500 transition-all duration-300 text-sm"
                max={new Date().toISOString().split("T")[0]}
                title="Select date to view attendance"
              />
            </div>
          </div>

          {loading && (
            <div className="flex justify-center py-12">
              <div className="relative">
                <div className="w-12 h-12 border-4 border-blue-300/40 rounded-full"></div>
                <div className="absolute top-0 left-0 w-12 h-12 border-4 border-blue-600 border-t-transparent rounded-full animate-spin"></div>
              </div>
            </div>
          )}

          {error && (
            <div className="bg-red-700/20 border border-red-600 text-red-300 p-4 rounded-md mb-6">
              <div className="flex items-center space-x-2">
                <span>⚠️</span>
                <span>{error}</span>
              </div>
            </div>
          )}

          {!loading && !error && (
            <>
              {employees.length === 0 ? (
                <div className="text-center py-12 text-gray-400">
                  <div className="text-6xl mb-4">📅</div>
                  <p className="text-lg">No employees found for this date.</p>
                </div>
              ) : (
                <div className="overflow-hidden rounded-lg border border-gray-700 bg-[#0f1320] shadow-lg">
                  <div className="overflow-x-auto">
                    <table className="w-full table-auto min-w-[720px] text-gray-100">
                      <thead>
                        <tr className="bg-gray-900/70 border-b border-gray-700">
                          {[
                            { key: "Emp ID", icon: "🆔" },
                            { key: "Name", icon: "👤" },
                            { key: "Punch In", icon: "⏰" },
                            { key: "Punch Out", icon: "🚪" },
                            { key: "On Break?", icon: "☕" },
                            { key: "Break Type", icon: "📝" },
                            { key: "Break (m)", icon: "⏱️" },
                            { key: "Work (h:m)", icon: "💼" },
                            { key: "Working?", icon: "🔄" },
                          ].map(({ key, icon }) => (
                            <th
                              key={key}
                              className="py-3 px-4 text-left text-xs font-semibold tracking-wide"
                            >
                              <div className="flex items-center space-x-2">
                                <span>{icon}</span>
                                <span>{key}</span>
                              </div>
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
                </div>
              )}
            </>
          )}
        </div>

        {/* Stats Cards */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mt-6">
          <StatCard
            icon="👥"
            label="Total Employees"
            value={employees.length}
            bg="bg-blue-700/30"
            textColor="text-blue-400"
          />
          <StatCard
            icon="✅"
            label="Currently Working"
            value={employees.filter((emp) => emp.currentlyWorking).length}
            bg="bg-green-700/30"
            textColor="text-green-400"
          />
          <StatCard
            icon="☕"
            label="On Break"
            value={employees.filter((emp) => emp.onBreak).length}
            bg="bg-yellow-700/30"
            textColor="text-yellow-400"
          />
          <StatCard
            icon="📊"
            label="Attendance Rate"
            value={
              employees.length > 0
                ? `${Math.round(
                    (employees.filter((emp) => emp.arrivalTime).length /
                      employees.length) *
                      100
                  )}%`
                : "0%"
            }
            bg="bg-purple-700/30"
            textColor="text-purple-400"
          />
        </div>
      </main>
    </div>
  );
};

const StatCard = ({ icon, label, value, bg, textColor }) => (
  <div
    className={`bg-[#17203b] rounded-lg p-5 border border-gray-700 shadow-md flex items-center space-x-4 ${bg}`}
  >
    <div
      className={`w-12 h-12 rounded-full flex items-center justify-center text-2xl ${textColor}`}
    >
      {icon}
    </div>
    <div>
      <p className="text-gray-400 text-sm">{label}</p>
      <p className={`text-white font-bold text-2xl`}>{value}</p>
    </div>
  </div>
);

export default SuperAdminDashboard;
