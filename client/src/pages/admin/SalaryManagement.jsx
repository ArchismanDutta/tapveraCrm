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
    payPeriod: new Date().toISOString().slice(0, 7), // YYYY-MM format
    monthlySalary: "",
    workingDays: "",
    paidDays: "",
    lateDays: "0",
    halfDays: "0",
    manualDeductions: {
      tds: "0",
      other: "0",
      advance: "0"
    },
    remarks: ""
  });

  const [previewData, setPreviewData] = useState(null);
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
        console.log("Salary records received:", data);
        console.log("Sample record structure:", data[0]);
        setSalaryRecords(data);
      }
    } catch (error) {
      console.error("Error fetching salary records:", error);
      toast.error("Failed to load salary records");
    } finally {
      setLoading(false);
    }
  };

  const calculatePreview = () => {
    const { monthlySalary, workingDays, paidDays, lateDays, halfDays, manualDeductions } = formData;

    if (!monthlySalary || !workingDays || !paidDays) {
      return null;
    }

    const salary = parseFloat(monthlySalary);
    const working = parseFloat(workingDays);
    const paid = parseFloat(paidDays);
    const late = parseFloat(lateDays) || 0;
    const half = parseFloat(halfDays) || 0;

    // Calculate salary components (50%, 35%, 5%, 5%, 5%)
    const salaryComponents = {
      basic: salary * 0.50,
      hra: salary * 0.35,
      conveyance: salary * 0.05,
      medical: salary * 0.05,
      specialAllowance: salary * 0.05
    };

    // Calculate gross components (prorated by paid days)
    const grossComponents = {
      basic: (salaryComponents.basic / working) * paid,
      hra: (salaryComponents.hra / working) * paid,
      conveyance: (salaryComponents.conveyance / working) * paid,
      medical: (salaryComponents.medical / working) * paid,
      specialAllowance: (salaryComponents.specialAllowance / working) * paid
    };

    const grossTotal = Object.values(grossComponents).reduce((sum, val) => sum + val, 0);

    // Determine ESI eligibility based on monthly salary
    const esiApplicable = salary <= 21000;

    // Calculate late deduction
    // No deduction for first 2 late days
    // From 3rd late onwards: Every 3 lates = 1 day salary deduction
    // Extra lates (not in multiples of 3) = ₹200 per late
    const perDaySalary = salary / working;
    let lateDeduction = 0;

    if (late >= 3) {
      const fullLateDays = Math.floor(late / 3); // Number of full 3-day cycles
      const extraLateDays = late % 3; // Remaining lates (1 or 2)
      lateDeduction = (fullLateDays * perDaySalary) + (extraLateDays * 200);
    }

    // Calculate half-day deduction
    // Each half-day = 50% of per-day salary deduction
    const halfDayDeduction = half * (perDaySalary * 0.5);

    // Calculate PTax
    const calculatePTax = (sal) => {
      if (sal < 10000) return 0;
      if (sal <= 15000) return 110;
      if (sal <= 25000) return 130;
      if (sal <= 40000) return 150;
      return 200;
    };

    // Calculate deductions
    const deductions = {
      employeePF: salaryComponents.basic <= 15000
        ? Math.min(1800, Math.ceil(salaryComponents.basic * 0.12))
        : 0,
      esi: esiApplicable ? Math.round(grossTotal * 0.0075) : 0,
      ptax: calculatePTax(salary),
      tds: parseFloat(manualDeductions.tds) || 0,
      other: parseFloat(manualDeductions.other) || 0,
      advance: parseFloat(manualDeductions.advance) || 0,
      lateDeduction: lateDeduction,
      halfDayDeduction: halfDayDeduction
    };

    const totalDeductions = Object.values(deductions).reduce((sum, val) => sum + val, 0);

    // Employer contributions
    const employerContributions = {
      employerPF: salaryComponents.basic <= 15000
        ? Math.min(1800, Math.ceil(salaryComponents.basic * 0.12))
        : 0,
      employerESI: esiApplicable ? Math.round(grossTotal * 0.0325) : 0
    };

    const netPayment = grossTotal - totalDeductions;
    const ctc = grossTotal + employerContributions.employerPF + employerContributions.employerESI;

    return {
      salaryComponents,
      grossComponents,
      grossTotal,
      deductions,
      totalDeductions,
      employerContributions,
      netPayment,
      ctc
    };
  };

  // Auto-calculate preview when inputs change
  useEffect(() => {
    const preview = calculatePreview();
    setPreviewData(preview);
  }, [formData.monthlySalary, formData.workingDays, formData.paidDays, formData.lateDays, formData.halfDays, formData.manualDeductions]);

  const handleSubmit = async (e) => {
    e.preventDefault();

    try {
      const token = localStorage.getItem("token");

      // Prepare payload for automated calculation
      const payload = {
        employeeId: formData.employeeId,
        payPeriod: formData.payPeriod,
        monthlySalary: parseFloat(formData.monthlySalary),
        workingDays: parseFloat(formData.workingDays),
        paidDays: parseFloat(formData.paidDays),
        lateDays: parseFloat(formData.lateDays) || 0,
        halfDays: parseFloat(formData.halfDays) || 0,
        manualDeductions: {
          tds: parseFloat(formData.manualDeductions.tds) || 0,
          other: parseFloat(formData.manualDeductions.other) || 0,
          advance: parseFloat(formData.manualDeductions.advance) || 0
        },
        remarks: formData.remarks
      };

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
        body: JSON.stringify(payload)
      });

      if (response.ok) {
        toast.success(editingId ? "Payslip updated successfully" : "Payslip generated successfully");
        setShowForm(false);
        resetForm();
        fetchSalaryRecords();
      } else {
        const error = await response.json();
        toast.error(error.error || "Failed to save payslip");
      }
    } catch (error) {
      console.error("Error saving payslip:", error);
      toast.error("Error saving payslip");
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
      payPeriod: record.payPeriod,
      monthlySalary: record.monthlySalary || "",
      workingDays: record.workingDays || "",
      paidDays: record.paidDays || "",
      lateDays: record.lateDays || "0",
      halfDays: record.halfDays || "0",
      manualDeductions: {
        tds: record.deductions?.tds || "0",
        other: record.deductions?.other || "0",
        advance: record.deductions?.advance || "0"
      },
      remarks: record.remarks || ""
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
      payPeriod: new Date().toISOString().slice(0, 7),
      monthlySalary: "",
      workingDays: "",
      paidDays: "",
      lateDays: "0",
      halfDays: "0",
      manualDeductions: {
        tds: "0",
        other: "0",
        advance: "0"
      },
      remarks: ""
    });
    setPreviewData(null);
    setEditingId(null);
  };

  const formatCurrency = (amount) => {
    return new Intl.NumberFormat('en-IN', {
      style: 'currency',
      currency: 'INR',
      minimumFractionDigits: 2,
      maximumFractionDigits: 2
    }).format(amount || 0);
  };

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
                        <div className="text-green-400 font-medium">
                          {formatCurrency(record.grossTotal || record.grossSalary || 0)}
                        </div>
                      </td>
                      <td className="px-6 py-4">
                        <div className="text-red-400 font-medium">
                          {formatCurrency(record.totalDeductions || 0)}
                        </div>
                      </td>
                      <td className="px-6 py-4">
                        <div className="text-blue-400 font-medium text-lg">
                          {formatCurrency(record.netPayment || record.netSalary || 0)}
                        </div>
                      </td>                      <td className="px-6 py-4">
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
                        value={formData.payPeriod}
                        onChange={(e) => setFormData(prev => ({ ...prev, payPeriod: e.target.value }))}
                        className="w-full px-4 py-3 bg-slate-700/50 border border-slate-600/50 rounded-lg text-white focus:outline-none focus:ring-2 focus:ring-green-500"
                        required
                        disabled={editingId}
                      />
                    </div>
                  </div>

                  {/* Required Input Fields */}
                  <div className="bg-blue-900/10 rounded-xl p-6 border border-blue-500/20">
                    <h3 className="text-lg font-semibold text-white mb-4 flex items-center gap-2">
                      <DollarSign className="w-5 h-5 text-blue-400" />
                      Salary & Attendance Input
                    </h3>
                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
                      <div>
                        <label className="block text-sm font-medium text-gray-300 mb-2">
                          Monthly Salary*
                        </label>
                        <input
                          type="number"
                          value={formData.monthlySalary}
                          onChange={(e) => setFormData(prev => ({ ...prev, monthlySalary: e.target.value }))}
                          className="w-full px-4 py-3 bg-slate-700/50 border border-slate-600/50 rounded-lg text-white focus:outline-none focus:ring-2 focus:ring-green-500"
                          placeholder="50000"
                          min="0"
                          step="0.01"
                          required
                        />
                      </div>

                      <div>
                        <label className="block text-sm font-medium text-gray-300 mb-2">
                          Working Days *
                        </label>
                        <input
                          type="number"
                          value={formData.workingDays}
                          onChange={(e) => setFormData(prev => ({ ...prev, workingDays: e.target.value }))}
                          className="w-full px-4 py-3 bg-slate-700/50 border border-slate-600/50 rounded-lg text-white focus:outline-none focus:ring-2 focus:ring-green-500"
                          placeholder="22"
                          min="1"
                          max="31"
                          required
                        />
                      </div>

                      <div>
                        <label className="block text-sm font-medium text-gray-300 mb-2">
                          Paid Days *
                        </label>
                        <input
                          type="number"
                          value={formData.paidDays}
                          onChange={(e) => setFormData(prev => ({ ...prev, paidDays: e.target.value }))}
                          className="w-full px-4 py-3 bg-slate-700/50 border border-slate-600/50 rounded-lg text-white focus:outline-none focus:ring-2 focus:ring-green-500"
                          placeholder="20"
                          min="0"
                          max="31"
                          required
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
                          min="0"
                          max="31"
                        />
                      </div>

                      <div>
                        <label className="block text-sm font-medium text-gray-300 mb-2">
                          Half Days
                        </label>
                        <input
                          type="number"
                          value={formData.halfDays}
                          onChange={(e) => setFormData(prev => ({ ...prev, halfDays: e.target.value }))}
                          className="w-full px-4 py-3 bg-slate-700/50 border border-slate-600/50 rounded-lg text-white focus:outline-none focus:ring-2 focus:ring-green-500"
                          placeholder="0"
                          min="0"
                          max="31"
                        />
                      </div>
                    </div>
                  </div>

                  {/* Optional Manual Deductions */}
                  <div>
                    <h3 className="text-sm font-medium text-gray-400 mb-3">Optional Manual Deductions</h3>
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                      <div>
                        <label className="block text-xs text-gray-400 mb-1">TDS</label>
                        <input
                          type="number"
                          value={formData.manualDeductions.tds}
                          onChange={(e) => setFormData(prev => ({
                            ...prev,
                            manualDeductions: { ...prev.manualDeductions, tds: e.target.value }
                          }))}
                          className="w-full px-3 py-2 bg-slate-700/50 border border-slate-600/50 rounded-lg text-white focus:outline-none focus:ring-2 focus:ring-green-500 text-sm"
                          placeholder="0"
                          min="0"
                          step="0.01"
                        />
                      </div>

                      <div>
                        <label className="block text-xs text-gray-400 mb-1">Other/Penalty</label>
                        <input
                          type="number"
                          value={formData.manualDeductions.other}
                          onChange={(e) => setFormData(prev => ({
                            ...prev,
                            manualDeductions: { ...prev.manualDeductions, other: e.target.value }
                          }))}
                          className="w-full px-3 py-2 bg-slate-700/50 border border-slate-600/50 rounded-lg text-white focus:outline-none focus:ring-2 focus:ring-green-500 text-sm"
                          placeholder="0"
                          min="0"
                          step="0.01"
                        />
                      </div>

                      <div>
                        <label className="block text-xs text-gray-400 mb-1">Advance</label>
                        <input
                          type="number"
                          value={formData.manualDeductions.advance}
                          onChange={(e) => setFormData(prev => ({
                            ...prev,
                            manualDeductions: { ...prev.manualDeductions, advance: e.target.value }
                          }))}
                          className="w-full px-3 py-2 bg-slate-700/50 border border-slate-600/50 rounded-lg text-white focus:outline-none focus:ring-2 focus:ring-green-500 text-sm"
                          placeholder="0"
                          min="0"
                          step="0.01"
                        />
                      </div>
                    </div>
                  </div>

                  {/* Auto-Calculated Preview */}
                  {previewData && (
                    <div className="space-y-4">
                      {/* Salary Breakdown */}
                      <div className="bg-gradient-to-r from-purple-900/20 to-blue-900/20 rounded-xl p-6 border border-purple-500/20">
                        <h4 className="text-sm font-semibold text-purple-300 mb-4">Salary Breakdown (Auto-Calculated)</h4>
                        <div className="grid grid-cols-2 md:grid-cols-5 gap-3 text-sm">
                          <div>
                            <div className="text-gray-400 text-xs">Basic (50%)</div>
                            <div className="text-white font-medium">{formatCurrency(previewData.salaryComponents.basic)}</div>
                          </div>
                          <div>
                            <div className="text-gray-400 text-xs">HRA (35%)</div>
                            <div className="text-white font-medium">{formatCurrency(previewData.salaryComponents.hra)}</div>
                          </div>
                          <div>
                            <div className="text-gray-400 text-xs">Conv. (5%)</div>
                            <div className="text-white font-medium">{formatCurrency(previewData.salaryComponents.conveyance)}</div>
                          </div>
                          <div>
                            <div className="text-gray-400 text-xs">Med. (5%)</div>
                            <div className="text-white font-medium">{formatCurrency(previewData.salaryComponents.medical)}</div>
                          </div>
                          <div>
                            <div className="text-gray-400 text-xs">Special (5%)</div>
                            <div className="text-white font-medium">{formatCurrency(previewData.salaryComponents.specialAllowance)}</div>
                          </div>
                        </div>
                      </div>

                      {/* Gross Total */}
                      <div className="bg-green-900/20 rounded-xl p-4 border border-green-500/30">
                        <div className="flex justify-between items-center">
                          <span className="text-sm text-green-300 font-semibold">Gross Total (Prorated)</span>
                          <span className="text-xl font-bold text-green-400">{formatCurrency(previewData.grossTotal)}</span>
                        </div>
                      </div>

                      {/* Deductions */}
                      <div className="bg-red-900/20 rounded-xl p-4 border border-red-500/30">
                        <h4 className="text-sm font-semibold text-red-300 mb-3">Deductions</h4>
                        <div className="grid grid-cols-2 md:grid-cols-4 gap-3 text-xs mb-3">
                          <div>
                            <div className="text-gray-400">Emp. PF</div>
                            <div className="text-white">-{formatCurrency(previewData.deductions.employeePF)}</div>
                          </div>
                          <div>
                            <div className="text-gray-400">ESI</div>
                            <div className="text-white">-{formatCurrency(previewData.deductions.esi)}</div>
                          </div>
                          <div>
                            <div className="text-gray-400">PTax</div>
                            <div className="text-white">-{formatCurrency(previewData.deductions.ptax)}</div>
                          </div>
                          <div>
                            <div className="text-gray-400">Late Ded.</div>
                            <div className="text-white">-{formatCurrency(previewData.deductions.lateDeduction)}</div>
                          </div>
                          <div>
                            <div className="text-gray-400">Half-Day Ded.</div>
                            <div className="text-white">-{formatCurrency(previewData.deductions.halfDayDeduction)}</div>
                          </div>
                        </div>
                        <div className="flex justify-between items-center pt-3 border-t border-red-500/30">
                          <span className="text-sm text-red-300 font-semibold">Total Deductions</span>
                          <span className="text-lg font-bold text-red-400">-{formatCurrency(previewData.totalDeductions)}</span>
                        </div>
                      </div>

                      {/* Final Amount */}
                      <div className="bg-gradient-to-r from-blue-600 to-purple-600 rounded-xl p-6">
                        <div className="flex justify-between items-center">
                          <div>
                            <div className="text-blue-100 text-sm">Net Payment (Take-Home)</div>
                            <div className="text-xs text-blue-200 mt-1">CTC: {formatCurrency(previewData.ctc)}</div>
                          </div>
                          <div className="text-3xl font-bold text-white">{formatCurrency(previewData.netPayment)}</div>
                        </div>
                      </div>
                    </div>
                  )}

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