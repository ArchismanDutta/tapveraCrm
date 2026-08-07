import React, { useState, useEffect, useRef } from "react";
import {
  Bell,
  CheckCircle,
  Trash2,
  Search,
  Filter,
  X,
  TrendingUp,
  BarChart3,
  ChevronDown,
  RefreshCw,
  Loader2,
  AlertCircle,
} from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import Sidebar from "../components/dashboard/Sidebar";
import NotificationItem from "../components/notifications/NotificationItem";
import DesktopNotificationsSetting from "../components/notifications/DesktopNotificationsSetting";
import { toast } from "react-toastify";

const API_BASE = import.meta.env.VITE_API_BASE || "http://localhost:5000";
const MotionDiv = motion.div;

// Keyboard shortcuts
const SHORTCUTS = {
  MARK_READ: "r",
  DELETE: "d",
  SELECT_ALL: "ctrl+a",
  REFRESH: "ctrl+r",
};

// Animation variants
const containerVariants = {
  hidden: { opacity: 0 },
  visible: {
    opacity: 1,
    transition: {
      staggerChildren: 0.05,
      delayChildren: 0.1,
    },
  },
};

const itemVariants = {
  hidden: { opacity: 0, y: 20 },
  visible: {
    opacity: 1,
    y: 0,
    transition: {
      type: "spring",
      stiffness: 300,
      damping: 24,
    },
  },
  exit: {
    opacity: 0,
    x: -100,
    transition: { duration: 0.2 },
  },
};

const slideInVariants = {
  hidden: { opacity: 0, height: 0, marginBottom: 0 },
  visible: {
    opacity: 1,
    height: "auto",
    marginBottom: 16,
    transition: {
      height: { type: "spring", stiffness: 300, damping: 30 },
      opacity: { duration: 0.2 },
    },
  },
  exit: {
    opacity: 0,
    height: 0,
    marginBottom: 0,
    transition: {
      height: { duration: 0.2 },
      opacity: { duration: 0.15 },
    },
  },
};

const statsCardVariants = {
  hidden: { scale: 0.8, opacity: 0 },
  visible: {
    scale: 1,
    opacity: 1,
    transition: {
      type: "spring",
      stiffness: 260,
      damping: 20,
    },
  },
};

const pulseVariants = {
  initial: { scale: 1 },
  animate: {
    scale: [1, 1.1, 1],
    transition: {
      duration: 2,
      repeat: Infinity,
      repeatType: "loop",
    },
  },
};

const NotificationCenterPage = ({ onLogout }) => {
  const [collapsed, setCollapsed] = useState(false);
  const [userRole, setUserRole] = useState(null);
  const [notifications, setNotifications] = useState([]);
  const [loading, setLoading] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [filterType, setFilterType] = useState("all");
  const [filterPriority, setFilterPriority] = useState("all");
  const [filterRead, setFilterRead] = useState("all");
  const [searchQuery, setSearchQuery] = useState("");
  const [debouncedSearch, setDebouncedSearch] = useState("");
  const [page, setPage] = useState(1);
  const [hasMore, setHasMore] = useState(true);
  const [unreadCount, setUnreadCount] = useState(0);
  const [showFilters, setShowFilters] = useState(false);
  const [showStats, setShowStats] = useState(false);
  const [stats, setStats] = useState(null);
  const [loadError, setLoadError] = useState("");

  // Bulk selection
  const [bulkMode, setBulkMode] = useState(false);
  const [selectedIds, setSelectedIds] = useState(new Set());

  // Infinite scroll
  const scrollContainerRef = useRef(null);
  const observerTarget = useRef(null);

  // Real-time updates
  const [lastFetchTime, setLastFetchTime] = useState(new Date());

  useEffect(() => {
    const role = localStorage.getItem("role");
    setUserRole(role);
  }, []);

  useEffect(() => {
    const timer = window.setTimeout(() => setDebouncedSearch(searchQuery.trim()), 300);
    return () => window.clearTimeout(timer);
  }, [searchQuery]);

  useEffect(() => {
    // Reset and fetch when filters change
    setNotifications([]);
    setPage(1);
    setHasMore(true);
    fetchNotifications(1, true);
    fetchStats();
  }, [filterType, filterPriority, filterRead, debouncedSearch]);

  // Real-time WebSocket listener
  useEffect(() => {
    const handleWsNotification = (e) => {
      const data = e.detail;
      if (data && data.type === "notification") {
        // Auto-refresh to get new notification
        setPage(1);
        setNotifications([]);
        fetchNotifications(1, true);
        fetchStats();
        toast.info("New notification received!");
      }
    };

    window.addEventListener("ws-notification", handleWsNotification);
    return () => window.removeEventListener("ws-notification", handleWsNotification);
  }, []);

  // Listen for notification read events from other components
  useEffect(() => {
    const handleNotificationRead = () => {
      fetchNotifications(1, true);
      fetchStats();
    };

    window.addEventListener("notification-read", handleNotificationRead);
    return () => window.removeEventListener("notification-read", handleNotificationRead);
  }, []);

  // Keyboard shortcuts
  useEffect(() => {
    const handleKeyDown = (e) => {
      // Check if user is typing in input
      if (e.target.tagName === "INPUT" || e.target.tagName === "TEXTAREA") return;

      if (e.key === SHORTCUTS.MARK_READ && selectedIds.size > 0) {
        e.preventDefault();
        handleBulkMarkAsRead();
      } else if (e.key === SHORTCUTS.DELETE && selectedIds.size > 0) {
        e.preventDefault();
        handleBulkDelete();
      } else if (e.ctrlKey && e.key === "a") {
        e.preventDefault();
        handleSelectAll();
      } else if (e.ctrlKey && e.key === "r") {
        e.preventDefault();
        handleRefresh();
      }
    };

    document.addEventListener("keydown", handleKeyDown);
    return () => document.removeEventListener("keydown", handleKeyDown);
  }, [selectedIds, notifications]);

  // Infinite scroll observer
  useEffect(() => {
    const observer = new IntersectionObserver(
      (entries) => {
        if (entries[0].isIntersecting && hasMore && !loading && !loadingMore) {
          loadMoreNotifications();
        }
      },
      { threshold: 0.1 }
    );

    const target = observerTarget.current;
    if (target) {
      observer.observe(target);
    }

    return () => {
      if (target) {
        observer.unobserve(target);
      }
    };
  }, [hasMore, loading, loadingMore, page]);

  const fetchNotifications = async (pageNum = 1, reset = false) => {
    try {
      if (reset) {
        setLoading(true);
        setLoadError("");
      } else {
        setLoadingMore(true);
      }

      const token = localStorage.getItem("token");

      const params = new URLSearchParams({
        page: pageNum.toString(),
        limit: "20",
      });

      if (filterType !== "all") params.append("type", filterType);
      if (filterPriority !== "all") params.append("priority", filterPriority);
      if (filterRead === "unread") params.append("unreadOnly", "true");
      if (debouncedSearch) params.append("search", debouncedSearch);

      const response = await fetch(`${API_BASE}/api/notifications?${params}`, {
        headers: {
          Authorization: `Bearer ${token}`,
        },
      });

      if (!response.ok) throw new Error("Failed to fetch notifications");

      const data = await response.json();
      const newNotifications = data.notifications || [];

      if (reset) {
        setNotifications(newNotifications);
      } else {
        setNotifications((prev) => [...prev, ...newNotifications]);
      }

      setUnreadCount(data.unreadCount || 0);
      setHasMore(newNotifications.length === 20);
      setLastFetchTime(new Date());
    } catch (error) {
      console.error("Error fetching notifications:", error);
      setLoadError("We could not load your notifications. Check your connection and try again.");
      toast.error("Failed to load notifications");
    } finally {
      setLoading(false);
      setLoadingMore(false);
    }
  };

  const fetchStats = async () => {
    try {
      const token = localStorage.getItem("token");
      const response = await fetch(`${API_BASE}/api/notifications/stats`, {
        headers: {
          Authorization: `Bearer ${token}`,
        },
      });

      if (response.ok) {
        const data = await response.json();
        setStats(data.data);
      }
    } catch (error) {
      console.error("Error fetching stats:", error);
    }
  };

  const loadMoreNotifications = () => {
    const nextPage = page + 1;
    setPage(nextPage);
    fetchNotifications(nextPage, false);
  };

  const handleRefresh = () => {
    setPage(1);
    setNotifications([]);
    setHasMore(true);
    fetchNotifications(1, true);
    fetchStats();
    toast.success("Refreshed!");
  };

  const handleMarkAsRead = async (notificationId) => {
    try {
      const token = localStorage.getItem("token");

      const response = await fetch(`${API_BASE}/api/notifications/${notificationId}/read`, {
        method: "PUT",
        headers: {
          Authorization: `Bearer ${token}`,
        },
      });

      if (!response.ok) throw new Error("Failed to mark as read");

      // Update UI with animation
      setNotifications((prev) =>
        prev.map((n) =>
          n._id === notificationId ? { ...n, read: true, readAt: new Date() } : n
        )
      );
      setUnreadCount((prev) => Math.max(0, prev - 1));

      // Dispatch event for other components
      window.dispatchEvent(new CustomEvent("notification-read", { detail: { notificationId } }));
    } catch (error) {
      console.error("Error marking notification as read:", error);
      toast.error("Failed to mark as read");
    }
  };

  const handleMarkAllAsRead = async () => {
    try {
      const token = localStorage.getItem("token");

      const response = await fetch(`${API_BASE}/api/notifications/mark-all-read`, {
        method: "PUT",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ type: filterType !== "all" ? filterType : null }),
      });

      if (!response.ok) throw new Error("Failed to mark all as read");

      const result = await response.json();
      toast.success(result.message || "All notifications marked as read");

      // Refresh notifications
      handleRefresh();
    } catch (error) {
      console.error("Error marking all as read:", error);
      toast.error("Failed to mark all as read");
    }
  };

  const handleDelete = async (notificationId) => {
    try {
      const token = localStorage.getItem("token");

      const response = await fetch(`${API_BASE}/api/notifications/${notificationId}`, {
        method: "DELETE",
        headers: {
          Authorization: `Bearer ${token}`,
        },
      });

      if (!response.ok) throw new Error("Failed to delete notification");

      // Animate out and remove
      setNotifications((prev) => prev.filter((n) => n._id !== notificationId));
      toast.success("Notification deleted");
    } catch (error) {
      console.error("Error deleting notification:", error);
      toast.error("Failed to delete notification");
    }
  };

  const handleDeleteAllRead = async () => {
    if (!window.confirm("Delete all read notifications? This cannot be undone.")) return;

    try {
      const token = localStorage.getItem("token");

      const response = await fetch(`${API_BASE}/api/notifications/delete-all-read`, {
        method: "DELETE",
        headers: {
          Authorization: `Bearer ${token}`,
        },
      });

      if (!response.ok) throw new Error("Failed to delete read notifications");

      const result = await response.json();
      toast.success(result.message || "Read notifications deleted");

      // Refresh notifications
      handleRefresh();
    } catch (error) {
      console.error("Error deleting read notifications:", error);
      toast.error("Failed to delete notifications");
    }
  };

  // Bulk actions
  const handleSelectAll = () => {
    if (selectedIds.size === filteredNotifications.length) {
      setSelectedIds(new Set());
    } else {
      setSelectedIds(new Set(filteredNotifications.map((n) => n._id)));
    }
  };

  const handleToggleSelect = (id) => {
    const newSet = new Set(selectedIds);
    if (newSet.has(id)) {
      newSet.delete(id);
    } else {
      newSet.add(id);
    }
    setSelectedIds(newSet);
  };

  const handleBulkMarkAsRead = async () => {
    try {
      const token = localStorage.getItem("token");
      const promises = Array.from(selectedIds).map((id) =>
        fetch(`${API_BASE}/api/notifications/${id}/read`, {
          method: "PUT",
          headers: { Authorization: `Bearer ${token}` },
        })
      );

      await Promise.all(promises);

      toast.success(`${selectedIds.size} notifications marked as read`);
      setSelectedIds(new Set());
      handleRefresh();
    } catch (error) {
      console.error("Error marking notifications as read:", error);
      toast.error("Failed to mark notifications as read");
    }
  };

  const handleBulkDelete = async () => {
    if (!window.confirm(`Delete ${selectedIds.size} notifications? This cannot be undone.`))
      return;

    try {
      const token = localStorage.getItem("token");
      const promises = Array.from(selectedIds).map((id) =>
        fetch(`${API_BASE}/api/notifications/${id}`, {
          method: "DELETE",
          headers: { Authorization: `Bearer ${token}` },
        })
      );

      await Promise.all(promises);

      toast.success(`${selectedIds.size} notifications deleted`);
      setSelectedIds(new Set());
      handleRefresh();
    } catch (error) {
      console.error("Error deleting notifications:", error);
      toast.error("Failed to delete notifications");
    }
  };

  // Group notifications by date
  const groupNotificationsByDate = (notifications) => {
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    const yesterday = new Date(today);
    yesterday.setDate(yesterday.getDate() - 1);

    const thisWeekStart = new Date(today);
    thisWeekStart.setDate(thisWeekStart.getDate() - 7);

    const groups = {
      today: [],
      yesterday: [],
      thisWeek: [],
      earlier: [],
    };

    notifications.forEach((notification) => {
      const notifDate = new Date(notification.createdAt);
      notifDate.setHours(0, 0, 0, 0);

      if (notifDate.getTime() === today.getTime()) {
        groups.today.push(notification);
      } else if (notifDate.getTime() === yesterday.getTime()) {
        groups.yesterday.push(notification);
      } else if (notifDate >= thisWeekStart) {
        groups.thisWeek.push(notification);
      } else {
        groups.earlier.push(notification);
      }
    });

    return groups;
  };

  const filteredNotifications = notifications.filter((n) => {
    if (filterRead === "read") return n.read;
    if (filterRead === "unread") return !n.read;
    return true;
  });

  const groupedNotifications = groupNotificationsByDate(filteredNotifications);

  return (
    <div className="app-shell notifications-theme h-[100dvh] overflow-hidden">
      <Sidebar
        collapsed={collapsed}
        setCollapsed={setCollapsed}
        onLogout={onLogout}
        userRole={userRole}
      />

      <main
        ref={scrollContainerRef}
        className={`app-main relative z-10 h-[100dvh] min-w-0 flex-1 overflow-y-auto overflow-x-hidden px-3 py-4 transition-all duration-300 [overscroll-behavior-y:auto] [scrollbar-gutter:stable] sm:px-5 lg:px-6 ${
          collapsed ? "app-offset app-offset-collapsed" : "app-offset"
        }`}
        style={{ WebkitOverflowScrolling: "touch" }}
      >
        <div className="mx-auto max-w-[1500px] space-y-4 pb-8 sm:space-y-5">
        {/* Header */}
        <div className="app-header rounded-2xl px-5 py-4 sm:px-6 sm:py-5">
          <div className="flex flex-col justify-between gap-4 lg:flex-row lg:items-center">
            <div className="flex items-center gap-3">
              <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-blue-600 text-white shadow-sm shadow-blue-600/20">
                <Bell className="h-5 w-5" />
              </div>
              <div>
                <p className="app-eyebrow">Inbox</p>
                <h1 className="app-title">Notification center</h1>
                <p className="mt-1 flex flex-wrap items-center gap-2 text-sm text-slate-500 dark:text-slate-400">
                  {unreadCount > 0 ? (
                    <>
                      <span className="w-2 h-2 bg-blue-500 rounded-full animate-pulse"></span>
                      {unreadCount} unread notification{unreadCount !== 1 ? "s" : ""}
                    </>
                  ) : (
                    "All caught up!"
                  )}
                  <span className="text-xs text-slate-400 dark:text-slate-500">
                    Updated {lastFetchTime.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}
                  </span>
                </p>
              </div>
            </div>

            <div className="flex flex-wrap items-center gap-2">
              <button
                type="button"
                onClick={handleRefresh}
                className="app-secondary-button inline-flex h-10 w-10 items-center justify-center rounded-xl"
                title="Refresh (Ctrl+R)"
                aria-label="Refresh notifications"
              >
                <RefreshCw className={`h-4 w-4 ${loading ? "animate-spin" : ""}`} />
              </button>

              <button
                type="button"
                onClick={() => setShowStats(!showStats)}
                aria-pressed={showStats}
                className={`inline-flex h-10 items-center gap-2 rounded-xl border px-3 text-sm font-semibold transition ${showStats ? "border-blue-200 bg-blue-50 text-blue-700 dark:border-blue-400/25 dark:bg-blue-400/10 dark:text-blue-200" : "border-slate-200 bg-white text-slate-600 hover:bg-slate-50 dark:border-white/10 dark:bg-white/[0.04] dark:text-slate-300 dark:hover:bg-white/[0.07]"}`}
                title="Toggle Statistics"
              >
                <BarChart3 className="h-4 w-4" />
                <span className="hidden sm:inline">Overview</span>
              </button>

              <button
                type="button"
                onClick={() => {
                  setBulkMode(!bulkMode);
                  setSelectedIds(new Set());
                }}
                aria-pressed={bulkMode}
                className={`inline-flex h-10 items-center gap-2 rounded-xl border px-3 text-sm font-semibold transition ${
                  bulkMode
                    ? "border-violet-200 bg-violet-50 text-violet-700 dark:border-violet-400/25 dark:bg-violet-400/10 dark:text-violet-200"
                    : "border-slate-200 bg-white text-slate-600 hover:bg-slate-50 dark:border-white/10 dark:bg-white/[0.04] dark:text-slate-300 dark:hover:bg-white/[0.07]"
                }`}
              >
                <CheckCircle className="h-4 w-4" />
                {bulkMode ? "Done" : "Select"}
              </button>

              {unreadCount > 0 && (
                <button
                  type="button"
                  onClick={handleMarkAllAsRead}
                  className="inline-flex h-10 items-center gap-2 rounded-xl border border-blue-600 bg-blue-600 px-4 text-sm font-semibold text-white transition hover:border-blue-700 hover:bg-blue-700"
                >
                  <CheckCircle className="h-4 w-4" />
                  <span className="hidden sm:inline">Mark all read</span>
                  <span className="sm:hidden">Read all</span>
                </button>
              )}

              <button
                type="button"
                onClick={handleDeleteAllRead}
                className="app-secondary-button inline-flex h-10 items-center gap-2 rounded-xl px-3 text-sm font-semibold"
              >
                <Trash2 className="h-4 w-4" />
                <span className="hidden lg:inline">Delete read</span>
              </button>
            </div>
          </div>

          {/* Where people come to think about notifications is where the switch
              for them belongs — and it is the only route back for anyone who
              dismissed the contextual prompt in chat. */}
          <div className="mt-4">
            <DesktopNotificationsSetting />
          </div>

          {/* Bulk Actions Bar */}
          <AnimatePresence>
            {bulkMode && selectedIds.size > 0 && (
              <MotionDiv
                variants={slideInVariants}
                initial="hidden"
                animate="visible"
                exit="exit"
                className="mt-4 flex flex-col gap-3 overflow-hidden rounded-xl border border-violet-200 bg-violet-50 p-4 dark:border-violet-400/20 dark:bg-violet-400/[0.08] sm:flex-row sm:items-center sm:justify-between"
              >
                <motion.div
                  className="flex items-center gap-2"
                  initial={{ x: -20, opacity: 0 }}
                  animate={{ x: 0, opacity: 1 }}
                  transition={{ delay: 0.1 }}
                >
                  <CheckCircle className="h-5 w-5 text-violet-600 dark:text-violet-300" />
                  <span className="font-medium text-violet-950 dark:text-violet-100">
                    <motion.span
                      key={selectedIds.size}
                      initial={{ scale: 1.3, color: "#a78bfa" }}
                      animate={{ scale: 1, color: "#ffffff" }}
                      transition={{ type: "spring", stiffness: 300, damping: 15 }}
                    >
                      {selectedIds.size}
                    </motion.span>{" "}
                    notification{selectedIds.size !== 1 ? "s" : ""} selected
                  </span>
                </motion.div>
                <motion.div
                  className="flex flex-wrap gap-2"
                  initial={{ x: 20, opacity: 0 }}
                  animate={{ x: 0, opacity: 1 }}
                  transition={{ delay: 0.15 }}
                >
                  <motion.button
                    whileHover={{ scale: 1.05 }}
                    whileTap={{ scale: 0.95 }}
                    onClick={handleBulkMarkAsRead}
                    className="h-9 rounded-lg border border-blue-600 bg-blue-600 px-3 text-xs font-semibold text-white transition hover:border-blue-700 hover:bg-blue-700"
                    title="Mark as Read (R)"
                  >
                    Mark Read
                  </motion.button>
                  <motion.button
                    whileHover={{ scale: 1.05 }}
                    whileTap={{ scale: 0.95 }}
                    onClick={handleBulkDelete}
                    className="h-9 rounded-lg border border-rose-200 bg-white px-3 text-xs font-semibold text-rose-700 transition hover:bg-rose-50 dark:border-rose-400/20 dark:bg-transparent dark:text-rose-200 dark:hover:bg-rose-400/10"
                    title="Delete (D)"
                  >
                    Delete
                  </motion.button>
                  <motion.button
                    whileHover={{ scale: 1.05 }}
                    whileTap={{ scale: 0.95 }}
                    onClick={() => {
                      setSelectedIds(new Set());
                      setBulkMode(false);
                    }}
                    className="h-9 rounded-lg border border-slate-200 bg-white px-3 text-xs font-semibold text-slate-600 transition hover:bg-slate-50 dark:border-white/10 dark:bg-white/[0.04] dark:text-slate-300 dark:hover:bg-white/[0.08]"
                  >
                    Cancel
                  </motion.button>
                </motion.div>
              </MotionDiv>
            )}
          </AnimatePresence>

          {/* Keyboard Shortcuts Help */}
          {bulkMode && (
            <div className="mt-3 hidden rounded-xl border border-slate-200 bg-slate-50 p-3 text-xs text-slate-500 dark:border-white/10 dark:bg-white/[0.03] dark:text-slate-400 md:block">
              <span className="font-semibold text-slate-700 dark:text-slate-200">Keyboard shortcuts:</span>{" "}
              <span className="inline-flex items-center gap-1 ml-2">
                <kbd className="rounded border border-slate-200 bg-white px-2 py-1 dark:border-white/10 dark:bg-white/[0.06]">Ctrl+A</kbd> Select all
              </span>
              <span className="inline-flex items-center gap-1 ml-3">
                <kbd className="rounded border border-slate-200 bg-white px-2 py-1 dark:border-white/10 dark:bg-white/[0.06]">R</kbd> Mark read
              </span>
              <span className="inline-flex items-center gap-1 ml-3">
                <kbd className="rounded border border-slate-200 bg-white px-2 py-1 dark:border-white/10 dark:bg-white/[0.06]">D</kbd> Delete
              </span>
              <span className="inline-flex items-center gap-1 ml-3">
                <kbd className="rounded border border-slate-200 bg-white px-2 py-1 dark:border-white/10 dark:bg-white/[0.06]">Ctrl+R</kbd> Refresh
              </span>
            </div>
          )}

          {/* Statistics Dashboard */}
          <AnimatePresence>
            {showStats && stats && (
              <motion.div
                className="mt-4 grid grid-cols-2 gap-px overflow-hidden rounded-xl border border-slate-200 bg-slate-200 dark:border-white/10 dark:bg-white/10 lg:grid-cols-4"
                variants={containerVariants}
                initial="hidden"
                animate="visible"
                exit={{ opacity: 0, y: -20, transition: { duration: 0.2 } }}
              >
                <motion.div
                  variants={statsCardVariants}
                  className="bg-white p-4 dark:bg-[#10131c]"
                >
                  <div className="flex items-center justify-between mb-2">
                    <span className="text-xs font-medium text-slate-500 dark:text-slate-400">Total</span>
                    <TrendingUp className="h-4 w-4 text-blue-600 dark:text-blue-300" />
                  </div>
                  <motion.p
                    className="text-2xl font-semibold text-slate-950 dark:text-white"
                    key={stats.total}
                    initial={{ scale: 1.2, opacity: 0 }}
                    animate={{ scale: 1, opacity: 1 }}
                  >
                    {stats.total || 0}
                  </motion.p>
                </motion.div>

                <motion.div
                  variants={statsCardVariants}
                  className="bg-white p-4 dark:bg-[#10131c]"
                >
                  <div className="flex items-center justify-between mb-2">
                    <span className="text-xs font-medium text-slate-500 dark:text-slate-400">Unread</span>
                    <Bell className="h-4 w-4 text-emerald-600 dark:text-emerald-300" />
                  </div>
                  <motion.p
                    className="text-2xl font-semibold text-slate-950 dark:text-white"
                    key={stats.unread}
                    initial={{ scale: 1.2, opacity: 0 }}
                    animate={{ scale: 1, opacity: 1 }}
                  >
                    {stats.unread || 0}
                  </motion.p>
                </motion.div>

                <motion.div
                  variants={statsCardVariants}
                  className="bg-white p-4 dark:bg-[#10131c]"
                >
                  <div className="flex items-center justify-between mb-2">
                    <span className="text-xs font-medium text-slate-500 dark:text-slate-400">By type</span>
                    <BarChart3 className="h-4 w-4 text-violet-600 dark:text-violet-300" />
                  </div>
                  <div className="space-y-1 text-xs text-slate-500 dark:text-slate-400">
                    {stats.byType &&
                      Object.entries(stats.byType)
                        .slice(0, 2)
                        .map(([type, count]) => (
                          <motion.div
                            key={type}
                            className="flex justify-between"
                            initial={{ x: -10, opacity: 0 }}
                            animate={{ x: 0, opacity: 1 }}
                          >
                            <span className="capitalize">{type}:</span>
                            <span className="font-medium text-slate-950 dark:text-white">{count}</span>
                          </motion.div>
                        ))}
                  </div>
                </motion.div>

                <motion.div
                  variants={statsCardVariants}
                  className="bg-white p-4 dark:bg-[#10131c]"
                >
                  <div className="flex items-center justify-between mb-2">
                    <span className="text-xs font-medium text-slate-500 dark:text-slate-400">Urgent unread</span>
                    <AlertCircle className="h-4 w-4 text-amber-600 dark:text-amber-300" />
                  </div>
                  <motion.p
                    className="text-2xl font-semibold text-slate-950 dark:text-white"
                    key={stats.byPriority?.urgent}
                    initial={{ scale: 1.2, opacity: 0 }}
                    animate={{ scale: 1, opacity: 1 }}
                  >
                    {stats.byPriority?.urgent || 0}
                  </motion.p>
                </motion.div>
              </motion.div>
            )}
          </AnimatePresence>

          {/* Search and Filters */}
          <div className="mt-4 flex flex-col gap-3 border-t border-slate-200 pt-4 dark:border-white/10 sm:flex-row">
            {/* Search */}
            <div className="relative min-w-0 flex-1">
              <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
              <input
                type="search"
                aria-label="Search notifications"
                placeholder="Search notifications"
                value={searchQuery}
                onChange={(e) => {
                  setSearchQuery(e.target.value);
                  setPage(1);
                }}
                className="h-10 w-full rounded-xl border border-slate-200 bg-slate-50 pl-9 pr-9 text-sm text-slate-900 outline-none transition placeholder:text-slate-400 focus:border-blue-500 focus:bg-white focus:ring-2 focus:ring-blue-500/15 dark:border-white/10 dark:bg-white/[0.04] dark:text-white dark:focus:border-blue-400 dark:focus:bg-white/[0.06]"
              />
              {searchQuery && (
                <button
                  onClick={() => setSearchQuery("")}
                  type="button"
                  className="absolute right-2 top-1/2 flex h-7 w-7 -translate-y-1/2 items-center justify-center rounded-lg text-slate-400 transition hover:bg-slate-200 hover:text-slate-700 dark:hover:bg-white/10 dark:hover:text-white"
                  aria-label="Clear search"
                >
                  <X className="h-4 w-4" />
                </button>
              )}
            </div>

            {/* Filter Toggle */}
            <button
              type="button"
              onClick={() => setShowFilters(!showFilters)}
              aria-expanded={showFilters}
              className={`inline-flex h-10 items-center justify-center gap-2 rounded-xl border px-4 text-sm font-semibold transition ${showFilters || filterType !== "all" || filterPriority !== "all" || filterRead !== "all" ? "border-blue-200 bg-blue-50 text-blue-700 dark:border-blue-400/25 dark:bg-blue-400/10 dark:text-blue-200" : "border-slate-200 bg-white text-slate-600 hover:bg-slate-50 dark:border-white/10 dark:bg-white/[0.04] dark:text-slate-300 dark:hover:bg-white/[0.07]"}`}
            >
              <Filter className="h-4 w-4" />
              Filters
              {(filterType !== "all" ||
                filterPriority !== "all" ||
                filterRead !== "all") && (
                <span className="h-2 w-2 rounded-full bg-blue-500"></span>
              )}
              <ChevronDown
                className={`h-4 w-4 transition-transform ${
                  showFilters ? "rotate-180" : ""
                }`}
              />
            </button>
          </div>

          {/* Filter Options */}
          {showFilters && (
            <div className="mt-3 rounded-xl border border-slate-200 bg-slate-50 p-4 dark:border-white/10 dark:bg-white/[0.03] animate-in fade-in slide-in-from-top-2">
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                <div>
                  <label className="mb-2 block text-xs font-semibold text-slate-600 dark:text-slate-300">
                    Type
                  </label>
                  <select
                    value={filterType}
                    onChange={(e) => {
                      setFilterType(e.target.value);
                      setPage(1);
                    }}
                    className="h-10 w-full rounded-xl border border-slate-200 bg-white px-3 text-sm text-slate-900 outline-none transition focus:border-blue-500 focus:ring-2 focus:ring-blue-500/15 dark:border-white/10 dark:bg-[#151923] dark:text-white dark:focus:border-blue-400"
                  >
                    <option value="all">All Types</option>
                    <option value="task">Tasks</option>
                    <option value="chat">Chat</option>
                    <option value="payslip">Payslips</option>
                    <option value="leave">Leaves</option>
                    <option value="achievement">Achievements</option>
                    <option value="system">System</option>
                  </select>
                </div>

                <div>
                  <label className="mb-2 block text-xs font-semibold text-slate-600 dark:text-slate-300">
                    Priority
                  </label>
                  <select
                    value={filterPriority}
                    onChange={(e) => {
                      setFilterPriority(e.target.value);
                      setPage(1);
                    }}
                    className="h-10 w-full rounded-xl border border-slate-200 bg-white px-3 text-sm text-slate-900 outline-none transition focus:border-blue-500 focus:ring-2 focus:ring-blue-500/15 dark:border-white/10 dark:bg-[#151923] dark:text-white dark:focus:border-blue-400"
                  >
                    <option value="all">All Priorities</option>
                    <option value="urgent">🔴 Urgent</option>
                    <option value="high">🟠 High</option>
                    <option value="normal">🔵 Normal</option>
                    <option value="low">⚪ Low</option>
                  </select>
                </div>

                <div>
                  <label className="mb-2 block text-xs font-semibold text-slate-600 dark:text-slate-300">
                    Status
                  </label>
                  <select
                    value={filterRead}
                    onChange={(e) => {
                      setFilterRead(e.target.value);
                      setPage(1);
                    }}
                    className="h-10 w-full rounded-xl border border-slate-200 bg-white px-3 text-sm text-slate-900 outline-none transition focus:border-blue-500 focus:ring-2 focus:ring-blue-500/15 dark:border-white/10 dark:bg-[#151923] dark:text-white dark:focus:border-blue-400"
                  >
                    <option value="all">All</option>
                    <option value="unread">Unread Only</option>
                    <option value="read">Read Only</option>
                  </select>
                </div>
              </div>
            </div>
          )}
        </div>

        {/* Notifications List with Date Grouping */}
        <div className="space-y-5">
          {loading && notifications.length === 0 ? (
            <div className="app-panel overflow-hidden rounded-2xl" aria-label="Loading notifications">
              {[0, 1, 2, 3].map((item) => (
                <div key={item} className="flex animate-pulse gap-4 border-b border-slate-100 p-4 last:border-b-0 dark:border-white/[0.07]">
                  <div className="h-10 w-10 shrink-0 rounded-xl bg-slate-200 dark:bg-white/10" />
                  <div className="min-w-0 flex-1 space-y-2 py-1">
                    <div className="h-3 w-1/3 rounded bg-slate-200 dark:bg-white/10" />
                    <div className="h-3 w-3/4 rounded bg-slate-100 dark:bg-white/[0.06]" />
                  </div>
                </div>
              ))}
            </div>
          ) : loadError && notifications.length === 0 ? (
            <div className="app-panel flex flex-col items-center justify-center rounded-2xl px-5 py-16 text-center">
              <div className="mb-4 flex h-12 w-12 items-center justify-center rounded-xl bg-rose-50 text-rose-600 dark:bg-rose-400/10 dark:text-rose-300"><AlertCircle className="h-6 w-6" /></div>
              <h3 className="text-lg font-semibold text-slate-950 dark:text-white">Notifications unavailable</h3>
              <p className="mt-2 max-w-md text-sm text-slate-500 dark:text-slate-400">{loadError}</p>
              <button
                type="button"
                onClick={handleRefresh}
                className="mt-5 inline-flex h-10 items-center gap-2 rounded-xl border border-blue-600 bg-blue-600 px-4 text-sm font-semibold text-white transition hover:border-blue-700 hover:bg-blue-700"
              >
                <RefreshCw className="h-4 w-4" /> Try again
              </button>
            </div>
          ) : filteredNotifications.length > 0 ? (
            <>
              {/* Today */}
              <AnimatePresence>
                {groupedNotifications.today.length > 0 && (
                  <motion.div
                    initial={{ opacity: 0, y: 20 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, y: -20 }}
                    transition={{ duration: 0.3 }}
                  >
                    <motion.h2
                      className="mb-2.5 flex items-center gap-2 px-1 text-sm font-semibold text-slate-700 dark:text-slate-200"
                      initial={{ x: -20, opacity: 0 }}
                      animate={{ x: 0, opacity: 1 }}
                      transition={{ delay: 0.1 }}
                    >
                      <motion.span
                        className="w-2 h-2 bg-blue-500 rounded-full"
                        variants={pulseVariants}
                        initial="initial"
                        animate="animate"
                      />
                      Today
                    </motion.h2>
                    <motion.div
                      className="app-panel divide-y divide-slate-100 overflow-hidden rounded-2xl dark:divide-white/[0.07]"
                      variants={containerVariants}
                      initial="hidden"
                      animate="visible"
                    >
                      {groupedNotifications.today.map((notification, index) => (
                        <motion.div
                          key={notification._id}
                          variants={itemVariants}
                          custom={index}
                          layout
                          className="transition-colors hover:bg-slate-50 dark:hover:bg-white/[0.025]"
                        >
                          <NotificationItem
                            notification={notification}
                            onMarkAsRead={handleMarkAsRead}
                            onDelete={handleDelete}
                            bulkMode={bulkMode}
                            isSelected={selectedIds.has(notification._id)}
                            onToggleSelect={() => handleToggleSelect(notification._id)}
                          />
                        </motion.div>
                      ))}
                    </motion.div>
                  </motion.div>
                )}
              </AnimatePresence>

              {/* Yesterday */}
              <AnimatePresence>
                {groupedNotifications.yesterday.length > 0 && (
                  <motion.div
                    initial={{ opacity: 0, y: 20 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, y: -20 }}
                    transition={{ duration: 0.3, delay: 0.1 }}
                  >
                    <motion.h2
                      className="mb-2.5 flex items-center gap-2 px-1 text-sm font-semibold text-slate-700 dark:text-slate-200"
                      initial={{ x: -20, opacity: 0 }}
                      animate={{ x: 0, opacity: 1 }}
                      transition={{ delay: 0.2 }}
                    >
                      <motion.span
                        className="w-2 h-2 bg-purple-500 rounded-full"
                        variants={pulseVariants}
                        initial="initial"
                        animate="animate"
                      />
                      Yesterday
                    </motion.h2>
                    <motion.div
                      className="app-panel divide-y divide-slate-100 overflow-hidden rounded-2xl dark:divide-white/[0.07]"
                      variants={containerVariants}
                      initial="hidden"
                      animate="visible"
                    >
                      {groupedNotifications.yesterday.map((notification, index) => (
                        <motion.div
                          key={notification._id}
                          variants={itemVariants}
                          custom={index}
                          layout
                          className="transition-colors hover:bg-slate-50 dark:hover:bg-white/[0.025]"
                        >
                          <NotificationItem
                            notification={notification}
                            onMarkAsRead={handleMarkAsRead}
                            onDelete={handleDelete}
                            bulkMode={bulkMode}
                            isSelected={selectedIds.has(notification._id)}
                            onToggleSelect={() => handleToggleSelect(notification._id)}
                          />
                        </motion.div>
                      ))}
                    </motion.div>
                  </motion.div>
                )}
              </AnimatePresence>

              {/* This Week */}
              <AnimatePresence>
                {groupedNotifications.thisWeek.length > 0 && (
                  <motion.div
                    initial={{ opacity: 0, y: 20 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, y: -20 }}
                    transition={{ duration: 0.3, delay: 0.2 }}
                  >
                    <motion.h2
                      className="mb-2.5 flex items-center gap-2 px-1 text-sm font-semibold text-slate-700 dark:text-slate-200"
                      initial={{ x: -20, opacity: 0 }}
                      animate={{ x: 0, opacity: 1 }}
                      transition={{ delay: 0.3 }}
                    >
                      <motion.span
                        className="w-2 h-2 bg-green-500 rounded-full"
                        variants={pulseVariants}
                        initial="initial"
                        animate="animate"
                      />
                      This Week
                    </motion.h2>
                    <motion.div
                      className="app-panel divide-y divide-slate-100 overflow-hidden rounded-2xl dark:divide-white/[0.07]"
                      variants={containerVariants}
                      initial="hidden"
                      animate="visible"
                    >
                      {groupedNotifications.thisWeek.map((notification, index) => (
                        <motion.div
                          key={notification._id}
                          variants={itemVariants}
                          custom={index}
                          layout
                          className="transition-colors hover:bg-slate-50 dark:hover:bg-white/[0.025]"
                        >
                          <NotificationItem
                            notification={notification}
                            onMarkAsRead={handleMarkAsRead}
                            onDelete={handleDelete}
                            bulkMode={bulkMode}
                            isSelected={selectedIds.has(notification._id)}
                            onToggleSelect={() => handleToggleSelect(notification._id)}
                          />
                        </motion.div>
                      ))}
                    </motion.div>
                  </motion.div>
                )}
              </AnimatePresence>

              {/* Earlier */}
              <AnimatePresence>
                {groupedNotifications.earlier.length > 0 && (
                  <motion.div
                    initial={{ opacity: 0, y: 20 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, y: -20 }}
                    transition={{ duration: 0.3, delay: 0.3 }}
                  >
                    <motion.h2
                      className="mb-2.5 flex items-center gap-2 px-1 text-sm font-semibold text-slate-700 dark:text-slate-200"
                      initial={{ x: -20, opacity: 0 }}
                      animate={{ x: 0, opacity: 1 }}
                      transition={{ delay: 0.4 }}
                    >
                      <motion.span
                        className="w-2 h-2 bg-gray-500 rounded-full"
                        variants={pulseVariants}
                        initial="initial"
                        animate="animate"
                      />
                      Earlier
                    </motion.h2>
                    <motion.div
                      className="app-panel divide-y divide-slate-100 overflow-hidden rounded-2xl dark:divide-white/[0.07]"
                      variants={containerVariants}
                      initial="hidden"
                      animate="visible"
                    >
                      {groupedNotifications.earlier.map((notification, index) => (
                        <motion.div
                          key={notification._id}
                          variants={itemVariants}
                          custom={index}
                          layout
                          className="transition-colors hover:bg-slate-50 dark:hover:bg-white/[0.025]"
                        >
                          <NotificationItem
                            notification={notification}
                            onMarkAsRead={handleMarkAsRead}
                            onDelete={handleDelete}
                            bulkMode={bulkMode}
                            isSelected={selectedIds.has(notification._id)}
                            onToggleSelect={() => handleToggleSelect(notification._id)}
                          />
                        </motion.div>
                      ))}
                    </motion.div>
                  </motion.div>
                )}
              </AnimatePresence>

              {/* Infinite Scroll Loader */}
              <div ref={observerTarget} className="py-4 text-center">
                {loadingMore && (
                  <div className="flex items-center justify-center gap-2 text-slate-500 dark:text-slate-400">
                    <Loader2 className="h-4 w-4 animate-spin" />
                    Loading more...
                  </div>
                )}
                {!hasMore && notifications.length > 0 && (
                  <p className="text-sm text-slate-500 dark:text-slate-400">You have reached the end</p>
                )}
              </div>
            </>
          ) : (
            <div className="app-panel overflow-hidden rounded-2xl">
              <div className="flex flex-col items-center justify-center py-20 text-center">
                <div className="mb-4 flex h-12 w-12 items-center justify-center rounded-xl bg-slate-100 text-slate-500 dark:bg-white/[0.06] dark:text-slate-400"><Bell className="h-6 w-6" /></div>
                <h3 className="mb-2 text-lg font-semibold text-slate-950 dark:text-white">
                  No notifications found
                </h3>
                <p className="max-w-sm text-sm text-slate-500 dark:text-slate-400">
                  {searchQuery || filterType !== "all" || filterPriority !== "all" || filterRead !== "all"
                    ? "Try a different search or adjust your filters."
                    : "Nothing needs your attention right now."}
                </p>
              </div>
            </div>
          )}
        </div>
        </div>
      </main>
    </div>
  );
};

export default NotificationCenterPage;
