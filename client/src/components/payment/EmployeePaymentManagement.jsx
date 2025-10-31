import React, { useState, useEffect } from "react";
import {
  AlertCircle,
  IndianRupee,
  XCircle,
  CheckCircle,
  Clock,
  Search,
  Filter,
  RefreshCw,
} from "lucide-react";
import toast from "react-hot-toast";
import Sidebar from "../dashboard/Sidebar";
import ActivatePaymentModal from "./ActivatePaymentModal";
import PendingPaymentsModal from "./PendingPaymentsModal";

const API_URL = import.meta.env.VITE_API_URL || "http://localhost:5000";

const EmployeePaymentManagement = ({ onLogout }) => {
  const [employees, setEmployees] = useState([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState("");
  const [filterBy, setFilterBy] = useState("all"); // all, dueTasks, rejectedTasks, hasPayment
  const [selectedEmployee, setSelectedEmployee] = useState(null);
  const [showActivateModal, setShowActivateModal] = useState(false);
  const [showPendingPayments, setShowPendingPayments] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);

  useEffect(() => {
    fetchEmployees();
  }, []);

  const fetchEmployees = async () => {
    try {
      setLoading(true);
      const token = localStorage.getItem("token");

      const response = await fetch(`${API_URL}/api/payments/employees-stats`, {
        headers: {
          Authorization: `Bearer ${token}`,
        },
      });

      const data = await response.json();

      if (data.success) {
        setEmployees(data.data);
      } else {
        toast.error(data.message || "Failed to fetch employees");
      }
    } catch (error) {
      console.error("Error fetching employees:", error);
      toast.error("Failed to fetch employee data");
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  const handleRefresh = () => {
    setRefreshing(true);
    fetchEmployees();
  };

  const handleActivatePayment = (employee) => {
    setSelectedEmployee(employee);
    setShowActivateModal(true);
  };

  const handlePaymentActivated = () => {
    setShowActivateModal(false);
    toast.success("Payment QR code activated successfully");
    fetchEmployees();
  };

  // Filter employees
  const filteredEmployees = employees.filter((emp) => {
    const matchesSearch =
      emp.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
      emp.employeeId.toLowerCase().includes(searchTerm.toLowerCase()) ||
      emp.email.toLowerCase().includes(searchTerm.toLowerCase());

    if (!matchesSearch) return false;

    switch (filterBy) {
      case "dueTasks":
        return emp.taskStats.dueTasks > 0;
      case "rejectedTasks":
        return emp.taskStats.rejectedTasks > 0;
      case "hasPayment":
        return emp.hasActivePayment;
      default:
        return true;
    }
  });

  const getPerformanceColor = (dueTasks, rejectedTasks) => {
    const total = dueTasks + rejectedTasks;
    if (total === 0) return "bg-green-500/20 text-green-400 border border-green-500/30";
    if (total < 3) return "bg-yellow-500/20 text-yellow-400 border border-yellow-500/30";
    if (total < 5) return "bg-orange-500/20 text-orange-400 border border-orange-500/30";
    return "bg-red-500/20 text-red-400 border border-red-500/30";
  };

  const getPerformanceLabel = (dueTasks, rejectedTasks) => {
    const total = dueTasks + rejectedTasks;
    if (total === 0) return "Excellent";
    if (total < 3) return "Good";
    if (total < 5) return "Needs Attention";
    return "Critical";
  };

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
          userRole="super-admin"
          onLogout={onLogout}
        />

        {/* Main Content */}
        <main className={`relative z-10 flex-1 transition-all duration-300 ${sidebarCollapsed ? "ml-24" : "ml-72"} p-8`}>
          {loading ? (
            <div className="flex items-center justify-center min-h-screen">
              <div className="text-center">
                <div className="relative">
                  <div className="w-16 h-16 border-4 border-cyan-300/40 rounded-full"></div>
                  <div className="absolute top-0 left-0 w-16 h-16 border-4 border-cyan-600 border-t-transparent rounded-full animate-spin"></div>
                </div>
                <p className="mt-4 text-gray-300">Loading employee data...</p>
              </div>
            </div>
          ) : (
            <div className="max-w-7xl mx-auto">
        {/* Header */}
        <div className="mb-8">
          <h1 className="text-5xl font-bold mb-2">
            <span className="bg-gradient-to-r from-emerald-400 via-cyan-400 to-blue-400 bg-clip-text text-transparent">
              Employee Payment Management
            </span>
          </h1>
          <p className="text-xl text-gray-300">
            Monitor employee performance and manage payment QR codes
          </p>
        </div>

        {/* Action Bar */}
        <div className="bg-slate-700/30 backdrop-blur-sm border border-slate-600/30 rounded-xl shadow-lg p-6 mb-6">
          <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
            {/* Search */}
            <div className="relative flex-1 max-w-md">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 w-5 h-5" />
              <input
                type="text"
                placeholder="Search by name, ID, or email..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="w-full pl-10 pr-4 py-3 bg-slate-800/50 border border-slate-600/30 text-gray-200 placeholder-gray-500 rounded-xl focus:ring-2 focus:ring-cyan-500 focus:border-transparent transition-all"
              />
            </div>

            {/* Filter */}
            <div className="flex items-center gap-3">
              <Filter className="text-gray-400 w-5 h-5" />
              <select
                value={filterBy}
                onChange={(e) => setFilterBy(e.target.value)}
                className="px-4 py-3 bg-slate-800/50 border border-slate-600/30 text-gray-200 rounded-xl focus:ring-2 focus:ring-cyan-500 focus:border-transparent transition-all"
              >
                <option value="all">All Employees</option>
                <option value="dueTasks">Has Due Tasks</option>
                <option value="rejectedTasks">Has Rejections</option>
                <option value="hasPayment">Has Active Payment</option>
              </select>

              {/* Refresh Button */}
              <button
                onClick={handleRefresh}
                disabled={refreshing}
                className="p-3 text-gray-300 hover:bg-slate-600/50 rounded-xl transition-all disabled:opacity-50 border border-slate-600/30"
                title="Refresh data"
              >
                <RefreshCw
                  className={`w-5 h-5 ${refreshing ? "animate-spin" : ""}`}
                />
              </button>

              {/* Pending Payments Button */}
              <button
                onClick={() => setShowPendingPayments(true)}
                className="px-4 py-3 bg-gradient-to-r from-cyan-600 to-blue-600 hover:from-cyan-500 hover:to-blue-500 text-white rounded-xl transition-all flex items-center gap-2 shadow-lg shadow-cyan-500/20"
              >
                <Clock className="w-5 h-5" />
                Pending Payments
              </button>
            </div>
          </div>

          {/* Stats */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mt-6 pt-6 border-t border-slate-600/30">
            <div className="text-center">
              <p className="text-3xl font-bold text-gray-100">
                {employees.length}
              </p>
              <p className="text-sm text-gray-400 mt-1">Total Employees</p>
            </div>
            <div className="text-center">
              <p className="text-3xl font-bold text-red-400">
                {employees.filter((e) => e.taskStats.dueTasks > 0).length}
              </p>
              <p className="text-sm text-gray-400 mt-1">With Due Tasks</p>
            </div>
            <div className="text-center">
              <p className="text-3xl font-bold text-orange-400">
                {employees.filter((e) => e.taskStats.rejectedTasks > 0).length}
              </p>
              <p className="text-sm text-gray-400 mt-1">With Rejections</p>
            </div>
            <div className="text-center">
              <p className="text-3xl font-bold text-cyan-400">
                {employees.filter((e) => e.hasActivePayment).length}
              </p>
              <p className="text-sm text-gray-400 mt-1">Active Payments</p>
            </div>
          </div>
        </div>

        {/* Employee Table */}
        <div className="bg-slate-700/30 backdrop-blur-sm border border-slate-600/30 rounded-xl shadow-lg overflow-hidden">
          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-slate-600/30">
              <thead className="bg-slate-800/50">
                <tr>
                  <th className="px-6 py-4 text-left text-xs font-semibold text-gray-300 uppercase tracking-wider">
                    Employee
                  </th>
                  <th className="px-6 py-4 text-left text-xs font-semibold text-gray-300 uppercase tracking-wider">
                    Department
                  </th>
                  <th className="px-6 py-4 text-center text-xs font-semibold text-gray-300 uppercase tracking-wider">
                    Due Tasks
                  </th>
                  <th className="px-6 py-4 text-center text-xs font-semibold text-gray-300 uppercase tracking-wider">
                    Rejections
                  </th>
                  <th className="px-6 py-4 text-center text-xs font-semibold text-gray-300 uppercase tracking-wider">
                    Performance
                  </th>
                  <th className="px-6 py-4 text-center text-xs font-semibold text-gray-300 uppercase tracking-wider">
                    Status
                  </th>
                  <th className="px-6 py-4 text-center text-xs font-semibold text-gray-300 uppercase tracking-wider">
                    Action
                  </th>
                </tr>
              </thead>
              <tbody className="bg-slate-800/30 divide-y divide-slate-600/30">
                {filteredEmployees.length === 0 ? (
                  <tr>
                    <td colSpan="7" className="px-6 py-8 text-center">
                      <div className="flex flex-col items-center justify-center text-gray-400">
                        <Search className="w-12 h-12 mb-2 opacity-50" />
                        <p>No employees found</p>
                      </div>
                    </td>
                  </tr>
                ) : (
                  filteredEmployees.map((employee) => (
                    <tr
                      key={employee._id}
                      className="hover:bg-slate-700/50 transition-colors"
                    >
                      {/* Employee Info */}
                      <td className="px-6 py-4">
                        <div className="flex items-center">
                          <div className="flex-shrink-0 h-10 w-10">
                            <div className="h-10 w-10 rounded-full bg-gradient-to-br from-cyan-500/20 to-blue-500/20 border border-cyan-500/30 flex items-center justify-center">
                              <span className="text-cyan-400 font-semibold">
                                {employee.name.charAt(0).toUpperCase()}
                              </span>
                            </div>
                          </div>
                          <div className="ml-4">
                            <div className="text-sm font-medium text-gray-200">
                              {employee.name}
                            </div>
                            <div className="text-sm text-gray-400">
                              {employee.employeeId}
                            </div>
                          </div>
                        </div>
                      </td>

                      {/* Department */}
                      <td className="px-6 py-4">
                        <div className="text-sm text-gray-200 capitalize">
                          {employee.department?.replace(/([A-Z])/g, " $1").trim()}
                        </div>
                        <div className="text-sm text-gray-400">
                          {employee.designation}
                        </div>
                      </td>

                      {/* Due Tasks */}
                      <td className="px-6 py-4 text-center">
                        <span
                          className={`inline-flex items-center px-3 py-1 rounded-full text-sm font-medium ${
                            employee.taskStats.dueTasks > 0
                              ? "bg-red-500/20 text-red-400 border border-red-500/30"
                              : "bg-green-500/20 text-green-400 border border-green-500/30"
                          }`}
                        >
                          {employee.taskStats.dueTasks > 0 && (
                            <AlertCircle className="w-4 h-4 mr-1" />
                          )}
                          {employee.taskStats.dueTasks}
                        </span>
                      </td>

                      {/* Rejections */}
                      <td className="px-6 py-4 text-center">
                        <span
                          className={`inline-flex items-center px-3 py-1 rounded-full text-sm font-medium ${
                            employee.taskStats.rejectedTasks > 0
                              ? "bg-orange-500/20 text-orange-400 border border-orange-500/30"
                              : "bg-green-500/20 text-green-400 border border-green-500/30"
                          }`}
                        >
                          {employee.taskStats.rejectedTasks > 0 && (
                            <XCircle className="w-4 h-4 mr-1" />
                          )}
                          {employee.taskStats.rejectedTasks}
                        </span>
                      </td>

                      {/* Performance */}
                      <td className="px-6 py-4 text-center">
                        <span
                          className={`px-3 py-1 rounded-full text-xs font-semibold ${getPerformanceColor(
                            employee.taskStats.dueTasks,
                            employee.taskStats.rejectedTasks
                          )}`}
                        >
                          {getPerformanceLabel(
                            employee.taskStats.dueTasks,
                            employee.taskStats.rejectedTasks
                          )}
                        </span>
                      </td>

                      {/* Status */}
                      <td className="px-6 py-4 text-center">
                        {employee.hasActivePayment ? (
                          <span className="inline-flex items-center px-3 py-1 rounded-full text-xs font-medium bg-yellow-500/20 text-yellow-400 border border-yellow-500/30">
                            <Clock className="w-3 h-3 mr-1" />
                            Payment Pending
                          </span>
                        ) : (
                          <span className="inline-flex items-center px-3 py-1 rounded-full text-xs font-medium bg-gray-500/20 text-gray-400 border border-gray-500/30">
                            <CheckCircle className="w-3 h-3 mr-1" />
                            Normal
                          </span>
                        )}
                      </td>

                      {/* Action */}
                      <td className="px-6 py-4 text-center">
                        {employee.hasActivePayment ? (
                          <button
                            disabled
                            className="px-4 py-2 bg-gray-600/30 text-gray-500 rounded-xl cursor-not-allowed text-sm border border-gray-600/30"
                          >
                            QR Active
                          </button>
                        ) : (
                          <button
                            onClick={() => handleActivatePayment(employee)}
                            className="px-4 py-2 bg-gradient-to-r from-cyan-600 to-blue-600 hover:from-cyan-500 hover:to-blue-500 text-white rounded-xl transition-all text-sm flex items-center gap-2 mx-auto shadow-lg shadow-cyan-500/20"
                          >
                            <IndianRupee className="w-4 h-4" />
                            Activate QR
                          </button>
                        )}
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>
            </div>
          )}
        </main>

        {/* Activate Payment Modal */}
        {showActivateModal && (
          <ActivatePaymentModal
            employee={selectedEmployee}
            onClose={() => setShowActivateModal(false)}
            onSuccess={handlePaymentActivated}
          />
        )}

        {/* Pending Payments Modal */}
        {showPendingPayments && (
          <PendingPaymentsModal
            onClose={() => setShowPendingPayments(false)}
            onPaymentUpdated={fetchEmployees}
          />
        )}
      </div>
    </>
  );
};

export default EmployeePaymentManagement;
