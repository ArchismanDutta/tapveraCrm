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
  Target,
  Calendar,
  CheckSquare,
  AlertTriangle,
  Coffee,
  Play,
} from "lucide-react";
import TodayTasks from "../components/dashboard/TodayTasks";
import Sidebar from "../components/dashboard/Sidebar";
import DashboardHeader from "../components/dashboard/DashboardHeader";
import WorkStatusCard from "../components/dashboard/WorkStatusCard";
import QuickActionsCard from "../components/dashboard/QuickActionsCard";
import TaskOverviewCard from "../components/dashboard/TaskOverviewCard";
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
      // scope=mine: personal dashboard shows only the user's own tasks (even for admins)
      const res = await axios.get(`${API_BASE}/api/tasks?scope=mine`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      // backend now returns { tasks, total, page, totalPages } — handle both shapes
      const rawList = Array.isArray(res.data) ? res.data : (res.data?.tasks || []);
      setTasks(rawList.map(formatTask));
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
          // Extract leave/WFH information
          leaveInfo: attendanceData.leaveInfo || null,
          isWFH: attendanceData.leaveInfo?.isWFH || attendanceData.isWFH || false,
          isOnLeave: attendanceData.leaveInfo?.isOnLeave || false,
          leaveType: attendanceData.leaveInfo?.leaveType || null,
          isHoliday: attendanceData.leaveInfo?.isHoliday || false,
          holidayName: attendanceData.leaveInfo?.holidayName || null,
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
      <div className="flex h-[100dvh] items-center justify-center bg-slate-50 dark:bg-[#0b0d12]">
        <div className="text-center">
          <div className="relative mx-auto">
            <div className="h-14 w-14 rounded-full border-2 border-blue-200 dark:border-blue-300/20"></div>
            <div className="absolute left-0 top-0 h-14 w-14 animate-spin rounded-full border-2 border-blue-600 border-t-transparent dark:border-blue-400 dark:border-t-transparent"></div>
          </div>
          <p className="mt-4 text-sm font-semibold text-slate-600 dark:text-slate-300">Preparing your workday...</p>
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
      <div className="relative flex h-[100dvh] overflow-hidden bg-slate-50 font-sans text-slate-900 dark:bg-[#0b0d12] dark:text-slate-100">
        <Sidebar
          collapsed={collapsed}
          setCollapsed={setCollapsed}
          onLogout={onLogout}
          userRole="employee"
        />

        <main
          className={`relative z-10 h-[100dvh] min-w-0 flex-1 overflow-y-auto overflow-x-hidden px-3 py-4 transition-all duration-300 [overscroll-behavior-y:auto] [scrollbar-gutter:stable] sm:px-5 lg:px-6 ${
            collapsed ? "ml-16" : "ml-16 sm:ml-56"
          }`}
          style={{ WebkitOverflowScrolling: "touch" }}
        >
          <div className="mx-auto max-w-[1500px] space-y-4 pb-8 sm:space-y-5">
          {/* Dashboard Header */}
          <DashboardHeader
            userName={userName}
            currentTime={currentTime}
            workStatus={workStatus}
            notifications={notifications}
            onRefresh={handleRefreshAll}
            onDismissNotification={handleDismissNotification}
            onClearAllNotifications={handleClearAllNotifications}
          />

          <div className="space-y-4 sm:space-y-5">
            <TaskOverviewCard summaryData={summaryData} />

            <div className="grid items-start gap-4 xl:grid-cols-[minmax(0,1.55fr)_minmax(320px,0.65fr)]">
              <section className="flex min-h-[480px] flex-col overflow-hidden rounded-2xl border border-slate-200 bg-white p-5 shadow-sm dark:border-white/10 dark:bg-[#10131c]">
                <div className="mb-4 flex items-center justify-between gap-3">
                  <div className="flex items-center gap-3">
                    <div>
                      <h2 className="text-base font-semibold text-slate-950 dark:text-white">Today’s tasks</h2>
                      <p className="mt-0.5 text-sm text-slate-500 dark:text-slate-400">Assigned work, newest first</p>
                    </div>
                    {loading && <div className="h-4 w-4 animate-spin rounded-full border-2 border-blue-200 border-t-blue-600 dark:border-white/10 dark:border-t-blue-400" />}
                  </div>
                  <Link to="/tasks" className="rounded-lg border border-slate-200 px-3 py-1.5 text-xs font-semibold text-slate-600 transition hover:bg-slate-50 dark:border-white/10 dark:text-slate-300 dark:hover:bg-white/[0.05]">
                    View all
                  </Link>
                </div>
                <div className="min-h-0 flex-1 overflow-auto pr-1">
                  <TodayTasks data={tasks} />
                </div>
              </section>

              <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-1">
                <WorkStatusCard workStatus={workStatus} isLoading={dataLoading.status} />
                <QuickActionsCard quickActions={quickActions} isLoading={dataLoading.status} />
              </div>
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
                className="fixed right-4 top-4 z-50 max-w-sm rounded-xl border border-rose-200 bg-white p-3 text-sm text-rose-700 shadow-lg dark:border-rose-400/20 dark:bg-[#10131c] dark:text-rose-200"
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
