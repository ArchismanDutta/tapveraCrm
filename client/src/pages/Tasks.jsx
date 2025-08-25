import React, { useState, useEffect } from "react";
import axios from "axios";
import Sidebar from "../components/dashboard/Sidebar";
import TaskStats from "../components/task/TaskStats";
import TaskList from "../components/task/TaskList";
import SubmitRequirement from "../components/task/SubmitRequirement";

// ✅ Use Vite env syntax
const API_BASE = import.meta.env.VITE_API_URL || "http://localhost:5000";

const Tasks = ({ onLogout }) => {
  const [collapsed, setCollapsed] = useState(false);
  const [tasks, setTasks] = useState([]);

  // Fetch tasks from API
  const fetchTasks = async () => {
    try {
      const storedToken = localStorage.getItem("token");
      if (!storedToken) return;

      const token =
        storedToken.startsWith("{") && storedToken.endsWith("}")
          ? JSON.parse(storedToken).token
          : storedToken;

      const config = { headers: { Authorization: `Bearer ${token}` } };
      const res = await axios.get(`${API_BASE}/api/tasks`, config);

      const formattedTasks = res.data.map((task) => ({
        _id: task._id,
        title: task.title,
        dueDate: task.dueDate,
        description: task.description,
        priority: task.priority,
        status: task.status,
        assignedTo: task.assignedTo,
        assignedBy: task.assignedBy,
      }));

      setTasks(formattedTasks);
    } catch (err) {
      console.error("Error fetching tasks:", err.response?.data || err.message);
    }
  };

  // Polling every 60 seconds
  useEffect(() => {
    fetchTasks(); // initial fetch
    const interval = setInterval(fetchTasks, 30000); // poll every 60s
    return () => clearInterval(interval);
  }, []);

  const handleStatusChange = (taskId, newStatus) => {
    setTasks((prev) =>
      prev.map((t) => (t._id === taskId ? { ...t, status: newStatus } : t))
    );
  };

  const handleSubmitRequirement = (requirementData) => {
    console.log("Requirement submitted:", requirementData);
  };

  return (
    <div className="flex bg-gray-50 min-h-screen">
      <Sidebar collapsed={collapsed} setCollapsed={setCollapsed} onLogout={onLogout} />

      <div className={`flex-1 transition-all duration-300 ${collapsed ? "ml-20" : "ml-64"} p-6`}>
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Left Side - Tasks */}
          <div className="lg:col-span-2">
            <TaskStats totalTasks={tasks.length} />
            <TaskList tasks={tasks} onStatusChange={handleStatusChange} />
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
