import React, { useState, useEffect, useCallback } from "react";
import axios from "axios";
import { Link, useNavigate } from "react-router-dom";
import dayjs from "dayjs";

import SummaryCards from "../components/dashboard/SummaryCards";
import TodayTasks from "../components/dashboard/TodayTasks";
import RecentMessages from "../components/dashboard/RecentMessages";
import Sidebar from "../components/dashboard/Sidebar";
import NotificationBell from "../components/dashboard/NotificationBell";

const API_BASE = import.meta.env.VITE_API_URL || "http://localhost:5000";
const TASK_POLL_INTERVAL_MS = 15000;
const USER_POLL_INTERVAL_MS = 30000;

const EmployeeDashboard = ({ onLogout }) => {
  const [collapsed, setCollapsed] = useState(false);
  const [tasks, setTasks] = useState([]);
  const [loading, setLoading] = useState(false);
  const [currentTime, setCurrentTime] = useState(new Date());
  const [userName, setUserName] = useState("");
  const [summaryData, setSummaryData] = useState([]);
  const [pendingCount, setPendingCount] = useState(0);
  const [notifications, setNotifications] = useState([]);
  const [notices, setNotices] = useState([]);
  const [showNotices, setShowNotices] = useState(false);
  const navigate = useNavigate();

  const messages = [
    { name: "Sarah Johnson", msg: "Updated project timeline", time: "2h ago", img: "https://i.pravatar.cc/40?img=1" },
    { name: "Mike Wilson", msg: "Meeting moved to 3 PM", time: "4h ago", img: "https://i.pravatar.cc/40?img=2" },
    { name: "Emily Davis", msg: "Uploaded new requirements", time: "5h ago", img: "https://i.pravatar.cc/40?img=4" },
  ];

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
      ? task.assignedTo.map((u) => (typeof u === "string" ? "Unknown" : u?.name || "Unknown")).join(", ")
      : "Unknown",
    dueDate: task.dueDate,
    status: task.status,
  });

  const computeSummary = useCallback(() => {
    const today = dayjs(currentTime).startOf("day");
    const allTasksCount = tasks.length;
    const tasksDueTodayCount = tasks.filter((t) => t.dueDate && dayjs(t.dueDate).isSame(today, "day")).length;
    const overdueTasksCount = tasks.filter(
      (t) => t.dueDate && dayjs(t.dueDate).isBefore(dayjs(currentTime)) && t.status?.toLowerCase() !== "completed"
    ).length;

    setSummaryData([
      { label: "All Tasks", count: allTasksCount },
      { label: "Tasks Due Today", count: tasksDueTodayCount },
      { label: "Overdue Tasks", count: overdueTasksCount },
    ]);
  }, [tasks, currentTime]);

  const updateNotifications = useCallback(() => {
    const newPendingTasks = tasks.filter((t) => t.status?.toLowerCase() !== "completed");
    if (newPendingTasks.length > pendingCount) {
      setNotifications((prev) => [
        ...newPendingTasks.slice(pendingCount).map((t) => `New Task: ${t.label}`),
        ...prev,
      ]);
    }
    setPendingCount(newPendingTasks.length);
  }, [tasks, pendingCount]);

  const fetchTasks = useCallback(async () => {
    const token = localStorage.getItem("token");
    if (!token) {
      navigate("/login", { replace: true });
      return;
    }
    try {
      setLoading(true);
      const res = await axios.get(`${API_BASE}/api/tasks`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      const formatted = res.data.map(formatTask);
      setTasks(formatted);
    } catch (err) {
      console.error("Error fetching tasks", err.response?.data || err.message);
    } finally {
      setLoading(false);
    }
  }, [navigate]);

  const fetchUser = useCallback(async () => {
    const token = localStorage.getItem("token");
    if (!token) {
      navigate("/login", { replace: true });
      return;
    }
    try {
      const res = await axios.get(`${API_BASE}/api/users/me`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      setUserName(res.data?.name || "User");
    } catch (err) {
      console.error("Error fetching user:", err.response?.data || err.message);
    }
  }, [navigate]);

  useEffect(() => {
    fetchTasks();
    const intervalId = setInterval(fetchTasks, TASK_POLL_INTERVAL_MS);
    return () => clearInterval(intervalId);
  }, [fetchTasks]);

  useEffect(() => {
    fetchUser();
    const intervalId = setInterval(fetchUser, USER_POLL_INTERVAL_MS);
    return () => clearInterval(intervalId);
  }, [fetchUser]);

  useEffect(() => {
    const interval = setInterval(() => {
      setCurrentTime(new Date());
    }, 1000);
    return () => clearInterval(interval);
  }, []);

  useEffect(() => {
    computeSummary();
    updateNotifications();
  }, [computeSummary, updateNotifications]);

  useEffect(() => {
    const fetchNotices = async () => {
      try {
        const token = localStorage.getItem("token");
        if (!token) return;

        const dismissed = sessionStorage.getItem("noticesDismissed");
        if (dismissed === "true") {
          setShowNotices(false);
          return;
        }

        const res = await axios.get(`${API_BASE}/api/notices`, {
          headers: { Authorization: `Bearer ${token}` },
        });
        if (res.data && res.data.length > 0) {
          setNotices(res.data);
          setShowNotices(true);
        } else {
          setShowNotices(false);
        }
      } catch (err) {
        console.error("Error fetching notices:", err.message);
        setShowNotices(false);
      }
    };
    fetchNotices();
  }, []);

  const handleCloseNotices = () => {
    setNotices([]);
    setShowNotices(false);
    sessionStorage.setItem("noticesDismissed", "true");
  };

  return (
    <div className="flex bg-gradient-to-br from-[#141a21] via-[#191f2b] to-[#101218] font-sans text-blue-100 min-h-screen">
      <Sidebar onLogout={onLogout} collapsed={collapsed} setCollapsed={setCollapsed} userRole="employee" />
      {/* Main content margin-left matched to sidebar width */}
      <main className={`flex-1 p-8 overflow-y-auto transition-all duration-300 ${collapsed ? "ml-20" : "ml-72"}`}>
        <div className="flex justify-between items-center mb-8">
          <div>
            <h1 className="text-2xl font-bold text-white tracking-tight">
              Good {currentTime.getHours() < 12 ? "Morning" : currentTime.getHours() < 18 ? "Afternoon" : "Evening"}, {userName}
            </h1>
            <p className="text-sm text-blue-300">
              {currentTime.toLocaleDateString("en-US", { weekday: "long", year: "numeric", month: "long", day: "numeric" })} •{" "}
              {currentTime.toLocaleTimeString("en-US", { hour: "2-digit", minute: "2-digit", second: "2-digit" })}
            </p>
          </div>
          <div className="flex items-center gap-4 relative">
            <NotificationBell notifications={notifications} />
            <Link to="/profile">
              <img
                src="https://i.pravatar.cc/40?img=3"
                alt="Profile Avatar"
                className="w-9 h-9 rounded-full cursor-pointer border-2 border-orange-500 shadow-lg"
              />
            </Link>
          </div>
        </div>

        {showNotices && notices.length > 0 && (
          <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-50">
            <div className="bg-[#181d2a]/90 rounded-lg shadow-xl p-6 max-w-lg w-full border border-orange-500">
              <h2 className="text-xl font-semibold mb-4 text-orange-400">📢 Notices</h2>
              <div className="space-y-3 max-h-80 overflow-y-auto text-blue-200">
                {notices.map((n) => (
                  <div key={n._id} className="border-l-4 border-orange-400 pl-3">
                    <p>{n.message}</p>
                    <p className="text-xs text-blue-400 mt-1">🕒 {new Date(n.createdAt).toLocaleString()}</p>
                  </div>
                ))}
              </div>
              <button
                onClick={handleCloseNotices}
                className="mt-4 px-4 py-2 bg-orange-400 text-black rounded-lg hover:bg-orange-500 transition"
              >
                Close
              </button>
            </div>
          </div>
        )}

        <SummaryCards data={summaryData} />

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 mt-8">
          <div className="lg:col-span-2">
            <TodayTasks data={tasks} loading={loading} className="bg-[#191f2b]/70 p-4 rounded-xl shadow-xl border border-[#232945]" />
          </div>
          <div className="flex flex-col gap-6">
            <RecentMessages messages={messages} />
          </div>
        </div>
      </main>
    </div>
  );
};

export default EmployeeDashboard;
