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
        navigate("/login", { replace: true });
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
          ? data.map((emp) => ({
              _id: emp._id,
              name: emp.fullName || emp.name || emp.email || `Employee ${emp._id}`,
              department: emp.department || "N/A",
              status: emp.status || "inactive",
              designation: emp.designation || "N/A",
              email: emp.email || "N/A",
            }))
          : []
      );
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
            onView={(emp) => {
              if (emp && emp._id) {
                navigate(`/employee/${emp._id}`);
              } else {
                console.warn("Invalid employee ID");
              }
            }}
          />
        )}
      </main>
    </div>
  );
};

export default EmployeeDirectory;
