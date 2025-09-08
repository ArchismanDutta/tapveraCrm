import React, { useState, useEffect } from "react";
import axios from "axios";
import Sidebar from "../components/dashboard/Sidebar";
import TaskStats from "../components/task/TaskStats";
import TaskList from "../components/task/TaskList";
import SubmitRequirement from "../components/task/SubmitRequirement";

const API_BASE = import.meta.env.VITE_API_BASE || "http://localhost:5000";

const Tasks = ({ onLogout }) => {
  const [collapsed, setCollapsed] = useState(false);
  const [tasks, setTasks] = useState([]);
  const [loading, setLoading] = useState(false);

  // Helper: Get token from localStorage
  const getToken = () => {
    const storedToken = localStorage.getItem("token");
    if (!storedToken) return null;
    return storedToken.startsWith("{") && storedToken.endsWith("}")
      ? JSON.parse(storedToken).token
      : storedToken;
  };

  // Fetch tasks from API
  const fetchTasks = async () => {
    try {
      setLoading(true);
      const token = getToken();
      if (!token) return;

      const config = { headers: { Authorization: `Bearer ${token}` } };
      const res = await axios.get(`${API_BASE}/api/tasks`, config);

      // Format and sort newest tasks first
      const formattedTasks = res.data
        .map((task) => ({
          _id: task._id,
          title: task.title,
          dueDate: task.dueDate,
          description: task.description,
          priority: task.priority,
          status: task.status,
          assignedTo: Array.isArray(task.assignedTo) ? task.assignedTo : [],
          assignedBy: task.assignedBy || {},
        }))
        .sort((a, b) => new Date(b.dueDate) - new Date(a.dueDate)); // Newest first

      setTasks(formattedTasks);
      setLoading(false);
    } catch (err) {
      console.error("Error fetching tasks:", err.response?.data || err.message);
      setLoading(false);
    }
  };

  // Polling: fetch tasks on mount and every 30s
  useEffect(() => {
    fetchTasks();
    const interval = setInterval(fetchTasks, 10000); // every 30 seconds
    return () => clearInterval(interval); // cleanup on unmount
  }, []);

  // Update task status locally
  const handleStatusChange = (taskId, newStatus) => {
    setTasks((prev) =>
      prev.map((t) => (t._id === taskId ? { ...t, status: newStatus } : t))
    );
  };

  // Handle requirement form submission
  const handleSubmitRequirement = (requirementData) => {
    console.log("Requirement submitted:", requirementData);
    // TODO: Send to API if needed
  };

  return (
    <div className="flex bg-gradient-to-br from-[#141a29] via-[#181d2a] to-[#1b2233] min-h-screen text-blue-100">
      {/* Sidebar */}
      <Sidebar
        collapsed={collapsed}
        setCollapsed={setCollapsed}
        onLogout={onLogout}
      />

      {/* Main Content */}
      <div
        className={`flex-1 transition-all duration-300 ${
          collapsed ? "ml-20" : "ml-72"
        } p-6`}
      >
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Left Side - Tasks */}
          <div className="lg:col-span-2 space-y-6">
            <TaskStats totalTasks={tasks.length} loading={loading} />
            <TaskList
              tasks={tasks}
              onStatusChange={handleStatusChange}
              loading={loading}
            />
          </div>

          {/* Right Side - Requirement Form */}
          <div className="space-y-6 self-start sticky top-6">
            <SubmitRequirement onSubmit={handleSubmitRequirement} />
          </div>
        </div>
      </div>
    </div>
  );
};

export default Tasks;
