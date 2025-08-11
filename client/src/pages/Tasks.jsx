
import React, { useState, useEffect } from "react";
import axios from "axios";

// import React, { useState } from "react";
// import PropTypes from "prop-types";

import Sidebar from "../components/dashboard/Sidebar";
import TaskStats from "../components/task/TaskStats";
import TaskList from "../components/task/TaskList";
import SubmitRequirement from "../components/task/SubmitRequirement";
import MessagesPanel from "../components/task/MessagePanel";

const Tasks = ({ onLogout }) => {
  const [collapsed, setCollapsed] = useState(false);

  const [tasks, setTasks] = useState([]);
// =======

//   const [tasks, setTasks] = useState([
//     {
//       id: 1,
//       title: "Client Meeting - Project Alpha",
//       time: "10:00 AM",
//       description:
//         "Review project progress and discuss next steps with the client team.",
//       priority: "High",
//       status: "Assigned",
//     },
//     {
//       id: 2,
//       title: "Report Submission - Q3 Review",
//       time: "2:00 PM",
//       description:
//         "Complete and submit quarterly performance review report.",
//       priority: "Medium",
//       status: "Assigned",
//     },
//     {
//       id: 3,
//       title: "Team Sync",
//       time: "4:00 PM",
//       description:
//         "Weekly team sync to discuss ongoing projects and blockers.",
//       priority: "Low",
//       status: "Assigned",
//     },
//   ]);

  const [messages, setMessages] = useState([
    { sender: "other", text: "Hi! How's the project going?" },
    { sender: "me", text: "Going well! Will share the update soon." },
  ]);

  // Fetch tasks from backend
  useEffect(() => {
    const fetchTasks = async () => {
      try {
        const token = localStorage.getItem("token"); // JWT stored in localStorage

        const res = await axios.get("/api/tasks", {
          headers: {
            Authorization: `Bearer ${token}`,
          },
        });

        // Map backend response to match TaskList structure
        const formatted = res.data.map((task) => ({
          id: task._id,
          title: task.title,
          time: new Date(task.dueDate).toLocaleTimeString([], {
            hour: "2-digit",
            minute: "2-digit",
          }),
          description: task.description,
          priority: task.priority,
          status: task.status,
          assignedTo: task.assignedTo?.name || "",
          assignedBy: task.assignedBy?.name || "",
        }));

        setTasks(formatted);
      } catch (err) {
        console.error("Error fetching tasks:", err);
      }
    };

    fetchTasks();
  }, []);

  // Update task status locally (can be extended to send PATCH request)
  const handleStatusChange = (taskId, newStatus) => {
    setTasks((prev) =>
      prev.map((t) => (t.id === taskId ? { ...t, status: newStatus } : t))
    );
  };

  const handleSubmitRequirement = (requirementData) => {
    console.log("Requirement submitted:", requirementData);
    // Add API call here if you want to send this to the backend
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
        onLogout={onLogout} // ✅ Uses the real logout function from App.jsx
      />

      <div
        className={`flex-1 transition-all duration-300 ${
          collapsed ? "ml-20" : "ml-64"
        } p-6`}
      >
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Left Side - Tasks */}
          <div className="lg:col-span-2">
            <h2 className="text-xl font-semibold text-gray-800">
              Good Morning, Archishman
            </h2>
            <p className="text-sm text-gray-500 mb-6">
              {new Date().toLocaleDateString("en-US", {
                weekday: "long",
                month: "long",
                day: "numeric",
                year: "numeric",
              })}{" "}
              •{" "}
              {new Date().toLocaleTimeString([], {
                hour: "2-digit",
                minute: "2-digit",
              })}
            </p>

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

Tasks.propTypes = {
  onLogout: PropTypes.func.isRequired,
};

export default Tasks;
