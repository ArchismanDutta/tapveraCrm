import React, { useEffect, useState } from "react";
import axios from "axios";
import { Bell } from "lucide-react";
import { Link } from "react-router-dom";
import dayjs from "dayjs";

import SummaryCards from "../components/dashboard/SummaryCards";
import TodayTasks from "../components/dashboard/TodayTasks";
import RecentMessages from "../components/dashboard/RecentMessages";
import Sidebar from "../components/dashboard/Sidebar";

const EmployeeDashboard = ({ onLogout }) => {
  const [collapsed, setCollapsed] = useState(false);
  const [tasks, setTasks] = useState([]);
  const [loading, setLoading] = useState(false);
  const [currentTime, setCurrentTime] = useState(new Date());
  const [userName, setUserName] = useState("");
  const [summaryData, setSummaryData] = useState([]);
  const [pendingCount, setPendingCount] = useState(0);
  const [isRinging, setIsRinging] = useState(false);

  const messages = [
    { name: "Sarah Johnson", msg: "Updated the project timeline", time: "2h ago", img: "https://i.pravatar.cc/40?img=1" },
    { name: "Mike Wilson", msg: "Meeting rescheduled to 3 PM", time: "4h ago", img: "https://i.pravatar.cc/40?img=2" },
    { name: "Emily Davis", msg: "New requirements document", time: "5h ago", img: "https://i.pravatar.cc/40?img=4" },
  ];

  const fetchTasks = async () => {
    try {
      setLoading(true);
      const token = localStorage.getItem("token");
      if (!token) return console.error("No token found");

      const config = { headers: { Authorization: `Bearer ${token}` } };
      const res = await axios.get("http://localhost:5000/api/tasks", config);

      const formattedTasks = res.data.map((task) => ({
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
        assignedTo: task.assignedTo?.name || "Unknown",
        dueDate: task.dueDate,
        status: task.status,
      }));
      setTasks(formattedTasks);

      // Summary counts
      const today = dayjs().startOf("day");
      const allTasksCount = res.data.length;
      const tasksDueTodayCount = res.data.filter((task) =>
        dayjs(task.dueDate).isSame(today, "day")
      ).length;
      const overdueTasksCount = res.data.filter(
        (task) =>
          dayjs(task.dueDate).isBefore(today, "day") &&
          task.status !== "completed"
      ).length;

      setSummaryData([
        { label: "All Tasks", count: allTasksCount, bg: "bg-blue-50" },
        { label: "Tasks Due Today", count: tasksDueTodayCount, bg: "bg-green-50" },
        { label: "Overdue Tasks", count: overdueTasksCount, bg: "bg-red-50" },
      ]);

      // Pending task count for bell
      const newPendingCount = res.data.filter((t) => t.status !== "completed").length;
      if (newPendingCount > pendingCount) {
        setIsRinging(true);
        setTimeout(() => setIsRinging(false), 1500);
      }
      setPendingCount(newPendingCount);

    } catch (err) {
      console.error("Error fetching tasks", err.response?.data || err.message);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchTasks();
    const interval = setInterval(fetchTasks, 10000);
    return () => clearInterval(interval);
  }, []);

  useEffect(() => {
    const fetchUser = async () => {
      try {
        const token = localStorage.getItem("token");
        if (!token) return;
        const config = { headers: { Authorization: `Bearer ${token}` } };
        const res = await axios.get("http://localhost:5000/api/users/me", config);
        setUserName(res.data?.name || "User");
      } catch (err) {
        console.error("Error fetching user:", err.message);
      }
    };
    fetchUser();
  }, []);

  useEffect(() => {
    const interval = setInterval(() => setCurrentTime(new Date()), 1000);
    return () => clearInterval(interval);
  }, []);

  return (
    <div className="flex bg-gray-50 font-sans text-gray-800">
      <Sidebar onLogout={onLogout} collapsed={collapsed} setCollapsed={setCollapsed} />

      <main className={`flex-1 p-8 overflow-y-auto transition-all duration-300 ${collapsed ? "ml-20" : "ml-64"}`}>
        {/* Header */}
        <div className="flex justify-between items-center mb-8">
          <div>
            <h1 className="text-2xl font-semibold">
              Good{" "}
              {currentTime.getHours() < 12
                ? "Morning"
                : currentTime.getHours() < 18
                ? "Afternoon"
                : "Evening"}, {userName}
            </h1>
            <p className="text-sm text-gray-500">
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
            {/* Bell Icon with Notification Count */}
            <div className="relative">
              <Bell
                className={`w-9 h-9 text-gray-500 cursor-pointer transition-transform duration-300 ${
                  isRinging ? "animate-bell-ring" : ""
                }`}
              />
              {pendingCount > 0 && (
                <span className="absolute -top-1 -right-1 bg-red-500 text-white text-xs px-1.5 py-0.5 rounded-full">
                  {pendingCount}
                </span>
              )}
            </div>
            <Link to="/profile">
              <img
                src="https://i.pravatar.cc/40?img=3"
                alt="Profile Avatar"
                className="w-9 h-9 rounded-full cursor-pointer"
              />
            </Link>
          </div>
        </div>

        {/* Summary Cards */}
        <SummaryCards data={summaryData} />

        {/* Main layout */}
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
