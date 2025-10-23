
import React, { useEffect, useState } from "react";
import axios from "axios";
import { useNavigate } from "react-router-dom";
import { attendanceUtils } from "../api.js";
import {
  Users,
  Clock,
  Coffee,
  TrendingUp,
  RefreshCw,
  Calendar,
  Activity,
  BarChart3,
  Eye,
  Download,
  Filter,
  Search,
  AlertCircle,
  CheckCircle,
  Timer,
  UserCheck,
  Building2,
  Zap,
  FileText,
  Settings
} from "lucide-react";
import EmployeeRow from "../components/superadmin/EmployeeRow";
import Sidebar from "../components/dashboard/Sidebar";
import CelebrationPopup from "../components/common/CelebrationPopup";
import useCelebrationNotifications from "../hooks/useCelebrationNotifications";

const API_BASE = import.meta.env.VITE_API_BASE || "http://localhost:5000";

// Helper function to parse work duration string (e.g., "8h 30m") to hours
const parseWorkDuration = (durationStr) => {
  if (!durationStr || typeof durationStr !== 'string') return 0;

  const hours = durationStr.match(/(\d+)h/);
  const minutes = durationStr.match(/(\d+)m/);

  const h = hours ? parseInt(hours[1]) : 0;
  const m = minutes ? parseInt(minutes[1]) : 0;

  return h + (m / 60);
};

const SuperAdminDashboard = ({ onLogout }) => {
  const navigate = useNavigate();
  const [employees, setEmployees] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [selectedDate, setSelectedDate] = useState(
    new Date().toISOString().split("T")[0]
  );
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);
  const [currentTime, setCurrentTime] = useState(new Date());
  const [searchTerm, setSearchTerm] = useState("");
  const [filterStatus, setFilterStatus] = useState("all");
  const [viewMode, setViewMode] = useState("table"); // table or cards
  const [lastUpdateTime, setLastUpdateTime] = useState(null);

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
          params: {
            date,
            _timestamp: Date.now() // Cache-busting parameter
          },
        }
      );

      console.log("Employees data received:", res.data);
      console.log("API response status:", res.status);
      console.log("Number of employees fetched:", res.data?.length || 0);

      let empData = res.data || [];

      if (empData.length > 0) {
        console.log("Sample employee data structure:", empData[0]);

        // Check for data quality issues
        const employeesWithMissingData = empData.filter(emp =>
          !emp.name || !emp.employeeId || emp.name === 'Unknown Employee'
        );

        if (employeesWithMissingData.length > 0) {
          console.warn(`Found ${employeesWithMissingData.length} employees with missing data:`,
            employeesWithMissingData.map(emp => ({
              id: emp.employeeId,
              name: emp.name,
              userId: emp.userId
            }))
          );
        }

        // Check for break data issues
        const employeesWithBreakIssues = empData.filter(emp =>
          emp.onBreak && (!emp.breakDurationMinutes || emp.breakDurationMinutes === 0)
        );

        if (employeesWithBreakIssues.length > 0) {
          console.warn(`Found ${employeesWithBreakIssues.length} employees on break with no break duration:`,
            employeesWithBreakIssues.map(emp => ({
              id: emp.employeeId,
              name: emp.name,
              onBreak: emp.onBreak,
              breakDuration: emp.breakDurationMinutes
            }))
          );
        }
      }

      // Map backend data structure to frontend expectations with validation
      empData = empData.map(emp => {
        // Validate and clean data
        const cleanEmp = {
          ...emp,
          // Ensure all required fields exist with defaults
          employeeId: emp.employeeId || 'Unknown',
          name: emp.name || 'Unknown Employee',
          arrivalTime: emp.arrivalTime || null,
          punchOutTime: emp.punchOutTime || null,
          onBreak: Boolean(emp.onBreak),
          breakDurationMinutes: Number(emp.breakDurationMinutes) || 0,
          breakType: emp.breakType || null,
          workDuration: emp.workDuration || '0h 0m',
          currentlyWorking: Boolean(emp.currentlyWorking),

          // Map backend fields to frontend expected fields
          totalWorkHours: emp.workDuration ? parseWorkDuration(emp.workDuration) : 0,
          totalBreakMinutes: Number(emp.breakDurationMinutes) || 0,
          departureTime: emp.punchOutTime || null,
        };

        // Debug logging for problematic employees
        if (!emp.name || !emp.employeeId) {
          console.warn("Employee with missing critical data:", emp);
        }

        return cleanEmp;
      });

      console.log("Mapped employee data sample:", empData.length > 0 ? empData[0] : "No data");

      // Log summary of data quality
      const dataQualityReport = {
        total: empData.length,
        withStatus: empData.filter(emp => emp.hasStatus).length,
        withDailyWork: empData.filter(emp => emp.hasDailyWork).length,
        currentlyWorking: empData.filter(emp => emp.currentlyWorking).length,
        onBreak: empData.filter(emp => emp.onBreak).length,
        withArrivalTime: empData.filter(emp => emp.arrivalTime).length,
        withBreakData: empData.filter(emp => emp.onBreak && emp.totalBreakMinutes > 0).length,
        withErrors: empData.filter(emp => emp.error).length
      };

      console.log("Data quality report:", dataQualityReport);

      // Log employees with issues
      const problematicEmployees = empData.filter(emp =>
        emp.error || !emp.hasStatus || !emp.hasDailyWork || (emp.onBreak && emp.totalBreakMinutes === 0)
      );

      if (problematicEmployees.length > 0) {
        console.warn("Employees with data issues:", problematicEmployees.map(emp => ({
          name: emp.name,
          id: emp.employeeId,
          issues: {
            hasError: !!emp.error,
            missingStatus: !emp.hasStatus,
            missingDailyWork: !emp.hasDailyWork,
            breakWithoutDuration: emp.onBreak && emp.totalBreakMinutes === 0
          },
          error: emp.error
        })));
      }

      // Simple sorting: Working -> Break -> Punched Out -> Rest
      empData.sort((a, b) => {
        // Define status priority (lower number = higher priority)
        const getStatusPriority = (emp) => {
          if (emp.currentlyWorking && !emp.onBreak) return 1; // Working (Green)
          if (emp.onBreak) return 2; // On Break (Yellow)
          if (emp.punchOutTime) return 3; // Punched out (Violet)
          return 4; // Rest (Normal)
        };

        const priorityA = getStatusPriority(a);
        const priorityB = getStatusPriority(b);

        // Sort by priority first
        if (priorityA !== priorityB) {
          return priorityA - priorityB;
        }

        // If same priority, sort by name alphabetically
        return (a.name || '').localeCompare(b.name || '');
      });

      setEmployees(empData);
      setLastUpdateTime(new Date());
      console.log("Successfully set employees state with", empData.length, "employees");
    } catch (err) {
      console.error("Error fetching employees:", err);
      console.error("Error details:", {
        message: err.message,
        status: err.response?.status,
        statusText: err.response?.statusText,
        data: err.response?.data
      });

      let errorMessage = "Failed to fetch employees. Please try again.";

      if (err.response?.status === 401) {
        errorMessage = "Authentication failed. Please log in again.";
      } else if (err.response?.status === 403) {
        errorMessage = "Access denied. Insufficient permissions.";
      } else if (err.response?.status === 404) {
        errorMessage = "API endpoint not found. Please check your configuration.";
      } else if (err.response?.status >= 500) {
        errorMessage = "Server error. Please contact support if this persists.";
      } else if (err.code === 'NETWORK_ERROR' || !err.response) {
        errorMessage = "Network error. Please check your connection.";
      }

      setError(errorMessage);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchEmployees(selectedDate);
  }, [selectedDate]);

  // Test connection on component mount
  useEffect(() => {
    const runConnectionTest = async () => {
      const isConnected = await testApiConnection();
      console.log("Initial connection test result:", isConnected);
    };

    runConnectionTest();
  }, []);

  // Auto-refresh every 10 seconds for today's data (faster for real-time updates)
  useEffect(() => {
    const isToday = selectedDate === new Date().toISOString().split("T")[0];
    if (!isToday) return;

    const interval = setInterval(() => {
      console.log("Auto-refreshing employee data...");
      fetchEmployees(selectedDate);
    }, 10000); // Refresh every 10 seconds for more responsive break time updates

    return () => clearInterval(interval);
  }, [selectedDate]);

  // Real-time break time update for employees currently on break
  useEffect(() => {
    const isToday = selectedDate === new Date().toISOString().split("T")[0];
    if (!isToday || !employees || employees.length === 0) return;

    const onBreakEmployees = employees.filter(emp => emp.onBreak);
    if (onBreakEmployees.length === 0) return;

    console.log(`Setting up real-time break tracking for ${onBreakEmployees.length} employees`);

    // Update break times every 5 seconds for employees on break
    const breakInterval = setInterval(() => {
      setEmployees(prevEmployees => {
        let hasUpdates = false;
        const updatedEmployees = prevEmployees.map(emp => {
          if (!emp.onBreak) return emp;

          // Calculate real-time break minutes using the utility function
          const updatedBreakMinutes = attendanceUtils.calculateBreakMinutes(emp, emp.onBreak);

          // Only update if there's a meaningful change
          if (Math.abs((emp.totalBreakMinutes || 0) - updatedBreakMinutes) >= 1) {
            hasUpdates = true;
            return {
              ...emp,
              totalBreakMinutes: updatedBreakMinutes,
              breakDurationMinutes: updatedBreakMinutes
            };
          }
          return emp;
        });

        if (hasUpdates) {
          console.log('Updated break times for employees');
        }
        return updatedEmployees;
      });
    }, 5000); // Update every 5 seconds for balance between accuracy and performance

    return () => {
      console.log('Cleaning up real-time break tracking');
      clearInterval(breakInterval);
    };
  }, [selectedDate, employees?.filter(emp => emp.onBreak).length]);

  // Manual refresh function
  const handleRefresh = () => {
    console.log("Manual refresh triggered");
    fetchEmployees(selectedDate);
  };

  // Quick action handlers
  const handleExportData = () => {
    try {
      const dataToExport = {
        date: selectedDate,
        totalEmployees: stats.total,
        workingEmployees: stats.working,
        onBreakEmployees: stats.onBreak,
        attendanceRate: stats.attendanceRate,
        avgWorkHours: stats.avgWorkHours,
        employees: filteredEmployees.map(emp => ({
          employeeId: emp.employeeId,
          name: emp.name,
          arrivalTime: emp.arrivalTime,
          departureTime: emp.departureTime,
          totalWorkHours: emp.totalWorkHours,
          currentlyWorking: emp.currentlyWorking,
          onBreak: emp.onBreak,
          breakType: emp.breakType,
          totalBreakMinutes: emp.totalBreakMinutes
        }))
      };

      const dataStr = JSON.stringify(dataToExport, null, 2);
      const dataBlob = new Blob([dataStr], { type: 'application/json' });
      const url = URL.createObjectURL(dataBlob);
      const link = document.createElement('a');
      link.href = url;
      link.download = `attendance-report-${selectedDate}.json`;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      URL.revokeObjectURL(url);
    } catch (error) {
      console.error('Export failed:', error);
      alert('Export failed. Please try again.');
    }
  };

  const handleManageEmployees = () => {
    navigate('/employee-directory');
  };

  const handleViewReports = () => {
    navigate('/admin-attendance-portal');
  };

  const handleViewAlerts = () => {
    // Calculate alerts based on current data
    const alerts = [];

    if (stats.attendanceRate < 70) {
      alerts.push(`Low attendance rate: ${stats.attendanceRate}%`);
    }

    if (stats.avgWorkHours < 6) {
      alerts.push(`Low average work hours: ${stats.avgWorkHours.toFixed(1)}h`);
    }

    const lateEmployees = employees.filter(emp => {
      if (!emp.arrivalTime) return false;
      const arrivalTime = new Date(emp.arrivalTime);
      const workStart = new Date(arrivalTime);
      workStart.setHours(9, 30, 0, 0); // Assuming 9:30 AM start time
      return arrivalTime > workStart;
    });

    if (lateEmployees.length > 0) {
      alerts.push(`${lateEmployees.length} employees arrived late today`);
    }

    if (alerts.length === 0) {
      alerts.push('No alerts for today! 🎉');
    }

    alert(`Current Alerts:\n\n${alerts.join('\n')}`);
  };

  // Test API connection
  const testApiConnection = async () => {
    try {
      console.log("Testing API connection...");
      console.log("API Base URL:", API_BASE);
      console.log("Token exists:", !!token);
      console.log("Selected date:", selectedDate);

      const response = await axios.get(`${API_BASE}/api/super-admin/employees-today`, {
        ...axiosConfig,
        params: { date: selectedDate },
        timeout: 10000 // 10 second timeout
      });

      console.log("API test successful:", {
        status: response.status,
        dataLength: response.data?.length,
        headers: response.headers
      });

      return true;
    } catch (error) {
      console.error("API test failed:", error);
      return false;
    }
  };

  // Filter employees based on search and status
  const filteredEmployees = employees.filter(emp => {
    const matchesSearch = !searchTerm ||
      emp.name?.toLowerCase().includes(searchTerm.toLowerCase()) ||
      emp.employeeId?.toLowerCase().includes(searchTerm.toLowerCase());

    const matchesStatus = filterStatus === "all" ||
      (filterStatus === "working" && emp.currentlyWorking) ||
      (filterStatus === "break" && emp.onBreak) ||
      (filterStatus === "absent" && !emp.arrivalTime);

    return matchesSearch && matchesStatus;
  });

  // Calculate advanced stats with data validation
  const stats = {
    total: employees.length || 0,
    working: employees.filter(emp => emp?.currentlyWorking === true).length || 0,
    onBreak: employees.filter(emp => emp?.onBreak === true).length || 0,
    present: employees.filter(emp => emp?.arrivalTime).length || 0,
    absent: employees.filter(emp => !emp?.arrivalTime).length || 0,
    attendanceRate: employees.length > 0 ? Math.floor((employees.filter(emp => emp?.arrivalTime).length / employees.length) * 100) : 0,
    avgWorkHours: employees.length > 0 ?
      employees.reduce((sum, emp) => {
        const hours = emp?.totalWorkHours || 0;
        return sum + (typeof hours === 'number' ? hours : 0);
      }, 0) / employees.length : 0,
    // Data quality stats
    withDataIssues: employees.filter(emp => emp?.error || !emp?.hasStatus || !emp?.hasDailyWork).length || 0,
    dataQuality: employees.length > 0 ? Math.round(((employees.length - employees.filter(emp => emp?.error || !emp?.hasStatus || !emp?.hasDailyWork).length) / employees.length) * 100) : 100
  };

  // Debug stats calculation
  console.log("Stats calculated:", stats);
  console.log("Employees for stats:", employees.length);
  if (employees.length > 0) {
    console.log("Sample employee for stats:", employees[0]);
  }

  return (
    <>
      <div className="flex bg-[#0f1419] min-h-screen text-white relative overflow-hidden">
        {/* Animated Background */}
        <div className="absolute inset-0 bg-gradient-to-br from-slate-900/20 via-blue-900/10 to-purple-900/20"></div>
        <div className="absolute inset-0">
          <div className="absolute top-1/4 left-1/4 w-96 h-96 bg-cyan-500/5 rounded-full blur-3xl animate-pulse"></div>
          <div className="absolute bottom-1/4 right-1/4 w-96 h-96 bg-purple-500/5 rounded-full blur-3xl animate-pulse"></div>
        </div>

        {/* Sidebar */}
        <Sidebar
          collapsed={sidebarCollapsed}
          setCollapsed={setSidebarCollapsed}
          onLogout={onLogout}
          userRole="superadmin"
        />

      {/* Main Content */}
      <main className={`relative z-10 flex-1 transition-all duration-300 ${sidebarCollapsed ? "ml-24" : "ml-72"} p-8`}>
        {/* Modern Header */}
        <div className="mb-12">
          <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between mb-6">
            <div>
              <h1 className="text-5xl font-bold mb-2">
                <span className="bg-gradient-to-r from-emerald-400 via-cyan-400 to-blue-400 bg-clip-text text-transparent">
                  Super Admin Dashboard
                </span>
              </h1>
              <p className="text-xl text-gray-300 mb-4">
                Real-time employee attendance and productivity insights ⚡
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

        {/* Enhanced Controls and Filters */}
        <div className="bg-gradient-to-br from-slate-800/40 to-slate-900/40 backdrop-blur-sm border border-slate-600/30 rounded-2xl p-6 mb-8">
          <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between mb-6">
            <h2 className="text-2xl font-bold text-white mb-4 lg:mb-0 flex items-center gap-3">
              <BarChart3 className="h-7 w-7 text-cyan-400" />
              Attendance Overview
            </h2>
            <div className="flex flex-wrap items-center gap-3">
              <button
                onClick={handleRefresh}
                disabled={loading}
                className="flex items-center gap-2 px-4 py-2 bg-gradient-to-r from-emerald-500 to-cyan-600 hover:from-emerald-600 hover:to-cyan-700 disabled:from-gray-400 disabled:to-gray-500 text-white rounded-xl font-medium transition-all duration-300 hover:scale-105 disabled:scale-100"
                title="Refresh data"
              >
                <RefreshCw className={`h-4 w-4 ${loading ? 'animate-spin' : ''}`} />
                <span>{loading ? "Refreshing..." : "Refresh"}</span>
              </button>
              {lastUpdateTime && (
                <div className="text-xs text-gray-400 bg-slate-800/50 px-3 py-2 rounded-xl border border-slate-600/30">
                  <div className="flex items-center gap-2">
                    <div className="w-2 h-2 bg-green-400 rounded-full animate-pulse"></div>
                    <span>Last updated: {lastUpdateTime.toLocaleTimeString()}</span>
                  </div>
                </div>
              )}
              <div className="flex items-center gap-2">
                <Calendar className="h-4 w-4 text-gray-400" />
                <input
                  type="date"
                  value={selectedDate}
                  onChange={(e) => setSelectedDate(e.target.value)}
                  className="bg-slate-800/50 border border-slate-600/50 rounded-xl px-3 py-2 text-white focus:ring-2 focus:ring-cyan-400 focus:border-cyan-400 outline-none transition-all duration-300"
                  max={new Date().toISOString().split("T")[0]}
                  title="Select date to view attendance"
                />
              </div>
            </div>
          </div>

          {/* Advanced Search and Filters */}
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-4 mb-6">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-gray-400" />
              <input
                type="text"
                placeholder="Search employees..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="w-full bg-slate-800/50 border border-slate-600/50 rounded-xl pl-10 pr-4 py-3 text-white placeholder-gray-400 focus:ring-2 focus:ring-cyan-400 focus:border-cyan-400 outline-none transition-all duration-300"
              />
            </div>
            <div className="relative">
              <Filter className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-gray-400" />
              <select
                value={filterStatus}
                onChange={(e) => setFilterStatus(e.target.value)}
                className="w-full bg-slate-800/50 border border-slate-600/50 rounded-xl pl-10 pr-4 py-3 text-white focus:ring-2 focus:ring-purple-400 focus:border-purple-400 outline-none transition-all duration-300 appearance-none"
              >
                <option value="all">All Status</option>
                <option value="working">Currently Working</option>
                <option value="break">On Break</option>
                <option value="absent">Absent Today</option>
              </select>
            </div>
            <div className="flex items-center gap-2">
              <button
                onClick={() => setViewMode(viewMode === "table" ? "cards" : "table")}
                className="flex items-center gap-2 px-4 py-3 bg-slate-700/50 hover:bg-slate-600/50 border border-slate-600/30 text-gray-300 rounded-xl font-medium transition-all duration-300"
              >
                <Eye className="h-4 w-4" />
                <span>{viewMode === "table" ? "Card View" : "Table View"}</span>
              </button>
            </div>
          </div>

          {/* Results Summary */}
          {(searchTerm || filterStatus !== "all") && (
            <div className="bg-slate-700/30 border border-slate-600/30 rounded-xl p-4 mb-6">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <Activity className="h-4 w-4 text-cyan-400" />
                  <span className="text-gray-300">
                    Showing {filteredEmployees.length} of {employees.length} employees
                  </span>
                </div>
                <button
                  onClick={() => {
                    setSearchTerm("");
                    setFilterStatus("all");
                  }}
                  className="text-sm text-gray-400 hover:text-red-400 transition-colors flex items-center gap-1"
                >
                  <AlertCircle className="h-3 w-3" />
                  Clear Filters
                </button>
              </div>
              {searchTerm && (
                <div className="mt-2 text-sm text-gray-400">
                  Search term: <span className="text-cyan-400">"{searchTerm}"</span>
                </div>
              )}
            </div>
          )}

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

          {/* Data Quality Warning */}
          {!loading && !error && stats.withDataIssues > 0 && (
            <div className="bg-gradient-to-r from-amber-900/50 to-orange-800/50 backdrop-blur-sm border border-amber-600/30 rounded-2xl p-4 mb-6">
              <div className="flex items-center gap-3">
                <AlertCircle className="h-5 w-5 text-amber-400" />
                <div>
                  <h4 className="text-amber-200 font-semibold">Data Quality Notice</h4>
                  <p className="text-amber-300 text-sm">
                    {stats.withDataIssues} employees have incomplete data. Data quality: {stats.dataQuality}%
                  </p>
                  <p className="text-amber-400 text-xs mt-1">
                    Check console logs for detailed information about missing UserStatus or DailyWork records.
                  </p>
                </div>
              </div>
            </div>
          )}

          {!loading && !error && (
            <>
              {filteredEmployees.length === 0 ? (
                <div className="text-center py-16">
                  <div className="bg-gradient-to-br from-slate-800/40 to-slate-900/40 backdrop-blur-sm border border-slate-600/30 rounded-2xl p-12">
                    <div className="w-24 h-24 mx-auto mb-6 bg-gradient-to-br from-gray-600/20 to-gray-700/20 rounded-full flex items-center justify-center">
                      <Calendar className="h-12 w-12 text-gray-400" />
                    </div>
                    <h3 className="text-xl font-semibold text-gray-300 mb-2">No employees found</h3>
                    <p className="text-gray-400">
                      {searchTerm || filterStatus !== "all"
                        ? "Try adjusting your search or filter criteria."
                        : "No employees found for this date."
                      }
                    </p>
                  </div>
                </div>
              ) : viewMode === "table" ? (
                <div className="bg-gradient-to-br from-slate-800/40 to-slate-900/40 backdrop-blur-sm border border-slate-600/30 rounded-2xl overflow-hidden">
                  <div className="overflow-x-auto">
                    <table className="w-full table-auto min-w-[720px] text-gray-100">
                      <thead>
                        <tr className="bg-slate-900/70 border-b border-slate-600/30">
                          {[
                            { key: "Emp ID", icon: <UserCheck className="h-4 w-4" /> },
                            { key: "Name", icon: <Users className="h-4 w-4" /> },
                            { key: "Punch In", icon: <Clock className="h-4 w-4" /> },
                            { key: "Punch Out", icon: <Timer className="h-4 w-4" /> },
                            { key: "Break Status", icon: <Coffee className="h-4 w-4" /> },
                            { key: "Break Type", icon: <FileText className="h-4 w-4" /> },
                            { key: "Break (min)", icon: <Timer className="h-4 w-4" /> },
                            { key: "Work Hours", icon: <Activity className="h-4 w-4" /> },
                            { key: "Working?", icon: <CheckCircle className="h-4 w-4" /> },
                          ].map(({ key, icon }) => (
                            <th
                              key={key}
                              className="py-4 px-6 text-left text-sm font-semibold tracking-wide text-gray-300"
                            >
                              <div className="flex items-center gap-2">
                                {icon}
                                <span>{key}</span>
                              </div>
                            </th>
                          ))}
                        </tr>
                      </thead>
                      <tbody>
                        {filteredEmployees.map((emp, idx) => (
                          <EmployeeRow key={emp.userId || idx} employee={emp} />
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              ) : (
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                  {filteredEmployees.map((emp, idx) => (
                    <EmployeeCard key={emp.userId || idx} employee={emp} />
                  ))}
                </div>
              )}
            </>
          )}
        </div>

        {/* Enhanced Stats Dashboard */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mt-8">
          <StatCard
            icon={<Users className="h-6 w-6" />}
            label="Total Employees"
            value={stats.total}
            subValue="Registered"
            bg="from-blue-500/20 to-cyan-500/20"
            iconBg="from-blue-500 to-cyan-500"
            textColor="text-cyan-400"
            trend={null}
          />
          <StatCard
            icon={<Zap className="h-6 w-6" />}
            label="Currently Working"
            value={stats.working}
            subValue={`${((stats.working / stats.total) * 100 || 0).toFixed(1)}% active`}
            bg="from-emerald-500/20 to-green-500/20"
            iconBg="from-emerald-500 to-green-500"
            textColor="text-emerald-400"
            trend={{ value: "+5%", positive: true }}
          />
          <StatCard
            icon={<Coffee className="h-6 w-6" />}
            label="On Break"
            value={stats.onBreak}
            subValue="Taking break"
            bg="from-amber-500/20 to-orange-500/20"
            iconBg="from-amber-500 to-orange-500"
            textColor="text-amber-400"
            trend={null}
          />
          <StatCard
            icon={<TrendingUp className="h-6 w-6" />}
            label="Attendance Rate"
            value={`${stats.attendanceRate}%`}
            subValue={`${stats.present}/${stats.total} present`}
            bg="from-purple-500/20 to-pink-500/20"
            iconBg="from-purple-500 to-pink-500"
            textColor="text-purple-400"
            trend={{ value: "+2.3%", positive: true }}
          />
        </div>

        {/* Advanced Analytics Cards */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mt-8">
          <div className="bg-gradient-to-br from-slate-800/40 to-slate-900/40 backdrop-blur-sm border border-slate-600/30 rounded-2xl p-6">
            <h3 className="text-lg font-semibold text-white mb-4 flex items-center gap-2">
              <Activity className="h-5 w-5 text-cyan-400" />
              Work Distribution
            </h3>
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <span className="text-gray-300">Average Work Hours</span>
                <span className="text-white font-semibold">{stats.avgWorkHours.toFixed(1)}h</span>
              </div>
              <div className="w-full bg-slate-700/50 rounded-full h-2">
                <div
                  className="bg-gradient-to-r from-cyan-400 to-blue-500 h-2 rounded-full transition-all duration-300"
                  style={{ width: `${(stats.avgWorkHours / 9) * 100}%` }}
                ></div>
              </div>
              <div className="grid grid-cols-2 gap-4 mt-4">
                <div className="text-center">
                  <div className="text-2xl font-bold text-emerald-400">{stats.working}</div>
                  <div className="text-xs text-gray-400">Active Now</div>
                </div>
                <div className="text-center">
                  <div className="text-2xl font-bold text-amber-400">{stats.onBreak}</div>
                  <div className="text-xs text-gray-400">On Break</div>
                </div>
              </div>
            </div>
          </div>

          <div className="bg-gradient-to-br from-slate-800/40 to-slate-900/40 backdrop-blur-sm border border-slate-600/30 rounded-2xl p-6">
            <h3 className="text-lg font-semibold text-white mb-4 flex items-center gap-2">
              <Building2 className="h-5 w-5 text-purple-400" />
              Quick Actions
            </h3>
            <div className="grid grid-cols-2 gap-3">
              <button
                onClick={handleExportData}
                className="flex items-center gap-2 p-3 bg-slate-700/50 hover:bg-emerald-600/50 border border-slate-600/30 hover:border-emerald-500/50 rounded-xl transition-all duration-300 text-gray-300 hover:text-emerald-300 hover:scale-105"
                title="Export attendance data as JSON"
              >
                <Download className="h-4 w-4" />
                <span className="text-sm">Export</span>
              </button>
              <button
                onClick={handleManageEmployees}
                className="flex items-center gap-2 p-3 bg-slate-700/50 hover:bg-blue-600/50 border border-slate-600/30 hover:border-blue-500/50 rounded-xl transition-all duration-300 text-gray-300 hover:text-blue-300 hover:scale-105"
                title="Go to Employee Directory"
              >
                <Users className="h-4 w-4" />
                <span className="text-sm">Manage</span>
              </button>
              <button
                onClick={handleViewReports}
                className="flex items-center gap-2 p-3 bg-slate-700/50 hover:bg-purple-600/50 border border-slate-600/30 hover:border-purple-500/50 rounded-xl transition-all duration-300 text-gray-300 hover:text-purple-300 hover:scale-105"
                title="View detailed attendance reports"
              >
                <FileText className="h-4 w-4" />
                <span className="text-sm">Reports</span>
              </button>
              <button
                onClick={handleViewAlerts}
                className="flex items-center gap-2 p-3 bg-slate-700/50 hover:bg-amber-600/50 border border-slate-600/30 hover:border-amber-500/50 rounded-xl transition-all duration-300 text-gray-300 hover:text-amber-300 hover:scale-105"
                title="View current alerts and notifications"
              >
                <AlertCircle className="h-4 w-4" />
                <span className="text-sm">Alerts</span>
              </button>
            </div>
          </div>
        </div>

        {/* Global Celebration Popup */}
        <CelebrationPopup
          celebrations={celebrations}
          isOpen={showCelebrationPopup}
          onClose={closeCelebrationPopup}
        />
      </main>
      </div>
    </>
  );
};

const StatCard = ({ icon, label, value, subValue, bg, iconBg, textColor, trend }) => (
  <div className={`bg-gradient-to-br ${bg} backdrop-blur-sm border border-slate-600/30 rounded-2xl p-6 relative overflow-hidden group hover:scale-105 transition-all duration-300`}>
    <div className="absolute inset-0 bg-gradient-to-br from-white/5 to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-300"></div>
    <div className="relative z-10">
      <div className="flex items-center justify-between mb-4">
        <div className={`w-12 h-12 rounded-xl bg-gradient-to-br ${iconBg} flex items-center justify-center text-white shadow-lg`}>
          {icon}
        </div>
        {trend && (
          <div className={`flex items-center gap-1 text-xs font-medium ${trend.positive ? 'text-emerald-400' : 'text-red-400'}`}>
            <TrendingUp className={`h-3 w-3 ${trend.positive ? '' : 'rotate-180'}`} />
            {trend.value}
          </div>
        )}
      </div>
      <div>
        <p className="text-gray-400 text-sm font-medium mb-1">{label}</p>
        <p className="text-white font-bold text-3xl mb-1">{value}</p>
        {subValue && <p className="text-gray-400 text-xs">{subValue}</p>}
      </div>
    </div>
  </div>
);

const EmployeeCard = ({ employee }) => {
  const getStatusColor = (emp) => {
    if (emp.currentlyWorking && !emp.onBreak) return 'from-emerald-500/20 to-green-500/20 border-emerald-500/30'; // Working - Green
    if (emp.onBreak) return 'from-amber-500/20 to-orange-500/20 border-amber-500/30'; // On Break - Yellow
    if (emp.punchOutTime) return 'from-purple-500/20 to-violet-500/20 border-purple-500/30'; // Punched out - Violet
    return 'from-gray-500/20 to-slate-500/20 border-gray-500/30'; // Rest - Normal
  };

  const getStatusText = (emp) => {
    if (emp.currentlyWorking && !emp.onBreak) return 'Working';
    if (emp.onBreak) return `On ${emp.breakType || 'Break'}`;
    if (emp.punchOutTime) return 'Punched Out';
    return 'Offline';
  };

  const getStatusIcon = (emp) => {
    if (emp.currentlyWorking && !emp.onBreak) return <Zap className="h-4 w-4 text-emerald-400" />;
    if (emp.onBreak) return <Coffee className="h-4 w-4 text-amber-400" />;
    if (emp.punchOutTime) return <CheckCircle className="h-4 w-4 text-purple-400" />;
    return <AlertCircle className="h-4 w-4 text-gray-400" />;
  };

  return (
    <div className={`bg-gradient-to-br ${getStatusColor(employee)} backdrop-blur-sm border rounded-2xl p-6 hover:scale-105 transition-all duration-300`}>
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-3">
          <div className="w-12 h-12 bg-gradient-to-br from-slate-600 to-slate-700 rounded-full flex items-center justify-center text-white font-semibold">
            {employee.name?.charAt(0)?.toUpperCase() || '?'}
          </div>
          <div>
            <h3 className="font-semibold text-white text-lg">{employee.name || 'Unknown'}</h3>
            <p className="text-gray-400 text-sm">{employee.employeeId}</p>
          </div>
        </div>
        <div className="flex items-center gap-1">
          {getStatusIcon(employee)}
          <span className="text-sm font-medium text-gray-300">{getStatusText(employee)}</span>
        </div>
      </div>

      <div className="space-y-3">
        <div className="flex items-center justify-between">
          <span className="text-gray-400 text-sm">Punch In</span>
          <span className="text-white font-medium">
            {employee.arrivalTime ? new Date(employee.arrivalTime).toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' }) : '--:--'}
          </span>
        </div>
        <div className="flex items-center justify-between">
          <span className="text-gray-400 text-sm">Punch Out</span>
          <span className="text-white font-medium">
            {employee.departureTime ? new Date(employee.departureTime).toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' }) : '--:--'}
          </span>
        </div>
        <div className="flex items-center justify-between">
          <span className="text-gray-400 text-sm">Work Hours</span>
          <span className="text-white font-medium">
            {employee.totalWorkHours ? `${Math.floor(employee.totalWorkHours)}h ${Math.round((employee.totalWorkHours % 1) * 60)}m` : '0h 0m'}
          </span>
        </div>
        {employee.onBreak && (
          <div className="flex items-center justify-between">
            <span className="text-gray-400 text-sm">Break Duration</span>
            <span className="text-amber-400 font-medium">
              {(() => {
                const breakMinutes = attendanceUtils.calculateBreakMinutes(employee, employee.onBreak);
                // Debug logging for break calculation
                if (employee.onBreak) {
                  console.log(`Break calculation for ${employee.name}:`, {
                    breakMinutes,
                    onBreak: employee.onBreak,
                    timeline: employee.timeline,
                    breakStartTime: employee.breakStartTime,
                    breakDurationSeconds: employee.breakDurationSeconds,
                    totalBreakMinutes: employee.totalBreakMinutes
                  });
                }
                return breakMinutes;
              })()}m
            </span>
          </div>
        )}
      </div>
    </div>
  );
};

export default SuperAdminDashboard;
