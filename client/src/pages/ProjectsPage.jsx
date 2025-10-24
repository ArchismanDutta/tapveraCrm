import React, { useState, useEffect, useMemo, useRef, useCallback } from "react";
import API from "../api";
import { useNavigate } from "react-router-dom";
import {
  FolderKanban,
  Plus,
  Search,
  RefreshCw,
  Download,
  Edit2,
  Trash2,
  X,
  AlertCircle,
  CheckCircle,
  XCircle,
  Globe,
  TrendingUp,
  Package,
  Mail,
  Server,
  FileText,
  ChevronDown,
  ChevronUp,
  MessageSquare,
  ChevronLeft,
  ChevronRight,
  Calendar,
  Filter,
  Users
} from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import Sidebar from "../components/dashboard/Sidebar";

// Custom hook for debouncing
const useDebounce = (value, delay) => {
  const [debouncedValue, setDebouncedValue] = useState(value);

  useEffect(() => {
    const handler = setTimeout(() => {
      setDebouncedValue(value);
    }, delay);

    return () => {
      clearTimeout(handler);
    };
  }, [value, delay]);

  return debouncedValue;
};

// Project Type Icons
const PROJECT_TYPE_ICONS = {
  Website: Globe,
  SEO: TrendingUp,
  "Google Marketing": Package,
  SMO: Mail,
  Hosting: Server,
  "Invoice App": FileText,
};

// Project Type Colors
const PROJECT_TYPE_COLORS = {
  Website: { bg: "bg-blue-600/20", text: "text-blue-400", border: "border-blue-500/50" },
  SEO: { bg: "bg-green-600/20", text: "text-green-400", border: "border-green-500/50" },
  "Google Marketing": { bg: "bg-purple-600/20", text: "text-purple-400", border: "border-purple-500/50" },
  SMO: { bg: "bg-orange-600/20", text: "text-orange-400", border: "border-orange-500/50" },
  Hosting: { bg: "bg-cyan-600/20", text: "text-cyan-400", border: "border-cyan-500/50" },
  "Invoice App": { bg: "bg-pink-600/20", text: "text-pink-400", border: "border-pink-500/50" },
};

// Animation variants
const containerVariants = {
  hidden: { opacity: 0 },
  visible: {
    opacity: 1,
    transition: {
      staggerChildren: 0.08,
      delayChildren: 0.1,
    },
  },
};

const cardVariants = {
  hidden: { opacity: 0, y: 20, scale: 0.95 },
  visible: {
    opacity: 1,
    y: 0,
    scale: 1,
    transition: {
      type: "spring",
      stiffness: 260,
      damping: 20,
    },
  },
};

const tableRowVariants = {
  hidden: { opacity: 0, x: -20 },
  visible: (i) => ({
    opacity: 1,
    x: 0,
    transition: {
      delay: i * 0.05,
      type: "spring",
      stiffness: 300,
      damping: 24,
    },
  }),
  exit: {
    opacity: 0,
    x: 20,
    transition: { duration: 0.2 },
  },
};

const modalVariants = {
  hidden: { opacity: 0, scale: 0.9, y: 20 },
  visible: {
    opacity: 1,
    scale: 1,
    y: 0,
    transition: {
      type: "spring",
      stiffness: 300,
      damping: 25,
    },
  },
  exit: {
    opacity: 0,
    scale: 0.9,
    y: 20,
    transition: { duration: 0.2 },
  },
};

const overlayVariants = {
  hidden: { opacity: 0 },
  visible: { opacity: 1, transition: { duration: 0.2 } },
  exit: { opacity: 0, transition: { duration: 0.2 } },
};

const statCounterVariants = {
  hidden: { scale: 0.5, opacity: 0 },
  visible: {
    scale: 1,
    opacity: 1,
    transition: {
      type: "spring",
      stiffness: 400,
      damping: 15,
    },
  },
};

const ProjectsPage = ({ onLogout }) => {
  const navigate = useNavigate();
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);
  const [projects, setProjects] = useState([]);
  const [clients, setClients] = useState([]);
  const [employees, setEmployees] = useState([]);
  const [loading, setLoading] = useState(false);
  const [notification, setNotification] = useState(null);
  const [userRole, setUserRole] = useState("admin"); // Default to admin

  // Refs for click-outside detection
  const employeeDropdownRef = useRef(null);
  const editEmployeeDropdownRef = useRef(null);

  // Form state
  const [showAddModal, setShowAddModal] = useState(false);
  const [showEditModal, setShowEditModal] = useState(false);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [showViewModal, setShowViewModal] = useState(false);
  const [selectedProject, setSelectedProject] = useState(null);
  const [form, setForm] = useState({
    projectName: "",
    type: "Website",
    assignedTo: [],
    client: "",
    startDate: "",
    endDate: "",
    description: "",
    priority: "Medium"
  });
  const [projectTasks, setProjectTasks] = useState([]);

  const [showEmployeeDropdown, setShowEmployeeDropdown] = useState(false);
  const [employeeSearchTerm, setEmployeeSearchTerm] = useState("");
  const [showEditEmployeeDropdown, setShowEditEmployeeDropdown] = useState(false);
  const [editEmployeeSearchTerm, setEditEmployeeSearchTerm] = useState("");

  // Filter state
  const [searchTerm, setSearchTerm] = useState("");
  const [filterType, setFilterType] = useState("all");
  const [filterStatus, setFilterStatus] = useState("all");
  const [filterEmployee, setFilterEmployee] = useState("all");
  const [filterClient, setFilterClient] = useState("all");
  const [filterDateRange, setFilterDateRange] = useState("all"); // all, next7days, next30days, expired
  const [sortBy, setSortBy] = useState("createdAt");
  const [expandedStats, setExpandedStats] = useState({});

  // Pagination state
  const [currentPage, setCurrentPage] = useState(1);
  const projectsPerPage = 20;

  // Bulk action state
  const [selectedProjects, setSelectedProjects] = useState([]);
  const [showBulkActions, setShowBulkActions] = useState(false);
  const [bulkAction, setBulkAction] = useState("");

  // Per-operation loading
  const [operationLoading, setOperationLoading] = useState({
    delete: false,
    edit: false,
    add: false,
    bulkDelete: false,
    bulkStatusUpdate: false,
    statusUpdate: {}
  });

  // Advanced filters toggle
  const [showAdvancedFilters, setShowAdvancedFilters] = useState(false);

  // Debounced search term
  const debouncedSearchTerm = useDebounce(searchTerm, 300);

  useEffect(() => {
    // Get user role from localStorage
    try {
      const userStr = localStorage.getItem("user");
      if (userStr) {
        const user = JSON.parse(userStr);
        setUserRole(user.role || "admin");
      }
    } catch (error) {
      console.error("Error parsing user data:", error);
    }

    fetchAllData();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Click outside to close dropdowns
  useEffect(() => {
    const handleClickOutside = (event) => {
      // Close employee dropdown in Add Modal
      if (employeeDropdownRef.current && !employeeDropdownRef.current.contains(event.target)) {
        setShowEmployeeDropdown(false);
      }

      // Close employee dropdown in Edit Modal
      if (editEmployeeDropdownRef.current && !editEmployeeDropdownRef.current.contains(event.target)) {
        setShowEditEmployeeDropdown(false);
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, []);

  const fetchAllData = async () => {
    setLoading(true);
    try {
      await Promise.all([
        fetchProjects(),
        fetchClients(),
        fetchEmployees()
      ]);
    } catch (error) {
      console.error("Error fetching data:", error);
    } finally {
      setLoading(false);
    }
  };

  const fetchProjects = async () => {
    try {
      const res = await API.get("/api/projects");
      setProjects(res.data);
    } catch {
      showNotification("Error fetching projects", "error");
    }
  };

  const fetchClients = async () => {
    try {
      const res = await API.get("/api/clients");
      setClients(res.data.filter(c => c.status === "Active"));
    } catch (error) {
      console.error("Error fetching clients:", error);
    }
  };

  const fetchEmployees = async () => {
    try {
      // Fetch employees with workload data
      const res = await API.get("/api/users/workload");
      setEmployees(res.data);
    } catch (error) {
      console.error("Error fetching employees:", error);
      // Fallback to regular employee fetch if workload endpoint fails
      try {
        const fallbackRes = await API.get("/api/users");
        setEmployees(fallbackRes.data.filter(u => u.role === "employee"));
      } catch (fallbackError) {
        console.error("Fallback employee fetch failed:", fallbackError);
      }
    }
  };

  const handleAddProject = async (e) => {
    e.preventDefault();
    try {
      setOperationLoading(prev => ({ ...prev, add: true }));
      const res = await API.post("/api/projects", form);

      // Create tasks for the project
      const createdProjectId = res.data._id;
      const validTasks = projectTasks.filter(t => t.title.trim());

      for (const task of validTasks) {
        await API.post("/api/tasks", {
          title: task.title,
          description: task.description,
          assignedBy: res.data.createdBy,
          assignedTo: form.assignedTo,
          dueDate: task.dueDate,
          priority: task.priority,
          project: createdProjectId
        });
      }

      setShowAddModal(false);
      resetForm();
      fetchProjects();
      showNotification(
        validTasks.length > 0
          ? `Project added successfully with ${validTasks.length} task${validTasks.length > 1 ? 's' : ''}!`
          : "Project added successfully!",
        "success"
      );
    } catch (error) {
      showNotification(error.response?.data?.message || "Error adding project", "error");
    } finally {
      setOperationLoading(prev => ({ ...prev, add: false }));
    }
  };

  const handleEditProject = async (e) => {
    e.preventDefault();
    try {
      setOperationLoading(prev => ({ ...prev, edit: true }));

      // Update the project
      await API.put(`/api/projects/${selectedProject._id}`, form);

      setShowEditModal(false);
      setSelectedProject(null);
      resetForm();
      fetchProjects();
      showNotification("Project updated successfully!", "success");
    } catch (error) {
      showNotification(error.response?.data?.message || "Error updating project", "error");
    } finally {
      setOperationLoading(prev => ({ ...prev, edit: false }));
    }
  };

  const handleDeleteProject = async () => {
    try {
      setOperationLoading(prev => ({ ...prev, delete: true }));
      await API.delete(`/api/projects/${selectedProject._id}`);
      setShowDeleteConfirm(false);
      setSelectedProject(null);
      fetchProjects();
      showNotification("Project deleted successfully!", "success");
    } catch (error) {
      showNotification(error.response?.data?.message || "Error deleting project", "error");
    } finally {
      setOperationLoading(prev => ({ ...prev, delete: false }));
    }
  };

  const handleStatusUpdate = async (projectId, newStatus) => {
    try {
      setOperationLoading(prev => ({
        ...prev,
        statusUpdate: { ...prev.statusUpdate, [projectId]: true }
      }));
      await API.put(`/api/projects/${projectId}`, { status: newStatus });
      fetchProjects();
      showNotification("Project status updated successfully!", "success");
    } catch (error) {
      showNotification(error.response?.data?.message || "Error updating status", "error");
    } finally {
      setOperationLoading(prev => {
        const newStatusUpdate = { ...prev.statusUpdate };
        delete newStatusUpdate[projectId];
        return { ...prev, statusUpdate: newStatusUpdate };
      });
    }
  };

  const handleBulkDelete = async () => {
    try {
      setOperationLoading(prev => ({ ...prev, bulkDelete: true }));
      await Promise.all(
        selectedProjects.map(id => API.delete(`/api/projects/${id}`))
      );
      setSelectedProjects([]);
      setShowBulkActions(false);
      fetchProjects();
      showNotification(`${selectedProjects.length} project(s) deleted successfully!`, "success");
    } catch (error) {
      showNotification(error.response?.data?.message || "Error deleting projects", "error");
    } finally {
      setOperationLoading(prev => ({ ...prev, bulkDelete: false }));
    }
  };

  const handleBulkStatusUpdate = async (newStatus) => {
    try {
      setOperationLoading(prev => ({ ...prev, bulkStatusUpdate: true }));
      await Promise.all(
        selectedProjects.map(id =>
          API.put(`/api/projects/${id}`, { status: newStatus })
        )
      );
      setSelectedProjects([]);
      setShowBulkActions(false);
      fetchProjects();
      showNotification(`${selectedProjects.length} project(s) updated successfully!`, "success");
    } catch (error) {
      showNotification(error.response?.data?.message || "Error updating projects", "error");
    } finally {
      setOperationLoading(prev => ({ ...prev, bulkStatusUpdate: false }));
    }
  };

  const toggleSelectProject = (projectId) => {
    setSelectedProjects(prev =>
      prev.includes(projectId)
        ? prev.filter(id => id !== projectId)
        : [...prev, projectId]
    );
  };

  const toggleSelectAll = () => {
    if (selectedProjects.length === paginatedProjects.length) {
      setSelectedProjects([]);
    } else {
      setSelectedProjects(paginatedProjects.map(p => p._id));
    }
  };

  const resetForm = () => {
    setForm({
      projectName: "",
      type: "Website",
      assignedTo: [],
      client: "",
      startDate: "",
      endDate: "",
      description: "",
      priority: "Medium"
    });
    setProjectTasks([]);
    setShowEmployeeDropdown(false);
    setEmployeeSearchTerm("");
    setShowEditEmployeeDropdown(false);
    setEditEmployeeSearchTerm("");
  };

  const showNotification = (message, type) => {
    setNotification({ message, type });
    setTimeout(() => setNotification(null), 3000);
  };

  const openEditModal = async (project) => {
    setSelectedProject(project);
    setForm({
      projectName: project.projectName,
      type: project.type,
      assignedTo: project.assignedTo.map(e => e._id || e),
      client: project.client?._id || project.client,
      startDate: project.startDate ? new Date(project.startDate).toISOString().split('T')[0] : "",
      endDate: project.endDate ? new Date(project.endDate).toISOString().split('T')[0] : "",
      description: project.description || "",
      priority: project.priority || "Medium"
    });

    setShowEditModal(true);
  };

  const getProjectStatus = (project) => {
    const today = new Date();
    const endDate = new Date(project.endDate);

    if (project.status === "Completed") return "completed";
    if (project.status === "Inactive") return "inactive";
    if (endDate < today) return "needsRenewal";
    if (project.status === "Active") return "active";
    return "inactive";
  };

  // Calculate project progress based on multiple methods
  const getProjectProgress = (project) => {
    // Method 1: Calculate from tasks
    const tasks = project.tasks || [];
    if (tasks.length > 0) {
      const completedTasks = tasks.filter(t => t.status === "Completed").length;
      return Math.round((completedTasks / tasks.length) * 100);
    }

    // Method 2: Calculate from milestones
    const milestones = project.milestones || [];
    if (milestones.length > 0) {
      const completedMilestones = milestones.filter(m => m.completed).length;
      return Math.round((completedMilestones / milestones.length) * 100);
    }

    // Method 3: Calculate from timeline (start date to end date)
    if (project.startDate && project.endDate) {
      const start = new Date(project.startDate).getTime();
      const end = new Date(project.endDate).getTime();
      const now = new Date().getTime();

      // If project is completed, return 100%
      if (project.status === "Completed") return 100;

      // If project hasn't started yet, return 0%
      if (now < start) return 0;

      // If project is overdue, return 100%
      if (now > end) return 100;

      // Calculate progress based on time elapsed
      const totalDuration = end - start;
      const elapsed = now - start;
      return Math.min(100, Math.max(0, Math.round((elapsed / totalDuration) * 100)));
    }

    // Default: return 0 if no calculation method available
    return 0;
  };

  // Get project health indicators
  const getProjectHealth = (project) => {
    const health = {
      isOverdue: false,
      hasNoActivity: false,
      exceedsBudget: false,
      indicators: []
    };

    const today = new Date();
    const endDate = new Date(project.endDate);

    // Check if overdue
    if (endDate < today && project.status !== "Completed") {
      health.isOverdue = true;
      health.indicators.push({
        type: "overdue",
        label: "Overdue",
        color: "red"
      });
    }

    // Check for no recent activity (placeholder - would need actual activity data)
    const lastUpdate = new Date(project.updatedAt || project.createdAt);
    const daysSinceUpdate = Math.floor((today - lastUpdate) / (1000 * 60 * 60 * 24));
    if (daysSinceUpdate > 30 && project.status === "Active") {
      health.hasNoActivity = true;
      health.indicators.push({
        type: "no-activity",
        label: "No recent activity",
        color: "orange"
      });
    }

    // Check if exceeds budget (placeholder)
    if (project.budget && project.spent > project.budget) {
      health.exceedsBudget = true;
      health.indicators.push({
        type: "over-budget",
        label: "Over budget",
        color: "red"
      });
    }

    return health;
  };

  // Calculate statistics by type
  const projectStats = useMemo(() => {
    const types = ["Website", "SEO", "Google Marketing", "SMO", "Hosting", "Invoice App"];
    const stats = {};

    types.forEach(type => {
      const typeProjects = projects.filter(p => p.type === type);
      stats[type] = {
        total: typeProjects.length,
        active: typeProjects.filter(p => getProjectStatus(p) === "active").length,
        inactive: typeProjects.filter(p => getProjectStatus(p) === "inactive").length,
        needsRenewal: typeProjects.filter(p => getProjectStatus(p) === "needsRenewal").length,
        completed: typeProjects.filter(p => getProjectStatus(p) === "completed").length,
      };
    });

    return stats;
  }, [projects]);

  // Overall statistics
  const overallStats = useMemo(() => {
    return {
      total: projects.length,
      active: projects.filter(p => getProjectStatus(p) === "active").length,
      inactive: projects.filter(p => getProjectStatus(p) === "inactive").length,
      needsRenewal: projects.filter(p => getProjectStatus(p) === "needsRenewal").length,
      completed: projects.filter(p => getProjectStatus(p) === "completed").length,
    };
  }, [projects]);

  // Filtered and sorted projects
  const filteredProjects = useMemo(() => {
    let filtered = projects.filter(p => {
      const matchesSearch =
        p.projectName?.toLowerCase().includes(debouncedSearchTerm.toLowerCase()) ||
        p.client?.businessName?.toLowerCase().includes(debouncedSearchTerm.toLowerCase()) ||
        p.client?.clientName?.toLowerCase().includes(debouncedSearchTerm.toLowerCase());

      const matchesType = filterType === "all" || p.type === filterType;

      const projectStatus = getProjectStatus(p);
      const matchesStatus =
        filterStatus === "all" ||
        (filterStatus === "active" && projectStatus === "active") ||
        (filterStatus === "inactive" && projectStatus === "inactive") ||
        (filterStatus === "needsRenewal" && projectStatus === "needsRenewal") ||
        (filterStatus === "completed" && projectStatus === "completed");

      const matchesEmployee =
        filterEmployee === "all" ||
        p.assignedTo?.some(e => (e._id || e) === filterEmployee);

      const matchesClient =
        filterClient === "all" ||
        (p.client?._id || p.client) === filterClient;

      // Date range filter
      const today = new Date();
      const endDate = new Date(p.endDate);
      const daysUntilEnd = Math.ceil((endDate - today) / (1000 * 60 * 60 * 24));

      const matchesDateRange =
        filterDateRange === "all" ||
        (filterDateRange === "next7days" && daysUntilEnd >= 0 && daysUntilEnd <= 7) ||
        (filterDateRange === "next30days" && daysUntilEnd >= 0 && daysUntilEnd <= 30) ||
        (filterDateRange === "expired" && daysUntilEnd < 0);

      return matchesSearch && matchesType && matchesStatus && matchesEmployee && matchesClient && matchesDateRange;
    });

    // Sort
    filtered.sort((a, b) => {
      switch (sortBy) {
        case "name":
          return a.projectName.localeCompare(b.projectName);
        case "startDate":
          return new Date(b.startDate) - new Date(a.startDate);
        case "endDate":
          return new Date(a.endDate) - new Date(b.endDate);
        case "type":
          return a.type.localeCompare(b.type);
        default:
          return new Date(b.createdAt) - new Date(a.createdAt);
      }
    });

    return filtered;
  }, [projects, debouncedSearchTerm, filterType, filterStatus, filterEmployee, filterClient, filterDateRange, sortBy]);

  // Paginated projects
  const paginatedProjects = useMemo(() => {
    const startIndex = (currentPage - 1) * projectsPerPage;
    const endIndex = startIndex + projectsPerPage;
    return filteredProjects.slice(startIndex, endIndex);
  }, [filteredProjects, currentPage, projectsPerPage]);

  const totalPages = Math.ceil(filteredProjects.length / projectsPerPage);

  // Reset to page 1 when filters change
  useEffect(() => {
    setCurrentPage(1);
  }, [debouncedSearchTerm, filterType, filterStatus, filterEmployee, filterClient, filterDateRange]);

  const exportToCSV = () => {
    const csvContent = [
      ["Project Name", "Type", "Client", "Assigned To", "Start Date", "End Date", "Status"],
      ...filteredProjects.map(p => [
        p.projectName,
        p.type,
        p.client?.businessName || "N/A",
        p.assignedTo?.map(e => e.name || "Unknown").join("; ") || "N/A",
        p.startDate ? new Date(p.startDate).toLocaleDateString() : "N/A",
        p.endDate ? new Date(p.endDate).toLocaleDateString() : "N/A",
        getProjectStatus(p)
      ])
    ].map(row => row.join(",")).join("\n");

    const blob = new Blob([csvContent], { type: "text/csv" });
    const url = window.URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `projects_export_${new Date().toISOString().split("T")[0]}.csv`;
    a.click();
    showNotification("Projects exported successfully!", "success");
  };

  return (
    <div className="flex bg-gradient-to-br from-[#141a21] via-[#191f2b] to-[#101218] font-sans text-blue-100 min-h-screen">
      <Sidebar
        collapsed={sidebarCollapsed}
        setCollapsed={setSidebarCollapsed}
        onLogout={onLogout}
        userRole={userRole}
      />

      <main className={`flex-1 p-8 overflow-y-auto transition-all duration-300 ${sidebarCollapsed ? "ml-20" : "ml-72"}`}>
        {/* Notification Toast */}
        {notification && (
          <div className={`fixed top-4 right-4 z-50 px-6 py-4 rounded-lg shadow-2xl border flex items-center gap-3 animate-slide-in ${
            notification.type === "success"
              ? "bg-green-600/90 border-green-500 text-white"
              : "bg-red-600/90 border-red-500 text-white"
          }`}>
            {notification.type === "success" ? <CheckCircle className="w-5 h-5" /> : <AlertCircle className="w-5 h-5" />}
            <span className="font-medium">{notification.message}</span>
          </div>
        )}

        {/* Header */}
        <div className="flex flex-col lg:flex-row lg:justify-between lg:items-start gap-6 mb-8">
          <div>
            <h1 className="text-3xl font-bold text-white tracking-tight mb-2">
              Project Management
            </h1>
            <p className="text-blue-300">Manage all your projects and track their progress</p>
          </div>

          <div className="flex items-center gap-3">
            <button
              onClick={exportToCSV}
              className="flex items-center gap-2 px-4 py-2 rounded-lg bg-green-600/20 hover:bg-green-600/40 text-green-400 border border-green-500/30 transition-colors"
            >
              <Download className="w-4 h-4" />
              <span className="hidden sm:inline">Export</span>
            </button>

            <button
              onClick={fetchAllData}
              className="flex items-center gap-2 px-4 py-2 rounded-lg bg-blue-600/20 hover:bg-blue-600/40 text-blue-400 border border-blue-500/30 transition-colors"
              disabled={loading}
            >
              <RefreshCw className={`w-4 h-4 ${loading ? "animate-spin" : ""}`} />
              <span className="hidden sm:inline">Refresh</span>
            </button>

            <button
              onClick={() => setShowAddModal(true)}
              className="flex items-center gap-2 px-4 py-2 rounded-lg bg-gradient-to-r from-purple-600 to-pink-600 hover:from-purple-700 hover:to-pink-700 text-white transition-all shadow-lg"
            >
              <Plus className="w-4 h-4" />
              <span className="hidden sm:inline">Add Project</span>
            </button>
          </div>
        </div>

        {/* Overall Statistics */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-6 mb-8">
          <div className="bg-[#191f2b]/70 rounded-xl shadow-xl border border-[#232945] p-6">
            <div className="flex items-center justify-between mb-3">
              <div className="p-3 rounded-lg bg-blue-600/20">
                <FolderKanban className="w-6 h-6 text-blue-400" />
              </div>
            </div>
            <p className="text-sm text-gray-400 mb-1">Total Projects</p>
            <p className="text-3xl font-bold text-white">{overallStats.total}</p>
          </div>

          <div className="bg-[#191f2b]/70 rounded-xl shadow-xl border border-[#232945] p-6">
            <div className="flex items-center justify-between mb-3">
              <div className="p-3 rounded-lg bg-green-600/20">
                <CheckCircle className="w-6 h-6 text-green-400" />
              </div>
            </div>
            <p className="text-sm text-gray-400 mb-1">Active</p>
            <p className="text-3xl font-bold text-green-400">{overallStats.active}</p>
          </div>

          <div className="bg-[#191f2b]/70 rounded-xl shadow-xl border border-[#232945] p-6">
            <div className="flex items-center justify-between mb-3">
              <div className="p-3 rounded-lg bg-red-600/20">
                <XCircle className="w-6 h-6 text-red-400" />
              </div>
            </div>
            <p className="text-sm text-gray-400 mb-1">Inactive</p>
            <p className="text-3xl font-bold text-red-400">{overallStats.inactive}</p>
          </div>

          <div className="bg-[#191f2b]/70 rounded-xl shadow-xl border border-[#232945] p-6">
            <div className="flex items-center justify-between mb-3">
              <div className="p-3 rounded-lg bg-orange-600/20">
                <AlertCircle className="w-6 h-6 text-orange-400" />
              </div>
            </div>
            <p className="text-sm text-gray-400 mb-1">Needs Renewal</p>
            <p className="text-3xl font-bold text-orange-400">{overallStats.needsRenewal}</p>
          </div>

          <div className="bg-[#191f2b]/70 rounded-xl shadow-xl border border-[#232945] p-6">
            <div className="flex items-center justify-between mb-3">
              <div className="p-3 rounded-lg bg-purple-600/20">
                <CheckCircle className="w-6 h-6 text-purple-400" />
              </div>
            </div>
            <p className="text-sm text-gray-400 mb-1">Completed</p>
            <p className="text-3xl font-bold text-purple-400">{overallStats.completed}</p>
          </div>
        </div>

        {/* Project Type Statistics */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 mb-8">
          {Object.entries(projectStats).map(([type, stats]) => {
            const Icon = PROJECT_TYPE_ICONS[type];
            const colors = PROJECT_TYPE_COLORS[type];
            const isExpanded = expandedStats[type];

            return (
              <div key={type} className={`${colors.bg} rounded-xl shadow-xl border ${colors.border} p-6 transition-all`}>
                <div className="flex items-center justify-between mb-4">
                  <div className="flex items-center gap-3">
                    <div className={`p-2 rounded-lg ${colors.bg}`}>
                      <Icon className={`w-5 h-5 ${colors.text}`} />
                    </div>
                    <div>
                      <h3 className={`font-semibold ${colors.text}`}>{type}</h3>
                      <p className="text-sm text-gray-400">{stats.total} projects</p>
                    </div>
                  </div>
                  <button
                    onClick={() => setExpandedStats(prev => ({ ...prev, [type]: !prev[type] }))}
                    className={`${colors.text} hover:opacity-70 transition-opacity`}
                  >
                    {isExpanded ? <ChevronUp className="w-5 h-5" /> : <ChevronDown className="w-5 h-5" />}
                  </button>
                </div>

                {isExpanded && (
                  <div className="grid grid-cols-2 gap-3 mt-4 pt-4 border-t border-gray-700">
                    <div className="text-center p-3 rounded-lg bg-green-600/10 border border-green-500/20">
                      <p className="text-2xl font-bold text-green-400">{stats.active}</p>
                      <p className="text-xs text-gray-400 mt-1">Active</p>
                    </div>
                    <div className="text-center p-3 rounded-lg bg-red-600/10 border border-red-500/20">
                      <p className="text-2xl font-bold text-red-400">{stats.inactive}</p>
                      <p className="text-xs text-gray-400 mt-1">Inactive</p>
                    </div>
                    <div className="text-center p-3 rounded-lg bg-orange-600/10 border border-orange-500/20">
                      <p className="text-2xl font-bold text-orange-400">{stats.needsRenewal}</p>
                      <p className="text-xs text-gray-400 mt-1">Needs Renewal</p>
                    </div>
                    <div className="text-center p-3 rounded-lg bg-purple-600/10 border border-purple-500/20">
                      <p className="text-2xl font-bold text-purple-400">{stats.completed}</p>
                      <p className="text-xs text-gray-400 mt-1">Completed</p>
                    </div>
                  </div>
                )}
              </div>
            );  
          })}
        </div>

        {/* Projects Table */}
        <div className="bg-[#191f2b]/70 rounded-xl shadow-xl border border-[#232945] p-6">
          <div className="flex items-center gap-2 mb-6">
            <FolderKanban className="w-5 h-5 text-blue-400" />
            <h3 className="text-lg font-semibold text-white">All Projects</h3>
            {loading && <div className="w-4 h-4 border-2 border-blue-500/20 border-t-blue-500 rounded-full animate-spin"></div>}
          </div>

          {/* Filters */}
          <div className="space-y-4 mb-6">
            {/* Basic Filters */}
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-4">
              <div className="relative">
                <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 w-4 h-4 text-gray-500" />
                <input
                  type="text"
                  placeholder="Search projects..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="w-full pl-10 pr-4 py-2 bg-[#0f1419] border border-[#232945] rounded-lg text-white placeholder-gray-500 focus:outline-none focus:border-blue-500 transition-colors"
                />
              </div>

              <select
                value={filterType}
                onChange={(e) => setFilterType(e.target.value)}
                className="px-4 py-2 bg-[#0f1419] border border-[#232945] rounded-lg text-white focus:outline-none focus:border-blue-500 transition-colors"
              >
                <option value="all">All Types</option>
                <option value="Website">Website</option>
                <option value="SEO">SEO</option>
                <option value="Google Marketing">Google Marketing</option>
                <option value="SMO">SMO</option>
                <option value="Hosting">Hosting</option>
                <option value="Invoice App">Invoice App</option>
              </select>

              <select
                value={filterStatus}
                onChange={(e) => setFilterStatus(e.target.value)}
                className="px-4 py-2 bg-[#0f1419] border border-[#232945] rounded-lg text-white focus:outline-none focus:border-blue-500 transition-colors"
              >
                <option value="all">All Status</option>
                <option value="active">Active</option>
                <option value="inactive">Inactive</option>
                <option value="needsRenewal">Needs Renewal</option>
                <option value="completed">Completed</option>
              </select>

              <select
                value={filterEmployee}
                onChange={(e) => setFilterEmployee(e.target.value)}
                className="px-4 py-2 bg-[#0f1419] border border-[#232945] rounded-lg text-white focus:outline-none focus:border-blue-500 transition-colors"
              >
                <option value="all">All Employees</option>
                {employees.map(emp => (
                  <option key={emp._id} value={emp._id}>{emp.name}</option>
                ))}
              </select>

              <select
                value={sortBy}
                onChange={(e) => setSortBy(e.target.value)}
                className="px-4 py-2 bg-[#0f1419] border border-[#232945] rounded-lg text-white focus:outline-none focus:border-blue-500 transition-colors"
              >
                <option value="createdAt">Sort by Created</option>
                <option value="name">Sort by Name</option>
                <option value="startDate">Sort by Start Date</option>
                <option value="endDate">Sort by End Date</option>
                <option value="type">Sort by Type</option>
              </select>
            </div>

            {/* Advanced Filters Toggle */}
            <div className="flex items-center justify-between">
              <button
                onClick={() => setShowAdvancedFilters(!showAdvancedFilters)}
                className="flex items-center gap-2 px-3 py-1.5 text-sm text-blue-400 hover:text-blue-300 transition-colors"
              >
                <Filter className="w-4 h-4" />
                {showAdvancedFilters ? "Hide" : "Show"} Advanced Filters
                <ChevronDown className={`w-4 h-4 transition-transform ${showAdvancedFilters ? "rotate-180" : ""}`} />
              </button>

              {(searchTerm || filterType !== "all" || filterStatus !== "all" || filterEmployee !== "all" || filterClient !== "all" || filterDateRange !== "all") && (
                <button
                  onClick={() => {
                    setSearchTerm("");
                    setFilterType("all");
                    setFilterStatus("all");
                    setFilterEmployee("all");
                    setFilterClient("all");
                    setFilterDateRange("all");
                  }}
                  className="text-sm text-red-400 hover:text-red-300 transition-colors"
                >
                  Clear all filters
                </button>
              )}
            </div>

            {/* Advanced Filters */}
            {showAdvancedFilters && (
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4 p-4 bg-[#0f1419] rounded-lg border border-[#232945]">
                <div>
                  <label className="block text-xs text-gray-400 mb-2 flex items-center gap-2">
                    <Users className="w-3 h-3" />
                    Filter by Client
                  </label>
                  <select
                    value={filterClient}
                    onChange={(e) => setFilterClient(e.target.value)}
                    className="w-full px-3 py-2 bg-[#141a21] border border-[#232945] rounded-lg text-white text-sm focus:outline-none focus:border-blue-500 transition-colors"
                  >
                    <option value="all">All Clients</option>
                    {clients.map(client => (
                      <option key={client._id} value={client._id}>
                        {client.businessName || client.clientName}
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="block text-xs text-gray-400 mb-2 flex items-center gap-2">
                    <Calendar className="w-3 h-3" />
                    Date Range
                  </label>
                  <select
                    value={filterDateRange}
                    onChange={(e) => setFilterDateRange(e.target.value)}
                    className="w-full px-3 py-2 bg-[#141a21] border border-[#232945] rounded-lg text-white text-sm focus:outline-none focus:border-blue-500 transition-colors"
                  >
                    <option value="all">All Dates</option>
                    <option value="next7days">Ending in 7 days</option>
                    <option value="next30days">Ending in 30 days</option>
                    <option value="expired">Expired/Overdue</option>
                  </select>
                </div>

                <div>
                  <label className="block text-xs text-gray-400 mb-2">
                    Active Filters
                  </label>
                  <div className="flex flex-wrap gap-1">
                    {filterClient !== "all" && (
                      <span className="px-2 py-1 bg-blue-600/20 text-blue-400 text-xs rounded-full border border-blue-500/30">
                        Client: {clients.find(c => c._id === filterClient)?.businessName || "Selected"}
                      </span>
                    )}
                    {filterDateRange !== "all" && (
                      <span className="px-2 py-1 bg-green-600/20 text-green-400 text-xs rounded-full border border-green-500/30">
                        {filterDateRange === "next7days" ? "7 days" : filterDateRange === "next30days" ? "30 days" : "Expired"}
                      </span>
                    )}
                    {(filterClient === "all" && filterDateRange === "all") && (
                      <span className="text-xs text-gray-500">No advanced filters active</span>
                    )}
                  </div>
                </div>
              </div>
            )}
          </div>

          {/* Bulk Actions Bar */}
          {selectedProjects.length > 0 && (
            <div className="mb-4 p-4 bg-blue-600/10 border border-blue-500/30 rounded-lg flex items-center justify-between">
              <div className="flex items-center gap-3">
                <CheckCircle className="w-5 h-5 text-blue-400" />
                <span className="text-white font-medium">
                  {selectedProjects.length} project{selectedProjects.length > 1 ? 's' : ''} selected
                </span>
              </div>
              <div className="flex items-center gap-2">
                <select
                  value={bulkAction}
                  onChange={(e) => {
                    const action = e.target.value;
                    if (action === "delete") {
                      if (window.confirm(`Delete ${selectedProjects.length} project(s)? This cannot be undone.`)) {
                        handleBulkDelete();
                      }
                    } else if (action) {
                      handleBulkStatusUpdate(action);
                    }
                    setBulkAction("");
                  }}
                  className="px-4 py-2 bg-[#0f1419] border border-[#232945] rounded-lg text-white text-sm focus:outline-none focus:border-blue-500"
                  disabled={operationLoading.bulkDelete || operationLoading.bulkStatusUpdate}
                >
                  <option value="">Select Action</option>
                  <option value="Active">Set to Active</option>
                  <option value="Inactive">Set to Inactive</option>
                  <option value="Completed">Set to Completed</option>
                  <option value="delete">Delete Selected</option>
                </select>
                <button
                  onClick={() => setSelectedProjects([])}
                  className="px-4 py-2 bg-gray-700 hover:bg-gray-600 text-white rounded-lg text-sm transition-colors"
                >
                  Clear Selection
                </button>
              </div>
            </div>
          )}

          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="border-b border-[#232945]">
                  <th className="text-left p-4 text-sm font-semibold text-gray-400">
                    <input
                      type="checkbox"
                      checked={selectedProjects.length === paginatedProjects.length && paginatedProjects.length > 0}
                      onChange={toggleSelectAll}
                      className="w-4 h-4 rounded border-[#232945] bg-[#0f1419] text-purple-600 focus:ring-purple-500 focus:ring-offset-0"
                    />
                  </th>
                  <th className="text-left p-4 text-sm font-semibold text-gray-400">Project Name</th>
                  <th className="text-left p-4 text-sm font-semibold text-gray-400">Type</th>
                  <th className="text-left p-4 text-sm font-semibold text-gray-400">Client</th>
                  <th className="text-left p-4 text-sm font-semibold text-gray-400">Assigned To</th>
                  <th className="text-left p-4 text-sm font-semibold text-gray-400">Progress</th>
                  <th className="text-left p-4 text-sm font-semibold text-gray-400">End Date</th>
                  <th className="text-left p-4 text-sm font-semibold text-gray-400">Status</th>
                  <th className="text-left p-4 text-sm font-semibold text-gray-400">Health</th>
                  <th className="text-left p-4 text-sm font-semibold text-gray-400">Actions</th>
                </tr>
              </thead>
              <tbody>
                {paginatedProjects.length === 0 ? (
                  <tr>
                    <td colSpan="10" className="text-center py-12">
                      <FolderKanban className="w-12 h-12 text-gray-600 mx-auto mb-3" />
                      <p className="text-gray-500">No projects found</p>
                    </td>
                  </tr>
                ) : (
                  paginatedProjects.map((project) => {
                    const status = getProjectStatus(project);
                    const colors = PROJECT_TYPE_COLORS[project.type];
                    const Icon = PROJECT_TYPE_ICONS[project.type];
                    const progress = getProjectProgress(project);
                    const health = getProjectHealth(project);

                    return (
                      <tr key={project._id} className="border-b border-[#232945] hover:bg-[#0f1419] transition-colors">
                        <td className="p-4">
                          <input
                            type="checkbox"
                            checked={selectedProjects.includes(project._id)}
                            onChange={() => toggleSelectProject(project._id)}
                            className="w-4 h-4 rounded border-[#232945] bg-[#0f1419] text-purple-600 focus:ring-purple-500 focus:ring-offset-0"
                          />
                        </td>
                        <td className="p-4">
                          <button
                            onClick={() => navigate(`/project/${project._id}`)}
                            className="flex items-center gap-2 hover:opacity-70 transition-opacity text-left w-full"
                          >
                            <Icon className={`w-4 h-4 ${colors.text}`} />
                            <span className="text-white font-medium hover:text-purple-400 transition-colors">{project.projectName}</span>
                          </button>
                        </td>
                        <td className="p-4">
                          <span className={`px-3 py-1 rounded-full text-xs font-medium ${colors.bg} ${colors.text} border ${colors.border}`}>
                            {project.type}
                          </span>
                        </td>
                        <td className="p-4 text-gray-300">
                          {project.client?.businessName || project.client?.clientName || "N/A"}
                        </td>
                        <td className="p-4">
                          <div className="flex flex-col gap-1">
                            {project.assignedTo?.length === 0 ? (
                              <span className="text-gray-500 text-sm">Not assigned</span>
                            ) : project.assignedTo?.length <= 2 ? (
                              // Show full names if 2 or fewer employees
                              project.assignedTo.map((emp, idx) => (
                                <div key={idx} className="flex items-center gap-2">
                                  <div className="w-6 h-6 rounded-full bg-gradient-to-br from-purple-500 to-pink-500 flex items-center justify-center text-white text-xs font-semibold flex-shrink-0">
                                    {(emp.name || "U").charAt(0).toUpperCase()}
                                  </div>
                                  <span className="text-gray-300 text-sm">{emp.name || "Unknown"}</span>
                                </div>
                              ))
                            ) : (
                              // Show compact view with count if more than 2
                              <>
                                <div className="flex items-center gap-1">
                                  {project.assignedTo.slice(0, 2).map((emp, idx) => (
                                    <div
                                      key={idx}
                                      className="w-7 h-7 rounded-full bg-gradient-to-br from-purple-500 to-pink-500 flex items-center justify-center text-white text-xs font-semibold"
                                      title={emp.name || "Unknown"}
                                    >
                                      {(emp.name || "U").charAt(0).toUpperCase()}
                                    </div>
                                  ))}
                                  {project.assignedTo.length > 2 && (
                                    <div className="w-7 h-7 rounded-full bg-gray-700 flex items-center justify-center text-white text-xs font-semibold">
                                      +{project.assignedTo.length - 2}
                                    </div>
                                  )}
                                </div>
                                <span className="text-xs text-gray-400">
                                  {project.assignedTo.slice(0, 2).map(e => e.name || "Unknown").join(", ")}
                                  {project.assignedTo.length > 2 && ` +${project.assignedTo.length - 2} more`}
                                </span>
                              </>
                            )}
                          </div>
                        </td>
                        <td className="p-4">
                          <div className="w-full">
                            <div className="flex items-center justify-between mb-1">
                              <span className="text-xs text-gray-400">{progress}%</span>
                            </div>
                            <div className="w-full bg-gray-700 rounded-full h-2">
                              <div
                                className={`h-2 rounded-full transition-all ${
                                  progress === 100 ? 'bg-green-500' :
                                  progress >= 75 ? 'bg-blue-500' :
                                  progress >= 50 ? 'bg-yellow-500' :
                                  progress >= 25 ? 'bg-orange-500' : 'bg-red-500'
                                }`}
                                style={{ width: `${progress}%` }}
                              />
                            </div>
                          </div>
                        </td>
                        <td className="p-4 text-gray-300">
                          {project.endDate ? new Date(project.endDate).toLocaleDateString() : "N/A"}
                        </td>
                        <td className="p-4">
                          <select
                            value={project.status || status}
                            onChange={(e) => handleStatusUpdate(project._id, e.target.value)}
                            disabled={operationLoading.statusUpdate[project._id]}
                            className={`px-3 py-1 rounded-full text-xs font-medium border cursor-pointer focus:outline-none focus:ring-2 focus:ring-blue-500 ${
                              (project.status || status) === "Active" || status === "active" ? "bg-green-500/20 text-green-400 border-green-500/50" :
                              (project.status || status) === "Completed" || status === "completed" ? "bg-purple-500/20 text-purple-400 border-purple-500/50" :
                              status === "needsRenewal" ? "bg-orange-500/20 text-orange-400 border-orange-500/50" :
                              "bg-red-500/20 text-red-400 border-red-500/50"
                            }`}
                          >
                            <option value="Active">Active</option>
                            <option value="Inactive">Inactive</option>
                            <option value="Completed">Completed</option>
                          </select>
                        </td>
                        <td className="p-4">
                          <div className="flex flex-wrap gap-1">
                            {health.indicators.length === 0 ? (
                              <span className="px-2 py-1 rounded-full text-xs bg-green-600/20 text-green-400 border border-green-500/50">
                                ✓ Healthy
                              </span>
                            ) : (
                              health.indicators.map((indicator, idx) => (
                                <span
                                  key={idx}
                                  className={`px-2 py-1 rounded-full text-xs border ${
                                    indicator.color === "red" ? "bg-red-600/20 text-red-400 border-red-500/50" :
                                    indicator.color === "orange" ? "bg-orange-600/20 text-orange-400 border-orange-500/50" :
                                    "bg-yellow-600/20 text-yellow-400 border-yellow-500/50"
                                  }`}
                                  title={indicator.label}
                                >
                                  {indicator.type === "overdue" ? "⚠" : indicator.type === "no-activity" ? "💤" : "💰"}
                                </span>
                              ))
                            )}
                          </div>
                        </td>
                        <td className="p-4">
                          <div className="flex items-center gap-2">
                            <button
                              onClick={() => navigate(`/project/${project._id}`)}
                              className="p-2 rounded-lg text-blue-400 hover:text-blue-300 hover:bg-blue-500/10 transition-all"
                              title="View details & chat"
                            >
                              <MessageSquare className="w-4 h-4" />
                            </button>
                            <button
                              onClick={() => openEditModal(project)}
                              className="p-2 rounded-lg text-purple-400 hover:text-purple-300 hover:bg-purple-500/10 transition-all"
                              title="Edit project"
                            >
                              <Edit2 className="w-4 h-4" />
                            </button>
                            <button
                              onClick={() => {
                                setSelectedProject(project);
                                setShowDeleteConfirm(true);
                              }}
                              className="p-2 rounded-lg text-red-400 hover:text-red-300 hover:bg-red-500/10 transition-all"
                              title="Delete project"
                              disabled={operationLoading.delete}
                            >
                              <Trash2 className="w-4 h-4" />
                            </button>
                          </div>
                        </td>
                      </tr>
                    );
                  })
                )}
              </tbody>
            </table>
          </div>

          {/* Pagination Controls */}
          <div className="mt-6 flex flex-col sm:flex-row items-center justify-between gap-4">
            <div className="text-sm text-gray-400">
              Showing <span className="text-white font-medium">{((currentPage - 1) * projectsPerPage) + 1}</span> to{" "}
              <span className="text-white font-medium">
                {Math.min(currentPage * projectsPerPage, filteredProjects.length)}
              </span> of{" "}
              <span className="text-white font-medium">{filteredProjects.length}</span> projects
              {filteredProjects.length !== projects.length && (
                <span className="text-gray-500"> (filtered from {projects.length} total)</span>
              )}
            </div>

            {totalPages > 1 && (
              <div className="flex items-center gap-2">
                <button
                  onClick={() => setCurrentPage(prev => Math.max(1, prev - 1))}
                  disabled={currentPage === 1}
                  className={`p-2 rounded-lg border transition-all ${
                    currentPage === 1
                      ? "border-[#232945] text-gray-600 cursor-not-allowed"
                      : "border-blue-500/50 text-blue-400 hover:bg-blue-500/10"
                  }`}
                >
                  <ChevronLeft className="w-4 h-4" />
                </button>

                <div className="flex items-center gap-1">
                  {/* First page */}
                  {currentPage > 3 && (
                    <>
                      <button
                        onClick={() => setCurrentPage(1)}
                        className="px-3 py-1 rounded-lg border border-[#232945] text-gray-400 hover:bg-[#0f1419] transition-all"
                      >
                        1
                      </button>
                      <span className="text-gray-600">...</span>
                    </>
                  )}

                  {/* Page numbers */}
                  {Array.from({ length: totalPages }, (_, i) => i + 1)
                    .filter(page =>
                      page === currentPage ||
                      page === currentPage - 1 ||
                      page === currentPage + 1 ||
                      page === currentPage - 2 ||
                      page === currentPage + 2
                    )
                    .map(page => (
                      <button
                        key={page}
                        onClick={() => setCurrentPage(page)}
                        className={`px-3 py-1 rounded-lg border transition-all ${
                          currentPage === page
                            ? "border-blue-500 bg-blue-500/20 text-blue-400 font-medium"
                            : "border-[#232945] text-gray-400 hover:bg-[#0f1419]"
                        }`}
                      >
                        {page}
                      </button>
                    ))}

                  {/* Last page */}
                  {currentPage < totalPages - 2 && (
                    <>
                      <span className="text-gray-600">...</span>
                      <button
                        onClick={() => setCurrentPage(totalPages)}
                        className="px-3 py-1 rounded-lg border border-[#232945] text-gray-400 hover:bg-[#0f1419] transition-all"
                      >
                        {totalPages}
                      </button>
                    </>
                  )}
                </div>

                <button
                  onClick={() => setCurrentPage(prev => Math.min(totalPages, prev + 1))}
                  disabled={currentPage === totalPages}
                  className={`p-2 rounded-lg border transition-all ${
                    currentPage === totalPages
                      ? "border-[#232945] text-gray-600 cursor-not-allowed"
                      : "border-blue-500/50 text-blue-400 hover:bg-blue-500/10"
                  }`}
                >
                  <ChevronRight className="w-4 h-4" />
                </button>
              </div>
            )}
          </div>
        </div>
      </main>

      {/* Add Project Modal */}
      {showAddModal && (
        <div className="fixed inset-0 bg-black/70 flex items-center justify-center z-50 p-4 overflow-y-auto">
          <div className="bg-[#191f2b] rounded-xl shadow-2xl border border-[#232945] p-6 max-w-2xl w-full my-8">
            <div className="flex items-center justify-between mb-6">
              <h3 className="text-xl font-semibold text-white">Add New Project</h3>
              <button onClick={() => { setShowAddModal(false); resetForm(); }} className="text-gray-400 hover:text-white transition-colors">
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleAddProject} className="space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm text-gray-400 mb-2">Project Name *</label>
                  <input
                    type="text"
                    value={form.projectName}
                    onChange={(e) => setForm({ ...form, projectName: e.target.value })}
                    className="w-full px-4 py-3 bg-[#0f1419] border border-[#232945] rounded-lg text-white focus:outline-none focus:border-purple-500"
                    required
                  />
                </div>

                <div>
                  <label className="block text-sm text-gray-400 mb-2">Project Type *</label>
                  <select
                    value={form.type}
                    onChange={(e) => setForm({ ...form, type: e.target.value })}
                    className="w-full px-4 py-3 bg-[#0f1419] border border-[#232945] rounded-lg text-white focus:outline-none focus:border-purple-500"
                    required
                  >
                    <option value="Website">Website</option>
                    <option value="SEO">SEO</option>
                    <option value="Google Marketing">Google Marketing</option>
                    <option value="SMO">SMO</option>
                    <option value="Hosting">Hosting</option>
                    <option value="Invoice App">Invoice App</option>
                  </select>
                </div>

                <div>
                  <label className="block text-sm text-gray-400 mb-2">Client *</label>
                  <select
                    value={form.client}
                    onChange={(e) => setForm({ ...form, client: e.target.value })}
                    className="w-full px-4 py-3 bg-[#0f1419] border border-[#232945] rounded-lg text-white focus:outline-none focus:border-purple-500"
                    required
                  >
                    <option value="">Select Client</option>
                    {clients.map(client => (
                      <option key={client._id} value={client._id}>
                        {client.businessName || client.clientName}
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="block text-sm text-gray-400 mb-2">Priority</label>
                  <select
                    value={form.priority}
                    onChange={(e) => setForm({ ...form, priority: e.target.value })}
                    className="w-full px-4 py-3 bg-[#0f1419] border border-[#232945] rounded-lg text-white focus:outline-none focus:border-purple-500"
                  >
                    <option value="Low">Low</option>
                    <option value="Medium">Medium</option>
                    <option value="High">High</option>
                  </select>
                </div>

                <div>
                  <label className="block text-sm text-gray-400 mb-2">Start Date</label>
                  <input
                    type="date"
                    value={form.startDate}
                    onChange={(e) => setForm({ ...form, startDate: e.target.value })}
                    className="w-full px-4 py-3 bg-[#0f1419] border border-[#232945] rounded-lg text-white focus:outline-none focus:border-purple-500"
                  />
                </div>

                <div>
                  <label className="block text-sm text-gray-400 mb-2">End Date</label>
                  <input
                    type="date"
                    value={form.endDate}
                    onChange={(e) => setForm({ ...form, endDate: e.target.value })}
                    className="w-full px-4 py-3 bg-[#0f1419] border border-[#232945] rounded-lg text-white focus:outline-none focus:border-purple-500"
                  />
                </div>
              </div>

              <div className="relative" ref={employeeDropdownRef}>
                <label className="block text-sm text-gray-400 mb-2">Assign To *</label>
                <div
                  onClick={() => setShowEmployeeDropdown(!showEmployeeDropdown)}
                  className="w-full px-4 py-3 bg-[#0f1419] border border-[#232945] rounded-lg text-white focus:outline-none focus:border-purple-500 cursor-pointer flex items-center justify-between"
                >
                  <span className="text-gray-300">
                    {form.assignedTo.length === 0
                      ? "Select employees..."
                      : `${form.assignedTo.length} employee${form.assignedTo.length > 1 ? "s" : ""} selected`}
                  </span>
                  <ChevronDown className={`w-4 h-4 transition-transform ${showEmployeeDropdown ? "rotate-180" : ""}`} />
                </div>

                {showEmployeeDropdown && (
                  <div className="absolute z-10 w-full mt-2 bg-[#0f1419] border border-[#232945] rounded-lg shadow-2xl max-h-64 overflow-hidden">
                    {/* Search Input */}
                    <div className="p-3 border-b border-[#232945] sticky top-0 bg-[#0f1419]">
                      <div className="relative">
                        <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 w-4 h-4 text-gray-500" />
                        <input
                          type="text"
                          placeholder="Search employees..."
                          value={employeeSearchTerm}
                          onChange={(e) => setEmployeeSearchTerm(e.target.value)}
                          onClick={(e) => e.stopPropagation()}
                          className="w-full pl-10 pr-4 py-2 bg-[#141a21] border border-[#232945] rounded-lg text-white text-sm placeholder-gray-500 focus:outline-none focus:border-purple-500"
                        />
                      </div>
                    </div>

                    {/* Employee List */}
                    <div className="max-h-48 overflow-y-auto">
                      {employees
                        .filter(emp => emp && emp.name && emp.name.toLowerCase().includes(employeeSearchTerm.toLowerCase()))
                        .map((emp) => {
                          const empId = emp._id || emp.userId;
                          return (
                          <label
                            key={empId}
                            className="flex items-center gap-3 px-4 py-3 hover:bg-[#191f2b] cursor-pointer transition-colors border-b border-[#232945] last:border-b-0"
                          >
                            <input
                              type="checkbox"
                              checked={form.assignedTo.includes(empId)}
                              onChange={(e) => {
                                if (e.target.checked) {
                                  setForm({ ...form, assignedTo: [...form.assignedTo, empId] });
                                } else {
                                  setForm({ ...form, assignedTo: form.assignedTo.filter(id => id !== empId) });
                                }
                              }}
                              className="w-4 h-4 rounded border-[#232945] bg-[#0f1419] text-purple-600 focus:ring-purple-500 focus:ring-offset-0"
                            />
                            <div className="flex items-center gap-2 flex-1 min-w-0">
                              <div className="w-8 h-8 rounded-full bg-gradient-to-br from-purple-500 to-pink-500 flex items-center justify-center text-white text-xs font-semibold flex-shrink-0">
                                {emp.name.charAt(0).toUpperCase()}
                              </div>
                              <div className="flex-1 min-w-0">
                                <div className="flex items-center gap-2 flex-wrap">
                                  <span className="text-white text-sm">{emp.name}</span>
                                  {/* Workload capacity badge */}
                                  {emp.capacity === 'available' && (
                                    <span className="px-2 py-0.5 rounded-full text-xs font-medium bg-green-500/20 text-green-400 border border-green-500/50 flex-shrink-0">
                                      ✓ Available
                                    </span>
                                  )}
                                  {emp.capacity === 'busy' && (
                                    <span className="px-2 py-0.5 rounded-full text-xs font-medium bg-yellow-500/20 text-yellow-400 border border-yellow-500/50 flex-shrink-0">
                                      ⚠ Busy
                                    </span>
                                  )}
                                  {emp.capacity === 'overloaded' && (
                                    <span className="px-2 py-0.5 rounded-full text-xs font-medium bg-red-500/20 text-red-400 border border-red-500/50 animate-pulse flex-shrink-0">
                                      🚨 Overloaded
                                    </span>
                                  )}
                                </div>
                                {/* Workload info */}
                                {emp.activeTaskCount !== undefined && (
                                  <div className="text-xs text-gray-400 mt-1">
                                    {emp.activeTaskCount} active task{emp.activeTaskCount !== 1 ? 's' : ''}
                                    {emp.workloadPercentage !== undefined && ` • ${emp.workloadPercentage}% load`}
                                  </div>
                                )}
                                {/* Warning for overloaded employees - soft warning, not restriction */}
                                {emp.capacity === 'overloaded' && (
                                  <div className="text-xs text-orange-400 mt-1 italic">
                                    💡 High workload - assignment still allowed
                                  </div>
                                )}
                              </div>
                            </div>
                          </label>
                        );
                        })}
                      {employees.filter(emp => emp && emp.name && emp.name.toLowerCase().includes(employeeSearchTerm.toLowerCase())).length === 0 && (
                        <div className="px-4 py-6 text-center text-gray-500 text-sm">
                          No employees found
                        </div>
                      )}
                    </div>
                  </div>
                )}

                {form.assignedTo.length > 0 && (
                  <div className="flex flex-wrap gap-2 mt-3">
                    {form.assignedTo.map((empId) => {
                      const emp = employees.find(e => (e._id === empId || e.userId === empId));
                      if (!emp || !emp.name) return null;
                      return (
                        <div key={empId} className="flex items-center gap-2 px-3 py-1 bg-purple-600/20 border border-purple-500/30 rounded-full text-sm text-purple-300">
                          <span>{emp.name}</span>
                          <button
                            type="button"
                            onClick={() => setForm({ ...form, assignedTo: form.assignedTo.filter(id => id !== empId) })}
                            className="hover:text-purple-100 transition-colors"
                          >
                            <X className="w-3 h-3" />
                          </button>
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>

              <div>
                <label className="block text-sm text-gray-400 mb-2">Description</label>
                <textarea
                  value={form.description}
                  onChange={(e) => setForm({ ...form, description: e.target.value })}
                  className="w-full px-4 py-3 bg-[#0f1419] border border-[#232945] rounded-lg text-white focus:outline-none focus:border-purple-500 h-24 resize-none"
                  placeholder="Project description..."
                ></textarea>
              </div>

              {/* Project Tasks Section */}
              <div className="border-t border-[#232945] pt-4 mt-4">
                <div className="flex items-center justify-between mb-3">
                  <label className="block text-sm text-gray-400">Project Tasks (Optional)</label>
                  <button
                    type="button"
                    onClick={() => setProjectTasks([...projectTasks, {
                      title: '',
                      description: '',
                      dueDate: '',
                      priority: 'Medium'
                    }])}
                    className="px-3 py-1 bg-blue-600/20 text-blue-400 rounded-lg hover:bg-blue-600/30 transition-colors text-sm flex items-center gap-1"
                  >
                    <Plus className="w-3 h-3" />
                    Add Task
                  </button>
                </div>

                {projectTasks.length > 0 && (
                  <div className="space-y-3 max-h-80 overflow-y-auto">
                    {projectTasks.map((task, index) => (
                      <div key={index} className="p-4 bg-[#0f1419] rounded-lg border border-[#232945]">
                        <div className="flex items-start justify-between mb-3">
                          <span className="text-xs text-gray-500 font-medium">Task {index + 1}</span>
                          <button
                            type="button"
                            onClick={() => setProjectTasks(projectTasks.filter((_, i) => i !== index))}
                            className="text-red-400 hover:text-red-300 transition-colors"
                          >
                            <X className="w-4 h-4" />
                          </button>
                        </div>

                        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                          <div className="md:col-span-2">
                            <label className="block text-xs text-gray-500 mb-1">Task Title *</label>
                            <input
                              type="text"
                              value={task.title}
                              onChange={(e) => {
                                const updated = [...projectTasks];
                                updated[index].title = e.target.value;
                                setProjectTasks(updated);
                              }}
                              className="w-full px-3 py-2 bg-[#141a21] border border-[#232945] rounded-lg text-white text-sm focus:outline-none focus:border-blue-500"
                              placeholder="Enter task title"
                            />
                          </div>

                          <div className="md:col-span-2">
                            <label className="block text-xs text-gray-500 mb-1">Task Description</label>
                            <textarea
                              value={task.description}
                              onChange={(e) => {
                                const updated = [...projectTasks];
                                updated[index].description = e.target.value;
                                setProjectTasks(updated);
                              }}
                              className="w-full px-3 py-2 bg-[#141a21] border border-[#232945] rounded-lg text-white text-sm focus:outline-none focus:border-blue-500 h-16 resize-none"
                              placeholder="Enter task description"
                            ></textarea>
                          </div>

                          <div>
                            <label className="block text-xs text-gray-500 mb-1">Due Date</label>
                            <input
                              type="date"
                              value={task.dueDate}
                              onChange={(e) => {
                                const updated = [...projectTasks];
                                updated[index].dueDate = e.target.value;
                                setProjectTasks(updated);
                              }}
                              className="w-full px-3 py-2 bg-[#141a21] border border-[#232945] rounded-lg text-white text-sm focus:outline-none focus:border-blue-500"
                            />
                          </div>

                          <div>
                            <label className="block text-xs text-gray-500 mb-1">Priority</label>
                            <select
                              value={task.priority}
                              onChange={(e) => {
                                const updated = [...projectTasks];
                                updated[index].priority = e.target.value;
                                setProjectTasks(updated);
                              }}
                              className="w-full px-3 py-2 bg-[#141a21] border border-[#232945] rounded-lg text-white text-sm focus:outline-none focus:border-blue-500"
                            >
                              <option value="Low">Low</option>
                              <option value="Medium">Medium</option>
                              <option value="High">High</option>
                            </select>
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                )}

                {projectTasks.length === 0 && (
                  <div className="text-center py-6 text-gray-500 text-sm bg-[#0f1419] rounded-lg border border-[#232945]">
                    No tasks added yet. Click "Add Task" to create tasks for this project.
                  </div>
                )}
              </div>

              <div className="flex gap-3 pt-4">
                <button
                  type="button"
                  onClick={() => { setShowAddModal(false); resetForm(); }}
                  className="flex-1 px-4 py-3 bg-gray-700 hover:bg-gray-600 text-white rounded-lg transition-colors"
                  disabled={operationLoading.add}
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="flex-1 px-4 py-3 bg-gradient-to-r from-purple-600 to-pink-600 hover:from-purple-700 hover:to-pink-700 text-white rounded-lg transition-all flex items-center justify-center gap-2"
                  disabled={operationLoading.add}
                >
                  {operationLoading.add ? (
                    <>
                      <div className="w-4 h-4 border-2 border-white/20 border-t-white rounded-full animate-spin"></div>
                      Adding...
                    </>
                  ) : (
                    "Add Project"
                  )}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Edit Project Modal */}
      {showEditModal && selectedProject && (
        <div className="fixed inset-0 bg-black/70 flex items-center justify-center z-50 p-4 overflow-y-auto">
          <div className="bg-[#191f2b] rounded-xl shadow-2xl border border-[#232945] p-6 max-w-2xl w-full my-8">
            <div className="flex items-center justify-between mb-6">
              <h3 className="text-xl font-semibold text-white">Edit Project</h3>
              <button onClick={() => { setShowEditModal(false); setSelectedProject(null); resetForm(); }} className="text-gray-400 hover:text-white transition-colors">
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleEditProject} className="space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm text-gray-400 mb-2">Project Name *</label>
                  <input
                    type="text"
                    value={form.projectName}
                    onChange={(e) => setForm({ ...form, projectName: e.target.value })}
                    className="w-full px-4 py-3 bg-[#0f1419] border border-[#232945] rounded-lg text-white focus:outline-none focus:border-purple-500"
                    required
                  />
                </div>

                <div>
                  <label className="block text-sm text-gray-400 mb-2">Project Type *</label>
                  <select
                    value={form.type}
                    onChange={(e) => setForm({ ...form, type: e.target.value })}
                    className="w-full px-4 py-3 bg-[#0f1419] border border-[#232945] rounded-lg text-white focus:outline-none focus:border-purple-500"
                    required
                  >
                    <option value="Website">Website</option>
                    <option value="SEO">SEO</option>
                    <option value="Google Marketing">Google Marketing</option>
                    <option value="SMO">SMO</option>
                    <option value="Hosting">Hosting</option>
                    <option value="Invoice App">Invoice App</option>
                  </select>
                </div>

                <div>
                  <label className="block text-sm text-gray-400 mb-2">Client *</label>
                  <select
                    value={form.client}
                    onChange={(e) => setForm({ ...form, client: e.target.value })}
                    className="w-full px-4 py-3 bg-[#0f1419] border border-[#232945] rounded-lg text-white focus:outline-none focus:border-purple-500"
                    required
                  >
                    <option value="">Select Client</option>
                    {clients.map(client => (
                      <option key={client._id} value={client._id}>
                        {client.businessName || client.clientName}
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="block text-sm text-gray-400 mb-2">Priority</label>
                  <select
                    value={form.priority}
                    onChange={(e) => setForm({ ...form, priority: e.target.value })}
                    className="w-full px-4 py-3 bg-[#0f1419] border border-[#232945] rounded-lg text-white focus:outline-none focus:border-purple-500"
                  >
                    <option value="Low">Low</option>
                    <option value="Medium">Medium</option>
                    <option value="High">High</option>
                  </select>
                </div>

                <div>
                  <label className="block text-sm text-gray-400 mb-2">Start Date *</label>
                  <input
                    type="date"
                    value={form.startDate}
                    onChange={(e) => setForm({ ...form, startDate: e.target.value })}
                    className="w-full px-4 py-3 bg-[#0f1419] border border-[#232945] rounded-lg text-white focus:outline-none focus:border-purple-500"
                    required
                  />
                </div>

                <div>
                  <label className="block text-sm text-gray-400 mb-2">End Date *</label>
                  <input
                    type="date"
                    value={form.endDate}
                    onChange={(e) => setForm({ ...form, endDate: e.target.value })}
                    className="w-full px-4 py-3 bg-[#0f1419] border border-[#232945] rounded-lg text-white focus:outline-none focus:border-purple-500"
                    required
                  />
                </div>

                <div>
                  <label className="block text-sm text-gray-400 mb-2">Budget</label>
                  <input
                    type="number"
                    value={form.budget}
                    onChange={(e) => setForm({ ...form, budget: e.target.value })}
                    className="w-full px-4 py-3 bg-[#0f1419] border border-[#232945] rounded-lg text-white focus:outline-none focus:border-purple-500"
                    placeholder="0"
                  />
                </div>

                <div className="relative" ref={editEmployeeDropdownRef}>
                  <label className="block text-sm text-gray-400 mb-2">Assign To *</label>
                  <div
                    onClick={() => setShowEditEmployeeDropdown(!showEditEmployeeDropdown)}
                    className="w-full px-4 py-3 bg-[#0f1419] border border-[#232945] rounded-lg text-white focus:outline-none focus:border-purple-500 cursor-pointer flex items-center justify-between"
                  >
                    <span className="text-gray-300">
                      {form.assignedTo.length === 0
                        ? "Select employees..."
                        : `${form.assignedTo.length} employee${form.assignedTo.length > 1 ? "s" : ""} selected`}
                    </span>
                    <ChevronDown className={`w-4 h-4 transition-transform ${showEditEmployeeDropdown ? "rotate-180" : ""}`} />
                  </div>

                  {showEditEmployeeDropdown && (
                    <div className="absolute z-10 w-full mt-2 bg-[#0f1419] border border-[#232945] rounded-lg shadow-2xl max-h-64 overflow-hidden">
                      {/* Search Input */}
                      <div className="p-3 border-b border-[#232945] sticky top-0 bg-[#0f1419]">
                        <div className="relative">
                          <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 w-4 h-4 text-gray-500" />
                          <input
                            type="text"
                            placeholder="Search employees..."
                            value={editEmployeeSearchTerm}
                            onChange={(e) => setEditEmployeeSearchTerm(e.target.value)}
                            onClick={(e) => e.stopPropagation()}
                            className="w-full pl-10 pr-4 py-2 bg-[#141a21] border border-[#232945] rounded-lg text-white text-sm placeholder-gray-500 focus:outline-none focus:border-purple-500"
                          />
                        </div>
                      </div>

                      {/* Employee List */}
                      <div className="max-h-48 overflow-y-auto">
                        {employees
                          .filter(emp => emp && emp.name && emp.name.toLowerCase().includes(editEmployeeSearchTerm.toLowerCase()))
                          .map((emp) => {
                            const empId = emp._id || emp.userId;
                            return (
                            <label
                              key={empId}
                              className="flex items-center gap-3 px-4 py-3 hover:bg-[#191f2b] cursor-pointer transition-colors border-b border-[#232945] last:border-b-0"
                            >
                              <input
                                type="checkbox"
                                checked={form.assignedTo.includes(empId)}
                                onChange={(e) => {
                                  if (e.target.checked) {
                                    setForm({ ...form, assignedTo: [...form.assignedTo, empId] });
                                  } else {
                                    setForm({ ...form, assignedTo: form.assignedTo.filter(id => id !== empId) });
                                  }
                                }}
                                className="w-4 h-4 rounded border-[#232945] bg-[#0f1419] text-purple-600 focus:ring-purple-500 focus:ring-offset-0"
                              />
                              <div className="flex items-center gap-2 flex-1 min-w-0">
                                <div className="w-8 h-8 rounded-full bg-gradient-to-br from-purple-500 to-pink-500 flex items-center justify-center text-white text-xs font-semibold flex-shrink-0">
                                  {emp.name.charAt(0).toUpperCase()}
                                </div>
                                <div className="flex-1 min-w-0">
                                  <div className="flex items-center gap-2 flex-wrap">
                                    <span className="text-white text-sm">{emp.name}</span>
                                    {/* Workload capacity badge */}
                                    {emp.capacity === 'available' && (
                                      <span className="px-2 py-0.5 rounded-full text-xs font-medium bg-green-500/20 text-green-400 border border-green-500/50 flex-shrink-0">
                                        ✓ Available
                                      </span>
                                    )}
                                    {emp.capacity === 'busy' && (
                                      <span className="px-2 py-0.5 rounded-full text-xs font-medium bg-yellow-500/20 text-yellow-400 border border-yellow-500/50 flex-shrink-0">
                                        ⚠ Busy
                                      </span>
                                    )}
                                    {emp.capacity === 'overloaded' && (
                                      <span className="px-2 py-0.5 rounded-full text-xs font-medium bg-red-500/20 text-red-400 border border-red-500/50 animate-pulse flex-shrink-0">
                                        🚨 Overloaded
                                      </span>
                                    )}
                                  </div>
                                  {/* Workload info */}
                                  {emp.activeTaskCount !== undefined && (
                                    <div className="text-xs text-gray-400 mt-1">
                                      {emp.activeTaskCount} active task{emp.activeTaskCount !== 1 ? 's' : ''}
                                      {emp.workloadPercentage !== undefined && ` • ${emp.workloadPercentage}% load`}
                                    </div>
                                  )}
                                  {/* Warning for overloaded employees - soft warning, not restriction */}
                                  {emp.capacity === 'overloaded' && (
                                    <div className="text-xs text-orange-400 mt-1 italic">
                                      💡 High workload - assignment still allowed
                                    </div>
                                  )}
                                </div>
                              </div>
                            </label>
                          );
                          })}
                        {employees.filter(emp => emp && emp.name && emp.name.toLowerCase().includes(editEmployeeSearchTerm.toLowerCase())).length === 0 && (
                          <div className="px-4 py-6 text-center text-gray-500 text-sm">
                            No employees found
                          </div>
                        )}
                      </div>
                    </div>
                  )}

                  {form.assignedTo.length > 0 && (
                    <div className="flex flex-wrap gap-2 mt-3">
                      {form.assignedTo.map((empId) => {
                        const emp = employees.find(e => (e._id === empId || e.userId === empId));
                        if (!emp || !emp.name) return null;
                        return (
                          <div key={empId} className="flex items-center gap-2 px-3 py-1 bg-purple-600/20 border border-purple-500/30 rounded-full text-sm text-purple-300">
                            <span>{emp.name}</span>
                            <button
                              type="button"
                              onClick={() => setForm({ ...form, assignedTo: form.assignedTo.filter(id => id !== empId) })}
                              className="hover:text-purple-100 transition-colors"
                            >
                              <X className="w-3 h-3" />
                            </button>
                          </div>
                        );
                      })}
                    </div>
                  )}
                </div>
              </div>

              <div>
                <label className="block text-sm text-gray-400 mb-2">Description</label>
                <textarea
                  value={form.description}
                  onChange={(e) => setForm({ ...form, description: e.target.value })}
                  className="w-full px-4 py-3 bg-[#0f1419] border border-[#232945] rounded-lg text-white focus:outline-none focus:border-purple-500 h-24 resize-none"
                  placeholder="Project description..."
                ></textarea>
              </div>



              <div className="flex gap-3 pt-4 mt-4 border-t border-[#232945]">
                <button
                  type="button"
                  onClick={() => { setShowEditModal(false); setSelectedProject(null); resetForm(); }}
                  className="flex-1 px-4 py-3 bg-gray-700 hover:bg-gray-600 text-white rounded-lg transition-colors"
                  disabled={operationLoading.edit}
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="flex-1 px-4 py-3 bg-gradient-to-r from-purple-600 to-pink-600 hover:from-purple-700 hover:to-pink-700 text-white rounded-lg transition-all flex items-center justify-center gap-2"
                  disabled={operationLoading.edit}
                >
                  {operationLoading.edit ? (
                    <>
                      <div className="w-4 h-4 border-2 border-white/20 border-t-white rounded-full animate-spin"></div>
                      Saving...
                    </>
                  ) : (
                    "Save Changes"
                  )}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* View Project Modal */}
      {showViewModal && selectedProject && (
        <div className="fixed inset-0 bg-black/70 flex items-center justify-center z-50 p-4">
          <div className="bg-[#191f2b] rounded-xl shadow-2xl border border-[#232945] p-6 max-w-2xl w-full">
            <div className="flex items-center justify-between mb-6">
              <h3 className="text-xl font-semibold text-white">Project Details</h3>
              <button onClick={() => { setShowViewModal(false); setSelectedProject(null); }} className="text-gray-400 hover:text-white transition-colors">
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <p className="text-sm text-gray-400 mb-1">Project Name</p>
                  <p className="text-white font-medium">{selectedProject.projectName}</p>
                </div>
                <div>
                  <p className="text-sm text-gray-400 mb-1">Type</p>
                  <span className={`px-3 py-1 rounded-full text-xs font-medium ${PROJECT_TYPE_COLORS[selectedProject.type]?.bg} ${PROJECT_TYPE_COLORS[selectedProject.type]?.text}`}>
                    {selectedProject.type}
                  </span>
                </div>
                <div>
                  <p className="text-sm text-gray-400 mb-1">Client</p>
                  <p className="text-white">{selectedProject.client?.businessName || selectedProject.client?.clientName || "N/A"}</p>
                </div>
                <div>
                  <p className="text-sm text-gray-400 mb-1">Priority</p>
                  <p className="text-white">{selectedProject.priority || "Medium"}</p>
                </div>
                <div>
                  <p className="text-sm text-gray-400 mb-1">Start Date</p>
                  <p className="text-white">{selectedProject.startDate ? new Date(selectedProject.startDate).toLocaleDateString() : "N/A"}</p>
                </div>
                <div>
                  <p className="text-sm text-gray-400 mb-1">End Date</p>
                  <p className="text-white">{selectedProject.endDate ? new Date(selectedProject.endDate).toLocaleDateString() : "N/A"}</p>
                </div>
                <div>
                  <p className="text-sm text-gray-400 mb-1">Budget</p>
                  <p className="text-white">{selectedProject.budget ? `${selectedProject.budget}` : "N/A"}</p>
                </div>
                <div>
                  <p className="text-sm text-gray-400 mb-1">Status</p>
                  <span className={`px-3 py-1 rounded-full text-xs font-medium ${
                    getProjectStatus(selectedProject) === "active" ? "bg-green-500/20 text-green-400" :
                    getProjectStatus(selectedProject) === "completed" ? "bg-purple-500/20 text-purple-400" :
                    getProjectStatus(selectedProject) === "needsRenewal" ? "bg-orange-500/20 text-orange-400" :
                    "bg-red-500/20 text-red-400"
                  }`}>
                    {getProjectStatus(selectedProject) === "active" ? "Active" :
                     getProjectStatus(selectedProject) === "completed" ? "Completed" :
                     getProjectStatus(selectedProject) === "needsRenewal" ? "Needs Renewal" : "Inactive"}
                  </span>
                </div>
              </div>

              <div>
                <p className="text-sm text-gray-400 mb-2">Assigned To</p>
                <div className="flex flex-wrap gap-2">
                  {selectedProject.assignedTo?.map((emp, idx) => (
                    <div key={idx} className="flex items-center gap-2 px-3 py-2 bg-[#0f1419] rounded-lg border border-[#232945]">
                      <div className="w-8 h-8 rounded-full bg-gradient-to-br from-purple-500 to-pink-500 flex items-center justify-center text-white text-xs font-semibold">
                        {(emp.name || "U").charAt(0).toUpperCase()}
                      </div>
                      <span className="text-white text-sm">{emp.name || "Unknown"}</span>
                    </div>
                  ))}
                </div>
              </div>

              {selectedProject.description && (
                <div>
                  <p className="text-sm text-gray-400 mb-2">Description</p>
                  <p className="text-white bg-[#0f1419] p-4 rounded-lg border border-[#232945]">
                    {selectedProject.description}
                  </p>
                </div>
              )}
            </div>

            <div className="flex gap-3 pt-6">
              <button
                onClick={() => { setShowViewModal(false); openEditModal(selectedProject); }}
                className="flex-1 px-4 py-3 bg-gradient-to-r from-purple-600 to-pink-600 hover:from-purple-700 hover:to-pink-700 text-white rounded-lg transition-all"
              >
                Edit Project
              </button>
              <button
                onClick={() => { setShowViewModal(false); setSelectedProject(null); }}
                className="flex-1 px-4 py-3 bg-gray-700 hover:bg-gray-600 text-white rounded-lg transition-colors"
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Delete Confirmation Modal */}
      {showDeleteConfirm && selectedProject && (
        <div className="fixed inset-0 bg-black/70 flex items-center justify-center z-50 p-4">
          <div className="bg-[#191f2b] rounded-xl shadow-2xl border border-red-500/50 p-6 max-w-md w-full">
            <div className="flex items-center gap-3 mb-4">
              <div className="p-3 rounded-full bg-red-500/20">
                <AlertCircle className="w-6 h-6 text-red-400" />
              </div>]
              <h3 className="text-xl font-semibold text-white">Delete Project</h3>
            </div>

            <p className="text-gray-300 mb-6">
              Are you sure you want to delete <strong>{selectedProject.projectName}</strong>? 
              This action cannot be undone.
            </p>

            <div className="flex gap-3">
              <button
                onClick={() => { setShowDeleteConfirm(false); setSelectedProject(null); }}
                className="flex-1 px-4 py-3 bg-gray-700 hover:bg-gray-600 text-white rounded-lg transition-colors"
                disabled={operationLoading.delete}
              >
                Cancel
              </button>
              <button
                onClick={handleDeleteProject}
                className="flex-1 px-4 py-3 bg-red-600 hover:bg-red-700 text-white rounded-lg transition-colors flex items-center justify-center gap-2"
                disabled={operationLoading.delete}
              >
                {operationLoading.delete ? (
                  <>
                    <div className="w-4 h-4 border-2 border-white/20 border-t-white rounded-full animate-spin"></div>
                    Deleting...
                  </>
                ) : (
                  "Delete"
                )}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default ProjectsPage;