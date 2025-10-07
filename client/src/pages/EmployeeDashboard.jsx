import React, { useState, useEffect, useCallback, useRef, useMemo } from "react";
import axios from "axios";
import { Link, useNavigate } from "react-router-dom";
import dayjs from "dayjs";
import {
  TrendingUp,
  Clock,
  Target,
  Activity,
  Calendar,
  CheckSquare,
  AlertTriangle,
  Coffee,
  Play,
  Pause,
  RefreshCw,
  BarChart3,
  Zap,
  Timer
} from "lucide-react";

import SummaryCards from "../components/dashboard/SummaryCards";
import TodayTasks from "../components/dashboard/TodayTasks";
import Sidebar from "../components/dashboard/Sidebar";
import NotificationBell from "../components/dashboard/NotificationBell";
import WishPopup from "../components/dashboard/WishPopup";
import NoticeOverlay from "../components/dashboard/NoticeOverlay";
import DynamicNotificationOverlay from "../components/notifications/DynamicNotificationOverlay";
import notificationManager from "../utils/browserNotifications";
import CelebrationPopup from "../components/common/CelebrationPopup";
import useCelebrationNotifications from "../hooks/useCelebrationNotifications";
import newAttendanceService from "../services/newAttendanceService";

const API_BASE = import.meta.env.VITE_API_BASE || "http://localhost:5000";
const TASK_POLL_INTERVAL_MS = 10000;
const USER_POLL_INTERVAL_MS = 25000;
const DISMISSED_NOTI_KEY = "dismissedNotifications";

const EmployeeDashboard = ({ onLogout }) => {
  const [collapsed, setCollapsed] = useState(false);
  const [tasks, setTasks] = useState([]);
  const [loading, setLoading] = useState(false);
  const [currentTime, setCurrentTime] = useState(new Date());
  const [userName, setUserName] = useState("");
  const [userInfo, setUserInfo] = useState(null);
  const [summaryData, setSummaryData] = useState([]);
  const [notifications, setNotifications] = useState([]);
  const [dismissedNotificationIds, setDismissedNotificationIds] = useState(
    JSON.parse(localStorage.getItem(DISMISSED_NOTI_KEY)) || []
  );
  const [wishes, setWishes] = useState([]);
  const [showWishPopup, setShowWishPopup] = useState(false);

  // New enhanced state
  const [workStatus, setWorkStatus] = useState(null);
  const [weeklyStats, setWeeklyStats] = useState(null);
  const [recentActivity, setRecentActivity] = useState([]);
  const [productivity, setProductivity] = useState(null);
  const [dataLoading, setDataLoading] = useState({
    tasks: false,
    status: false,
    stats: false,
    activity: false
  });
  const [errors, setErrors] = useState({});
  const [lastRefresh, setLastRefresh] = useState(new Date());

  // Celebration notifications
  const {
    celebrations,
    showPopup: showCelebrationPopup,
    closePopup: closeCelebrationPopup
  } = useCelebrationNotifications();

  const prevTaskIdsRef = useRef(new Set()); // Track previous task IDs for new notifications
  const [browserNotificationsEnabled, setBrowserNotificationsEnabled] = useState(false);
  const navigate = useNavigate();

  // Format task data
  const formatTask = (task) => ({
    id: task._id,
    label: task.title || "Untitled Task",
    dueDateTime: task.dueDate
      ? new Date(task.dueDate).toLocaleString([], {
          year: "numeric",
          month: "short",
          day: "numeric",
          hour: "2-digit",
          minute: "2-digit",
        })
      : "",
    level: task.priority || "Normal",
    color:
      task.priority === "High"
        ? "red"
        : task.priority === "Medium"
        ? "yellow"
        : "green",
    assignedBy: task.assignedBy?.name || "Unknown",
    assignedTo: Array.isArray(task.assignedTo)
      ? task.assignedTo
          .map((u) =>
            typeof u === "string" ? "Unknown" : u?.name || "Unknown"
          )
          .join(", ")
      : "Unknown",
    dueDate: task.dueDate,
    status: task.status,
  });

  // Enhanced summary computation
  const computeSummary = useCallback(() => {
    const today = dayjs(currentTime).startOf("day");
    const completedTasks = tasks.filter(t => t.status?.toLowerCase() === "completed");
    const pendingTasks = tasks.filter(t => t.status?.toLowerCase() !== "completed");
    const highPriorityTasks = tasks.filter(t => t.level === "High" && t.status?.toLowerCase() !== "completed");
    const dueTodayTasks = tasks.filter(
      (t) => t.dueDate && dayjs(t.dueDate).isSame(today, "day") && t.status?.toLowerCase() !== "completed"
    );

    setSummaryData([
      {
        label: "All Tasks",
        count: tasks.length,
        icon: CheckSquare,
        color: "blue",
        trend: tasks.length > 0 ? Math.floor((completedTasks.length / tasks.length) * 100) + "%" : "0%"
      },
      {
        label: "Due Today",
        count: dueTodayTasks.length,
        icon: Calendar,
        color: "orange",
        urgent: dueTodayTasks.length > 0
      },
      {
        label: "High Priority",
        count: highPriorityTasks.length,
        icon: AlertTriangle,
        color: "red",
        urgent: highPriorityTasks.length > 0
      },
      {
        label: "Completed",
        count: completedTasks.length,
        icon: Target,
        color: "green",
        trend: tasks.length > 0 ? Math.floor((completedTasks.length / tasks.length) * 100) + "%" : "0%"
      }
    ]);
  }, [tasks, currentTime]);

  // Update notifications based on tasks & dismissed IDs
  const updateNotifications = useCallback(() => {
    const currentTaskIds = new Set(tasks.map((t) => t.id));
    const newNotifications = tasks
      .filter((t) => t.status?.toLowerCase() !== "completed")
      .map((t) => ({
        id: t.id,
        message: `Task: ${t.label} (Due: ${t.dueDateTime || "No date"})`,
        isNew: !prevTaskIdsRef.current.has(t.id),
        task: t, // Include full task data for browser notifications
      }))
      .filter((n) => !dismissedNotificationIds.includes(n.id));

    // Show browser notifications for new tasks
    if (browserNotificationsEnabled) {
      newNotifications
        .filter((n) => n.isNew)
        .forEach((n) => {
          notificationManager.showTaskAssigned(n.task);
        });
    }

    prevTaskIdsRef.current = currentTaskIds;
    setNotifications(newNotifications);
  }, [tasks, dismissedNotificationIds, browserNotificationsEnabled]);

  // Fetch tasks
  const fetchTasks = useCallback(async () => {
    const token = localStorage.getItem("token");
    if (!token) return navigate("/login", { replace: true });
    try {
      setLoading(true);
      const res = await axios.get(`${API_BASE}/api/tasks`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      setTasks(res.data.map(formatTask));
    } catch (err) {
      console.error("Error fetching tasks", err.response?.data || err.message);
    } finally {
      setLoading(false);
    }
  }, [navigate]);

  // Enhanced user info & wishes fetch
  const fetchUserAndWishes = useCallback(async () => {
    const token = localStorage.getItem("token");
    if (!token) return navigate("/login", { replace: true });
    try {
      const res = await axios.get(`${API_BASE}/api/users/me`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      setUserName(res.data?.name || "User");
      setUserInfo(res.data);

      const wishesRes = await axios.get(`${API_BASE}/api/wishes/me`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      const unreadWishes = wishesRes.data.filter((w) => !w.read);
      setWishes(unreadWishes);

      if (unreadWishes.length > 0) setShowWishPopup(true);
    } catch (err) {
      console.error(
        "Error fetching user or wishes:",
        err.response?.data || err.message
      );
      setErrors(prev => ({ ...prev, user: err.message }));
    }
  }, [navigate]);

  // Fetch work status using new attendance system
  const fetchWorkStatus = useCallback(async () => {
    const token = localStorage.getItem("token");
    if (!token) return;

    setDataLoading(prev => ({ ...prev, status: true }));
    try {
      const response = await newAttendanceService.getTodayStatus();

      if (response.success && response.data) {
        // Extract attendance data from new system response
        const attendanceData = response.data.attendance || {};

        // Map to format expected by dashboard components
        const mappedStatus = {
          currentlyWorking: attendanceData.currentlyWorking || false,
          onBreak: attendanceData.onBreak || false,
          workDuration: attendanceData.workDuration || "0h 0m",
          breakDuration: attendanceData.breakDuration || "0h 0m",
          workDurationSeconds: attendanceData.workDurationSeconds || 0,
          breakDurationSeconds: attendanceData.breakDurationSeconds || 0,
          arrivalTime: attendanceData.arrivalTime,
          arrivalTimeFormatted: attendanceData.arrivalTimeFormatted,
          isLate: attendanceData.isLate || false,
          timeline: attendanceData.events ? attendanceData.events.map(e => ({
            type: e.type,
            time: e.timestamp
          })) : []
        };

        setWorkStatus(mappedStatus);
        setErrors(prev => ({ ...prev, status: null }));
      }
    } catch (err) {
      console.error("Error fetching work status:", err);
      setErrors(prev => ({ ...prev, status: err.message }));
    } finally {
      setDataLoading(prev => ({ ...prev, status: false }));
    }
  }, []);

  // Fetch weekly statistics using new attendance system
  const fetchWeeklyStats = useCallback(async () => {
    const token = localStorage.getItem("token");
    if (!token) return;

    setDataLoading(prev => ({ ...prev, stats: true }));
    try {
      const now = new Date();
      const diffToMonday = (now.getDay() + 6) % 7;
      const monday = new Date(now);
      monday.setDate(now.getDate() - diffToMonday);
      monday.setHours(0, 0, 0, 0);

      const sunday = new Date(monday);
      sunday.setDate(monday.getDate() + 6);
      sunday.setHours(23, 59, 59, 999);

      const response = await newAttendanceService.getMyWeeklySummary(monday, sunday);

      if (response.success && response.data) {
        setWeeklyStats(response.data);
        setErrors(prev => ({ ...prev, stats: null }));
      }
    } catch (err) {
      console.error("Error fetching weekly stats:", err);
      setErrors(prev => ({ ...prev, stats: err.message }));
    } finally {
      setDataLoading(prev => ({ ...prev, stats: false }));
    }
  }, []);


  // Enhanced data fetching on mount
  useEffect(() => {
    const initializeDashboard = async () => {
      await Promise.all([
        fetchTasks(),
        fetchUserAndWishes(),
        fetchWorkStatus()
      ]);
      setLastRefresh(new Date());
    };

    initializeDashboard();
  }, [fetchTasks, fetchUserAndWishes, fetchWorkStatus]);

  // Auto-refresh with smart intervals
  useEffect(() => {
    const taskInterval = setInterval(fetchTasks, TASK_POLL_INTERVAL_MS);
    const userInterval = setInterval(fetchUserAndWishes, USER_POLL_INTERVAL_MS);
    const statusInterval = setInterval(fetchWorkStatus, 30000); // 30s for work status

    return () => {
      clearInterval(taskInterval);
      clearInterval(userInterval);
      clearInterval(statusInterval);
    };
  }, [fetchTasks, fetchUserAndWishes, fetchWorkStatus]);

  // Listen for attendance data updates from manual attendance management
  useEffect(() => {
    const handleAttendanceUpdate = async () => {
      console.log("🔄 EmployeeDashboard: Received attendanceDataUpdated event, refreshing work status...");

      // Refresh work status and tasks to reflect manual attendance changes
      await Promise.all([
        fetchWorkStatus(),
        fetchTasks()
      ]);

      setLastRefresh(new Date());
    };

    window.addEventListener('attendanceDataUpdated', handleAttendanceUpdate);

    return () => {
      window.removeEventListener('attendanceDataUpdated', handleAttendanceUpdate);
    };
  }, [fetchWorkStatus, fetchTasks]);

  // Initialize browser notifications
  useEffect(() => {
    const initBrowserNotifications = async () => {
      if (notificationManager.isSupported()) {
        const enabled = await notificationManager.requestPermission();
        setBrowserNotificationsEnabled(enabled);
        if (enabled) {
          console.log("Browser notifications enabled");
        } else {
          console.log("Browser notifications disabled or not supported");
        }
      }
    };

    initBrowserNotifications();
  }, []);

  // Update current time every second
  useEffect(() => {
    const interval = setInterval(() => setCurrentTime(new Date()), 1000);
    return () => clearInterval(interval);
  }, []);

  // Compute summary & notifications when tasks/time/dismissed change
  useEffect(() => {
    computeSummary();
    updateNotifications();
  }, [computeSummary, updateNotifications]);

  // Persist dismissed notifications
  useEffect(() => {
    localStorage.setItem(
      DISMISSED_NOTI_KEY,
      JSON.stringify(dismissedNotificationIds)
    );
  }, [dismissedNotificationIds]);

  // Handle wishes popup
  const handleCloseWishPopup = async () => {
    setShowWishPopup(false);
    try {
      const token = localStorage.getItem("token");
      await Promise.all(
        wishes.map((w) =>
          axios.patch(`${API_BASE}/api/wishes/${w._id}/read`, null, {
            headers: { Authorization: `Bearer ${token}` },
          })
        )
      );
      setWishes([]);
    } catch (err) {
      console.error(
        "Error marking wishes as read:",
        err.response?.data || err.message
      );
    }
  };

  // Dismiss a single notification
  const handleDismissNotification = (id) => {
    setDismissedNotificationIds((prev) => [...prev, id]);
  };

  // Clear all notifications
  const handleClearAllNotifications = () => {
    setDismissedNotificationIds((prev) => [
      ...prev,
      ...notifications.map((n) => n.id),
    ]);
  };

  // Toggle browser notifications
  const handleToggleBrowserNotifications = async () => {
    if (!browserNotificationsEnabled) {
      const enabled = await notificationManager.requestPermission();
      setBrowserNotificationsEnabled(enabled);
      if (enabled) {
        notificationManager.showGeneral("Notifications Enabled", "You will now receive browser notifications for new tasks!");
      }
    } else {
      setBrowserNotificationsEnabled(false);
      notificationManager.showGeneral("Notifications Disabled", "Browser notifications have been turned off");
    }
  };

  // Manual refresh all data
  const handleRefreshAll = async () => {
    await Promise.all([
      fetchTasks(),
      fetchWorkStatus()
    ]);
    setLastRefresh(new Date());
  };

  // Handle punch in action using new attendance system
  const handlePunchIn = async () => {
    const token = localStorage.getItem("token");
    if (!token) return;

    try {
      const response = await newAttendanceService.punchIn('Office');

      if (response.success) {
        // Refresh work status
        await fetchWorkStatus();

        // Emit event for other components to sync
        window.dispatchEvent(new CustomEvent('attendanceDataUpdated', {
          detail: { type: 'punch_in', userId: userInfo?._id }
        }));

        notificationManager.showGeneral("Punched In", response.message || "Successfully punched in for today!");
      }
    } catch (err) {
      console.error("Error punching in:", err);
      notificationManager.showGeneral("Error", err.message || "Failed to punch in. Please try again.");
    }
  };

  // Handle break action using new attendance system
  const handleTakeBreak = async () => {
    const token = localStorage.getItem("token");
    if (!token) return;

    try {
      const response = await newAttendanceService.startBreak('Break Room', 'Coffee break');

      if (response.success) {
        // Refresh work status
        await fetchWorkStatus();

        // Emit event for other components to sync
        window.dispatchEvent(new CustomEvent('attendanceDataUpdated', {
          detail: { type: 'break_start', userId: userInfo?._id }
        }));

        notificationManager.showGeneral("Break Started", response.message || "Enjoy your break!");
      }
    } catch (err) {
      console.error("Error starting break:", err);
      notificationManager.showGeneral("Error", err.message || "Failed to start break. Please try again.");
    }
  };


  // Handle resume work action using new attendance system
  const handleResumeWork = async () => {
    const token = localStorage.getItem("token");
    if (!token) return;

    try {
      const response = await newAttendanceService.endBreak('Office');

      if (response.success) {
        // Refresh work status
        await fetchWorkStatus();

        // Emit event for other components to sync
        window.dispatchEvent(new CustomEvent('attendanceDataUpdated', {
          detail: { type: 'work_resume', userId: userInfo?._id }
        }));

        notificationManager.showGeneral("Work Resumed", response.message || "Welcome back to work!");
      }
    } catch (err) {
      console.error("Error resuming work:", err);
      notificationManager.showGeneral("Error", err.message || "Failed to resume work. Please try again.");
    }
  };

  // Quick actions with proper handlers (no punch out)
  const quickActions = useMemo(() => {
    const actions = [];

    // Punch In/Break logic (no punch out)
    if (!workStatus?.currentlyWorking && !workStatus?.onBreak) {
      actions.push({
        label: "Punch In",
        icon: Play,
        action: handlePunchIn,
        color: "green",
        disabled: false
      });
    } else if (workStatus?.currentlyWorking && !workStatus?.onBreak) {
      actions.push({
        label: "Take Break",
        icon: Coffee,
        action: handleTakeBreak,
        color: "orange",
        disabled: false
      });
    } else if (workStatus?.onBreak) {
      actions.push({
        label: "Resume Work",
        icon: Play,
        action: handleResumeWork,
        color: "green",
        disabled: false
      });
    }

    // Always available actions
    actions.push(
      {
        label: "View Tasks",
        icon: CheckSquare,
        action: () => navigate("/tasks"),
        color: "blue",
        disabled: false
      },
      {
        label: "Attendance",
        icon: Calendar,
        action: () => navigate("/attendance"),
        color: "purple",
        disabled: false
      }
    );

    return actions;
  }, [workStatus, navigate, handlePunchIn, handleTakeBreak, handleResumeWork]);


  return (
    <div className="flex bg-gradient-to-br from-[#141a21] via-[#191f2b] to-[#101218] font-sans text-blue-100 min-h-screen">
      <Sidebar
        collapsed={collapsed}
        setCollapsed={setCollapsed}
        onLogout={onLogout}
        userRole="employee"
      />

      <main
        className={`flex-1 p-8 overflow-y-auto transition-all duration-300 ${
          collapsed ? "ml-20" : "ml-72"
        }`}
      >
        {/* Enhanced Header */}
        <div className="flex flex-col lg:flex-row lg:justify-between lg:items-start gap-6 mb-8">
          <div className="flex-1">
            <div className="flex items-center gap-4 mb-2">
              <h1 className="text-3xl font-bold text-white tracking-tight">
                Good{" "}
                {currentTime.getHours() < 12
                  ? "Morning"
                  : currentTime.getHours() < 18
                  ? "Afternoon"
                  : "Evening"}
                , {userName}
              </h1>
              {workStatus && (
                <div className={`flex items-center gap-2 px-3 py-1 rounded-full text-sm font-medium ${
                  workStatus.currentlyWorking
                    ? workStatus.onBreak
                      ? "bg-yellow-500/20 text-yellow-400"
                      : "bg-green-500/20 text-green-400"
                    : "bg-gray-500/20 text-gray-400"
                }`}>
                  <div className={`w-2 h-2 rounded-full animate-pulse ${
                    workStatus.currentlyWorking
                      ? workStatus.onBreak
                        ? "bg-yellow-400"
                        : "bg-green-400"
                      : "bg-gray-400"
                  }`}></div>
                  {workStatus.currentlyWorking
                    ? workStatus.onBreak
                      ? "On Break"
                      : "Working"
                    : "Offline"
                  }
                </div>
              )}
            </div>
            <p className="text-blue-300 mb-3">
              {currentTime.toLocaleDateString("en-US", {
                weekday: "long",
                year: "numeric",
                month: "long",
                day: "numeric",
              })}{" "}
              •{" "}
              {currentTime.toLocaleTimeString("en-US", {
                hour: "2-digit",
                minute: "2-digit",
                second: "2-digit",
              })}
            </p>

            {/* Work Status Summary */}
            {workStatus && (
              <div className="flex items-center gap-6 text-sm text-gray-300">
                <div className="flex items-center gap-2">
                  <Clock className="w-4 h-4 text-blue-400" />
                  <span>Today: {(() => {
                    const seconds = workStatus.workDurationSeconds || 0;
                    const hours = Math.floor(seconds / 3600);
                    const minutes = Math.floor((seconds % 3600) / 60);
                    return `${hours}h ${minutes}m`;
                  })()}</span>
                </div>
                {workStatus.arrivalTimeFormatted && (
                  <div className="flex items-center gap-2">
                    <Timer className="w-4 h-4 text-green-400" />
                    <span>Arrived: {workStatus.arrivalTimeFormatted}</span>
                  </div>
                )}
                <div className="text-xs text-gray-500">
                  Last updated: {lastRefresh.toLocaleTimeString()}
                </div>
              </div>
            )}
          </div>

          <div className="flex items-center gap-3">
            {/* Refresh Button */}
            <button
              onClick={handleRefreshAll}
              className="p-2 rounded-lg bg-blue-600/20 hover:bg-blue-600/40 text-blue-400 border border-blue-500/30 transition-colors"
              title="Refresh all data"
            >
              <RefreshCw className="w-4 h-4" />
            </button>

            {/* Browser Notification Toggle */}
            <button
              onClick={handleToggleBrowserNotifications}
              className={`p-2 rounded-lg border transition-colors ${
                browserNotificationsEnabled
                  ? "bg-green-600 border-green-500 text-white"
                  : "bg-gray-600 border-gray-500 text-gray-300 hover:bg-gray-500"
              }`}
              title={browserNotificationsEnabled ? "Browser notifications enabled" : "Enable browser notifications"}
            >
              🔔
            </button>

            <NotificationBell
              notifications={notifications}
              onDismiss={handleDismissNotification}
              onClearAll={handleClearAllNotifications}
            />
            <Link to="/profile">
              <img
                src="https://i.pravatar.cc/40?img=3"
                alt="Profile Avatar"
                className="w-9 h-9 rounded-full cursor-pointer border-2 border-orange-500 shadow-lg hover:border-orange-400 transition-colors"
              />
            </Link>
          </div>
        </div>

        {/* Enhanced Dashboard Grid */}
        <div className="space-y-6">
            {/* Enhanced Summary Cards */}
            <SummaryCards data={summaryData} />

            {/* Quick Actions Panel */}
            <div className="bg-[#191f2b]/70 rounded-xl shadow-xl border border-[#232945] p-6">
              <div className="flex items-center gap-2 mb-4">
                <Zap className="w-5 h-5 text-yellow-400" />
                <h3 className="text-lg font-semibold text-white">Quick Actions</h3>
                {dataLoading.status && (
                  <div className="w-4 h-4 border-2 border-yellow-500/20 border-t-yellow-500 rounded-full animate-spin"></div>
                )}
              </div>
              <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                {quickActions.map((action, idx) => {
                  const Icon = action.icon;
                  return (
                    <button
                      key={`${action.label}-${idx}`}
                      onClick={action.action}
                      disabled={action.disabled || dataLoading.status}
                      className={`flex flex-col items-center gap-2 p-4 rounded-lg border transition-all duration-200 hover:scale-105 ${
                        action.disabled || dataLoading.status
                          ? "bg-gray-700/50 border-gray-600 text-gray-500 cursor-not-allowed"
                          : action.color === "green"
                            ? "bg-green-600/20 border-green-500/50 text-green-400 hover:bg-green-600/30"
                            : action.color === "orange"
                            ? "bg-orange-600/20 border-orange-500/50 text-orange-400 hover:bg-orange-600/30"
                            : action.color === "red"
                            ? "bg-red-600/20 border-red-500/50 text-red-400 hover:bg-red-600/30"
                            : action.color === "blue"
                            ? "bg-blue-600/20 border-blue-500/50 text-blue-400 hover:bg-blue-600/30"
                            : "bg-purple-600/20 border-purple-500/50 text-purple-400 hover:bg-purple-600/30"
                      }`}
                    >
                      {dataLoading.status && (action.label.includes("Punch") || action.label.includes("Break") || action.label.includes("Resume")) ? (
                        <div className="w-5 h-5 border-2 border-gray-500/20 border-t-gray-500 rounded-full animate-spin"></div>
                      ) : (
                        <Icon className="w-5 h-5" />
                      )}
                      <span className="text-sm font-medium">{action.label}</span>
                    </button>
                  );
                })}
              </div>
            </div>

            {/* Tasks Section */}
            <div className="bg-[#191f2b]/70 rounded-xl shadow-xl border border-[#232945] p-6">
              <div className="flex items-center justify-between mb-4">
                <div className="flex items-center gap-2">
                  <CheckSquare className="w-5 h-5 text-blue-400" />
                  <h3 className="text-lg font-semibold text-white">Today's Tasks</h3>
                  {loading && (
                    <div className="w-4 h-4 border-2 border-blue-500/20 border-t-blue-500 rounded-full animate-spin"></div>
                  )}
                </div>
                <Link
                  to="/tasks"
                  className="text-sm text-blue-400 hover:text-blue-300 transition-colors"
                >
                  View All →
                </Link>
              </div>
              <TodayTasks data={tasks} loading={loading} />
            </div>
          </div>
      </main>

      {/* Error Messages */}
      {Object.entries(errors).map(([key, error]) =>
        error && (
          <div key={key} className="fixed top-4 right-4 z-50 bg-red-500/20 border border-red-500 rounded-lg p-3 text-red-400 text-sm max-w-sm">
            <div className="flex items-center gap-2">
              <AlertTriangle className="w-4 h-4" />
              <span>Failed to load {key}: {error}</span>
            </div>
          </div>
        )
      )}

      {/* Wishes Popup */}
      <WishPopup
        isOpen={showWishPopup}
        wishes={wishes}
        onClose={handleCloseWishPopup}
      />

      {/* Notice Overlay */}
      <NoticeOverlay />

      {/* Dynamic Notification Overlay */}
      <DynamicNotificationOverlay />

      {/* Global Celebration Popup */}
      <CelebrationPopup
        celebrations={celebrations}
        isOpen={showCelebrationPopup}
        onClose={closeCelebrationPopup}
      />
    </div>
  );
};

export default EmployeeDashboard;
