import React, { useEffect, useState } from "react";
import { useNavigate, useLocation } from "react-router-dom";
import { Users, UserPlus, Search, Filter, Eye, Mail, Building2, Badge, MapPin, X, AlertCircle } from "lucide-react";
import Sidebar from "../components/dashboard/Sidebar";
import EmployeeFilters from "../components/employeedetails/EmployeeFilters";
import EmployeeTable from "../components/employeedetails/EmployeeTable";
import CelebrationPopup from "../components/common/CelebrationPopup";
import useCelebrationNotifications from "../hooks/useCelebrationNotifications";

const API_BASE = import.meta.env.VITE_API_BASE || "http://localhost:5000";

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
  const [currentTime, setCurrentTime] = useState(new Date());
  const [regions, setRegions] = useState(['Global']);

  // Celebration notifications
  const {
    celebrations,
    showPopup: showCelebrationPopup,
    closePopup: closeCelebrationPopup
  } = useCelebrationNotifications();

  // Update time every second
  useEffect(() => {
    const timer = setInterval(() => setCurrentTime(new Date()), 1000);
    return () => clearInterval(timer);
  }, []);

  // Function to fetch regions (using hardcoded enum)
  const fetchRegions = async () => {
    // Use standardized region enum values
    setRegions(['Global', 'USA', 'AUS', 'CANADA', 'IND']);
  };

  // Function to update employee status
  const updateEmployeeStatus = async (employeeId, newStatus) => {
    console.log(`Updating employee ${employeeId} status to ${newStatus}`);
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

      const result = await response.json();
      console.log("Status update successful:", result);

      // Update local state
      setEmployees(prevEmployees =>
        prevEmployees.map(emp =>
          emp._id === employeeId ? { ...emp, status: newStatus } : emp
        )
      );

      console.log(`Employee status successfully updated to ${newStatus}`);
    } catch (error) {
      console.error("Error updating employee status:", error);
      alert("Failed to update employee status. Please try again.");
    } finally {
      setUpdatingStatus(null);
    }
  };

  // Function to toggle employee region (add/remove from array)
  const updateEmployeeRegion = async (employeeId, toggleRegion) => {
    console.log(`Toggling region "${toggleRegion}" for employee ${employeeId}`);

    // Find the employee
    const employee = employees.find(emp => emp._id === employeeId);
    if (!employee) return;

    // Get current regions array (or convert old single region to array)
    let currentRegions = employee.regions || [employee.region || 'Global'];

    // Toggle the region
    let newRegions;
    if (currentRegions.includes(toggleRegion)) {
      // Remove the region (but ensure at least one region remains)
      newRegions = currentRegions.filter(r => r !== toggleRegion);
      if (newRegions.length === 0) {
        alert("Employee must have at least one region assigned.");
        return;
      }
    } else {
      // Add the region
      newRegions = [...currentRegions, toggleRegion];
    }

    console.log(`Updating regions from [${currentRegions.join(', ')}] to [${newRegions.join(', ')}]`);

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

      const result = await response.json();
      console.log("Regions update successful:", result);

      // Update local state
      setEmployees(prevEmployees =>
        prevEmployees.map(emp =>
          emp._id === employeeId ? { ...emp, regions: newRegions } : emp
        )
      );

      console.log(`Employee regions successfully updated to [${newRegions.join(', ')}]`);
    } catch (error) {
      console.error("Error updating employee regions:", error);
      alert("Failed to update employee regions. Please try again.");
    }
  };

  const sidebarWidth = collapsed ? 80 : 288;

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
      const userData = localStorage.getItem("user");
      if (!token || !userData) {
        navigate("/login", { replace: true });
        return;
      }
      const user = JSON.parse(userData);
      setCurrentUser(user);

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
      console.log("Raw employee data from server:", data);

      let mappedEmployees = Array.isArray(data)
        ? data.map((emp) => {
            console.log(`Employee ${emp.name} status from DB:`, emp.status);
            console.log(`Employee ${emp.name} regions from DB:`, emp.regions);
            return {
              _id: String(emp._id),
              name: emp.fullName || emp.name || emp.email || `Employee ${emp._id}`,
              department: emp.department || "N/A",
              status: emp.status, // Preserve actual status from database
              designation: emp.designation || "N/A",
              email: emp.email || "N/A",
              employeeId: emp.employeeId || "-",
              regions: emp.regions || [emp.region] || ["Global"], // Use regions array
              region: emp.region || "Global", // Keep for backwards compatibility
            };
          })
        : [];

      console.log("Mapped employees:", mappedEmployees);

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
            regions: user.regions || [user.region] || ["Global"], // Use regions array
            region: user.region || "Global", // Keep for backwards compatibility
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
    fetchRegions();
  }, []); // Only fetch once on mount, filtering is now client-side

  useEffect(() => {
    if (location.state?.refresh) {
      fetchEmployees();
      window.history.replaceState({}, document.title);
    }
  }, [location.state]);

  // Client-side filtering for enhanced search
  const filteredEmployees = React.useMemo(() => {
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
      filtered = filtered.filter(emp => emp.status === filters.status);
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

  // Calculate stats based on filtered data
  const totalEmployees = filteredEmployees.length;
  const activeEmployees = filteredEmployees.filter(emp => emp.status === "active").length;
  const terminatedEmployees = filteredEmployees.filter(emp => emp.status === "terminated").length;
  const abscondedEmployees = filteredEmployees.filter(emp => emp.status === "absconded").length;
  const departments = [...new Set(filteredEmployees.map(emp => emp.department).filter(dep => dep !== "N/A"))];
  const avgDepartmentSize = departments.length > 0 ? Math.round(totalEmployees / departments.length) : 0;

  return (
    <div className="flex bg-[#0f1419] min-h-screen text-white relative overflow-hidden">
      {/* Animated Background */}
      <div className="absolute inset-0 bg-gradient-to-br from-slate-900/20 via-blue-900/10 to-purple-900/20"></div>
      <div className="absolute inset-0">
        <div className="absolute top-1/4 left-1/4 w-96 h-96 bg-cyan-500/5 rounded-full blur-3xl animate-pulse"></div>
        <div className="absolute bottom-1/4 right-1/4 w-96 h-96 bg-purple-500/5 rounded-full blur-3xl animate-pulse"></div>
      </div>

      <Sidebar
        onLogout={onLogout}
        collapsed={collapsed}
        setCollapsed={setCollapsed}
        userRole="admin"
      />

      <main
        className={`relative z-10 flex-1 transition-all duration-300 ${
          collapsed ? "ml-24" : "ml-72"
        } p-8`}
      >
        {/* Modern Header */}
        <div className="mb-12">
          <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between mb-6">
            <div>
              <h1 className="text-5xl font-bold mb-2">
                <span className="bg-gradient-to-r from-emerald-400 via-cyan-400 to-blue-400 bg-clip-text text-transparent">
                  Employee Directory
                </span>
              </h1>
              <p className="text-xl text-gray-300 mb-4">
                Manage your team and discover talent 👥
              </p>
            </div>
            <div className="flex items-center space-x-4">
              <div className="bg-gradient-to-br from-slate-800/50 to-slate-900/50 backdrop-blur-sm border border-slate-600/30 rounded-2xl px-6 py-4">
                <div className="flex items-center space-x-3">
                  <div className="w-3 h-3 bg-green-400 rounded-full animate-pulse"></div>
                  <div>
                    <p className="text-sm text-gray-400">Live Time</p>
                    <p className="text-cyan-400 font-mono text-sm">
                      {currentTime.toLocaleTimeString("en-US", {
                        hour: "2-digit",
                        minute: "2-digit",
                        second: "2-digit",
                      })}
                    </p>
                  </div>
                </div>
              </div>
            </div>
          </div>
          <div className="text-gray-400 text-lg">
            {currentTime.toLocaleDateString("en-US", {
              weekday: "long",
              year: "numeric",
              month: "long",
              day: "numeric",
            })}
          </div>
        </div>

        {/* Stats Dashboard */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-6 mb-12">
          {/* Total Employees */}
          <div className="bg-gradient-to-br from-slate-800/50 to-slate-900/50 backdrop-blur-sm border border-slate-600/30 rounded-2xl p-6 hover:border-cyan-400/40 transition-all duration-300 hover:scale-105 hover:shadow-2xl hover:shadow-cyan-500/25">
            <div className="flex items-center justify-between mb-4">
              <div className="p-3 bg-gradient-to-br from-cyan-500/20 to-blue-600/20 rounded-xl">
                <Users className="w-6 h-6 text-cyan-400" />
              </div>
              <div className="text-right">
                <p className="text-3xl font-bold text-white">{totalEmployees}</p>
                <p className="text-sm text-gray-400 uppercase tracking-wide">Total</p>
              </div>
            </div>
            <div className="h-1 bg-gradient-to-r from-cyan-500 to-blue-600 rounded-full"></div>
          </div>

          {/* Active Employees */}
          <div className="bg-gradient-to-br from-slate-800/50 to-slate-900/50 backdrop-blur-sm border border-slate-600/30 rounded-2xl p-6 hover:border-green-400/40 transition-all duration-300 hover:scale-105 hover:shadow-2xl hover:shadow-green-500/25">
            <div className="flex items-center justify-between mb-4">
              <div className="p-3 bg-gradient-to-br from-green-500/20 to-emerald-600/20 rounded-xl">
                <Badge className="w-6 h-6 text-green-400" />
              </div>
              <div className="text-right">
                <p className="text-3xl font-bold text-white">{activeEmployees}</p>
                <p className="text-sm text-gray-400 uppercase tracking-wide">Active</p>
              </div>
            </div>
            <div className="h-1 bg-gradient-to-r from-green-500 to-emerald-600 rounded-full"></div>
          </div>

          {/* Terminated Employees */}
          <div className="bg-gradient-to-br from-slate-800/50 to-slate-900/50 backdrop-blur-sm border border-slate-600/30 rounded-2xl p-6 hover:border-red-400/40 transition-all duration-300 hover:scale-105 hover:shadow-2xl hover:shadow-red-500/25">
            <div className="flex items-center justify-between mb-4">
              <div className="p-3 bg-gradient-to-br from-red-500/20 to-pink-600/20 rounded-xl">
                <X className="w-6 h-6 text-red-400" />
              </div>
              <div className="text-right">
                <p className="text-3xl font-bold text-white">{terminatedEmployees}</p>
                <p className="text-sm text-gray-400 uppercase tracking-wide">Terminated</p>
              </div>
            </div>
            <div className="h-1 bg-gradient-to-r from-red-500 to-pink-600 rounded-full"></div>
          </div>

          {/* Absconded Employees */}
          <div className="bg-gradient-to-br from-slate-800/50 to-slate-900/50 backdrop-blur-sm border border-slate-600/30 rounded-2xl p-6 hover:border-orange-400/40 transition-all duration-300 hover:scale-105 hover:shadow-2xl hover:shadow-orange-500/25">
            <div className="flex items-center justify-between mb-4">
              <div className="p-3 bg-gradient-to-br from-orange-500/20 to-red-600/20 rounded-xl">
                <AlertCircle className="w-6 h-6 text-orange-400" />
              </div>
              <div className="text-right">
                <p className="text-3xl font-bold text-white">{abscondedEmployees}</p>
                <p className="text-sm text-gray-400 uppercase tracking-wide">Absconded</p>
              </div>
            </div>
            <div className="h-1 bg-gradient-to-r from-orange-500 to-red-600 rounded-full"></div>
          </div>

          {/* Departments */}
          <div className="bg-gradient-to-br from-slate-800/50 to-slate-900/50 backdrop-blur-sm border border-slate-600/30 rounded-2xl p-6 hover:border-purple-400/40 transition-all duration-300 hover:scale-105 hover:shadow-2xl hover:shadow-purple-500/25">
            <div className="flex items-center justify-between mb-4">
              <div className="p-3 bg-gradient-to-br from-purple-500/20 to-indigo-600/20 rounded-xl">
                <Building2 className="w-6 h-6 text-purple-400" />
              </div>
              <div className="text-right">
                <p className="text-3xl font-bold text-white">{departments.length}</p>
                <p className="text-sm text-gray-400 uppercase tracking-wide">Departments</p>
              </div>
            </div>
            <div className="h-1 bg-gradient-to-r from-purple-500 to-indigo-600 rounded-full"></div>
          </div>
        </div>

        {/* Filters Section */}
        <div className="bg-gradient-to-br from-slate-800/40 to-slate-900/40 backdrop-blur-xl border border-slate-600/30 rounded-3xl p-8 mb-8 hover:border-cyan-400/40 transition-all duration-300 shadow-2xl">
          <div className="flex items-center space-x-3 mb-6">
            <div className="p-3 bg-gradient-to-br from-cyan-500/20 to-blue-600/20 rounded-xl">
              <Search className="w-6 h-6 text-cyan-400" />
            </div>
            <div>
              <h2 className="text-2xl font-bold bg-gradient-to-r from-cyan-400 to-blue-400 bg-clip-text text-transparent">
                Search & Filter
              </h2>
              <p className="text-gray-400">Find the right people for your team</p>
            </div>
          </div>
          <EmployeeFilters filters={filters} setFilters={setFilters} />
        </div>

        {/* Employee Table Section */}
        <div className="bg-gradient-to-br from-emerald-900/20 to-teal-900/20 backdrop-blur-xl border border-emerald-500/30 rounded-3xl p-8 shadow-2xl hover:border-emerald-400/40 transition-all duration-300">
          <div className="flex items-center space-x-3 mb-6">
            <div className="p-3 bg-gradient-to-br from-emerald-500/20 to-teal-600/20 rounded-xl">
              <Users className="w-6 h-6 text-emerald-400" />
            </div>
            <div>
              <h2 className="text-2xl font-bold bg-gradient-to-r from-emerald-400 to-teal-400 bg-clip-text text-transparent">
                Team Directory
              </h2>
              <p className="text-gray-400">Browse and manage your team members ({totalEmployees} total)</p>
            </div>
          </div>

          {loading ? (
            <div className="flex items-center justify-center py-12">
              <div className="flex items-center space-x-3">
                <div className="w-6 h-6 border-2 border-emerald-400 border-t-transparent rounded-full animate-spin"></div>
                <span className="text-emerald-400">Loading employees...</span>
              </div>
            </div>
          ) : (
            <EmployeeTable
              employees={filteredEmployees}
              currentUser={currentUser}
              onStatusUpdate={updateEmployeeStatus}
              updatingStatus={updatingStatus}
              regions={regions}
              onRegionChange={updateEmployeeRegion}
            />
          )}
        </div>
      </main>
    </div>
  );
};

export default EmployeeDirectory;
