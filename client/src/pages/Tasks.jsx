import React, { useState, useEffect, useRef } from "react";
import axios from "axios";
import { io } from "socket.io-client";
import Sidebar from "../components/dashboard/Sidebar";
import TaskStats from "../components/task/TaskStats";
import TaskList from "../components/task/TaskList";
import SubmitRequirement from "../components/task/SubmitRequirement";
import MessagesPanel from "../components/task/MessagePanel";

// ✅ Use Vite env syntax
const API_BASE = import.meta.env.VITE_API_URL || "http://localhost:5000";

const Tasks = () => {
  const [collapsed, setCollapsed] = useState(false);
  const [tasks, setTasks] = useState([]);
  const [messages, setMessages] = useState([
    { sender: "other", text: "Hi! How's the project going?" },
    { sender: "me", text: "Going well! Will share the update soon." },
  ]);

  const socketRef = useRef(null);

  // Fetch tasks from API
  const fetchTasks = async () => {
    try {
      const storedToken = localStorage.getItem("token");
      if (!storedToken) {
        console.error("No token found in localStorage");
        return;
      }

      // If stored token is a JSON object, parse it
      const token =
        storedToken.startsWith("{") && storedToken.endsWith("}")
          ? JSON.parse(storedToken).token
          : storedToken;

      const config = {
        headers: {
          Authorization: `Bearer ${token}`,
        },
      };

      const res = await axios.get(`${API_BASE}/api/tasks`, config);

      const formattedTasks = res.data.map((task) => ({
        id: task._id,
        title: task.title,
        time: task.dueDate
          ? new Date(task.dueDate).toLocaleTimeString([], {
              hour: "2-digit",
              minute: "2-digit",
            })
          : "",
        description: task.description,
        priority: task.priority,
        status: task.status,
        assignedTo: task.assignedTo?.name || "",
        assignedBy: task.assignedBy?.name || "",
      }));

      setTasks(formattedTasks);
    } catch (err) {
      console.error(
        "Error fetching tasks:",
        err.response?.data || err.message
      );
    }
  };

  // Connect Socket.IO once
  useEffect(() => {
    const socket = io(API_BASE, {
      transports: ["websocket"],
      withCredentials: true,
    });
    socketRef.current = socket;

    socket.on("connect", () => {
      console.log("✅ Connected to Socket.IO:", socket.id);
    });

    // Handle task created
    socket.on("taskCreated", (task) => {
      console.log("📢 taskCreated:", task);
      setTasks((prev) => [
        {
          id: task._id,
          title: task.title,
          time: task.dueDate
            ? new Date(task.dueDate).toLocaleTimeString([], {
                hour: "2-digit",
                minute: "2-digit",
              })
            : "",
          description: task.description,
          priority: task.priority,
          status: task.status,
          assignedTo: task.assignedTo?.name || "",
          assignedBy: task.assignedBy?.name || "",
        },
        ...prev,
      ]);
    });

    // Handle task updated
    socket.on("taskUpdated", (task) => {
      console.log("🔄 taskUpdated:", task);
      setTasks((prev) =>
        prev.map((t) =>
          t.id === task._id
            ? {
                id: task._id,
                title: task.title,
                time: task.dueDate
                  ? new Date(task.dueDate).toLocaleTimeString([], {
                      hour: "2-digit",
                      minute: "2-digit",
                    })
                  : "",
                description: task.description,
                priority: task.priority,
                status: task.status,
                assignedTo: task.assignedTo?.name || "",
                assignedBy: task.assignedBy?.name || "",
              }
            : t
        )
      );
    });

    // Handle task deleted
    socket.on("taskDeleted", (taskId) => {
      console.log("🗑️ taskDeleted:", taskId);
      setTasks((prev) => prev.filter((t) => t.id !== taskId));
    });

    return () => {
      socket.off("taskCreated");
      socket.off("taskUpdated");
      socket.off("taskDeleted");
      socket.disconnect();
      socketRef.current = null;
    };
  }, []);

  // Initial API fetch
  useEffect(() => {
    fetchTasks();
  }, []);

  const handleStatusChange = (taskId, newStatus) => {
    setTasks((prev) =>
      prev.map((t) => (t.id === taskId ? { ...t, status: newStatus } : t))
    );
  };

  const handleSubmitRequirement = (requirementData) => {
    console.log("Requirement submitted:", requirementData);
  };

  const handleSendMessage = (messageText) => {
    if (!messageText.trim()) return;
    setMessages((prev) => [...prev, { sender: "me", text: messageText }]);
  };

  return (
    <div className="flex bg-gray-50 min-h-screen">
      <Sidebar
        collapsed={collapsed}
        setCollapsed={setCollapsed}
        onLogout={() => console.log("Logout clicked")}
      />

      <div
        className={`flex-1 transition-all duration-300 ${
          collapsed ? "ml-20" : "ml-64"
        } p-6`}
      >
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Left Side - Tasks */}
          <div className="lg:col-span-2">
            <TaskStats totalTasks={tasks.length} />
            <TaskList tasks={tasks} onStatusChange={handleStatusChange} />
          </div>

          {/* Right Side - Requirement Form & Messages */}
          <div className="space-y-6 self-start sticky top-6">
            <SubmitRequirement onSubmit={handleSubmitRequirement} />
            <MessagesPanel
              messages={messages}
              onSendMessage={handleSendMessage}
            />
          </div>
        </div>
      </div>
    </div>
  );
};

export default Tasks;
