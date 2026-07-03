import React, { useState, useEffect } from "react";
import API from "../api";
import { useNavigate } from "react-router-dom";
import Sidebar from "../components/dashboard/Sidebar";
import ProjectsHeader from "../components/projects/ProjectsHeader";
import ProjectStats from "../components/projects/ProjectStats";
import ProjectFilters from "../components/projects/ProjectFilters";
import ProjectList from "../components/projects/ProjectList";
import { toast } from "react-toastify";
import "react-toastify/dist/ReactToastify.css";

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

const ProjectsPageNew = ({ onLogout }) => {
  const navigate = useNavigate();
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);
  const [projects, setProjects] = useState([]);
  const [, setClients] = useState([]);
  const [, setEmployees] = useState([]);
  const [loading, setLoading] = useState(false);
  const [userRole, setUserRole] = useState("admin");
  const [currentUserId, setCurrentUserId] = useState(null);

  // Filter state
  const [searchTerm, setSearchTerm] = useState("");
  const [filterType, setFilterType] = useState("all");
  const [filterStatus, setFilterStatus] = useState("all");
  const [filterPriority, setFilterPriority] = useState("all");
  const [showMyProjectsOnly, setShowMyProjectsOnly] = useState(false);
  const [sortBy] = useState("createdAt");

  // Pagination state
  const [currentPage, setCurrentPage] = useState(1);
  const projectsPerPage = 20;
  const [pagination, setPagination] = useState({ total: 0, page: 1, totalPages: 1, limit: 20 });
  const [overallStats, setOverallStats] = useState({
    total: 0,
    new: 0,
    ongoing: 0,
    expired: 0,
    completed: 0,
  });

  // Debounced search term
  const debouncedSearchTerm = useDebounce(searchTerm, 300);

  useEffect(() => {
    // Get user role and ID from localStorage
    try {
      const userStr = localStorage.getItem("user");
      if (userStr) {
        const user = JSON.parse(userStr);
        setUserRole(user.role || "admin");
        setCurrentUserId(user._id || user.id || null);
      }
    } catch (error) {
      console.error("Error parsing user data:", error);
    }

    fetchAllData(1);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Refetch when filters change
  useEffect(() => {
    fetchProjects(1);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [
    debouncedSearchTerm,
    filterType,
    filterStatus,
    filterPriority,
    showMyProjectsOnly,
    sortBy,
  ]);

  const fetchAllData = async (page) => {
    setLoading(true);
    try {
      await Promise.all([
        fetchProjects(page ?? currentPage),
        fetchClients(),
        fetchEmployees(),
      ]);
    } catch (error) {
      console.error("Error fetching data:", error);
      toast.error("Failed to load data");
    } finally {
      setLoading(false);
    }
  };

  const fetchProjects = async (page = 1) => {
    try {
      const params = new URLSearchParams();
      params.set("page", page);
      params.set("limit", projectsPerPage);
      if (sortBy !== "createdAt") params.set("sort", sortBy);
      if (debouncedSearchTerm) params.set("search", debouncedSearchTerm);
      if (filterType !== "all") params.set("type", filterType);
      if (filterStatus !== "all") params.set("status", filterStatus);
      if (filterPriority !== "all") params.set("priority", filterPriority);
      if (showMyProjectsOnly && currentUserId) params.set("createdBy", currentUserId);

      const res = await API.get(`/api/projects?${params.toString()}`);

      const projectsData = res.data.projects || [];
      const normalizedProjects = normalizeProjects(projectsData);

      setProjects(normalizedProjects);
      setPagination({
        total: res.data.total || normalizedProjects.length,
        page: res.data.page || page,
        totalPages: res.data.totalPages || Math.ceil((res.data.total || normalizedProjects.length) / projectsPerPage),
        limit: projectsPerPage,
      });

      if (res.data.stats) {
        setOverallStats(res.data.stats.overall || {
          total: 0,
          new: 0,
          ongoing: 0,
          expired: 0,
          completed: 0,
        });
      }
    } catch (error) {
      console.error("Error fetching projects:", error);
      toast.error(error.response?.data?.message || "Failed to load projects");
    }
  };

  const normalizeProjects = (projectsData) => {
    return projectsData.map((project) => {
      if (project.client && (!project.clients || project.clients.length === 0)) {
        return {
          ...project,
          clients: [project.client],
        };
      }
      return project;
    });
  };

  const fetchClients = async () => {
    try {
      const res = await API.get("/api/clients");
      setClients(res.data || []);
    } catch (error) {
      console.error("Error fetching clients:", error);
    }
  };

  const fetchEmployees = async () => {
    try {
      const res = await API.get("/api/users");
      setEmployees(res.data.users || res.data || []);
    } catch (error) {
      console.error("Error fetching employees:", error);
    }
  };

  const handleAddProject = () => {
    // Navigate to add project page or open modal
    // For now, let's show a toast
    toast.info("Add project modal would open here");
  };

  const handleViewProject = (project) => {
    navigate(`/projects/${project._id}`);
  };

  const handleEditProject = () => {
    // Navigate to edit project page or open modal
    toast.info("Edit project modal would open here");
  };

  const handleDeleteProject = async (project) => {
    if (!window.confirm(`Are you sure you want to delete "${project.projectName}"?`)) {
      return;
    }

    try {
      await API.delete(`/api/projects/${project._id}`);
      toast.success("Project deleted successfully");
      fetchProjects(currentPage);
    } catch (error) {
      console.error("Error deleting project:", error);
      toast.error(error.response?.data?.message || "Failed to delete project");
    }
  };

  const handleCommunication = (project) => {
    navigate(`/project-communication/${project._id}`);
  };

  const handleExport = async () => {
    try {
      const res = await API.get("/api/projects/export", { responseType: "blob" });
      const url = window.URL.createObjectURL(new Blob([res.data]));
      const link = document.createElement("a");
      link.href = url;
      link.setAttribute("download", `projects_${new Date().toISOString().slice(0, 10)}.csv`);
      document.body.appendChild(link);
      link.click();
      link.remove();
      toast.success("Projects exported successfully");
    } catch (error) {
      console.error("Error exporting projects:", error);
      toast.error("Failed to export projects");
    }
  };

  const handlePageChange = (newPage) => {
    setCurrentPage(newPage);
    fetchProjects(newPage);
  };

  const handleClearFilters = () => {
    setSearchTerm("");
    setFilterType("all");
    setFilterStatus("all");
    setFilterPriority("all");
    setShowMyProjectsOnly(false);
  };

  const canExportData = () => {
    return ["admin", "super-admin", "hr"].includes(userRole);
  };

  const canEdit = () => {
    return ["admin", "super-admin"].includes(userRole);
  };

  const canDelete = () => {
    return ["admin", "super-admin"].includes(userRole);
  };

  return (
    <div className="relative flex h-[100dvh] overflow-hidden bg-slate-50 text-slate-900 dark:bg-[#0b0d12] dark:text-slate-100">

      <Sidebar
        collapsed={sidebarCollapsed}
        setCollapsed={setSidebarCollapsed}
        onLogout={onLogout}
        userRole={userRole}
      />

      <main
        className={`relative z-10 h-[100dvh] min-w-0 flex-1 overflow-y-auto overflow-x-hidden px-3 py-4 transition-all duration-300 [overscroll-behavior-y:auto] [scrollbar-gutter:stable] sm:px-5 lg:px-6 ${
          sidebarCollapsed ? "ml-16" : "ml-16 sm:ml-56"
        }`}
        style={{ WebkitOverflowScrolling: "touch" }}
      >
        <div className="mx-auto max-w-[1540px] space-y-4 pb-8 sm:space-y-5">
          {/* Header */}
          <ProjectsHeader
            onRefresh={() => fetchAllData(currentPage)}
            onAddProject={handleAddProject}
            onExport={handleExport}
            loading={loading}
            canExport={canExportData()}
          />

          {/* Stats */}
          <ProjectStats stats={overallStats} />

          {/* Filters */}
          <ProjectFilters
            searchTerm={searchTerm}
            onSearchChange={setSearchTerm}
            filterType={filterType}
            onTypeChange={setFilterType}
            filterStatus={filterStatus}
            onStatusChange={setFilterStatus}
            filterPriority={filterPriority}
            onPriorityChange={setFilterPriority}
            showMyProjectsOnly={showMyProjectsOnly}
            onToggleMyProjects={setShowMyProjectsOnly}
            onClearFilters={handleClearFilters}
          />

          {/* Project List */}
          <ProjectList
            projects={projects}
            loading={loading}
            pagination={pagination}
            onPageChange={handlePageChange}
            onView={handleViewProject}
            onEdit={handleEditProject}
            onDelete={handleDeleteProject}
            onCommunication={handleCommunication}
            canEdit={canEdit()}
            canDelete={canDelete()}
          />
        </div>
      </main>
    </div>
  );
};

export default ProjectsPageNew;
