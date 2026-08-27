import React, { useState, useEffect } from "react";
import API from "../api";
import { useNavigate } from "react-router-dom";
import Sidebar from "../components/dashboard/Sidebar";
import ProjectsHeader from "../components/projects/ProjectsHeader";
import ProjectStats from "../components/projects/ProjectStats";
import ProjectFilters from "../components/projects/ProjectFilters";
import ProjectList from "../components/projects/ProjectList";
import ProjectFormModal from "../components/projects/ProjectFormModal";
import { toast } from "react-toastify";
import "react-toastify/dist/ReactToastify.css";
import { useWebSocketContext } from "../contexts/WebSocketContext";

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
  const { joinProject, leaveProject } = useWebSocketContext();
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);
  const [projects, setProjects] = useState([]);
  const [clients, setClients] = useState([]);
  const [employees, setEmployees] = useState([]);
  const [loading, setLoading] = useState(false);
  const [userRole, setUserRole] = useState("admin");
  const [currentUserId, setCurrentUserId] = useState(null);

  // Live remark counts for the badge on each project card — { [projectId]: count }.
  const [remarkCounts, setRemarkCounts] = useState({});

  // Add/Edit project modal state
  const [showAddModal, setShowAddModal] = useState(false);
  const [showEditModal, setShowEditModal] = useState(false);
  const [selectedProject, setSelectedProject] = useState(null);

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

  // Keep this socket joined to the room for every project currently visible
  // on screen, so 'project-remark' events (and the count updates below)
  // actually arrive. React runs this effect's cleanup (leaving the previous
  // page/filter's ids) before re-running the body (joining the new ids)
  // whenever `projects` changes, and once more on unmount — so plain
  // join-then-leave here is enough; no manual diffing against a previous
  // set is needed.
  useEffect(() => {
    const ids = projects.map((p) => p._id);
    ids.forEach((id) => joinProject(id));
    return () => {
      ids.forEach((id) => leaveProject(id));
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [projects]);

  // Live remark-count updates for the badge on each card.
  useEffect(() => {
    const handleNewRemark = (event) => {
      const projectId = event.detail?.projectId;
      if (!projectId) return;
      setRemarkCounts((prev) => ({
        ...prev,
        [projectId]: (prev[projectId] || 0) + 1,
      }));
    };

    const handleRemarkDeleted = (event) => {
      const projectId = event.detail?.projectId;
      if (!projectId) return;
      setRemarkCounts((prev) => ({
        ...prev,
        [projectId]: Math.max(0, (prev[projectId] || 0) - 1),
      }));
    };

    window.addEventListener("project-remark", handleNewRemark);
    window.addEventListener("project-remark-deleted", handleRemarkDeleted);
    return () => {
      window.removeEventListener("project-remark", handleNewRemark);
      window.removeEventListener("project-remark-deleted", handleRemarkDeleted);
    };
  }, []);

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
      fetchRemarkCounts(normalizedProjects.map((p) => p._id));
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

  // Bulk-fetch live remark counts for exactly the projects on screen right
  // now (one request for the whole page instead of one per card). Merges
  // into the existing map rather than replacing it outright, so a slightly
  // late response can't wipe out counts a socket event already updated.
  const fetchRemarkCounts = async (projectIds) => {
    if (!projectIds || projectIds.length === 0) return;
    try {
      const res = await API.get(
        `/api/projects/remarks/counts?projectIds=${projectIds.join(",")}`
      );
      setRemarkCounts((prev) => ({ ...prev, ...(res.data?.data || {}) }));
    } catch (error) {
      console.error("Error fetching remark counts:", error);
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

      // ─── SORTED ON THE LABEL THAT IS ACTUALLY DISPLAYED ───
      // The server now returns these alphabetically too, but it can only sort
      // on a real field. The picker renders `businessName || clientName`, and
      // a client with no business name would sort by a value nobody can see —
      // landing in the middle of the list for no visible reason, which looks
      // exactly as random as creation order did.
      //
      // localeCompare rather than `<`, so accented names and mixed case fall
      // where a reader expects rather than where their code points do.
      const labelOf = (c) => (c?.businessName || c?.clientName || "").trim();
      const sorted = [...(res.data || [])].sort((a, b) =>
        labelOf(a).localeCompare(labelOf(b), undefined, { sensitivity: "base" })
      );

      setClients(sorted);
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
    setShowAddModal(true);
  };

  const handleViewProject = (project) => {
    navigate(`/project/${project._id}`);
  };

  const handleEditProject = (project) => {
    setSelectedProject(project);
    setShowEditModal(true);
  };

  const closeProjectModals = () => {
    setShowAddModal(false);
    setShowEditModal(false);
    setSelectedProject(null);
  };

  const handleCreateProjectSubmit = async (payload) => {
    try {
      await API.post("/api/projects", payload);
      toast.success("Project created successfully");
      closeProjectModals();
      fetchAllData(1);
    } catch (error) {
      console.error("Error creating project:", error);
      toast.error(error.response?.data?.message || "Failed to create project");
    }
  };

  const handleUpdateProjectSubmit = async (payload) => {
    try {
      await API.put(`/api/projects/${selectedProject._id}`, payload);
      toast.success("Project updated successfully");
      closeProjectModals();
      fetchAllData(currentPage);
    } catch (error) {
      console.error("Error updating project:", error);
      toast.error(error.response?.data?.message || "Failed to update project");
    }
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

  /**
   * Open THIS project's chat.
   *
   * It used to go to /communication-tracking — the cross-project analytics
   * dashboard — on the strength of an old note claiming no per-project route
   * existed. One does: /project/:id, whose Chat tab is the same thread this
   * button promises. The handler was named for "communication" while the
   * button said "Chat", which is how the two drifted apart; both are named for
   * the chat now so the substitution is harder to make again.
   *
   * `scrollToMessages` is the signal ProjectDetailPage already listens for
   * (notification deep-links use it): it forces the Chat tab regardless of
   * which tab happens to be the default, and scrolls to the newest message —
   * which is what you want the instant you press Chat.
   */
  const handleOpenChat = (project) => {
    navigate(`/project/${project._id}`, { state: { scrollToMessages: true } });
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
          sidebarCollapsed ? "app-offset app-offset-collapsed" : "app-offset"
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
            onOpenChat={handleOpenChat}
            canEdit={canEdit()}
            canDelete={canDelete()}
            remarkCounts={remarkCounts}
          />
        </div>
      </main>

      {(showAddModal || showEditModal) && (
        <ProjectFormModal
          isEditing={showEditModal}
          project={selectedProject}
          clients={clients}
          employees={employees}
          onClose={closeProjectModals}
          onSubmit={showEditModal ? handleUpdateProjectSubmit : handleCreateProjectSubmit}
        />
      )}
    </div>
  );
};

export default ProjectsPageNew;
