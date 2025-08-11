import React, { useEffect, useState } from "react";
import axios from "axios";
import { Bell } from "lucide-react";

import SummaryCards from "../components/dashboard/SummaryCards";
import TodayTasks from "../components/dashboard/TodayTasks";
import QuickActions from "../components/dashboard/QuickActions";
import RecentReports from "../components/dashboard/RecentReports";
import RecentMessages from "../components/dashboard/RecentMessages";
import Sidebar from "../components/dashboard/Sidebar";

const EmployeeDashboard = ({ onLogout }) => {
  const [collapsed, setCollapsed] = useState(false);
  const [tasks, setTasks] = useState([]);
  const [loading, setLoading] = useState(false);

  const [currentTime, setCurrentTime] = useState(new Date());
  const [userName, setUserName] = useState("");

  // Static summary cards for now
  const summaryData = [
    { label: "Tasks Due Today", count: 5, bg: "bg-blue-50" },
    { label: "Pending Reports", count: 2, bg: "bg-green-50" },
    { label: "Unread Messages", count: 3, bg: "bg-indigo-50" },
    { label: "Open Issues", count: 1, bg: "bg-red-50" },
  ];

  // Quick actions static
  const quickActions = [
    {
      label: "Report an Issue",
      colorClass: "text-red-600 border border-red-200",
    },
    {
      label: "Submit Requirement",
      colorClass: "text-blue-600 border border-blue-200",
    },
    {
      label: "Start Chat",
      colorClass: "text-purple-600 border border-purple-200",
    },
    {
      label: "Send Report",
      colorClass: "text-green-600 border border-green-200",
    },
  ];

  // Mock reports
  const reports = [
    {
      label: "Weekly Progress Report",
      date: "Oct 15, 2023",
      status: "Submitted",
      color: "blue",
    },
    {
      label: "Project Status Update",
      date: "Oct 14, 2023",
      status: "Pending",
      color: "yellow",
    },
    {
      label: "Sprint Review Report",
      date: "Oct 13, 2023",
      status: "Approved",
      color: "green",
    },
  ];

  // Mock messages
  const messages = [
    {
      name: "Sarah Johnson",
      msg: "Updated the project timeline",
      time: "2h ago",
      img: "https://i.pravatar.cc/40?img=1",
    },
    {
      name: "Mike Wilson",
      msg: "Meeting rescheduled to 3 PM",
      time: "4h ago",
      img: "https://i.pravatar.cc/40?img=2",
    },
    {
      name: "Emily Davis",
      msg: "New requirements document",
      time: "5h ago",
      img: "https://i.pravatar.cc/40?img=4",
    },
  ];

  // Fetch tasks from backend
  useEffect(() => {
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
        }));

        setTasks(formattedTasks);
      } catch (err) {
        console.error(
          "Error fetching tasks:",
          err.response?.data || err.message
        );
      } finally {
        setLoading(false);
      }
    };

    fetchTasks();
  }, []);

  // Fetch logged-in user name
  useEffect(() => {
    const fetchUser = async () => {
      try {
        const token = localStorage.getItem("token");
        if (!token) return;
        const config = { headers: { Authorization: `Bearer ${token}` } };
        const res = await axios.get("http://localhost:5000/api/users/me", config); // Adjust API endpoint as needed
        setUserName(res.data?.name || "User");
      } catch (err) {
        console.error("Error fetching user:", err.message);
      }
    };
    fetchUser();
  }, []);

  // Update time every second
  useEffect(() => {
    const interval = setInterval(() => {
      setCurrentTime(new Date());
    }, 1000);
    return () => clearInterval(interval);
  }, []);

  return (
    <div className="flex bg-gray-50 font-sans text-gray-800">
      {/* Sidebar */}
      <Sidebar
        onLogout={onLogout}
        collapsed={collapsed}
        setCollapsed={setCollapsed}
      />

      {/* Main Content */}
      <main
        className={`flex-1 p-8 overflow-y-auto transition-all duration-300 ${
          collapsed ? "ml-20" : "ml-64"
        }`}
      >
        {/* Header */}
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
              })}{" "}
              •{" "}
              {currentTime.toLocaleTimeString("en-US", {
                hour: "2-digit",
                minute: "2-digit",
                second: "2-digit",
              })}
            </p>
          </div>
          <div className="flex items-center space-x-4">
            <Bell className="text-gray-500" />
            <img
              src="https://i.pravatar.cc/40?img=3"
              alt="Avatar"
              className="w-9 h-9 rounded-full"
            />
            {/* <span className="text-sm font-medium">{userName}</span> */}
          </div>
        </div>

        <SummaryCards data={summaryData} />

        <div className="grid grid-cols-3 gap-6 mb-8">
          <TodayTasks data={tasks} loading={loading} className="col-span-2" />
          <QuickActions actions={quickActions} />
        </div>

        <div className="grid grid-cols-3 gap-6">
          <RecentReports reports={reports} className="col-span-2" />
          <RecentMessages messages={messages} />
        </div>
      </main>
    </div>
  );
};

export default EmployeeDashboard;
