import React, { useEffect, useState } from "react";
import { useNavigate, useLocation } from "react-router-dom";
import Sidebar from "../components/dashboard/Sidebar";
import EmployeeFilters from "../components/employeedetails/EmployeeFilters";
import EmployeeTable from "../components/employeedetails/EmployeeTable";

const API_BASE =
  import.meta.env.VITE_API_BASE ||
  `${window.location.origin.replace(/\/$/, "")}/api` ||
  "http://localhost:5000/api";

const EmployeeDirectory = () => {
  const navigate = useNavigate();
  const location = useLocation();
  const [collapsed, setCollapsed] = useState(false);
  const [employees, setEmployees] = useState([]);
  const [loading, setLoading] = useState(true);
  const [filters, setFilters] = useState({
    search: "",
    department: "all",
    status: "all",
  });
  const [selectedEmployee, setSelectedEmployee] = useState(null);

  const buildQueryParams = () => {
    const params = new URLSearchParams();
    if (filters.search.trim() !== "") params.append("search", filters.search.trim());
    if (filters.department !== "all") params.append("department", filters.department);
    if (filters.status !== "all") params.append("status", filters.status.toLowerCase());
    return params.toString();
  };

  const fetchEmployees = async () => {
    setLoading(true);
    try {
      const token = localStorage.getItem("token");
      if (!token) {
        navigate("/login");
        return;
      }

      const query = buildQueryParams();
      const url = `${API_BASE}/users/directory${query ? `?${query}` : ""}`;

      const res = await fetch(url, {
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
      });

      if (!res.ok) {
        const problem = await res.json().catch(() => ({}));
        throw new Error(problem.message || `Request failed with ${res.status}`);
      }

      const data = await res.json();
      setEmployees(
        Array.isArray(data)
          ? data.map((emp) => ({ ...emp, status: emp.status || "inactive" }))
          : []
      );
    } catch (err) {
      console.error("Error fetching employees:", err);
      setEmployees([]);
    } finally {
      setLoading(false);
    }
  };

  // Fetch employees on mount or filter change
  useEffect(() => {
    fetchEmployees();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [filters]);

  // Refresh if coming from signup page
  useEffect(() => {
    if (location.state?.refresh) {
      fetchEmployees();
      window.history.replaceState({}, document.title); // Clear the flag
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [location.state]);

  return (
    <div className="flex">
      <Sidebar collapsed={collapsed} setCollapsed={setCollapsed} userRole="admin" />

      <main className={`flex-1 p-6 transition-all duration-300 ${collapsed ? "ml-20" : "ml-64"}`}>
        <h1 className="text-2xl font-semibold mb-4">Employee Directory</h1>

        <EmployeeFilters filters={filters} setFilters={setFilters} />

        {loading ? (
          <div className="text-center py-8">Loading employees...</div>
        ) : (
          <EmployeeTable
            employees={employees}
            onView={(emp) => setSelectedEmployee(emp)}
            onEdit={() => {}}
          />
        )}

        {selectedEmployee && (
          <div className="fixed inset-0 flex items-center justify-center bg-black bg-opacity-50 z-50">
            <div className="bg-white p-6 rounded-lg shadow-xl w-96">
              <h2 className="text-lg font-bold mb-3">Employee Details</h2>
              <p><b>Name:</b> {selectedEmployee.name}</p>
              <p><b>Email:</b> {selectedEmployee.email}</p>
              <p><b>Department:</b> {selectedEmployee.department}</p>
              <p><b>Designation:</b> {selectedEmployee.designation}</p>
              <p><b>Status:</b> {selectedEmployee.status}</p>
              <div className="mt-4 text-right">
                <button
                  className="px-4 py-2 bg-yellow-400 rounded hover:bg-yellow-500"
                  onClick={() => setSelectedEmployee(null)}
                >
                  Close
                </button>
              </div>
            </div>
          </div>
        )}
      </main>
    </div>
  );
};

export default EmployeeDirectory;
