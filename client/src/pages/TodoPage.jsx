import React, { useState, useEffect } from "react";
import axios from "axios";
import {
  Plus,
  Calendar,
  Clock,
  Target,
  TrendingUp,
  Filter,
  Search,
  CheckCircle,
  AlertCircle,
  BarChart3,
  Zap,
  Star,
  RefreshCw,
  Download,
  Settings
} from "lucide-react";
import Sidebar from "../components/dashboard/Sidebar";
import TaskList from "../components/todo/TaskList";
import TaskForm from "../components/todo/TaskForm";
import CelebrationPopup from "../components/common/CelebrationPopup";
import useCelebrationNotifications from "../hooks/useCelebrationNotifications";

const API_BASE = import.meta.env.VITE_API_BASE || "http://localhost:5000";

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
  const [viewMode, setViewMode] = useState("cards"); // cards or list
  const [loading, setLoading] = useState(false);
  const [analytics, setAnalytics] = useState(null);
  const [error, setError] = useState(null);
  const [lastFetchAttempt, setLastFetchAttempt] = useState(null);

  // Celebration notifications
  const {
    celebrations,
    showPopup: showCelebrationPopup,
    closePopup: closeCelebrationPopup
  } = useCelebrationNotifications();

  const normalizeDate = (date) => {
    const d = new Date(date);
    d.setHours(0, 0, 0, 0);
    return d.toISOString();
  };

  // Fetch tasks from API
  const fetchTasks = async () => {
    if (!token) {
      console.error("No authentication token found");
      setError("Authentication required. Please log in again.");
      return;
    }

    setLoading(true);
    setError(null);
    setLastFetchAttempt(new Date());
    try {
      const todayISO = normalizeDate(new Date());
      const tomorrowISO = normalizeDate(
        new Date(new Date().getTime() + 24 * 3600000)
      );

      console.log("Fetching tasks for user with token:", token.substring(0, 20) + "...");
      console.log("Date parameters:", { todayISO, tomorrowISO });

      const headers = { Authorization: `Bearer ${token}` };

      // Fetch today's tasks
      const todayRes = await axios.get(`${API_BASE}/api/todos`, {
        headers,
        params: { date: todayISO },
        timeout: 10000, // 10 second timeout
      });

      console.log("Today's tasks response:", todayRes.data?.length || 0, "tasks");

      // Fetch upcoming tasks
      const upcomingRes = await axios.get(`${API_BASE}/api/todos/upcoming`, {
        headers,
        params: { startDate: tomorrowISO },
        timeout: 10000, // 10 second timeout
      });

      console.log("Upcoming tasks response:", upcomingRes.data?.length || 0, "tasks");

      const normalize = (arr) => {
        if (!Array.isArray(arr)) {
          console.warn("Expected array but got:", typeof arr, arr);
          return [];
        }
        return arr.map((t) => ({
          ...t,
          date: t.date ? new Date(t.date).toISOString() : null,
          completedAtStr: t.completedAt
            ? new Date(t.completedAt).toLocaleString()
            : null,
        }));
      };

      // Separate pending and completed tasks
      const allTasks = [...(todayRes.data || []), ...(upcomingRes.data || [])];
      const allCompletedTasks = normalize(allTasks.filter((t) => t.completed));

      // Only keep pending (non-completed) tasks in today and upcoming arrays
      const normalizedTodayTasks = normalize((todayRes.data || []).filter((t) => !t.completed));
      const normalizedUpcomingTasks = normalize((upcomingRes.data || []).filter((t) => !t.completed));

      console.log("Processed tasks:", {
        todayPending: normalizedTodayTasks.length,
        upcoming: normalizedUpcomingTasks.length,
        completed: allCompletedTasks.length,
        total: allTasks.length
      });

      setTodayTasks(normalizedTodayTasks);
      setUpcomingTasks(normalizedUpcomingTasks);
      setCompletedTasks(allCompletedTasks);
    } catch (err) {
      console.error("Error fetching tasks:", {
        message: err.message,
        status: err.response?.status,
        statusText: err.response?.statusText,
        data: err.response?.data,
        config: {
          url: err.config?.url,
          method: err.config?.method,
          params: err.config?.params
        }
      });

      // Handle specific error cases
      let errorMessage = "Failed to load tasks. ";
      if (err.response?.status === 401) {
        console.error("Authentication failed - token may be invalid");
        errorMessage += "Please log in again.";
        // Could redirect to login
      } else if (err.response?.status === 403) {
        console.error("Access forbidden - user may not have permission");
        errorMessage += "Access denied.";
      } else if (err.code === 'ECONNABORTED') {
        console.error("Request timeout - server may be slow");
        errorMessage += "Server is taking too long to respond.";
      } else if (err.code === 'NETWORK_ERROR') {
        console.error("Network error - check internet connection");
        errorMessage += "Check your internet connection.";
      } else {
        errorMessage += "Please try again.";
      }

      setError(errorMessage);

      // Set empty arrays to prevent UI errors
      setTodayTasks([]);
      setUpcomingTasks([]);
      setCompletedTasks([]);
    } finally {
      setLoading(false);
    }
  };

  // Update time every second
  useEffect(() => {
    const timer = setInterval(() => setCurrentTime(new Date()), 1000);
    return () => clearInterval(timer);
  }, []);

  useEffect(() => {
    fetchTasks();
    fetchAnalytics();
  }, []);

  // Fetch analytics data
  const fetchAnalytics = async () => {
    if (!token) {
      console.error("No authentication token found for analytics");
      return;
    }

    try {
      const response = await axios.get(`${API_BASE}/api/todos/analytics`, {
        headers: { Authorization: `Bearer ${token}` },
        timeout: 10000, // 10 second timeout
      });
      console.log("Analytics API response:", response.data);
      setAnalytics(response.data);
    } catch (err) {
      console.error("Error fetching analytics:", {
        message: err.message,
        status: err.response?.status,
        statusText: err.response?.statusText,
        data: err.response?.data
      });

      if (err.response?.status === 401) {
        console.error("Analytics authentication failed - token may be invalid");
      } else if (err.response?.status === 403) {
        console.error("Analytics access forbidden");
      }

      // Set null analytics to use frontend calculations
      setAnalytics(null);
    }
  };

  // Enhanced save task with loading states
  const handleSaveTask = async (task) => {
    setLoading(true);
    try {
      if (task._id) {
        await axios.put(`${API_BASE}/api/todos/${task._id}`, task, {
          headers: { Authorization: `Bearer ${token}` },
        });
      } else {
        if (!task.date) task.date = normalizeDate(new Date());
        await axios.post(`${API_BASE}/api/todos`, task, {
          headers: { Authorization: `Bearer ${token}` },
        });
      }
      setShowForm(false);
      setEditTask(null);
      await fetchTasks();
      await fetchAnalytics(); // Refresh analytics
    } catch (err) {
      console.error("Failed to save task:", err);
    } finally {
      setLoading(false);
    }
  };

  // Enhanced refresh function
  const handleRefresh = async () => {
    setLoading(true);
    try {
      await Promise.all([fetchTasks(), fetchAnalytics()]);
    } finally {
      setLoading(false);
    }
  };

  // Filter tasks based on search and priority
  const filterTasks = (tasks) => {
    return tasks.filter(task => {
      const matchesSearch = !searchTerm ||
        task.text?.toLowerCase().includes(searchTerm.toLowerCase()) ||
        task.title?.toLowerCase().includes(searchTerm.toLowerCase()) ||
        task.description?.toLowerCase().includes(searchTerm.toLowerCase());

      const matchesPriority = filterPriority === "all" ||
        task.label?.toLowerCase() === filterPriority.toLowerCase() ||
        task.priority?.toLowerCase() === filterPriority.toLowerCase();

      return matchesSearch && matchesPriority;
    });
  };

  // Get filtered tasks
  const filteredTodayTasks = filterTasks(todayTasks);
  const filteredUpcomingTasks = filterTasks(upcomingTasks);
  const filteredCompletedTasks = filterTasks(completedTasks);

  // Toggle completed status
  const handleMarkDone = async (task) => {
    try {
      const response = await axios.put(
        `${API_BASE}/api/todos/${task._id}`,
        { completed: !task.completed },
        { headers: { Authorization: `Bearer ${token}` } }
      );

      const updatedTaskRaw = response.data;
      const updatedTask = {
        ...updatedTaskRaw,
        date: updatedTaskRaw.date
          ? new Date(updatedTaskRaw.date).toISOString()
          : null,
        completedAtStr: updatedTaskRaw.completedAt
          ? new Date(updatedTaskRaw.completedAt).toLocaleString()
          : null,
      };

      if (updatedTask.completed) {
        // Remove from pending lists and add to completed
        setTodayTasks((prev) => prev.filter((t) => t._id !== updatedTask._id));
        setUpcomingTasks((prev) =>
          prev.filter((t) => t._id !== updatedTask._id)
        );
        setCompletedTasks((prev) => [updatedTask, ...prev]);
      } else {
        // Remove from completed list
        setCompletedTasks((prev) =>
          prev.filter((t) => t._id !== updatedTask._id)
        );
        // Move back to correct list based on date
        const taskDate = new Date(updatedTask.date);
        const today = new Date();
        today.setHours(0, 0, 0, 0);
        if (taskDate.getTime() === today.getTime()) {
          setTodayTasks((prev) => [updatedTask, ...prev]);
        } else {
          setUpcomingTasks((prev) => [updatedTask, ...prev]);
        }
      }
    } catch (err) {
      console.error("Failed to toggle completed:", err);
    }
  };

  // Delete a task
  const handleDeleteTask = async (taskId) => {
    try {
      const taskToDelete =
        todayTasks.find((t) => t._id === taskId) ||
        upcomingTasks.find((t) => t._id === taskId) ||
        completedTasks.find((t) => t._id === taskId);

      await axios.delete(`${API_BASE}/api/todos/${taskId}`, {
        headers: { Authorization: `Bearer ${token}` },
      });

      setRecentlyDeletedTask(taskToDelete); // Save for undo
      setTodayTasks((prev) => prev.filter((t) => t._id !== taskId));
      setUpcomingTasks((prev) => prev.filter((t) => t._id !== taskId));
      setCompletedTasks((prev) => prev.filter((t) => t._id !== taskId));
    } catch (err) {
      console.error("Failed to delete task:", err);
    }
  };

  // Undo deletion
  const handleUndoDelete = async () => {
    if (!recentlyDeletedTask) return;

    try {
      const { _id, ...taskData } = recentlyDeletedTask;
      const response = await axios.post(`${API_BASE}/api/todos`, taskData, {
        headers: { Authorization: `Bearer ${token}` },
      });

      // Refetch tasks to update lists
      await fetchTasks();
      setRecentlyDeletedTask(null);
    } catch (err) {
      console.error("Failed to undo deletion:", err);
    }
  };

  const totalTasks =
    todayTasks.length + upcomingTasks.length + completedTasks.length;
  const completedCount = completedTasks.length;
  const completionPercent = totalTasks
    ? (completedCount / totalTasks) * 100
    : 0;

  // Calculate today's completed tasks
  const todayCompletedTasks = completedTasks.filter(task => {
    if (!task.date) return false;
    const taskDate = new Date(task.date);
    const today = new Date();
    taskDate.setHours(0, 0, 0, 0);
    today.setHours(0, 0, 0, 0);
    return taskDate.getTime() === today.getTime();
  });
  const todayCompletedCount = todayCompletedTasks.length;

  // Debug logging
  console.log("Frontend calculations:", {
    todayTasksLength: todayTasks.length,
    upcomingTasksLength: upcomingTasks.length,
    completedTasksLength: completedTasks.length,
    todayCompletedCount,
    totalTasks,
    completedCount,
    completionPercent,
    analytics
  });

  return (
    <div className="flex bg-[#0f1419] min-h-screen text-white relative overflow-hidden">
      {/* Animated Background */}
      <div className="absolute inset-0 bg-gradient-to-br from-slate-900/20 via-blue-900/10 to-purple-900/20"></div>
      <div className="absolute inset-0">
        <div className="absolute top-1/4 left-1/4 w-96 h-96 bg-cyan-500/5 rounded-full blur-3xl animate-pulse"></div>
        <div className="absolute bottom-1/4 right-1/4 w-96 h-96 bg-purple-500/5 rounded-full blur-3xl animate-pulse"></div>
      </div>

      {/* Sidebar */}
      <Sidebar
        onLogout={onLogout}
        collapsed={collapsed}
        setCollapsed={setCollapsed}
        userRole="employee"
      />

      {/* Main Content */}
      <main className={`relative z-10 flex-1 transition-all duration-300 ${collapsed ? "ml-24" : "ml-72"} p-8`}>
        {/* Modern Header */}
        <div className="mb-12">
          <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between mb-6">
            <div>
              <h1 className="text-5xl font-bold mb-2">
                <span className="bg-gradient-to-r from-emerald-400 via-cyan-400 to-blue-400 bg-clip-text text-transparent">
                  Task Manager
                </span>
              </h1>
              <p className="text-xl text-gray-300 mb-4">
                Boost your productivity with smart task management 🚀
              </p>
            </div>
            <div className="flex items-center space-x-4">
              <button
                onClick={handleRefresh}
                disabled={loading}
                className="flex items-center gap-2 px-4 py-2 bg-gradient-to-r from-slate-600 to-slate-700 hover:from-slate-500 hover:to-slate-600 disabled:from-gray-400 disabled:to-gray-500 text-white rounded-xl font-medium transition-all duration-300 hover:scale-105 disabled:scale-100"
              >
                <RefreshCw className={`h-4 w-4 ${loading ? 'animate-spin' : ''}`} />
                <span>{loading ? "Refreshing..." : "Refresh"}</span>
              </button>
              <button
                onClick={() => setShowForm(true)}
                className="flex items-center gap-2 px-6 py-2 bg-gradient-to-r from-emerald-500 to-cyan-600 hover:from-emerald-600 hover:to-cyan-700 text-white rounded-xl font-semibold transition-all duration-300 hover:scale-105 hover:shadow-lg hover:shadow-emerald-500/25"
              >
                <Plus className="h-4 w-4" />
                <span>Add Task</span>
              </button>
              <div className="bg-gradient-to-br from-slate-800/50 to-slate-900/50 backdrop-blur-sm border border-slate-600/30 rounded-2xl px-6 py-4">
                <div className="flex items-center space-x-3">
                  <div className="w-3 h-3 bg-green-400 rounded-full animate-pulse"></div>
                  <div>
                    <p className="text-sm text-gray-400">Live Time</p>
                    <p className="text-cyan-400 font-mono text-sm">
                      {currentTime.toLocaleTimeString("en-US", {
                        hour: "2-digit",
                        minute: "2-digit",
                        second: "2-digit",
                      })}
                    </p>
                  </div>
                </div>
              </div>
            </div>
          </div>
          <div className="text-gray-400 text-lg">
            {currentTime.toLocaleDateString("en-US", {
              weekday: "long",
              year: "numeric",
              month: "long",
              day: "numeric",
            })}
          </div>
        </div>

        {/* Error Display */}
        {error && (
          <div className="mb-8">
            <div className="bg-gradient-to-r from-red-900/50 to-red-800/50 backdrop-blur-sm border border-red-600/30 rounded-2xl p-6">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-red-500 to-red-600 flex items-center justify-center text-white">
                    <AlertCircle className="h-6 w-6" />
                  </div>
                  <div>
                    <h3 className="text-lg font-semibold text-red-200">Data Loading Error</h3>
                    <p className="text-red-300">{error}</p>
                    {lastFetchAttempt && (
                      <p className="text-red-400 text-sm mt-1">
                        Last attempt: {lastFetchAttempt.toLocaleTimeString()}
                      </p>
                    )}
                  </div>
                </div>
                <button
                  onClick={() => {
                    setError(null);
                    fetchTasks();
                    fetchAnalytics();
                  }}
                  disabled={loading}
                  className="flex items-center gap-2 px-4 py-2 bg-red-600 hover:bg-red-700 disabled:bg-red-800 text-white rounded-xl font-medium transition-all duration-300 hover:scale-105 disabled:scale-100"
                >
                  <RefreshCw className={`h-4 w-4 ${loading ? 'animate-spin' : ''}`} />
                  {loading ? "Retrying..." : "Retry"}
                </button>
              </div>
            </div>
          </div>
        )}

        {/* Enhanced Analytics Cards */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-8">
          <AnalyticsCard
            icon={<Target className="h-6 w-6" />}
            label="Total Tasks"
            value={totalTasks}
            subValue="All tasks"
            bg="from-blue-500/20 to-cyan-500/20"
            iconBg="from-blue-500 to-cyan-500"
            textColor="text-cyan-400"
          />
          <AnalyticsCard
            icon={<CheckCircle className="h-6 w-6" />}
            label="Completed"
            value={completedCount}
            subValue={`${Math.round(completionPercent)}% done`}
            bg="from-emerald-500/20 to-green-500/20"
            iconBg="from-emerald-500 to-green-500"
            textColor="text-emerald-400"
            trend={{ value: `${Math.round(completionPercent)}%`, positive: completionPercent > 60 }}
          />
          <AnalyticsCard
            icon={<Clock className="h-6 w-6" />}
            label="Today's Tasks"
            value={filteredTodayTasks.length + todayCompletedCount}
            subValue={`${todayCompletedCount} completed`}
            bg="from-amber-500/20 to-orange-500/20"
            iconBg="from-amber-500 to-orange-500"
            textColor="text-amber-400"
            urgent={filteredTodayTasks.filter(t => t.priority === 'High' || t.label === 'High').length > 0}
          />
          <AnalyticsCard
            icon={<Zap className="h-6 w-6" />}
            label="Productivity Score"
            value={analytics?.productivityScore || 0}
            subValue={`Streak: ${analytics?.streakData?.current || 0} days`}
            bg="from-purple-500/20 to-pink-500/20"
            iconBg="from-purple-500 to-pink-500"
            textColor="text-purple-400"
            trend={{ value: `${analytics?.monthlyCompletionRate || 0}%`, positive: (analytics?.monthlyCompletionRate || 0) > 70 }}
          />
        </div>

        {/* Filters and Search */}
        <div className="bg-gradient-to-br from-slate-800/40 to-slate-900/40 backdrop-blur-sm border border-slate-600/30 rounded-2xl p-6 mb-8">
          <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between mb-6">
            <h3 className="text-xl font-bold text-white mb-4 lg:mb-0 flex items-center gap-3">
              <Filter className="h-6 w-6 text-cyan-400" />
              Task Filters
            </h3>
            <div className="flex items-center gap-2 text-sm text-gray-400">
              <Zap className="h-4 w-4" />
              {filteredTodayTasks.length + filteredUpcomingTasks.length + filteredCompletedTasks.length} tasks found
            </div>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-gray-400" />
              <input
                type="text"
                placeholder="Search tasks..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="w-full bg-slate-800/50 border border-slate-600/50 rounded-xl pl-10 pr-4 py-3 text-white placeholder-gray-400 focus:ring-2 focus:ring-cyan-400 focus:border-cyan-400 outline-none transition-all duration-300"
              />
            </div>
            <div className="relative">
              <AlertCircle className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-gray-400" />
              <select
                value={filterPriority}
                onChange={(e) => setFilterPriority(e.target.value)}
                className="w-full bg-slate-800/50 border border-slate-600/50 rounded-xl pl-10 pr-4 py-3 text-white focus:ring-2 focus:ring-purple-400 focus:border-purple-400 outline-none transition-all duration-300 appearance-none"
              >
                <option value="all">All Priorities</option>
                <option value="high">High Priority</option>
                <option value="medium">Medium Priority</option>
                <option value="low">Low Priority</option>
              </select>
            </div>
            <div className="flex items-center gap-2">
              <button
                onClick={() => setViewMode(viewMode === "cards" ? "list" : "cards")}
                className="flex items-center gap-2 px-4 py-3 bg-slate-700/50 hover:bg-slate-600/50 border border-slate-600/30 text-gray-300 rounded-xl font-medium transition-all duration-300"
              >
                <BarChart3 className="h-4 w-4" />
                <span>{viewMode === "cards" ? "List View" : "Card View"}</span>
              </button>
            </div>
          </div>
        </div>

        {/* Enhanced Progress Section */}
        <div className="bg-gradient-to-br from-slate-800/40 to-slate-900/40 backdrop-blur-sm border border-slate-600/30 rounded-2xl p-6 mb-8">
          <div className="flex items-center justify-between mb-6">
            <h3 className="text-xl font-bold text-white flex items-center gap-3">
              <Target className="h-6 w-6 text-emerald-400" />
              Progress Overview
            </h3>
            <div className="flex items-center gap-2 text-sm text-gray-400">
              <Star className="h-4 w-4" />
              {Math.round(completionPercent)}% Complete
            </div>
          </div>

          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <span className="text-gray-300 font-medium">Overall Completion</span>
              <span className="text-white font-bold">{completedCount} / {totalTasks} tasks</span>
            </div>
            <div className="w-full bg-slate-700/50 rounded-full h-3">
              <div
                className="bg-gradient-to-r from-emerald-400 to-cyan-500 h-3 rounded-full transition-all duration-700 relative overflow-hidden"
                style={{ width: `${completionPercent}%` }}
              >
                <div className="absolute inset-0 bg-white/20 animate-pulse"></div>
              </div>
            </div>
            <div className="grid grid-cols-3 gap-4 mt-6">
              <div className="text-center">
                <div className="text-2xl font-bold text-cyan-400">{filteredTodayTasks.length}</div>
                <div className="text-xs text-gray-400">Today</div>
              </div>
              <div className="text-center">
                <div className="text-2xl font-bold text-amber-400">{filteredUpcomingTasks.length}</div>
                <div className="text-xs text-gray-400">Upcoming</div>
              </div>
              <div className="text-center">
                <div className="text-2xl font-bold text-emerald-400">{filteredCompletedTasks.length}</div>
                <div className="text-xs text-gray-400">Completed</div>
              </div>
            </div>
          </div>
        </div>

        {/* Enhanced Task List */}
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

        {/* Task Form Modal */}
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

        {/* Celebration Popup */}
        <CelebrationPopup
          celebrations={celebrations}
          isOpen={showCelebrationPopup}
          onClose={closeCelebrationPopup}
        />
      </main>
    </div>
  );
};

// Enhanced Analytics Card Component
const AnalyticsCard = ({
  icon,
  label,
  value,
  subValue,
  bg,
  iconBg,
  textColor,
  trend,
  urgent
}) => (
  <div
    className={`bg-gradient-to-br ${bg} backdrop-blur-sm border border-slate-600/30 rounded-2xl p-6 relative overflow-hidden group hover:scale-105 transition-all duration-300 ${urgent ? 'ring-2 ring-red-500/30 animate-pulse' : ''}`}
  >
    <div className="absolute inset-0 bg-gradient-to-br from-white/5 to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-300"></div>
    <div className="relative z-10">
      <div className="flex items-center justify-between mb-4">
        <div className={`w-12 h-12 rounded-xl bg-gradient-to-br ${iconBg} flex items-center justify-center text-white shadow-lg`}>
          {icon}
        </div>
        {trend && (
          <div className={`flex items-center gap-1 text-xs font-medium ${trend.positive ? 'text-emerald-400' : 'text-red-400'}`}>
            <TrendingUp className={`h-3 w-3 ${trend.positive ? '' : 'rotate-180'}`} />
            {trend.value}
          </div>
        )}
        {urgent && (
          <div className="flex items-center gap-1 text-xs font-medium text-red-400">
            <AlertCircle className="h-3 w-3" />
            Urgent
          </div>
        )}
      </div>
      <div>
        <p className="text-gray-400 text-sm font-medium mb-1">{label}</p>
        <p className="text-white font-bold text-3xl mb-1">{value}</p>
        {subValue && <p className="text-gray-400 text-xs">{subValue}</p>}
      </div>
    </div>
  </div>
);

export default TodoPage;
