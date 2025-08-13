// src/pages/AdminTaskPage.jsx
import React, { useState, useEffect } from "react";
import StatsCard from "../components/admintask/StatsCard";
import TaskForm from "../components/admintask/TaskForm";
import TaskTable from "../components/admintask/TaskTable";
import tapveraLogo from "../assets/tapvera.png";
import Sidebar from "../components/dashboard/Sidebar";
import API from "../api";

const EditTaskModal = ({ task, onSave, onCancel, users }) => {
  const [editedTask, setEditedTask] = useState(task || {});

  useEffect(() => {
    setEditedTask(task ? { ...task } : {});
  }, [task]);

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
    if (!editedTask.title?.trim() || !editedTask.assignedTo) return;
    onSave(editedTask);
  };

  const dueDateValue =
    typeof editedTask.dueDate === "string"
      ? editedTask.dueDate.slice(0, 10)
      : editedTask?.dueDate || "";

  return (
    <div className="fixed inset-0 flex items-center justify-center z-50 bg-black/30">
      <form
        onSubmit={handleSubmit}
        className="bg-gradient-to-br from-yellow-50 via-orange-50 to-yellow-100 rounded-2xl shadow-2xl border border-yellow-200 p-6 w-full max-w-md space-y-5"
      >
        <h2 className="text-lg font-bold text-orange-600">✏️ Edit Task</h2>

        {/* Fields */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div>
            <label className="block text-sm font-semibold text-orange-600 mb-1">Task Title</label>
            <input
              type="text"
              className="border border-yellow-200 rounded-lg p-2 w-full text-sm"
              value={editedTask.title || ""}
              onChange={(e) => handleChange("title", e.target.value)}
              required
            />
          </div>
          <div>
            <label className="block text-sm font-semibold text-orange-600 mb-1">Assign To</label>
            <select
              className="border border-yellow-200 rounded-lg p-2 w-full text-sm bg-white"
              value={editedTask.assignedTo || ""}
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
            <label className="block text-sm font-semibold text-orange-600 mb-1">Due Date</label>
            <input
              type="date"
              className="border border-yellow-200 rounded-lg p-2 w-full text-sm"
              value={dueDateValue}
              onChange={(e) => handleChange("dueDate", e.target.value)}
              required
            />
          </div>
          <div>
            <label className="block text-sm font-semibold text-orange-600 mb-1">Priority</label>
            <select
              className="border border-yellow-200 rounded-lg p-2 w-full text-sm bg-white"
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
          <label className="block text-sm font-semibold text-orange-600 mb-1">Description</label>
          <textarea
            className="border border-yellow-200 rounded-lg p-2 w-full text-sm"
            rows={3}
            value={editedTask.description || ""}
            onChange={(e) => handleChange("description", e.target.value)}
          />
        </div>
        <div>
          <label className="block text-sm font-semibold text-orange-600 mb-1">Status</label>
          <select
            className="border border-yellow-200 rounded-lg p-2 w-full text-sm bg-white"
            value={editedTask.status || "Pending"}
            onChange={(e) => handleChange("status", e.target.value)}
            required
          >
            <option value="Pending">Pending</option>
            <option value="Completed">Completed</option>
            <option value="Overdue">Overdue</option>
          </select>
        </div>
        <div className="flex justify-end gap-2 pt-2">
          <button type="button" onClick={onCancel} className="px-4 py-2 bg-gray-300 hover:bg-gray-400 rounded">
            Cancel
          </button>
          <button type="submit" className="px-4 py-2 bg-orange-500 text-white rounded hover:bg-orange-600">
            Save
          </button>
        </div>
      </form>
    </div>
  );
};

export default function AdminTaskPage() {
  const [collapsed, setCollapsed] = useState(false); // For sidebar
  const [tasks, setTasks] = useState([]);
  const [users, setUsers] = useState([]);
  const [popupMessage, setPopupMessage] = useState("");
  const [selectedTask, setSelectedTask] = useState(null);
  const [editingTask, setEditingTask] = useState(null);

  const showPopup = (message) => {
    setPopupMessage(message);
    setTimeout(() => setPopupMessage(""), 3000);
  };

  const fetchTasks = async () => {
    try {
      const res = await API.get("/tasks");
      const payload = res?.data?.data ?? res?.data;
      setTasks(Array.isArray(payload) ? payload : []);
    } catch (err) {
      console.error("fetchTasks error:", err);
      showPopup("❌ Failed to fetch tasks");
    }
  };

  const fetchUsers = async () => {
    try {
      const res = await API.get("/users");
      if (Array.isArray(res.data)) setUsers(res.data);
    } catch (err) {
      console.error("fetchUsers error:", err);
      showPopup("❌ Failed to fetch users");
    }
  };

  useEffect(() => {
    fetchTasks();
    fetchUsers();
  }, []);

  const handleCreateTask = async (newTask) => {
    try {
      const res = await API.post("/tasks", newTask);
      setTasks((prev) => [res.data, ...prev]);
      showPopup("✅ Task created successfully!");
    } catch (err) {
      console.error("createTask error:", err);
      showPopup("❌ Failed to create task");
    }
  };

  const handleUpdateTask = async (updatedTask) => {
    try {
      const id = updatedTask._id || updatedTask.id;
      const res = await API.put(`/tasks/${id}`, updatedTask);
      setTasks((prev) => prev.map((t) => ((t._id || t.id) === id ? res.data : t)));
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

  return (
    <div className="flex">
      {/* Sidebar */}
      <Sidebar collapsed={collapsed} setCollapsed={setCollapsed} userRole="admin" />

      {/* Main content */}
      <main className={`flex-1 transition-all duration-300 ${collapsed ? "ml-20" : "ml-64"} p-6 bg-gray-50`}>
        {popupMessage && (
          <div className="fixed top-6 right-6 bg-green-500 text-white px-4 py-2 rounded shadow-lg z-50">
            {popupMessage}
          </div>
        )}

        {selectedTask && (
          <div className="fixed inset-0 flex items-center justify-center z-50">
            <div className="relative max-w-md w-full bg-gradient-to-br from-yellow-50 via-orange-100 to-yellow-100 rounded-3xl shadow-2xl flex flex-col items-center pt-9 pb-7 px-8 text-gray-900">
              <img src={tapveraLogo} alt="Tapvera" className="h-12 w-12 mb-4" />
              <h2 className="font-bold text-xl text-orange-600 mb-2">{selectedTask.title}</h2>
              <p className="mb-4">{selectedTask.description}</p>
              <button onClick={() => setSelectedTask(null)} className="mt-2 px-5 py-2 rounded-lg bg-white text-orange-500 border">
                Close
              </button>
            </div>
          </div>
        )}

        {editingTask && (
          <EditTaskModal task={editingTask} onSave={handleUpdateTask} onCancel={() => setEditingTask(null)} users={users} />
        )}

        {/* Stats */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
          <StatsCard title="Total Tasks" value={tasks.length} colorScheme="blue" />
          <StatsCard title="Pending Tasks" value={tasks.filter((t) => t.status === "Pending").length} colorScheme="yellow" />
          <StatsCard title="Completed Tasks" value={tasks.filter((t) => t.status === "Completed").length} colorScheme="green" />
          <StatsCard title="Overdue Tasks" value={tasks.filter((t) => t.status === "Overdue").length} colorScheme="pink" />
        </div>

        <TaskForm onCreate={handleCreateTask} users={users} />

        <TaskTable tasks={tasks} onViewTask={setSelectedTask} onEditTask={setEditingTask} onDeleteTask={handleDeleteTask} />
      </main>
    </div>
  );
}
