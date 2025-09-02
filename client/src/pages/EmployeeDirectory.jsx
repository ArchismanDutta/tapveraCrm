import React, { useEffect, useState } from "react";
import { useNavigate, useLocation } from "react-router-dom";
import Sidebar from "../components/dashboard/Sidebar";
import EmployeeFilters from "../components/employeedetails/EmployeeFilters";
import EmployeeTable from "../components/employeedetails/EmployeeTable";

const API_BASE =
  import.meta.env.VITE_API_BASE ||
  `${window.location.origin.replace(/\/$/, "")}/api` ||
  "http://localhost:5000/api";

const EmployeeDirectory = ({onLogout}) => {
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
  const [currentUser, setCurrentUser] = useState(null);

  const sidebarWidth = collapsed ? 80 : 288; // px (matches your Sidebar w-20/w-72)

  // Build query string from filters
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
      const userData = localStorage.getItem("user"); // Logged-in user info
      if (!token || !userData) {
        navigate("/login", { replace: true });
        return;
      }

      const user = JSON.parse(userData);
      setCurrentUser(user);

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

      let mappedEmployees = Array.isArray(data)
        ? data.map((emp) => ({
            _id: String(emp._id),
            name: emp.fullName || emp.name || emp.email || `Employee ${emp._id}`,
            department: emp.department || "N/A",
            status: emp.status || "inactive",
            designation: emp.designation || "N/A",
            email: emp.email || "N/A",
            employeeId: emp.employeeId || "-",
          }))
        : [];

      // Ensure current user is included at the top
      if (!mappedEmployees.find((e) => e._id === String(user._id))) {
        mappedEmployees = [
          {
            _id: String(user._id),
            name: user.fullName || user.name || user.email || "You",
            department: user.department || "N/A",
            status: user.status || "active",
            designation: user.designation || "N/A",
            email: user.email || "N/A",
            employeeId: user.employeeId || "-",
          },
          ...mappedEmployees,
        ];
      }

      setEmployees(mappedEmployees);
    } catch (err) {
      console.error("Error fetching employees:", err.message);
      setEmployees([]);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchEmployees();
  }, [filters]);

  useEffect(() => {
    if (location.state?.refresh) {
      fetchEmployees();
      window.history.replaceState({}, document.title);
    }
  }, [location.state]);

  return (
    <div className="flex bg-gray-900 min-h-screen text-gray-200">
      {/* Sidebar */}
      <Sidebar
        onLogout={onLogout}
        collapsed={collapsed}
        setCollapsed={setCollapsed}
        userRole="admin"
      />

      {/* Main content */}
      <main
        className="flex-1 p-6 transition-all duration-300 min-h-screen overflow-y-auto"
        style={{ marginLeft: `${sidebarWidth}px` }}
      >
        <h1 className="text-2xl font-semibold mb-4 text-gray-100">
          Employee Directory
        </h1>

        <EmployeeFilters filters={filters} setFilters={setFilters} />

        {loading ? (
          <div className="text-center py-8 text-gray-300">
            Loading employees...
          </div>
        ) : (
          <EmployeeTable employees={employees} currentUser={currentUser} />
        )}
      </main>
    </div>
  );
};

export default EmployeeDirectory;
