import React, { useCallback, useEffect, useState } from "react";
import axios from "axios";
import {
  AlertCircle,
  CalendarDays,
  CheckCircle,
  Clock,
  Filter,
  LayoutGrid,
  List,
  Plus,
  RefreshCw,
  Search,
  Target,
  TrendingUp,
  X,
  Zap,
} from "lucide-react";
import Sidebar from "../components/dashboard/Sidebar";
import TaskList from "../components/todo/TaskList";
import TaskForm from "../components/todo/TaskForm";
import CelebrationPopup from "../components/common/CelebrationPopup";
import useCelebrationNotifications from "../hooks/useCelebrationNotifications";

const API_BASE = import.meta.env.VITE_API_BASE || "http://localhost:5000";

const normalizeDate = (date) => {
  const normalized = new Date(date);
  normalized.setHours(0, 0, 0, 0);
  return normalized.toISOString();
};

const normalizeTasks = (tasks) => {
  if (!Array.isArray(tasks)) return [];

  return tasks.map((task) => ({
    ...task,
    date: task.date ? new Date(task.date).toISOString() : null,
    completedAtStr: task.completedAt
      ? new Date(task.completedAt).toLocaleString("en-IN")
      : null,
  }));
};

const isSameLocalDay = (left, right) => {
  const first = new Date(left);
  const second = new Date(right);

  return (
    first.getFullYear() === second.getFullYear() &&
    first.getMonth() === second.getMonth() &&
    first.getDate() === second.getDate()
  );
};

const TodoPage = ({ onLogout }) => {
  const token = localStorage.getItem("token");
  const [collapsed, setCollapsed] = useState(false);
  const [todayTasks, setTodayTasks] = useState([]);
  const [upcomingTasks, setUpcomingTasks] = useState([]);
  const [completedTasks, setCompletedTasks] = useState([]);
  const [showForm, setShowForm] = useState(false);
  const [editTask, setEditTask] = useState(null);
  const [recentlyDeletedTask, setRecentlyDeletedTask] = useState(null);
  const [currentTime, setCurrentTime] = useState(new Date());
  const [searchTerm, setSearchTerm] = useState("");
  const [filterPriority, setFilterPriority] = useState("all");
  const [viewMode, setViewMode] = useState("cards");
  const [loading, setLoading] = useState(true);
  const [analytics, setAnalytics] = useState(null);
  const [error, setError] = useState("");
  const [actionError, setActionError] = useState("");
  const [lastFetchAttempt, setLastFetchAttempt] = useState(null);

  const {
    celebrations,
    showPopup: showCelebrationPopup,
    closePopup: closeCelebrationPopup,
  } = useCelebrationNotifications();

  const fetchTasks = useCallback(async () => {
    if (!token) {
      setError("Authentication required. Please log in again.");
      setLoading(false);
      return;
    }

    setLoading(true);
    setError("");
    setLastFetchAttempt(new Date());

    try {
      const todayISO = normalizeDate(new Date());
      const tomorrowISO = normalizeDate(
        new Date(Date.now() + 24 * 60 * 60 * 1000)
      );
      const headers = { Authorization: `Bearer ${token}` };

      const [todayResponse, upcomingResponse] = await Promise.all([
        axios.get(`${API_BASE}/api/todos`, {
          headers,
          params: { date: todayISO },
          timeout: 10000,
        }),
        axios.get(`${API_BASE}/api/todos/upcoming`, {
          headers,
          params: { startDate: tomorrowISO },
          timeout: 10000,
        }),
      ]);

      const todayData = Array.isArray(todayResponse.data)
        ? todayResponse.data
        : [];
      const upcomingData = Array.isArray(upcomingResponse.data)
        ? upcomingResponse.data
        : [];
      const uniqueTasks = Array.from(
        new Map(
          [...todayData, ...upcomingData].map((task) => [task._id, task])
        ).values()
      );

      setTodayTasks(
        normalizeTasks(todayData.filter((task) => !task.completed))
      );
      setUpcomingTasks(
        normalizeTasks(upcomingData.filter((task) => !task.completed))
      );
      setCompletedTasks(
        normalizeTasks(uniqueTasks.filter((task) => task.completed))
      );
    } catch (requestError) {
      let message = "Failed to load tasks. ";

      if (requestError.response?.status === 401) {
        message += "Please log in again.";
      } else if (requestError.response?.status === 403) {
        message += "Access denied.";
      } else if (requestError.code === "ECONNABORTED") {
        message += "The server is taking too long to respond.";
      } else {
        message += "Check your connection and try again.";
      }

      setError(message);
    } finally {
      setLoading(false);
    }
  }, [token]);

  const fetchAnalytics = useCallback(async () => {
    if (!token) return;

    try {
      const response = await axios.get(`${API_BASE}/api/todos/analytics`, {
        headers: { Authorization: `Bearer ${token}` },
        timeout: 10000,
      });
      setAnalytics(response.data);
    } catch {
      setAnalytics(null);
    }
  }, [token]);

  useEffect(() => {
    const timer = setInterval(() => setCurrentTime(new Date()), 1000);
    return () => clearInterval(timer);
  }, []);

  useEffect(() => {
    fetchTasks();
    fetchAnalytics();
  }, [fetchAnalytics, fetchTasks]);

  const handleSaveTask = async (task) => {
    setLoading(true);
    setActionError("");

    try {
      if (task._id) {
        await axios.put(`${API_BASE}/api/todos/${task._id}`, task, {
          headers: { Authorization: `Bearer ${token}` },
        });
      } else {
        await axios.post(
          `${API_BASE}/api/todos`,
          {
            ...task,
            date: task.date || normalizeDate(new Date()),
          },
          { headers: { Authorization: `Bearer ${token}` } }
        );
      }

      setShowForm(false);
      setEditTask(null);
      await Promise.all([fetchTasks(), fetchAnalytics()]);
    } catch (saveError) {
      console.error("Failed to save task:", saveError);
      setActionError(
        "The task could not be saved. Check the details and try again."
      );
      throw saveError;
    } finally {
      setLoading(false);
    }
  };

  const handleRefresh = async () => {
    setActionError("");
    await Promise.all([fetchTasks(), fetchAnalytics()]);
  };

  const filterTasks = (tasks) => {
    const search = searchTerm.trim().toLowerCase();

    return tasks.filter((task) => {
      const matchesSearch =
        !search ||
        task.text?.toLowerCase().includes(search) ||
        task.title?.toLowerCase().includes(search) ||
        task.description?.toLowerCase().includes(search);
      const priority = String(task.label || task.priority || "").toLowerCase();
      const matchesPriority =
        filterPriority === "all" || priority === filterPriority;

      return matchesSearch && matchesPriority;
    });
  };

  const filteredTodayTasks = filterTasks(todayTasks);
  const filteredUpcomingTasks = filterTasks(upcomingTasks);
  const filteredCompletedTasks = filterTasks(completedTasks);

  const handleMarkDone = async (task) => {
    setActionError("");

    try {
      const response = await axios.put(
        `${API_BASE}/api/todos/${task._id}`,
        { completed: !task.completed },
        { headers: { Authorization: `Bearer ${token}` } }
      );
      const [updatedTask] = normalizeTasks([response.data]);

      if (updatedTask.completed) {
        setTodayTasks((previous) =>
          previous.filter((item) => item._id !== updatedTask._id)
        );
        setUpcomingTasks((previous) =>
          previous.filter((item) => item._id !== updatedTask._id)
        );
        setCompletedTasks((previous) => [updatedTask, ...previous]);
      } else {
        setCompletedTasks((previous) =>
          previous.filter((item) => item._id !== updatedTask._id)
        );

        if (updatedTask.date && isSameLocalDay(updatedTask.date, new Date())) {
          setTodayTasks((previous) => [updatedTask, ...previous]);
        } else {
          setUpcomingTasks((previous) => [updatedTask, ...previous]);
        }
      }

      fetchAnalytics();
    } catch (statusError) {
      console.error("Failed to toggle task status:", statusError);
      setActionError("The task status could not be updated. Please try again.");
    }
  };

  const handleDeleteTask = async (taskId) => {
    setActionError("");

    try {
      const taskToDelete =
        todayTasks.find((task) => task._id === taskId) ||
        upcomingTasks.find((task) => task._id === taskId) ||
        completedTasks.find((task) => task._id === taskId);

      await axios.delete(`${API_BASE}/api/todos/${taskId}`, {
        headers: { Authorization: `Bearer ${token}` },
      });

      setRecentlyDeletedTask(taskToDelete || null);
      setTodayTasks((previous) =>
        previous.filter((task) => task._id !== taskId)
      );
      setUpcomingTasks((previous) =>
        previous.filter((task) => task._id !== taskId)
      );
      setCompletedTasks((previous) =>
        previous.filter((task) => task._id !== taskId)
      );
      fetchAnalytics();
    } catch (deleteError) {
      console.error("Failed to delete task:", deleteError);
      setActionError("The task could not be deleted. Please try again.");
    }
  };

  const handleUndoDelete = async () => {
    if (!recentlyDeletedTask) return;

    setActionError("");

    try {
      const { _id, ...taskData } = recentlyDeletedTask;
      await axios.post(`${API_BASE}/api/todos`, taskData, {
        headers: { Authorization: `Bearer ${token}` },
      });
      setRecentlyDeletedTask(null);
      await Promise.all([fetchTasks(), fetchAnalytics()]);
    } catch (restoreError) {
      console.error("Failed to restore task:", restoreError);
      setActionError(
        "The deleted task could not be restored. Please try again."
      );
    }
  };

  const totalTasks =
    todayTasks.length + upcomingTasks.length + completedTasks.length;
  const completedCount = completedTasks.length;
  const completionPercent = totalTasks
    ? (completedCount / totalTasks) * 100
    : 0;
  const todayCompletedCount = completedTasks.filter(
    (task) => task.date && isSameLocalDay(task.date, new Date())
  ).length;
  const filteredTaskCount =
    filteredTodayTasks.length +
    filteredUpcomingTasks.length +
    filteredCompletedTasks.length;
  const hasUrgentTasks = todayTasks.some((task) =>
    [task.priority, task.label].some(
      (priority) => String(priority || "").toLowerCase() === "high"
    )
  );

  return (
    <div className="app-shell todo-theme h-[100dvh] overflow-hidden">
      <Sidebar
        onLogout={onLogout}
        collapsed={collapsed}
        setCollapsed={setCollapsed}
        userRole="employee"
      />

      <main
        className={`app-main h-[100dvh] min-w-0 flex-1 overflow-y-auto overflow-x-hidden px-3 py-4 transition-all duration-300 sm:px-5 lg:px-6 ${
          collapsed ? "app-offset app-offset-collapsed" : "app-offset"
        }`}
      >
        <div className="mx-auto max-w-[1500px] space-y-4 pb-8 sm:space-y-5">
          <section className="app-header overflow-hidden rounded-2xl">
            <div className="grid gap-5 p-4 lg:grid-cols-[minmax(0,1fr)_auto] lg:items-center lg:p-5">
              <div className="flex min-w-0 items-start gap-3">
                <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-blue-600 text-white shadow-sm shadow-blue-600/20">
                  <CalendarDays className="h-5 w-5" />
                </div>
                <div>
                  <p className="app-eyebrow">Personal planning</p>
                  <h1 className="app-title">Todo workspace</h1>
                  <p className="app-description max-w-2xl">
                    Plan today, schedule what is next, and keep your personal work moving.
                  </p>
                  <p className="mt-2 text-xs font-medium text-blue-600 dark:text-blue-300">
                    {currentTime.toLocaleDateString("en-IN", {
                      weekday: "long",
                      day: "numeric",
                      month: "long",
                      year: "numeric",
                    })}
                  </p>
                </div>
              </div>

              <div className="flex flex-wrap items-center gap-2">
                <div className="mr-1 rounded-lg border border-slate-200 bg-slate-50 px-3 py-2 text-right dark:border-white/10 dark:bg-white/[0.03]">
                  <p className="text-[10px] font-medium uppercase tracking-wider text-slate-400">
                    Local time
                  </p>
                  <p className="font-mono text-sm font-semibold text-slate-700 dark:text-slate-200">
                    {currentTime.toLocaleTimeString("en-IN", {
                      hour: "2-digit",
                      minute: "2-digit",
                      second: "2-digit",
                    })}
                  </p>
                </div>
                <button
                  type="button"
                  onClick={handleRefresh}
                  disabled={loading}
                  className="inline-flex h-10 items-center justify-center gap-2 rounded-lg border border-slate-200 bg-white px-4 text-sm font-semibold text-slate-700 transition hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-60 dark:border-white/10 dark:bg-white/[0.04] dark:text-slate-200 dark:hover:bg-white/[0.07]"
                >
                  <RefreshCw
                    className={`h-4 w-4 ${loading ? "animate-spin" : ""}`}
                  />
                  Refresh
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setEditTask(null);
                    setShowForm(true);
                  }}
                  className="inline-flex h-10 items-center justify-center gap-2 rounded-lg bg-blue-600 px-4 text-sm font-semibold text-white transition hover:bg-blue-700 dark:bg-blue-500 dark:hover:bg-blue-400"
                >
                  <Plus className="h-4 w-4" />
                  Add task
                </button>
              </div>
            </div>
          </section>

          {(error || actionError) && (
            <div className="flex flex-col gap-3 rounded-xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-700 dark:border-rose-400/20 dark:bg-rose-400/10 dark:text-rose-200 sm:flex-row sm:items-center sm:justify-between">
              <div className="flex items-start gap-2">
                <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" />
                <div>
                  <p className="font-medium">{actionError || error}</p>
                  {error && lastFetchAttempt && (
                    <p className="mt-0.5 text-xs opacity-75">
                      Last attempt at{" "}
                      {lastFetchAttempt.toLocaleTimeString("en-IN")}
                    </p>
                  )}
                </div>
              </div>
              <div className="flex items-center gap-2">
                {actionError && (
                  <button
                    type="button"
                    onClick={() => setActionError("")}
                    className="inline-flex h-9 items-center justify-center rounded-lg px-3 text-xs font-semibold transition hover:bg-rose-100 dark:hover:bg-rose-400/10"
                  >
                    Dismiss
                  </button>
                )}
                {error && (
                  <button
                    type="button"
                    onClick={handleRefresh}
                    disabled={loading}
                    className="inline-flex h-9 items-center justify-center gap-2 rounded-lg border border-rose-200 bg-white px-3 text-xs font-semibold transition hover:bg-rose-100 disabled:opacity-60 dark:border-rose-400/20 dark:bg-transparent dark:hover:bg-rose-400/10"
                  >
                    <RefreshCw
                      className={`h-3.5 w-3.5 ${
                        loading ? "animate-spin" : ""
                      }`}
                    />
                    Retry
                  </button>
                )}
              </div>
            </div>
          )}

          <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
            <AnalyticsCard
              icon={Target}
              label="Total tasks"
              value={totalTasks}
              subValue="Across your workspace"
              tone="blue"
            />
            <AnalyticsCard
              icon={CheckCircle}
              label="Completed"
              value={completedCount}
              subValue={`${Math.round(completionPercent)}% overall completion`}
              tone="emerald"
              trend={{
                value: `${Math.round(completionPercent)}%`,
                positive: completionPercent >= 60,
              }}
            />
            <AnalyticsCard
              icon={Clock}
              label="Today"
              value={todayTasks.length + todayCompletedCount}
              subValue={`${todayCompletedCount} completed today`}
              tone="amber"
              urgent={hasUrgentTasks}
            />
            <AnalyticsCard
              icon={Zap}
              label="Productivity"
              value={
                analytics?.productivityScore ?? Math.round(completionPercent)
              }
              subValue={`${analytics?.streakData?.current || 0} day streak`}
              tone="violet"
              trend={{
                value: `${
                  analytics?.monthlyCompletionRate ??
                  Math.round(completionPercent)
                }%`,
                positive:
                  (analytics?.monthlyCompletionRate ?? completionPercent) >= 70,
              }}
            />
          </div>

          <section className="app-panel rounded-2xl p-4">
            <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
              <div>
                <h2 className="flex items-center gap-2 text-sm font-semibold text-slate-950 dark:text-white">
                  <Filter className="h-4 w-4 text-blue-600 dark:text-blue-300" />
                  Find and filter
                </h2>
                <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">
                  {filteredTaskCount} task
                  {filteredTaskCount === 1 ? "" : "s"} match the current view.
                </p>
              </div>
              <div className="inline-flex rounded-lg border border-slate-200 bg-slate-50 p-1 dark:border-white/10 dark:bg-white/[0.03]">
                <button
                  type="button"
                  onClick={() => setViewMode("cards")}
                  aria-pressed={viewMode === "cards"}
                  className={`inline-flex h-8 items-center gap-2 rounded-md px-3 text-xs font-semibold transition ${
                    viewMode === "cards"
                      ? "bg-white text-slate-900 shadow-sm dark:bg-white/[0.1] dark:text-white"
                      : "text-slate-500 hover:text-slate-800 dark:text-slate-400 dark:hover:text-white"
                  }`}
                >
                  <LayoutGrid className="h-3.5 w-3.5" />
                  Cards
                </button>
                <button
                  type="button"
                  onClick={() => setViewMode("list")}
                  aria-pressed={viewMode === "list"}
                  className={`inline-flex h-8 items-center gap-2 rounded-md px-3 text-xs font-semibold transition ${
                    viewMode === "list"
                      ? "bg-white text-slate-900 shadow-sm dark:bg-white/[0.1] dark:text-white"
                      : "text-slate-500 hover:text-slate-800 dark:text-slate-400 dark:hover:text-white"
                  }`}
                >
                  <List className="h-3.5 w-3.5" />
                  List
                </button>
              </div>
            </div>

            <div className="grid gap-3 md:grid-cols-[minmax(0,1fr)_220px]">
              <label className="relative block">
                <span className="sr-only">Search tasks</span>
                <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
                <input
                  type="search"
                  placeholder="Search title or description"
                  value={searchTerm}
                  onChange={(event) => setSearchTerm(event.target.value)}
                  className="h-10 w-full rounded-lg border border-slate-200 bg-white pl-10 pr-10 text-sm text-slate-900 outline-none transition placeholder:text-slate-400 focus:border-blue-400 focus:ring-2 focus:ring-blue-100 dark:border-white/10 dark:bg-white/[0.04] dark:text-white dark:focus:border-blue-400/40 dark:focus:ring-blue-400/10"
                />
                {searchTerm && (
                  <button
                    type="button"
                    onClick={() => setSearchTerm("")}
                    className="absolute right-2 top-1/2 inline-flex h-7 w-7 -translate-y-1/2 items-center justify-center rounded-md text-slate-400 transition hover:bg-slate-100 hover:text-slate-700 dark:hover:bg-white/[0.07] dark:hover:text-white"
                    aria-label="Clear task search"
                  >
                    <X className="h-3.5 w-3.5" />
                  </button>
                )}
              </label>

              <label className="relative block">
                <span className="sr-only">Filter by priority</span>
                <AlertCircle className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
                <select
                  value={filterPriority}
                  onChange={(event) => setFilterPriority(event.target.value)}
                  className="h-10 w-full appearance-none rounded-lg border border-slate-200 bg-white pl-10 pr-8 text-sm text-slate-700 outline-none transition focus:border-blue-400 focus:ring-2 focus:ring-blue-100 dark:border-white/10 dark:bg-[#151923] dark:text-slate-200 dark:focus:border-blue-400/40 dark:focus:ring-blue-400/10"
                >
                  <option value="all">All priorities</option>
                  <option value="high">High priority</option>
                  <option value="medium">Medium priority</option>
                  <option value="low">Low priority</option>
                </select>
              </label>
            </div>
          </section>

          <div className="grid items-start gap-4 xl:grid-cols-[minmax(0,1fr)_340px]">
            <div className="min-w-0">
              {loading && totalTasks === 0 ? (
                <div className="space-y-4">
                  {[0, 1, 2].map((item) => (
                    <div
                      key={item}
                      className="overflow-hidden rounded-2xl border border-slate-200 bg-white p-4 shadow-sm dark:border-white/10 dark:bg-[#10131c]"
                    >
                      <div className="h-10 animate-pulse rounded-lg bg-slate-100 dark:bg-white/[0.04]" />
                      <div className="mt-4 grid gap-3 md:grid-cols-2">
                        <div className="h-28 animate-pulse rounded-xl bg-slate-100 dark:bg-white/[0.04]" />
                        <div className="h-28 animate-pulse rounded-xl bg-slate-100 dark:bg-white/[0.04]" />
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <TaskList
                  todayTasks={filteredTodayTasks}
                  upcomingTasks={filteredUpcomingTasks}
                  completedTasks={filteredCompletedTasks}
                  viewMode={viewMode}
                  onEdit={(task) => {
                    setEditTask(task);
                    setShowForm(true);
                  }}
                  onMarkDone={handleMarkDone}
                  onDelete={handleDeleteTask}
                  recentlyDeletedTask={recentlyDeletedTask}
                  onUndoDelete={handleUndoDelete}
                />
              )}
            </div>

            <aside className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm dark:border-white/10 dark:bg-[#10131c] xl:sticky xl:top-4">
              <div className="flex items-center justify-between gap-3">
                <div>
                  <p className="text-xs font-semibold uppercase tracking-wider text-slate-500 dark:text-slate-400">
                    Progress
                  </p>
                  <h2 className="mt-1 text-base font-semibold text-slate-950 dark:text-white">
                    Overall completion
                  </h2>
                </div>
                <span className="text-2xl font-semibold text-emerald-700 dark:text-emerald-200">
                  {Math.round(completionPercent)}%
                </span>
              </div>

              <div className="mt-5 h-2 overflow-hidden rounded-full bg-slate-100 dark:bg-white/[0.06]">
                <div
                  className="h-full rounded-full bg-emerald-500 transition-[width] duration-500"
                  style={{ width: `${Math.min(completionPercent, 100)}%` }}
                />
              </div>
              <p className="mt-2 text-xs text-slate-500 dark:text-slate-400">
                {completedCount} of {totalTasks} tasks completed
              </p>

              <div className="mt-5 grid grid-cols-3 gap-2">
                <ProgressCount
                  label="Today"
                  value={todayTasks.length}
                  tone="blue"
                />
                <ProgressCount
                  label="Upcoming"
                  value={upcomingTasks.length}
                  tone="amber"
                />
                <ProgressCount
                  label="Done"
                  value={completedTasks.length}
                  tone="emerald"
                />
              </div>

              <div className="mt-5 rounded-xl border border-slate-200 bg-slate-50 p-3 dark:border-white/10 dark:bg-white/[0.03]">
                <div className="flex items-center gap-2">
                  <Zap className="h-4 w-4 text-violet-600 dark:text-violet-300" />
                  <p className="text-sm font-medium text-slate-800 dark:text-slate-200">
                    Current streak
                  </p>
                </div>
                <p className="mt-2 text-2xl font-semibold text-slate-950 dark:text-white">
                  {analytics?.streakData?.current || 0} days
                </p>
                <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">
                  Keep completing tasks to extend it.
                </p>
              </div>
            </aside>
          </div>
        </div>
      </main>

      {showForm && (
        <TaskForm
          task={editTask}
          onClose={() => {
            setShowForm(false);
            setEditTask(null);
          }}
          onSave={handleSaveTask}
          loading={loading}
        />
      )}

      <CelebrationPopup
        celebrations={celebrations}
        isOpen={showCelebrationPopup}
        onClose={closeCelebrationPopup}
      />
    </div>
  );
};

const AnalyticsCard = ({
  icon,
  label,
  value,
  subValue,
  tone,
  trend,
  urgent,
}) => {
  const Icon = icon;
  const tones = {
    blue: "border-blue-200 bg-blue-50 text-blue-700 dark:border-blue-400/20 dark:bg-blue-400/10 dark:text-blue-200",
    emerald:
      "border-emerald-200 bg-emerald-50 text-emerald-700 dark:border-emerald-400/20 dark:bg-emerald-400/10 dark:text-emerald-200",
    amber:
      "border-amber-200 bg-amber-50 text-amber-700 dark:border-amber-400/20 dark:bg-amber-400/10 dark:text-amber-200",
    violet:
      "border-violet-200 bg-violet-50 text-violet-700 dark:border-violet-400/20 dark:bg-violet-400/10 dark:text-violet-200",
  };

  return (
    <div
      className={`app-panel rounded-2xl p-4 ${
        urgent
          ? "border-rose-300 dark:border-rose-400/30"
          : "border-slate-200 dark:border-white/10"
      }`}
    >
      <div className="flex items-start justify-between gap-3">
        <div
          className={`flex h-10 w-10 items-center justify-center rounded-lg border ${tones[tone]}`}
        >
          <Icon className="h-4 w-4" />
        </div>
        {urgent ? (
          <span className="inline-flex items-center gap-1 rounded-md bg-rose-50 px-2 py-1 text-[10px] font-semibold text-rose-700 dark:bg-rose-400/10 dark:text-rose-200">
            <AlertCircle className="h-3 w-3" />
            High priority
          </span>
        ) : trend ? (
          <span
            className={`inline-flex items-center gap-1 text-[11px] font-medium ${
              trend.positive
                ? "text-emerald-600 dark:text-emerald-300"
                : "text-rose-600 dark:text-rose-300"
            }`}
          >
            <TrendingUp
              className={`h-3 w-3 ${trend.positive ? "" : "rotate-180"}`}
            />
            {trend.value}
          </span>
        ) : null}
      </div>
      <p className="mt-4 text-xs text-slate-500 dark:text-slate-400">{label}</p>
      <p className="mt-1 text-2xl font-semibold text-slate-950 dark:text-white">
        {value}
      </p>
      <p className="mt-1 truncate text-[11px] text-slate-400 dark:text-slate-500">
        {subValue}
      </p>
    </div>
  );
};

const ProgressCount = ({ label, value, tone }) => {
  const tones = {
    blue: "border-blue-200 bg-blue-50 text-blue-700 dark:border-blue-400/20 dark:bg-blue-400/10 dark:text-blue-200",
    amber:
      "border-amber-200 bg-amber-50 text-amber-700 dark:border-amber-400/20 dark:bg-amber-400/10 dark:text-amber-200",
    emerald:
      "border-emerald-200 bg-emerald-50 text-emerald-700 dark:border-emerald-400/20 dark:bg-emerald-400/10 dark:text-emerald-200",
  };

  return (
    <div className={`rounded-lg border p-3 text-center ${tones[tone]}`}>
      <p className="text-lg font-semibold">{value}</p>
      <p className="text-[10px] opacity-70">{label}</p>
    </div>
  );
};

export default TodoPage;
