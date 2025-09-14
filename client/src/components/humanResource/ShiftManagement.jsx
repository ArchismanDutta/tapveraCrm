import React, { useState, useEffect } from "react";
import axios from "axios";
import { toast, ToastContainer } from "react-toastify";
import "react-toastify/dist/ReactToastify.css";
import Sidebar from "../dashboard/Sidebar";
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

const ShiftManagement = ({ onLogout }) => {
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

  const SIDEBAR_WIDTH_EXPANDED = 288;
  const SIDEBAR_WIDTH_COLLAPSED = 80;

  const token = localStorage.getItem("token");
  const axiosConfig = { headers: { Authorization: `Bearer ${token}` } };

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
        setEmployees(employeesRes.data.filter(user => user.role === "employee"));
      } catch (err) {
        console.error("Failed to fetch data:", err);
        toast.error("Failed to load data");
      } finally {
        setLoading(false);
      }
    };

    fetchData();
  }, [token]);

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
      setEmployees(res.data.filter(user => user.role === "employee"));
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
    } catch (err) {
      console.error("Failed to clear and initialize shifts:", err);
      toast.error(err.response?.data?.message || "Failed to clear and initialize shifts");
    } finally {
      setLoading(false);
    }
  };

  if (loading) {
    return (
      <div className="bg-gradient-to-br from-slate-900 via-purple-900 to-slate-900 min-h-screen flex items-center justify-center">
        <div className="flex flex-col items-center space-y-4">
          <div className="relative">
            <div className="w-16 h-16 border-4 border-purple-200 border-t-purple-600 rounded-full animate-spin"></div>
            <Clock className="w-6 h-6 text-purple-400 absolute inset-0 m-auto" />
          </div>
          <p className="text-purple-200 text-lg font-medium">Loading shift data...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="bg-gradient-to-br from-slate-900 via-purple-900 to-slate-900 text-gray-100 min-h-screen flex">
      <Sidebar collapsed={collapsed} setCollapsed={setCollapsed} userRole="hr" onLogout={onLogout} />

      <main
        className="flex-1 p-8 space-y-8 overflow-auto transition-all duration-300"
        style={{ marginLeft: collapsed ? SIDEBAR_WIDTH_COLLAPSED : SIDEBAR_WIDTH_EXPANDED }}
      >
        {/* Header Section */}
        <div className="flex justify-between items-center">
          <div className="space-y-2">
            <h1 className="text-4xl font-bold bg-gradient-to-r from-purple-400 to-cyan-400 bg-clip-text text-transparent">
              Shift Management
            </h1>
            <p className="text-gray-400 text-lg">Manage employee shifts and schedules efficiently</p>
          </div>
          
          <div className="flex gap-3">
            <button
              onClick={fixExistingShifts}
              className="px-6 py-3 bg-gradient-to-r from-yellow-600 to-orange-600 hover:from-yellow-500 hover:to-orange-500 rounded-xl transition-all duration-300 flex items-center gap-2 shadow-lg hover:shadow-yellow-500/25 transform hover:scale-105"
            >
              <RefreshCw className="w-4 h-4" />
              Fix Existing Shifts
            </button>
            <button
              onClick={initializeDefaultShifts}
              className="px-6 py-3 bg-gradient-to-r from-blue-600 to-purple-600 hover:from-blue-500 hover:to-purple-500 rounded-xl transition-all duration-300 flex items-center gap-2 shadow-lg hover:shadow-blue-500/25 transform hover:scale-105"
            >
              <Database className="w-4 h-4" />
              Initialize Default Shifts
            </button>
            <button
              onClick={() => setShowCreateModal(true)}
              className="px-6 py-3 bg-gradient-to-r from-green-600 to-emerald-600 hover:from-green-500 hover:to-emerald-500 rounded-xl transition-all duration-300 flex items-center gap-2 shadow-lg hover:shadow-green-500/25 transform hover:scale-105"
            >
              <Plus className="w-4 h-4" />
              Create New Shift
            </button>
            <button
              onClick={() => {
                setShowAssignModal(true);
                setSelectedEmployee(null);
                setSelectedShift(null);
                setSelectedShiftType("standard");
              }}
              className="px-6 py-3 bg-gradient-to-r from-purple-600 to-pink-600 hover:from-purple-500 hover:to-pink-500 rounded-xl transition-all duration-300 flex items-center gap-2 shadow-lg hover:shadow-purple-500/25 transform hover:scale-105"
            >
              <UserPlus className="w-4 h-4" />
              Assign Shift
            </button>
            {shifts.length > 0 && (
              <button
                onClick={() => {
                  if (window.confirm("This will delete ALL existing shifts. Are you sure?")) {
                    clearAllShifts();
                  }
                }}
                className="px-6 py-3 bg-gradient-to-r from-red-600 to-rose-600 hover:from-red-500 hover:to-rose-500 rounded-xl transition-all duration-300 flex items-center gap-2 shadow-lg hover:shadow-red-500/25 transform hover:scale-105"
              >
                <Trash2 className="w-4 h-4" />
                Clear All Shifts
              </button>
            )}
          </div>
        </div>

        {/* Statistics Cards */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
          <div className="bg-gradient-to-br from-blue-600/20 to-blue-800/20 backdrop-blur-sm border border-blue-500/20 rounded-2xl p-6 hover:border-blue-400/40 transition-all duration-300">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-blue-200 text-sm font-medium">Total Shifts</p>
                <p className="text-3xl font-bold text-white mt-1">{shifts.length}</p>
              </div>
              <div className="p-3 bg-blue-500/20 rounded-xl">
                <Clock className="w-6 h-6 text-blue-400" />
              </div>
            </div>
          </div>

          <div className="bg-gradient-to-br from-green-600/20 to-green-800/20 backdrop-blur-sm border border-green-500/20 rounded-2xl p-6 hover:border-green-400/40 transition-all duration-300">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-green-200 text-sm font-medium">Assigned Employees</p>
                <p className="text-3xl font-bold text-white mt-1">{assignedEmployees}</p>
              </div>
              <div className="p-3 bg-green-500/20 rounded-xl">
                <CheckCircle className="w-6 h-6 text-green-400" />
              </div>
            </div>
          </div>

          <div className="bg-gradient-to-br from-orange-600/20 to-orange-800/20 backdrop-blur-sm border border-orange-500/20 rounded-2xl p-6 hover:border-orange-400/40 transition-all duration-300">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-orange-200 text-sm font-medium">Unassigned</p>
                <p className="text-3xl font-bold text-white mt-1">{unassignedEmployees}</p>
              </div>
              <div className="p-3 bg-orange-500/20 rounded-xl">
                <AlertCircle className="w-6 h-6 text-orange-400" />
              </div>
            </div>
          </div>

          <div className="bg-gradient-to-br from-purple-600/20 to-purple-800/20 backdrop-blur-sm border border-purple-500/20 rounded-2xl p-6 hover:border-purple-400/40 transition-all duration-300">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-purple-200 text-sm font-medium">Flexible Hours</p>
                <p className="text-3xl font-bold text-white mt-1">{flexibleEmployees}</p>
              </div>
              <div className="p-3 bg-purple-500/20 rounded-xl">
                <Zap className="w-6 h-6 text-purple-400" />
              </div>
            </div>
          </div>
        </div>

        {/* Shifts Section */}
        <div className="space-y-6">
          <div className="flex justify-between items-center">
            <h2 className="text-2xl font-semibold text-white flex items-center gap-3">
              <Calendar className="w-6 h-6 text-cyan-400" />
              Shift Schedules
            </h2>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
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
                <div key={shift._id} className="bg-gradient-to-br from-slate-800/50 to-slate-900/50 backdrop-blur-sm border border-slate-600/30 rounded-2xl p-6 hover:border-cyan-400/40 transition-all duration-300 group">
                  <div className="flex justify-between items-start mb-6">
                    <div className="flex items-center gap-3">
                      <div className={`p-2 rounded-xl ${shift.isFlexible ? 'bg-green-500/20' : 'bg-blue-500/20'}`}>
                        {shift.isFlexible ? 
                          <Zap className="w-5 h-5 text-green-400" /> : 
                          <Clock className="w-5 h-5 text-blue-400" />
                        }
                      </div>
                      <h3 className="text-xl font-bold text-white group-hover:text-cyan-400 transition-colors">
                        {shift.name}
                      </h3>
                    </div>
                    <button
                      onClick={() => handleDeleteShift(shift._id)}
                      className="p-2 text-gray-400 hover:text-red-400 hover:bg-red-500/20 rounded-xl transition-all duration-300"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>

                  <div className="space-y-4">
                    <div className="flex items-center justify-between p-3 bg-slate-700/30 rounded-xl">
                      <div className="flex items-center gap-2">
                        <Timer className="w-4 h-4 text-cyan-400" />
                        <span className="text-gray-300 font-medium">Time</span>
                      </div>
                      <span className="text-white font-bold">{shift.start} - {shift.end}</span>
                    </div>

                    <div className="flex items-center justify-between p-3 bg-slate-700/30 rounded-xl">
                      <div className="flex items-center gap-2">
                        <Activity className="w-4 h-4 text-purple-400" />
                        <span className="text-gray-300 font-medium">Duration</span>
                      </div>
                      <span className="text-white font-bold">{shift.durationHours}h</span>
                    </div>

                    {shift.description && (
                      <div className="p-3 bg-slate-700/30 rounded-xl">
                        <p className="text-gray-300 text-sm font-medium">Description:</p>
                        <p className="text-gray-300 text-sm mt-1">{shift.description}</p>
                      </div>
                    )}

                    <div className="flex justify-between items-center pt-2">
                      <span className="text-gray-300 font-medium">Type:</span>
                      <span className={`px-3 py-1 rounded-full text-xs font-medium ${
                        shift.isFlexible 
                          ? 'bg-green-500/20 text-green-400 border border-green-500/30' 
                          : 'bg-blue-500/20 text-blue-400 border border-blue-500/30'
                      }`}>
                        {shift.isFlexible ? 'Flexible' : 'Standard'}
                      </span>
                    </div>
                  </div>
                </div>
              ))
            )}
          </div>
        </div>

        {/* Employee Management Section */}
        <div className="space-y-6">
          <div className="flex justify-between items-center">
            <h2 className="text-2xl font-semibold text-white flex items-center gap-3">
              <Users className="w-6 h-6 text-cyan-400" />
              Employee Shift Assignments
            </h2>
            <div className="flex gap-4">
              <div className="relative">
                <Search className="w-4 h-4 text-gray-400 absolute left-3 top-1/2 transform -translate-y-1/2" />
                <input
                  type="text"
                  placeholder="Search employees..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="pl-10 pr-4 py-2 bg-slate-800/50 border border-slate-600/30 rounded-xl text-white placeholder-gray-400 focus:border-cyan-400/50 focus:outline-none transition-all duration-300"
                />
              </div>
              <select
                value={filterType}
                onChange={(e) => setFilterType(e.target.value)}
                className="px-4 py-2 bg-slate-800/50 border border-slate-600/30 rounded-xl text-white focus:border-cyan-400/50 focus:outline-none transition-all duration-300"
              >
                <option value="all">All Employees</option>
                <option value="assigned">Assigned</option>
                <option value="unassigned">Unassigned</option>
                <option value="flexible">Flexible Hours</option>
              </select>
            </div>
          </div>

          <div className="bg-gradient-to-br from-slate-800/50 to-slate-900/50 backdrop-blur-sm border border-slate-600/30 rounded-2xl overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead className="bg-slate-700/30">
                  <tr>
                    <th className="px-6 py-4 text-left text-gray-300 font-semibold">Employee</th>
                    <th className="px-6 py-4 text-left text-gray-300 font-semibold">Shift Type</th>
                    <th className="px-6 py-4 text-left text-gray-300 font-semibold">Shift Details</th>
                    <th className="px-6 py-4 text-left text-gray-300 font-semibold">Department</th>
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
                      <tr key={employee._id} className={`border-t border-slate-700/30 hover:bg-slate-700/20 transition-colors ${index % 2 === 0 ? 'bg-slate-800/20' : ''}`}>
                        <td className="px-6 py-4">
                          <div className="flex items-center gap-3">
                            <div className="w-10 h-10 bg-gradient-to-br from-cyan-500 to-blue-600 rounded-full flex items-center justify-center text-white font-bold">
                              {employee.name.charAt(0)}
                            </div>
                            <span className="text-white font-semibold">{employee.name}</span>
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
                              <p className="text-white font-medium">{employee.shift.name}</p>
                              <p className="text-gray-400 text-sm">
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
                            <span className="text-gray-300">{employee.department || 'N/A'}</span>
                          </div>
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      </main>

      {/* Create Shift Modal */}
      {showCreateModal && (
        <div className="fixed inset-0 bg-black/70 backdrop-blur-sm flex items-center justify-center z-50 p-4">
          <div className="bg-gradient-to-br from-slate-800 to-slate-900 border border-slate-600/30 rounded-2xl p-8 w-full max-w-md shadow-2xl">
            <div className="flex items-center gap-3 mb-6">
              <div className="p-2 bg-green-500/20 rounded-xl">
                <Plus className="w-5 h-5 text-green-400" />
              </div>
              <h2 className="text-2xl font-bold text-white">Create New Shift</h2>
            </div>
            
            <form onSubmit={handleCreateShift} className="space-y-6">
              <div>
                <label className="block text-gray-300 font-medium mb-2">Shift Name</label>
                <input
                  type="text"
                  value={newShift.name}
                  onChange={(e) => setNewShift({ ...newShift, name: e.target.value })}
                  className="w-full px-4 py-3 rounded-xl bg-slate-700/50 border border-slate-600/30 text-white placeholder-gray-400 focus:border-cyan-400/50 focus:outline-none transition-all duration-300"
                  placeholder="Enter shift name"
                  required
                />
              </div>
              
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-gray-300 font-medium mb-2">Start Time</label>
                  <input
                    type="time"
                    value={newShift.start}
                    onChange={(e) => setNewShift({ ...newShift, start: e.target.value })}
                    className="w-full px-4 py-3 rounded-xl bg-slate-700/50 border border-slate-600/30 text-white focus:border-cyan-400/50 focus:outline-none transition-all duration-300"
                    required
                  />
                </div>
                <div>
                  <label className="block text-gray-300 font-medium mb-2">End Time</label>
                  <input
                    type="time"
                    value={newShift.end}
                    onChange={(e) => setNewShift({ ...newShift, end: e.target.value })}
                    className="w-full px-4 py-3 rounded-xl bg-slate-700/50 border border-slate-600/30 text-white focus:border-cyan-400/50 focus:outline-none transition-all duration-300"
                    required
                  />
                </div>
              </div>
              
              <div>
                <label className="block text-gray-300 font-medium mb-2">Description</label>
                <textarea
                  value={newShift.description}
                  onChange={(e) => setNewShift({ ...newShift, description: e.target.value })}
                  className="w-full px-4 py-3 rounded-xl bg-slate-700/50 border border-slate-600/30 text-white placeholder-gray-400 focus:border-cyan-400/50 focus:outline-none transition-all duration-300 resize-none"
                  rows={3}
                  placeholder="Brief description of the shift"
                />
              </div>
              
              <div className="flex justify-end gap-4 pt-4">
                <button
                  type="button"
                  onClick={() => setShowCreateModal(false)}
                  className="px-6 py-3 bg-slate-700 hover:bg-slate-600 text-gray-300 rounded-xl transition-all duration-300"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-6 py-3 bg-gradient-to-r from-green-600 to-emerald-600 hover:from-green-500 hover:to-emerald-500 text-white rounded-xl transition-all duration-300 flex items-center gap-2 shadow-lg hover:shadow-green-500/25"
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
        <div className="fixed inset-0 bg-black/70 backdrop-blur-sm flex items-center justify-center z-50 p-4">
          <div className="bg-gradient-to-br from-slate-800 to-slate-900 border border-slate-600/30 rounded-2xl p-8 w-full max-w-md shadow-2xl">
            <div className="flex items-center gap-3 mb-6">
              <div className="p-2 bg-purple-500/20 rounded-xl">
                <UserPlus className="w-5 h-5 text-purple-400" />
              </div>
              <h2 className="text-2xl font-bold text-white">Assign Shift to Employee</h2>
            </div>
            
            <div className="space-y-6">
              <div>
                <label className="block text-gray-300 font-medium mb-2">Select Employee</label>
                <select
                  value={selectedEmployee?._id || ""}
                  onChange={(e) => {
                    const emp = employees.find(emp => emp._id === e.target.value);
                    setSelectedEmployee(emp);
                  }}
                  className="w-full px-4 py-3 rounded-xl bg-slate-700/50 border border-slate-600/30 text-white focus:border-cyan-400/50 focus:outline-none transition-all duration-300"
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
                <label className="block text-gray-300 font-medium mb-2">Select Shift Type</label>
                <select
                  value={selectedShiftType}
                  onChange={(e) => setSelectedShiftType(e.target.value)}
                  className="w-full px-4 py-3 rounded-xl bg-slate-700/50 border border-slate-600/30 text-white focus:border-cyan-400/50 focus:outline-none transition-all duration-300"
                >
                  <option value="standard">Standard</option>
                  <option value="flexiblePermanent">Flexible Permanent</option>
                </select>
              </div>

              <div>
                <label className="block text-gray-300 font-medium mb-2">Select Shift</label>
                <select
                  value={selectedShift?._id || ""}
                  onChange={(e) => {
                    const shift = shifts.find(shift => shift._id === e.target.value);
                    setSelectedShift(shift);
                  }}
                  className="w-full px-4 py-3 rounded-xl bg-slate-700/50 border border-slate-600/30 text-white focus:border-cyan-400/50 focus:outline-none transition-all duration-300 disabled:opacity-50 disabled:cursor-not-allowed"
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
                <div className="p-4 bg-green-500/10 border border-green-500/20 rounded-xl">
                  <div className="flex items-start gap-3">
                    <Zap className="w-5 h-5 text-green-400 mt-0.5 flex-shrink-0" />
                    <div>
                      <p className="text-green-400 font-medium">Flexible Permanent Schedule</p>
                      <p className="text-green-300/80 text-sm mt-1">
                        Employee will have flexible working hours without fixed shift constraints.
                      </p>
                    </div>
                  </div>
                </div>
              )}

              <div className="flex justify-end gap-4 pt-4">
                <button
                  onClick={() => setShowAssignModal(false)}
                  className="px-6 py-3 bg-slate-700 hover:bg-slate-600 text-gray-300 rounded-xl transition-all duration-300"
                >
                  Cancel
                </button>
                <button
                  onClick={handleAssignShift}
                  className="px-6 py-3 bg-gradient-to-r from-purple-600 to-pink-600 hover:from-purple-500 hover:to-pink-500 text-white rounded-xl transition-all duration-300 flex items-center gap-2 shadow-lg hover:shadow-purple-500/25"
                >
                  <UserPlus className="w-4 h-4" />
                  Assign Shift
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      <ToastContainer position="top-right" autoClose={3000} theme="dark" />
    </div>
  );
};

export default ShiftManagement;