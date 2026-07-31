import React, { useState, useEffect, useMemo } from "react";
import {
  Search,
  Filter,
  Calendar,
  AlertCircle,
  CheckCircle2,
  Clock,
  XCircle,
  MessageSquare,
  Edit2,
  Trash2,
  UserPlus,
  Eye,
  RefreshCw,
} from "lucide-react";
import API from "../../api";

const TeamMemberTaskView = ({
  selectedMember,
  onEditTask,
  onDeleteTask,
  onReassignTask,
  onViewDetails,
  onRefresh,
}) => {
  const [tasks, setTasks] = useState([]);
  const [loading, setLoading] = useState(false);
  const [filters, setFilters] = useState({
    status: "all",
    priority: "all",
    search: "",
  });

  // Fetch tasks for selected member
  useEffect(() => {
    if (!selectedMember) {
      setTasks([]);
      return;
    }

    const fetchMemberTasks = async () => {
      setLoading(true);
      try {
        console.log("Fetching tasks for member:", selectedMember.userId, selectedMember.name);

        // API instance from api.js already adds token via interceptor
        const response = await API.get("/api/tasks", {
          params: {
            assignedTo: selectedMember.userId,
            limit: 1000 // Request higher limit for team view
          },
        });

        console.log("Fetched tasks response:", response.data);

        // Handle both array response and paginated response
        const tasksData = Array.isArray(response.data)
          ? response.data
          : (response.data.tasks || []);

        setTasks(tasksData);
      } catch (error) {
        console.error("Error fetching member tasks:", error);
        console.error("Error response:", error.response?.data);
        setTasks([]);
      } finally {
        setLoading(false);
      }
    };

    fetchMemberTasks();
  }, [selectedMember]);

  // Filter tasks
  const filteredTasks = useMemo(() => {
    // Ensure tasks is an array before filtering
    if (!Array.isArray(tasks)) return [];

    let filtered = [...tasks];

    if (filters.status !== "all") {
      filtered = filtered.filter((task) => task.status === filters.status);
    }

    if (filters.priority !== "all") {
      filtered = filtered.filter((task) => task.priority === filters.priority);
    }

    if (filters.search) {
      const searchLower = filters.search.toLowerCase();
      filtered = filtered.filter(
        (task) =>
          task.title.toLowerCase().includes(searchLower) ||
          task.description?.toLowerCase().includes(searchLower)
      );
    }

    return filtered;
  }, [tasks, filters]);

  // Status badge styling
  const getStatusBadge = (status) => {
    const styles = {
      pending: "bg-yellow-100 dark:bg-yellow-900/30 text-yellow-800 dark:text-yellow-300",
      "in-progress": "bg-blue-100 dark:bg-blue-900/30 text-blue-800 dark:text-blue-300",
      completed: "bg-green-100 dark:bg-green-900/30 text-green-800 dark:text-green-300",
      rejected: "bg-red-100 dark:bg-red-900/30 text-red-800 dark:text-red-300",
    };
    const icons = {
      pending: AlertCircle,
      "in-progress": Clock,
      completed: CheckCircle2,
      rejected: XCircle,
    };
    const Icon = icons[status] || AlertCircle;

    return (
      <span
        className={`inline-flex items-center gap-1 px-2 py-1 rounded-full text-xs font-medium ${
          styles[status] || "bg-gray-100 dark:bg-gray-700 text-gray-800 dark:text-gray-300"
        }`}
      >
        <Icon className="h-3 w-3" />
        {status}
      </span>
    );
  };

  // Priority badge styling
  const getPriorityBadge = (priority) => {
    const styles = {
      High: "bg-red-100 dark:bg-red-900/30 text-red-800 dark:text-red-300 border-red-200 dark:border-red-800",
      Medium: "bg-orange-100 dark:bg-orange-900/30 text-orange-800 dark:text-orange-300 border-orange-200 dark:border-orange-800",
      Low: "bg-gray-100 dark:bg-gray-700 text-gray-800 dark:text-gray-300 border-gray-200 dark:border-gray-600",
    };

    return (
      <span
        className={`inline-flex items-center px-2 py-0.5 rounded text-xs font-medium border ${
          styles[priority] || "bg-gray-100 text-gray-800 border-gray-200"
        }`}
      >
        {priority}
      </span>
    );
  };

  // Format date
  const formatDate = (date) => {
    if (!date) return "No due date";
    const d = new Date(date);
    const today = new Date();
    const isOverdue = d < today;

    return (
      <span className={isOverdue ? "text-red-600 font-medium" : "text-gray-600"}>
        {d.toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" })}
        {isOverdue && " (overdue)"}
      </span>
    );
  };

  if (!selectedMember) {
    return (
      <div className="flex items-center justify-center h-full text-gray-500 dark:text-gray-400">
        <div className="text-center">
          <UserPlus className="h-12 w-12 mx-auto mb-2 opacity-50" />
          <p className="text-sm">Select a team member to view their tasks</p>
        </div>
      </div>
    );
  }

  return (
    <div className="flex flex-col h-full">
      {/* Header */}
      <div className="border-b border-gray-200 dark:border-gray-700 pb-4 mb-4">
        <div className="flex items-center justify-between mb-3">
          <div>
            <h2 className="text-xl font-semibold text-gray-900 dark:text-white">{selectedMember.name}'s Tasks</h2>
            <p className="text-sm text-gray-600 dark:text-gray-400">
              {selectedMember.designation || "N/A"} • {selectedMember.department || "N/A"}
            </p>
          </div>
          <button
            onClick={() => onRefresh && onRefresh()}
            className="p-2 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors"
            title="Refresh tasks"
          >
            <RefreshCw className="h-4 w-4 text-gray-600 dark:text-gray-400" />
          </button>
        </div>

        {/* Search Bar */}
        <div className="relative mb-3">
          <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-gray-400 dark:text-gray-500" />
          <input
            type="text"
            placeholder="Search tasks..."
            value={filters.search}
            onChange={(e) => setFilters((prev) => ({ ...prev, search: e.target.value }))}
            className="w-full pl-10 pr-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100 placeholder-gray-500 dark:placeholder-gray-400 focus:ring-2 focus:ring-blue-500 focus:border-transparent"
          />
        </div>

        {/* Filter Badges - Status and Priority in one row */}
        <div className="flex flex-wrap items-center gap-4">
          {/* Status Filters */}
          <div className="flex items-center gap-2">
            <Filter className="h-3.5 w-3.5 text-gray-500 dark:text-gray-400" />
            <span className="text-xs font-medium text-gray-600 dark:text-gray-400">Status:</span>
            <div className="flex flex-wrap gap-2">
              <button
                onClick={() => setFilters((prev) => ({ ...prev, status: "all" }))}
                className={`px-3 py-1.5 rounded-full text-xs font-medium transition-colors ${
                  filters.status === "all"
                    ? "bg-blue-600 text-white"
                    : "bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-300 hover:bg-gray-200 dark:hover:bg-gray-600"
                }`}
              >
                All
              </button>
              <button
                onClick={() => setFilters((prev) => ({ ...prev, status: "pending" }))}
                className={`px-3 py-1.5 rounded-full text-xs font-medium transition-colors ${
                  filters.status === "pending"
                    ? "bg-yellow-600 text-white"
                    : "bg-yellow-100 dark:bg-yellow-900/30 text-yellow-800 dark:text-yellow-300 hover:bg-yellow-200 dark:hover:bg-yellow-900/50"
                }`}
              >
                Pending
              </button>
              <button
                onClick={() => setFilters((prev) => ({ ...prev, status: "in-progress" }))}
                className={`px-3 py-1.5 rounded-full text-xs font-medium transition-colors ${
                  filters.status === "in-progress"
                    ? "bg-blue-600 text-white"
                    : "bg-blue-100 dark:bg-blue-900/30 text-blue-800 dark:text-blue-300 hover:bg-blue-200 dark:hover:bg-blue-900/50"
                }`}
              >
                In Progress
              </button>
              <button
                onClick={() => setFilters((prev) => ({ ...prev, status: "completed" }))}
                className={`px-3 py-1.5 rounded-full text-xs font-medium transition-colors ${
                  filters.status === "completed"
                    ? "bg-green-600 text-white"
                    : "bg-green-100 dark:bg-green-900/30 text-green-800 dark:text-green-300 hover:bg-green-200 dark:hover:bg-green-900/50"
                }`}
              >
                Completed
              </button>
              <button
                onClick={() => setFilters((prev) => ({ ...prev, status: "rejected" }))}
                className={`px-3 py-1.5 rounded-full text-xs font-medium transition-colors ${
                  filters.status === "rejected"
                    ? "bg-red-600 text-white"
                    : "bg-red-100 dark:bg-red-900/30 text-red-800 dark:text-red-300 hover:bg-red-200 dark:hover:bg-red-900/50"
                }`}
              >
                Rejected
              </button>
            </div>
          </div>

          {/* Priority Filters */}
          <div className="flex items-center gap-2">
            <AlertCircle className="h-3.5 w-3.5 text-gray-500 dark:text-gray-400" />
            <span className="text-xs font-medium text-gray-600 dark:text-gray-400">Priority:</span>
            <div className="flex flex-wrap gap-2">
              <button
                onClick={() => setFilters((prev) => ({ ...prev, priority: "all" }))}
                className={`px-3 py-1.5 rounded-full text-xs font-medium transition-colors ${
                  filters.priority === "all"
                    ? "bg-blue-600 text-white"
                    : "bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-300 hover:bg-gray-200 dark:hover:bg-gray-600"
                }`}
              >
                All
              </button>
              <button
                onClick={() => setFilters((prev) => ({ ...prev, priority: "High" }))}
                className={`px-3 py-1.5 rounded-full text-xs font-medium transition-colors ${
                  filters.priority === "High"
                    ? "bg-red-600 text-white"
                    : "bg-red-100 dark:bg-red-900/30 text-red-800 dark:text-red-300 hover:bg-red-200 dark:hover:bg-red-900/50"
                }`}
              >
                High
              </button>
              <button
                onClick={() => setFilters((prev) => ({ ...prev, priority: "Medium" }))}
                className={`px-3 py-1.5 rounded-full text-xs font-medium transition-colors ${
                  filters.priority === "Medium"
                    ? "bg-orange-600 text-white"
                    : "bg-orange-100 dark:bg-orange-900/30 text-orange-800 dark:text-orange-300 hover:bg-orange-200 dark:hover:bg-orange-900/50"
                }`}
              >
                Medium
              </button>
              <button
                onClick={() => setFilters((prev) => ({ ...prev, priority: "Low" }))}
                className={`px-3 py-1.5 rounded-full text-xs font-medium transition-colors ${
                  filters.priority === "Low"
                    ? "bg-gray-600 text-white"
                    : "bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-300 hover:bg-gray-200 dark:hover:bg-gray-600"
                }`}
              >
                Low
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* Task List */}
      <div className="flex-1 overflow-y-auto space-y-3">
        {loading ? (
          <div className="flex items-center justify-center h-64">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
          </div>
        ) : filteredTasks.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-64 text-gray-500 dark:text-gray-400">
            <Filter className="h-12 w-12 mb-2 opacity-50" />
            <p className="text-sm">
              {tasks.length === 0 ? "No tasks found" : "No tasks match the filters"}
            </p>
          </div>
        ) : (
          filteredTasks.map((task) => (
            <div
              key={task._id}
              className="p-4 border border-gray-200 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 hover:shadow-md transition-shadow"
            >
              {/* Task Header */}
              <div className="flex items-start justify-between mb-2">
                <div className="flex-1">
                  <h3 className="font-semibold text-gray-900 dark:text-white mb-1">{task.title}</h3>
                  <div className="flex flex-wrap gap-2 mb-2">
                    {getStatusBadge(task.status)}
                    {getPriorityBadge(task.priority)}
                  </div>
                </div>
              </div>

              {/* Task Description */}
              {task.description && (
                <p className="text-sm text-gray-600 dark:text-gray-400 mb-3 line-clamp-2">{task.description}</p>
              )}

              {/* Task Meta */}
              <div className="flex items-center gap-4 text-xs text-gray-500 dark:text-gray-400 mb-3">
                <div className="flex items-center gap-1">
                  <Calendar className="h-3.5 w-3.5" />
                  {formatDate(task.dueDate)}
                </div>
                {task.remarks && task.remarks.length > 0 && (
                  <div className="flex items-center gap-1">
                    <MessageSquare className="h-3.5 w-3.5" />
                    {task.remarks.length} remark{task.remarks.length !== 1 ? "s" : ""}
                  </div>
                )}
              </div>

              {/* Assigned By */}
              {task.assignedBy && (
                <div className="text-xs text-gray-500 dark:text-gray-400 mb-3">
                  Assigned by: <span className="font-medium">{task.assignedBy.name}</span>
                </div>
              )}

              {/* Actions */}
              <div className="flex gap-2 pt-3 border-t border-gray-100 dark:border-gray-600">
                <button
                  onClick={() => onViewDetails(task)}
                  className="flex-1 flex items-center justify-center gap-1.5 px-3 py-1.5 text-sm font-medium text-blue-700 dark:text-blue-300 bg-blue-50 dark:bg-blue-900/30 rounded hover:bg-blue-100 dark:hover:bg-blue-900/50 transition-colors"
                >
                  <Eye className="h-3.5 w-3.5" />
                  View
                </button>
                <button
                  onClick={() => onEditTask(task)}
                  className="flex-1 flex items-center justify-center gap-1.5 px-3 py-1.5 text-sm font-medium text-gray-700 dark:text-gray-300 bg-gray-50 dark:bg-gray-600 rounded hover:bg-gray-100 dark:hover:bg-gray-500 transition-colors"
                >
                  <Edit2 className="h-3.5 w-3.5" />
                  Edit
                </button>
                <button
                  onClick={() => onReassignTask(task)}
                  className="flex-1 flex items-center justify-center gap-1.5 px-3 py-1.5 text-sm font-medium text-green-700 dark:text-green-300 bg-green-50 dark:bg-green-900/30 rounded hover:bg-green-100 dark:hover:bg-green-900/50 transition-colors"
                >
                  <UserPlus className="h-3.5 w-3.5" />
                  Reassign
                </button>
                <button
                  onClick={() => onDeleteTask(task)}
                  className="flex items-center justify-center gap-1.5 px-3 py-1.5 text-sm font-medium text-red-700 dark:text-red-300 bg-red-50 dark:bg-red-900/30 rounded hover:bg-red-100 dark:hover:bg-red-900/50 transition-colors"
                >
                  <Trash2 className="h-3.5 w-3.5" />
                </button>
              </div>
            </div>
          ))
        )}
      </div>
    </div>
  );
};

export default TeamMemberTaskView;
