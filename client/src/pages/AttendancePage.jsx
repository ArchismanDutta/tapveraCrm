import React, { useCallback, useEffect, useMemo, useState } from "react";
import {
  AlertCircle,
  ArrowLeft,
  ArrowRight,
  CalendarDays,
  CheckCircle2,
  Clock3,
  Home,
  Hourglass,
  RefreshCw,
  TimerReset,
  TrendingUp,
} from "lucide-react";
import Sidebar from "../components/dashboard/Sidebar";
import PaymentBlockOverlay from "../components/payment/PaymentBlockOverlay";
import usePaymentCheck from "../hooks/usePaymentCheck";
import newAttendanceService from "../services/newAttendanceService";
import timeUtils from "../utils/timeUtils";

const statusStyles = {
  working: {
    label: "Working",
    dot: "bg-emerald-500",
    text: "text-emerald-700 dark:text-emerald-200",
    bg: "bg-emerald-50 dark:bg-emerald-400/10",
    border: "border-emerald-200 dark:border-emerald-400/20",
  },
  break: {
    label: "On Break",
    dot: "bg-amber-500",
    text: "text-amber-700 dark:text-amber-200",
    bg: "bg-amber-50 dark:bg-amber-400/10",
    border: "border-amber-200 dark:border-amber-400/20",
  },
  offline: {
    label: "Offline",
    dot: "bg-slate-500",
    text: "text-slate-600 dark:text-slate-300",
    bg: "bg-slate-50 dark:bg-white/[0.04]",
    border: "border-slate-200 dark:border-white/10",
  },
};

const dayStatusStyles = {
  present: "border-emerald-200 bg-emerald-50 text-emerald-700 dark:border-emerald-400/20 dark:bg-emerald-400/10 dark:text-emerald-200",
  late: "border-amber-200 bg-amber-50 text-amber-700 dark:border-amber-400/20 dark:bg-amber-400/10 dark:text-amber-200",
  "half-day": "border-violet-200 bg-violet-50 text-violet-700 dark:border-violet-400/20 dark:bg-violet-400/10 dark:text-violet-200",
  wfh: "border-purple-200 bg-purple-50 text-purple-700 dark:border-purple-400/20 dark:bg-purple-400/10 dark:text-purple-200",
  absent: "border-rose-200 bg-rose-50 text-rose-700 dark:border-rose-400/20 dark:bg-rose-400/10 dark:text-rose-200",
  default: "border-slate-200 bg-slate-50 text-slate-400 dark:border-white/10 dark:bg-white/[0.035] dark:text-slate-500",
};

const compactStatusLabel = {
  present: "Present",
  late: "Late",
  "half-day": "Half Day",
  wfh: "Work From Home",
  absent: "Absent",
  default: "No record",
};

const formatDuration = (seconds = 0) => {
  const safeSeconds = Math.max(0, Number(seconds) || 0);
  const hours = Math.floor(safeSeconds / 3600);
  const minutes = Math.floor((safeSeconds % 3600) / 60);
  return `${hours}h ${minutes.toString().padStart(2, "0")}m`;
};

const formatTime = (value) => {
  if (!value) return "--";
  try {
    return timeUtils.formatTime(value);
  } catch {
    return "--";
  }
};

const getDateKey = (value) => {
  if (!value) return "";
  if (typeof value === "string") return value.includes("T") ? value.split("T")[0] : value;
  return value.toISOString().split("T")[0];
};

const getEventTime = (events = [], type) => {
  const normalized = type.toLowerCase();
  const matches = events
    .filter((event) => String(event.type || "").toLowerCase().includes(normalized))
    .sort((a, b) => new Date(a.timestamp || a.time) - new Date(b.timestamp || b.time));

  if (!matches.length) return null;
  const event = type === "PUNCH_OUT" ? matches[matches.length - 1] : matches[0];
  return event.timestamp || event.time || null;
};

const getDayStatus = (record) => {
  if (!record) return "default";
  // Check for WFH first (before other checks, as WFH employees can still be late)
  if (record.isWFH || record.leaveInfo?.isWFH) {
    // WFH day - check if they were late
    if (record.isLate) return "late"; // WFH but late arrival
    return "wfh"; // WFH on time
  }
  if (record.isAbsent) return "absent";
  if (record.isLate) return "late";
  if (record.isHalfDay) return "half-day";
  if (record.isPresent || record.workDurationSeconds > 0) return "present";
  return "default";
};

const AttendancePage = ({ onLogout }) => {
  const [collapsed, setCollapsed] = useState(false);
  const [selectedDate, setSelectedDate] = useState(() => new Date());
  const [todayStatus, setTodayStatus] = useState(null);
  const [monthRecords, setMonthRecords] = useState([]);
  const [monthSummary, setMonthSummary] = useState(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState(null);
  const { activePayment, checkingPayment, clearPayment } = usePaymentCheck();

  const selectedMonth = selectedDate.getMonth();
  const selectedYear = selectedDate.getFullYear();

  const fetchAttendance = useCallback(async (isRefresh = false) => {
    const user = JSON.parse(localStorage.getItem("user") || "{}");
    const userId = user.id || user._id;

    if (!userId) {
      setError("Unable to load employee profile.");
      setLoading(false);
      return;
    }

    if (isRefresh) {
      setRefreshing(true);
    } else {
      setLoading(true);
      setMonthRecords([]);
      setMonthSummary(null);
    }

    setError(null);

    try {
      const [todayResponse, monthResponse] = await Promise.all([
        newAttendanceService.getTodayStatus(),
        newAttendanceService.getEmployeeMonthlyAttendance(
          userId,
          selectedYear,
          selectedMonth + 1
        ),
      ]);

      if (!todayResponse.success || !monthResponse.success) {
        throw new Error("Attendance service returned an invalid response.");
      }

      setTodayStatus(todayResponse.data?.attendance || null);
      setMonthRecords(monthResponse.data?.data || []);
      setMonthSummary(monthResponse.data?.summary || null);
    } catch (err) {
      setError(err.message || "Failed to load attendance.");
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [selectedMonth, selectedYear]);

  useEffect(() => {
    fetchAttendance();
  }, [fetchAttendance]);

  useEffect(() => {
    const handleAttendanceUpdate = () => fetchAttendance(true);
    window.addEventListener("attendanceDataUpdated", handleAttendanceUpdate);
    window.addEventListener("statusUpdate", handleAttendanceUpdate);

    return () => {
      window.removeEventListener("attendanceDataUpdated", handleAttendanceUpdate);
      window.removeEventListener("statusUpdate", handleAttendanceUpdate);
    };
  }, [fetchAttendance]);

  const handlePaymentCleared = useCallback(() => {
    clearPayment();
    fetchAttendance(true);
  }, [clearPayment, fetchAttendance]);

  const recordsByDay = useMemo(() => {
    const map = new Map();
    monthRecords.forEach((record) => {
      const dateKey = getDateKey(record.date);
      const day = Number(dateKey.split("-")[2]);
      if (day) map.set(day, record);
    });
    return map;
  }, [monthRecords]);

  const calendarDays = useMemo(() => {
    const daysInMonth = new Date(selectedYear, selectedMonth + 1, 0).getDate();
    const firstDay = new Date(selectedYear, selectedMonth, 1).getDay();
    const blanks = Array.from({ length: firstDay }, (_, index) => ({
      key: `blank-${index}`,
      blank: true,
    }));

    const days = Array.from({ length: daysInMonth }, (_, index) => {
      const day = index + 1;
      const record = recordsByDay.get(day);
      const isToday =
        new Date(selectedYear, selectedMonth, day).toDateString() ===
        new Date().toDateString();

      return {
        key: day,
        day,
        record,
        status: getDayStatus(record),
        isToday,
      };
    });

    return [...blanks, ...days];
  }, [recordsByDay, selectedMonth, selectedYear]);

  const recentRecords = useMemo(() => {
    return [...monthRecords]
      .sort((a, b) => new Date(getDateKey(b.date)) - new Date(getDateKey(a.date)))
      .slice(0, 7);
  }, [monthRecords]);

  const computedSummary = useMemo(() => {
    const totalDays = monthSummary?.totalDays ?? monthRecords.length;
    const presentDays =
      monthSummary?.presentDays ?? monthRecords.filter((record) => record.isPresent).length;
    const lateDays =
      monthSummary?.lateDays ?? monthRecords.filter((record) => record.isLate).length;
    const absentDays =
      monthSummary?.absentDays ?? monthRecords.filter((record) => record.isAbsent).length;
    const totalHours =
      monthSummary?.totalHours ??
      monthRecords.reduce((sum, record) => sum + ((record.workDurationSeconds || 0) / 3600), 0);
    const averageHours =
      monthSummary?.averageHours ?? (monthRecords.length ? totalHours / monthRecords.length : 0);
    const attendanceRate = monthSummary?.attendanceRate ?? 0;
    const punctualityRate = monthSummary?.punctualityRate ?? 0;

    return {
      totalDays,
      presentDays,
      lateDays,
      absentDays,
      totalHours: Math.round(totalHours * 10) / 10,
      averageHours: Math.round(averageHours * 10) / 10,
      attendanceRate,
      punctualityRate,
    };
  }, [monthRecords, monthSummary]);

  const activeStyle = todayStatus?.onBreak
    ? statusStyles.break
    : todayStatus?.currentlyWorking
    ? statusStyles.working
    : statusStyles.offline;

  const monthTitle = selectedDate.toLocaleString("default", {
    month: "long",
    year: "numeric",
  });

  const changeMonth = (direction) => {
    setSelectedDate((current) => {
      const next = new Date(current);
      next.setDate(1);
      next.setMonth(current.getMonth() + direction);
      return next;
    });
  };

  if (checkingPayment) {
    return (
      <div className="flex h-[100dvh] items-center justify-center bg-slate-50 dark:bg-[#0b0d12]">
        <div className="text-center">
          <div className="relative mx-auto h-14 w-14">
            <div className="h-14 w-14 rounded-full border-2 border-blue-200 dark:border-blue-300/20"></div>
            <div className="absolute left-0 top-0 h-14 w-14 animate-spin rounded-full border-2 border-blue-600 border-t-transparent dark:border-blue-400"></div>
          </div>
          <p className="mt-4 text-sm font-medium text-slate-600 dark:text-slate-300">Preparing attendance...</p>
        </div>
      </div>
    );
  }

  if (activePayment) {
    return (
      <PaymentBlockOverlay
        payment={activePayment}
        onPaymentCleared={handlePaymentCleared}
      />
    );
  }

  return (
    <div className="relative flex h-[100dvh] overflow-hidden bg-slate-50 text-slate-900 dark:bg-[#0b0d12] dark:text-slate-100">

      <Sidebar
        collapsed={collapsed}
        setCollapsed={setCollapsed}
        userRole="employee"
        onLogout={onLogout}
      />

      <main
        className={`relative z-10 h-[100dvh] min-w-0 flex-1 overflow-y-auto overflow-x-hidden px-3 py-4 transition-all duration-300 [overscroll-behavior-y:auto] [scrollbar-gutter:stable] sm:px-5 lg:px-6 ${
          collapsed ? "ml-16" : "ml-16 sm:ml-56"
        }`}
        style={{ WebkitOverflowScrolling: "touch" }}
      >
        <div className="mx-auto max-w-[1500px] space-y-4 pb-8 sm:space-y-5">
          <section className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm dark:border-white/10 dark:bg-[#10131c]">
            <div className="grid gap-4 p-4 lg:grid-cols-[minmax(0,1fr)_360px] lg:p-5">
              <div className="min-w-0">
                <div className="mb-5 flex flex-wrap items-center gap-3">
                  <span className={`inline-flex items-center gap-2 rounded-lg border px-3 py-1.5 text-sm font-medium ${activeStyle.border} ${activeStyle.bg} ${activeStyle.text}`}>
                    <span className={`h-2 w-2 rounded-full ${activeStyle.dot}`} />
                    {activeStyle.label}
                  </span>
                  {todayStatus?.isLate && (
                    <span className="inline-flex items-center gap-2 rounded-lg border border-rose-200 bg-rose-50 px-3 py-1.5 text-sm text-rose-700 dark:border-rose-400/20 dark:bg-rose-400/10 dark:text-rose-200">
                      <AlertCircle className="h-4 w-4" />
                      Late today
                    </span>
                  )}
                </div>

                <p className="text-xs font-semibold uppercase tracking-wider text-slate-500 dark:text-slate-400">My attendance</p>
                <h1 className="mt-1 max-w-3xl text-2xl font-semibold tracking-tight text-slate-950 dark:text-white">
                  Attendance overview
                </h1>
                <p className="mt-1 max-w-2xl text-sm text-slate-500 dark:text-slate-400">
                  Current status, monthly attendance, and recent punch history.
                </p>

                <div className="mt-6 grid grid-cols-2 gap-3 sm:grid-cols-4">
                  <div className="rounded-xl border border-slate-200 bg-slate-50 p-3 dark:border-white/10 dark:bg-white/[0.03]">
                    <p className="text-xs text-slate-500 dark:text-slate-400">Arrived</p>
                    <p className="mt-1 text-lg font-semibold text-slate-950 dark:text-white">
                      {formatTime(todayStatus?.arrivalTime)}
                    </p>
                  </div>
                  <div className="rounded-xl border border-slate-200 bg-slate-50 p-3 dark:border-white/10 dark:bg-white/[0.03]">
                    <p className="text-xs text-slate-500 dark:text-slate-400">Work</p>
                    <p className="mt-1 text-lg font-semibold text-emerald-700 dark:text-emerald-200">
                      {formatDuration(todayStatus?.workDurationSeconds)}
                    </p>
                  </div>
                  <div className="rounded-xl border border-slate-200 bg-slate-50 p-3 dark:border-white/10 dark:bg-white/[0.03]">
                    <p className="text-xs text-slate-500 dark:text-slate-400">Break</p>
                    <p className="mt-1 text-lg font-semibold text-amber-700 dark:text-amber-200">
                      {formatDuration(todayStatus?.breakDurationSeconds)}
                    </p>
                  </div>
                  <div className="rounded-xl border border-slate-200 bg-slate-50 p-3 dark:border-white/10 dark:bg-white/[0.03]">
                    <p className="text-xs text-slate-500 dark:text-slate-400">Punched out</p>
                    <p className="mt-1 text-lg font-semibold text-violet-700 dark:text-violet-200">
                      {formatTime(todayStatus?.departureTime)}
                    </p>
                  </div>
                </div>
              </div>

              <div className="rounded-xl border border-slate-200 bg-slate-50 p-4 dark:border-white/10 dark:bg-white/[0.03]">
                <div className="mb-4 flex items-center justify-between gap-3">
                  <div>
                    <p className="text-xs text-slate-500 dark:text-slate-400">This month</p>
                    <h2 className="text-xl font-semibold text-slate-950 dark:text-white">{monthTitle}</h2>
                  </div>
                  <CalendarDays className="h-5 w-5 text-blue-600 dark:text-blue-300" />
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <div className="rounded-lg border border-emerald-200 bg-emerald-50 p-3 dark:border-emerald-400/15 dark:bg-emerald-400/10">
                    <p className="text-xs text-emerald-700/70 dark:text-emerald-200/70">Attendance</p>
                    <p className="mt-1 text-2xl font-semibold text-emerald-700 dark:text-emerald-200">
                      {computedSummary.attendanceRate}%
                    </p>
                  </div>
                  <div className="rounded-lg border border-blue-200 bg-blue-50 p-3 dark:border-blue-400/15 dark:bg-blue-400/10">
                    <p className="text-xs text-blue-700/70 dark:text-blue-200/70">On time</p>
                    <p className="mt-1 text-2xl font-semibold text-blue-700 dark:text-blue-200">
                      {computedSummary.punctualityRate}%
                    </p>
                  </div>
                  <div className="rounded-lg border border-violet-200 bg-violet-50 p-3 dark:border-violet-400/15 dark:bg-violet-400/10">
                    <p className="text-xs text-violet-700/70 dark:text-violet-200/70">Total hours</p>
                    <p className="mt-1 text-2xl font-semibold text-violet-700 dark:text-violet-200">
                      {computedSummary.totalHours}h
                    </p>
                  </div>
                  <div className="rounded-lg border border-amber-200 bg-amber-50 p-3 dark:border-amber-400/15 dark:bg-amber-400/10">
                    <p className="text-xs text-amber-700/70 dark:text-amber-200/70">Average / day</p>
                    <p className="mt-1 text-2xl font-semibold text-amber-700 dark:text-amber-200">
                      {computedSummary.averageHours}h
                    </p>
                  </div>
                </div>
              </div>
            </div>
          </section>

          {error && (
            <div className="flex flex-col gap-3 rounded-xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-700 dark:border-rose-400/20 dark:bg-rose-400/10 dark:text-rose-200 sm:flex-row sm:items-center sm:justify-between">
              <div className="flex items-center gap-2">
                <AlertCircle className="h-4 w-4" />
                {error}
              </div>
              <button
                type="button"
                onClick={() => fetchAttendance(true)}
                className="inline-flex h-9 items-center justify-center gap-2 rounded-lg border border-rose-200 bg-white px-3 text-xs font-semibold transition hover:bg-rose-100 dark:border-rose-400/20 dark:bg-transparent dark:hover:bg-rose-400/10"
              >
                <RefreshCw className="h-3.5 w-3.5" />
                Retry
              </button>
            </div>
          )}

          <section className="space-y-4">
            <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
              <MetricCard
                icon={CheckCircle2}
                label="Present"
                value={computedSummary.presentDays}
                tone="emerald"
              />
              <MetricCard
                icon={Hourglass}
                label="Late"
                value={computedSummary.lateDays}
                tone="amber"
              />
              <MetricCard
                icon={TimerReset}
                label="Absent"
                value={computedSummary.absentDays}
                tone="rose"
              />
              <MetricCard
                icon={TrendingUp}
                label="Records"
                value={computedSummary.totalDays}
                tone="violet"
              />
            </div>

            <div className="grid items-start gap-4 xl:grid-cols-[minmax(0,1fr)_400px]">
              <div
                className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm dark:border-white/10 dark:bg-[#10131c]"
              >
                <div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-200 px-4 py-3 dark:border-white/10">
                  <div>
                    <h2 className="text-base font-semibold text-slate-950 dark:text-white">Month view</h2>
                    <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">{monthTitle}</p>
                  </div>
                  <div className="flex items-center gap-2">
                    <button
                      type="button"
                      onClick={() => changeMonth(-1)}
                      className="inline-flex h-9 w-9 items-center justify-center rounded-lg border border-slate-200 bg-white text-slate-500 transition hover:bg-slate-50 hover:text-slate-800 dark:border-white/10 dark:bg-white/[0.04] dark:text-slate-300 dark:hover:bg-white/[0.07] dark:hover:text-white"
                      aria-label="Previous month"
                    >
                      <ArrowLeft className="h-4 w-4" />
                    </button>
                    <button
                      type="button"
                      onClick={() => setSelectedDate(new Date())}
                      className="inline-flex h-9 items-center rounded-lg border border-slate-200 bg-white px-3 text-xs font-semibold text-slate-600 transition hover:bg-slate-50 dark:border-white/10 dark:bg-white/[0.04] dark:text-slate-300 dark:hover:bg-white/[0.07]"
                    >
                      Today
                    </button>
                    <button
                      type="button"
                      onClick={() => changeMonth(1)}
                      className="inline-flex h-9 w-9 items-center justify-center rounded-lg border border-slate-200 bg-white text-slate-500 transition hover:bg-slate-50 hover:text-slate-800 dark:border-white/10 dark:bg-white/[0.04] dark:text-slate-300 dark:hover:bg-white/[0.07] dark:hover:text-white"
                      aria-label="Next month"
                    >
                      <ArrowRight className="h-4 w-4" />
                    </button>
                    <button
                      type="button"
                      onClick={() => fetchAttendance(true)}
                      disabled={refreshing || loading}
                      className="inline-flex h-9 w-9 items-center justify-center rounded-lg border border-blue-200 bg-blue-50 text-blue-700 transition hover:bg-blue-100 disabled:cursor-not-allowed disabled:opacity-60 dark:border-blue-400/20 dark:bg-blue-400/10 dark:text-blue-200 dark:hover:bg-blue-400/15"
                      aria-label="Refresh attendance"
                    >
                      <RefreshCw className={`h-4 w-4 ${refreshing ? "animate-spin" : ""}`} />
                    </button>
                  </div>
                </div>

                <div className="p-4">
                  {loading ? (
                    <div className="flex h-72 items-center justify-center">
                      <div className="h-8 w-8 animate-spin rounded-full border-2 border-blue-200 border-t-blue-600 dark:border-white/10 dark:border-t-blue-400" />
                    </div>
                  ) : (
                  <>
                  <div className="grid grid-cols-7 gap-1 text-center text-[10px] font-medium text-slate-500 dark:text-slate-400 sm:gap-2 sm:text-xs">
                    {["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"].map((day) => (
                      <div key={day}>{day}</div>
                    ))}
                  </div>
                  <div className="mt-2 grid grid-cols-7 gap-1 sm:gap-2">
                    {calendarDays.map((day) =>
                      day.blank ? (
                        <div key={day.key} />
                      ) : (
                        <div
                          key={day.key}
                          className={`min-h-14 rounded-lg border p-1.5 sm:min-h-20 sm:p-2 ${dayStatusStyles[day.status]} ${
                            day.isToday ? "ring-2 ring-blue-500/70" : ""
                          }`}
                        >
                          <div className="flex items-center justify-between gap-1">
                            <span className="font-mono text-sm font-semibold">{day.day}</span>
                            {day.record?.workDurationSeconds > 0 && (
                              <span className="hidden text-[10px] opacity-60 sm:inline">
                                {Math.round((day.record.workDurationSeconds / 3600) * 10) / 10}h
                              </span>
                            )}
                          </div>
                          <div className="mt-2 flex items-center gap-1 sm:mt-4">
                            {(day.record?.isWFH || day.record?.leaveInfo?.isWFH) && (
                              <Home className="h-3 w-3 flex-shrink-0 text-purple-600 dark:text-purple-300" />
                            )}
                            <p className="hidden truncate text-[11px] opacity-70 sm:block">
                              {compactStatusLabel[day.status]}
                            </p>
                          </div>
                        </div>
                      )
                    )}
                  </div>
                  </>
                  )}
                </div>
              </div>

              <div
                className="flex max-h-[580px] min-h-0 flex-col overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm dark:border-white/10 dark:bg-[#10131c]"
              >
                <div className="border-b border-slate-200 px-4 py-3 dark:border-white/10">
                  <div className="flex items-center gap-3">
                    <div className="inline-flex h-9 w-9 items-center justify-center rounded-lg border border-violet-200 bg-violet-50 text-violet-700 dark:border-violet-400/20 dark:bg-violet-400/10 dark:text-violet-200">
                      <Clock3 className="h-4 w-4" />
                    </div>
                    <div>
                      <h2 className="text-base font-semibold text-slate-950 dark:text-white">Recent days</h2>
                      <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">Latest monthly records</p>
                    </div>
                  </div>
                </div>

                <div className="min-h-0 flex-1 divide-y divide-slate-100 overflow-y-auto dark:divide-white/[0.07]">
                  {loading ? (
                    <div className="flex h-80 items-center justify-center">
                      <div className="h-8 w-8 animate-spin rounded-full border-2 border-blue-200 border-t-blue-600 dark:border-white/10 dark:border-t-blue-400" />
                    </div>
                  ) : recentRecords.length === 0 ? (
                    <div className="px-4 py-12 text-center">
                      <p className="text-sm text-slate-500 dark:text-slate-400">No records for this month.</p>
                    </div>
                  ) : (
                    recentRecords.map((record) => {
                      const status = getDayStatus(record);
                      const inTime = record.arrivalTime || getEventTime(record.events, "PUNCH_IN");
                      const outTime = record.departureTime || getEventTime(record.events, "PUNCH_OUT");

                      return (
                        <div key={getDateKey(record.date)} className="px-4 py-3">
                          <div className="flex items-start justify-between gap-3">
                            <div className="min-w-0">
                              <div className="flex items-center gap-2">
                                <p className="font-medium text-slate-950 dark:text-white">
                                  {new Date(`${getDateKey(record.date)}T12:00:00`).toLocaleDateString("en-US", {
                                    weekday: "short",
                                    month: "short",
                                    day: "numeric",
                                  })}
                                </p>
                                {(record.isWFH || record.leaveInfo?.isWFH) && (
                                  <Home className="h-3.5 w-3.5 text-purple-600 dark:text-purple-300" />
                                )}
                              </div>
                              <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">
                                {formatTime(inTime)} - {formatTime(outTime)}
                              </p>
                            </div>
                            <span className={`shrink-0 rounded-lg border px-2 py-1 text-xs font-medium ${dayStatusStyles[status]}`}>
                              {compactStatusLabel[status]}
                            </span>
                          </div>
                          <div className="mt-3 grid grid-cols-2 gap-2">
                            <div className="rounded-lg border border-slate-200 bg-slate-50 px-3 py-2 dark:border-white/10 dark:bg-white/[0.03]">
                              <p className="text-[11px] text-slate-500 dark:text-slate-400">Work</p>
                              <p className="text-sm font-medium text-emerald-700 dark:text-emerald-200">
                                {formatDuration(record.workDurationSeconds)}
                              </p>
                            </div>
                            <div className="rounded-lg border border-slate-200 bg-slate-50 px-3 py-2 dark:border-white/10 dark:bg-white/[0.03]">
                              <p className="text-[11px] text-slate-500 dark:text-slate-400">Break</p>
                              <p className="text-sm font-medium text-amber-700 dark:text-amber-200">
                                {formatDuration(record.breakDurationSeconds)}
                              </p>
                            </div>
                          </div>
                        </div>
                      );
                    })
                  )}
                </div>
              </div>
            </div>
          </section>
        </div>
      </main>
    </div>
  );
};

const MetricCard = ({ icon, label, value, tone }) => {
  const toneClass = {
    emerald: "border-emerald-200 bg-emerald-50 text-emerald-700 dark:border-emerald-400/20 dark:bg-emerald-400/10 dark:text-emerald-200",
    amber: "border-amber-200 bg-amber-50 text-amber-700 dark:border-amber-400/20 dark:bg-amber-400/10 dark:text-amber-200",
    rose: "border-rose-200 bg-rose-50 text-rose-700 dark:border-rose-400/20 dark:bg-rose-400/10 dark:text-rose-200",
    violet: "border-violet-200 bg-violet-50 text-violet-700 dark:border-violet-400/20 dark:bg-violet-400/10 dark:text-violet-200",
  }[tone];

  return (
    <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm dark:border-white/10 dark:bg-[#10131c]">
      <div className={`mb-4 inline-flex h-9 w-9 items-center justify-center rounded-lg border ${toneClass}`}>
        {React.createElement(icon, { className: "h-4 w-4" })}
      </div>
      <p className="text-xs text-slate-500 dark:text-slate-400">{label}</p>
      <p className="mt-1 text-2xl font-semibold text-slate-950 dark:text-white">{value}</p>
    </div>
  );
};

export default AttendancePage;
