import React, { useState, useEffect } from "react";
import {
  DollarSign,
  Users,
  Calculator,
  Plus,
  Edit,
  Eye,
  Search,
  Filter,
  Download,
  Save,
  X,
  TrendingUp,
  TrendingDown,
  CreditCard,
  FileText,
  Calendar,
  User,
  Building
} from "lucide-react";
import { toast } from "react-toastify";
import Sidebar from "../../components/dashboard/Sidebar";
import PayslipModal from "../../components/payslip/PayslipModal";

const SalaryManagement = ({ onLogout }) => {
  const [collapsed, setCollapsed] = useState(false);
  const [employees, setEmployees] = useState([]);
  const [salaryRecords, setSalaryRecords] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [showPayslipModal, setShowPayslipModal] = useState(false);
  const [selectedEmployee, setSelectedEmployee] = useState(null);
  const [formData, setFormData] = useState({
    employeeId: "",
    month: new Date().toISOString().slice(0, 7), // YYYY-MM format
    ctc: "",
    basicSalary: "",
    grossSalary: "",
    netSalary: "",
    deductions: {
      pf: "",
      esi: "",
      ptax: "",
      lateDeduction: "",
      other: ""
    },
    workingDays: "",
    presentDays: "",
    lateDays: "",
    remarks: ""
  });
  const [editingId, setEditingId] = useState(null);
  const [filters, setFilters] = useState({
    search: "",
    month: "",
    department: ""
  });

  const API_BASE = import.meta.env.VITE_API_BASE || "http://localhost:5000";

  useEffect(() => {
    fetchEmployees();
    fetchSalaryRecords();
  }, []);

  const fetchEmployees = async () => {
    try {
      const token = localStorage.getItem("token");
      const response = await fetch(`${API_BASE}/api/users`, {
        headers: { Authorization: `Bearer ${token}` }
      });

      if (response.ok) {
        const data = await response.json();
        setEmployees(data.filter(user => ["employee", "admin", "hr"].includes(user.role)));
      }
    } catch (error) {
      console.error("Error fetching employees:", error);
      toast.error("Failed to load employees");
    }
  };

  const fetchSalaryRecords = async () => {
    setLoading(true);
    try {
      const token = localStorage.getItem("token");
      const params = new URLSearchParams();
      if (filters.search) params.append("search", filters.search);
      if (filters.month) params.append("month", filters.month);
      if (filters.department) params.append("department", filters.department);

      const response = await fetch(`${API_BASE}/api/payslips/admin?${params}`, {
        headers: { Authorization: `Bearer ${token}` }
      });

      if (response.ok) {
        const data = await response.json();
        setSalaryRecords(data);
      }
    } catch (error) {
      console.error("Error fetching salary records:", error);
      toast.error("Failed to load salary records");
    } finally {
      setLoading(false);
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();

    try {
      const token = localStorage.getItem("token");
      const method = editingId ? "PUT" : "POST";
      const url = editingId
        ? `${API_BASE}/api/payslips/${editingId}`
        : `${API_BASE}/api/payslips`;

      const response = await fetch(url, {
        method,
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`
        },
        body: JSON.stringify(formData)
      });

      if (response.ok) {
        toast.success(editingId ? "Salary record updated successfully" : "Salary record created successfully");
        setShowForm(false);
        resetForm();
        fetchSalaryRecords();
      } else {
        const error = await response.json();
        toast.error(error.error || "Failed to save salary record");
      }
    } catch (error) {
      console.error("Error saving salary record:", error);
      toast.error("Error saving salary record");
    }
  };

  const handleDelete = async (id) => {
    if (!window.confirm("Are you sure you want to delete this salary record?")) {
      return;
    }

    try {
      const token = localStorage.getItem("token");
      const response = await fetch(`${API_BASE}/api/payslips/${id}`, {
        method: "DELETE",
        headers: { Authorization: `Bearer ${token}` }
      });

      if (response.ok) {
        toast.success("Salary record deleted successfully");
        fetchSalaryRecords();
      } else {
        toast.error("Failed to delete salary record");
      }
    } catch (error) {
      console.error("Error deleting salary record:", error);
      toast.error("Error deleting salary record");
    }
  };

  const handleEdit = (record) => {
    setFormData({
      employeeId: record.employee._id,
      month: record.payPeriod,
      ctc: record.ctc,
      basicSalary: record.basicSalary,
      grossSalary: record.grossSalary,
      netSalary: record.netSalary,
      deductions: record.deductions,
      workingDays: record.workingDays,
      presentDays: record.presentDays,
      lateDays: record.lateDays,
      remarks: record.remarks
    });
    setEditingId(record._id);
    setShowForm(true);
  };

  const handleViewPayslip = (employee) => {
    setSelectedEmployee(employee);
    setShowPayslipModal(true);
  };

  const resetForm = () => {
    setFormData({
      employeeId: "",
      month: new Date().toISOString().slice(0, 7),
      ctc: "",
      basicSalary: "",
      grossSalary: "",
      netSalary: "",
      deductions: {
        pf: "",
        esi: "",
        ptax: "",
        lateDeduction: "",
        other: ""
      },
      workingDays: "",
      presentDays: "",
      lateDays: "",
      remarks: ""
    });
    setEditingId(null);
  };

  const formatCurrency = (amount) => {
    return new Intl.NumberFormat('en-IN', {
      style: 'currency',
      currency: 'INR',
      minimumFractionDigits: 0,
      maximumFractionDigits: 0
    }).format(amount || 0);
  };

  const calculateTotalDeductions = () => {
    const { pf, esi, ptax, lateDeduction, other } = formData.deductions;
    return (parseFloat(pf || 0) + parseFloat(esi || 0) + parseFloat(ptax || 0) +
            parseFloat(lateDeduction || 0) + parseFloat(other || 0));
  };

  const calculateNetSalary = () => {
    const grossSalary = parseFloat(formData.grossSalary || 0);
    const totalDeductions = calculateTotalDeductions();
    return grossSalary - totalDeductions;
  };

  // Auto-calculate net salary when gross salary or deductions change
  useEffect(() => {
    const netSalary = calculateNetSalary();
    if (netSalary !== parseFloat(formData.netSalary)) {
      setFormData(prev => ({ ...prev, netSalary: netSalary.toString() }));
    }
  }, [formData.grossSalary, formData.deductions]);

  const userStr = localStorage.getItem("user");
  const userRole = userStr ? JSON.parse(userStr).role : "admin";

  return (
    <div className="flex bg-gradient-to-br from-gray-900 via-slate-900 to-gray-900 min-h-screen text-white">
      <Sidebar
        collapsed={collapsed}
        setCollapsed={setCollapsed}
        userRole={userRole}
        onLogout={onLogout}
      />

      <main
        className={`flex-1 transition-all duration-300 ${
          collapsed ? "ml-24" : "ml-72"
        } p-6`}
      >
        {/* Header */}
        <div className="mb-8">
          <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
            <div>
              <h1 className="text-3xl font-bold text-white flex items-center gap-3">
                <DollarSign className="w-8 h-8 text-green-400" />
                Salary Management
              </h1>
              <p className="text-gray-400 mt-2">
                Manage employee salaries, deductions, and payslips
              </p>
            </div>

            <button
              onClick={() => setShowForm(true)}
              className="flex items-center gap-2 px-6 py-3 bg-gradient-to-r from-green-600 to-green-700 hover:from-green-700 hover:to-green-800 text-white rounded-lg transition-all duration-200 shadow-lg hover:shadow-green-500/25"
            >
              <Plus className="w-5 h-5" />
              Add Salary Record
            </button>
          </div>
        </div>

        {/* Filters */}
        <div className="mb-6 p-6 bg-gradient-to-br from-slate-800/50 to-slate-900/50 backdrop-blur-sm border border-slate-600/30 rounded-2xl">
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
            <div className="relative">
              <Search className="absolute left-3 top-3 w-4 h-4 text-gray-400" />
              <input
                type="text"
                placeholder="Search employees..."
                value={filters.search}
                onChange={(e) => setFilters(prev => ({ ...prev, search: e.target.value }))}
                className="w-full pl-10 pr-4 py-2 bg-slate-700/50 border border-slate-600/50 rounded-lg text-white focus:outline-none focus:ring-2 focus:ring-green-500"
              />
            </div>

            <input
              type="month"
              value={filters.month}
              onChange={(e) => setFilters(prev => ({ ...prev, month: e.target.value }))}
              className="w-full px-4 py-2 bg-slate-700/50 border border-slate-600/50 rounded-lg text-white focus:outline-none focus:ring-2 focus:ring-green-500"
            />

            <select
              value={filters.department}
              onChange={(e) => setFilters(prev => ({ ...prev, department: e.target.value }))}
              className="w-full px-4 py-2 bg-slate-700/50 border border-slate-600/50 rounded-lg text-white focus:outline-none focus:ring-2 focus:ring-green-500"
            >
              <option value="">All Departments</option>
              <option value="Engineering">Engineering</option>
              <option value="HR">HR</option>
              <option value="Finance">Finance</option>
              <option value="Marketing">Marketing</option>
              <option value="Operations">Operations</option>
            </select>

            <button
              onClick={fetchSalaryRecords}
              className="flex items-center gap-2 px-4 py-2 bg-slate-600/50 hover:bg-slate-600 text-gray-300 rounded-lg transition-colors"
            >
              <Filter className="w-4 h-4" />
              Apply Filters
            </button>
          </div>
        </div>

        {/* Salary Records Table */}
        <div className="bg-gradient-to-br from-slate-800/50 to-slate-900/50 backdrop-blur-sm border border-slate-600/30 rounded-2xl overflow-hidden">
          <div className="p-6 border-b border-slate-600/30">
            <h3 className="text-lg font-semibold text-white flex items-center gap-2">
              <Users className="w-5 h-5 text-green-400" />
              Salary Records
            </h3>
          </div>

          <div className="overflow-x-auto">
            {loading ? (
              <div className="p-12 text-center">
                <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-green-400 mx-auto mb-4"></div>
                <p className="text-gray-400">Loading salary records...</p>
              </div>
            ) : salaryRecords.length === 0 ? (
              <div className="p-12 text-center">
                <DollarSign className="w-16 h-16 text-gray-600 mx-auto mb-4" />
                <p className="text-gray-400 text-lg mb-2">No salary records found</p>
                <p className="text-gray-500 text-sm">Create your first salary record to get started</p>
              </div>
            ) : (
              <table className="w-full">
                <thead className="bg-slate-800/50">
                  <tr>
                    <th className="px-6 py-4 text-left text-sm font-semibold text-gray-300">Employee</th>
                    <th className="px-6 py-4 text-left text-sm font-semibold text-gray-300">Period</th>
                    <th className="px-6 py-4 text-left text-sm font-semibold text-gray-300">Gross Salary</th>
                    <th className="px-6 py-4 text-left text-sm font-semibold text-gray-300">Deductions</th>
                    <th className="px-6 py-4 text-left text-sm font-semibold text-gray-300">Net Salary</th>
                    <th className="px-6 py-4 text-left text-sm font-semibold text-gray-300">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-600/20">
                  {salaryRecords.map((record) => (
                    <tr key={record._id} className="hover:bg-slate-700/30 transition-colors">
                      <td className="px-6 py-4">
                        <div>
                          <div className="font-medium text-white">{record.employee?.name}</div>
                          <div className="text-sm text-gray-400">
                            {record.employee?.employeeId} • {record.employee?.department}
                          </div>
                        </div>
                      </td>
                      <td className="px-6 py-4">
                        <div className="text-white font-medium">
                          {new Date(record.payPeriod + '-01').toLocaleDateString('en-IN', {
                            month: 'long',
                            year: 'numeric'
                          })}
                        </div>
                      </td>
                      <td className="px-6 py-4">
                        <div className="text-green-400 font-medium">{formatCurrency(record.grossSalary)}</div>
                      </td>
                      <td className="px-6 py-4">
                        <div className="text-red-400 font-medium">{formatCurrency(record.totalDeductions)}</div>
                      </td>
                      <td className="px-6 py-4">
                        <div className="text-blue-400 font-medium text-lg">{formatCurrency(record.netSalary)}</div>
                      </td>
                      <td className="px-6 py-4">
                        <div className="flex items-center gap-2">
                          <button
                            onClick={() => handleViewPayslip(record.employee)}
                            className="p-2 hover:bg-blue-600/20 text-blue-400 rounded-lg transition-colors"
                            title="View Payslip"
                          >
                            <Eye className="w-4 h-4" />
                          </button>
                          <button
                            onClick={() => handleEdit(record)}
                            className="p-2 hover:bg-yellow-600/20 text-yellow-400 rounded-lg transition-colors"
                            title="Edit Record"
                          >
                            <Edit className="w-4 h-4" />
                          </button>
                          <button
                            onClick={() => handleDelete(record._id)}
                            className="p-2 hover:bg-red-600/20 text-red-400 rounded-lg transition-colors"
                            title="Delete Record"
                          >
                            <X className="w-4 h-4" />
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>
        </div>

        {/* Salary Form Modal */}
        {showForm && (
          <div className="fixed inset-0 z-50 overflow-y-auto">
            <div className="fixed inset-0 bg-black/50 backdrop-blur-sm" onClick={() => { setShowForm(false); resetForm(); }} />

            <div className="flex min-h-full items-center justify-center p-4">
              <div className="relative w-full max-w-4xl bg-gradient-to-br from-slate-800 to-slate-900 rounded-2xl shadow-2xl border border-slate-600/30">
                <div className="flex items-center justify-between p-6 border-b border-slate-600/30">
                  <h2 className="text-2xl font-semibold text-white flex items-center gap-3">
                    <Calculator className="w-6 h-6 text-green-400" />
                    {editingId ? "Edit" : "Add"} Salary Record
                  </h2>
                  <button
                    onClick={() => { setShowForm(false); resetForm(); }}
                    className="p-2 hover:bg-slate-700/50 rounded-lg transition-colors"
                  >
                    <X className="w-5 h-5 text-gray-400" />
                  </button>
                </div>

                <form onSubmit={handleSubmit} className="p-6 space-y-6">
                  {/* Basic Information */}
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                    <div>
                      <label className="block text-sm font-medium text-gray-300 mb-2">
                        Employee *
                      </label>
                      <select
                        value={formData.employeeId}
                        onChange={(e) => setFormData(prev => ({ ...prev, employeeId: e.target.value }))}
                        className="w-full px-4 py-3 bg-slate-700/50 border border-slate-600/50 rounded-lg text-white focus:outline-none focus:ring-2 focus:ring-green-500"
                        required
                        disabled={editingId}
                      >
                        <option value="">Select Employee</option>
                        {employees.map(emp => (
                          <option key={emp._id} value={emp._id}>
                            {emp.name} ({emp.employeeId}) - {emp.department}
                          </option>
                        ))}
                      </select>
                    </div>

                    <div>
                      <label className="block text-sm font-medium text-gray-300 mb-2">
                        Pay Period *
                      </label>
                      <input
                        type="month"
                        value={formData.month}
                        onChange={(e) => setFormData(prev => ({ ...prev, month: e.target.value }))}
                        className="w-full px-4 py-3 bg-slate-700/50 border border-slate-600/50 rounded-lg text-white focus:outline-none focus:ring-2 focus:ring-green-500"
                        required
                        disabled={editingId}
                      />
                    </div>
                  </div>

                  {/* Salary Details */}
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                    <div>
                      <label className="block text-sm font-medium text-gray-300 mb-2">
                        CTC *
                      </label>
                      <input
                        type="number"
                        value={formData.ctc}
                        onChange={(e) => setFormData(prev => ({ ...prev, ctc: e.target.value }))}
                        className="w-full px-4 py-3 bg-slate-700/50 border border-slate-600/50 rounded-lg text-white focus:outline-none focus:ring-2 focus:ring-green-500"
                        placeholder="0"
                        required
                      />
                    </div>

                    <div>
                      <label className="block text-sm font-medium text-gray-300 mb-2">
                        Basic Salary *
                      </label>
                      <input
                        type="number"
                        value={formData.basicSalary}
                        onChange={(e) => setFormData(prev => ({ ...prev, basicSalary: e.target.value }))}
                        className="w-full px-4 py-3 bg-slate-700/50 border border-slate-600/50 rounded-lg text-white focus:outline-none focus:ring-2 focus:ring-green-500"
                        placeholder="0"
                        required
                      />
                    </div>

                    <div>
                      <label className="block text-sm font-medium text-gray-300 mb-2">
                        Gross Salary *
                      </label>
                      <input
                        type="number"
                        value={formData.grossSalary}
                        onChange={(e) => setFormData(prev => ({ ...prev, grossSalary: e.target.value }))}
                        className="w-full px-4 py-3 bg-slate-700/50 border border-slate-600/50 rounded-lg text-white focus:outline-none focus:ring-2 focus:ring-green-500"
                        placeholder="0"
                        required
                      />
                    </div>
                  </div>

                  {/* Deductions */}
                  <div>
                    <h3 className="text-lg font-semibold text-white mb-4 flex items-center gap-2">
                      <TrendingDown className="w-5 h-5 text-red-400" />
                      Deductions
                    </h3>
                    <div className="grid grid-cols-1 md:grid-cols-3 lg:grid-cols-5 gap-4">
                      <div>
                        <label className="block text-sm font-medium text-gray-300 mb-2">
                          PF Deduction
                        </label>
                        <input
                          type="number"
                          value={formData.deductions.pf}
                          onChange={(e) => setFormData(prev => ({
                            ...prev,
                            deductions: { ...prev.deductions, pf: e.target.value }
                          }))}
                          className="w-full px-4 py-3 bg-slate-700/50 border border-slate-600/50 rounded-lg text-white focus:outline-none focus:ring-2 focus:ring-green-500"
                          placeholder="0"
                        />
                      </div>

                      <div>
                        <label className="block text-sm font-medium text-gray-300 mb-2">
                          ESI Deduction
                        </label>
                        <input
                          type="number"
                          value={formData.deductions.esi}
                          onChange={(e) => setFormData(prev => ({
                            ...prev,
                            deductions: { ...prev.deductions, esi: e.target.value }
                          }))}
                          className="w-full px-4 py-3 bg-slate-700/50 border border-slate-600/50 rounded-lg text-white focus:outline-none focus:ring-2 focus:ring-green-500"
                          placeholder="0"
                        />
                      </div>

                      <div>
                        <label className="block text-sm font-medium text-gray-300 mb-2">
                          Professional Tax
                        </label>
                        <input
                          type="number"
                          value={formData.deductions.ptax}
                          onChange={(e) => setFormData(prev => ({
                            ...prev,
                            deductions: { ...prev.deductions, ptax: e.target.value }
                          }))}
                          className="w-full px-4 py-3 bg-slate-700/50 border border-slate-600/50 rounded-lg text-white focus:outline-none focus:ring-2 focus:ring-green-500"
                          placeholder="0"
                        />
                      </div>

                      <div>
                        <label className="block text-sm font-medium text-gray-300 mb-2">
                          Late Deduction
                        </label>
                        <input
                          type="number"
                          value={formData.deductions.lateDeduction}
                          onChange={(e) => setFormData(prev => ({
                            ...prev,
                            deductions: { ...prev.deductions, lateDeduction: e.target.value }
                          }))}
                          className="w-full px-4 py-3 bg-slate-700/50 border border-slate-600/50 rounded-lg text-white focus:outline-none focus:ring-2 focus:ring-green-500"
                          placeholder="0"
                        />
                      </div>

                      <div>
                        <label className="block text-sm font-medium text-gray-300 mb-2">
                          Other Deductions
                        </label>
                        <input
                          type="number"
                          value={formData.deductions.other}
                          onChange={(e) => setFormData(prev => ({
                            ...prev,
                            deductions: { ...prev.deductions, other: e.target.value }
                          }))}
                          className="w-full px-4 py-3 bg-slate-700/50 border border-slate-600/50 rounded-lg text-white focus:outline-none focus:ring-2 focus:ring-green-500"
                          placeholder="0"
                        />
                      </div>
                    </div>
                  </div>

                  {/* Attendance Details */}
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                    <div>
                      <label className="block text-sm font-medium text-gray-300 mb-2">
                        Working Days
                      </label>
                      <input
                        type="number"
                        value={formData.workingDays}
                        onChange={(e) => setFormData(prev => ({ ...prev, workingDays: e.target.value }))}
                        className="w-full px-4 py-3 bg-slate-700/50 border border-slate-600/50 rounded-lg text-white focus:outline-none focus:ring-2 focus:ring-green-500"
                        placeholder="22"
                      />
                    </div>

                    <div>
                      <label className="block text-sm font-medium text-gray-300 mb-2">
                        Present Days
                      </label>
                      <input
                        type="number"
                        value={formData.presentDays}
                        onChange={(e) => setFormData(prev => ({ ...prev, presentDays: e.target.value }))}
                        className="w-full px-4 py-3 bg-slate-700/50 border border-slate-600/50 rounded-lg text-white focus:outline-none focus:ring-2 focus:ring-green-500"
                        placeholder="20"
                      />
                    </div>

                    <div>
                      <label className="block text-sm font-medium text-gray-300 mb-2">
                        Late Days
                      </label>
                      <input
                        type="number"
                        value={formData.lateDays}
                        onChange={(e) => setFormData(prev => ({ ...prev, lateDays: e.target.value }))}
                        className="w-full px-4 py-3 bg-slate-700/50 border border-slate-600/50 rounded-lg text-white focus:outline-none focus:ring-2 focus:ring-green-500"
                        placeholder="0"
                      />
                    </div>
                  </div>

                  {/* Net Salary Display */}
                  <div className="bg-blue-900/20 rounded-xl p-6 border border-blue-500/30">
                    <div className="flex items-center justify-between">
                      <h4 className="text-lg font-semibold text-white flex items-center gap-2">
                        <CreditCard className="w-5 h-5 text-blue-400" />
                        Net Salary (Auto-calculated)
                      </h4>
                      <div className="text-2xl font-bold text-blue-400">
                        {formatCurrency(calculateNetSalary())}
                      </div>
                    </div>
                    <p className="text-gray-400 text-sm mt-2">
                      Gross Salary ({formatCurrency(formData.grossSalary || 0)}) - Total Deductions ({formatCurrency(calculateTotalDeductions())})
                    </p>
                  </div>

                  {/* Remarks */}
                  <div>
                    <label className="block text-sm font-medium text-gray-300 mb-2">
                      Remarks
                    </label>
                    <textarea
                      value={formData.remarks}
                      onChange={(e) => setFormData(prev => ({ ...prev, remarks: e.target.value }))}
                      rows={3}
                      className="w-full px-4 py-3 bg-slate-700/50 border border-slate-600/50 rounded-lg text-white focus:outline-none focus:ring-2 focus:ring-green-500 resize-none"
                      placeholder="Any additional remarks or notes..."
                    />
                  </div>

                  {/* Form Actions */}
                  <div className="flex items-center justify-end gap-4 pt-4 border-t border-slate-600/30">
                    <button
                      type="button"
                      onClick={() => { setShowForm(false); resetForm(); }}
                      className="px-6 py-3 bg-slate-600/50 hover:bg-slate-600 text-gray-300 rounded-lg transition-colors"
                    >
                      Cancel
                    </button>
                    <button
                      type="submit"
                      className="flex items-center gap-2 px-6 py-3 bg-gradient-to-r from-green-600 to-green-700 hover:from-green-700 hover:to-green-800 text-white rounded-lg transition-all duration-200 shadow-lg hover:shadow-green-500/25"
                    >
                      <Save className="w-4 h-4" />
                      {editingId ? "Update" : "Save"} Record
                    </button>
                  </div>
                </form>
              </div>
            </div>
          </div>
        )}

        {/* Payslip Modal */}
        <PayslipModal
          isOpen={showPayslipModal}
          onClose={() => setShowPayslipModal(false)}
          employeeId={selectedEmployee?._id}
        />
      </main>
    </div>
  );
};

export default SalaryManagement;