import React, { useCallback, useEffect, useMemo, useState } from "react";
import axios from "axios";
import { useNavigate } from "react-router-dom";
import {
  Activity,
  AlertCircle,
  Calendar,
  CheckCircle2,
  Coffee,
  Download,
  Filter,
  RefreshCw,
  Search,
  UserCheck,
  Users,
  UserX,
} from "lucide-react";
import { attendanceUtils } from "../api.js";
import Sidebar from "../components/dashboard/Sidebar";
import CelebrationPopup from "../components/common/CelebrationPopup";
import useCelebrationNotifications from "../hooks/useCelebrationNotifications";

const API_BASE = import.meta.env.VITE_API_BASE || "http://localhost:5000";

const getLocalDateInput = (date = new Date()) => {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
};

const parseWorkDuration = (duration) => {
  if (!duration || typeof duration !== "string") return 0;
  const hours = Number(duration.match(/(\d+)h/)?.[1] || 0);
  const minutes = Number(duration.match(/(\d+)m/)?.[1] || 0);
  return hours + minutes / 60;
};

const formatHMS = (seconds = 0) => {
  const h = Math.floor(seconds / 3600);
  const m = Math.floor((seconds % 3600) / 60);
  const s = seconds % 60;
  return `${h}h ${m.toString().padStart(2, "0")}m ${s.toString().padStart(2, "0")}s`;
};

const calculateLiveDuration = (employee) => {
  if (!employee.timeline || !Array.isArray(employee.timeline)) {
    return { workSeconds: 0, breakSeconds: 0 };
  }

  const now = new Date();
  const todayStart = new Date(now);
  todayStart.setHours(0, 0, 0, 0);

  const events = employee.timeline
    .filter(e => {
      const eventDate = new Date(e.time || e.timestamp);
      return eventDate >= todayStart && eventDate <= now;
    })
    .sort((a, b) => new Date(a.time || a.timestamp) - new Date(b.time || b.timestamp));

  let totalWorkSeconds = 0;
  let totalBreakSeconds = 0;
  let currentSessionStart = null;
  let currentBreakStart = null;

  for (const event of events) {
    const eventType = (event.type || '').toUpperCase();
    const eventTime = new Date(event.time || event.timestamp);

    if (eventType === 'PUNCH_IN' || eventType === 'BREAK_END' || eventType === 'RESUME_WORK') {
      currentSessionStart = eventTime;
      if (currentBreakStart) {
        totalBreakSeconds += Math.floor((eventTime - currentBreakStart) / 1000);
        currentBreakStart = null;
      }
    } else if (eventType === 'BREAK_START') {
      if (currentSessionStart) {
        totalWorkSeconds += Math.floor((eventTime - currentSessionStart) / 1000);
        currentSessionStart = null;
      }
      currentBreakStart = eventTime;
    } else if (eventType === 'PUNCH_OUT') {
      if (currentSessionStart) {
        totalWorkSeconds += Math.floor((eventTime - currentSessionStart) / 1000);
        currentSessionStart = null;
      }
      if (currentBreakStart) {
        totalBreakSeconds += Math.floor((eventTime - currentBreakStart) / 1000);
        currentBreakStart = null;
      }
    }
  }

  // Add ongoing session time
  if (currentSessionStart && employee.currentlyWorking) {
    totalWorkSeconds += Math.floor((now - currentSessionStart) / 1000);
  }

  if (currentBreakStart && employee.onBreak) {
    totalBreakSeconds += Math.floor((now - currentBreakStart) / 1000);
  }

  return { workSeconds: totalWorkSeconds, breakSeconds: totalBreakSeconds };
};

const formatTime = (value) => {
  if (!value) return "—";

  try {
    return attendanceUtils.formatTime(value) || "—";
  } catch {
    const date = new Date(value);
    return Number.isNaN(date.getTime())
      ? "—"
      : date.toLocaleTimeString("en-IN", {
          hour: "2-digit",
          minute: "2-digit",
        });
  }
};

const getStatusKey = (employee) => {
  if (employee.onBreak) return "break";
  if (employee.currentlyWorking) return "working";
  if (employee.punchOutTime) return "completed";
  if (!employee.arrivalTime) return "absent";
  return "inactive";
};

const STATUS_META = {
  working: {
    label: "Working",
    dot: "bg-emerald-500",
    badge:
      "border-emerald-200 bg-emerald-50 text-emerald-700 dark:border-emerald-400/20 dark:bg-emerald-400/10 dark:text-emerald-200",
  },
  break: {
    label: "On break",
    dot: "bg-amber-500",
    badge:
      "border-amber-200 bg-amber-50 text-amber-700 dark:border-amber-400/20 dark:bg-amber-400/10 dark:text-amber-200",
  },
  completed: {
    label: "Shift complete",
    dot: "bg-violet-500",
    badge:
      "border-violet-200 bg-violet-50 text-violet-700 dark:border-violet-400/20 dark:bg-violet-400/10 dark:text-violet-200",
  },
  absent: {
    label: "Not checked in",
    dot: "bg-slate-400",
    badge:
      "border-slate-200 bg-slate-100 text-slate-600 dark:border-white/10 dark:bg-white/[0.05] dark:text-slate-300",
  },
  inactive: {
    label: "Inactive",
    dot: "bg-sky-500",
    badge:
      "border-sky-200 bg-sky-50 text-sky-700 dark:border-sky-400/20 dark:bg-sky-400/10 dark:text-sky-200",
  },
};

const TONE_STYLES = {
  blue: "border-blue-200 bg-blue-50 text-blue-700 dark:border-blue-400/20 dark:bg-blue-400/10 dark:text-blue-200",
  emerald:
    "border-emerald-200 bg-emerald-50 text-emerald-700 dark:border-emerald-400/20 dark:bg-emerald-400/10 dark:text-emerald-200",
  amber:
    "border-amber-200 bg-amber-50 text-amber-700 dark:border-amber-400/20 dark:bg-amber-400/10 dark:text-amber-200",
  rose: "border-rose-200 bg-rose-50 text-rose-700 dark:border-rose-400/20 dark:bg-rose-400/10 dark:text-rose-200",
};

const MetricCard = ({ icon, label, value, helper, tone }) => (
  <article className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm dark:border-white/10 dark:bg-[#10131c]">
    <div className="flex items-start justify-between gap-3">
      <div>
        <p className="text-xs font-medium text-slate-500 dark:text-slate-400">
          {label}
        </p>
        <p className="mt-1 text-2xl font-semibold tracking-tight text-slate-950 dark:text-white">
          {value}
        </p>
        <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">
          {helper}
        </p>
      </div>
      <span
        className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-xl border ${TONE_STYLES[tone]}`}
      >
        {React.createElement(icon, {
          className: "h-4 w-4",
          "aria-hidden": "true",
        })}
      </span>
    </div>
  </article>
);

const StatusBadge = ({ employee }) => {
  const status = getStatusKey(employee);
  const meta = STATUS_META[status];

  return (
    <div className="flex flex-wrap items-center gap-1.5">
      <span
        className={`inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-[11px] font-semibold ${meta.badge}`}
      >
        <span className={`h-1.5 w-1.5 rounded-full ${meta.dot}`} />
        {meta.label}
      </span>

      {/* Late Badge */}
      {employee.isLate && employee.arrivalTime && (
        <span className="inline-flex items-center gap-1 rounded-full border border-rose-200 bg-rose-50 px-2 py-0.5 text-[10px] font-semibold text-rose-700 dark:border-rose-400/20 dark:bg-rose-400/10 dark:text-rose-200">
          🔴 Late
        </span>
      )}

      {/* Overtime Badge */}
      {employee.isOvertime && employee.currentlyWorking && (
        <span className="inline-flex items-center gap-1 rounded-full border border-blue-200 bg-blue-50 px-2 py-0.5 text-[10px] font-semibold text-blue-700 dark:border-blue-400/20 dark:bg-blue-400/10 dark:text-blue-200">
          ⏰ Overtime
        </span>
      )}
    </div>
  );
};

const LiveWorkDuration = ({ employee }) => {
  const [seconds, setSeconds] = React.useState(0);

  React.useEffect(() => {
    const updateDuration = () => {
      const { workSeconds } = calculateLiveDuration(employee);
      setSeconds(workSeconds);
    };

    updateDuration();

    // Only update if currently working or if they have worked today
    if (employee.currentlyWorking || employee.arrivalTime) {
      const interval = setInterval(updateDuration, 1000);
      return () => clearInterval(interval);
    }
  }, [employee]);

  return <span>{formatHMS(seconds)}</span>;
};

const LiveBreakDuration = ({ employee }) => {
  const [seconds, setSeconds] = React.useState(0);

  React.useEffect(() => {
    const updateDuration = () => {
      const { breakSeconds } = calculateLiveDuration(employee);
      setSeconds(breakSeconds);
    };

    updateDuration();

    // Only update if on break or if they have taken breaks today
    if (employee.onBreak || (employee.timeline && employee.timeline.some(e => (e.type || '').toUpperCase().includes('BREAK')))) {
      const interval = setInterval(updateDuration, 1000);
      return () => clearInterval(interval);
    }
  }, [employee]);

  return <span>{formatHMS(seconds)}</span>;
};

const EmployeeIdentity = ({ employee }) => (
  <div className="flex min-w-0 items-center gap-3">
    <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-gradient-to-br from-blue-500 to-indigo-600 text-sm font-semibold text-white">
      {employee.name?.trim()?.charAt(0)?.toUpperCase() || "?"}
    </span>
    <div className="min-w-0">
      <p className="truncate text-sm font-semibold text-slate-900 dark:text-white">
        {employee.name}
      </p>
      <p className="mt-0.5 truncate text-xs text-slate-500 dark:text-slate-400">
        {employee.employeeId} · {employee.role || "Employee"}
      </p>
    </div>
  </div>
);

const EmployeeMobileCard = ({ employee }) => {
  return (
    <article className="rounded-xl border border-slate-200 bg-white p-4 dark:border-white/10 dark:bg-white/[0.02]">
      <div className="flex items-start justify-between gap-3">
        <EmployeeIdentity employee={employee} />
        <StatusBadge employee={employee} />
      </div>
      <dl className="mt-4 grid grid-cols-2 gap-x-4 gap-y-3 border-t border-slate-200 pt-3 text-xs dark:border-white/10">
        <div>
          <dt className="text-slate-400">Punch in</dt>
          <dd className="mt-1 font-semibold text-slate-700 dark:text-slate-200">
            {formatTime(employee.arrivalTime)}
          </dd>
        </div>
        <div>
          <dt className="text-slate-400">Punch out</dt>
          <dd className="mt-1 font-semibold text-slate-700 dark:text-slate-200">
            {formatTime(employee.punchOutTime)}
          </dd>
        </div>
        <div>
          <dt className="text-slate-400">Work time</dt>
          <dd className="mt-1 font-semibold text-slate-700 dark:text-slate-200">
            <LiveWorkDuration employee={employee} />
          </dd>
        </div>
        <div>
          <dt className="text-slate-400">Break time</dt>
          <dd className="mt-1 font-semibold text-slate-700 dark:text-slate-200">
            <LiveBreakDuration employee={employee} />
          </dd>
        </div>
      </dl>
    </article>
  );
};

const SuperAdminDashboard = ({ onLogout }) => {
  const navigate = useNavigate();
  const [employees, setEmployees] = useState([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState("");
  const [selectedDate, setSelectedDate] = useState(getLocalDateInput);
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);
  const [currentTime, setCurrentTime] = useState(new Date());
  const [searchTerm, setSearchTerm] = useState("");
  const [filterStatus, setFilterStatus] = useState("all");
  const [lastUpdateTime, setLastUpdateTime] = useState(null);

  const {
    celebrations,
    showPopup: showCelebrationPopup,
    closePopup: closeCelebrationPopup,
  } = useCelebrationNotifications();

  const fetchEmployees = useCallback(async (date, { background = false } = {}) => {
    if (background) setRefreshing(true);
    else setLoading(true);
    setError("");

    try {
      const token = localStorage.getItem("token");
      const response = await axios.get(
        `${API_BASE}/api/super-admin/employees-today`,
        {
          headers: { Authorization: `Bearer ${token}` },
          params: { date, _timestamp: Date.now() },
        },
      );
      const responseData = Array.isArray(response.data)
        ? response.data
        : response.data?.data;

      const normalizedEmployees = (Array.isArray(responseData)
        ? responseData
        : []
      ).map((employee) => ({
        ...employee,
        employeeId: employee.employeeId || "ID unavailable",
        name: employee.name || "Unknown employee",
        role: employee.role || "employee",
        arrivalTime: employee.arrivalTime || null,
        punchOutTime: employee.punchOutTime || null,
        onBreak: Boolean(employee.onBreak),
        currentlyWorking: Boolean(employee.currentlyWorking),
        breakDurationMinutes: Number(employee.breakDurationMinutes) || 0,
        workDuration: employee.workDuration || "0h 0m",
        totalWorkHours: parseWorkDuration(employee.workDuration),
      }));

      const priority = {
        working: 0,
        break: 1,
        inactive: 2,
        completed: 3,
        absent: 4,
      };

      normalizedEmployees.sort((left, right) => {
        const statusDifference =
          priority[getStatusKey(left)] - priority[getStatusKey(right)];
        return (
          statusDifference || left.name.localeCompare(right.name, "en-IN")
        );
      });

      setEmployees(normalizedEmployees);
      setLastUpdateTime(new Date());
    } catch (requestError) {
      console.error("Unable to load workforce status:", requestError);
      const status = requestError.response?.status;
      setError(
        status === 401
          ? "Your session has expired. Please sign in again."
          : status === 403
            ? "You do not have permission to view workforce status."
            : requestError.response?.data?.message ||
              requestError.response?.data?.error ||
              "Workforce status could not be loaded. Please try again.",
      );
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useEffect(() => {
    fetchEmployees(selectedDate);
  }, [fetchEmployees, selectedDate]);

  useEffect(() => {
    const timer = window.setInterval(() => setCurrentTime(new Date()), 30000);
    return () => window.clearInterval(timer);
  }, []);

  // Background refresh of today's workforce snapshot. Previously a 30s poll;
  // now driven by the server's "attendance:updated" broadcast (see
  // AttendanceController.punchAction / manualPunchAction), which fires the
  // moment anyone punches in/out, starts/ends a break, or has a manual edit
  // — so this only refetches when something actually changed, and picks it
  // up immediately instead of up to 30s late. Still scoped to "viewing
  // today", same as the poll was, since a past date's snapshot won't change.
  useEffect(() => {
    if (selectedDate !== getLocalDateInput()) return undefined;

    const handleLiveUpdate = () => fetchEmployees(selectedDate, { background: true });
    window.addEventListener('attendance-updated', handleLiveUpdate);
    return () => window.removeEventListener('attendance-updated', handleLiveUpdate);
  }, [fetchEmployees, selectedDate]);

  const stats = useMemo(() => {
    const presentEmployees = employees.filter(
      (employee) => employee.arrivalTime,
    );
    const working = employees.filter(
      (employee) => employee.currentlyWorking && !employee.onBreak,
    ).length;
    const onBreak = employees.filter((employee) => employee.onBreak).length;
    const completed = employees.filter(
      (employee) => employee.punchOutTime,
    ).length;
    const totalWorkHours = presentEmployees.reduce(
      (sum, employee) => sum + employee.totalWorkHours,
      0,
    );

    return {
      total: employees.length,
      present: presentEmployees.length,
      absent: employees.length - presentEmployees.length,
      working,
      onBreak,
      completed,
      attendanceRate:
        employees.length > 0
          ? Math.round((presentEmployees.length / employees.length) * 100)
          : 0,
      averageWorkHours:
        presentEmployees.length > 0
          ? totalWorkHours / presentEmployees.length
          : 0,
    };
  }, [employees]);

  const filteredEmployees = useMemo(() => {
    const query = searchTerm.trim().toLowerCase();

    return employees.filter((employee) => {
      const matchesQuery =
        !query ||
        [employee.name, employee.employeeId, employee.role]
          .filter(Boolean)
          .some((value) => String(value).toLowerCase().includes(query));
      const matchesStatus =
        filterStatus === "all" || getStatusKey(employee) === filterStatus;
      return matchesQuery && matchesStatus;
    });
  }, [employees, filterStatus, searchTerm]);

  const handleExport = () => {
    if (filteredEmployees.length === 0) return;

    const escapeCell = (value) =>
      `"${String(value ?? "").replaceAll('"', '""')}"`;
    const rows = filteredEmployees.map((employee) => [
      selectedDate,
      employee.employeeId,
      employee.name,
      employee.role,
      STATUS_META[getStatusKey(employee)].label,
      formatTime(employee.arrivalTime),
      formatTime(employee.punchOutTime),
      employee.workDuration,
      attendanceUtils.calculateBreakMinutes(employee, employee.onBreak),
    ]);
    const csv = [
      [
        "Date",
        "Employee ID",
        "Name",
        "Role",
        "Status",
        "Punch In",
        "Punch Out",
        "Work Duration",
        "Break Minutes",
      ],
      ...rows,
    ]
      .map((row) => row.map(escapeCell).join(","))
      .join("\n");

    const blob = new Blob([csv], { type: "text/csv;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = `attendance-${selectedDate}.csv`;
    document.body.appendChild(link);
    link.click();
    link.remove();
    URL.revokeObjectURL(url);
  };

  const isToday = selectedDate === getLocalDateInput();
  const dateLabel = new Date(`${selectedDate}T00:00:00`).toLocaleDateString(
    "en-IN",
    { weekday: "short", day: "numeric", month: "short", year: "numeric" },
  );
  const hasFilters = searchTerm || filterStatus !== "all";

  return (
    <div className="relative flex h-[100dvh] overflow-hidden bg-slate-50 text-slate-900 dark:bg-[#0b0d12] dark:text-slate-100">
      <Sidebar
        collapsed={sidebarCollapsed}
        setCollapsed={setSidebarCollapsed}
        onLogout={onLogout}
        userRole="super-admin"
      />

      <main
        className={`h-[100dvh] min-w-0 flex-1 overflow-y-auto overflow-x-hidden px-3 py-4 transition-all duration-300 sm:px-5 lg:px-6 ${
          sidebarCollapsed ? "ml-16" : "ml-16 sm:ml-56"
        }`}
      >
        <div className="mx-auto max-w-[1500px] space-y-4 pb-8 sm:space-y-5">
          <section className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm dark:border-white/10 dark:bg-[#10131c]">
            <div className="flex flex-col gap-5 p-4 lg:flex-row lg:items-center lg:justify-between lg:p-5">
              <div className="min-w-0">
                <div className="mb-3 flex flex-wrap items-center gap-2">
                  <span className="inline-flex items-center gap-2 rounded-lg border border-blue-200 bg-blue-50 px-3 py-1.5 text-xs font-semibold text-blue-700 dark:border-blue-400/20 dark:bg-blue-400/10 dark:text-blue-200">
                    <Activity className="h-3.5 w-3.5" />
                    Super admin
                  </span>
                  {isToday && (
                    <span className="inline-flex items-center gap-1.5 rounded-lg border border-emerald-200 bg-emerald-50 px-2.5 py-1.5 text-xs font-medium text-emerald-700 dark:border-emerald-400/20 dark:bg-emerald-400/10 dark:text-emerald-200">
                      <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-emerald-500" />
                      Live workforce
                    </span>
                  )}
                </div>
                <h1 className="text-2xl font-semibold tracking-tight text-slate-950 dark:text-white">
                  Workforce control center
                </h1>
                <p className="mt-1 max-w-2xl text-sm text-slate-500 dark:text-slate-400">
                  See who is available, spot attendance gaps, and move directly to the records that need attention.
                </p>
              </div>

              <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
                <label className="relative block">
                  <span className="sr-only">Attendance date</span>
                  <Calendar className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
                  <input
                    type="date"
                    value={selectedDate}
                    max={getLocalDateInput()}
                    onChange={(event) => setSelectedDate(event.target.value)}
                    className="h-10 w-full rounded-lg border border-slate-200 bg-white pl-10 pr-3 text-sm font-medium text-slate-700 outline-none transition focus:border-blue-400 focus:ring-2 focus:ring-blue-100 dark:border-white/10 dark:bg-white/[0.04] dark:text-slate-200 dark:focus:ring-blue-400/10 sm:w-auto"
                  />
                </label>
                <button
                  type="button"
                  onClick={() =>
                    fetchEmployees(selectedDate, { background: true })
                  }
                  disabled={loading || refreshing}
                  className="inline-flex h-10 items-center justify-center gap-2 rounded-lg bg-blue-600 px-4 text-sm font-semibold text-white transition hover:bg-blue-700 disabled:cursor-not-allowed disabled:opacity-60 dark:bg-blue-500 dark:hover:bg-blue-400"
                >
                  <RefreshCw
                    className={`h-4 w-4 ${refreshing ? "animate-spin" : ""}`}
                  />
                  {refreshing ? "Refreshing" : "Refresh"}
                </button>
              </div>
            </div>

            <div className="flex flex-wrap items-center justify-between gap-2 border-t border-slate-200 bg-slate-50 px-4 py-3 text-xs text-slate-500 dark:border-white/10 dark:bg-white/[0.02] dark:text-slate-400 lg:px-5">
              <span>{dateLabel}</span>
              <span>
                {lastUpdateTime
                  ? `Updated ${lastUpdateTime.toLocaleTimeString("en-IN", {
                      hour: "2-digit",
                      minute: "2-digit",
                    })}`
                  : `Local time ${currentTime.toLocaleTimeString("en-IN", {
                      hour: "2-digit",
                      minute: "2-digit",
                    })}`}
              </span>
            </div>
          </section>

          <section className="grid grid-cols-2 gap-3 lg:grid-cols-4" aria-label="Workforce summary">
            <MetricCard
              icon={UserCheck}
              label="Present"
              value={loading ? "—" : stats.present}
              helper={`${stats.attendanceRate}% attendance`}
              tone="blue"
            />
            <MetricCard
              icon={CheckCircle2}
              label="Working now"
              value={loading ? "—" : stats.working}
              helper={`${stats.completed} completed shift${stats.completed === 1 ? "" : "s"}`}
              tone="emerald"
            />
            <MetricCard
              icon={Coffee}
              label="On break"
              value={loading ? "—" : stats.onBreak}
              helper="Currently unavailable"
              tone="amber"
            />
            <MetricCard
              icon={UserX}
              label="Not checked in"
              value={loading ? "—" : stats.absent}
              helper={`Of ${stats.total} team members`}
              tone="rose"
            />
          </section>

          <section className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm dark:border-white/10 dark:bg-[#10131c]">
              <div className="border-b border-slate-200 p-4 dark:border-white/10 sm:p-5">
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div>
                    <h2 className="text-base font-semibold text-slate-950 dark:text-white">
                      Employee status
                    </h2>
                    <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">
                      {filteredEmployees.length} of {employees.length} team members shown
                    </p>
                  </div>
                  <button
                    type="button"
                    onClick={handleExport}
                    disabled={filteredEmployees.length === 0}
                    className="inline-flex h-9 items-center justify-center gap-2 rounded-lg border border-slate-200 bg-white px-3 text-xs font-semibold text-slate-700 transition hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-50 dark:border-white/10 dark:bg-white/[0.04] dark:text-slate-200 dark:hover:bg-white/[0.07]"
                  >
                    <Download className="h-3.5 w-3.5" />
                    Export CSV
                  </button>
                </div>

                <div className="mt-4 grid gap-3 md:grid-cols-[minmax(0,1fr)_190px]">
                  <label className="relative block">
                    <span className="sr-only">Search employees</span>
                    <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
                    <input
                      type="search"
                      value={searchTerm}
                      onChange={(event) => setSearchTerm(event.target.value)}
                      placeholder="Search name, ID or role"
                      className="h-10 w-full rounded-lg border border-slate-200 bg-white pl-10 pr-3 text-sm text-slate-900 outline-none transition placeholder:text-slate-400 focus:border-blue-400 focus:ring-2 focus:ring-blue-100 dark:border-white/10 dark:bg-white/[0.04] dark:text-white dark:focus:ring-blue-400/10"
                    />
                  </label>
                  <label className="relative block">
                    <span className="sr-only">Filter employee status</span>
                    <Filter className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
                    <select
                      value={filterStatus}
                      onChange={(event) => setFilterStatus(event.target.value)}
                      className="h-10 w-full appearance-none rounded-lg border border-slate-200 bg-white pl-10 pr-8 text-sm text-slate-700 outline-none transition focus:border-blue-400 focus:ring-2 focus:ring-blue-100 dark:border-white/10 dark:bg-[#151923] dark:text-slate-200 dark:focus:ring-blue-400/10"
                    >
                      <option value="all">All statuses</option>
                      <option value="working">Working</option>
                      <option value="break">On break</option>
                      <option value="completed">Shift complete</option>
                      <option value="inactive">Inactive</option>
                      <option value="absent">Not checked in</option>
                    </select>
                  </label>
                </div>

                {hasFilters && (
                  <button
                    type="button"
                    onClick={() => {
                      setSearchTerm("");
                      setFilterStatus("all");
                    }}
                    className="mt-3 text-xs font-semibold text-blue-600 hover:text-blue-700 dark:text-blue-300 dark:hover:text-blue-200"
                  >
                    Clear filters
                  </button>
                )}
              </div>

              {error ? (
                <div className="m-4 flex flex-col gap-3 rounded-xl border border-rose-200 bg-rose-50 p-4 text-sm text-rose-700 dark:border-rose-400/20 dark:bg-rose-400/10 dark:text-rose-200 sm:m-5 sm:flex-row sm:items-center sm:justify-between">
                  <span className="flex items-start gap-2">
                    <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" />
                    {error}
                  </span>
                  <button
                    type="button"
                    onClick={() => fetchEmployees(selectedDate)}
                    className="rounded-lg border border-rose-200 bg-white px-3 py-2 text-xs font-semibold dark:border-rose-400/20 dark:bg-transparent"
                  >
                    Try again
                  </button>
                </div>
              ) : loading ? (
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
                    <Users className="h-5 w-5" />
                  </span>
                  <h3 className="mt-4 text-sm font-semibold text-slate-900 dark:text-white">
                    {hasFilters ? "No matching employees" : "No attendance data"}
                  </h3>
                  <p className="mx-auto mt-1 max-w-sm text-sm text-slate-500 dark:text-slate-400">
                    {hasFilters
                      ? "Try changing the search or status filter."
                      : "No employee records are available for this date."}
                  </p>
                </div>
              ) : (
                <>
                  <div className="space-y-3 p-4 md:hidden">
                    {filteredEmployees.map((employee) => (
                      <EmployeeMobileCard
                        key={employee.userId || employee.employeeId}
                        employee={employee}
                      />
                    ))}
                  </div>

                  <div className="hidden overflow-x-auto md:block">
                    <table className="w-full min-w-[820px] text-left">
                      <thead className="bg-slate-50 dark:bg-white/[0.02]">
                        <tr className="border-b border-slate-200 dark:border-white/10">
                          {[
                            "Employee",
                            "Status",
                            "Punch in",
                            "Punch out",
                            "Work time",
                            "Break",
                          ].map((heading) => (
                            <th
                              key={heading}
                              className="px-4 py-3 text-[11px] font-semibold uppercase tracking-wider text-slate-500 dark:text-slate-400"
                            >
                              {heading}
                            </th>
                          ))}
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-200 dark:divide-white/10">
                        {filteredEmployees.map((employee) => (
                          <tr
                            key={employee.userId || employee.employeeId}
                            className="transition hover:bg-slate-50 dark:hover:bg-white/[0.025]"
                          >
                            <td className="px-4 py-3.5">
                              <EmployeeIdentity employee={employee} />
                            </td>
                            <td className="px-4 py-3.5">
                              <StatusBadge employee={employee} />
                            </td>
                            <td className="px-4 py-3.5 text-sm font-medium text-slate-700 dark:text-slate-200">
                              {formatTime(employee.arrivalTime)}
                            </td>
                            <td className="px-4 py-3.5 text-sm font-medium text-slate-700 dark:text-slate-200">
                              {formatTime(employee.punchOutTime)}
                            </td>
                            <td className="px-4 py-3.5 text-sm font-medium text-slate-700 dark:text-slate-200">
                              <LiveWorkDuration employee={employee} />
                            </td>
                            <td className="px-4 py-3.5 text-sm font-medium text-slate-700 dark:text-slate-200">
                              <LiveBreakDuration employee={employee} />
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </>
              )}
          </section>
        </div>
      </main>

      <CelebrationPopup
        celebrations={celebrations}
        isOpen={showCelebrationPopup}
        onClose={closeCelebrationPopup}
      />
    </div>
  );
};

export default SuperAdminDashboard;
