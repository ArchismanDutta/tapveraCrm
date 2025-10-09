// File: src/pages/AdminTaskPage.jsx
import React, { useState, useEffect, useRef } from "react";
import dayjs from "dayjs";
import { useNavigate } from "react-router-dom";

import Sidebar from "../components/dashboard/Sidebar";
import StatsCard from "../components/admintask/StatsCard";
import TaskForm from "../components/admintask/TaskForm";
import TaskTable from "../components/admintask/TaskTable";
import tapveraLogo from "../assets/tapvera.png";
import API from "../api";

// ----------------- Employee Task Analytics Component -----------------
const EmployeeTaskAnalytics = ({ users }) => {
  const [selectedEmployee, setSelectedEmployee] = useState("");
  const [searchTerm, setSearchTerm] = useState("");
  const [showDropdown, setShowDropdown] = useState(false);
  const [analytics, setAnalytics] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [isMouseOverDropdown, setIsMouseOverDropdown] = useState(false);

  const fetchEmployeeAnalytics = async (employeeId) => {
    if (!employeeId) return;

    setLoading(true);
    setError("");
    const token = localStorage.getItem("token");

    try {
      const res = await API.get(`/api/tasks/analytics/employee/${employeeId}`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      setAnalytics(res.data);
    } catch (err) {
      console.error("Error fetching employee analytics:", err);
      setError("Failed to fetch employee analytics");
      setAnalytics(null);
    } finally {
      setLoading(false);
    }
  };

  const handleEmployeeSelect = (user) => {
    setSelectedEmployee(user._id);
    setSearchTerm(user.name);
    setShowDropdown(false);
    fetchEmployeeAnalytics(user._id);
  };

  const handleSearchChange = (e) => {
    const value = e.target.value;
    setSearchTerm(value);
    setShowDropdown(true);

    if (!value.trim()) {
      setSelectedEmployee("");
      setAnalytics(null);
      setError("");
    }
  };

  const handleKeyDown = (e) => {
    if (e.key === 'Enter' && filteredUsers.length > 0) {
      e.preventDefault();
      handleEmployeeSelect(filteredUsers[0]);
    } else if (e.key === 'Escape') {
      setShowDropdown(false);
    }
  };

  const filteredUsers = users.filter(user =>
    user.name.toLowerCase().includes(searchTerm.toLowerCase())
  );

  const handleInputFocus = () => {
    setShowDropdown(true);
  };

  const handleInputBlur = () => {
    // Only hide dropdown if mouse is not over dropdown
    if (!isMouseOverDropdown) {
      setTimeout(() => {
        if (!isMouseOverDropdown) {
          setShowDropdown(false);
        }
      }, 300);
    }
  };

  const handleClose = () => {
    setSelectedEmployee("");
    setSearchTerm("");
    setAnalytics(null);
    setError("");
    setShowDropdown(false);
    setIsMouseOverDropdown(false);
  };

  const getStatusColor = (status) => {
    switch (status) {
      case "completed": return "text-green-400 bg-green-400/20";
      case "in-progress": return "text-blue-400 bg-blue-400/20";
      case "pending": return "text-yellow-400 bg-yellow-400/20";
      default: return "text-gray-400 bg-gray-400/20";
    }
  };

  const getPriorityColor = (priority) => {
    switch (priority?.toLowerCase()) {
      case "high": return "text-red-400 bg-red-400/20";
      case "medium": return "text-yellow-400 bg-yellow-400/20";
      case "low": return "text-green-400 bg-green-400/20";
      default: return "text-gray-400 bg-gray-400/20";
    }
  };

  return (
    <div className="space-y-6">
      {/* Employee Selection */}
      <div className="flex flex-col sm:flex-row gap-4 items-start sm:items-center">
        <label className="text-sm font-semibold text-blue-200 whitespace-nowrap">
          Search Employee:
        </label>
        <div className="relative flex-1 max-w-md">
          <input
            type="text"
            value={searchTerm}
            onChange={handleSearchChange}
            onFocus={handleInputFocus}
            onBlur={handleInputBlur}
            onKeyDown={handleKeyDown}
            placeholder="Type employee name..."
            className="bg-[#161c2c] border border-[rgba(84,123,209,0.12)] rounded-xl p-3 w-full text-blue-200 focus:ring-2 focus:ring-[#bf6f2f] outline-none"
          />

          {/* Clear button */}
          {selectedEmployee && (
            <button
              onClick={handleClose}
              className="absolute right-3 top-1/2 transform -translate-y-1/2 text-gray-400 hover:text-red-400 transition-colors"
              title="Clear selection"
            >
              <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 20 20">
                <path fillRule="evenodd" d="M4.293 4.293a1 1 0 011.414 0L10 8.586l4.293-4.293a1 1 0 111.414 1.414L11.414 10l4.293 4.293a1 1 0 01-1.414 1.414L10 11.414l-4.293 4.293a1 1 0 01-1.414-1.414L8.586 10 4.293 5.707a1 1 0 010-1.414z" clipRule="evenodd" />
              </svg>
            </button>
          )}

          {/* Dropdown */}
          {showDropdown && searchTerm && filteredUsers.length > 0 && (
            <div
              className="absolute top-full left-0 right-0 mt-1 bg-[#161c2c] border border-[rgba(84,123,209,0.12)] rounded-xl shadow-2xl max-h-60 overflow-y-auto z-50"
              onMouseEnter={() => setIsMouseOverDropdown(true)}
              onMouseLeave={() => setIsMouseOverDropdown(false)}
            >
              {filteredUsers.map((user) => (
                <div
                  key={user._id}
                  onMouseDown={(e) => {
                    e.preventDefault();
                    handleEmployeeSelect(user);
                  }}
                  onClick={() => handleEmployeeSelect(user)}
                  className="p-3 hover:bg-[rgba(84,123,209,0.1)] cursor-pointer border-b border-[rgba(84,123,209,0.06)] last:border-b-0"
                >
                  <div className="text-blue-200 font-medium">{user.name}</div>
                  <div className="text-gray-400 text-sm">{user.email}</div>
                </div>
              ))}
            </div>
          )}

          {/* No results */}
          {showDropdown && searchTerm && filteredUsers.length === 0 && (
            <div
              className="absolute top-full left-0 right-0 mt-1 bg-[#161c2c] border border-[rgba(84,123,209,0.12)] rounded-xl shadow-2xl p-3 z-50"
              onMouseEnter={() => setIsMouseOverDropdown(true)}
              onMouseLeave={() => setIsMouseOverDropdown(false)}
            >
              <div className="text-gray-400 text-sm">No employees found matching "{searchTerm}"</div>
            </div>
          )}
        </div>
      </div>

      {/* Loading State */}
      {loading && (
        <div className="flex items-center justify-center py-12">
          <div className="flex items-center space-x-3">
            <div className="w-6 h-6 border-2 border-[#bf6f2f] border-t-transparent rounded-full animate-spin"></div>
            <span className="text-blue-200">Loading analytics...</span>
          </div>
        </div>
      )}

      {/* Error State */}
      {error && (
        <div className="bg-red-500/20 border border-red-500/30 rounded-xl p-4">
          <p className="text-red-400">{error}</p>
        </div>
      )}

      {/* Analytics Display */}
      {analytics && !loading && (
        <div className="space-y-6">
          {/* Employee Info */}
          <div className="bg-[#161c2c] border border-[rgba(84,123,209,0.12)] rounded-xl p-6">
            <h3 className="text-xl font-semibold text-[#bf6f2f] mb-4">Employee Information</h3>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div>
                <p className="text-sm text-gray-400">Name</p>
                <p className="text-lg font-medium text-blue-200">{analytics.employee.name}</p>
              </div>
              <div>
                <p className="text-sm text-gray-400">Email</p>
                <p className="text-lg font-medium text-blue-200">{analytics.employee.email}</p>
              </div>
              <div>
                <p className="text-sm text-gray-400">Role</p>
                <p className="text-lg font-medium text-blue-200 capitalize">{analytics.employee.role}</p>
              </div>
            </div>
          </div>

          {/* Summary Statistics */}
          <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-8 gap-4">
            <div className="bg-[#161c2c] border border-[rgba(84,123,209,0.12)] rounded-xl p-4 text-center">
              <p className="text-2xl font-bold text-blue-400">{analytics.summary.totalTasks}</p>
              <p className="text-sm text-gray-400">Total Tasks</p>
            </div>
            <div className="bg-[#161c2c] border border-[rgba(84,123,209,0.12)] rounded-xl p-4 text-center">
              <p className="text-2xl font-bold text-green-400">{analytics.summary.completedTasks}</p>
              <p className="text-sm text-gray-400">Completed</p>
            </div>
            <div className="bg-[#161c2c] border border-[rgba(84,123,209,0.12)] rounded-xl p-4 text-center">
              <p className="text-2xl font-bold text-blue-400">{analytics.summary.inProgressTasks}</p>
              <p className="text-sm text-gray-400">In Progress</p>
            </div>
            <div className="bg-[#161c2c] border border-[rgba(84,123,209,0.12)] rounded-xl p-4 text-center">
              <p className="text-2xl font-bold text-yellow-400">{analytics.summary.pendingTasks}</p>
              <p className="text-sm text-gray-400">Pending</p>
            </div>
            <div className="bg-[#161c2c] border border-[rgba(84,123,209,0.12)] rounded-xl p-4 text-center">
              <p className="text-2xl font-bold text-red-400">{analytics.summary.overdueTasks}</p>
              <p className="text-sm text-gray-400">Overdue</p>
            </div>
            <div className="bg-[#161c2c] border border-[rgba(84,123,209,0.12)] rounded-xl p-4 text-center">
              <p className="text-2xl font-bold text-[#bf6f2f]">{analytics.summary.completionRate}%</p>
              <p className="text-sm text-gray-400">Completion Rate</p>
            </div>
            <div className="bg-[#161c2c] border border-[rgba(84,123,209,0.12)] rounded-xl p-4 text-center">
              <p className="text-2xl font-bold text-red-400">{analytics.summary.highPriorityTasks}</p>
              <p className="text-sm text-gray-400">High Priority</p>
            </div>
            <div className="bg-[#161c2c] border border-[rgba(84,123,209,0.12)] rounded-xl p-4 text-center">
              <p className="text-2xl font-bold text-yellow-400">{analytics.summary.mediumPriorityTasks}</p>
              <p className="text-sm text-gray-400">Medium Priority</p>
            </div>
          </div>

          {/* Recent Tasks */}
          {analytics.recentTasks.length > 0 && (
            <div className="bg-[#161c2c] border border-[rgba(84,123,209,0.12)] rounded-xl p-6">
              <h3 className="text-xl font-semibold text-[#bf6f2f] mb-4">Recent Tasks (Last 10)</h3>
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b border-[rgba(84,123,209,0.12)]">
                      <th className="text-left p-3 text-gray-400">Title</th>
                      <th className="text-left p-3 text-gray-400">Status</th>
                      <th className="text-left p-3 text-gray-400">Priority</th>
                      <th className="text-left p-3 text-gray-400">Due Date</th>
                      <th className="text-left p-3 text-gray-400">Assigned By</th>
                    </tr>
                  </thead>
                  <tbody>
                    {analytics.recentTasks.map((task) => (
                      <tr key={task._id} className="border-b border-[rgba(84,123,209,0.06)]">
                        <td className="p-3 text-blue-200 font-medium">{task.title}</td>
                        <td className="p-3">
                          <span className={`px-2 py-1 rounded-lg text-xs font-medium ${getStatusColor(task.status)}`}>
                            {task.status}
                          </span>
                        </td>
                        <td className="p-3">
                          <span className={`px-2 py-1 rounded-lg text-xs font-medium ${getPriorityColor(task.priority)}`}>
                            {task.priority}
                          </span>
                        </td>
                        <td className="p-3 text-gray-400">
                          {task.dueDate ? dayjs(task.dueDate).format("MMM DD, YYYY") : "No due date"}
                        </td>
                        <td className="p-3 text-gray-400">{task.assignedBy?.name || "N/A"}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {/* Tasks by Status */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {/* Overdue Tasks */}
            {analytics.tasksByStatus.overdue.length > 0 && (
              <div className="bg-[#161c2c] border border-red-500/30 rounded-xl p-6">
                <h3 className="text-lg font-semibold text-red-400 mb-4">⚠️ Overdue Tasks ({analytics.tasksByStatus.overdue.length})</h3>
                <div className="space-y-3 max-h-64 overflow-y-auto">
                  {analytics.tasksByStatus.overdue.map((task) => (
                    <div key={task._id} className="bg-red-500/10 border border-red-500/20 rounded-lg p-3">
                      <h4 className="font-medium text-red-300">{task.title}</h4>
                      <div className="flex justify-between items-center mt-2 text-sm">
                        <span className={`px-2 py-1 rounded-lg text-xs font-medium ${getPriorityColor(task.priority)}`}>
                          {task.priority}
                        </span>
                        <span className="text-red-400">{task.daysPastDue} days overdue</span>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* In Progress Tasks */}
            {analytics.tasksByStatus.inProgress.length > 0 && (
              <div className="bg-[#161c2c] border border-blue-500/30 rounded-xl p-6">
                <h3 className="text-lg font-semibold text-blue-400 mb-4">🔄 In Progress Tasks ({analytics.tasksByStatus.inProgress.length})</h3>
                <div className="space-y-3 max-h-64 overflow-y-auto">
                  {analytics.tasksByStatus.inProgress.map((task) => (
                    <div key={task._id} className="bg-blue-500/10 border border-blue-500/20 rounded-lg p-3">
                      <h4 className="font-medium text-blue-300">{task.title}</h4>
                      <div className="flex justify-between items-center mt-2 text-sm">
                        <span className={`px-2 py-1 rounded-lg text-xs font-medium ${getPriorityColor(task.priority)}`}>
                          {task.priority}
                        </span>
                        <span className="text-gray-400">
                          Due: {task.dueDate ? dayjs(task.dueDate).format("MMM DD") : "No due date"}
                        </span>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>

          {/* No Tasks Message */}
          {analytics.summary.totalTasks === 0 && (
            <div className="bg-[#161c2c] border border-[rgba(84,123,209,0.12)] rounded-xl p-8 text-center">
              <p className="text-gray-400">No tasks assigned to this employee yet.</p>
            </div>
          )}
        </div>
      )}

      {/* Initial State */}
      {!selectedEmployee && !loading && (
        <div className="bg-[#161c2c] border border-[rgba(84,123,209,0.12)] rounded-xl p-8 text-center">
          <p className="text-gray-400">Select an employee to view their task analytics.</p>
        </div>
      )}
    </div>
  );
};

// ----------------- Edit Task Modal -----------------
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
    editedTask?.dueDate && typeof editedTask.dueDate === "string"
      ? editedTask.dueDate.slice(0, 10)
      : editedTask?.dueDate
      ? dayjs(editedTask.dueDate).format("YYYY-MM-DD")
      : "";

  return (
    <div className="fixed inset-0 flex items-center justify-center z-50 bg-black/60 backdrop-blur-xl">
      <form
        onSubmit={handleSubmit}
        className="bg-gradient-to-br from-slate-800/95 to-slate-900/95 backdrop-blur-xl border border-slate-600/50 rounded-3xl p-8 w-full max-w-2xl mx-4 shadow-2xl text-white space-y-6"
      >
        <div className="flex items-center justify-between mb-2">
          <div className="flex items-center space-x-3">
            <div className="p-2 bg-gradient-to-br from-orange-500/20 to-red-600/20 rounded-xl">
              <svg className="w-5 h-5 text-orange-400" fill="currentColor" viewBox="0 0 20 20">
                <path d="M13.586 3.586a2 2 0 112.828 2.828l-.793.793-2.828-2.828.793-.793zM11.379 5.793L3 14.172V17h2.828l8.38-8.379-2.83-2.828z" />
              </svg>
            </div>
            <h2 className="text-xl font-bold bg-gradient-to-r from-orange-400 to-red-400 bg-clip-text text-transparent">
              Edit Task
            </h2>
          </div>
          <button
            type="button"
            onClick={onCancel}
            className="p-2 hover:bg-red-500/20 rounded-xl transition-colors text-gray-400 hover:text-red-400"
          >
            <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 20 20">
              <path fillRule="evenodd" d="M4.293 4.293a1 1 0 011.414 0L10 8.586l4.293-4.293a1 1 0 111.414 1.414L11.414 10l4.293 4.293a1 1 0 01-1.414 1.414L10 11.414l-4.293 4.293a1 1 0 01-1.414-1.414L8.586 10 4.293 5.707a1 1 0 010-1.414z" clipRule="evenodd" />
            </svg>
          </button>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {/* Task Title */}
          <div>
            <label className="block text-sm font-semibold mb-2 text-gray-300">
              Task Title
            </label>
            <input
              type="text"
              value={editedTask.title || ""}
              onChange={(e) => handleChange("title", e.target.value)}
              className="bg-slate-800/50 border border-slate-600/50 rounded-xl p-3 w-full text-white focus:ring-2 focus:ring-cyan-400 focus:border-cyan-400 outline-none transition-all duration-300"
              required
            />
          </div>

          {/* Assign To */}
          <div>
            <label className="block text-sm font-semibold mb-2 text-gray-300">
              Assign To
            </label>
            <select
              value={
                Array.isArray(editedTask.assignedTo)
                  ? editedTask.assignedTo[0]?._id ||
                    editedTask.assignedTo[0] ||
                    ""
                  : editedTask.assignedTo?._id || editedTask.assignedTo || ""
              }
              onChange={(e) => handleChange("assignedTo", e.target.value)}
              className="bg-slate-800/50 border border-slate-600/50 rounded-xl p-3 w-full text-white focus:ring-2 focus:ring-cyan-400 focus:border-cyan-400 outline-none cursor-pointer transition-all duration-300"
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
            <label className="block text-sm font-semibold mb-2 text-gray-300">
              Due Date
            </label>
            <input
              type="date"
              value={dueDateValue}
              onChange={(e) => handleChange("dueDate", e.target.value)}
              className="bg-slate-800/50 border border-slate-600/50 rounded-xl p-3 w-full text-white focus:ring-2 focus:ring-cyan-400 focus:border-cyan-400 outline-none transition-all duration-300"
              required
            />
          </div>

          {/* Priority */}
          <div>
            <label className="block text-sm font-semibold mb-2 text-gray-300">
              Priority
            </label>
            <select
              value={editedTask.priority || ""}
              onChange={(e) => handleChange("priority", e.target.value)}
              className="bg-slate-800/50 border border-slate-600/50 rounded-xl p-3 w-full text-white focus:ring-2 focus:ring-cyan-400 focus:border-cyan-400 outline-none cursor-pointer transition-all duration-300"
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
          <label className="block text-sm font-semibold mb-2 text-gray-300">
            Description
          </label>
          <textarea
            value={editedTask.description || ""}
            onChange={(e) => handleChange("description", e.target.value)}
            rows={3}
            className="bg-slate-800/50 border border-slate-600/50 rounded-xl p-3 w-full text-white resize-none h-24 focus:ring-2 focus:ring-cyan-400 focus:border-cyan-400 outline-none transition-all duration-300"
          />
        </div>

        {/* Status */}
        <div>
          <label className="block text-sm font-semibold mb-2 text-gray-300">
            Status
          </label>
          <select
            value={editedTask.status || "pending"}
            onChange={(e) => handleChange("status", e.target.value)}
            className="bg-slate-800/50 border border-slate-600/50 rounded-xl p-3 w-full text-white focus:ring-2 focus:ring-cyan-400 focus:border-cyan-400 outline-none cursor-pointer transition-all duration-300"
            required
          >
            <option value="pending">Pending</option>
            <option value="in-progress">In Progress</option>
            <option value="completed">Completed</option>
            <option value="rejected">Rejected</option>
          </select>
        </div>

        <div className="flex justify-end gap-4 pt-4">
          <button
            type="button"
            onClick={onCancel}
            className="px-6 py-3 bg-gradient-to-r from-gray-600 to-gray-700 hover:from-gray-700 hover:to-gray-800 text-white rounded-xl font-semibold transition-all duration-300 hover:scale-105"
          >
            Cancel
          </button>
          <button
            type="submit"
            className="px-6 py-3 bg-gradient-to-r from-orange-500 to-red-600 hover:from-orange-600 hover:to-red-700 text-white rounded-xl font-semibold transition-all duration-300 hover:scale-105 hover:shadow-lg hover:shadow-orange-500/25"
          >
            Save Changes
          </button>
        </div>
      </form>
    </div>
  );
};

// ----------------- Admin Task Page -----------------
export default function AdminTaskPage({ onLogout }) {
  const [collapsed, setCollapsed] = useState(false);
  const [tasks, setTasks] = useState([]);
  const [users, setUsers] = useState([]);
  const [popupMessage, setPopupMessage] = useState("");
  const [selectedTaskView, setSelectedTaskView] = useState(null); // For general view modal
  const [editingTask, setEditingTask] = useState(null);
  const [filterType, setFilterType] = useState("all");
  const [currentTime, setCurrentTime] = useState(new Date());
  const [userName, setUserName] = useState("");

  const navigate = useNavigate();
  const tableRef = useRef(null);

  const userStr = localStorage.getItem("user");
  const userRole = userStr ? JSON.parse(userStr).role : "employee";

  // Popup helper
  const showPopup = (message) => {
    setPopupMessage(message);
    setTimeout(() => setPopupMessage(""), 3000);
  };

  // Fetch functions
  const fetchTasks = async () => {
    const token = localStorage.getItem("token");
    if (!token) return navigate("/login", { replace: true });
    try {
      const res = await API.get("/api/tasks", {
        headers: { Authorization: `Bearer ${token}` },
      });
      const tasksArray = Array.isArray(res.data) ? res.data : [];
      tasksArray.sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));
      setTasks(tasksArray);
    } catch (err) {
      console.error(err);
      showPopup("❌ Failed to fetch tasks");
    }
  };

  const fetchUsers = async () => {
    const token = localStorage.getItem("token");
    if (!token) return;
    try {
      const res = await API.get("/api/users", {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (Array.isArray(res.data)) setUsers(res.data);
      else if (Array.isArray(res.data?.data)) setUsers(res.data.data);
      else setUsers([]);
    } catch (err) {
      console.error(err);
      showPopup("❌ Failed to fetch users");
    }
  };

  const fetchUser = async () => {
    const token = localStorage.getItem("token");
    if (!token) return navigate("/login", { replace: true });
    try {
      const res = await API.get("/api/users/me", {
        headers: { Authorization: `Bearer ${token}` },
      });
      setUserName(res.data?.name || "Admin");
    } catch (err) {
      console.error(err);
    }
  };

  // Initial Load
  useEffect(() => {
    fetchUsers();
    fetchUser();
    fetchTasks();
    const intervalId = setInterval(fetchTasks, 30000);
    const clockInterval = setInterval(() => setCurrentTime(new Date()), 1000);
    return () => {
      clearInterval(intervalId);
      clearInterval(clockInterval);
    };
  }, []);

  const ensureAssignedArray = (obj) => {
    if (!obj) return obj;
    const assigned = obj.assignedTo;
    return {
      ...obj,
      assignedTo: Array.isArray(assigned) ? assigned : assigned ? [assigned] : [],
    };
  };

  // CRUD Handlers
  const handleCreateTask = async (newTask) => {
    try {
      const payload = ensureAssignedArray(newTask);
      const res = await API.post("/api/tasks", payload);
      setTasks((prev) => [res.data, ...prev]);
      showPopup("✅ Task created successfully!");
    } catch (err) {
      console.error(err);
      showPopup("❌ Failed to create task");
    }
  };

  const handleUpdateTask = async (updatedTask) => {
    try {
      const payload = ensureAssignedArray(updatedTask);
      const id = payload._id || payload.id;
      const res = await API.put(`/api/tasks/${id}`, payload);
      setTasks((prev) => prev.map((t) => (t._id === id ? res.data : t)));
      setEditingTask(null);
      showPopup("✅ Task updated successfully!");
    } catch (err) {
      console.error(err);
      showPopup("❌ Failed to update task");
    }
  };

  const handleDeleteTask = async (id) => {
    try {
      await API.delete(`/api/tasks/${id}`);
      setTasks((prev) => prev.filter((t) => t._id !== id));
      showPopup("🗑 Task deleted successfully!");
    } catch (err) {
      console.error(err);
      showPopup("❌ Failed to delete task");
    }
  };

  const handleRejectTask = async (id) => {
    // Refresh tasks after rejection
    await fetchTasks();
    showPopup("❌ Task rejected successfully!");
  };

  // Filtered Tasks
  const today = dayjs().startOf("day");
  const currentUserId = JSON.parse(localStorage.getItem("user"))?._id;

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
          (t.status || "").toLowerCase() !== "completed" &&
          (t.status || "").toLowerCase() !== "rejected"
        );
      case "completed":
        return (t.status || "").toLowerCase() === "completed";
      case "rejected":
        return (t.status || "").toLowerCase() === "rejected";
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
      (t.status || "").toLowerCase() !== "completed" &&
      (t.status || "").toLowerCase() !== "rejected"
  ).length;
  const completedTasksCount = tasks.filter(
    (t) => (t.status || "").toLowerCase() === "completed"
  ).length;
  const rejectedTasksCount = tasks.filter(
    (t) => (t.status || "").toLowerCase() === "rejected"
  ).length;

  // toggle behavior: clicking the same filter again will reset to 'all'
  const handleFilterAndScroll = (type) => {
    const newType = type === filterType ? "all" : type;
    setFilterType(newType);
    setTimeout(() => tableRef.current?.scrollIntoView({ behavior: "smooth" }), 100);
  };

  return (
    <div className="flex bg-[#0f1419] min-h-screen text-white relative overflow-hidden">
      {/* Animated Background */}
      <div className="absolute inset-0 bg-gradient-to-br from-slate-900/20 via-blue-900/10 to-purple-900/20"></div>
      <div className="absolute inset-0">
        <div className="absolute top-1/4 left-1/4 w-96 h-96 bg-cyan-500/5 rounded-full blur-3xl animate-pulse"></div>
        <div className="absolute bottom-1/4 right-1/4 w-96 h-96 bg-purple-500/5 rounded-full blur-3xl animate-pulse"></div>
      </div>
      <Sidebar
        collapsed={collapsed}
        setCollapsed={setCollapsed}
        userRole="admin"
        onLogout={onLogout}
      />
      <main
        className={`relative z-10 flex-1 transition-all duration-300 ${
          collapsed ? "ml-24" : "ml-72"
        } p-8`}
      >
        {popupMessage && (
          <div className="fixed top-6 right-6 bg-gradient-to-r from-green-500 to-emerald-600 text-white px-6 py-3 rounded-xl shadow-2xl z-50 backdrop-blur-sm border border-green-400/30 animate-slideIn">
            <div className="flex items-center space-x-2">
              <div className="w-2 h-2 bg-white rounded-full animate-pulse"></div>
              <span className="font-medium">{popupMessage}</span>
            </div>
          </div>
        )}

        {/* Modern Header */}
        <div className="mb-12">
          <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between mb-6">
            <div>
              <h1 className="text-5xl font-bold mb-2">
                <span className="bg-gradient-to-r from-cyan-400 via-blue-400 to-purple-400 bg-clip-text text-transparent">
                  Task Management
                </span>
              </h1>
              <p className="text-xl text-gray-300 mb-4">
                Good{" "}
                {currentTime.getHours() < 12
                  ? "Morning"
                  : currentTime.getHours() < 18
                  ? "Afternoon"
                  : "Evening"}
                , {userName} 👋
              </p>
            </div>
            <div className="flex items-center space-x-4">
              <div className="bg-gradient-to-br from-slate-800/50 to-slate-900/50 backdrop-blur-sm border border-slate-600/30 rounded-2xl px-6 py-4">
                <div className="flex items-center space-x-3">
                  <div className="w-3 h-3 bg-green-400 rounded-full animate-pulse"></div>
                  <div>
                    <p className="text-sm text-gray-400">Live Status</p>
                    <p className="text-cyan-400 font-mono text-sm">
                      {currentTime.toLocaleTimeString("en-US", {
                        hour: "2-digit",
                        minute: "2-digit",
                        second: "2-digit",
                      })}
                    </p>
                  </div>
                </div>
              </div>
            </div>
          </div>
          <div className="text-gray-400 text-lg">
            {currentTime.toLocaleDateString("en-US", {
              weekday: "long",
              year: "numeric",
              month: "long",
              day: "numeric",
            })}
          </div>
        </div>

        {/* Modern Stats Dashboard */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-6 gap-6 mb-12">
          {/* Total Tasks */}
          <div
            onClick={() => handleFilterAndScroll("all")}
            className="group bg-gradient-to-br from-slate-800/50 to-slate-900/50 backdrop-blur-sm border border-slate-600/30 rounded-2xl p-6 hover:border-cyan-400/40 transition-all duration-300 cursor-pointer hover:scale-105 hover:shadow-2xl hover:shadow-cyan-500/25"
          >
            <div className="flex items-center justify-between mb-4">
              <div className="p-3 bg-gradient-to-br from-cyan-500/20 to-blue-600/20 rounded-xl">
                <svg className="w-6 h-6 text-cyan-400" fill="currentColor" viewBox="0 0 20 20">
                  <path d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
              </div>
              <div className="text-right">
                <p className="text-3xl font-bold text-white group-hover:text-cyan-400 transition-colors">{totalTasks}</p>
                <p className="text-sm text-gray-400 uppercase tracking-wide">Total Tasks</p>
              </div>
            </div>
            <div className="h-1 bg-gradient-to-r from-cyan-500 to-blue-600 rounded-full"></div>
          </div>

          {/* Assigned by Me */}
          <div
            onClick={() => handleFilterAndScroll("assignedByMe")}
            className="group bg-gradient-to-br from-slate-800/50 to-slate-900/50 backdrop-blur-sm border border-slate-600/30 rounded-2xl p-6 hover:border-orange-400/40 transition-all duration-300 cursor-pointer hover:scale-105 hover:shadow-2xl hover:shadow-orange-500/25"
          >
            <div className="flex items-center justify-between mb-4">
              <div className="p-3 bg-gradient-to-br from-orange-500/20 to-red-600/20 rounded-xl">
                <svg className="w-6 h-6 text-orange-400" fill="currentColor" viewBox="0 0 20 20">
                  <path d="M13 6a3 3 0 11-6 0 3 3 0 016 0zM18 8a2 2 0 11-4 0 2 2 0 014 0zM14 15a4 4 0 00-8 0v3h8v-3z" />
                </svg>
              </div>
              <div className="text-right">
                <p className="text-3xl font-bold text-white group-hover:text-orange-400 transition-colors">{assignedByMeCount}</p>
                <p className="text-sm text-gray-400 uppercase tracking-wide">Assigned by Me</p>
              </div>
            </div>
            <div className="h-1 bg-gradient-to-r from-orange-500 to-red-600 rounded-full"></div>
          </div>

          {/* Due Today */}
          <div
            onClick={() => handleFilterAndScroll("dueToday")}
            className="group bg-gradient-to-br from-slate-800/50 to-slate-900/50 backdrop-blur-sm border border-slate-600/30 rounded-2xl p-6 hover:border-green-400/40 transition-all duration-300 cursor-pointer hover:scale-105 hover:shadow-2xl hover:shadow-green-500/25"
          >
            <div className="flex items-center justify-between mb-4">
              <div className="p-3 bg-gradient-to-br from-green-500/20 to-emerald-600/20 rounded-xl">
                <svg className="w-6 h-6 text-green-400" fill="currentColor" viewBox="0 0 20 20">
                  <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm1-12a1 1 0 10-2 0v4a1 1 0 00.293.707l2.828 2.829a1 1 0 101.415-1.415L11 9.586V6z" clipRule="evenodd" />
                </svg>
              </div>
              <div className="text-right">
                <p className="text-3xl font-bold text-white group-hover:text-green-400 transition-colors">{tasksDueTodayCount}</p>
                <p className="text-sm text-gray-400 uppercase tracking-wide">Due Today</p>
              </div>
            </div>
            <div className="h-1 bg-gradient-to-r from-green-500 to-emerald-600 rounded-full"></div>
          </div>

          {/* Overdue */}
          <div
            onClick={() => handleFilterAndScroll("overdue")}
            className="group bg-gradient-to-br from-slate-800/50 to-slate-900/50 backdrop-blur-sm border border-slate-600/30 rounded-2xl p-6 hover:border-red-400/40 transition-all duration-300 cursor-pointer hover:scale-105 hover:shadow-2xl hover:shadow-red-500/25"
          >
            <div className="flex items-center justify-between mb-4">
              <div className="p-3 bg-gradient-to-br from-red-500/20 to-pink-600/20 rounded-xl relative">
                <svg className="w-6 h-6 text-red-400" fill="currentColor" viewBox="0 0 20 20">
                  <path fillRule="evenodd" d="M8.257 3.099c.765-1.36 2.722-1.36 3.486 0l5.58 9.92c.75 1.334-.213 2.98-1.742 2.98H4.42c-1.53 0-2.493-1.646-1.743-2.98l5.58-9.92zM11 13a1 1 0 11-2 0 1 1 0 012 0zm-1-8a1 1 0 00-1 1v3a1 1 0 002 0V6a1 1 0 00-1-1z" clipRule="evenodd" />
                </svg>
                {overdueTasksCount > 0 && <div className="absolute -top-1 -right-1 w-3 h-3 bg-red-500 rounded-full animate-pulse"></div>}
              </div>
              <div className="text-right">
                <p className="text-3xl font-bold text-white group-hover:text-red-400 transition-colors">{overdueTasksCount}</p>
                <p className="text-sm text-gray-400 uppercase tracking-wide">Overdue</p>
              </div>
            </div>
            <div className="h-1 bg-gradient-to-r from-red-500 to-pink-600 rounded-full"></div>
          </div>

          {/* Completed */}
          <div
            onClick={() => handleFilterAndScroll("completed")}
            className="group bg-gradient-to-br from-slate-800/50 to-slate-900/50 backdrop-blur-sm border border-slate-600/30 rounded-2xl p-6 hover:border-purple-400/40 transition-all duration-300 cursor-pointer hover:scale-105 hover:shadow-2xl hover:shadow-purple-500/25"
          >
            <div className="flex items-center justify-between mb-4">
              <div className="p-3 bg-gradient-to-br from-purple-500/20 to-indigo-600/20 rounded-xl">
                <svg className="w-6 h-6 text-purple-400" fill="currentColor" viewBox="0 0 20 20">
                  <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
                </svg>
              </div>
              <div className="text-right">
                <p className="text-3xl font-bold text-white group-hover:text-purple-400 transition-colors">{completedTasksCount}</p>
                <p className="text-sm text-gray-400 uppercase tracking-wide">Completed</p>
              </div>
            </div>
            <div className="h-1 bg-gradient-to-r from-purple-500 to-indigo-600 rounded-full"></div>
          </div>

          {/* Rejected */}
          <div
            onClick={() => handleFilterAndScroll("rejected")}
            className="group bg-gradient-to-br from-slate-800/50 to-slate-900/50 backdrop-blur-sm border border-slate-600/30 rounded-2xl p-6 hover:border-red-400/40 transition-all duration-300 cursor-pointer hover:scale-105 hover:shadow-2xl hover:shadow-red-500/25"
          >
            <div className="flex items-center justify-between mb-4">
              <div className="p-3 bg-gradient-to-br from-red-500/20 to-rose-600/20 rounded-xl">
                <svg className="w-6 h-6 text-red-400" fill="currentColor" viewBox="0 0 20 20">
                  <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.707 7.293a1 1 0 00-1.414 1.414L8.586 10l-1.293 1.293a1 1 0 101.414 1.414L10 11.414l1.293 1.293a1 1 0 001.414-1.414L11.414 10l1.293-1.293a1 1 0 00-1.414-1.414L10 8.586 8.707 7.293z" clipRule="evenodd" />
                </svg>
              </div>
              <div className="text-right">
                <p className="text-3xl font-bold text-white group-hover:text-red-400 transition-colors">{rejectedTasksCount}</p>
                <p className="text-sm text-gray-400 uppercase tracking-wide">Rejected</p>
              </div>
            </div>
            <div className="h-1 bg-gradient-to-r from-red-500 to-rose-600 rounded-full"></div>
          </div>
        </div>

        {/* Task Creation Section */}
        <section className="bg-gradient-to-br from-slate-800/40 to-slate-900/40 backdrop-blur-xl border border-slate-600/30 rounded-3xl p-8 mb-12 hover:border-cyan-400/40 transition-all duration-300 shadow-2xl">
          <div className="flex items-center space-x-3 mb-6">
            <div className="p-3 bg-gradient-to-br from-cyan-500/20 to-blue-600/20 rounded-xl">
              <svg className="w-6 h-6 text-cyan-400" fill="currentColor" viewBox="0 0 20 20">
                <path fillRule="evenodd" d="M10 3a1 1 0 011 1v5h5a1 1 0 110 2h-5v5a1 1 0 11-2 0v-5H4a1 1 0 110-2h5V4a1 1 0 011-1z" clipRule="evenodd" />
              </svg>
            </div>
            <div>
              <h2 className="text-2xl font-bold bg-gradient-to-r from-cyan-400 to-blue-400 bg-clip-text text-transparent">
                Create New Task
              </h2>
              <p className="text-gray-400">Assign tasks to team members and track progress</p>
            </div>
          </div>
          <TaskForm onCreate={handleCreateTask} users={users} />
        </section>

        {/* Employee Analytics Section */}
        <section className="bg-gradient-to-br from-purple-900/20 to-blue-900/20 backdrop-blur-xl border border-purple-500/30 rounded-3xl p-8 mb-12 hover:border-purple-400/40 transition-all duration-300 shadow-2xl overflow-visible">
          <div className="flex items-center space-x-3 mb-6">
            <div className="p-3 bg-gradient-to-br from-purple-500/20 to-pink-600/20 rounded-xl">
              <svg className="w-6 h-6 text-purple-400" fill="currentColor" viewBox="0 0 20 20">
                <path d="M3 4a1 1 0 011-1h12a1 1 0 011 1v2a1 1 0 01-1 1H4a1 1 0 01-1-1V4zM3 10a1 1 0 011-1h6a1 1 0 011 1v6a1 1 0 01-1 1H4a1 1 0 01-1-1v-6zM14 9a1 1 0 00-1 1v6a1 1 0 001 1h2a1 1 0 001-1v-6a1 1 0 00-1-1h-2z" />
              </svg>
            </div>
            <div>
              <h2 className="text-2xl font-bold bg-gradient-to-r from-purple-400 to-pink-400 bg-clip-text text-transparent">
                Employee Task Analytics
              </h2>
              <p className="text-gray-400">Analyze individual performance and task completion rates</p>
            </div>
          </div>
          <EmployeeTaskAnalytics users={users} />
        </section>

        {/* Task Management Section */}
        <section
          ref={tableRef}
          className="bg-gradient-to-br from-emerald-900/20 to-teal-900/20 backdrop-blur-xl border border-emerald-500/30 rounded-3xl p-8 shadow-2xl hover:border-emerald-400/40 transition-all duration-300"
        >
          <div className="flex items-center justify-between mb-6">
            <div className="flex items-center space-x-3">
              <div className="p-3 bg-gradient-to-br from-emerald-500/20 to-teal-600/20 rounded-xl">
                <svg className="w-6 h-6 text-emerald-400" fill="currentColor" viewBox="0 0 20 20">
                  <path d="M9 2a1 1 0 000 2h2a1 1 0 100-2H9z" />
                  <path fillRule="evenodd" d="M4 5a2 2 0 012-2v1a1 1 0 102 0V3h4v1a1 1 0 102 0V3a2 2 0 012 2v6a2 2 0 01-2 2H6a2 2 0 01-2-2V5zm2.5 7a1.5 1.5 0 100-3 1.5 1.5 0 000 3zm2.45 4a2.5 2.5 0 10-4.9 0h4.9zM12 9a1 1 0 100 2h3a1 1 0 100-2h-3zm-1 4a1 1 0 011-1h2a1 1 0 110 2h-2a1 1 0 01-1-1z" clipRule="evenodd" />
                </svg>
              </div>
              <div>
                <h2 className="text-2xl font-bold bg-gradient-to-r from-emerald-400 to-teal-400 bg-clip-text text-transparent">
                  Task Management
                </h2>
                <p className="text-gray-400">View, edit, and manage all tasks ({filteredTasks.length} {filterType !== 'all' ? `filtered` : 'total'})</p>
              </div>
            </div>
            {filterType !== 'all' && (
              <div className="bg-gradient-to-r from-cyan-500/20 to-blue-600/20 border border-cyan-400/30 rounded-xl px-4 py-2">
                <span className="text-cyan-400 text-sm font-medium">Filter: {filterType}</span>
              </div>
            )}
          </div>
          <TaskTable
            tasks={filteredTasks}
            onViewTask={setSelectedTaskView}
            onEditTask={setEditingTask}
            onDeleteTask={handleDeleteTask}
            onRejectTask={handleRejectTask}
          />
        </section>

        {/* Modern Task View Modal */}
        {selectedTaskView && (
          <div className="fixed inset-0 flex items-center justify-center z-50 bg-black/60 backdrop-blur-xl">
            <div className="relative max-w-lg w-full mx-4 bg-gradient-to-br from-slate-800/95 to-slate-900/95 backdrop-blur-xl border border-slate-600/50 rounded-3xl shadow-2xl overflow-hidden">
              {/* Header */}
              <div className="bg-gradient-to-r from-cyan-500/20 to-blue-600/20 p-6 border-b border-slate-600/50">
                <div className="flex items-center justify-between">
                  <div className="flex items-center space-x-3">
                    <img src={tapveraLogo} alt="Tapvera" className="h-10 w-10" />
                    <div>
                      <h2 className="text-xl font-bold text-white">{selectedTaskView.title}</h2>
                      <p className="text-cyan-400 text-sm">Task Details</p>
                    </div>
                  </div>
                  <button
                    onClick={() => setSelectedTaskView(null)}
                    className="p-2 hover:bg-red-500/20 rounded-xl transition-colors text-gray-400 hover:text-red-400"
                  >
                    <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 20 20">
                      <path fillRule="evenodd" d="M4.293 4.293a1 1 0 011.414 0L10 8.586l4.293-4.293a1 1 0 111.414 1.414L11.414 10l4.293 4.293a1 1 0 01-1.414 1.414L10 11.414l-4.293 4.293a1 1 0 01-1.414-1.414L8.586 10 4.293 5.707a1 1 0 010-1.414z" clipRule="evenodd" />
                    </svg>
                  </button>
                </div>
              </div>
              {/* Content */}
              <div className="p-6">
                <p className="text-gray-300 leading-relaxed mb-6">{selectedTaskView.description}</p>
                <button
                  onClick={() => setSelectedTaskView(null)}
                  className="w-full bg-gradient-to-r from-cyan-500 to-blue-600 hover:from-cyan-600 hover:to-blue-700 text-white font-semibold py-3 rounded-xl transition-all duration-300 hover:scale-105 hover:shadow-lg hover:shadow-cyan-500/25"
                >
                  Close Task Details
                </button>
              </div>
            </div>
          </div>
        )}


        {/* Edit Task Modal */}
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
