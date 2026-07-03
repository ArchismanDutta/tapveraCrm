import React, { useEffect, useMemo, useState } from "react";
import {
  AlertCircle,
  CheckCircle,
  Clock,
  CreditCard,
  Filter,
  IndianRupee,
  RefreshCw,
  Search,
  Users,
  XCircle,
} from "lucide-react";
import toast from "react-hot-toast";
import Sidebar from "../dashboard/Sidebar";
import ActivatePaymentModal from "./ActivatePaymentModal";
import PendingPaymentsModal from "./PendingPaymentsModal";

const API_URL = import.meta.env.VITE_API_URL || "http://localhost:5000";

const performanceStyles = {
  excellent:
    "border-emerald-200 bg-emerald-50 text-emerald-700 dark:border-emerald-400/20 dark:bg-emerald-400/10 dark:text-emerald-200",
  good: "border-amber-200 bg-amber-50 text-amber-700 dark:border-amber-400/20 dark:bg-amber-400/10 dark:text-amber-200",
  attention:
    "border-orange-200 bg-orange-50 text-orange-700 dark:border-orange-400/20 dark:bg-orange-400/10 dark:text-orange-200",
  critical:
    "border-rose-200 bg-rose-50 text-rose-700 dark:border-rose-400/20 dark:bg-rose-400/10 dark:text-rose-200",
};

const getPerformance = (employee) => {
  const total =
    (employee.taskStats?.dueTasks || 0) +
    (employee.taskStats?.rejectedTasks || 0);
  if (total === 0) return { label: "Excellent", style: performanceStyles.excellent };
  if (total < 3) return { label: "Good", style: performanceStyles.good };
  if (total < 5)
    return { label: "Needs attention", style: performanceStyles.attention };
  return { label: "Critical", style: performanceStyles.critical };
};

const EmployeePaymentManagement = ({ onLogout }) => {
  const [employees, setEmployees] = useState([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState("");
  const [filterBy, setFilterBy] = useState("all");
  const [selectedEmployee, setSelectedEmployee] = useState(null);
  const [showActivateModal, setShowActivateModal] = useState(false);
  const [showPendingPayments, setShowPendingPayments] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);

  const fetchEmployees = async () => {
    try {
      setLoading(true);
      const token = localStorage.getItem("token");
      const response = await fetch(`${API_URL}/api/payments/employees-stats`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      const data = await response.json();

      if (data.success) setEmployees(data.data);
      else toast.error(data.message || "Failed to fetch employees");
    } catch (error) {
      console.error("Error fetching employees:", error);
      toast.error("Failed to fetch employee data");
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  useEffect(() => {
    fetchEmployees();
  }, []);

  const filteredEmployees = useMemo(() => {
    const query = searchTerm.trim().toLowerCase();
    return employees.filter((employee) => {
      const matchesSearch =
        !query ||
        employee.name?.toLowerCase().includes(query) ||
        employee.employeeId?.toLowerCase().includes(query) ||
        employee.email?.toLowerCase().includes(query);

      if (!matchesSearch) return false;
      if (filterBy === "dueTasks") return employee.taskStats?.dueTasks > 0;
      if (filterBy === "rejectedTasks")
        return employee.taskStats?.rejectedTasks > 0;
      if (filterBy === "hasPayment") return employee.hasActivePayment;
      return true;
    });
  }, [employees, filterBy, searchTerm]);

  const stats = useMemo(
    () => ({
      total: employees.length,
      due: employees.filter((employee) => employee.taskStats?.dueTasks > 0)
        .length,
      rejected: employees.filter(
        (employee) => employee.taskStats?.rejectedTasks > 0,
      ).length,
      active: employees.filter((employee) => employee.hasActivePayment).length,
    }),
    [employees],
  );

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

  const summaryMetrics = [
    ["Employees", stats.total, Users, "text-blue-600 dark:text-blue-300"],
    ["Due tasks", stats.due, AlertCircle, "text-rose-600 dark:text-rose-300"],
    [
      "With rejections",
      stats.rejected,
      XCircle,
      "text-orange-600 dark:text-orange-300",
    ],
    [
      "Active payments",
      stats.active,
      CreditCard,
      "text-violet-600 dark:text-violet-300",
    ],
  ];

  return (
    <div className="relative flex h-[100dvh] overflow-hidden bg-slate-50 text-slate-900 dark:bg-[#0b0d12] dark:text-slate-100">
      <Sidebar
        collapsed={sidebarCollapsed}
        setCollapsed={setSidebarCollapsed}
        userRole="super-admin"
        onLogout={onLogout}
      />

      <main
        className={`h-[100dvh] min-w-0 flex-1 overflow-y-auto overflow-x-hidden px-3 py-4 transition-all duration-300 sm:px-5 lg:px-6 ${
          sidebarCollapsed ? "ml-16" : "ml-16 sm:ml-56"
        }`}
      >
        <div className="mx-auto max-w-[1500px] space-y-4 pb-8 sm:space-y-5">
          <header className="rounded-2xl border border-slate-200 bg-white px-5 py-5 shadow-sm dark:border-white/10 dark:bg-[#10131c] sm:px-6">
            <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
              <div>
                <div className="inline-flex items-center gap-2 rounded-lg border border-blue-200 bg-blue-50 px-3 py-1.5 text-xs font-semibold text-blue-700 dark:border-blue-400/20 dark:bg-blue-400/10 dark:text-blue-200">
                  <IndianRupee className="h-3.5 w-3.5" />
                  Payment operations
                </div>
                <h1 className="mt-3 text-2xl font-semibold tracking-tight text-slate-950 dark:text-white">
                  Employee payments
                </h1>
                <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">
                  Review employee task status, activate payment requests, and process pending payments.
                </p>
              </div>
              <button
                type="button"
                onClick={() => setShowPendingPayments(true)}
                className="inline-flex h-10 items-center justify-center gap-2 rounded-lg bg-blue-600 px-4 text-sm font-semibold text-white transition hover:bg-blue-700"
              >
                <Clock className="h-4 w-4" />
                Pending payments
                {stats.active > 0 && (
                  <span className="rounded-full bg-white/20 px-1.5 py-0.5 text-[10px]">
                    {stats.active}
                  </span>
                )}
              </button>
            </div>
          </header>

          <section
            className="grid grid-cols-2 gap-3 lg:grid-cols-4"
            aria-label="Payment summary"
          >
            {summaryMetrics.map(([label, value, Icon, tone]) => (
              <article
                key={label}
                className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm dark:border-white/10 dark:bg-[#10131c]"
              >
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <p className="text-xs font-medium text-slate-500 dark:text-slate-400">
                      {label}
                    </p>
                    <p className="mt-1 text-2xl font-semibold text-slate-950 dark:text-white">
                      {loading ? "—" : value}
                    </p>
                  </div>
                  <span className="flex h-9 w-9 items-center justify-center rounded-xl bg-slate-100 dark:bg-white/[0.05]">
                    {React.createElement(Icon, {
                      className: `h-4 w-4 ${tone}`,
                    })}
                  </span>
                </div>
              </article>
            ))}
          </section>

          <section className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm dark:border-white/10 dark:bg-[#10131c]">
            <div className="border-b border-slate-200 p-4 dark:border-white/10 sm:p-5">
              <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
                <div className="grid min-w-0 flex-1 gap-3 md:grid-cols-[minmax(0,1fr)_210px] lg:max-w-3xl">
                  <label className="relative block">
                    <span className="sr-only">Search employees</span>
                    <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
                    <input
                      type="search"
                      value={searchTerm}
                      onChange={(event) => setSearchTerm(event.target.value)}
                      placeholder="Search name, ID, or email"
                      className="h-10 w-full rounded-xl border border-slate-200 bg-slate-50 pl-10 pr-3 text-sm text-slate-900 outline-none transition placeholder:text-slate-400 focus:border-blue-500 focus:bg-white focus:ring-2 focus:ring-blue-500/15 dark:border-white/10 dark:bg-white/[0.035] dark:text-white dark:focus:bg-white/[0.05]"
                    />
                  </label>
                  <label className="relative block">
                    <span className="sr-only">Filter employees</span>
                    <Filter className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
                    <select
                      value={filterBy}
                      onChange={(event) => setFilterBy(event.target.value)}
                      className="h-10 w-full appearance-none rounded-xl border border-slate-200 bg-white pl-10 pr-8 text-sm text-slate-700 outline-none transition focus:border-blue-500 focus:ring-2 focus:ring-blue-500/15 dark:border-white/10 dark:bg-[#151923] dark:text-slate-200"
                    >
                      <option value="all">All employees</option>
                      <option value="dueTasks">Has due tasks</option>
                      <option value="rejectedTasks">Has rejections</option>
                      <option value="hasPayment">Active payment</option>
                    </select>
                  </label>
                </div>
                <button
                  type="button"
                  onClick={handleRefresh}
                  disabled={refreshing}
                  className="inline-flex h-10 items-center justify-center gap-2 rounded-lg border border-slate-200 bg-white px-3 text-sm font-semibold text-slate-700 transition hover:bg-slate-50 disabled:opacity-50 dark:border-white/10 dark:bg-white/[0.04] dark:text-slate-200 dark:hover:bg-white/[0.07]"
                >
                  <RefreshCw
                    className={`h-4 w-4 ${refreshing ? "animate-spin" : ""}`}
                  />
                  Refresh
                </button>
              </div>
              <p className="mt-3 text-xs text-slate-500 dark:text-slate-400">
                Showing {filteredEmployees.length} of {employees.length} employees
              </p>
            </div>

            {loading ? (
              <div className="space-y-3 p-4 sm:p-5">
                {[0, 1, 2, 3, 4].map((item) => (
                  <div
                    key={item}
                    className="h-16 animate-pulse rounded-xl bg-slate-100 dark:bg-white/[0.04]"
                  />
                ))}
              </div>
            ) : filteredEmployees.length === 0 ? (
              <div className="px-6 py-16 text-center">
                <span className="mx-auto flex h-12 w-12 items-center justify-center rounded-xl bg-slate-100 text-slate-400 dark:bg-white/[0.05]">
                  <Search className="h-5 w-5" />
                </span>
                <h2 className="mt-4 text-sm font-semibold text-slate-900 dark:text-white">
                  No matching employees
                </h2>
                <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">
                  Try changing the search term or payment filter.
                </p>
              </div>
            ) : (
              <>
                <div className="space-y-3 p-4 md:hidden">
                  {filteredEmployees.map((employee) => {
                    const performance = getPerformance(employee);
                    return (
                      <article
                        key={employee._id}
                        className="rounded-xl border border-slate-200 p-4 dark:border-white/10"
                      >
                        <div className="flex items-start gap-3">
                          <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-gradient-to-br from-blue-500 to-indigo-600 text-sm font-semibold text-white">
                            {employee.name?.charAt(0)?.toUpperCase() || "?"}
                          </span>
                          <div className="min-w-0 flex-1">
                            <p className="truncate text-sm font-semibold text-slate-900 dark:text-white">
                              {employee.name}
                            </p>
                            <p className="truncate text-xs text-slate-500 dark:text-slate-400">
                              {employee.employeeId} · {employee.department || "No department"}
                            </p>
                          </div>
                          <span className={`rounded-full border px-2 py-1 text-[11px] font-semibold ${performance.style}`}>
                            {performance.label}
                          </span>
                        </div>
                        <div className="mt-4 grid grid-cols-2 gap-3 border-t border-slate-200 pt-3 text-xs dark:border-white/10">
                          <div>
                            <span className="text-slate-500 dark:text-slate-400">Due tasks</span>
                            <p className="mt-1 font-semibold text-slate-900 dark:text-white">
                              {employee.taskStats?.dueTasks || 0}
                            </p>
                          </div>
                          <div>
                            <span className="text-slate-500 dark:text-slate-400">Rejections</span>
                            <p className="mt-1 font-semibold text-slate-900 dark:text-white">
                              {employee.taskStats?.rejectedTasks || 0}
                            </p>
                          </div>
                        </div>
                        <button
                          type="button"
                          onClick={() => handleActivatePayment(employee)}
                          disabled={employee.hasActivePayment}
                          className="mt-4 inline-flex h-9 w-full items-center justify-center gap-2 rounded-lg bg-blue-600 px-3 text-xs font-semibold text-white transition hover:bg-blue-700 disabled:cursor-not-allowed disabled:bg-slate-100 disabled:text-slate-400 dark:disabled:bg-white/[0.05]"
                        >
                          {employee.hasActivePayment ? (
                            <><Clock className="h-3.5 w-3.5" />Payment pending</>
                          ) : (
                            <><IndianRupee className="h-3.5 w-3.5" />Activate payment</>
                          )}
                        </button>
                      </article>
                    );
                  })}
                </div>

                <div className="hidden overflow-x-auto md:block">
                  <table className="w-full min-w-[980px] text-left">
                    <thead className="bg-slate-50 dark:bg-white/[0.02]">
                      <tr className="border-b border-slate-200 dark:border-white/10">
                        {["Employee", "Department", "Due tasks", "Rejections", "Performance", "Status", ""].map(
                          (heading) => (
                            <th
                              key={heading || "actions"}
                              className="px-5 py-3 text-[11px] font-semibold uppercase tracking-wider text-slate-500 dark:text-slate-400"
                            >
                              {heading}
                            </th>
                          ),
                        )}
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-200 dark:divide-white/10">
                      {filteredEmployees.map((employee) => {
                        const performance = getPerformance(employee);
                        return (
                          <tr
                            key={employee._id}
                            className="transition hover:bg-slate-50 dark:hover:bg-white/[0.025]"
                          >
                            <td className="px-5 py-3.5">
                              <div className="flex items-center gap-3">
                                <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-gradient-to-br from-blue-500 to-indigo-600 text-sm font-semibold text-white">
                                  {employee.name?.charAt(0)?.toUpperCase() || "?"}
                                </span>
                                <div className="min-w-0">
                                  <p className="truncate text-sm font-semibold text-slate-900 dark:text-white">
                                    {employee.name}
                                  </p>
                                  <p className="truncate text-xs text-slate-500 dark:text-slate-400">
                                    {employee.employeeId}
                                  </p>
                                </div>
                              </div>
                            </td>
                            <td className="px-5 py-3.5">
                              <p className="text-sm text-slate-700 dark:text-slate-200">
                                {employee.department?.replace(/([A-Z])/g, " $1").trim() || "—"}
                              </p>
                              <p className="mt-0.5 text-xs text-slate-500 dark:text-slate-400">
                                {employee.designation || "No designation"}
                              </p>
                            </td>
                            <td className="px-5 py-3.5 text-center text-sm font-semibold text-slate-700 dark:text-slate-200">
                              {employee.taskStats?.dueTasks || 0}
                            </td>
                            <td className="px-5 py-3.5 text-center text-sm font-semibold text-slate-700 dark:text-slate-200">
                              {employee.taskStats?.rejectedTasks || 0}
                            </td>
                            <td className="px-5 py-3.5">
                              <span className={`rounded-full border px-2.5 py-1 text-[11px] font-semibold ${performance.style}`}>
                                {performance.label}
                              </span>
                            </td>
                            <td className="px-5 py-3.5">
                              {employee.hasActivePayment ? (
                                <span className="inline-flex items-center gap-1.5 text-xs font-medium text-amber-700 dark:text-amber-300">
                                  <Clock className="h-3.5 w-3.5" /> Payment pending
                                </span>
                              ) : (
                                <span className="inline-flex items-center gap-1.5 text-xs font-medium text-emerald-700 dark:text-emerald-300">
                                  <CheckCircle className="h-3.5 w-3.5" /> Available
                                </span>
                              )}
                            </td>
                            <td className="px-5 py-3.5 text-right">
                              <button
                                type="button"
                                onClick={() => handleActivatePayment(employee)}
                                disabled={employee.hasActivePayment}
                                className="inline-flex h-9 items-center justify-center gap-1.5 rounded-lg bg-blue-600 px-3 text-xs font-semibold text-white transition hover:bg-blue-700 disabled:cursor-not-allowed disabled:bg-slate-100 disabled:text-slate-400 dark:disabled:bg-white/[0.05]"
                              >
                                <IndianRupee className="h-3.5 w-3.5" />
                                {employee.hasActivePayment ? "QR active" : "Activate"}
                              </button>
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              </>
            )}
          </section>
        </div>
      </main>

      {showActivateModal && selectedEmployee && (
        <ActivatePaymentModal
          employee={selectedEmployee}
          onClose={() => setShowActivateModal(false)}
          onSuccess={handlePaymentActivated}
        />
      )}

      {showPendingPayments && (
        <PendingPaymentsModal
          onClose={() => setShowPendingPayments(false)}
          onPaymentUpdated={fetchEmployees}
        />
      )}
    </div>
  );
};

export default EmployeePaymentManagement;
