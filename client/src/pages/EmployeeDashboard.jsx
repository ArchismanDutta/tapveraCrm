import React, {
  useState,
  useEffect,
  useCallback,
  useRef,
  useMemo,
} from "react";
import axios from "axios";
import { Link, useNavigate } from "react-router-dom";
import dayjs from "dayjs";
import {
  Clock,
  Target,
  Calendar,
  CheckSquare,
  AlertTriangle,
  Coffee,
  Play,
  RefreshCw,
  BarChart3,
  Zap,
} from "lucide-react";
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
import PaymentBlockOverlay from "../components/payment/PaymentBlockOverlay";

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
    activity: false,
  });
  const [errors, setErrors] = useState({});
  const [lastRefresh, setLastRefresh] = useState(new Date());

  // Payment blocking state
  const [activePayment, setActivePayment] = useState(null);
  const [checkingPayment, setCheckingPayment] = useState(true);

  // Celebration notifications
  const {
    celebrations,
    showPopup: showCelebrationPopup,
    closePopup: closeCelebrationPopup,
  } = useCelebrationNotifications();

  const prevTaskIdsRef = useRef(new Set());
  const [browserNotificationsEnabled, setBrowserNotificationsEnabled] =
    useState(false);
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
    const completedTasks = tasks.filter(
      (t) => t.status?.toLowerCase() === "completed"
    );
    const rejectedTasks = tasks.filter(
      (t) => t.status?.toLowerCase() === "rejected"
    );
    const pendingTasks = tasks.filter(
      (t) =>
        t.status?.toLowerCase() !== "completed" &&
        t.status?.toLowerCase() !== "rejected"
    );
    const highPriorityTasks = tasks.filter(
      (t) =>
        t.level === "High" &&
        t.status?.toLowerCase() !== "completed" &&
        t.status?.toLowerCase() !== "rejected"
    );
    
    const dueTodayTasks = tasks.filter(
      (t) =>
        t.dueDate &&
        dayjs(t.dueDate).isSame(today, "day") &&
        t.status?.toLowerCase() !== "completed" &&
        t.status?.toLowerCase() !== "rejected"
    );

    setSummaryData([
      {
        label: "All Tasks",
        count: tasks.length,
        icon: CheckSquare,
        color: "blue",
        trend:
          tasks.length > 0
            ? Math.floor((completedTasks.length / tasks.length) * 100) + "%"
            : "0%",
      },
      {
        label: "Due Today",
        count: dueTodayTasks.length,
        icon: Calendar,
        color: "orange",
        urgent: dueTodayTasks.length > 0,
      },
      {
        label: "High Priority",
        count: highPriorityTasks.length,
        icon: AlertTriangle,
        color: "red",
        urgent: highPriorityTasks.length > 0,
      },
      {
        label: "Completed",
        count: completedTasks.length,
        icon: Target,
        color: "green",
        trend:
          tasks.length > 0
            ? Math.floor((completedTasks.length / tasks.length) * 100) + "%"
            : "0%",
      },
      {
        label: "Rejected",
        count: rejectedTasks.length,
        icon: AlertTriangle,
        color: "rose",
      },
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
        task: t,
      }))
      .filter((n) => !dismissedNotificationIds.includes(n.id));

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
      setErrors((prev) => ({ ...prev, user: err.message }));
    }
  }, [navigate]);

  // Fetch work status using new attendance system
  const fetchWorkStatus = useCallback(async () => {
    const token = localStorage.getItem("token");
    if (!token) return;

    setDataLoading((prev) => ({ ...prev, status: true }));
    try {
      const response = await newAttendanceService.getTodayStatus();

      if (response.success && response.data) {
        const attendanceData = response.data.attendance || {};

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
          timeline: attendanceData.events
            ? attendanceData.events.map((e) => ({
                type: e.type,
                time: e.timestamp,
              }))
            : [],
        };

        setWorkStatus(mappedStatus);
        setErrors((prev) => ({ ...prev, status: null }));
      }
    } catch (err) {
      console.error("Error fetching work status:", err);
      setErrors((prev) => ({ ...prev, status: err.message }));
    } finally {
      setDataLoading((prev) => ({ ...prev, status: false }));
    }
  }, []);

  // Check for active payment (blocks all activity)
  const checkActivePayment = useCallback(async () => {
    try {
      const token = localStorage.getItem("token");
      if (!token) return;

      const response = await axios.get(`${API_BASE}/api/payments/my-active`, {
        headers: { Authorization: `Bearer ${token}` },
      });

      if (response.data.success) {
        setActivePayment(response.data.data);
      } else {
        setActivePayment(null);
      }
    } catch (error) {
      console.error("Error checking active payment:", error);
      setActivePayment(null);
    } finally {
      setCheckingPayment(false);
    }
  }, []);

  const handlePaymentCleared = useCallback(() => {
    setActivePayment(null);
    // Refresh all data after payment is cleared
    fetchTasks();
    fetchUserAndWishes();
    fetchWorkStatus();
  }, [fetchTasks, fetchUserAndWishes, fetchWorkStatus]);

  // Enhanced data fetching on mount
  useEffect(() => {
    const initializeDashboard = async () => {
      // Check payment first
      await checkActivePayment();

      // Only load dashboard data if no active payment
      await Promise.all([
        fetchTasks(),
        fetchUserAndWishes(),
        fetchWorkStatus(),
      ]);
      setLastRefresh(new Date());
    };

    initializeDashboard();
  }, [fetchTasks, fetchUserAndWishes, fetchWorkStatus, checkActivePayment]);

  // Auto-refresh with smart intervals
  useEffect(() => {
    const taskInterval = setInterval(fetchTasks, TASK_POLL_INTERVAL_MS);
    const userInterval = setInterval(fetchUserAndWishes, USER_POLL_INTERVAL_MS);
    const statusInterval = setInterval(fetchWorkStatus, 30000);

    return () => {
      clearInterval(taskInterval);
      clearInterval(userInterval);
      clearInterval(statusInterval);
    };
  }, [fetchTasks, fetchUserAndWishes, fetchWorkStatus]);

  // Listen for attendance data updates
  useEffect(() => {
    const handleAttendanceUpdate = async () => {
      console.log(
        "🔄 EmployeeDashboard: Received attendanceDataUpdated event, refreshing work status..."
      );

      await Promise.all([fetchWorkStatus(), fetchTasks()]);

      setLastRefresh(new Date());
    };

    window.addEventListener("attendanceDataUpdated", handleAttendanceUpdate);

    return () => {
      window.removeEventListener(
        "attendanceDataUpdated",
        handleAttendanceUpdate
      );
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
        notificationManager.showGeneral(
          "Notifications Enabled",
          "You will now receive browser notifications for new tasks!"
        );
      }
    } else {
      setBrowserNotificationsEnabled(false);
      notificationManager.showGeneral(
        "Notifications Disabled",
        "Browser notifications have been turned off"
      );
    }
  };

  // Manual refresh all data
  const handleRefreshAll = async () => {
    await Promise.all([fetchTasks(), fetchWorkStatus()]);
    setLastRefresh(new Date());
  };

  // Handle punch in action
  const handlePunchIn = async () => {
    const token = localStorage.getItem("token");
    if (!token) return;

    try {
      const response = await newAttendanceService.punchIn("Office");

      if (response.success) {
        await fetchWorkStatus();

        window.dispatchEvent(
          new CustomEvent("attendanceDataUpdated", {
            detail: { type: "punch_in", userId: userInfo?._id },
          })
        );

        notificationManager.showGeneral(
          "Punched In",
          response.message || "Successfully punched in for today!"
        );
      }
    } catch (err) {
      console.error("Error punching in:", err);
      notificationManager.showGeneral(
        "Error",
        err.message || "Failed to punch in. Please try again."
      );
    }
  };

  // Handle break action
  const handleTakeBreak = async () => {
    const token = localStorage.getItem("token");
    if (!token) return;

    try {
      const response = await newAttendanceService.startBreak(
        "Break Room",
        "Coffee break"
      );

      if (response.success) {
        await fetchWorkStatus();

        window.dispatchEvent(
          new CustomEvent("attendanceDataUpdated", {
            detail: { type: "break_start", userId: userInfo?._id },
          })
        );

        notificationManager.showGeneral(
          "Break Started",
          response.message || "Enjoy your break!"
        );
      }
    } catch (err) {
      console.error("Error starting break:", err);
      notificationManager.showGeneral(
        "Error",
        err.message || "Failed to start break. Please try again."
      );
    }
  };

  // Handle resume work action
  const handleResumeWork = async () => {
    const token = localStorage.getItem("token");
    if (!token) return;

    try {
      const response = await newAttendanceService.endBreak("Office");

      if (response.success) {
        await fetchWorkStatus();

        window.dispatchEvent(
          new CustomEvent("attendanceDataUpdated", {
            detail: { type: "work_resume", userId: userInfo?._id },
          })
        );

        notificationManager.showGeneral(
          "Work Resumed",
          response.message || "Welcome back to work!"
        );
      }
    } catch (err) {
      console.error("Error resuming work:", err);
      notificationManager.showGeneral(
        "Error",
        err.message || "Failed to resume work. Please try again."
      );
    }
  };

  // Quick actions with proper handlers
  const quickActions = useMemo(() => {
    const actions = [];

    if (!workStatus?.currentlyWorking && !workStatus?.onBreak) {
      actions.push({
        label: "Punch In",
        icon: Play,
        action: handlePunchIn,
        color: "green",
        disabled: false,
      });
    } else if (workStatus?.currentlyWorking && !workStatus?.onBreak) {
      actions.push({
        label: "Take Break",
        icon: Coffee,
        action: handleTakeBreak,
        color: "orange",
        disabled: false,
      });
    } else if (workStatus?.onBreak) {
      actions.push({
        label: "Resume Work",
        icon: Play,
        action: handleResumeWork,
        color: "green",
        disabled: false,
      });
    }

    actions.push(
      {
        label: "View Tasks",
        icon: CheckSquare,
        action: () => navigate("/tasks"),
        color: "blue",
        disabled: false,
      },
      {
        label: "Attendance",
        icon: Calendar,
        action: () => navigate("/attendance"),
        color: "purple",
        disabled: false,
      }
    );

    return actions;
  }, [workStatus, navigate, handlePunchIn, handleTakeBreak, handleResumeWork]);

  if (checkingPayment) {
    return (
      <div className="flex items-center justify-center min-h-screen bg-[#0f1419]">
        <div className="text-center">
          <div className="relative">
            <div className="w-16 h-16 border-4 border-cyan-300/40 rounded-full"></div>
            <div className="absolute top-0 left-0 w-16 h-16 border-4 border-cyan-600 border-t-transparent rounded-full animate-spin"></div>
          </div>
          <p className="mt-4 text-gray-300">Loading...</p>
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
    <>
      <div className="flex min-h-screen bg-[#0f1419] font-sans text-gray-100">
        <Sidebar
          collapsed={collapsed}
          setCollapsed={setCollapsed}
          onLogout={onLogout}
          userRole="employee"
        />

        <main
          className={`flex-1 p-2 transition-all duration-300 h-screen overflow-hidden flex flex-col ${
            collapsed ? "ml-20" : "ml-72"
          }`}
        >
          {/* Compact Header */}
          <div className="flex justify-between items-center mb-2 gap-2 flex-wrap">
            <div className="flex items-center gap-3 flex-wrap">
              <h1 className="text-lg font-bold text-gray-100">
                Dashboard
                {userName && <span className="text-cyan-400"> - {userName}</span>}
              </h1>

              {/* Inline Status Badge */}
              <div className="flex items-center gap-2 bg-[#161c2c] rounded px-2 py-1 border border-[#232945]">
                <div className={`w-1.5 h-1.5 rounded-full ${
                  workStatus?.currentlyWorking
                    ? workStatus?.onBreak ? "bg-yellow-400 animate-pulse" : "bg-green-400 animate-pulse"
                    : "bg-gray-500"
                }`}></div>
                <span className="text-xs">
                  {workStatus?.currentlyWorking
                    ? workStatus?.onBreak ? "On Break" : "Working"
                    : "Offline"}
                </span>
                {workStatus?.arrivalTimeFormatted && (
                  <span className="text-xs text-gray-400">• {workStatus.arrivalTimeFormatted}</span>
                )}
                {workStatus && (
                  <span className="text-xs text-green-400">
                    {(() => {
                      const s = workStatus.workDurationSeconds || 0;
                      return `${Math.floor(s / 3600)}h ${String(Math.floor((s % 3600) / 60)).padStart(2, "0")}m`;
                    })()}
                  </span>
                )}
              </div>

              {/* Date/time pill */}
              <span className="hidden sm:block text-xs text-gray-400">
                {currentTime.toLocaleDateString("en-US", { weekday: "short", month: "short", day: "numeric" })}
                {" · "}
                {currentTime.toLocaleTimeString("en-US", { hour: "2-digit", minute: "2-digit", second: "2-digit" })}
              </span>
            </div>

            {/* Right Side Actions */}
            <div className="flex items-center gap-2">
              <button
                onClick={handleRefreshAll}
                className="p-1.5 rounded bg-blue-600/20 hover:bg-blue-600/40 text-blue-400 border border-blue-500/30 transition-colors"
                title="Refresh all data"
              >
                <RefreshCw className="w-3.5 h-3.5" />
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
                  className="w-8 h-8 rounded-full cursor-pointer border-2 border-orange-500 hover:border-orange-400 transition-colors"
                />
              </Link>
            </div>
          </div>

          {/* Main scrollable content */}
          <div className="flex-1 flex flex-col gap-2 overflow-auto">

            {/* Top Row: Work Status + Quick Actions */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-2">

              {/* Work Status Card */}
              <div className="bg-[#161c2c] rounded-lg border border-[#232945] p-3 relative">
                {dataLoading.status && (
                  <div className="absolute inset-0 bg-black/40 z-10 flex items-center justify-center rounded-lg">
                    <div className="flex items-center gap-1.5 bg-[#161c2c] px-2 py-1 rounded border border-[#232945]">
                      <div className="w-3 h-3 border-2 border-cyan-500/20 border-t-cyan-500 rounded-full animate-spin"></div>
                      <span className="text-xs text-gray-200">Updating...</span>
                    </div>
                  </div>
                )}
                <div className="flex items-center gap-2 mb-3">
                  <Clock className="w-4 h-4 text-cyan-400" />
                  <h3 className="text-sm font-semibold text-white">Work Status</h3>
                </div>
                <div className="grid grid-cols-3 gap-2">
                  <div className="bg-[#0f1419] rounded p-2 border border-[#232945]">
                    <div className="text-xs text-gray-400 mb-1">Work Time</div>
                    <div className="text-sm font-bold text-green-400">
                      {workStatus
                        ? (() => {
                            const s = workStatus.workDurationSeconds || 0;
                            return `${Math.floor(s / 3600)}h ${String(Math.floor((s % 3600) / 60)).padStart(2, "0")}m`;
                          })()
                        : "--"}
                    </div>
                  </div>
                  <div className="bg-[#0f1419] rounded p-2 border border-[#232945]">
                    <div className="text-xs text-gray-400 mb-1">Break</div>
                    <div className="text-sm font-bold text-orange-400">
                      {workStatus
                        ? (() => {
                            const s = workStatus.breakDurationSeconds || 0;
                            return `${Math.floor(s / 3600)}h ${String(Math.floor((s % 3600) / 60)).padStart(2, "0")}m`;
                          })()
                        : "--"}
                    </div>
                  </div>
                  <div className="bg-[#0f1419] rounded p-2 border border-[#232945]">
                    <div className="text-xs text-gray-400 mb-1">Arrived</div>
                    <div className="text-sm font-bold text-blue-400">
                      {workStatus?.arrivalTimeFormatted || "--"}
                    </div>
                  </div>
                </div>
                {workStatus?.isLate && (
                  <div className="mt-2 flex items-center gap-1 text-xs text-red-400">
                    <AlertTriangle className="w-3 h-3" />
                    <span>Late arrival</span>
                  </div>
                )}
              </div>

              {/* Quick Actions */}
              <div className="bg-[#161c2c] rounded-lg border border-[#232945] p-3">
                <div className="flex items-center gap-2 mb-3">
                  <Zap className="w-4 h-4 text-yellow-400" />
                  <h3 className="text-sm font-semibold text-white">Quick Actions</h3>
                  {dataLoading.status && (
                    <div className="w-3 h-3 border-2 border-yellow-500/20 border-t-yellow-500 rounded-full animate-spin ml-auto"></div>
                  )}
                </div>
                <div className="grid grid-cols-3 gap-2">
                  {quickActions.map((action, idx) => {
                    const Icon = action.icon;
                    return (
                      <button
                        key={`${action.label}-${idx}`}
                        onClick={action.action}
                        disabled={action.disabled || dataLoading.status}
                        className={`flex flex-col items-center gap-1.5 p-2.5 rounded border transition-all duration-200 hover:scale-105 ${
                          action.disabled || dataLoading.status
                            ? "bg-gray-700/50 border-gray-600 text-gray-500 cursor-not-allowed"
                            : action.color === "green"
                            ? "bg-green-600/20 border-green-500/50 text-green-400 hover:bg-green-600/30"
                            : action.color === "orange"
                            ? "bg-orange-600/20 border-orange-500/50 text-orange-400 hover:bg-orange-600/30"
                            : action.color === "blue"
                            ? "bg-blue-600/20 border-blue-500/50 text-blue-400 hover:bg-blue-600/30"
                            : "bg-purple-600/20 border-purple-500/50 text-purple-400 hover:bg-purple-600/30"
                        }`}
                      >
                        {dataLoading.status &&
                        (action.label.includes("Punch") ||
                          action.label.includes("Break") ||
                          action.label.includes("Resume")) ? (
                          <div className="w-4 h-4 border-2 border-gray-500/20 border-t-gray-500 rounded-full animate-spin"></div>
                        ) : (
                          <Icon className="w-4 h-4" />
                        )}
                        <span className="text-xs font-medium leading-tight text-center">
                          {action.label}
                        </span>
                      </button>
                    );
                  })}
                </div>
              </div>
            </div>

            {/* Task Overview — compact stat grid */}
            <div className="bg-[#161c2c] rounded-lg border border-[#232945] p-3">
              <div className="flex items-center justify-between mb-3">
                <div className="flex items-center gap-2">
                  <BarChart3 className="w-4 h-4 text-blue-400" />
                  <h3 className="text-sm font-semibold text-white">Task Overview</h3>
                </div>
                <Link
                  to="/tasks"
                  className="text-xs text-blue-400 hover:text-blue-300 transition-colors"
                >
                  View All →
                </Link>
              </div>
              <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-2">
                {summaryData.map((item, idx) => {
                  const Icon = item.icon;
                  return (
                    <div
                      key={idx}
                      className={`bg-[#0f1419] rounded p-2.5 border ${
                        item.urgent ? "border-red-500/40" : "border-[#232945]"
                      } relative overflow-hidden`}
                    >
                      {item.urgent && (
                        <div className="absolute top-1 right-1 w-1.5 h-1.5 bg-red-500 rounded-full animate-pulse"></div>
                      )}
                      <div className="flex items-center gap-1.5 mb-1.5">
                        {Icon && (
                          <Icon
                            className={`w-3.5 h-3.5 ${
                              item.color === "red"
                                ? "text-red-400"
                                : item.color === "orange"
                                ? "text-orange-400"
                                : item.color === "green"
                                ? "text-green-400"
                                : item.color === "rose"
                                ? "text-rose-400"
                                : "text-blue-400"
                            }`}
                          />
                        )}
                        <span className="text-xs text-gray-400 truncate">{item.label}</span>
                      </div>
                      <div
                        className={`text-2xl font-bold ${
                          item.urgent ? "text-red-400" : "text-white"
                        }`}
                      >
                        {item.count}
                      </div>
                      {item.trend && (
                        <div className="text-xs text-gray-500 mt-0.5">{item.trend}</div>
                      )}
                    </div>
                  );
                })}
              </div>
            </div>

            {/* Today's Tasks */}
            <div className="bg-[#161c2c] rounded-lg border border-[#232945] p-3 flex-1 min-h-0 flex flex-col">
              <div className="flex items-center justify-between mb-3">
                <div className="flex items-center gap-2">
                  <CheckSquare className="w-4 h-4 text-blue-400" />
                  <h3 className="text-sm font-semibold text-white">Today's Tasks</h3>
                  {loading && (
                    <div className="w-3 h-3 border-2 border-blue-500/20 border-t-blue-500 rounded-full animate-spin"></div>
                  )}
                </div>
                <Link
                  to="/tasks"
                  className="text-xs text-blue-400 hover:text-blue-300 transition-colors"
                >
                  View All →
                </Link>
              </div>
              <div className="overflow-auto flex-1">
                <TodayTasks data={tasks} loading={loading} />
              </div>
            </div>

          </div>
        </main>

        {/* Error toasts */}
        {Object.entries(errors).map(
          ([key, error]) =>
            error && (
              <div
                key={key}
                className="fixed top-4 right-4 z-50 bg-red-500/20 border border-red-500 rounded-lg p-3 text-red-400 text-sm max-w-sm"
              >
                <div className="flex items-center gap-2">
                  <AlertTriangle className="w-4 h-4" />
                  <span>Failed to load {key}: {error}</span>
                </div>
              </div>
            )
        )}

        <WishPopup isOpen={showWishPopup} wishes={wishes} onClose={handleCloseWishPopup} />
        <NoticeOverlay />
        <DynamicNotificationOverlay />
        <CelebrationPopup
          celebrations={celebrations}
          isOpen={showCelebrationPopup}
          onClose={closeCelebrationPopup}
        />
      </div>
    </>
  );
};

export default EmployeeDashboard;