import React, { useState, useEffect } from "react";
import Sidebar from "../components/dashboard/Sidebar"; // our dynamic sidebar
import StatsCard from "../components/admintask/StatsCard";
import TaskForm from "../components/admintask/TaskForm";
import TaskTable from "../components/admintask/TaskTable";
import tapveraLogo from "../assets/tapvera.png";
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
    if (!editedTask || !editedTask.title?.trim() || !editedTask.assignedTo)
      return;
    onSave(editedTask);
  };

  const dueDateValue =
    editedTask?.dueDate && typeof editedTask.dueDate === "string"
      ? editedTask.dueDate.slice(0, 10)
      : editedTask?.dueDate || "";

  return (
    <div className="fixed inset-0 flex items-center justify-center z-50 bg-black/30">
      <form
        onSubmit={handleSubmit}
        className="bg-gradient-to-br from-yellow-50 via-orange-50 to-yellow-100 rounded-2xl shadow-2xl border border-yellow-200 p-6 w-full max-w-md space-y-5"
      >
        <h2 className="text-lg font-bold text-orange-600">✏️ Edit Task</h2>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {/* Title */}
          <div>
            <label className="block text-sm font-semibold text-orange-600 mb-1">
              Task Title
            </label>
            <input
              type="text"
              className="border border-yellow-200 rounded-lg p-2 w-full text-sm"
              value={editedTask.title || ""}
              onChange={(e) => handleChange("title", e.target.value)}
              required
            />
          </div>

          {/* Assign To */}
          <div>
            <label className="block text-sm font-semibold text-orange-600 mb-1">
              Assign To
            </label>
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

          {/* Due Date */}
          <div>
            <label className="block text-sm font-semibold text-orange-600 mb-1">
              Due Date
            </label>
            <input
              type="date"
              className="border border-yellow-200 rounded-lg p-2 w-full text-sm"
              value={dueDateValue}
              onChange={(e) => handleChange("dueDate", e.target.value)}
              required
            />
          </div>

          {/* Priority */}
          <div>
            <label className="block text-sm font-semibold text-orange-600 mb-1">
              Priority
            </label>
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

        {/* Description */}
        <div>
          <label className="block text-sm font-semibold text-orange-600 mb-1">
            Description
          </label>
          <textarea
            className="border border-yellow-200 rounded-lg p-2 w-full text-sm"
            rows={3}
            value={editedTask.description || ""}
            onChange={(e) => handleChange("description", e.target.value)}
          />
        </div>

        {/* Status */}
        <div>
          <label className="block text-sm font-semibold text-orange-600 mb-1">
            Status
          </label>
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

        {/* Buttons */}
        <div className="flex justify-end gap-2 pt-2">
          <button
            type="button"
            onClick={onCancel}
            className="px-4 py-2 bg-gray-300 hover:bg-gray-400 rounded"
          >
            Cancel
          </button>
          <button
            type="submit"
            className="px-4 py-2 bg-orange-500 text-white rounded hover:bg-orange-600"
          >
            Save
          </button>
        </div>
      </form>
    </div>
  );
};

const AdminTaskPage = () => {
  const [tasks, setTasks] = useState([]);
  const [users, setUsers] = useState([]);
  const [popupMessage, setPopupMessage] = useState("");
  const [selectedTask, setSelectedTask] = useState(null);
  const [editingTask, setEditingTask] = useState(null);
  const [collapsed, setCollapsed] = useState(false);

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

  const handleViewTask = (task) => setSelectedTask(task);
  const handleEditTask = (task) => setEditingTask(task);
  const closeModal = () => setSelectedTask(null);
  const closeEditModal = () => setEditingTask(null);
  const countByStatus = (status) => tasks.filter((t) => t.status === status).length;

  return (
    <div className="flex">
      {/* Sidebar for admin role */}
      <Sidebar
        userRole="admin"
        onLogout={() => console.log("Logging out...")}
        collapsed={collapsed}
        setCollapsed={setCollapsed}
      />

      <div className={`flex-1 min-h-screen bg-gray-50 p-6 space-y-6 ${collapsed ? "ml-20" : "ml-64"} transition-all`}>
        {popupMessage && (
          <div className="fixed top-6 right-6 bg-green-500 text-white px-4 py-2 rounded shadow-lg z-50">
            {popupMessage}
          </div>
        )}

        {/* View Task Modal */}
        {selectedTask && (
          <div className="fixed inset-0 flex items-center justify-center z-50">
            <div className="relative max-w-md w-full bg-gradient-to-br from-yellow-50 via-orange-100 to-yellow-100 bg-opacity-60 backdrop-blur-xl border border-yellow-200 border-opacity-50 rounded-3xl shadow-2xl flex flex-col items-center pt-9 pb-7 px-8 text-gray-900">
              <div className="absolute -top-7 left-1/2 -translate-x-1/2 bg-white/70 border border-yellow-300 shadow rounded-full p-1.5">
                <img src={tapveraLogo} alt="Tapvera Logo" className="h-12 w-12 object-contain" />
              </div>
              <h2 className="font-bold text-xl md:text-2xl text-orange-600 mb-2 mt-2 text-center">
                {selectedTask.title}
              </h2>
              <p className="mb-4 text-base md:text-lg text-gray-700 text-center whitespace-pre-line font-medium">
                {selectedTask.description}
              </p>
              <div className="grid grid-cols-2 gap-4 text-sm mb-5 w-full">
                <div>
                  <span className="font-semibold text-orange-700">Assigned to:</span>
                  <span className="block">
                    {selectedTask.assignedTo && typeof selectedTask.assignedTo === "object"
                      ? selectedTask.assignedTo.name
                      : selectedTask.assignedTo}
                  </span>
                </div>
                <div>
                  <span className="font-semibold text-orange-700">Due Date:</span>
                  <span className="block">
                    {selectedTask.dueDate?.slice ? selectedTask.dueDate.slice(0, 10) : selectedTask.dueDate}
                  </span>
                </div>
                <div>
                  <span className="font-semibold text-orange-700">Priority:</span>
                  <span className="block">{selectedTask.priority}</span>
                </div>
                <div>
                  <span className="font-semibold text-orange-700">Status:</span>
                  <span className="block">{selectedTask.status}</span>
                </div>
              </div>
              <button
                onClick={closeModal}
                className="mt-2 px-5 py-2 rounded-lg font-semibold bg-white bg-opacity-90 text-orange-500 hover:bg-yellow-100 border border-yellow-100 shadow"
              >
                Close
              </button>
            </div>
          </div>
        )}

        {/* Edit Modal */}
        {editingTask && (
          <EditTaskModal
            task={editingTask}
            onSave={handleUpdateTask}
            onCancel={closeEditModal}
            users={users}
          />
        )}

        {/* Logo */}
        <div className="flex flex-col items-center mb-4">
          <img src={tapveraLogo} alt="Tapvera Logo" className="h-16 w-auto mb-2 drop-shadow-md" />
        </div>

        {/* Stats */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
          <StatsCard title="Total Tasks" value={tasks.length} colorScheme="blue" />
          <StatsCard title="Pending Tasks" value={countByStatus("Pending")} colorScheme="yellow" />
          <StatsCard title="Completed Tasks" value={countByStatus("Completed")} colorScheme="green" />
          <StatsCard title="Overdue Tasks" value={countByStatus("Overdue")} colorScheme="pink" />
        </div>

        {/* Task Form */}
        <TaskForm onCreate={handleCreateTask} users={users} />

        {/* Task Table */}
        <TaskTable
          tasks={tasks}
          onViewTask={handleViewTask}
          onEditTask={handleEditTask}
          onDeleteTask={handleDeleteTask}
        />
      </div>
    </div>
  );
};

export default AdminTaskPage;
