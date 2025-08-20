import React, { useEffect, useRef, useState } from "react";
import axios from "axios";
import { Link, useNavigate } from "react-router-dom";
import dayjs from "dayjs";
import { io } from "socket.io-client";

import SummaryCards from "../components/dashboard/SummaryCards";
import TodayTasks from "../components/dashboard/TodayTasks";
import RecentMessages from "../components/dashboard/RecentMessages";
import Sidebar from "../components/dashboard/Sidebar";
import NotificationBell from "../components/dashboard/NotificationBell";

// Backend API base
const API_BASE = import.meta.env.VITE_API_URL || "http://localhost:5000";

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
  const socketRef = useRef(null);
  const navigate = useNavigate();

  const messages = [
    { name: "Sarah Johnson", msg: "Updated project timeline", time: "2h ago", img: "https://i.pravatar.cc/40?img=1" },
    { name: "Mike Wilson", msg: "Meeting moved to 3 PM", time: "4h ago", img: "https://i.pravatar.cc/40?img=2" },
    { name: "Emily Davis", msg: "Uploaded new requirements", time: "5h ago", img: "https://i.pravatar.cc/40?img=4" },
  ];

  // Format task object for display
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
    color: task.priority === "High" ? "red" : task.priority === "Medium" ? "yellow" : "green",
    assignedBy: task.assignedBy?.name || "Unknown",
    assignedTo: Array.isArray(task.assignedTo)
      ? task.assignedTo
          .map((u) => (typeof u === "string" ? "Unknown" : u?.name || "Unknown"))
          .join(", ")
      : "Unknown",
    dueDate: task.dueDate,
    status: task.status,
  });

  // Update summary + notifications
  const updateSummaryAndNotifications = (list) => {
    const today = dayjs().startOf("day");
    const allTasksCount = list.length;
    const tasksDueTodayCount = list.filter((t) => t.dueDate && dayjs(t.dueDate).isSame(today, "day")).length;
    const overdueTasksCount = list.filter(
      (t) =>
        t.dueDate &&
        dayjs(t.dueDate).isBefore(today, "day") &&
        t.status?.toLowerCase() !== "completed"
    ).length;

    setSummaryData([
      { label: "All Tasks", count: allTasksCount, bg: "bg-blue-50" },
      { label: "Tasks Due Today", count: tasksDueTodayCount, bg: "bg-green-50" },
      { label: "Overdue Tasks", count: overdueTasksCount, bg: "bg-red-50" },
    ]);

    const newPendingTasks = list.filter((t) => t.status?.toLowerCase() !== "completed");
    if (newPendingTasks.length > pendingCount) {
      setNotifications((prev) => [
        ...newPendingTasks.slice(pendingCount).map((t) => `New Task: ${t.label}`),
        ...prev,
      ]);
    }
    setPendingCount(newPendingTasks.length);
  };

  // Initial fetch
  const fetchTasks = async () => {
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
      updateSummaryAndNotifications(formatted);
    } catch (err) {
      console.error("Error fetching tasks", err.response?.data || err.message);
    } finally {
      setLoading(false);
    }
  };

  // Socket.IO connection
  useEffect(() => {
    const token = localStorage.getItem("token");
    if (!token) return; // don't connect if not authenticated

    const socket = io(API_BASE, {
      transports: ["websocket"],
      withCredentials: true,
    });
    socketRef.current = socket;

    socket.on("connect", () => {
      console.log("✅ Connected to Socket.IO server:", socket.id);
    });

    socket.on("disconnect", (reason) => {
      console.log("❌ Disconnected from server:", reason);
    });

    socket.on("taskCreated", (task) => {
      setTasks((prev) => {
        const updated = [formatTask(task), ...prev];
        updateSummaryAndNotifications(updated);
        return updated;
      });
    });

    socket.on("taskUpdated", (task) => {
      setTasks((prev) => {
        const updated = prev.map((t) => (t.id === task._id ? formatTask(task) : t));
        updateSummaryAndNotifications(updated);
        return updated;
      });
    });

    socket.on("taskDeleted", (taskId) => {
      setTasks((prev) => {
        const updated = prev.filter((t) => t.id !== taskId);
        updateSummaryAndNotifications(updated);
        return updated;
      });
    });

    return () => {
      if (socketRef.current) {
        socketRef.current.off("taskCreated");
        socketRef.current.off("taskUpdated");
        socketRef.current.off("taskDeleted");
        socketRef.current.disconnect();
        socketRef.current = null;
      }
    };
  }, []);

  // Initial API calls
  useEffect(() => {
    fetchTasks();
  }, []);

  useEffect(() => {
    const fetchUser = async () => {
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
        console.error("Error fetching user:", err.message);
      }
    };
    fetchUser();
  }, []);

  // Clock
  useEffect(() => {
    const interval = setInterval(() => setCurrentTime(new Date()), 1000);
    return () => clearInterval(interval);
  }, []);

  useEffect(() => {
    const fetchNotices = async () => {
      try {
        const token = localStorage.getItem("token");
        const res = await axios.get(`${API_BASE}/api/notices`, {
          headers: { Authorization: `Bearer ${token}` },
        });
        setNotices(res.data || []);
      } catch (err) {
        console.error("Error fetching notices:", err.message);
      }
    };
    fetchNotices();
  }, []);

  return (
    <div className="flex bg-gray-50 font-sans text-gray-800">
      <Sidebar
        onLogout={onLogout}
        collapsed={collapsed}
        setCollapsed={setCollapsed}
      />
      <main
        className={`flex-1 p-8 overflow-y-auto transition-all duration-300 ${
          collapsed ? "ml-20" : "ml-64"
        }`}
      >
        <div className="flex justify-between items-center mb-8">
          <div>
            <h1 className="text-2xl font-semibold">
              Good{" "}
              {currentTime.getHours() < 12
                ? "Morning"
                : currentTime.getHours() < 18
                ? "Afternoon"
                : "Evening"}
              , {userName}
            </h1>
            <p className="text-sm text-gray-500">
              {currentTime.toLocaleDateString("en-US", {
                weekday: "long",
                year: "numeric",
                month: "long",
                day: "numeric",
              })}
              {" • "}
              {currentTime.toLocaleTimeString("en-US", {
                hour: "2-digit",
                minute: "2-digit",
                second: "2-digit",
              })}
            </p>
          </div>
          <div className="flex items-center gap-4 relative">
            <NotificationBell notifications={notifications} />
            <Link to="/profile">
              <img
                src="https://i.pravatar.cc/40?img=3"
                alt="Profile Avatar"
                className="w-9 h-9 rounded-full cursor-pointer"
              />
            </Link>
          </div>
        </div>

        {notices.length > 0 && (
          <div className="fixed inset-0 bg-black/30 backdrop-blur-sm flex items-center justify-center z-50">
            <div className="bg-white/90 rounded-lg shadow-xl p-6 max-w-lg w-full">
              <h2 className="text-xl font-bold mb-4">📢 Notices</h2>
              <div className="space-y-3 max-h-80 overflow-y-auto">
                {notices.map((n) => (
                  <div
                    key={n._id}
                    className="border-l-4 border-orange-500 pl-3 text-gray-800"
                  >
                    <p>{n.message}</p>
                    <p className="text-xs text-gray-400 mt-1">
                      {new Date(n.createdAt).toLocaleString()}
                    </p>
                  </div>
                ))}
              </div>
              <button
                onClick={() => setNotices([])}
                className="mt-4 px-4 py-2 bg-orange-500 text-white rounded-lg hover:bg-orange-600"
              >
                Close
              </button>
            </div>
          </div>
        )}

        <SummaryCards data={summaryData} />

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 mt-8">
          <div className="lg:col-span-2">
            <TodayTasks data={tasks} loading={loading} />
          </div>
          <div className="flex flex-col gap-6">
            <RecentMessages messages={messages} className="flex-1" />
          </div>
        </div>
      </main>
    </div>
  );
};

export default EmployeeDashboard;
