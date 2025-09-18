import React, { useState, useEffect, useCallback, useRef } from "react";
import axios from "axios";
import { Link, useNavigate } from "react-router-dom";
import dayjs from "dayjs";

import SummaryCards from "../components/dashboard/SummaryCards";
import TodayTasks from "../components/dashboard/TodayTasks";
import Sidebar from "../components/dashboard/Sidebar";
import NotificationBell from "../components/dashboard/NotificationBell";
import WishPopup from "../components/dashboard/WishPopup";
import NoticeOverlay from "../components/dashboard/NoticeOverlay";
import notificationManager from "../utils/browserNotifications";

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
  const [summaryData, setSummaryData] = useState([]);
  const [notifications, setNotifications] = useState([]);
  const [dismissedNotificationIds, setDismissedNotificationIds] = useState(
    JSON.parse(localStorage.getItem(DISMISSED_NOTI_KEY)) || []
  );
  const [wishes, setWishes] = useState([]);
  const [showWishPopup, setShowWishPopup] = useState(false);

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

  // Compute summary cards
  const computeSummary = useCallback(() => {
    const today = dayjs(currentTime).startOf("day");
    setSummaryData([
      { label: "All Tasks", count: tasks.length },
      {
        label: "Tasks Due Today",
        count: tasks.filter(
          (t) => t.dueDate && dayjs(t.dueDate).isSame(today, "day")
        ).length,
      },
      {
        label: "Overdue Tasks",
        count: tasks.filter(
          (t) =>
            t.dueDate &&
            dayjs(t.dueDate).isBefore(dayjs(currentTime)) &&
            t.status?.toLowerCase() !== "completed"
        ).length,
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

  // Fetch user info & unread wishes
  const fetchUserAndWishes = useCallback(async () => {
    const token = localStorage.getItem("token");
    if (!token) return navigate("/login", { replace: true });
    try {
      const res = await axios.get(`${API_BASE}/api/users/me`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      setUserName(res.data?.name || "User");

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
    }
  }, [navigate]);

  // Auto-refresh tasks
  useEffect(() => {
    fetchTasks();
    const intervalId = setInterval(fetchTasks, TASK_POLL_INTERVAL_MS);
    return () => clearInterval(intervalId);
  }, [fetchTasks]);

  // Auto-refresh user/wishes
  useEffect(() => {
    fetchUserAndWishes();
    const intervalId = setInterval(fetchUserAndWishes, USER_POLL_INTERVAL_MS);
    return () => clearInterval(intervalId);
  }, [fetchUserAndWishes]);

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
        {/* Greeting */}
        <div className="flex justify-between items-center mb-8">
          <div>
            <h1 className="text-2xl font-bold text-white tracking-tight">
              Good{" "}
              {currentTime.getHours() < 12
                ? "Morning"
                : currentTime.getHours() < 18
                ? "Afternoon"
                : "Evening"}
              , {userName}
            </h1>
            <p className="text-sm text-blue-300">
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
          </div>
          <div className="flex items-center gap-4 relative">
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
                className="w-9 h-9 rounded-full cursor-pointer border-2 border-orange-500 shadow-lg"
              />
            </Link>
          </div>
        </div>

        {/* Summary Cards */}
        <SummaryCards data={summaryData} />

        {/* Main content */}
        <div className="mt-8">
          <TodayTasks
            data={tasks}
            loading={loading}
            className="bg-[#191f2b]/70 p-4 rounded-xl shadow-xl border border-[#232945]"
          />
        </div>
      </main>

      {/* Wishes Popup */}
      <WishPopup
        isOpen={showWishPopup}
        wishes={wishes}
        onClose={handleCloseWishPopup}
      />

      {/* Notice Overlay */}
      <NoticeOverlay />
    </div>
  );
};

export default EmployeeDashboard;
