import React, { useEffect, useMemo, useState } from "react";
import axios from "axios";
import { toast, ToastContainer } from "react-toastify";
import "react-toastify/dist/ReactToastify.css";
import Sidebar from "../dashboard/Sidebar";
import newAttendanceService from "../../services/newAttendanceService";
import { useTheme } from "../../contexts/ThemeContext";
import { 
  Clock, 
  Users, 
  Plus, 
  Trash2, 
  UserPlus, 
  Calendar,
  Filter,
  Search,
  Zap,
  ChevronDown,
  AlertCircle,
  CheckCircle,
  Building2,
  Timer,
  Activity,
  RefreshCw,
  Database,
  Sparkles
} from "lucide-react";

const API_BASE = import.meta.env.VITE_API_BASE || "http://localhost:5000";

// Feature flag for new attendance system integration
const USE_NEW_ATTENDANCE_SYSTEM = import.meta.env.VITE_USE_NEW_ATTENDANCE === 'true' || true;

const ShiftManagement = ({ onLogout }) => {
  const { theme } = useTheme();
  const [shifts, setShifts] = useState([]);
  const [employees, setEmployees] = useState([]);
  const [loading, setLoading] = useState(true);
  const [collapsed, setCollapsed] = useState(false);
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [showAssignModal, setShowAssignModal] = useState(false);
  const [selectedEmployee, setSelectedEmployee] = useState(null);
  const [selectedShift, setSelectedShift] = useState(null);
  const [selectedShiftType, setSelectedShiftType] = useState("standard");
  const [searchTerm, setSearchTerm] = useState("");
  const [filterType, setFilterType] = useState("all");
  const [newShift, setNewShift] = useState({
    name: "",
    start: "",
    end: "",
    description: ""
  });
  const [attendanceSync, setAttendanceSync] = useState({
    syncing: false,
    lastSync: null,
    errors: []
  });
  const [shiftValidation, setShiftValidation] = useState({
    validating: false,
    results: null
  });

  const token = localStorage.getItem("token");
  const axiosConfig = useMemo(
    () => ({ headers: { Authorization: `Bearer ${token}` } }),
    [token]
  );

  // Calculate statistics
  const totalEmployees = employees.length;
  const assignedEmployees = employees.filter(emp => emp.shift || emp.shiftType === 'flexiblePermanent').length;
  const unassignedEmployees = totalEmployees - assignedEmployees;
  const flexibleEmployees = employees.filter(emp => emp.shiftType === 'flexiblePermanent').length;

  // Filter employees based on search and filter
  const filteredEmployees = employees.filter(employee => {
    const matchesSearch = employee.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
                         (employee.department && employee.department.toLowerCase().includes(searchTerm.toLowerCase()));
    
    if (filterType === "all") return matchesSearch;
    if (filterType === "assigned") return matchesSearch && (employee.shift || employee.shiftType === 'flexiblePermanent');
    if (filterType === "unassigned") return matchesSearch && !employee.shift && employee.shiftType !== 'flexiblePermanent';
    if (filterType === "flexible") return matchesSearch && employee.shiftType === 'flexiblePermanent';
    
    return matchesSearch;
  });

  // Redirect if no token
  useEffect(() => {
    if (!token) {
      window.location.href = "/login";
      return;
    }
  }, [token]);

  useEffect(() => {
    if (!token) return;

    const fetchData = async () => {
      try {
        setLoading(true);
        const [shiftsRes, employeesRes] = await Promise.all([
          axios.get(`${API_BASE}/api/shifts`, axiosConfig),
          axios.get(`${API_BASE}/api/users`, axiosConfig)
        ]);
        
        console.log("Shifts data:", shiftsRes.data);
        console.log("Employees data:", employeesRes.data);
        setShifts(shiftsRes.data);
        // Include employees, admins, and HR users for shift assignment
        setEmployees(employeesRes.data.filter(user => ["employee", "admin", "hr", "super-admin"].includes(user.role)));
      } catch (err) {
        console.error("Failed to fetch data:", err);
        toast.error("Failed to load data");
      } finally {
        setLoading(false);
      }
    };

    fetchData();
  }, [token, axiosConfig]);

  const fetchShifts = async () => {
    try {
      const res = await axios.get(`${API_BASE}/api/shifts`, axiosConfig);
      setShifts(res.data);
    } catch (err) {
      console.error("Failed to fetch shifts:", err);
      toast.error("Failed to load shifts");
    }
  };

  const fetchEmployees = async () => {
    try {
      const res = await axios.get(`${API_BASE}/api/users`, axiosConfig);
      // Include employees, admins, and HR users for shift assignment
      setEmployees(res.data.filter(user => ["employee", "admin", "hr", "super-admin"].includes(user.role)));
    } catch (err) {
      console.error("Failed to fetch employees:", err);
      toast.error("Failed to load employees");
    }
  };

  const handleCreateShift = async (e) => {
    e.preventDefault();
    try {
      await axios.post(`${API_BASE}/api/shifts`, newShift, axiosConfig);
      toast.success("Shift created successfully");

      // Sync with new attendance system
      if (USE_NEW_ATTENDANCE_SYSTEM) {
        try {
          console.log("🔄 Syncing new shift creation with attendance system...");
          await syncWithAttendanceSystem();
        } catch (syncError) {
          console.warn("Failed to sync with attendance system:", syncError);
          toast.warning("Shift created but sync with attendance system failed");
        }
      }

      setShowCreateModal(false);
      setNewShift({ name: "", start: "", end: "", description: "" });
      fetchShifts();
    } catch (err) {
      console.error("Failed to create shift:", err);
      toast.error(err.response?.data?.message || "Failed to create shift");
    }
  };

  const handleAssignShift = async () => {
    if (!selectedEmployee) {
      toast.error("Please select an employee");
      return;
    }

    if (selectedShiftType === "flexiblePermanent") {
      try {
        await axios.put(
          `${API_BASE}/api/shifts/assign/${selectedEmployee._id}`,
          { shiftType: "flexiblePermanent" },
          axiosConfig
        );
        toast.success("Flexible permanent shift assigned successfully");

        // Sync with new attendance system
        if (USE_NEW_ATTENDANCE_SYSTEM) {
          try {
            console.log("🔄 Syncing flexible shift assignment with attendance system...");
            await syncWithAttendanceSystem();
          } catch (syncError) {
            console.warn("Failed to sync with attendance system:", syncError);
            toast.warning("Shift assigned but sync with attendance system failed");
          }
        }

        setShowAssignModal(false);
        setSelectedEmployee(null);
        setSelectedShift(null);
        setSelectedShiftType("standard");
        fetchEmployees();
      } catch (err) {
        console.error("Failed to assign flexible shift:", err);
        toast.error(err.response?.data?.message || "Failed to assign flexible shift");
      }
      return;
    }

    if (!selectedShift) {
      toast.error("Please select a shift for standard shift type");
      return;
    }

    try {
      await axios.put(
        `${API_BASE}/api/shifts/assign/${selectedEmployee._id}`,
        { shiftId: selectedShift._id, shiftType: "standard" },
        axiosConfig
      );
      toast.success("Standard shift assigned successfully");

      // Sync with new attendance system
      if (USE_NEW_ATTENDANCE_SYSTEM) {
        try {
          console.log("🔄 Syncing standard shift assignment with attendance system...");
          await syncWithAttendanceSystem();
        } catch (syncError) {
          console.warn("Failed to sync with attendance system:", syncError);
          toast.warning("Shift assigned but sync with attendance system failed");
        }
      }

      setShowAssignModal(false);
      setSelectedEmployee(null);
      setSelectedShift(null);
      setSelectedShiftType("standard");
      fetchEmployees();
    } catch (err) {
      console.error("Failed to assign shift:", err);
      toast.error(err.response?.data?.message || "Failed to assign shift");
    }
  };

  const handleDeleteShift = async (shiftId) => {
    if (!window.confirm("Are you sure you want to delete this shift?")) return;

    try {
      await axios.delete(`${API_BASE}/api/shifts/${shiftId}`, axiosConfig);
      toast.success("Shift deleted successfully");
      fetchShifts();
    } catch (err) {
      console.error("Failed to delete shift:", err);
      toast.error(err.response?.data?.message || "Failed to delete shift");
    }
  };

  const initializeDefaultShifts = async () => {
    if (!window.confirm("This will create 3 default shifts (Morning, Evening, Night). Continue?")) return;

    try {
      setLoading(true);
      const response = await axios.post(`${API_BASE}/api/shifts/initialize`, {}, axiosConfig);
      console.log("Initialize response:", response.data);
      toast.success("Default shifts initialized successfully");
      const shiftsRes = await axios.get(`${API_BASE}/api/shifts`, axiosConfig);
      setShifts(shiftsRes.data);
    } catch (err) {
      console.error("Failed to initialize shifts:", err);
      const errorMessage = err.response?.data?.message || "Failed to initialize shifts";
      console.error("Error details:", errorMessage);
      
      if (err.response?.status === 400 && errorMessage.includes("already exist")) {
        if (window.confirm(`${errorMessage}\n\nWould you like to clear all existing shifts and create new ones?`)) {
          await clearAllShifts();
        }
      } else {
        toast.error(errorMessage);
      }
    } finally {
      setLoading(false);
    }
  };

  const fixExistingShifts = async () => {
    try {
      setLoading(true);
      const response = await axios.post(`${API_BASE}/api/shifts/fix`, {}, axiosConfig);
      console.log("Fix response:", response.data);
      toast.success(`Fixed ${response.data.count} shifts successfully`);
      
      const shiftsRes = await axios.get(`${API_BASE}/api/shifts`, axiosConfig);
      setShifts(shiftsRes.data);
    } catch (err) {
      console.error("Failed to fix shifts:", err);
      toast.error(err.response?.data?.message || "Failed to fix shifts");
    } finally {
      setLoading(false);
    }
  };

  const clearAllShifts = async () => {
    try {
      setLoading(true);

      for (const shift of shifts) {
        try {
          await axios.delete(`${API_BASE}/api/shifts/${shift._id}`, axiosConfig);
        } catch (err) {
          console.warn(`Could not delete shift ${shift.name}:`, err.response?.data?.message);
        }
      }

      toast.success("All shifts cleared. Now initializing default shifts...");

      const response = await axios.post(`${API_BASE}/api/shifts/initialize`, {}, axiosConfig);
      console.log("Initialize response:", response.data);
      toast.success("Default shifts initialized successfully");

      const shiftsRes = await axios.get(`${API_BASE}/api/shifts`, axiosConfig);
      setShifts(shiftsRes.data);

      // Sync with new attendance system if enabled
      if (USE_NEW_ATTENDANCE_SYSTEM) {
        await syncWithAttendanceSystem();
      }
    } catch (err) {
      console.error("Failed to clear and initialize shifts:", err);
      toast.error(err.response?.data?.message || "Failed to clear and initialize shifts");
    } finally {
      setLoading(false);
    }
  };

  // Sync shifts with new attendance system
  const syncWithAttendanceSystem = async () => {
    if (!USE_NEW_ATTENDANCE_SYSTEM) {
      toast.info("New attendance system is not enabled");
      return;
    }

    try {
      setAttendanceSync(prev => ({ ...prev, syncing: true, errors: [] }));

      // Get system health first
      const healthResponse = await newAttendanceService.getSystemHealth();
      if (!healthResponse || healthResponse.status !== 'healthy') {
        throw new Error('New attendance system is not available');
      }

      console.log("✅ New attendance system is healthy, syncing shifts...");

      // The sync happens automatically when shifts are created/updated
      // through the User model's shift assignment process
      toast.success("Shifts synchronized with new attendance system");

      setAttendanceSync(prev => ({
        ...prev,
        syncing: false,
        lastSync: new Date(),
        errors: []
      }));

    } catch (error) {
      console.error("Failed to sync with attendance system:", error);
      setAttendanceSync(prev => ({
        ...prev,
        syncing: false,
        errors: [error.message]
      }));
      toast.error("Failed to sync with new attendance system: " + error.message);
    }
  };

  // Validate shifts alignment with attendance records
  const validateShiftsAlignment = async () => {
    if (!USE_NEW_ATTENDANCE_SYSTEM) {
      toast.info("New attendance system is not enabled");
      return;
    }

    try {
      setShiftValidation(prev => ({ ...prev, validating: true }));

      // Check each employee's shift assignment
      const validationResults = {
        totalEmployees: employees.length,
        alignedEmployees: 0,
        misalignedEmployees: 0,
        issues: []
      };

      for (const employee of employees) {
        try {
          // Check if employee has shift assigned
          if (employee.shift || employee.shiftType === 'flexiblePermanent') {
            validationResults.alignedEmployees++;
          } else {
            validationResults.misalignedEmployees++;
            validationResults.issues.push({
              employeeId: employee._id,
              employeeName: employee.name,
              issue: 'No shift assigned'
            });
          }
        } catch (err) {
          validationResults.issues.push({
            employeeId: employee._id,
            employeeName: employee.name,
            issue: `Validation error: ${err.message}`
          });
        }
      }

      setShiftValidation(prev => ({
        ...prev,
        validating: false,
        results: validationResults
      }));

      if (validationResults.issues.length === 0) {
        toast.success(`All ${validationResults.totalEmployees} employees have valid shift assignments`);
      } else {
        toast.warning(`Found ${validationResults.issues.length} shift alignment issues`);
      }

    } catch (error) {
      console.error("Failed to validate shifts alignment:", error);
      setShiftValidation(prev => ({
        ...prev,
        validating: false,
        results: null
      }));
      toast.error("Failed to validate shifts alignment: " + error.message);
    }
  };

  if (loading) {
    return (
      <div className="flex min-h-[100dvh] items-center justify-center bg-slate-50 dark:bg-[#0b0d12]">
        <div className="flex flex-col items-center space-y-4">
          <div className="relative">
            <div className="h-14 w-14 animate-spin rounded-full border-4 border-blue-100 border-t-blue-600 dark:border-blue-400/15 dark:border-t-blue-400"></div>
            <Clock className="absolute inset-0 m-auto h-5 w-5 text-blue-600 dark:text-blue-300" />
          </div>
          <p className="text-sm font-medium text-slate-500 dark:text-slate-400">Loading shift data...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="super-shift-theme relative flex h-[100dvh] overflow-hidden bg-slate-50 text-slate-900 dark:bg-[#0b0d12] dark:text-slate-100">
      <Sidebar collapsed={collapsed} setCollapsed={setCollapsed} userRole="hr" onLogout={onLogout} />

      <main
        className={`h-[100dvh] min-w-0 flex-1 overflow-y-auto overflow-x-hidden px-3 py-4 transition-all duration-300 sm:px-5 lg:px-6 ${
          collapsed ? "app-offset app-offset-collapsed" : "app-offset"
        }`}
      >
        <div className="mx-auto max-w-[1500px] space-y-4 pb-8 sm:space-y-5">
        {/* Header Section */}
        <header className="flex flex-col gap-4 rounded-2xl border border-slate-200 bg-white px-5 py-5 shadow-sm dark:border-white/10 dark:bg-[#10131c] sm:px-6 lg:flex-row lg:items-center lg:justify-between">
          <div className="flex items-start gap-3">
            <div className="mt-0.5 flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-blue-50 text-blue-600 dark:bg-blue-400/10 dark:text-blue-300">
              <Clock className="h-5 w-5" />
            </div>
            <div>
              <p className="text-xs font-semibold uppercase tracking-wider text-slate-500 dark:text-slate-400">Workforce scheduling</p>
              <h1 className="mt-1 text-2xl font-semibold tracking-tight text-slate-950 dark:text-white">Shift management</h1>
              <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">Manage employee shifts, attendance alignment, and assignments.</p>
            </div>
          </div>
          <div className="flex flex-wrap gap-2">
            <button
              onClick={() => setShowCreateModal(true)}
              className="inline-flex h-10 items-center gap-2 rounded-lg bg-blue-600 px-4 text-sm font-semibold text-white transition hover:bg-blue-700"
            >
              <Plus className="w-4 h-4" />
              Create shift
            </button>
            <button
              onClick={() => {
                setShowAssignModal(true);
                setSelectedEmployee(null);
                setSelectedShift(null);
                setSelectedShiftType("standard");
              }}
              className="inline-flex h-10 items-center gap-2 rounded-lg border border-slate-200 bg-white px-4 text-sm font-semibold text-slate-700 transition hover:bg-slate-50 dark:border-white/10 dark:bg-white/[0.04] dark:text-slate-200 dark:hover:bg-white/[0.07]"
            >
              <UserPlus className="w-4 h-4" />
              Assign shift
            </button>
          </div>
        </header>

        {/* Attendance System Status */}
        {USE_NEW_ATTENDANCE_SYSTEM && (
          <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm dark:border-white/10 dark:bg-[#10131c]">
            <div className="mb-4 flex items-center justify-between">
              <h3 className="flex items-center gap-2 text-base font-semibold text-slate-950 dark:text-white">
                <Activity className="h-5 w-5 text-blue-600 dark:text-blue-300" />
                Attendance system integration
              </h3>
              <div className={`h-2.5 w-2.5 rounded-full ${USE_NEW_ATTENDANCE_SYSTEM ? 'bg-emerald-500' : 'bg-slate-400'}`}></div>
            </div>

            <div className="grid grid-cols-1 gap-3 text-sm sm:grid-cols-3">
              <div className="space-y-1">
                <p className="text-xs text-slate-500 dark:text-slate-400">System status</p>
                <p className="font-semibold text-slate-900 dark:text-white">
                  {USE_NEW_ATTENDANCE_SYSTEM ? 'Active' : 'Disabled'}
                </p>
              </div>

              <div className="space-y-1">
                <p className="text-xs text-slate-500 dark:text-slate-400">Last sync</p>
                <p className="font-semibold text-slate-900 dark:text-white">
                  {attendanceSync.lastSync ?
                    attendanceSync.lastSync.toLocaleString() :
                    'Never'
                  }
                </p>
              </div>

              <div className="space-y-1">
                <p className="text-xs text-slate-500 dark:text-slate-400">Validation status</p>
                <p className="font-semibold text-slate-900 dark:text-white">
                  {shiftValidation.results ?
                    `${shiftValidation.results.alignedEmployees}/${shiftValidation.results.totalEmployees} Aligned` :
                    'Not Validated'
                  }
                </p>
              </div>
            </div>

            <div className="mt-5 flex flex-wrap gap-2 border-t border-slate-200 pt-4 dark:border-white/10">
              <button onClick={syncWithAttendanceSystem} disabled={attendanceSync.syncing} className="inline-flex h-9 items-center gap-2 rounded-lg border border-slate-200 bg-white px-3 text-xs font-semibold text-slate-600 transition hover:bg-slate-50 disabled:opacity-50 dark:border-white/10 dark:bg-white/[0.04] dark:text-slate-300 dark:hover:bg-white/[0.07]">
                <Activity className={`h-4 w-4 ${attendanceSync.syncing ? 'animate-spin' : ''}`} />
                {attendanceSync.syncing ? 'Syncing...' : 'Sync attendance'}
              </button>
              <button onClick={validateShiftsAlignment} disabled={shiftValidation.validating} className="inline-flex h-9 items-center gap-2 rounded-lg border border-slate-200 bg-white px-3 text-xs font-semibold text-slate-600 transition hover:bg-slate-50 disabled:opacity-50 dark:border-white/10 dark:bg-white/[0.04] dark:text-slate-300 dark:hover:bg-white/[0.07]">
                <CheckCircle className={`h-4 w-4 ${shiftValidation.validating ? 'animate-spin' : ''}`} />
                {shiftValidation.validating ? 'Validating...' : 'Validate alignment'}
              </button>
              <button onClick={fixExistingShifts} className="inline-flex h-9 items-center gap-2 rounded-lg border border-slate-200 bg-white px-3 text-xs font-semibold text-slate-600 transition hover:bg-slate-50 dark:border-white/10 dark:bg-white/[0.04] dark:text-slate-300 dark:hover:bg-white/[0.07]">
                <RefreshCw className="h-4 w-4" /> Fix existing
              </button>
              <button onClick={initializeDefaultShifts} className="inline-flex h-9 items-center gap-2 rounded-lg border border-slate-200 bg-white px-3 text-xs font-semibold text-slate-600 transition hover:bg-slate-50 dark:border-white/10 dark:bg-white/[0.04] dark:text-slate-300 dark:hover:bg-white/[0.07]">
                <Database className="h-4 w-4" /> Initialize defaults
              </button>
              {shifts.length > 0 && (
                <button onClick={() => { if (window.confirm("This will delete ALL existing shifts. Are you sure?")) clearAllShifts(); }} className="ml-auto inline-flex h-9 items-center gap-2 rounded-lg border border-rose-200 bg-rose-50 px-3 text-xs font-semibold text-rose-700 transition hover:bg-rose-100 dark:border-rose-400/20 dark:bg-rose-400/10 dark:text-rose-300">
                  <Trash2 className="h-4 w-4" /> Clear all
                </button>
              )}
            </div>

            {shiftValidation.results?.issues?.length > 0 && (
              <div className="mt-4 p-3 bg-orange-500/10 border border-orange-500/20 rounded-xl">
                <p className="text-orange-400 font-medium text-sm mb-2">
                  Validation Issues ({shiftValidation.results.issues.length}):
                </p>
                <div className="space-y-1 max-h-32 overflow-y-auto">
                  {shiftValidation.results.issues.slice(0, 3).map((issue, index) => (
                    <p key={index} className="text-orange-300 text-xs">
                      • {issue.employeeName}: {issue.issue}
                    </p>
                  ))}
                  {shiftValidation.results.issues.length > 3 && (
                    <p className="text-orange-300 text-xs">
                      ... and {shiftValidation.results.issues.length - 3} more
                    </p>
                  )}
                </div>
              </div>
            )}

            {attendanceSync.errors?.length > 0 && (
              <div className="mt-4 p-3 bg-red-500/10 border border-red-500/20 rounded-xl">
                <p className="text-red-400 font-medium text-sm mb-2">Sync Errors:</p>
                <div className="space-y-1">
                  {attendanceSync.errors.map((error, index) => (
                    <p key={index} className="text-red-300 text-xs">• {error}</p>
                  ))}
                </div>
              </div>
            )}
          </section>
        )}

        {/* Statistics Cards */}
        <section className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4" aria-label="Shift summary">
          <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm dark:border-white/10 dark:bg-[#10131c]">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-slate-500 dark:text-slate-400">Total shifts</p>
                <p className="mt-1 text-3xl font-semibold text-slate-950 dark:text-white">{shifts.length}</p>
              </div>
              <div className="rounded-xl bg-blue-50 p-3 dark:bg-blue-400/10">
                <Clock className="h-5 w-5 text-blue-600 dark:text-blue-300" />
              </div>
            </div>
          </div>

          <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm dark:border-white/10 dark:bg-[#10131c]">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-slate-500 dark:text-slate-400">Assigned employees</p>
                <p className="mt-1 text-3xl font-semibold text-slate-950 dark:text-white">{assignedEmployees}</p>
              </div>
              <div className="rounded-xl bg-emerald-50 p-3 dark:bg-emerald-400/10">
                <CheckCircle className="h-5 w-5 text-emerald-600 dark:text-emerald-300" />
              </div>
            </div>
          </div>

          <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm dark:border-white/10 dark:bg-[#10131c]">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-slate-500 dark:text-slate-400">Unassigned</p>
                <p className="mt-1 text-3xl font-semibold text-slate-950 dark:text-white">{unassignedEmployees}</p>
              </div>
              <div className="rounded-xl bg-amber-50 p-3 dark:bg-amber-400/10">
                <AlertCircle className="h-5 w-5 text-amber-600 dark:text-amber-300" />
              </div>
            </div>
          </div>

          <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm dark:border-white/10 dark:bg-[#10131c]">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-slate-500 dark:text-slate-400">Flexible hours</p>
                <p className="mt-1 text-3xl font-semibold text-slate-950 dark:text-white">{flexibleEmployees}</p>
              </div>
              <div className="rounded-xl bg-violet-50 p-3 dark:bg-violet-400/10">
                <Zap className="h-5 w-5 text-violet-600 dark:text-violet-300" />
              </div>
            </div>
          </div>
        </section>

        {/* Shifts Section */}
        <section className="space-y-4">
          <div className="flex items-center justify-between">
            <h2 className="flex items-center gap-2 text-lg font-semibold text-slate-950 dark:text-white">
              <Calendar className="h-5 w-5 text-blue-600 dark:text-blue-300" />
              Shift schedules
            </h2>
            <span className="rounded-full bg-slate-100 px-2.5 py-1 text-xs font-medium text-slate-500 dark:bg-white/[0.05] dark:text-slate-400">{shifts.length} schedules</span>
          </div>

          <div className="grid grid-cols-1 gap-4 lg:grid-cols-2 2xl:grid-cols-3">
            {shifts.length === 0 ? (
              <div className="col-span-full bg-gradient-to-br from-slate-800/50 to-slate-900/50 backdrop-blur-sm border border-slate-600/30 rounded-2xl p-12 text-center">
                <div className="flex flex-col items-center space-y-6">
                  <div className="p-6 bg-gradient-to-br from-blue-600/20 to-purple-600/20 rounded-2xl">
                    <Clock className="w-12 h-12 text-blue-400" />
                  </div>
                  <div className="space-y-3">
                    <h3 className="text-2xl font-bold text-white">No Shifts Found</h3>
                    <p className="text-gray-400 max-w-md">
                      You need to initialize default shifts first.
                    </p>
                  </div>
                  <div className="flex gap-4">
                    <button
                      onClick={fixExistingShifts}
                      className="px-6 py-3 bg-gradient-to-r from-yellow-600 to-orange-600 hover:from-yellow-500 hover:to-orange-500 rounded-xl transition-all duration-300 flex items-center gap-2 shadow-lg hover:shadow-yellow-500/25"
                    >
                      <RefreshCw className="w-4 h-4" />
                      Fix Existing Shifts
                    </button>
                    <button
                      onClick={initializeDefaultShifts}
                      className="px-6 py-3 bg-gradient-to-r from-blue-600 to-purple-600 hover:from-blue-500 hover:to-purple-500 rounded-xl transition-all duration-300 flex items-center gap-2 shadow-lg hover:shadow-blue-500/25"
                    >
                      <Sparkles className="w-4 h-4" />
                      Initialize Default Shifts
                    </button>
                    {shifts.length > 0 && (
                      <button
                        onClick={() => {
                          if (window.confirm("This will delete ALL existing shifts. Are you sure?")) {
                            clearAllShifts();
                          }
                        }}
                        className="px-6 py-3 bg-gradient-to-r from-red-600 to-rose-600 hover:from-red-500 hover:to-rose-500 rounded-xl transition-all duration-300 flex items-center gap-2 shadow-lg hover:shadow-red-500/25"
                      >
                        <Trash2 className="w-4 h-4" />
                        Clear All Shifts
                      </button>
                    )}
                  </div>
                </div>
              </div>
            ) : (
              shifts.map((shift) => (
                <article key={shift._id} className="group rounded-2xl border border-slate-200 bg-white p-5 shadow-sm transition hover:border-blue-200 hover:shadow-md dark:border-white/10 dark:bg-[#10131c] dark:hover:border-blue-400/25">
                  <div className="mb-4 flex items-start justify-between">
                    <div className="flex items-center gap-3">
                      <div className={`p-2 rounded-xl ${shift.isFlexible ? 'bg-green-500/20' : 'bg-blue-500/20'}`}>
                        {shift.isFlexible ? 
                          <Zap className="w-5 h-5 text-green-400" /> : 
                          <Clock className="w-5 h-5 text-blue-400" />
                        }
                      </div>
                      <h3 className="text-base font-semibold text-slate-950 transition-colors group-hover:text-blue-700 dark:text-white dark:group-hover:text-blue-300">
                        {shift.name}
                      </h3>
                    </div>
                    <button
                      onClick={() => handleDeleteShift(shift._id)}
                      className="rounded-lg p-2 text-slate-400 transition hover:bg-rose-50 hover:text-rose-600 dark:hover:bg-rose-400/10 dark:hover:text-rose-300"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>

                  <div className="space-y-2">
                    <div className="flex items-center justify-between rounded-xl bg-slate-50 p-3 dark:bg-white/[0.035]">
                      <div className="flex items-center gap-2">
                        <Timer className="w-4 h-4 text-cyan-400" />
                        <span className="text-sm font-medium text-slate-500 dark:text-slate-400">Time</span>
                      </div>
                      <span className="text-sm font-semibold text-slate-900 dark:text-white">{shift.start} - {shift.end}</span>
                    </div>

                    <div className="flex items-center justify-between rounded-xl bg-slate-50 p-3 dark:bg-white/[0.035]">
                      <div className="flex items-center gap-2">
                        <Activity className="w-4 h-4 text-purple-400" />
                        <span className="text-sm font-medium text-slate-500 dark:text-slate-400">Duration</span>
                      </div>
                      <span className="text-sm font-semibold text-slate-900 dark:text-white">{shift.durationHours}h</span>
                    </div>

                    {shift.description && (
                      <div className="rounded-xl bg-slate-50 p-3 dark:bg-white/[0.035]">
                        <p className="text-xs font-medium text-slate-400">Description</p>
                        <p className="mt-1 text-sm text-slate-600 dark:text-slate-300">{shift.description}</p>
                      </div>
                    )}

                    <div className="flex items-center justify-between pt-2">
                      <span className="text-sm font-medium text-slate-500 dark:text-slate-400">Type</span>
                      <span className={`px-3 py-1 rounded-full text-xs font-medium ${
                        shift.isFlexible 
                          ? 'bg-green-500/20 text-green-400 border border-green-500/30' 
                          : 'bg-blue-500/20 text-blue-400 border border-blue-500/30'
                      }`}>
                        {shift.isFlexible ? 'Flexible' : 'Standard'}
                      </span>
                    </div>
                  </div>
                </article>
              ))
            )}
          </div>
        </section>

        {/* Employee Management Section */}
        <section className="space-y-4">
          <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
            <h2 className="flex items-center gap-2 text-lg font-semibold text-slate-950 dark:text-white">
              <Users className="h-5 w-5 text-blue-600 dark:text-blue-300" />
              Employee shift assignments
            </h2>
            <div className="flex flex-col gap-2 sm:flex-row">
              <div className="relative">
                <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
                <input
                  type="text"
                  placeholder="Search employees..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="h-10 w-full rounded-xl border border-slate-200 bg-white pl-10 pr-4 text-sm text-slate-900 outline-none placeholder:text-slate-400 focus:border-blue-500 focus:ring-2 focus:ring-blue-500/15 sm:w-64 dark:border-white/10 dark:bg-white/[0.035] dark:text-white"
                />
              </div>
              <select
                value={filterType}
                onChange={(e) => setFilterType(e.target.value)}
                className="h-10 rounded-xl border border-slate-200 bg-white px-3 text-sm text-slate-900 outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-500/15 dark:border-white/10 dark:bg-[#151923] dark:text-white"
              >
                <option value="all">All Employees</option>
                <option value="assigned">Assigned</option>
                <option value="unassigned">Unassigned</option>
                <option value="flexible">Flexible Hours</option>
              </select>
            </div>
          </div>

          <div className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm dark:border-white/10 dark:bg-[#10131c]">
            <div className="overflow-x-auto">
              <table className="w-full min-w-[760px]">
                <thead className="bg-slate-50 dark:bg-white/[0.025]">
                  <tr>
                    <th className="px-5 py-3 text-left text-xs font-semibold uppercase tracking-wide text-slate-500 dark:text-slate-400">Employee</th>
                    <th className="px-5 py-3 text-left text-xs font-semibold uppercase tracking-wide text-slate-500 dark:text-slate-400">Shift type</th>
                    <th className="px-5 py-3 text-left text-xs font-semibold uppercase tracking-wide text-slate-500 dark:text-slate-400">Shift details</th>
                    <th className="px-5 py-3 text-left text-xs font-semibold uppercase tracking-wide text-slate-500 dark:text-slate-400">Department</th>
                  </tr>
                </thead>
                <tbody>
                  {filteredEmployees.length === 0 ? (
                    <tr>
                      <td colSpan={4} className="px-6 py-12 text-center">
                        <div className="flex flex-col items-center space-y-3">
                          <Users className="w-12 h-12 text-gray-500" />
                          <p className="text-gray-400 text-lg">
                            {searchTerm || filterType !== "all" ? "No employees match your criteria" : "No employees found"}
                          </p>
                        </div>
                      </td>
                    </tr>
                  ) : (
                    filteredEmployees.map((employee, index) => (
                      <tr key={employee._id} className={`border-t border-slate-100 transition-colors hover:bg-slate-50 dark:border-white/[0.07] dark:hover:bg-white/[0.025] ${index % 2 === 0 ? 'bg-slate-50/40 dark:bg-white/[0.01]' : ''}`}>
                        <td className="px-6 py-4">
                          <div className="flex items-center gap-3">
                            <div className="w-10 h-10 bg-gradient-to-br from-cyan-500 to-blue-600 rounded-full flex items-center justify-center text-white font-bold">
                              {employee.name.charAt(0)}
                            </div>
                            <span className="font-semibold text-slate-900 dark:text-white">{employee.name}</span>
                          </div>
                        </td>
                        <td className="px-6 py-4">
                          <span className={`px-3 py-1 rounded-full text-xs font-medium ${
                            employee.shiftType === 'flexiblePermanent' 
                              ? 'bg-green-500/20 text-green-400 border border-green-500/30' 
                              : 'bg-blue-500/20 text-blue-400 border border-blue-500/30'
                          }`}>
                            {employee.shiftType === 'flexiblePermanent' ? 'Flexible Permanent' : 'Standard'}
                          </span>
                        </td>
                        <td className="px-6 py-4">
                          {employee.shift ? (
                            <div className="space-y-1">
                              <p className="font-medium text-slate-900 dark:text-white">{employee.shift.name}</p>
                              <p className="text-sm text-slate-500 dark:text-slate-400">
                                {employee.shift.start} - {employee.shift.end} ({employee.shift.durationHours}h)
                              </p>
                            </div>
                          ) : (
                            <span className="text-gray-500 italic">No shift assigned</span>
                          )}
                        </td>
                        <td className="px-6 py-4">
                          <div className="flex items-center gap-2">
                            <Building2 className="w-4 h-4 text-gray-400" />
                            <span className="text-slate-600 dark:text-slate-300">{employee.department || 'N/A'}</span>
                          </div>
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </section>
        </div>
      </main>

      {/* Create Shift Modal */}
      {showCreateModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/60 p-4 backdrop-blur-sm">
          <div className="w-full max-w-md overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-2xl dark:border-white/10 dark:bg-[#10131c]">
            <div className="flex items-center gap-3 border-b border-slate-200 px-6 py-5 dark:border-white/10">
              <div className="rounded-xl bg-blue-50 p-2 dark:bg-blue-400/10">
                <Plus className="h-5 w-5 text-blue-600 dark:text-blue-300" />
              </div>
              <h2 className="text-lg font-semibold text-slate-950 dark:text-white">Create new shift</h2>
            </div>
            
            <form onSubmit={handleCreateShift} className="space-y-4 p-6">
              <div>
                <label className="mb-2 block text-sm font-medium text-slate-700 dark:text-slate-200">Shift name</label>
                <input
                  type="text"
                  value={newShift.name}
                  onChange={(e) => setNewShift({ ...newShift, name: e.target.value })}
                  className="h-10 w-full rounded-xl border border-slate-200 bg-slate-50 px-3 text-sm text-slate-900 outline-none placeholder:text-slate-400 focus:border-blue-500 focus:ring-2 focus:ring-blue-500/15 dark:border-white/10 dark:bg-[#151923] dark:text-white"
                  placeholder="Enter shift name"
                  required
                />
              </div>
              
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="mb-2 block text-sm font-medium text-slate-700 dark:text-slate-200">Start time</label>
                  <input
                    type="time"
                    value={newShift.start}
                    onChange={(e) => setNewShift({ ...newShift, start: e.target.value })}
                    className="h-10 w-full rounded-xl border border-slate-200 bg-slate-50 px-3 text-sm text-slate-900 outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-500/15 dark:border-white/10 dark:bg-[#151923] dark:text-white"
                    required
                  />
                </div>
                <div>
                  <label className="mb-2 block text-sm font-medium text-slate-700 dark:text-slate-200">End time</label>
                  <input
                    type="time"
                    value={newShift.end}
                    onChange={(e) => setNewShift({ ...newShift, end: e.target.value })}
                    className="h-10 w-full rounded-xl border border-slate-200 bg-slate-50 px-3 text-sm text-slate-900 outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-500/15 dark:border-white/10 dark:bg-[#151923] dark:text-white"
                    required
                  />
                </div>
              </div>
              
              <div>
                <label className="mb-2 block text-sm font-medium text-slate-700 dark:text-slate-200">Description</label>
                <textarea
                  value={newShift.description}
                  onChange={(e) => setNewShift({ ...newShift, description: e.target.value })}
                  className="w-full resize-none rounded-xl border border-slate-200 bg-slate-50 px-3 py-2 text-sm text-slate-900 outline-none placeholder:text-slate-400 focus:border-blue-500 focus:ring-2 focus:ring-blue-500/15 dark:border-white/10 dark:bg-[#151923] dark:text-white"
                  rows={3}
                  placeholder="Brief description of the shift"
                />
              </div>
              
              <div className="flex justify-end gap-2 border-t border-slate-200 pt-4 dark:border-white/10">
                <button
                  type="button"
                  onClick={() => setShowCreateModal(false)}
                  className="h-10 rounded-lg border border-slate-200 px-4 text-sm font-semibold text-slate-600 transition hover:bg-slate-50 dark:border-white/10 dark:text-slate-300 dark:hover:bg-white/[0.05]"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="inline-flex h-10 items-center gap-2 rounded-lg bg-blue-600 px-4 text-sm font-semibold text-white transition hover:bg-blue-700"
                >
                  <Plus className="w-4 h-4" />
                  Create Shift
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Assign Shift Modal */}
      {showAssignModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/60 p-4 backdrop-blur-sm">
          <div className="w-full max-w-md overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-2xl dark:border-white/10 dark:bg-[#10131c]">
            <div className="flex items-center gap-3 border-b border-slate-200 px-6 py-5 dark:border-white/10">
              <div className="rounded-xl bg-blue-50 p-2 dark:bg-blue-400/10">
                <UserPlus className="h-5 w-5 text-blue-600 dark:text-blue-300" />
              </div>
              <h2 className="text-lg font-semibold text-slate-950 dark:text-white">Assign shift to employee</h2>
            </div>
            
            <div className="space-y-4 p-6">
              <div>
                <label className="mb-2 block text-sm font-medium text-slate-700 dark:text-slate-200">Employee</label>
                <select
                  value={selectedEmployee?._id || ""}
                  onChange={(e) => {
                    const emp = employees.find(emp => emp._id === e.target.value);
                    setSelectedEmployee(emp);
                  }}
                  className="h-10 w-full rounded-xl border border-slate-200 bg-slate-50 px-3 text-sm text-slate-900 outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-500/15 dark:border-white/10 dark:bg-[#151923] dark:text-white"
                >
                  <option value="">Choose an employee</option>
                  {employees.map((emp) => (
                    <option key={emp._id} value={emp._id}>
                      {emp.name} ({emp.shiftType || 'No shift'})
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="mb-2 block text-sm font-medium text-slate-700 dark:text-slate-200">Shift type</label>
                <select
                  value={selectedShiftType}
                  onChange={(e) => setSelectedShiftType(e.target.value)}
                  className="h-10 w-full rounded-xl border border-slate-200 bg-slate-50 px-3 text-sm text-slate-900 outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-500/15 dark:border-white/10 dark:bg-[#151923] dark:text-white"
                >
                  <option value="standard">Standard</option>
                  <option value="flexiblePermanent">Flexible Permanent</option>
                </select>
              </div>

              <div>
                <label className="mb-2 block text-sm font-medium text-slate-700 dark:text-slate-200">Shift</label>
                <select
                  value={selectedShift?._id || ""}
                  onChange={(e) => {
                    const shift = shifts.find(shift => shift._id === e.target.value);
                    setSelectedShift(shift);
                  }}
                  className="h-10 w-full rounded-xl border border-slate-200 bg-slate-50 px-3 text-sm text-slate-900 outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-500/15 disabled:cursor-not-allowed disabled:opacity-50 dark:border-white/10 dark:bg-[#151923] dark:text-white"
                  disabled={selectedShiftType === "flexiblePermanent" || shifts.length === 0}
                >
                  <option value="">
                    {shifts.length === 0 ? "No shifts available - Initialize shifts first" : 
                     selectedShiftType === "flexiblePermanent" ? "Flexible permanent doesn't require specific shift" : 
                     "Choose a shift"}
                  </option>
                  {shifts.map((shift) => (
                    <option key={shift._id} value={shift._id}>
                      {shift.name} ({shift.start} - {shift.end})
                    </option>
                  ))}
                </select>
              </div>

              {selectedShiftType === "flexiblePermanent" && (
                <div className="rounded-xl border border-emerald-200 bg-emerald-50 p-4 dark:border-emerald-400/20 dark:bg-emerald-400/10">
                  <div className="flex items-start gap-3">
                    <Zap className="w-5 h-5 text-green-400 mt-0.5 flex-shrink-0" />
                    <div>
                      <p className="font-medium text-emerald-700 dark:text-emerald-300">Flexible permanent schedule</p>
                      <p className="mt-1 text-sm text-emerald-700/75 dark:text-emerald-300/75">
                        Employee will have flexible working hours without fixed shift constraints.
                      </p>
                    </div>
                  </div>
                </div>
              )}

              <div className="flex justify-end gap-2 border-t border-slate-200 pt-4 dark:border-white/10">
                <button
                  onClick={() => setShowAssignModal(false)}
                  className="h-10 rounded-lg border border-slate-200 px-4 text-sm font-semibold text-slate-600 transition hover:bg-slate-50 dark:border-white/10 dark:text-slate-300 dark:hover:bg-white/[0.05]"
                >
                  Cancel
                </button>
                <button
                  onClick={handleAssignShift}
                  className="inline-flex h-10 items-center gap-2 rounded-lg bg-blue-600 px-4 text-sm font-semibold text-white transition hover:bg-blue-700"
                >
                  <UserPlus className="w-4 h-4" />
                  Assign Shift
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      <ToastContainer position="top-right" autoClose={3000} theme={theme} />
    </div>
  );
};

export default ShiftManagement;
