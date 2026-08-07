import React, { useCallback, useEffect, useMemo, useState } from "react";
import { useNavigate, useLocation } from "react-router-dom";
import { Users, Search, Building2, Badge, X, AlertCircle } from "lucide-react";
import Sidebar from "../components/dashboard/Sidebar";
import EmployeeFilters from "../components/employeedetails/EmployeeFilters";
import EmployeeTable from "../components/employeedetails/EmployeeTable";

const API_BASE = import.meta.env.VITE_API_BASE || "http://localhost:5000";
const REGIONS = ["Global", "USA", "AUS", "CANADA", "IND"];

const EmployeeDirectory = ({ onLogout }) => {
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
  const [updatingStatus, setUpdatingStatus] = useState(null);
  const [currentUser, setCurrentUser] = useState(null);
  const [userPermissions, setUserPermissions] = useState({});
  const [loadError, setLoadError] = useState("");
  const [actionError, setActionError] = useState("");

  // Function to update employee status
  const updateEmployeeStatus = async (employeeId, newStatus) => {
    setActionError("");
    setUpdatingStatus(employeeId);
    try {
      const token = localStorage.getItem("token");
      const response = await fetch(`${API_BASE}/api/users/${employeeId}/status`, {
        method: "PUT",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ status: newStatus }),
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        console.error("Server response:", errorData);
        throw new Error(errorData.message || "Failed to update employee status");
      }

      // Update local state
      setEmployees(prevEmployees =>
        prevEmployees.map(emp =>
          emp._id === employeeId ? { ...emp, status: newStatus } : emp
        )
      );

    } catch (error) {
      console.error("Error updating employee status:", error);
      setActionError("The employee status could not be updated. Please try again.");
    } finally {
      setUpdatingStatus(null);
    }
  };

  // Function to change employee role (super-admin only)
  const updateEmployeeRole = async (employeeId, newRole) => {
    try {
      setActionError("");
      const token = localStorage.getItem("token");
      const response = await fetch(`${API_BASE}/api/users/${employeeId}`, {
        method: "PUT",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ role: newRole }),
      });
      if (!response.ok) throw new Error("Failed to update role");
      setEmployees(prev =>
        prev.map(emp => emp._id === employeeId ? { ...emp, role: newRole } : emp)
      );
    } catch (error) {
      console.error("Error updating role:", error);
      setActionError("The employee role could not be updated. Please try again.");
    }
  };

  // Function to toggle employee region (add/remove from array)
  const updateEmployeeRegion = async (employeeId, toggleRegion) => {
    setActionError("");

    // Find the employee
    const employee = employees.find(emp => emp._id === employeeId);
    if (!employee) return;

    // Get current regions array (or convert old single region to array)
    const currentRegions = Array.isArray(employee.regions) && employee.regions.length
      ? employee.regions
      : [employee.region || "Global"];

    // Toggle the region
    let newRegions;
    if (currentRegions.includes(toggleRegion)) {
      // Remove the region (but ensure at least one region remains)
      newRegions = currentRegions.filter(r => r !== toggleRegion);
      if (newRegions.length === 0) {
        setActionError("Each employee must have at least one assigned region.");
        return;
      }
    } else {
      // Add the region
      newRegions = [...currentRegions, toggleRegion];
    }

    try {
      const token = localStorage.getItem("token");
      const response = await fetch(`${API_BASE}/api/users/${employeeId}`, {
        method: "PUT",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ regions: newRegions }),
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        console.error("Server response:", errorData);
        throw new Error(errorData.message || "Failed to update employee regions");
      }

      // Update local state
      setEmployees(prevEmployees =>
        prevEmployees.map(emp =>
          emp._id === employeeId ? { ...emp, regions: newRegions } : emp
        )
      );

    } catch (error) {
      console.error("Error updating employee regions:", error);
      setActionError("The employee regions could not be updated. Please try again.");
    }
  };

  const fetchEmployees = useCallback(async () => {
    setLoading(true);
    setLoadError("");
    try {
      const token = localStorage.getItem("token");
      const userData = localStorage.getItem("user");
      if (!token || !userData) {
        navigate("/login", { replace: true });
        return;
      }
      const user = JSON.parse(userData);
      setCurrentUser(user);

      // Fetch position-based permissions so canManageUsers is respected
      // regardless of the user's system role (e.g. employee with HR position)
      const permRes = await fetch(`${API_BASE}/api/users/me/permissions`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (permRes.ok) {
        const permData = await permRes.json();
        setUserPermissions(permData);
      }

      // Fetch all employees without server-side filtering
      const url = `${API_BASE}/api/users/directory`;

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
        ? data.map((emp) => {
            return {
              _id: String(emp._id),
              name: emp.fullName || emp.name || emp.email || `Employee ${emp._id}`,
              department: emp.department || "N/A",
              status: emp.status, // Preserve actual status from database
              designation: emp.designation || "N/A",
              email: emp.email || "N/A",
              employeeId: emp.employeeId || "-",
              regions: Array.isArray(emp.regions) && emp.regions.length
                ? emp.regions
                : [emp.region || "Global"],
              region: emp.region || "Global", // Keep for backwards compatibility
            };
          })
        : [];

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
            regions: Array.isArray(user.regions) && user.regions.length
              ? user.regions
              : [user.region || "Global"],
            region: user.region || "Global", // Keep for backwards compatibility
          },
          ...mappedEmployees,
        ];
      }

      setEmployees(mappedEmployees);
    } catch (err) {
      console.error("Error fetching employees:", err.message);
      setEmployees([]);
      setLoadError("We could not load the employee directory. Check your connection and try again.");
    } finally {
      setLoading(false);
    }
  }, [navigate]);

  useEffect(() => {
    fetchEmployees();
  }, [fetchEmployees]);

  useEffect(() => {
    if (location.state?.refresh) {
      fetchEmployees();
      window.history.replaceState({}, document.title);
    }
  }, [fetchEmployees, location.state]);

  // Client-side filtering for enhanced search
  const filteredEmployees = useMemo(() => {
    let filtered = [...employees];

    // Apply search filter
    if (filters.search.trim()) {
      const searchTerm = filters.search.toLowerCase();
      filtered = filtered.filter(emp => {
        const name = (emp.name || "").toLowerCase();
        const email = (emp.email || "").toLowerCase();
        const department = (emp.department || "").toLowerCase();
        const designation = (emp.designation || "").toLowerCase();
        const employeeId = (emp.employeeId || "").toLowerCase();

        return name.includes(searchTerm) ||
               email.includes(searchTerm) ||
               department.includes(searchTerm) ||
               designation.includes(searchTerm) ||
               employeeId.includes(searchTerm);
      });
    }

    // Apply department filter
    if (filters.department !== "all") {
      filtered = filtered.filter(emp => emp.department === filters.department);
    }

    // Apply status filter
    if (filters.status !== "all") {
      filtered = filtered.filter(emp => emp.status?.toLowerCase() === filters.status.toLowerCase());
    }

    // Sort employees: active first, then terminated/absconded last
    filtered.sort((a, b) => {
      const getStatusPriority = (status) => {
        switch (status?.toLowerCase()) {
          case 'active': return 1;
          case 'terminated': return 3;
          case 'absconded': return 4;
          default: return 2;
        }
      };

      const priorityA = getStatusPriority(a.status);
      const priorityB = getStatusPriority(b.status);

      if (priorityA !== priorityB) {
        return priorityA - priorityB;
      }

      // If same priority, sort by name
      return (a.name || "").localeCompare(b.name || "");
    });

    return filtered;
  }, [employees, filters]);

  // Calculate stats based on ALL employees (not filtered)
  const totalEmployees = employees.length;
  const activeEmployees = employees.filter(emp => emp.status?.toLowerCase() === "active").length;
  const terminatedEmployees = employees.filter(emp => emp.status?.toLowerCase() === "terminated").length;
  const abscondedEmployees = employees.filter(emp => emp.status?.toLowerCase() === "absconded").length;
  const departments = [...new Set(employees.map(emp => emp.department).filter(dep => dep && dep !== "N/A" && dep !== ""))];
  const normalizedRole = currentUser?.role?.toLowerCase() || "employee";
  const canManageEmployees =
    ["admin", "hr", "super-admin"].includes(normalizedRole) ||
    !!userPermissions?.permissions?.canManageUsers;

  return (
    <div className="relative flex h-[100dvh] overflow-hidden bg-slate-50 text-slate-900 dark:bg-[#0b0d12] dark:text-slate-100">
      <Sidebar
        onLogout={onLogout}
        collapsed={collapsed}
        setCollapsed={setCollapsed}
        userRole={currentUser?.role || "employee"}
      />

      <main
        className={`h-[100dvh] min-w-0 flex-1 overflow-y-auto overflow-x-hidden px-2 py-3 transition-all duration-300 sm:px-3 lg:px-4 ${
          collapsed ? "app-offset app-offset-collapsed" : "app-offset"
        }`}
      >
        <div className="pb-6">
        <header className="mb-3 rounded-lg border border-slate-200 bg-white px-4 py-3 shadow-sm dark:border-white/10 dark:bg-[#10131c]">
          <div className="flex items-center justify-between gap-3">
            <div className="flex items-center gap-3">
              <div className="inline-flex items-center gap-1.5 rounded-lg border border-blue-200 bg-blue-50 px-2 py-1 text-[10px] font-semibold text-blue-700 dark:border-blue-400/20 dark:bg-blue-400/10 dark:text-blue-200">
                <Users className="h-3 w-3" /> People operations
              </div>
              <h1 className="text-lg font-semibold tracking-tight text-slate-950 dark:text-white">
                Employee directory
              </h1>
            </div>
            <div className="flex items-center">
              <div className="rounded-lg border border-slate-200 bg-slate-50 px-2.5 py-1.5 dark:border-white/10 dark:bg-white/[0.025]">
                <div className="flex items-center space-x-2">
                  <div className="h-1.5 w-1.5 rounded-full bg-green-400"></div>
                  <p className="font-mono text-[10px] text-slate-700 dark:text-slate-200">
                    {new Date().toLocaleTimeString("en-US", {
                      hour: "2-digit",
                      minute: "2-digit",
                    })}
                  </p>
                </div>
              </div>
            </div>
          </div>
        </header>

        {actionError && (
          <div className="mb-4 flex items-start justify-between gap-3 rounded-xl border border-rose-200 bg-rose-50 p-3 text-sm text-rose-700 dark:border-rose-400/20 dark:bg-rose-400/10 dark:text-rose-200">
            <span>{actionError}</span>
            <button type="button" onClick={() => setActionError("")} aria-label="Dismiss error">
              <X className="h-4 w-4" />
            </button>
          </div>
        )}

        {/* Stats Dashboard */}
        <div className="mb-4 grid grid-cols-2 gap-2 sm:grid-cols-3 lg:grid-cols-5">
          {/* Total Employees */}
          <div className="rounded-lg border border-slate-200 bg-white p-2.5 shadow-sm dark:border-white/10 dark:bg-[#10131c]">
            <div className="flex items-center justify-between">
              <div className="flex h-7 w-7 items-center justify-center rounded-lg bg-blue-50 dark:bg-blue-400/10">
                <Users className="h-3.5 w-3.5 text-blue-600 dark:text-blue-300" />
              </div>
              <div className="text-right">
                <p className="text-lg font-semibold text-slate-950 dark:text-white">{totalEmployees}</p>
                <p className="text-[10px] text-slate-500 dark:text-slate-400">Total</p>
              </div>
            </div>
          </div>

          {/* Active Employees */}
          <div className="rounded-lg border border-slate-200 bg-white p-2.5 shadow-sm dark:border-white/10 dark:bg-[#10131c]">
            <div className="flex items-center justify-between">
              <div className="flex h-7 w-7 items-center justify-center rounded-lg bg-emerald-50 dark:bg-emerald-400/10">
                <Badge className="h-3.5 w-3.5 text-emerald-600 dark:text-emerald-300" />
              </div>
              <div className="text-right">
                <p className="text-lg font-semibold text-slate-950 dark:text-white">{activeEmployees}</p>
                <p className="text-[10px] text-slate-500 dark:text-slate-400">Active</p>
              </div>
            </div>
          </div>

          {/* Terminated Employees */}
          <div className="rounded-lg border border-slate-200 bg-white p-2.5 shadow-sm dark:border-white/10 dark:bg-[#10131c]">
            <div className="flex items-center justify-between">
              <div className="flex h-7 w-7 items-center justify-center rounded-lg bg-rose-50 dark:bg-rose-400/10">
                <X className="h-3.5 w-3.5 text-rose-600 dark:text-rose-300" />
              </div>
              <div className="text-right">
                <p className="text-lg font-semibold text-slate-950 dark:text-white">{terminatedEmployees}</p>
                <p className="text-[10px] text-slate-500 dark:text-slate-400">Terminated</p>
              </div>
            </div>
          </div>

          {/* Absconded Employees */}
          <div className="rounded-lg border border-slate-200 bg-white p-2.5 shadow-sm dark:border-white/10 dark:bg-[#10131c]">
            <div className="flex items-center justify-between">
              <div className="flex h-7 w-7 items-center justify-center rounded-lg bg-orange-50 dark:bg-orange-400/10">
                <AlertCircle className="h-3.5 w-3.5 text-orange-600 dark:text-orange-300" />
              </div>
              <div className="text-right">
                <p className="text-lg font-semibold text-slate-950 dark:text-white">{abscondedEmployees}</p>
                <p className="text-[10px] text-slate-500 dark:text-slate-400">Absconded</p>
              </div>
            </div>
          </div>

          {/* Departments */}
          <div className="rounded-lg border border-slate-200 bg-white p-2.5 shadow-sm dark:border-white/10 dark:bg-[#10131c]">
            <div className="flex items-center justify-between">
              <div className="flex h-7 w-7 items-center justify-center rounded-lg bg-violet-50 dark:bg-violet-400/10">
                <Building2 className="h-3.5 w-3.5 text-violet-600 dark:text-violet-300" />
              </div>
              <div className="text-right">
                <p className="text-lg font-semibold text-slate-950 dark:text-white">{departments.length}</p>
                <p className="text-[10px] text-slate-500 dark:text-slate-400">Departments</p>
              </div>
            </div>
          </div>
        </div>

        {/* Filters Section */}
        <div className="mb-4 rounded-lg border border-slate-200 bg-white p-3 shadow-sm dark:border-white/10 dark:bg-[#10131c]">
          <EmployeeFilters
            filters={filters}
            setFilters={setFilters}
            canAddEmployees={canManageEmployees}
          />
        </div>

        {/* Employee Table Section */}
        <div className="overflow-hidden rounded-lg border border-slate-200 bg-white p-3 shadow-sm dark:border-white/10 dark:bg-[#10131c]">
          <div className="mb-3 flex items-center gap-2">
            <div className="flex h-7 w-7 items-center justify-center rounded-lg bg-emerald-400/10">
              <Users className="h-3.5 w-3.5 text-emerald-400" />
            </div>
            <div>
              <h2 className="text-sm font-semibold text-slate-950 dark:text-white">Team directory</h2>
              <p className="text-[10px] text-slate-500 dark:text-slate-400">{totalEmployees} matching employee{totalEmployees === 1 ? "" : "s"}</p>
            </div>
          </div>

          {loading ? (
            <div className="flex items-center justify-center py-12">
              <div className="flex items-center space-x-3">
                <div className="w-6 h-6 border-2 border-emerald-400 border-t-transparent rounded-full animate-spin"></div>
                <span className="text-emerald-400">Loading employees...</span>
              </div>
            </div>
          ) : loadError ? (
            <div className="flex flex-col items-center justify-center py-12 text-center">
              <AlertCircle className="mb-3 h-10 w-10 text-red-400" />
              <p className="font-semibold text-slate-900 dark:text-white">Directory unavailable</p>
              <p className="mt-1 max-w-md text-sm text-slate-500 dark:text-slate-400">{loadError}</p>
              <button
                type="button"
                onClick={fetchEmployees}
                className="mt-5 h-10 rounded-lg bg-blue-600 px-5 text-sm font-semibold text-white transition hover:bg-blue-700"
              >
                Try again
              </button>
            </div>
          ) : (
            <EmployeeTable
              employees={filteredEmployees}
              currentUser={currentUser}
              onStatusUpdate={updateEmployeeStatus}
              updatingStatus={updatingStatus}
              regions={REGIONS}
              onRegionChange={updateEmployeeRegion}
              onRoleChange={updateEmployeeRole}
              canManage={canManageEmployees}
            />
          )}
        </div>
        </div>
      </main>
    </div>
  );
};

export default EmployeeDirectory;
