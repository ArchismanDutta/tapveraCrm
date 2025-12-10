import React, { useState, useEffect } from "react";
import {
  FileText,
  Eye,
  Search,
  Filter,
  X,
  RefreshCw,
  Calendar,
  Users,
  Building,
  DollarSign,
  TrendingUp,
  AlertCircle
} from "lucide-react";
import { toast } from "react-toastify";
import Sidebar from "../../components/dashboard/Sidebar";
import PayslipModal from "../../components/payslip/PayslipModal";

const PayslipManagement = ({ onLogout }) => {
  const [collapsed, setCollapsed] = useState(false);
  const [payslips, setPayslips] = useState([]);
  const [loading, setLoading] = useState(false);
  const [selectedPayslip, setSelectedPayslip] = useState(null);
  const [showPayslipModal, setShowPayslipModal] = useState(false);
  const [filters, setFilters] = useState({
    search: "",
    month: "",
    department: ""
  });
  const [employees, setEmployees] = useState([]);

  const API_BASE = import.meta.env.VITE_API_BASE || "http://localhost:5000";

  useEffect(() => {
    fetchEmployees();
    fetchPayslips();
  }, []);

  useEffect(() => {
    if (filters.month || filters.search || filters.department) {
      fetchPayslips();
    }
  }, [filters]);

  const fetchEmployees = async () => {
    try {
      const token = localStorage.getItem("token");
      const response = await fetch(`${API_BASE}/api/users`, {
        headers: { Authorization: `Bearer ${token}` }
      });

      if (response.ok) {
        const data = await response.json();
        setEmployees(data.filter(user => user.role === "employee"));
      }
    } catch (error) {
      console.error("Error fetching employees:", error);
    }
  };

  const fetchPayslips = async () => {
    setLoading(true);
    try {
      const token = localStorage.getItem("token");
      const params = new URLSearchParams();
      if (filters.search) params.append("search", filters.search);
      if (filters.month) params.append("month", filters.month);
      if (filters.department) params.append("department", filters.department);
      params.append("limit", "100");

      const response = await fetch(`${API_BASE}/api/payslips/admin?${params}`, {
        headers: { Authorization: `Bearer ${token}` }
      });

      if (response.ok) {
        const data = await response.json();
        setPayslips(data);
      } else {
        toast.error("Failed to load payslips");
      }
    } catch (error) {
      console.error("Error fetching payslips:", error);
      toast.error("Failed to load payslips");
    } finally {
      setLoading(false);
    }
  };

  const handleViewPayslip = (payslip) => {
    setSelectedPayslip(payslip);
    setShowPayslipModal(true);
  };

  const formatCurrency = (amount) => {
    return new Intl.NumberFormat('en-IN', {
      style: 'currency',
      currency: 'INR',
      maximumFractionDigits: 0
    }).format(amount || 0);
  };

  const formatMonth = (payPeriod) => {
    const [year, month] = payPeriod.split('-');
    return new Date(year, month - 1).toLocaleDateString('en-IN', {
      month: 'long',
      year: 'numeric'
    });
  };

  // Get unique departments
  const departments = [...new Set(employees.map(emp => emp.department).filter(Boolean))];

  // Calculate statistics
  const stats = {
    totalPayslips: payslips.length,
    totalAmount: payslips.reduce((sum, p) => sum + (p.netPayment || 0), 0),
    averageSalary: payslips.length > 0 ? payslips.reduce((sum, p) => sum + (p.netPayment || 0), 0) / payslips.length : 0,
    uniqueEmployees: new Set(payslips.map(p => p.employee?._id || p.employee)).size
  };

  return (
    <div className="flex bg-gradient-to-br from-[#141a21] via-[#191f2b] to-[#101218] font-sans text-blue-100 min-h-screen">
      <Sidebar collapsed={collapsed} setCollapsed={setCollapsed} onLogout={onLogout} userRole="super-admin" />

      <main className={`flex-1 p-8 overflow-y-auto transition-all duration-300 ${collapsed ? "ml-20" : "ml-72"}`}>
        {/* Header */}
        <div className="flex justify-between items-start mb-8">
          <div>
            <h1 className="text-3xl font-bold text-white tracking-tight mb-2 flex items-center gap-3">
              <FileText className="w-8 h-8 text-blue-400" />
              Payslip Management
            </h1>
            <p className="text-blue-300">
              View and manage employee payslips
            </p>
          </div>

          <button
            onClick={fetchPayslips}
            disabled={loading}
            className="px-4 py-2 bg-blue-600/20 hover:bg-blue-600/40 text-blue-400 border border-blue-500/30 rounded-lg transition-colors flex items-center gap-2"
          >
            <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
            Refresh
          </button>
        </div>

        {/* Statistics Cards */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-6">
          <div className="bg-[#191f2b]/70 rounded-xl shadow-xl border border-[#232945] p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-gray-400 mb-1">Total Payslips</p>
                <p className="text-2xl font-bold text-white">{stats.totalPayslips}</p>
              </div>
              <div className="w-12 h-12 rounded-lg bg-blue-600/20 flex items-center justify-center">
                <FileText className="w-6 h-6 text-blue-400" />
              </div>
            </div>
          </div>

          <div className="bg-[#191f2b]/70 rounded-xl shadow-xl border border-[#232945] p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-gray-400 mb-1">Total Amount</p>
                <p className="text-2xl font-bold text-green-400">{formatCurrency(stats.totalAmount)}</p>
              </div>
              <div className="w-12 h-12 rounded-lg bg-green-600/20 flex items-center justify-center">
                <DollarSign className="w-6 h-6 text-green-400" />
              </div>
            </div>
          </div>

          <div className="bg-[#191f2b]/70 rounded-xl shadow-xl border border-[#232945] p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-gray-400 mb-1">Average Salary</p>
                <p className="text-2xl font-bold text-purple-400">{formatCurrency(stats.averageSalary)}</p>
              </div>
              <div className="w-12 h-12 rounded-lg bg-purple-600/20 flex items-center justify-center">
                <TrendingUp className="w-6 h-6 text-purple-400" />
              </div>
            </div>
          </div>

          <div className="bg-[#191f2b]/70 rounded-xl shadow-xl border border-[#232945] p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-gray-400 mb-1">Employees</p>
                <p className="text-2xl font-bold text-blue-400">{stats.uniqueEmployees}</p>
              </div>
              <div className="w-12 h-12 rounded-lg bg-blue-600/20 flex items-center justify-center">
                <Users className="w-6 h-6 text-blue-400" />
              </div>
            </div>
          </div>
        </div>

        {/* Filters */}
        <div className="bg-[#191f2b]/70 rounded-xl shadow-xl border border-[#232945] p-6 mb-6">
          <div className="flex flex-wrap items-center gap-4">
            <div className="relative flex-1 min-w-[250px]">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 w-4 h-4 text-gray-500" />
              <input
                type="text"
                placeholder="Search by employee name or ID..."
                value={filters.search}
                onChange={(e) => setFilters({ ...filters, search: e.target.value })}
                className="w-full pl-10 pr-4 py-2 bg-[#0f1419] border border-[#232945] rounded-lg text-white placeholder-gray-500 focus:outline-none focus:border-blue-500 transition-colors"
              />
            </div>

            <input
              type="month"
              value={filters.month}
              onChange={(e) => setFilters({ ...filters, month: e.target.value })}
              className="px-4 py-2 bg-[#0f1419] border border-[#232945] rounded-lg text-white focus:outline-none focus:border-blue-500 transition-colors"
            />

            <select
              value={filters.department}
              onChange={(e) => setFilters({ ...filters, department: e.target.value })}
              className="px-4 py-2 bg-[#0f1419] border border-[#232945] rounded-lg text-white focus:outline-none focus:border-blue-500 transition-colors"
            >
              <option value="">All Departments</option>
              {departments.map(dept => (
                <option key={dept} value={dept}>{dept}</option>
              ))}
            </select>

            {(filters.search || filters.month || filters.department) && (
              <button
                onClick={() => setFilters({ search: "", month: "", department: "" })}
                className="px-4 py-2 bg-gray-600/20 hover:bg-gray-600/40 text-gray-400 rounded-lg transition-colors flex items-center gap-2"
              >
                <X className="w-4 h-4" />
                Clear
              </button>
            )}
          </div>
        </div>

        {/* Payslips Table */}
        <div className="bg-[#191f2b]/70 rounded-xl shadow-xl border border-[#232945]">
          <div className="p-6">
            <h3 className="text-lg font-semibold text-white mb-4 flex items-center gap-2">
              <FileText className="w-5 h-5 text-blue-400" />
              Payslips ({payslips.length})
            </h3>

            {loading ? (
              <div className="flex items-center justify-center h-64">
                <div className="flex flex-col items-center gap-3">
                  <div className="w-12 h-12 border-4 border-blue-400 border-t-transparent rounded-full animate-spin"></div>
                  <p className="text-gray-400">Loading payslips...</p>
                </div>
              </div>
            ) : payslips.length === 0 ? (
              <div className="flex flex-col items-center justify-center h-64 text-center">
                <AlertCircle className="w-16 h-16 text-gray-600 mb-4" />
                <h3 className="text-xl font-semibold text-white mb-2">No Payslips Found</h3>
                <p className="text-gray-400">No payslips match your current filters.</p>
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full">
                  <thead>
                    <tr className="border-b-2 border-[#232945]">
                      <th className="text-left pl-6 pr-4 py-4 text-sm font-semibold text-gray-400">Employee</th>
                      <th className="text-left pl-6 pr-4 py-4 text-sm font-semibold text-gray-400">Department</th>
                      <th className="text-left pl-6 pr-4 py-4 text-sm font-semibold text-gray-400">Month</th>
                      <th className="text-left pl-6 pr-4 py-4 text-sm font-semibold text-gray-400">Paid Days</th>
                      <th className="text-left pl-6 pr-4 py-4 text-sm font-semibold text-gray-400">Gross</th>
                      <th className="text-left pl-6 pr-4 py-4 text-sm font-semibold text-gray-400">Deductions</th>
                      <th className="text-left pl-6 pr-4 py-4 text-sm font-semibold text-gray-400">Net Payment</th>
                      <th className="text-left pl-6 pr-4 py-4 text-sm font-semibold text-gray-400">Actions</th>
                    </tr>
                  </thead>
                  <tbody>
                    {payslips.map((payslip) => (
                      <tr key={payslip._id} className="border-b border-[#232945] hover:bg-[#0f1419] transition-colors">
                        <td className="pl-6 pr-4 py-5">
                          <div className="flex items-center gap-3">
                            <div className="w-10 h-10 rounded-full bg-gradient-to-br from-blue-500 to-purple-500 flex items-center justify-center text-white font-semibold">
                              {payslip.employee?.name?.charAt(0).toUpperCase() || 'U'}
                            </div>
                            <div>
                              <p className="text-white font-semibold">{payslip.employee?.name || 'Unknown'}</p>
                              <p className="text-sm text-gray-400">{payslip.employee?.employeeId || 'N/A'}</p>
                            </div>
                          </div>
                        </td>
                        <td className="pl-6 pr-4 py-5 text-gray-300">{payslip.employee?.department || 'N/A'}</td>
                        <td className="pl-6 pr-4 py-5">
                          <span className="inline-flex items-center gap-1 px-3 py-1 bg-blue-600/20 text-blue-400 rounded-full text-sm">
                            <Calendar className="w-3 h-3" />
                            {formatMonth(payslip.payPeriod)}
                          </span>
                        </td>
                        <td className="pl-6 pr-4 py-5">
                          <span className="text-white font-medium">{payslip.paidDays}/{payslip.workingDays}</span>
                        </td>
                        <td className="pl-6 pr-4 py-5 text-green-400 font-semibold">
                          {formatCurrency(payslip.grossTotal)}
                        </td>
                        <td className="pl-6 pr-4 py-5 text-red-400 font-semibold">
                          {formatCurrency(payslip.totalDeductions)}
                        </td>
                        <td className="pl-6 pr-4 py-5 text-white font-bold">
                          {formatCurrency(payslip.netPayment)}
                        </td>
                        <td className="pl-6 pr-4 py-5">
                          <button
                            onClick={() => handleViewPayslip(payslip)}
                            className="inline-flex items-center gap-1 px-3 py-1.5 rounded-lg text-blue-400 hover:text-blue-300 hover:bg-blue-500/10 transition-all text-sm"
                          >
                            <Eye className="w-3 h-3" />
                            View
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </div>

        {/* Payslip Modal */}
        {showPayslipModal && selectedPayslip && (
          <PayslipModal
            isOpen={showPayslipModal}
            onClose={() => {
              setShowPayslipModal(false);
              setSelectedPayslip(null);
            }}
            employeeId={selectedPayslip.employee?._id || selectedPayslip.employee}
          />
        )}
      </main>
    </div>
  );
};

export default PayslipManagement;
