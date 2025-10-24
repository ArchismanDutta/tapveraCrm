import React, { useState, useEffect, useRef, useCallback } from "react";
import {
  Bell,
  CheckCircle,
  Trash2,
  Search,
  Filter,
  X,
  Archive,
  Settings,
  TrendingUp,
  BarChart3,
  ChevronDown,
  RefreshCw,
  Loader2,
} from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import Sidebar from "../components/dashboard/Sidebar";
import NotificationItem from "../components/notifications/NotificationItem";
import { toast } from "react-toastify";

const API_BASE = import.meta.env.VITE_API_BASE || "http://localhost:5000";

// Keyboard shortcuts
const SHORTCUTS = {
  MARK_READ: "r",
  DELETE: "d",
  ARCHIVE: "a",
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
  const [page, setPage] = useState(1);
  const [hasMore, setHasMore] = useState(true);
  const [unreadCount, setUnreadCount] = useState(0);
  const [showFilters, setShowFilters] = useState(false);
  const [showStats, setShowStats] = useState(false);
  const [showPreferences, setShowPreferences] = useState(false);
  const [stats, setStats] = useState(null);

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
    // Reset and fetch when filters change
    setNotifications([]);
    setPage(1);
    setHasMore(true);
    fetchNotifications(1, true);
    fetchStats();
  }, [filterType, filterPriority, filterRead, searchQuery]);

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
      } else if (e.key === SHORTCUTS.ARCHIVE && selectedIds.size > 0) {
        e.preventDefault();
        handleBulkArchive();
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

    if (observerTarget.current) {
      observer.observe(observerTarget.current);
    }

    return () => {
      if (observerTarget.current) {
        observer.unobserve(observerTarget.current);
      }
    };
  }, [hasMore, loading, loadingMore, page]);

  const fetchNotifications = async (pageNum = 1, reset = false) => {
    try {
      if (reset) {
        setLoading(true);
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
      if (searchQuery) params.append("search", searchQuery);

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
        setStats(data.stats);
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

  const handleBulkArchive = async () => {
    // Archive functionality - mark as read and navigate away from view
    await handleBulkMarkAsRead();
    toast.info("Archive feature coming soon! For now, notifications are marked as read.");
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
    <div className="flex min-h-screen bg-gradient-to-br from-slate-900 via-slate-800 to-slate-900">
      <Sidebar
        collapsed={collapsed}
        setCollapsed={setCollapsed}
        onLogout={onLogout}
        userRole={userRole}
      />

      <main
        ref={scrollContainerRef}
        className={`flex-1 transition-all duration-300 ${
          collapsed ? "ml-16" : "ml-56"
        } p-6 overflow-y-auto`}
      >
        {/* Header */}
        <div className="mb-6">
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center gap-3">
              <div className="p-3 bg-gradient-to-br from-blue-500 to-purple-600 rounded-xl shadow-lg">
                <Bell className="w-6 h-6 text-white" />
              </div>
              <div>
                <h1 className="text-3xl font-bold text-white">Notification Center</h1>
                <p className="text-gray-400 mt-1 flex items-center gap-2">
                  {unreadCount > 0 ? (
                    <>
                      <span className="w-2 h-2 bg-blue-500 rounded-full animate-pulse"></span>
                      {unreadCount} unread notification{unreadCount !== 1 ? "s" : ""}
                    </>
                  ) : (
                    "All caught up!"
                  )}
                  <span className="text-gray-600 text-xs ml-2">
                    Last updated: {lastFetchTime.toLocaleTimeString()}
                  </span>
                </p>
              </div>
            </div>

            <div className="flex gap-2">
              <button
                onClick={handleRefresh}
                className="flex items-center gap-2 px-3 py-2 bg-slate-700 hover:bg-slate-600 text-white rounded-lg transition-colors"
                title="Refresh (Ctrl+R)"
              >
                <RefreshCw className="w-4 h-4" />
              </button>

              <button
                onClick={() => setShowStats(!showStats)}
                className="flex items-center gap-2 px-3 py-2 bg-slate-700 hover:bg-slate-600 text-white rounded-lg transition-colors"
                title="Toggle Statistics"
              >
                <BarChart3 className="w-4 h-4" />
              </button>

              <button
                onClick={() => setBulkMode(!bulkMode)}
                className={`flex items-center gap-2 px-4 py-2 rounded-lg transition-colors ${
                  bulkMode
                    ? "bg-purple-600 hover:bg-purple-700 text-white"
                    : "bg-slate-700 hover:bg-slate-600 text-white"
                }`}
              >
                <CheckCircle className="w-4 h-4" />
                {bulkMode ? "Exit Bulk Mode" : "Bulk Select"}
              </button>

              {unreadCount > 0 && (
                <button
                  onClick={handleMarkAllAsRead}
                  className="flex items-center gap-2 px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg transition-colors"
                >
                  <CheckCircle className="w-4 h-4" />
                  Mark All Read
                </button>
              )}

              <button
                onClick={handleDeleteAllRead}
                className="flex items-center gap-2 px-4 py-2 bg-slate-700 hover:bg-slate-600 text-white rounded-lg transition-colors"
              >
                <Trash2 className="w-4 h-4" />
                Delete Read
              </button>
            </div>
          </div>

          {/* Bulk Actions Bar */}
          <AnimatePresence>
            {bulkMode && selectedIds.size > 0 && (
              <motion.div
                variants={slideInVariants}
                initial="hidden"
                animate="visible"
                exit="exit"
                className="mb-4 p-4 bg-purple-900/30 border border-purple-500/30 rounded-lg flex items-center justify-between overflow-hidden"
              >
                <motion.div
                  className="flex items-center gap-2"
                  initial={{ x: -20, opacity: 0 }}
                  animate={{ x: 0, opacity: 1 }}
                  transition={{ delay: 0.1 }}
                >
                  <CheckCircle className="w-5 h-5 text-purple-400" />
                  <span className="text-white font-medium">
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
                  className="flex gap-2"
                  initial={{ x: 20, opacity: 0 }}
                  animate={{ x: 0, opacity: 1 }}
                  transition={{ delay: 0.15 }}
                >
                  <motion.button
                    whileHover={{ scale: 1.05 }}
                    whileTap={{ scale: 0.95 }}
                    onClick={handleBulkMarkAsRead}
                    className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg transition-colors text-sm"
                    title="Mark as Read (R)"
                  >
                    Mark Read
                  </motion.button>
                  <motion.button
                    whileHover={{ scale: 1.05 }}
                    whileTap={{ scale: 0.95 }}
                    onClick={handleBulkArchive}
                    className="px-4 py-2 bg-green-600 hover:bg-green-700 text-white rounded-lg transition-colors text-sm"
                    title="Archive (A)"
                  >
                    Archive
                  </motion.button>
                  <motion.button
                    whileHover={{ scale: 1.05 }}
                    whileTap={{ scale: 0.95 }}
                    onClick={handleBulkDelete}
                    className="px-4 py-2 bg-red-600 hover:bg-red-700 text-white rounded-lg transition-colors text-sm"
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
                    className="px-4 py-2 bg-slate-700 hover:bg-slate-600 text-white rounded-lg transition-colors text-sm"
                  >
                    Cancel
                  </motion.button>
                </motion.div>
              </motion.div>
            )}
          </AnimatePresence>

          {/* Keyboard Shortcuts Help */}
          {bulkMode && (
            <div className="mb-4 p-3 bg-slate-800/50 border border-slate-700 rounded-lg text-xs text-gray-400">
              <span className="font-semibold text-white">Keyboard Shortcuts:</span>{" "}
              <span className="inline-flex items-center gap-1 ml-2">
                <kbd className="px-2 py-1 bg-slate-700 rounded">Ctrl+A</kbd> Select All
              </span>
              <span className="inline-flex items-center gap-1 ml-3">
                <kbd className="px-2 py-1 bg-slate-700 rounded">R</kbd> Mark Read
              </span>
              <span className="inline-flex items-center gap-1 ml-3">
                <kbd className="px-2 py-1 bg-slate-700 rounded">D</kbd> Delete
              </span>
              <span className="inline-flex items-center gap-1 ml-3">
                <kbd className="px-2 py-1 bg-slate-700 rounded">A</kbd> Archive
              </span>
              <span className="inline-flex items-center gap-1 ml-3">
                <kbd className="px-2 py-1 bg-slate-700 rounded">Ctrl+R</kbd> Refresh
              </span>
            </div>
          )}

          {/* Statistics Dashboard */}
          <AnimatePresence>
            {showStats && stats && (
              <motion.div
                className="mb-4 grid grid-cols-2 md:grid-cols-4 gap-4"
                variants={containerVariants}
                initial="hidden"
                animate="visible"
                exit={{ opacity: 0, y: -20, transition: { duration: 0.2 } }}
              >
                <motion.div
                  variants={statsCardVariants}
                  whileHover={{ y: -5, transition: { type: "spring", stiffness: 400, damping: 10 } }}
                  className="p-4 bg-gradient-to-br from-blue-500/20 to-blue-600/10 border border-blue-500/30 rounded-lg cursor-pointer"
                >
                  <div className="flex items-center justify-between mb-2">
                    <span className="text-sm text-gray-300">Total</span>
                    <TrendingUp className="w-4 h-4 text-blue-400" />
                  </div>
                  <motion.p
                    className="text-2xl font-bold text-white"
                    key={stats.total}
                    initial={{ scale: 1.2, opacity: 0 }}
                    animate={{ scale: 1, opacity: 1 }}
                  >
                    {stats.total || 0}
                  </motion.p>
                </motion.div>

                <motion.div
                  variants={statsCardVariants}
                  whileHover={{ y: -5, transition: { type: "spring", stiffness: 400, damping: 10 } }}
                  className="p-4 bg-gradient-to-br from-green-500/20 to-green-600/10 border border-green-500/30 rounded-lg cursor-pointer"
                >
                  <div className="flex items-center justify-between mb-2">
                    <span className="text-sm text-gray-300">Unread</span>
                    <Bell className="w-4 h-4 text-green-400" />
                  </div>
                  <motion.p
                    className="text-2xl font-bold text-white"
                    key={stats.unread}
                    initial={{ scale: 1.2, opacity: 0 }}
                    animate={{ scale: 1, opacity: 1 }}
                  >
                    {stats.unread || 0}
                  </motion.p>
                </motion.div>

                <motion.div
                  variants={statsCardVariants}
                  whileHover={{ y: -5, transition: { type: "spring", stiffness: 400, damping: 10 } }}
                  className="p-4 bg-gradient-to-br from-purple-500/20 to-purple-600/10 border border-purple-500/30 rounded-lg cursor-pointer"
                >
                  <div className="flex items-center justify-between mb-2">
                    <span className="text-sm text-gray-300">By Type</span>
                    <BarChart3 className="w-4 h-4 text-purple-400" />
                  </div>
                  <div className="text-xs text-gray-400 space-y-1">
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
                            <span className="text-white font-medium">{count}</span>
                          </motion.div>
                        ))}
                  </div>
                </motion.div>

                <motion.div
                  variants={statsCardVariants}
                  whileHover={{ y: -5, transition: { type: "spring", stiffness: 400, damping: 10 } }}
                  className="p-4 bg-gradient-to-br from-orange-500/20 to-orange-600/10 border border-orange-500/30 rounded-lg cursor-pointer"
                >
                  <div className="flex items-center justify-between mb-2">
                    <span className="text-sm text-gray-300">Urgent</span>
                    <AlertCircle className="w-4 h-4 text-orange-400" />
                  </div>
                  <motion.p
                    className="text-2xl font-bold text-white"
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
          <div className="flex flex-col sm:flex-row gap-3">
            {/* Search */}
            <div className="flex-1 relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400" />
              <input
                type="text"
                placeholder="Search notifications..."
                value={searchQuery}
                onChange={(e) => {
                  setSearchQuery(e.target.value);
                  setPage(1);
                }}
                className="w-full pl-10 pr-4 py-2 bg-slate-800 border border-slate-700 rounded-lg text-white placeholder-gray-400 focus:outline-none focus:border-blue-500 transition-colors"
              />
              {searchQuery && (
                <button
                  onClick={() => setSearchQuery("")}
                  className="absolute right-3 top-1/2 -translate-y-1/2"
                >
                  <X className="w-5 h-5 text-gray-400 hover:text-white transition-colors" />
                </button>
              )}
            </div>

            {/* Filter Toggle */}
            <button
              onClick={() => setShowFilters(!showFilters)}
              className="flex items-center gap-2 px-4 py-2 bg-slate-800 border border-slate-700 rounded-lg text-white hover:bg-slate-700 transition-colors"
            >
              <Filter className="w-5 h-5" />
              Filters
              {(filterType !== "all" ||
                filterPriority !== "all" ||
                filterRead !== "all") && (
                <span className="w-2 h-2 bg-blue-500 rounded-full animate-pulse"></span>
              )}
              <ChevronDown
                className={`w-4 h-4 transition-transform ${
                  showFilters ? "rotate-180" : ""
                }`}
              />
            </button>
          </div>

          {/* Filter Options */}
          {showFilters && (
            <div className="mt-3 p-4 bg-slate-800 border border-slate-700 rounded-lg animate-in fade-in slide-in-from-top-2">
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-300 mb-2">
                    Type
                  </label>
                  <select
                    value={filterType}
                    onChange={(e) => {
                      setFilterType(e.target.value);
                      setPage(1);
                    }}
                    className="w-full px-3 py-2 bg-slate-700 border border-slate-600 rounded-lg text-white focus:outline-none focus:border-blue-500 transition-colors"
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
                  <label className="block text-sm font-medium text-gray-300 mb-2">
                    Priority
                  </label>
                  <select
                    value={filterPriority}
                    onChange={(e) => {
                      setFilterPriority(e.target.value);
                      setPage(1);
                    }}
                    className="w-full px-3 py-2 bg-slate-700 border border-slate-600 rounded-lg text-white focus:outline-none focus:border-blue-500 transition-colors"
                  >
                    <option value="all">All Priorities</option>
                    <option value="urgent">🔴 Urgent</option>
                    <option value="high">🟠 High</option>
                    <option value="normal">🔵 Normal</option>
                    <option value="low">⚪ Low</option>
                  </select>
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-300 mb-2">
                    Status
                  </label>
                  <select
                    value={filterRead}
                    onChange={(e) => {
                      setFilterRead(e.target.value);
                      setPage(1);
                    }}
                    className="w-full px-3 py-2 bg-slate-700 border border-slate-600 rounded-lg text-white focus:outline-none focus:border-blue-500 transition-colors"
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
        <div className="space-y-6">
          {loading && notifications.length === 0 ? (
            <div className="flex items-center justify-center py-20">
              <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-500"></div>
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
                      className="text-lg font-semibold text-white mb-3 flex items-center gap-2"
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
                      className="bg-slate-800/50 backdrop-blur-sm rounded-2xl border border-slate-700/50 overflow-hidden divide-y divide-slate-700"
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
                          className="hover:bg-slate-700/30"
                          whileHover={{ x: 4, transition: { type: "spring", stiffness: 400, damping: 25 } }}
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
                      className="text-lg font-semibold text-white mb-3 flex items-center gap-2"
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
                      className="bg-slate-800/50 backdrop-blur-sm rounded-2xl border border-slate-700/50 overflow-hidden divide-y divide-slate-700"
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
                          className="hover:bg-slate-700/30"
                          whileHover={{ x: 4, transition: { type: "spring", stiffness: 400, damping: 25 } }}
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
                      className="text-lg font-semibold text-white mb-3 flex items-center gap-2"
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
                      className="bg-slate-800/50 backdrop-blur-sm rounded-2xl border border-slate-700/50 overflow-hidden divide-y divide-slate-700"
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
                          className="hover:bg-slate-700/30"
                          whileHover={{ x: 4, transition: { type: "spring", stiffness: 400, damping: 25 } }}
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
                      className="text-lg font-semibold text-white mb-3 flex items-center gap-2"
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
                      className="bg-slate-800/50 backdrop-blur-sm rounded-2xl border border-slate-700/50 overflow-hidden divide-y divide-slate-700"
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
                          className="hover:bg-slate-700/30"
                          whileHover={{ x: 4, transition: { type: "spring", stiffness: 400, damping: 25 } }}
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
                  <div className="flex items-center justify-center gap-2 text-gray-400">
                    <Loader2 className="w-5 h-5 animate-spin" />
                    Loading more...
                  </div>
                )}
                {!hasMore && notifications.length > 0 && (
                  <p className="text-gray-500 text-sm">No more notifications</p>
                )}
              </div>
            </>
          ) : (
            <div className="bg-slate-800/50 backdrop-blur-sm rounded-2xl border border-slate-700/50 overflow-hidden">
              <div className="flex flex-col items-center justify-center py-20 text-center">
                <Bell className="w-16 h-16 text-gray-600 mb-4" />
                <h3 className="text-xl font-semibold text-gray-400 mb-2">
                  No notifications found
                </h3>
                <p className="text-gray-500">
                  {searchQuery || filterType !== "all" || filterRead !== "all"
                    ? "Try adjusting your filters"
                    : "You're all caught up!"}
                </p>
              </div>
            </div>
          )}
        </div>
      </main>
    </div>
  );
};

// Add missing import
import { AlertCircle } from "lucide-react";

export default NotificationCenterPage;
