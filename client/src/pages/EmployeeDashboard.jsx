import React, { useEffect, useState } from "react";
import axios from "axios";
import { Bell } from "lucide-react";
import { Link } from "react-router-dom";

import SummaryCards from "../components/dashboard/SummaryCards";
import TodayTasks from "../components/dashboard/TodayTasks";
import RecentReports from "../components/dashboard/RecentReports";
import RecentMessages from "../components/dashboard/RecentMessages";
import Sidebar from "../components/dashboard/Sidebar";

const EmployeeDashboard = ({ onLogout }) => {
  const [collapsed, setCollapsed] = useState(false);
  const [tasks, setTasks] = useState([]);
  const [loading, setLoading] = useState(false);
  const [currentTime, setCurrentTime] = useState(new Date());
  const [userName, setUserName] = useState("");

  const summaryData = [
    { label: "Tasks Due Today", count: 5, bg: "bg-blue-50" },
    { label: "Pending Reports", count: 2, bg: "bg-green-50" },
    { label: "Unread Messages", count: 3, bg: "bg-indigo-50" },
    { label: "Open Issues", count: 1, bg: "bg-red-50" },
  ];

  const reports = [
    { label: "Weekly Progress Report", date: "Oct 15, 2023", status: "Submitted" },
    { label: "Project Status Update", date: "Oct 14, 2023", status: "Pending" },
    { label: "Sprint Review Report", date: "Oct 13, 2023", status: "Approved" },
  ];

  const messages = [
    { name: "Sarah Johnson", msg: "Updated the project timeline", time: "2h ago", img: "https://i.pravatar.cc/40?img=1" },
    { name: "Mike Wilson", msg: "Meeting rescheduled to 3 PM", time: "4h ago", img: "https://i.pravatar.cc/40?img=2" },
    { name: "Emily Davis", msg: "New requirements document", time: "5h ago", img: "https://i.pravatar.cc/40?img=4" },
  ];

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
        console.error("Error fetching tasks", err.response?.data || err.message);
      } finally {
        setLoading(false);
      }
    };

    fetchTasks();
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

  const handleSubmitReport = () => {
    alert("Report submitted successfully!");
  };

  return (
    <div className="flex bg-gray-50 font-sans text-gray-800">
      <Sidebar onLogout={onLogout} collapsed={collapsed} setCollapsed={setCollapsed} />

      <main
        className={`flex-1 p-8 overflow-y-auto transition-all duration-300 ${
          collapsed ? "ml-20" : "ml-64"
        }`}
      >
        {/* Header */}
        <div className="flex justify-between items-center mb-8">
          {/* Left: Greeting, Date/Time */}
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
          {/* Right: Bell and Profile Avatar (vertical alignment fixed) */}
          <div className="flex items-center gap-4">
            {/* Bell is always perfectly centered and sized to match avatar */}
            <Bell className="text-gray-500 w-9 h-9 flex-shrink-0" />
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

        {/* Main layout (tasks, messages, reports) */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 mt-8">
          <div className="lg:col-span-2">
            <TodayTasks data={tasks} loading={loading} />
          </div>
          <div className="flex flex-col gap-6">
            <RecentMessages messages={messages} />
            <RecentReports reports={reports} onSubmit={handleSubmitReport} />
          </div>
        </div>
      </main>
    </div>
  );
};

export default EmployeeDashboard;
