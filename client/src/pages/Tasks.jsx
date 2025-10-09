import React, { useState, useEffect, useCallback } from "react";
import axios from "axios";
import { FaDownload, FaKeyboard, FaSearch, FaTrophy } from "react-icons/fa";
import Sidebar from "../components/dashboard/Sidebar";
import TaskStats from "../components/task/TaskStats";
import TaskList from "../components/task/TaskList";
import { useAchievements } from "../contexts/AchievementContext";

const API_BASE = import.meta.env.VITE_API_BASE || "http://localhost:5000";

const Tasks = ({ onLogout }) => {
  const [collapsed, setCollapsed] = useState(false);
  const [tasks, setTasks] = useState([]);
  const [loading, setLoading] = useState(false);
  const [filteredTasks, setFilteredTasks] = useState([]);
  const [filters, setFilters] = useState({
    status: 'all',
    priority: 'all',
    search: '',
    overdue: false
  });
  const [viewMode, setViewMode] = useState('list'); // 'list' or 'kanban'
  const [showKeyboardShortcuts, setShowKeyboardShortcuts] = useState(false);
  const { userProgress, triggerAchievement } = useAchievements();

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

      // Define status hierarchy
      const statusOrder = {
        "in-progress": 1,
        pending: 2,
        completed: 3,
      };

      // Format and sort
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
          completedAt: task.completedAt || null,
          rejectedAt: task.rejectedAt || null, // ✅ include rejectedAt
          rejectionReason: task.rejectionReason || null, // ✅ include rejectionReason
          remarks: task.remarks || [], // ✅ include remarks
        }))
        .sort((a, b) => {
          // First by status hierarchy
          const statusDiff =
            (statusOrder[a.status] || 99) - (statusOrder[b.status] || 99);
          if (statusDiff !== 0) return statusDiff;

          // Then by due date (earliest first)
          return new Date(a.dueDate) - new Date(b.dueDate);
        });

      setTasks(formattedTasks);
      setFilteredTasks(formattedTasks);
      setLoading(false);
    } catch (err) {
      console.error("Error fetching tasks:", err.response?.data || err.message);
      setLoading(false);
    }
  };


  // Filter tasks based on current filters
  useEffect(() => {
    let filtered = [...tasks];

    // Status filter
    if (filters.status !== 'all') {
      filtered = filtered.filter(task => task.status === filters.status);
      trackCustomFilter(); // Track custom filter usage
    }

    // Priority filter
    if (filters.priority !== 'all') {
      filtered = filtered.filter(task => task.priority === filters.priority);
      trackCustomFilter(); // Track custom filter usage
    }

    // Search filter
    if (filters.search) {
      const searchLower = filters.search.toLowerCase();
      filtered = filtered.filter(task =>
        task.title.toLowerCase().includes(searchLower) ||
        task.description.toLowerCase().includes(searchLower) ||
        task.assignedBy?.name?.toLowerCase().includes(searchLower)
      );
      trackCustomFilter(); // Track custom filter usage
    }

    // Overdue filter
    if (filters.overdue) {
      const now = new Date();
      filtered = filtered.filter(task =>
        task.dueDate &&
        new Date(task.dueDate) < now &&
        task.status !== 'completed'
      );
      trackCustomFilter(); // Track custom filter usage
    }

    setFilteredTasks(filtered);
  }, [tasks, filters]);

  // Polling: fetch tasks on mount and every 30s
  useEffect(() => {
    fetchTasks();
    const interval = setInterval(fetchTasks, 30000); // every 30 seconds
    return () => clearInterval(interval);
  }, []);

  // Update task status locally and re-sort immediately
  const handleStatusChange = (taskId, newStatus) => {
    setTasks((prev) => {
      const updated = prev.map((t) => {
        if (t._id === taskId) {
          const updatedTask = {
            ...t,
            status: newStatus,
            completedAt: newStatus === "completed" ? new Date() : null,
          };


          return updatedTask;
        }
        return t;
      });

      // re-apply sorting
      const statusOrder = { "in-progress": 1, pending: 2, completed: 3 };
      return updated.sort((a, b) => {
        const statusDiff =
          (statusOrder[a.status] || 99) - (statusOrder[b.status] || 99);
        if (statusDiff !== 0) return statusDiff;
        return new Date(a.dueDate) - new Date(b.dueDate);
      });
    });
  };

  // Clear all filters
  const clearFilters = () => {
    setFilters({
      status: 'all',
      priority: 'all',
      search: '',
      overdue: false
    });
  };

  // Track custom filter creation (for innovation achievement)
  const trackCustomFilter = () => {
    triggerAchievement('CUSTOM_FILTER_CREATED');
  };

  // Quick filter shortcuts
  const quickFilters = [
    { label: 'All', onClick: () => clearFilters() },
    { label: 'Overdue', onClick: () => setFilters(prev => ({...prev, overdue: true, status: 'all'})) },
    { label: 'High Priority', onClick: () => setFilters(prev => ({...prev, priority: 'High', overdue: false, status: 'all'})) },
    { label: 'In Progress', onClick: () => setFilters(prev => ({...prev, status: 'in-progress', overdue: false})) },
    { label: 'Completed Today', onClick: () => setFilters(prev => ({...prev, status: 'completed', overdue: false})) }
  ];

  // Export tasks to CSV
  const exportTasks = () => {
    if (filteredTasks.length === 0) {
      alert('No tasks to export. Try adjusting your filters.');
      return;
    }

    const csvContent = [
      ['Title', 'Status', 'Priority', 'Due Date', 'Assigned By', 'Description'],
      ...filteredTasks.map(task => [
        task.title || 'Untitled',
        task.status || 'Unknown',
        task.priority || 'Unknown',
        task.dueDate ? new Date(task.dueDate).toLocaleDateString() : 'No due date',
        task.assignedBy?.name || 'Unknown',
        (task.description || 'No description').replace(/,/g, ';').replace(/"/g, '""') // Replace commas and escape quotes
      ])
    ].map(row => row.map(cell => `"${cell}"`).join(',')).join('\n');

    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = window.URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `tasks-${new Date().toISOString().split('T')[0]}.csv`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    window.URL.revokeObjectURL(url);
  };

  // Keyboard shortcuts
  const handleKeyPress = useCallback((e) => {
    if (e.ctrlKey || e.metaKey) {
      switch (e.key) {
        case 'k':
          e.preventDefault();
          document.querySelector('input[placeholder*="Search tasks"]')?.focus();
          break;
        case 'f':
          e.preventDefault();
          clearFilters();
          break;
        case 'e':
          e.preventDefault();
          exportTasks();
          break;
        case '?':
          e.preventDefault();
          setShowKeyboardShortcuts(!showKeyboardShortcuts);
          break;
        default:
          break;
      }
    }

    // Escape key to close modals
    if (e.key === 'Escape') {
      if (showKeyboardShortcuts) {
        setShowKeyboardShortcuts(false);
      }
    }

    // Number keys for quick filters
    if (!e.ctrlKey && !e.metaKey && e.target.tagName !== 'INPUT') {
      const num = parseInt(e.key);
      if (num >= 1 && num <= 5) { // hardcode the length to avoid dependency
        e.preventDefault();
        // Execute the appropriate filter function directly
        switch (num) {
          case 1: clearFilters(); break;
          case 2: setFilters(prev => ({...prev, overdue: true, status: 'all'})); break;
          case 3: setFilters(prev => ({...prev, priority: 'High', overdue: false, status: 'all'})); break;
          case 4: setFilters(prev => ({...prev, status: 'in-progress', overdue: false})); break;
          case 5: setFilters(prev => ({...prev, status: 'completed', overdue: false})); break;
        }
      }
    }
  }, [showKeyboardShortcuts]);

  // Add keyboard event listener
  useEffect(() => {
    document.addEventListener('keydown', handleKeyPress);
    return () => document.removeEventListener('keydown', handleKeyPress);
  }, [handleKeyPress]);


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
        <div className="space-y-6">
          {/* Enhanced Task Stats */}
          <TaskStats tasks={tasks} loading={loading} />

          {/* Advanced Filters & Controls */}
          <div className="bg-[#181d2a] rounded-lg shadow-lg p-4 border border-blue-950">
            <div className="flex flex-col lg:flex-row gap-4 items-start lg:items-center justify-between mb-4">
              <h3 className="font-semibold text-blue-100 text-lg">Task Management</h3>

              {/* Action Buttons */}
              <div className="flex items-center gap-2">

                <button
                  onClick={() => setShowKeyboardShortcuts(true)}
                  className="px-3 py-1.5 bg-gray-700 hover:bg-gray-600 text-white rounded-md text-sm font-medium transition flex items-center gap-1"
                  title="Keyboard Shortcuts (Ctrl+?)"
                >
                  <FaKeyboard />
                </button>

                <button
                  onClick={exportTasks}
                  className="px-3 py-1.5 bg-green-700 hover:bg-green-600 text-white rounded-md text-sm font-medium transition flex items-center gap-1"
                  title="Export Tasks (Ctrl+E)"
                >
                  <FaDownload />
                  Export
                </button>

                <button
                  onClick={() => setViewMode('list')}
                  className={`px-3 py-1.5 rounded-md text-sm font-medium transition ${
                    viewMode === 'list'
                      ? 'bg-[#ff8000] text-white'
                      : 'bg-gray-700 text-gray-300 hover:bg-gray-600'
                  }`}
                >
                  List View
                </button>
                <button
                  onClick={() => setViewMode('kanban')}
                  className={`px-3 py-1.5 rounded-md text-sm font-medium transition ${
                    viewMode === 'kanban'
                      ? 'bg-[#ff8000] text-white'
                      : 'bg-gray-700 text-gray-300 hover:bg-gray-600'
                  }`}
                >
                  Kanban
                </button>
              </div>
            </div>

            {/* Search Bar */}
            <div className="mb-4 relative">
              <FaSearch className="absolute left-3 top-1/2 transform -translate-y-1/2 text-blue-400" />
              <input
                type="text"
                placeholder="Search tasks by title, description, or assignee... (Ctrl+K)"
                value={filters.search}
                onChange={(e) => setFilters({...filters, search: e.target.value})}
                className="w-full pl-10 pr-4 py-2 bg-[#141a29] border border-blue-950 rounded-lg text-blue-100 placeholder-blue-400 focus:outline-none focus:ring-2 focus:ring-[#ff8000] focus:border-transparent"
              />
            </div>

            {/* Filter Controls */}
            <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-4">
              <select
                value={filters.status}
                onChange={(e) => setFilters({...filters, status: e.target.value})}
                className="px-3 py-2 bg-[#141a29] border border-blue-950 rounded-lg text-blue-100 focus:outline-none focus:ring-2 focus:ring-[#ff8000]"
              >
                <option value="all">All Status</option>
                <option value="pending">Pending</option>
                <option value="in-progress">In Progress</option>
                <option value="completed">Completed</option>
                <option value="rejected">Rejected</option>
              </select>

              <select
                value={filters.priority}
                onChange={(e) => setFilters({...filters, priority: e.target.value})}
                className="px-3 py-2 bg-[#141a29] border border-blue-950 rounded-lg text-blue-100 focus:outline-none focus:ring-2 focus:ring-[#ff8000]"
              >
                <option value="all">All Priority</option>
                <option value="High">High Priority</option>
                <option value="Medium">Medium Priority</option>
                <option value="Low">Low Priority</option>
              </select>

              <label className="flex items-center gap-2 px-3 py-2 bg-[#141a29] border border-blue-950 rounded-lg cursor-pointer hover:bg-[#1a2137]">
                <input
                  type="checkbox"
                  checked={filters.overdue}
                  onChange={(e) => setFilters({...filters, overdue: e.target.checked})}
                  className="w-4 h-4 text-[#ff8000] bg-gray-700 border-gray-600 rounded focus:ring-[#ff8000] focus:ring-2"
                />
                <span className="text-blue-100 text-sm">Show Overdue Only</span>
              </label>

              <button
                onClick={clearFilters}
                className="px-4 py-2 bg-gray-700 hover:bg-gray-600 text-white rounded-lg transition text-sm font-medium"
              >
                Clear Filters
              </button>
            </div>

            {/* Quick Filter Pills */}
            <div className="flex flex-wrap gap-2">
              {quickFilters.map((filter, index) => (
                <button
                  key={index}
                  onClick={filter.onClick}
                  className="px-3 py-1.5 bg-[#141a29] hover:bg-[#ff8000] text-blue-300 hover:text-white rounded-full text-sm transition border border-blue-950 hover:border-[#ff8000]"
                >
                  <span className="mr-1 opacity-60">{index + 1}</span>
                  {filter.label}
                </button>
              ))}
            </div>

            {/* Results Counter */}
            <div className="mt-4 pt-3 border-t border-blue-950">
              <p className="text-blue-400 text-sm">
                Showing {filteredTasks.length} of {tasks.length} tasks
                {filters.search && ` matching "${filters.search}"`}
              </p>
            </div>
          </div>

          {/* Task List */}
          <TaskList
            tasks={filteredTasks}
            onStatusChange={handleStatusChange}
            loading={loading}
            viewMode={viewMode}
            setViewMode={setViewMode}
          />
        </div>

        {/* Keyboard Shortcuts Modal */}
        {showKeyboardShortcuts && (
          <div
            className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4"
            onClick={(e) => {
              if (e.target === e.currentTarget) {
                setShowKeyboardShortcuts(false);
              }
            }}
          >
            <div className="bg-[#181d2a] rounded-lg shadow-xl p-6 max-w-md w-full border border-blue-950">
              <div className="flex justify-between items-center mb-4">
                <h3 className="text-lg font-semibold text-blue-100">Keyboard Shortcuts</h3>
                <button
                  onClick={() => setShowKeyboardShortcuts(false)}
                  className="text-gray-400 hover:text-white transition"
                >
                  ✕
                </button>
              </div>

              <div className="space-y-3 text-sm">
                <div className="flex justify-between items-center">
                  <span className="text-blue-300">Search Tasks</span>
                  <kbd className="px-2 py-1 bg-gray-700 rounded text-xs">Ctrl+K</kbd>
                </div>
                <div className="flex justify-between items-center">
                  <span className="text-blue-300">Clear Filters</span>
                  <kbd className="px-2 py-1 bg-gray-700 rounded text-xs">Ctrl+F</kbd>
                </div>
                <div className="flex justify-between items-center">
                  <span className="text-blue-300">Export Tasks</span>
                  <kbd className="px-2 py-1 bg-gray-700 rounded text-xs">Ctrl+E</kbd>
                </div>
                <div className="flex justify-between items-center">
                  <span className="text-blue-300">Toggle Shortcuts</span>
                  <kbd className="px-2 py-1 bg-gray-700 rounded text-xs">Ctrl+?</kbd>
                </div>

                <div className="border-t border-blue-950 pt-3 mt-4">
                  <p className="text-blue-400 text-xs mb-2">Quick Filters:</p>
                  {quickFilters.map((filter, index) => (
                    <div key={index} className="flex justify-between items-center">
                      <span className="text-blue-300">{filter.label}</span>
                      <kbd className="px-2 py-1 bg-gray-700 rounded text-xs">{index + 1}</kbd>
                    </div>
                  ))}
                </div>
              </div>

              <div className="mt-4 pt-3 border-t border-blue-950">
                <p className="text-xs text-gray-400">
                  Press <kbd className="px-1 bg-gray-700 rounded">Ctrl+?</kbd> anytime to toggle this help
                </p>
              </div>
            </div>
          </div>
        )}

      </div>
    </div>
  );
};

export default Tasks;
