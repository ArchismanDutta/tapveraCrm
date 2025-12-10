import React, { useState, useEffect } from "react";
import {
  DollarSign,
  Users,
  Calculator,
  Zap,
  Eye,
  Search,
  Filter,
  Download,
  RefreshCw,
  X,
  TrendingUp,
  Calendar,
  User,
  Building,
  Clock,
  AlertCircle,
  CheckCircle,
  FileText,
  Play,
  PlayCircle,
  Edit,
  Save,
} from "lucide-react";
import { toast } from "react-toastify";
import Sidebar from "../../components/dashboard/Sidebar";
import PayslipModal from "../../components/payslip/PayslipModal";

const AutoPayrollManagement = ({ onLogout }) => {
  const [collapsed, setCollapsed] = useState(false);
  const [employees, setEmployees] = useState([]);
  const [loading, setLoading] = useState(false);
  const [selectedMonth, setSelectedMonth] = useState(
    new Date().toISOString().slice(0, 7)
  );
  const [previewData, setPreviewData] = useState(null);
  const [selectedEmployee, setSelectedEmployee] = useState(null);
  const [showPayslipModal, setShowPayslipModal] = useState(false);
  const [bulkGenerating, setBulkGenerating] = useState(false);
  const [bulkResults, setBulkResults] = useState(null);
  const [showCalculationRules, setShowCalculationRules] = useState(false);
  const [calculationRules, setCalculationRules] = useState(null);
  const [filters, setFilters] = useState({
    search: "",
    department: "",
  });
  const [showEditModal, setShowEditModal] = useState(false);
  const [editingPayslip, setEditingPayslip] = useState(null);
  const [editFormData, setEditFormData] = useState({
    workingDays: 0,
    paidDays: 0,
    lateDays: 0,
    halfDays: 0,
    tds: 0,
    other: 0,
    advance: 0,
    remarks: "",
  });
  const [employeePayslips, setEmployeePayslips] = useState({});

  const API_BASE = import.meta.env.VITE_API_BASE || "http://localhost:5000";

  // Helper function to get monthly salary from any salary structure
  const getMonthlySalary = (employee) => {
    // Handle undefined or null employee
    if (!employee) {
      return 0;
    }

    // Handle missing salary field
    if (!employee.salary) {
      return 0;
    }

    // If salary is just a number
    if (typeof employee.salary === "number") {
      return employee.salary > 0 ? employee.salary : 0;
    }

    // If salary is an object, try different possible fields
    if (typeof employee.salary === "object" && employee.salary !== null) {
      // Try common field names
      if (
        employee.salary.total &&
        typeof employee.salary.total === "number" &&
        employee.salary.total > 0
      ) {
        return employee.salary.total;
      }
      if (
        employee.salary.monthly &&
        typeof employee.salary.monthly === "number" &&
        employee.salary.monthly > 0
      ) {
        return employee.salary.monthly;
      }
      if (
        employee.salary.gross &&
        typeof employee.salary.gross === "number" &&
        employee.salary.gross > 0
      ) {
        return employee.salary.gross;
      }
      if (
        employee.salary.basic &&
        typeof employee.salary.basic === "number" &&
        employee.salary.basic > 0
      ) {
        return employee.salary.basic;
      }

      // If none of the above, try to find all numeric values
      const salaryValues = Object.values(employee.salary).filter(
        (val) => typeof val === "number" && val > 0
      );

      if (salaryValues.length > 0) {
        // Return the maximum value (likely the total)
        return Math.max(...salaryValues);
      }
    }

    return 0;
  };

  useEffect(() => {
    fetchEmployees();
    fetchCalculationRules();
  }, []);

  const fetchEmployees = async () => {
    try {
      const token = localStorage.getItem("token");
      const response = await fetch(`${API_BASE}/api/users`, {
        headers: { Authorization: `Bearer ${token}` },
      });

      if (response.ok) {
        const data = await response.json();

        // Filter active employees with valid salary
        const activeEmployees = data.filter(
          (user) => user.role === "employee" && user.status === "active"
        );

        // Debug logging - check salary structure
        if (activeEmployees.length > 0) {
          console.log("📊 Total active employees:", activeEmployees.length);
          console.log("💰 Sample employee data:", activeEmployees[0]);
          console.log(
            "💰 Sample salary structure:",
            activeEmployees[0]?.salary
          );
          console.log(
            "💵 Detected monthly salary:",
            getMonthlySalary(activeEmployees[0])
          );

          // Check for employees without salary
          const employeesWithoutSalary = activeEmployees.filter(
            (emp) => getMonthlySalary(emp) === 0
          );
          if (employeesWithoutSalary.length > 0) {
            console.warn(
              `⚠️ ${employeesWithoutSalary.length} employees have no salary configured:`,
              employeesWithoutSalary.map((e) => ({
                name: e.name,
                id: e.employeeId,
              }))
            );
          }
        }

        setEmployees(activeEmployees);
      }
    } catch (error) {
      console.error("Error fetching employees:", error);
      toast.error("Failed to load employees");
    }
  };

  const fetchCalculationRules = async () => {
    try {
      const token = localStorage.getItem("token");
      const response = await fetch(
        `${API_BASE}/api/auto-payroll/calculation-rules`,
        {
          headers: { Authorization: `Bearer ${token}` },
        }
      );

      if (response.ok) {
        const data = await response.json();
        setCalculationRules(data.rules);
      }
    } catch (error) {
      console.error("Error fetching calculation rules:", error);
    }
  };

  const previewSalaryCalculation = async (employeeId) => {
    setLoading(true);
    try {
      const token = localStorage.getItem("token");
      const response = await fetch(
        `${API_BASE}/api/auto-payroll/preview/${employeeId}/${selectedMonth}`,
        {
          headers: { Authorization: `Bearer ${token}` },
        }
      );

      if (response.ok) {
        const data = await response.json();
        setPreviewData(data.data);
        toast.success("Salary preview generated successfully");
      } else {
        const error = await response.json();
        toast.error(error.error || "Failed to preview salary calculation");
      }
    } catch (error) {
      console.error("Error previewing salary:", error);
      toast.error("Failed to preview salary calculation");
    } finally {
      setLoading(false);
    }
  };

  const generateSinglePayslip = async (employeeId) => {
    if (
      !window.confirm(
        "Generate payslip for this employee? This will create an official payslip record."
      )
    ) {
      return;
    }

    setLoading(true);
    try {
      const token = localStorage.getItem("token");
      const response = await fetch(`${API_BASE}/api/auto-payroll/generate`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          employeeId,
          payPeriod: selectedMonth,
        }),
      });

      // Handle duplicate payslip - offer to view existing or recalculate
      if (response.status === 409) {
        const errorData = await response.json();
        const existingPayslipId = errorData.payslipId;

        if (window.confirm("Payslip already exists for this period. Do you want to view it? (Cancel to keep preview open)")) {
          // Fetch and display existing payslip
          const fetchResponse = await fetch(`${API_BASE}/api/payslips/id/${existingPayslipId}`, {
            headers: { Authorization: `Bearer ${token}` }
          });

          if (fetchResponse.ok) {
            const data = await fetchResponse.json();
            toast.info("Displaying existing payslip");
            setPreviewData(null);
            setSelectedEmployee(data);
            setShowPayslipModal(true);
          }
        }
      } else if (response.ok) {
        const data = await response.json();
        toast.success("Payslip generated successfully");
        setPreviewData(null);
        setSelectedEmployee(data.payslip);
        setShowPayslipModal(true);
      } else {
        const error = await response.json();
        toast.error(error.error || "Failed to generate payslip");
      }
    } catch (error) {
      console.error("Error generating payslip:", error);
      toast.error("Failed to generate payslip");
    } finally {
      setLoading(false);
    }
  };

  const generateBulkPayslips = async () => {
    const employeeCount = filteredEmployees.length;

    if (
      !window.confirm(
        `Generate payslips for ${employeeCount} employees for ${new Date(
          selectedMonth + "-01"
        ).toLocaleDateString("en-IN", { month: "long", year: "numeric" })}?`
      )
    ) {
      return;
    }

    setBulkGenerating(true);
    try {
      const token = localStorage.getItem("token");
      const employeeIds = filteredEmployees.map((emp) => emp._id);

      const response = await fetch(
        `${API_BASE}/api/auto-payroll/generate-bulk`,
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${token}`,
          },
          body: JSON.stringify({
            payPeriod: selectedMonth,
            employeeIds: employeeIds.length > 0 ? employeeIds : null,
            skipExisting: true,
          }),
        }
      );

      if (response.ok) {
        const data = await response.json();
        setBulkResults(data.results);
        toast.success(
          `Bulk generation complete: ${data.results.generated} generated, ${data.results.skipped} skipped, ${data.results.failed} failed`
        );
      } else {
        const error = await response.json();
        toast.error(error.error || "Failed to generate bulk payslips");
      }
    } catch (error) {
      console.error("Error generating bulk payslips:", error);
      toast.error("Failed to generate bulk payslips");
    } finally {
      setBulkGenerating(false);
    }
  };

  // Filter employees
  const filteredEmployees = employees.filter((emp) => {
    const matchesSearch =
      emp.name?.toLowerCase().includes(filters.search.toLowerCase()) ||
      emp.employeeId?.toLowerCase().includes(filters.search.toLowerCase());
    const matchesDept =
      !filters.department || emp.department === filters.department;
    return matchesSearch && matchesDept;
  });

  // Get unique departments
  const departments = [
    ...new Set(employees.map((emp) => emp.department).filter(Boolean)),
  ];

  const formatCurrency = (amount) => {
    return new Intl.NumberFormat("en-IN", {
      style: "currency",
      currency: "INR",
      maximumFractionDigits: 0,
    }).format(amount || 0);
  };

  const openEditModal = () => {
    if (previewData) {
      setEditFormData({
        workingDays: previewData.attendanceData.workingDays,
        paidDays: previewData.attendanceData.paidDays,
        lateDays: previewData.attendanceData.lateDays,
        halfDays: previewData.attendanceData.halfDays,
        tds: previewData.calculations.deductions.tds || 0,
        other: previewData.calculations.deductions.other || 0,
        advance: previewData.calculations.deductions.advance || 0,
        remarks: "",
      });
      setShowEditModal(true);
    }
  };

  const handleEditSubmit = async () => {
    if (!previewData && !editingPayslip) return;

    setLoading(true);
    try {
      const token = localStorage.getItem("token");

      // If editing an existing payslip, use recalculate endpoint
      if (editingPayslip) {
        const response = await fetch(`${API_BASE}/api/auto-payroll/recalculate/${editingPayslip._id}`, {
          method: "PUT",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${token}`,
          },
          body: JSON.stringify({
            workingDays: editFormData.workingDays,
            paidDays: editFormData.paidDays,
            lateDays: editFormData.lateDays,
            halfDays: editFormData.halfDays,
            manualDeductions: {
              tds: editFormData.tds,
              other: editFormData.other,
              advance: editFormData.advance,
            },
            remarks: editFormData.remarks || `Manually recalculated: Late days=${editFormData.lateDays}, Half days=${editFormData.halfDays}`,
          }),
        });

        if (response.ok) {
          const data = await response.json();
          toast.success("Payslip recalculated successfully");
          setShowEditModal(false);
          setEditingPayslip(null);
          setSelectedEmployee(data.payslip);
          setShowPayslipModal(true);
        } else {
          const error = await response.json();
          toast.error(error.error || "Failed to recalculate payslip");
        }
      }
      // If editing from preview, generate new payslip (or recalculate if exists)
      else {
        // First, try to generate new payslip
        let response = await fetch(`${API_BASE}/api/auto-payroll/generate`, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${token}`,
          },
          body: JSON.stringify({
            employeeId: previewData.employee._id,
            payPeriod: selectedMonth,
            workingDays: editFormData.workingDays,
            paidDays: editFormData.paidDays,
            lateDays: editFormData.lateDays,
            halfDays: editFormData.halfDays,
            manualDeductions: {
              tds: editFormData.tds,
              other: editFormData.other,
              advance: editFormData.advance,
            },
            remarks: editFormData.remarks || `Manually adjusted attendance: Late days=${editFormData.lateDays}, Half days=${editFormData.halfDays}`,
          }),
        });

        // If duplicate error, get existing payslip ID and recalculate
        if (response.status === 409) {
          const errorData = await response.json();
          const existingPayslipId = errorData.payslipId;

          toast.info("Payslip already exists, recalculating...");

          response = await fetch(`${API_BASE}/api/auto-payroll/recalculate/${existingPayslipId}`, {
            method: "PUT",
            headers: {
              "Content-Type": "application/json",
              Authorization: `Bearer ${token}`,
            },
            body: JSON.stringify({
              workingDays: editFormData.workingDays,
              paidDays: editFormData.paidDays,
              lateDays: editFormData.lateDays,
              halfDays: editFormData.halfDays,
              manualDeductions: {
                tds: editFormData.tds,
                other: editFormData.other,
                advance: editFormData.advance,
              },
              remarks: editFormData.remarks || `Manually adjusted attendance: Late days=${editFormData.lateDays}, Half days=${editFormData.halfDays}`,
            }),
          });
        }

        if (response.ok) {
          const data = await response.json();
          toast.success("Payslip saved with manual adjustments");
          setShowEditModal(false);
          setPreviewData(null);
          setSelectedEmployee(data.payslip);
          setShowPayslipModal(true);
        } else {
          const error = await response.json();
          toast.error(error.error || "Failed to save payslip");
        }
      }
    } catch (error) {
      console.error("Error:", error);
      toast.error("Failed to process request");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="flex bg-gradient-to-br from-[#141a21] via-[#191f2b] to-[#101218] font-sans text-blue-100 min-h-screen">
      <Sidebar
        collapsed={collapsed}
        setCollapsed={setCollapsed}
        onLogout={onLogout}
        userRole="super-admin"
      />

      <main
        className={`flex-1 p-8 overflow-y-auto transition-all duration-300 ${
          collapsed ? "ml-20" : "ml-72"
        }`}
      >
        {/* Header */}
        <div className="flex justify-between items-start mb-8">
          <div>
            <h1 className="text-3xl font-bold text-white tracking-tight mb-2 flex items-center gap-3">
              <Zap className="w-8 h-8 text-yellow-400" />
              Automatic Payroll System
            </h1>
            <p className="text-blue-300">
              Generate payslips automatically from attendance data
            </p>
          </div>

          <button
            onClick={() => setShowCalculationRules(!showCalculationRules)}
            className="px-4 py-2 bg-purple-600/20 hover:bg-purple-600/40 text-purple-400 border border-purple-500/30 rounded-lg transition-colors flex items-center gap-2"
          >
            <Calculator className="w-4 h-4" />
            Calculation Rules
          </button>
        </div>

        {/* Calculation Rules Modal */}
        {showCalculationRules && calculationRules && (
          <div className="fixed inset-0 bg-black/70 flex items-center justify-center z-50 p-4">
            <div className="bg-[#191f2b] rounded-xl border border-[#232945] max-w-4xl w-full max-h-[90vh] overflow-y-auto">
              <div className="p-6">
                <div className="flex justify-between items-center mb-6">
                  <h2 className="text-2xl font-bold text-white flex items-center gap-2">
                    <Calculator className="w-6 h-6 text-purple-400" />
                    Salary Calculation Rules
                  </h2>
                  <button
                    onClick={() => setShowCalculationRules(false)}
                    className="text-gray-400 hover:text-white transition-colors"
                  >
                    <X className="w-6 h-6" />
                  </button>
                </div>

                <div className="space-y-6">
                  {/* Salary Components */}
                  <div className="bg-[#0f1419] rounded-lg p-4 border border-[#232945]">
                    <h3 className="text-lg font-semibold text-blue-400 mb-3">
                      Salary Components
                    </h3>
                    <div className="space-y-2">
                      {Object.entries(calculationRules.salaryComponents).map(
                        ([key, value]) => (
                          <div
                            key={key}
                            className="flex justify-between text-sm"
                          >
                            <span className="text-gray-400 capitalize">
                              {key.replace(/([A-Z])/g, " $1")}:
                            </span>
                            <span className="text-white">{value}</span>
                          </div>
                        )
                      )}
                    </div>
                  </div>

                  {/* Deductions */}
                  <div className="bg-[#0f1419] rounded-lg p-4 border border-[#232945]">
                    <h3 className="text-lg font-semibold text-red-400 mb-3">
                      Deductions
                    </h3>
                    <div className="space-y-4">
                      {Object.entries(calculationRules.deductions).map(
                        ([key, value]) => (
                          <div
                            key={key}
                            className="border-b border-[#232945] pb-3 last:border-0"
                          >
                            <p className="font-medium text-white capitalize mb-1">
                              {key.replace(/([A-Z])/g, " $1")}
                            </p>
                            {typeof value === "object" && value.description && (
                              <>
                                <p className="text-sm text-gray-400">
                                  {value.description}
                                </p>
                                {value.applicable && (
                                  <p className="text-xs text-gray-500 mt-1">
                                    Applicable: {value.applicable}
                                  </p>
                                )}
                                {value.slabs && (
                                  <div className="mt-2 text-xs">
                                    {value.slabs.map((slab, idx) => (
                                      <div
                                        key={idx}
                                        className="flex justify-between text-gray-400 py-1"
                                      >
                                        <span>{slab.range}</span>
                                        <span className="text-white">
                                          {slab.tax}
                                        </span>
                                      </div>
                                    ))}
                                  </div>
                                )}
                                {value.rules && (
                                  <ul className="mt-2 text-xs text-gray-400 list-disc list-inside space-y-1">
                                    {value.rules.map((rule, idx) => (
                                      <li key={idx}>{rule}</li>
                                    ))}
                                  </ul>
                                )}
                              </>
                            )}
                          </div>
                        )
                      )}
                    </div>
                  </div>

                  {/* Leave Rules */}
                  <div className="bg-[#0f1419] rounded-lg p-4 border border-[#232945]">
                    <h3 className="text-lg font-semibold text-green-400 mb-3">
                      Leave Rules
                    </h3>
                    <div className="space-y-2">
                      {Object.entries(calculationRules.leaveRules).map(
                        ([key, value]) => (
                          <div
                            key={key}
                            className="flex justify-between text-sm"
                          >
                            <span className="text-gray-400 capitalize">
                              {key.replace(/([A-Z])/g, " $1")}:
                            </span>
                            <span className="text-white">{value}</span>
                          </div>
                        )
                      )}
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Month Selection and Bulk Actions */}
        <div className="bg-[#191f2b]/70 rounded-xl shadow-xl border border-[#232945] p-6 mb-6">
          <div className="flex flex-col lg:flex-row justify-between items-start lg:items-center gap-4">
            <div className="flex items-center gap-4">
              <div>
                <label className="block text-sm text-gray-400 mb-2">
                  Select Month
                </label>
                <input
                  type="month"
                  value={selectedMonth}
                  onChange={(e) => setSelectedMonth(e.target.value)}
                  className="px-4 py-2 bg-[#0f1419] border border-[#232945] rounded-lg text-white focus:outline-none focus:border-blue-500 transition-colors"
                />
              </div>
              <div className="pt-6">
                <button
                  onClick={() => fetchEmployees()}
                  className="px-4 py-2 bg-blue-600/20 hover:bg-blue-600/40 text-blue-400 border border-blue-500/30 rounded-lg transition-colors flex items-center gap-2"
                  disabled={loading}
                >
                  <RefreshCw
                    className={`w-4 h-4 ${loading ? "animate-spin" : ""}`}
                  />
                  Refresh
                </button>
              </div>
            </div>

            <button
              onClick={generateBulkPayslips}
              disabled={bulkGenerating || filteredEmployees.length === 0}
              className="px-6 py-3 bg-gradient-to-r from-green-600 to-emerald-600 hover:from-green-700 hover:to-emerald-700 text-white rounded-lg transition-all flex items-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed shadow-lg hover:shadow-xl"
            >
              {bulkGenerating ? (
                <>
                  <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin"></div>
                  Generating...
                </>
              ) : (
                <>
                  <PlayCircle className="w-5 h-5" />
                  Generate Bulk Payslips ({filteredEmployees.length})
                </>
              )}
            </button>
          </div>

          {/* Bulk Results */}
          {bulkResults && (
            <div className="mt-4 p-4 bg-[#0f1419] rounded-lg border border-[#232945]">
              <h4 className="font-semibold text-white mb-3 flex items-center gap-2">
                <FileText className="w-4 h-4" />
                Bulk Generation Results
              </h4>
              <div className="grid grid-cols-4 gap-4 mb-4">
                <div className="text-center">
                  <p className="text-2xl font-bold text-green-400">
                    {bulkResults.generated}
                  </p>
                  <p className="text-xs text-gray-400">Generated</p>
                </div>
                <div className="text-center">
                  <p className="text-2xl font-bold text-yellow-400">
                    {bulkResults.skipped}
                  </p>
                  <p className="text-xs text-gray-400">Skipped</p>
                </div>
                <div className="text-center">
                  <p className="text-2xl font-bold text-red-400">
                    {bulkResults.failed}
                  </p>
                  <p className="text-xs text-gray-400">Failed</p>
                </div>
                <div className="text-center">
                  <p className="text-2xl font-bold text-blue-400">
                    {bulkResults.total}
                  </p>
                  <p className="text-xs text-gray-400">Total</p>
                </div>
              </div>
              <button
                onClick={() => setBulkResults(null)}
                className="w-full px-4 py-2 bg-gray-600/20 hover:bg-gray-600/40 text-gray-400 rounded-lg transition-colors text-sm"
              >
                Close
              </button>
            </div>
          )}
        </div>

        {/* Filters */}
        <div className="bg-[#191f2b]/70 rounded-xl shadow-xl border border-[#232945] p-6 mb-6">
          <div className="flex flex-wrap items-center gap-4">
            <div className="relative flex-1 min-w-[250px]">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 w-4 h-4 text-gray-500" />
              <input
                type="text"
                placeholder="Search employees..."
                value={filters.search}
                onChange={(e) =>
                  setFilters({ ...filters, search: e.target.value })
                }
                className="w-full pl-10 pr-4 py-2 bg-[#0f1419] border border-[#232945] rounded-lg text-white placeholder-gray-500 focus:outline-none focus:border-blue-500 transition-colors"
              />
            </div>

            <select
              value={filters.department}
              onChange={(e) =>
                setFilters({ ...filters, department: e.target.value })
              }
              className="px-4 py-2 bg-[#0f1419] border border-[#232945] rounded-lg text-white focus:outline-none focus:border-blue-500 transition-colors"
            >
              <option value="">All Departments</option>
              {departments.map((dept) => (
                <option key={dept} value={dept}>
                  {dept}
                </option>
              ))}
            </select>

            {(filters.search || filters.department) && (
              <button
                onClick={() => setFilters({ search: "", department: "" })}
                className="px-4 py-2 bg-gray-600/20 hover:bg-gray-600/40 text-gray-400 rounded-lg transition-colors flex items-center gap-2"
              >
                <X className="w-4 h-4" />
                Clear
              </button>
            )}
          </div>
        </div>

        {/* Employees Table */}
        <div className="bg-[#191f2b]/70 rounded-xl shadow-xl border border-[#232945]">
          <div className="p-6">
            <h3 className="text-lg font-semibold text-white mb-4 flex items-center gap-2">
              <Users className="w-5 h-5 text-blue-400" />
              Employees ({filteredEmployees.length})
            </h3>

            <div className="overflow-x-auto">
              <table className="w-full">
                <thead>
                  <tr className="border-b-2 border-[#232945]">
                    <th className="text-left pl-6 pr-4 py-4 text-sm font-semibold text-gray-400">
                      Employee
                    </th>
                    <th className="text-left pl-6 pr-4 py-4 text-sm font-semibold text-gray-400">
                      Department
                    </th>
                    <th className="text-left pl-6 pr-4 py-4 text-sm font-semibold text-gray-400">
                      Monthly Salary
                    </th>
                    <th className="text-left pl-6 pr-4 py-4 text-sm font-semibold text-gray-400">
                      Actions
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {filteredEmployees.length === 0 ? (
                    <tr>
                      <td colSpan="4" className="text-center py-12">
                        <Users className="w-12 h-12 text-gray-600 mx-auto mb-3" />
                        <p className="text-gray-500">No employees found</p>
                      </td>
                    </tr>
                  ) : (
                    filteredEmployees.map((emp) => (
                      <tr
                        key={emp._id}
                        className="border-b border-[#232945] hover:bg-[#0f1419] transition-colors"
                      >
                        <td className="pl-6 pr-4 py-5">
                          <div className="flex items-center gap-3">
                            <div className="w-10 h-10 rounded-full bg-gradient-to-br from-blue-500 to-purple-500 flex items-center justify-center text-white font-semibold">
                              {emp.name?.charAt(0).toUpperCase()}
                            </div>
                            <div>
                              <p className="text-white font-semibold">
                                {emp.name}
                              </p>
                              <p className="text-sm text-gray-400">
                                {emp.employeeId}
                              </p>
                            </div>
                          </div>
                        </td>
                        <td className="pl-6 pr-4 py-5 text-gray-300">
                          {emp.department || "N/A"}
                        </td>
                        <td className="pl-6 pr-4 py-5 text-white font-semibold">
                          {getMonthlySalary(emp) > 0 ? (
                            formatCurrency(getMonthlySalary(emp))
                          ) : (
                            <span className="text-red-400 text-sm">
                              Not configured
                            </span>
                          )}
                        </td>
                        <td className="pl-6 pr-4 py-5">
                          <div className="flex items-center gap-2">
                            <button
                              onClick={() => previewSalaryCalculation(emp._id)}
                              disabled={loading || getMonthlySalary(emp) === 0}
                              className="inline-flex items-center gap-1 px-3 py-1.5 rounded-lg text-blue-400 hover:text-blue-300 hover:bg-blue-500/10 transition-all text-sm disabled:opacity-50 disabled:cursor-not-allowed"
                              title={
                                getMonthlySalary(emp) === 0
                                  ? "Salary not configured"
                                  : "Preview salary calculation"
                              }
                            >
                              <Eye className="w-3 h-3" />
                              Preview
                            </button>
                            <button
                              onClick={() => generateSinglePayslip(emp._id)}
                              disabled={loading || getMonthlySalary(emp) === 0}
                              className="inline-flex items-center gap-1 px-3 py-1.5 rounded-lg text-green-400 hover:text-green-300 hover:bg-green-500/10 transition-all text-sm disabled:opacity-50 disabled:cursor-not-allowed"
                              title={
                                getMonthlySalary(emp) === 0
                                  ? "Salary not configured"
                                  : "Generate payslip"
                              }
                            >
                              <Play className="w-3 h-3" />
                              Generate
                            </button>
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

        {/* Preview Panel */}
        {previewData && (
          <div className="fixed inset-0 bg-black/70 flex items-center justify-center z-50 p-4">
            <div className="bg-[#191f2b] rounded-xl border border-[#232945] max-w-4xl w-full max-h-[90vh] overflow-y-auto">
              <div className="p-6">
                <div className="flex justify-between items-center mb-6">
                  <h2 className="text-2xl font-bold text-white flex items-center gap-2">
                    <Calculator className="w-6 h-6 text-blue-400" />
                    Salary Preview - {previewData.employee.name}
                  </h2>
                  <button
                    onClick={() => setPreviewData(null)}
                    className="text-gray-400 hover:text-white transition-colors"
                  >
                    <X className="w-6 h-6" />
                  </button>
                </div>

                {/* Attendance Summary */}
                <div className="mb-6">
                  <h3 className="text-lg font-semibold text-blue-400 mb-3">
                    Attendance Summary
                  </h3>
                  <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                    <div className="bg-[#0f1419] rounded-lg p-4 border border-[#232945]">
                      <p className="text-sm text-gray-400 mb-1">Working Days</p>
                      <p className="text-2xl font-bold text-white">
                        {previewData.attendanceData.workingDays}
                      </p>
                    </div>
                    <div className="bg-[#0f1419] rounded-lg p-4 border border-green-500/30">
                      <p className="text-sm text-gray-400 mb-1">Paid Days</p>
                      <p className="text-2xl font-bold text-green-400">
                        {previewData.attendanceData.paidDays}
                      </p>
                    </div>
                    <div className="bg-[#0f1419] rounded-lg p-4 border border-yellow-500/30">
                      <p className="text-sm text-gray-400 mb-1">Late Days</p>
                      <p className="text-2xl font-bold text-yellow-400">
                        {previewData.attendanceData.lateDays}
                      </p>
                    </div>
                    <div className="bg-[#0f1419] rounded-lg p-4 border border-orange-500/30">
                      <p className="text-sm text-gray-400 mb-1">Half Days</p>
                      <p className="text-2xl font-bold text-orange-400">
                        {previewData.attendanceData.halfDays}
                      </p>
                    </div>
                  </div>
                </div>

                {/* Salary Calculation */}
                <div className="mb-6">
                  <h3 className="text-lg font-semibold text-green-400 mb-3">
                    Salary Calculation
                  </h3>
                  <div className="space-y-3">
                    <div className="bg-[#0f1419] rounded-lg p-4 border border-[#232945]">
                      <div className="flex justify-between items-center">
                        <span className="text-gray-400">Gross Total</span>
                        <span className="text-xl font-bold text-green-400">
                          {formatCurrency(previewData.calculations.grossTotal)}
                        </span>
                      </div>
                    </div>

                    <div className="bg-[#0f1419] rounded-lg p-4 border border-[#232945]">
                      <p className="text-sm font-semibold text-red-400 mb-2">
                        Deductions
                      </p>
                      {Object.entries(previewData.calculations.deductions).map(
                        ([key, value]) =>
                          value > 0 && (
                            <div
                              key={key}
                              className="flex justify-between text-sm py-1"
                            >
                              <span className="text-gray-400 capitalize">
                                {key.replace(/([A-Z])/g, " $1")}
                              </span>
                              <span className="text-red-400">
                                -{formatCurrency(value)}
                              </span>
                            </div>
                          )
                      )}
                      <div className="flex justify-between font-semibold pt-2 border-t border-[#232945] mt-2">
                        <span className="text-white">Total Deductions</span>
                        <span className="text-red-400">
                          -
                          {formatCurrency(
                            previewData.calculations.totalDeductions
                          )}
                        </span>
                      </div>
                    </div>

                    <div className="bg-gradient-to-r from-blue-600/20 to-purple-600/20 rounded-lg p-4 border border-blue-500/30">
                      <div className="flex justify-between items-center">
                        <span className="text-white font-semibold">
                          Net Payment
                        </span>
                        <span className="text-3xl font-bold text-white">
                          {formatCurrency(previewData.calculations.netPayment)}
                        </span>
                      </div>
                    </div>
                  </div>
                </div>

                <div className="flex gap-3">
                  <button
                    onClick={() =>
                      generateSinglePayslip(previewData.employee._id)
                    }
                    className="flex-1 px-6 py-3 bg-gradient-to-r from-green-600 to-emerald-600 hover:from-green-700 hover:to-emerald-700 text-white rounded-lg transition-all flex items-center justify-center gap-2"
                  >
                    <Play className="w-5 h-5" />
                    Generate Payslip
                  </button>
                  <button
                    onClick={openEditModal}
                    className="px-6 py-3 bg-blue-600/20 hover:bg-blue-600/40 text-blue-400 border border-blue-500/30 rounded-lg transition-colors flex items-center gap-2"
                  >
                    <Edit className="w-4 h-4" />
                    Edit & Generate
                  </button>
                  <button
                    onClick={() => setPreviewData(null)}
                    className="px-6 py-3 bg-gray-600/20 hover:bg-gray-600/40 text-gray-400 rounded-lg transition-colors"
                  >
                    Close
                  </button>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Edit Modal */}
        {showEditModal && (previewData || editingPayslip) && (
          <div className="fixed inset-0 bg-black/70 flex items-center justify-center z-50 p-4">
            <div className="bg-[#191f2b] rounded-xl border border-[#232945] max-w-2xl w-full max-h-[90vh] overflow-y-auto">
              <div className="p-6">
                <div className="flex justify-between items-center mb-6">
                  <h2 className="text-2xl font-bold text-white flex items-center gap-2">
                    <Edit className="w-6 h-6 text-blue-400" />
                    {editingPayslip ? "Edit & Recalculate Payslip" : "Edit Attendance & Deductions"}
                  </h2>
                  <button
                    onClick={() => {
                      setShowEditModal(false);
                      setEditingPayslip(null);
                    }}
                    className="text-gray-400 hover:text-white transition-colors"
                  >
                    <X className="w-6 h-6" />
                  </button>
                </div>

                <div className="space-y-6">
                  {/* Attendance Section */}
                  <div>
                    <h3 className="text-lg font-semibold text-blue-400 mb-4">
                      Attendance Metrics
                    </h3>
                    <div className="grid grid-cols-2 gap-4">
                      <div>
                        <label className="block text-sm text-gray-400 mb-2">
                          Working Days
                        </label>
                        <input
                          type="number"
                          value={editFormData.workingDays}
                          onChange={(e) =>
                            setEditFormData({
                              ...editFormData,
                              workingDays: Number(e.target.value),
                            })
                          }
                          className="w-full px-4 py-2 bg-[#0f1419] border border-[#232945] rounded-lg text-white focus:outline-none focus:border-blue-500"
                        />
                      </div>
                      <div>
                        <label className="block text-sm text-gray-400 mb-2">
                          Paid Days
                        </label>
                        <input
                          type="number"
                          value={editFormData.paidDays}
                          onChange={(e) =>
                            setEditFormData({
                              ...editFormData,
                              paidDays: Number(e.target.value),
                            })
                          }
                          className="w-full px-4 py-2 bg-[#0f1419] border border-[#232945] rounded-lg text-white focus:outline-none focus:border-blue-500"
                        />
                      </div>
                      <div>
                        <label className="block text-sm text-gray-400 mb-2">
                          Late Days
                        </label>
                        <input
                          type="number"
                          value={editFormData.lateDays}
                          onChange={(e) =>
                            setEditFormData({
                              ...editFormData,
                              lateDays: Number(e.target.value),
                            })
                          }
                          className="w-full px-4 py-2 bg-[#0f1419] border border-[#232945] rounded-lg text-white focus:outline-none focus:border-blue-500"
                        />
                      </div>
                      <div>
                        <label className="block text-sm text-gray-400 mb-2">
                          Half Days
                        </label>
                        <input
                          type="number"
                          value={editFormData.halfDays}
                          onChange={(e) =>
                            setEditFormData({
                              ...editFormData,
                              halfDays: Number(e.target.value),
                            })
                          }
                          className="w-full px-4 py-2 bg-[#0f1419] border border-[#232945] rounded-lg text-white focus:outline-none focus:border-blue-500"
                        />
                      </div>
                    </div>
                  </div>

                  {/* Manual Deductions Section */}
                  <div>
                    <h3 className="text-lg font-semibold text-red-400 mb-4">
                      Manual Deductions
                    </h3>
                    <div className="grid grid-cols-3 gap-4">
                      <div>
                        <label className="block text-sm text-gray-400 mb-2">
                          TDS (₹)
                        </label>
                        <input
                          type="number"
                          value={editFormData.tds}
                          onChange={(e) =>
                            setEditFormData({
                              ...editFormData,
                              tds: Number(e.target.value),
                            })
                          }
                          className="w-full px-4 py-2 bg-[#0f1419] border border-[#232945] rounded-lg text-white focus:outline-none focus:border-blue-500"
                        />
                      </div>
                      <div>
                        <label className="block text-sm text-gray-400 mb-2">
                          Other (₹)
                        </label>
                        <input
                          type="number"
                          value={editFormData.other}
                          onChange={(e) =>
                            setEditFormData({
                              ...editFormData,
                              other: Number(e.target.value),
                            })
                          }
                          className="w-full px-4 py-2 bg-[#0f1419] border border-[#232945] rounded-lg text-white focus:outline-none focus:border-blue-500"
                        />
                      </div>
                      <div>
                        <label className="block text-sm text-gray-400 mb-2">
                          Advance (₹)
                        </label>
                        <input
                          type="number"
                          value={editFormData.advance}
                          onChange={(e) =>
                            setEditFormData({
                              ...editFormData,
                              advance: Number(e.target.value),
                            })
                          }
                          className="w-full px-4 py-2 bg-[#0f1419] border border-[#232945] rounded-lg text-white focus:outline-none focus:border-blue-500"
                        />
                      </div>
                    </div>
                  </div>

                  {/* Remarks */}
                  <div>
                    <label className="block text-sm text-gray-400 mb-2">
                      Remarks (Optional)
                    </label>
                    <textarea
                      value={editFormData.remarks}
                      onChange={(e) =>
                        setEditFormData({
                          ...editFormData,
                          remarks: e.target.value,
                        })
                      }
                      rows="3"
                      className="w-full px-4 py-2 bg-[#0f1419] border border-[#232945] rounded-lg text-white focus:outline-none focus:border-blue-500"
                      placeholder="Add any notes about manual adjustments..."
                    />
                  </div>
                </div>

                <div className="flex gap-3 mt-6">
                  <button
                    onClick={handleEditSubmit}
                    disabled={loading}
                    className="flex-1 px-6 py-3 bg-gradient-to-r from-green-600 to-emerald-600 hover:from-green-700 hover:to-emerald-700 text-white rounded-lg transition-all flex items-center justify-center gap-2 disabled:opacity-50"
                  >
                    <Save className="w-5 h-5" />
                    {loading
                      ? (editingPayslip ? "Recalculating..." : "Generating...")
                      : (editingPayslip ? "Save & Recalculate" : "Generate with Edits")
                    }
                  </button>
                  <button
                    onClick={() => {
                      setShowEditModal(false);
                      setEditingPayslip(null);
                    }}
                    className="px-6 py-3 bg-gray-600/20 hover:bg-gray-600/40 text-gray-400 rounded-lg transition-colors"
                  >
                    Cancel
                  </button>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Generated Payslip Modal with Edit */}
        {showPayslipModal && selectedEmployee && (
          <div className="fixed inset-0 bg-black/70 flex items-center justify-center z-50 p-4">
            <div className="bg-[#191f2b] rounded-xl border border-[#232945] max-w-4xl w-full max-h-[90vh] overflow-y-auto">
              <div className="p-6">
                <div className="flex justify-between items-center mb-6">
                  <h2 className="text-2xl font-bold text-white flex items-center gap-2">
                    <FileText className="w-6 h-6 text-green-400" />
                    Payslip Generated - {selectedEmployee.employee?.name}
                  </h2>
                  <button
                    onClick={() => {
                      setShowPayslipModal(false);
                      setSelectedEmployee(null);
                    }}
                    className="text-gray-400 hover:text-white transition-colors"
                  >
                    <X className="w-6 h-6" />
                  </button>
                </div>

                {/* Attendance Summary */}
                <div className="mb-6">
                  <h3 className="text-lg font-semibold text-blue-400 mb-3">
                    Attendance Summary
                  </h3>
                  <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                    <div className="bg-[#0f1419] rounded-lg p-4 border border-[#232945]">
                      <p className="text-sm text-gray-400 mb-1">Working Days</p>
                      <p className="text-2xl font-bold text-white">
                        {selectedEmployee.workingDays}
                      </p>
                    </div>
                    <div className="bg-[#0f1419] rounded-lg p-4 border border-green-500/30">
                      <p className="text-sm text-gray-400 mb-1">Paid Days</p>
                      <p className="text-2xl font-bold text-green-400">
                        {selectedEmployee.paidDays}
                      </p>
                    </div>
                    <div className="bg-[#0f1419] rounded-lg p-4 border border-yellow-500/30">
                      <p className="text-sm text-gray-400 mb-1">Late Days</p>
                      <p className="text-2xl font-bold text-yellow-400">
                        {selectedEmployee.lateDays || 0}
                      </p>
                    </div>
                    <div className="bg-[#0f1419] rounded-lg p-4 border border-orange-500/30">
                      <p className="text-sm text-gray-400 mb-1">Half Days</p>
                      <p className="text-2xl font-bold text-orange-400">
                        {selectedEmployee.halfDays || 0}
                      </p>
                    </div>
                  </div>
                </div>

                {/* Salary Details */}
                <div className="mb-6">
                  <h3 className="text-lg font-semibold text-green-400 mb-3">
                    Salary Breakdown
                  </h3>
                  <div className="space-y-3">
                    <div className="bg-[#0f1419] rounded-lg p-4 border border-[#232945]">
                      <div className="flex justify-between items-center">
                        <span className="text-gray-400">Gross Total</span>
                        <span className="text-xl font-bold text-green-400">
                          {formatCurrency(selectedEmployee.grossTotal)}
                        </span>
                      </div>
                    </div>

                    <div className="bg-[#0f1419] rounded-lg p-4 border border-[#232945]">
                      <p className="text-sm font-semibold text-red-400 mb-2">
                        Deductions
                      </p>
                      {Object.entries(selectedEmployee.deductions || {}).map(
                        ([key, value]) =>
                          value > 0 && (
                            <div
                              key={key}
                              className="flex justify-between text-sm py-1"
                            >
                              <span className="text-gray-400 capitalize">
                                {key.replace(/([A-Z])/g, " $1")}
                              </span>
                              <span className="text-red-400">
                                -{formatCurrency(value)}
                              </span>
                            </div>
                          )
                      )}
                      <div className="flex justify-between font-semibold pt-2 border-t border-[#232945] mt-2">
                        <span className="text-white">Total Deductions</span>
                        <span className="text-red-400">
                          -{formatCurrency(selectedEmployee.totalDeductions)}
                        </span>
                      </div>
                    </div>

                    <div className="bg-gradient-to-r from-blue-600/20 to-purple-600/20 rounded-lg p-4 border border-blue-500/30">
                      <div className="flex justify-between items-center">
                        <span className="text-white font-semibold">
                          Net Payment
                        </span>
                        <span className="text-3xl font-bold text-white">
                          {formatCurrency(selectedEmployee.netPayment)}
                        </span>
                      </div>
                    </div>
                  </div>
                </div>

                {selectedEmployee.remarks && (
                  <div className="mb-6 p-4 bg-yellow-500/10 border border-yellow-500/30 rounded-lg">
                    <p className="text-sm text-yellow-400">
                      <strong>Remarks:</strong> {selectedEmployee.remarks}
                    </p>
                  </div>
                )}

                <div className="flex gap-3">
                  <button
                    onClick={() => {
                      setEditingPayslip(selectedEmployee);
                      setEditFormData({
                        workingDays: selectedEmployee.workingDays,
                        paidDays: selectedEmployee.paidDays,
                        lateDays: selectedEmployee.lateDays || 0,
                        halfDays: selectedEmployee.halfDays || 0,
                        tds: selectedEmployee.deductions?.tds || 0,
                        other: selectedEmployee.deductions?.other || 0,
                        advance: selectedEmployee.deductions?.advance || 0,
                        remarks: "",
                      });
                      setShowPayslipModal(false);
                      setShowEditModal(true);
                    }}
                    className="px-6 py-3 bg-blue-600/20 hover:bg-blue-600/40 text-blue-400 border border-blue-500/30 rounded-lg transition-colors flex items-center gap-2"
                  >
                    <Edit className="w-4 h-4" />
                    Edit & Recalculate
                  </button>
                  <button
                    onClick={() => {
                      setShowPayslipModal(false);
                      setSelectedEmployee(null);
                    }}
                    className="flex-1 px-6 py-3 bg-gray-600/20 hover:bg-gray-600/40 text-gray-400 rounded-lg transition-colors"
                  >
                    Close
                  </button>
                </div>
              </div>
            </div>
          </div>
        )}
      </main>
    </div>
  );
};

export default AutoPayrollManagement;
