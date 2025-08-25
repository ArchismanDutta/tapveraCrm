// src/pages/AdminTaskPage.jsx
import React, { useState, useEffect, useRef } from "react";
import StatsCard from "../components/admintask/StatsCard";
import TaskForm from "../components/admintask/TaskForm";
import TaskTable from "../components/admintask/TaskTable";
import tapveraLogo from "../assets/tapvera.png";
import Sidebar from "../components/dashboard/Sidebar";
import API from "../api";
import dayjs from "dayjs";
import { useNavigate } from "react-router-dom";

const EditTaskModal = ({ task, onSave, onCancel, users }) => {
  const [editedTask, setEditedTask] = useState(task || {});
  useEffect(() => setEditedTask(task ? { ...task } : {}), [task]);

  const handleChange = (field, value) => {
    setEditedTask((prev) => ({
      ...prev,
      [field]: value,
      ...(field === "assignedTo"
        ? { assignedAvatar: `https://i.pravatar.cc/40?u=${value}` }
        : {}),
    }));
  };

  const handleSubmit = (e) => {
    e.preventDefault();
    const payload = {
      ...editedTask,
      assignedTo: Array.isArray(editedTask.assignedTo)
        ? editedTask.assignedTo
        : editedTask.assignedTo
        ? [editedTask.assignedTo]
        : [],
    };
    if (!payload.title?.trim() || payload.assignedTo.length === 0) return;
    onSave(payload);
  };

  const dueDateValue =
    typeof editedTask.dueDate === "string"
      ? editedTask.dueDate.slice(0, 10)
      : editedTask?.dueDate
      ? dayjs(editedTask.dueDate).format("YYYY-MM-DD")
      : "";

  return (
    <div className="fixed inset-0 flex items-center justify-center z-50 bg-black/40 backdrop-blur-sm">
      <form
        onSubmit={handleSubmit}
        className="bg-white rounded-2xl shadow-2xl border border-gray-200 p-6 w-full max-w-md space-y-5 animate-fadeIn"
      >
        <h2 className="text-lg font-bold text-orange-600 flex items-center gap-2">
          ✏️ Edit Task
        </h2>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div>
            <label className="block text-sm font-semibold text-gray-700 mb-1">
              Task Title
            </label>
            <input
              type="text"
              className="border border-gray-300 rounded-lg p-2 w-full text-sm focus:ring-2 focus:ring-orange-400"
              value={editedTask.title || ""}
              onChange={(e) => handleChange("title", e.target.value)}
              required
            />
          </div>

          <div>
            <label className="block text-sm font-semibold text-gray-700 mb-1">
              Assign To
            </label>
            <select
              className="border border-gray-300 rounded-lg p-2 w-full text-sm bg-white focus:ring-2 focus:ring-orange-400"
              value={
                Array.isArray(editedTask.assignedTo)
                  ? editedTask.assignedTo[0]?._id || editedTask.assignedTo[0] || ""
                  : editedTask.assignedTo?._id || editedTask.assignedTo || ""
              }
              onChange={(e) => handleChange("assignedTo", e.target.value)}
              required
            >
              <option value="">Select employee</option>
              {users.map((user) => (
                <option key={user._id} value={user._id}>
                  {user.name}
                </option>
              ))}
            </select>
          </div>

          <div>
            <label className="block text-sm font-semibold text-gray-700 mb-1">
              Due Date
            </label>
            <input
              type="date"
              className="border border-gray-300 rounded-lg p-2 w-full text-sm focus:ring-2 focus:ring-orange-400"
              value={dueDateValue}
              onChange={(e) => handleChange("dueDate", e.target.value)}
              required
            />
          </div>

          <div>
            <label className="block text-sm font-semibold text-gray-700 mb-1">
              Priority
            </label>
            <select
              className="border border-gray-300 rounded-lg p-2 w-full text-sm bg-white focus:ring-2 focus:ring-orange-400"
              value={editedTask.priority || ""}
              onChange={(e) => handleChange("priority", e.target.value)}
              required
            >
              <option value="">Select priority</option>
              <option value="Low">Low</option>
              <option value="Medium">Medium</option>
              <option value="High">High</option>
            </select>
          </div>
        </div>

        <div>
          <label className="block text-sm font-semibold text-gray-700 mb-1">
            Description
          </label>
          <textarea
            className="border border-gray-300 rounded-lg p-2 w-full text-sm focus:ring-2 focus:ring-orange-400"
            rows={3}
            value={editedTask.description || ""}
            onChange={(e) => handleChange("description", e.target.value)}
          />
        </div>

        <div>
          <label className="block text-sm font-semibold text-gray-700 mb-1">
            Status
          </label>
          <select
            className="border border-gray-300 rounded-lg p-2 w-full text-sm bg-white focus:ring-2 focus:ring-orange-400"
            value={editedTask.status || "pending"}
            onChange={(e) => handleChange("status", e.target.value)}
            required
          >
            <option value="pending">Pending</option>
            <option value="in-progress">In Progress</option>
            <option value="completed">Completed</option>
          </select>
        </div>

        <div className="flex justify-end gap-2 pt-2">
          <button
            type="button"
            onClick={onCancel}
            className="px-4 py-2 bg-gray-200 hover:bg-gray-300 rounded-lg text-gray-700"
          >
            Cancel
          </button>
          <button
            type="submit"
            className="px-4 py-2 bg-orange-500 text-white rounded-lg hover:bg-orange-600"
          >
            Save
          </button>
        </div>
      </form>
    </div>
  );
};

export default function AdminTaskPage({ onLogout }) {
  const [collapsed, setCollapsed] = useState(false);
  const [tasks, setTasks] = useState([]);
  const [users, setUsers] = useState([]);
  const [popupMessage, setPopupMessage] = useState("");
  const [selectedTask, setSelectedTask] = useState(null);
  const [editingTask, setEditingTask] = useState(null);
  const [filterType, setFilterType] = useState("all");

  const navigate = useNavigate();
  const tableRef = useRef(null);

  const showPopup = (message) => {
    setPopupMessage(message);
    setTimeout(() => setPopupMessage(""), 3000);
  };

  // ✅ FIXED fetchTasks
  const fetchTasks = async () => {
    const token = localStorage.getItem("token");
    if (!token) {
      navigate("/login", { replace: true });
      return;
    }
    try {
      const res = await API.get("/tasks", {
        headers: { Authorization: `Bearer ${token}` },
      });
      const tasksArray = Array.isArray(res.data) ? res.data : [];
      tasksArray.sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));
      setTasks(tasksArray);
    } catch (err) {
      console.error("fetchTasks error:", err);
      showPopup("❌ Failed to fetch tasks");
    }
  };

  const fetchUsers = async () => {
    const token = localStorage.getItem("token");
    if (!token) return;
    try {
      const res = await API.get("/users", {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (Array.isArray(res.data)) setUsers(res.data);
      else if (Array.isArray(res.data?.data)) setUsers(res.data.data);
      else setUsers([]);
    } catch (err) {
      console.error("fetchUsers error:", err);
      showPopup("❌ Failed to fetch users");
    }
  };

  const fetchUser = async () => {
    const token = localStorage.getItem("token");
    if (!token) {
      navigate("/login", { replace: true });
      return;
    }
    try {
      const res = await API.get("/users/me", {
        headers: { Authorization: `Bearer ${token}` },
      });
      setUserName(res.data?.name || "Admin");
    } catch (err) {
      console.error("Error fetching user:", err.message);
    }
  };

  useEffect(() => {
    fetchTasks();
    fetchUsers();
    fetchUser();
  }, []);

  const ensureAssignedArray = (obj) => {
    if (!obj) return obj;
    const assigned = obj.assignedTo;
    return {
      ...obj,
      assignedTo: Array.isArray(assigned)
        ? assigned
        : assigned
        ? [assigned]
        : [],
    };
  };

  const handleCreateTask = async (newTask) => {
    try {
      const payload = ensureAssignedArray(newTask);
      const res = await API.post("/tasks", payload);
      setTasks((prev) => [res.data, ...prev]);
      showPopup("✅ Task created successfully!");
    } catch (err) {
      console.error("createTask error:", err);
      showPopup("❌ Failed to create task");
    }
  };

  const handleUpdateTask = async (updatedTask) => {
    try {
      const payload = ensureAssignedArray(updatedTask);
      const id = payload._id || payload.id;
      const res = await API.put(`/tasks/${id}`, payload);
      setTasks((prev) =>
        prev.map((t) => ((t._id || t.id) === id ? res.data : t))
      );
      setEditingTask(null);
      showPopup("✅ Task updated successfully!");
    } catch (err) {
      console.error("updateTask error:", err);
      showPopup("❌ Failed to update task");
    }
  };

  const handleDeleteTask = async (id) => {
    try {
      await API.delete(`/tasks/${id}`);
      setTasks((prev) => prev.filter((task) => (task._id || task.id) !== id));
      showPopup("🗑 Task deleted successfully!");
    } catch (err) {
      console.error("deleteTask error:", err);
      showPopup("❌ Failed to delete task");
    }
  };

  const today = dayjs().startOf("day");
  const currentUserId = JSON.parse(localStorage.getItem("user"))?.id;

  const filteredTasks = tasks.filter((t) => {
    switch (filterType) {
      case "assignedByMe":
        return t.assignedBy?._id === currentUserId;
      case "dueToday":
        return t.dueDate && dayjs(t.dueDate).isSame(today, "day");
      case "overdue":
        return (
          t.dueDate &&
          dayjs(t.dueDate).isBefore(today, "day") &&
          (t.status || "").toLowerCase() !== "completed"
        );
      default:
        return true;
    }
  });

  const totalTasks = tasks.length;
  const assignedByMeCount = tasks.filter(
    (t) => t.assignedBy?._id === currentUserId
  ).length;
  const tasksDueTodayCount = tasks.filter(
    (t) => t.dueDate && dayjs(t.dueDate).isSame(today, "day")
  ).length;
  const overdueTasksCount = tasks.filter(
    (t) =>
      t.dueDate &&
      dayjs(t.dueDate).isBefore(today, "day") &&
      (t.status || "").toLowerCase() !== "completed"
  ).length;

  const [currentTime, setCurrentTime] = useState(new Date());
  const [userName, setUserName] = useState("");

  useEffect(() => {
    const interval = setInterval(() => setCurrentTime(new Date()), 1000);
    return () => clearInterval(interval);
  }, []);

  const handleFilterAndScroll = (type) => {
    setFilterType(type);
    setTimeout(() => {
      tableRef.current?.scrollIntoView({ behavior: "smooth" });
    }, 100);
  };

  return (
    <div className="flex">
      <Sidebar
        collapsed={collapsed}
        setCollapsed={setCollapsed}
        userRole="admin"
        onLogout={onLogout}
      />
      <main
        className={`flex-1 transition-all duration-300 ${
          collapsed ? "ml-20" : "ml-64"
        } p-8 bg-gradient-to-br from-gray-50 to-gray-100 min-h-screen`}
      >
        {popupMessage && (
          <div className="fixed top-6 right-6 bg-gray-900 text-white px-4 py-2 rounded-lg shadow-lg z-50 animate-slideIn">
            {popupMessage}
          </div>
        )}

        {/* Greeting */}
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
        </div>

        {/* Stats */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6 mb-8">
          <StatsCard
            title="Total Tasks"
            value={totalTasks}
            colorScheme="blue"
            onClick={() => handleFilterAndScroll("all")}
          />
          <StatsCard
            title="Assigned by Me"
            value={assignedByMeCount}
            colorScheme="yellow"
            onClick={() => handleFilterAndScroll("assignedByMe")}
          />
          <StatsCard
            title="Tasks Due Today"
            value={tasksDueTodayCount}
            colorScheme="green"
            onClick={() => handleFilterAndScroll("dueToday")}
          />
          <StatsCard
            title="Overdue Tasks"
            value={overdueTasksCount}
            colorScheme="pink"
            onClick={() => handleFilterAndScroll("overdue")}
          />
        </div>

        {/* Task Form */}
        <section className="bg-white rounded-xl shadow-md p-6 mb-8">
          <h2 className="text-lg font-semibold text-gray-700 mb-4">
            Create New Task
          </h2>
          <TaskForm onCreate={handleCreateTask} users={users} />
        </section>

        {/* Task Table */}
        <section ref={tableRef} className="bg-white rounded-xl shadow-md p-6">
          <h2 className="text-lg font-semibold text-gray-700 mb-4">
            📋 Task List
          </h2>
          <TaskTable
            tasks={filteredTasks}
            onViewTask={setSelectedTask}
            onEditTask={setEditingTask}
            onDeleteTask={handleDeleteTask}
          />
        </section>

        {/* View Task Modal */}
        {selectedTask && (
          <div className="fixed inset-0 flex items-center justify-center z-50 bg-black/40 backdrop-blur-sm">
            <div className="relative max-w-md w-full bg-white rounded-3xl shadow-2xl flex flex-col items-center pt-9 pb-7 px-8 text-gray-900">
              <img src={tapveraLogo} alt="Tapvera" className="h-12 w-12 mb-4" />
              <h2 className="font-bold text-xl text-orange-600 mb-2">
                {selectedTask.title}
              </h2>
              <p className="mb-4 text-center text-gray-600">
                {selectedTask.description}
              </p>
              <button
                onClick={() => setSelectedTask(null)}
                className="mt-2 px-5 py-2 rounded-lg bg-orange-500 text-white hover:bg-orange-600"
              >
                Close
              </button>
            </div>
          </div>
        )}

        {editingTask && (
          <EditTaskModal
            task={editingTask}
            onSave={handleUpdateTask}
            onCancel={() => setEditingTask(null)}
            users={users}
          />
        )}
      </main>
    </div>
  );
}
