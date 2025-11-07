import React, { useState, useEffect, useMemo } from "react";
import axios from "axios";
import { useNavigate } from "react-router-dom";
import {
  FolderKanban,
  Search,
  RefreshCw,
  CheckCircle,
  XCircle,
  AlertCircle,
  Globe,
  TrendingUp,
  Package,
  Mail,
  Server,
  FileText,
  Eye,
  Calendar,
  Users,
  LogOut,
  Menu,
  X as CloseIcon,
  Clock,
  MessageCircle,
} from "lucide-react";
import UnreadMessageBadge from "../components/message/UnreadMessageBadge";

const API_BASE = import.meta.env.VITE_API_BASE || "http://localhost:5000";

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
  Website: {
    bg: "bg-blue-600/20",
    text: "text-blue-400",
    border: "border-blue-500/50",
  },
  SEO: {
    bg: "bg-green-600/20",
    text: "text-green-400",
    border: "border-green-500/50",
  },
  "Google Marketing": {
    bg: "bg-purple-600/20",
    text: "text-purple-400",
    border: "border-purple-500/50",
  },
  SMO: {
    bg: "bg-orange-600/20",
    text: "text-orange-400",
    border: "border-orange-500/50",
  },
  Hosting: {
    bg: "bg-cyan-600/20",
    text: "text-cyan-400",
    border: "border-cyan-500/50",
  },
  "Invoice App": {
    bg: "bg-pink-600/20",
    text: "text-pink-400",
    border: "border-pink-500/50",
  },
};

// Default fallback values
const DEFAULT_COLORS = {
  bg: "bg-gray-600/20",
  text: "text-gray-400",
  border: "border-gray-500/50",
};

const ClientPortal = ({ onLogout, clientId }) => {
  const navigate = useNavigate();
  const [projects, setProjects] = useState([]);
  const [loading, setLoading] = useState(false);
  const [searchTerm, setSearchTerm] = useState("");
  const [filterType, setFilterType] = useState("all");
  const [filterStatus, setFilterStatus] = useState("all");
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

  useEffect(() => {
    fetchProjects();
  }, []);

  const fetchProjects = async () => {
    setLoading(true);
    try {
      const token = localStorage.getItem("token");
      const res = await axios.get(`${API_BASE}/api/projects`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      // Filter projects for this client (clients is an array)
      const clientProjects = res.data.filter((p) => {
        if (!p.clients || !Array.isArray(p.clients)) return false;
        return p.clients.some((c) => {
          const cId = typeof c === 'object' ? c._id : c;
          return cId === clientId;
        });
      });
      setProjects(clientProjects);
    } catch (error) {
      console.error("Error fetching projects:", error);
    } finally {
      setLoading(false);
    }
  };

  const getProjectStatus = (project) => {
  if (!project) return "inactive";
  
  const today = new Date();
  const endDate = project.endDate ? new Date(project.endDate) : null;

  // Normalize status to lowercase for comparison
  const status = project.status?.toLowerCase();

  if (status === "completed") return "completed";
  if (status === "inactive") return "inactive";
  if (status === "expired") return "expired";
  if (endDate && endDate < today && status !== "completed") return "needsRenewal";
  if (status === "active" || status === "ongoing") return "active";
  if (status === "new") return "active"; // Treat "new" as active
  
  return "inactive";
};

  // Get project type safely
  const getProjectType = (project) => {
    if (!project || !project.type) return "Website"; // Default type
    
    // Handle array of types - use first type
    if (Array.isArray(project.type)) {
      return project.type[0] || "Website";
    }
    
    return project.type;
  };

  // Get colors safely
  const getProjectColors = (type) => {
    return PROJECT_TYPE_COLORS[type] || DEFAULT_COLORS;
  };

  // Get icon safely
  const getProjectIcon = (type) => {
    return PROJECT_TYPE_ICONS[type] || Globe;
  };

  // Statistics
  const stats = useMemo(() => {
    return {
      total: projects.length,
      active: projects.filter((p) => getProjectStatus(p) === "active").length,
      completed: projects.filter((p) => getProjectStatus(p) === "completed")
        .length,
      needsRenewal: projects.filter(
        (p) => getProjectStatus(p) === "needsRenewal"
      ).length,
    };
  }, [projects]);

  // Filtered projects
  const filteredProjects = useMemo(() => {
    return projects.filter((p) => {
      const matchesSearch =
        p.projectName?.toLowerCase().includes(searchTerm.toLowerCase()) ||
        (Array.isArray(p.type) ? p.type.join(" ") : p.type || "")
          .toLowerCase()
          .includes(searchTerm.toLowerCase());

      const projectType = getProjectType(p);
      const matchesType = filterType === "all" || projectType === filterType;

      const projectStatus = getProjectStatus(p);
      const matchesStatus =
        filterStatus === "all" ||
        (filterStatus === "active" && projectStatus === "active") ||
        (filterStatus === "inactive" && projectStatus === "inactive") ||
        (filterStatus === "needsRenewal" && projectStatus === "needsRenewal") ||
        (filterStatus === "completed" && projectStatus === "completed");

      return matchesSearch && matchesType && matchesStatus;
    });
  }, [projects, searchTerm, filterType, filterStatus]);

  return (
    <div className="flex flex-col min-h-screen bg-gradient-to-br from-[#141a21] via-[#191f2b] to-[#101218] text-blue-100">
      {/* Mobile Header */}
      <header className="lg:hidden sticky top-0 z-40 bg-[#191f2b]/95 backdrop-blur-sm border-b border-[#232945] px-4 py-3">
        <div className="flex items-center justify-between">
          <h1 className="text-xl font-bold text-white">Client Portal</h1>
          <button
            onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
            className="p-2 text-gray-400 hover:text-white transition-colors"
          >
            {mobileMenuOpen ? (
              <CloseIcon className="w-6 h-6" />
            ) : (
              <Menu className="w-6 h-6" />
            )}
          </button>
        </div>

        {/* Mobile Menu */}
        {mobileMenuOpen && (
          <div className="mt-4 pb-4 border-t border-[#232945] pt-4">
            <button
              onClick={onLogout}
              className="w-full flex items-center gap-3 px-4 py-3 text-red-400 hover:bg-red-500/10 rounded-lg transition-colors"
            >
              <LogOut className="w-5 h-5" />
              <span>Logout</span>
            </button>
          </div>
        )}
      </header>

      {/* Main Content */}
      <main className="flex-1 p-4 sm:p-6 lg:p-8 overflow-y-auto">
        {/* Header - Desktop */}
        <div className="hidden lg:flex justify-between items-start mb-8">
          <div>
            <h1 className="text-2xl lg:text-3xl font-bold text-white tracking-tight mb-2">
              My Projects
            </h1>
            <p className="text-sm lg:text-base text-blue-300">
              View and track your project progress
            </p>
          </div>

          <button
            onClick={onLogout}
            className="flex items-center gap-2 px-4 py-2 rounded-lg bg-red-600/20 hover:bg-red-600/40 text-red-400 border border-red-500/30 transition-colors"
          >
            <LogOut className="w-4 h-4" />
            <span className="hidden sm:inline">Logout</span>
          </button>
        </div>

        {/* Mobile Title */}
        <div className="lg:hidden mb-6">
          <h2 className="text-xl font-bold text-white mb-1">My Projects</h2>
          <p className="text-sm text-blue-300">Track your project progress</p>
        </div>

        {/* Statistics Cards */}
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4 lg:gap-6 mb-6 lg:mb-8">
          <div className="bg-[#191f2b]/70 rounded-xl shadow-xl border border-[#232945] p-4 lg:p-6">
            <div className="flex items-center justify-between mb-2 lg:mb-3">
              <div className="p-2 lg:p-3 rounded-lg bg-blue-600/20">
                <FolderKanban className="w-4 h-4 lg:w-6 lg:h-6 text-blue-400" />
              </div>
            </div>
            <p className="text-xs lg:text-sm text-gray-400 mb-1">
              Total Projects
            </p>
            <p className="text-2xl lg:text-3xl font-bold text-white">
              {stats.total}
            </p>
          </div>

          <div className="bg-[#191f2b]/70 rounded-xl shadow-xl border border-[#232945] p-4 lg:p-6">
            <div className="flex items-center justify-between mb-2 lg:mb-3">
              <div className="p-2 lg:p-3 rounded-lg bg-green-600/20">
                <CheckCircle className="w-4 h-4 lg:w-6 lg:h-6 text-green-400" />
              </div>
            </div>
            <p className="text-xs lg:text-sm text-gray-400 mb-1">Active</p>
            <p className="text-2xl lg:text-3xl font-bold text-green-400">
              {stats.active}
            </p>
          </div>

          <div className="bg-[#191f2b]/70 rounded-xl shadow-xl border border-[#232945] p-4 lg:p-6">
            <div className="flex items-center justify-between mb-2 lg:mb-3">
              <div className="p-2 lg:p-3 rounded-lg bg-orange-600/20">
                <AlertCircle className="w-4 h-4 lg:w-6 lg:h-6 text-orange-400" />
              </div>
            </div>
            <p className="text-xs lg:text-sm text-gray-400 mb-1">
              Needs Renewal
            </p>
            <p className="text-2xl lg:text-3xl font-bold text-orange-400">
              {stats.needsRenewal}
            </p>
          </div>

          <div className="bg-[#191f2b]/70 rounded-xl shadow-xl border border-[#232945] p-4 lg:p-6">
            <div className="flex items-center justify-between mb-2 lg:mb-3">
              <div className="p-2 lg:p-3 rounded-lg bg-purple-600/20">
                <CheckCircle className="w-4 h-4 lg:w-6 lg:h-6 text-purple-400" />
              </div>
            </div>
            <p className="text-xs lg:text-sm text-gray-400 mb-1">Completed</p>
            <p className="text-2xl lg:text-3xl font-bold text-purple-400">
              {stats.completed}
            </p>
          </div>
        </div>

        {/* Projects Table */}
        <div className="bg-[#191f2b]/70 rounded-xl shadow-xl border border-[#232945] p-4 lg:p-6">
          <div className="flex flex-col sm:flex-row items-start sm:items-center gap-3 lg:gap-4 mb-4 lg:mb-6">
            <div className="flex items-center gap-2">
              <FolderKanban className="w-5 h-5 text-blue-400" />
              <h3 className="text-base lg:text-lg font-semibold text-white">
                All Projects
              </h3>
              {loading && (
                <div className="w-4 h-4 border-2 border-blue-500/20 border-t-blue-500 rounded-full animate-spin"></div>
              )}
            </div>

            <button
              onClick={fetchProjects}
              className="sm:ml-auto flex items-center gap-2 px-3 py-2 rounded-lg bg-blue-600/20 hover:bg-blue-600/40 text-blue-400 border border-blue-500/30 transition-colors text-sm"
              disabled={loading}
            >
              <RefreshCw
                className={`w-4 h-4 ${loading ? "animate-spin" : ""}`}
              />
              <span>Refresh</span>
            </button>
          </div>

          {/* Filters */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3 lg:gap-4 mb-4 lg:mb-6">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 w-4 h-4 text-gray-500" />
              <input
                type="text"
                placeholder="Search projects..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="w-full pl-10 pr-4 py-2 bg-[#0f1419] border border-[#232945] rounded-lg text-white text-sm placeholder-gray-500 focus:outline-none focus:border-blue-500 transition-colors"
              />
            </div>

            <select
              value={filterType}
              onChange={(e) => setFilterType(e.target.value)}
              className="px-4 py-2 bg-[#0f1419] border border-[#232945] rounded-lg text-white text-sm focus:outline-none focus:border-blue-500 transition-colors"
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
              className="px-4 py-2 bg-[#0f1419] border border-[#232945] rounded-lg text-white text-sm focus:outline-none focus:border-blue-500 transition-colors"
            >
              <option value="all">All Status</option>
              <option value="active">Active</option>
              <option value="needsRenewal">Needs Renewal</option>
              <option value="completed">Completed</option>
            </select>
          </div>

          {/* Desktop Table */}
          <div className="hidden lg:block overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="border-b border-[#232945]">
                  <th className="text-left p-4 text-sm font-semibold text-gray-400">
                    Project Name
                  </th>
                  <th className="text-left p-4 text-sm font-semibold text-gray-400">
                    Type
                  </th>
                  <th className="text-left p-4 text-sm font-semibold text-gray-400">
                    Team
                  </th>
                  <th className="text-left p-4 text-sm font-semibold text-gray-400">
                    End Date
                  </th>
                  <th className="text-left p-4 text-sm font-semibold text-gray-400">
                    Status
                  </th>
                  <th className="text-left p-4 text-sm font-semibold text-gray-400">
                    Actions
                  </th>
                </tr>
              </thead>
              <tbody>
                {filteredProjects.length === 0 ? (
                  <tr>
                    <td colSpan="6" className="text-center py-12">
                      <FolderKanban className="w-12 h-12 text-gray-600 mx-auto mb-3" />
                      <p className="text-gray-500">No projects found</p>
                    </td>
                  </tr>
                ) : (
                  filteredProjects.map((project) => {
                    const status = getProjectStatus(project);
                    const projectType = getProjectType(project);
                    const colors = getProjectColors(projectType);
                    const Icon = getProjectIcon(projectType);

                    return (
                      <tr
                        key={project._id}
                        className="border-b border-[#232945] hover:bg-[#0f1419] transition-colors"
                      >
                        <td className="p-4">
                          <div className="flex items-center gap-2">
                            <Icon className={`w-4 h-4 ${colors.text}`} />
                            <span className="text-white font-medium">
                              {project.projectName || "Untitled Project"}
                            </span>
                          </div>
                        </td>
                        <td className="p-4">
                          <span
                            className={`px-3 py-1 rounded-full text-xs font-medium ${colors.bg} ${colors.text} border ${colors.border}`}
                          >
                            {projectType}
                          </span>
                        </td>
                        <td className="p-4">
                          <div className="flex items-center gap-1">
                            {project.assignedTo && Array.isArray(project.assignedTo) && project.assignedTo.length > 0 ? (
                              <>
                                {project.assignedTo.slice(0, 3).map((emp, idx) => (
                                  <div
                                    key={idx}
                                    className="w-8 h-8 rounded-full bg-gradient-to-br from-purple-500 to-pink-500 flex items-center justify-center text-white text-xs font-semibold"
                                    title={emp?.name || "Unknown"}
                                  >
                                    {(emp?.name || "U").charAt(0).toUpperCase()}
                                  </div>
                                ))}
                                {project.assignedTo.length > 3 && (
                                  <div className="w-8 h-8 rounded-full bg-gray-700 flex items-center justify-center text-white text-xs font-semibold">
                                    +{project.assignedTo.length - 3}
                                  </div>
                                )}
                              </>
                            ) : (
                              <span className="text-gray-500 text-sm">No team assigned</span>
                            )}
                          </div>
                        </td>
                        <td className="p-4 text-gray-300">
                          {project.endDate
                            ? new Date(project.endDate).toLocaleDateString()
                            : "N/A"}
                        </td>
                        <td className="p-4">
                          <span
                            className={`px-3 py-1 rounded-full text-xs font-medium inline-flex items-center gap-1 ${
                              status === "active"
                                ? "bg-green-500/20 text-green-400 border border-green-500/50"
                                : status === "completed"
                                ? "bg-purple-500/20 text-purple-400 border border-purple-500/50"
                                : status === "needsRenewal"
                                ? "bg-orange-500/20 text-orange-400 border border-orange-500/50"
                                : "bg-red-500/20 text-red-400 border border-red-500/50"
                            }`}
                          >
                            <div
                              className={`w-1.5 h-1.5 rounded-full ${
                                status === "active"
                                  ? "bg-green-400"
                                  : status === "completed"
                                  ? "bg-purple-400"
                                  : status === "needsRenewal"
                                  ? "bg-orange-400"
                                  : "bg-red-400"
                              }`}
                            ></div>
                            {status === "active"
                              ? "Active"
                              : status === "completed"
                              ? "Completed"
                              : status === "needsRenewal"
                              ? "Needs Renewal"
                              : "Inactive"}
                          </span>
                        </td>
                        <td className="p-4">
                          <div className="flex items-center gap-3">
                            <button
                              onClick={() => navigate(`/project/${project._id}`)}
                              className="inline-flex items-center gap-2 px-4 py-2 rounded-lg text-blue-400 hover:text-blue-300 hover:bg-blue-500/10 transition-all"
                            >
                              <Eye className="w-4 h-4" />
                              <span>View Details</span>
                            </button>
                            <div className="relative">
                              <MessageCircle className="w-5 h-5 text-gray-400" />
                              <div className="absolute -top-1 -right-1">
                                <UnreadMessageBadge projectId={project._id} refreshInterval={60000} />
                              </div>
                            </div>
                          </div>
                        </td>
                      </tr>
                    );
                  })
                )}
              </tbody>
            </table>
          </div>

          {/* Mobile Cards */}
          <div className="lg:hidden space-y-3">
            {filteredProjects.length === 0 ? (
              <div className="text-center py-12">
                <FolderKanban className="w-12 h-12 text-gray-600 mx-auto mb-3" />
                <p className="text-gray-500 text-sm">No projects found</p>
              </div>
            ) : (
              filteredProjects.map((project) => {
                const status = getProjectStatus(project);
                const projectType = getProjectType(project);
                const colors = getProjectColors(projectType);
                const Icon = getProjectIcon(projectType);

                return (
                  <div
                    key={project._id}
                    className="bg-[#0f1419] rounded-lg border border-[#232945] p-4"
                  >
                    <div className="flex items-start justify-between mb-3">
                      <div className="flex items-center gap-2 flex-1 min-w-0">
                        <Icon
                          className={`w-4 h-4 ${colors.text} flex-shrink-0`}
                        />
                        <h4 className="text-white font-medium text-sm truncate">
                          {project.projectName || "Untitled Project"}
                        </h4>
                      </div>
                      <span
                        className={`px-2 py-1 rounded-full text-xs font-medium ${colors.bg} ${colors.text} border ${colors.border} flex-shrink-0 ml-2`}
                      >
                        {projectType}
                      </span>
                    </div>

                    <div className="space-y-2 mb-3">
                      <div className="flex items-center gap-2 text-xs text-gray-400">
                        <Calendar className="w-3 h-3 flex-shrink-0" />
                        <span className="truncate">
                          {project.endDate
                            ? new Date(project.endDate).toLocaleDateString()
                            : "N/A"}
                        </span>
                      </div>

                      <div className="flex items-center gap-2">
                        <Users className="w-3 h-3 text-gray-400 flex-shrink-0" />
                        <div className="flex items-center gap-1">
                          {project.assignedTo && Array.isArray(project.assignedTo) && project.assignedTo.length > 0 ? (
                            <>
                              {project.assignedTo.slice(0, 3).map((emp, idx) => (
                                <div
                                  key={idx}
                                  className="w-6 h-6 rounded-full bg-gradient-to-br from-purple-500 to-pink-500 flex items-center justify-center text-white text-xs font-semibold"
                                  title={emp?.name || "Unknown"}
                                >
                                  {(emp?.name || "U").charAt(0).toUpperCase()}
                                </div>
                              ))}
                              {project.assignedTo.length > 3 && (
                                <div className="w-6 h-6 rounded-full bg-gray-700 flex items-center justify-center text-white text-xs font-semibold">
                                  +{project.assignedTo.length - 3}
                                </div>
                              )}
                            </>
                          ) : (
                            <span className="text-gray-500 text-xs">No team</span>
                          )}
                        </div>
                      </div>
                    </div>

                    <div className="flex items-center justify-between pt-3 border-t border-[#232945]">
                      <span
                        className={`px-2 py-1 rounded-full text-xs font-medium inline-flex items-center gap-1 ${
                          status === "active"
                            ? "bg-green-500/20 text-green-400 border border-green-500/50"
                            : status === "completed"
                            ? "bg-purple-500/20 text-purple-400 border border-purple-500/50"
                            : status === "needsRenewal"
                            ? "bg-orange-500/20 text-orange-400 border border-orange-500/50"
                            : "bg-red-500/20 text-red-400 border border-red-500/50"
                        }`}
                      >
                        <div
                          className={`w-1.5 h-1.5 rounded-full ${
                            status === "active"
                              ? "bg-green-400"
                              : status === "completed"
                              ? "bg-purple-400"
                              : status === "needsRenewal"
                              ? "bg-orange-400"
                              : "bg-red-400"
                          }`}
                        ></div>
                        {status === "active"
                          ? "Active"
                          : status === "completed"
                          ? "Completed"
                          : status === "needsRenewal"
                          ? "Needs Renewal"
                          : "Inactive"}
                      </span>

                      <div className="flex items-center gap-2">
                        <div className="relative">
                          <MessageCircle className="w-4 h-4 text-gray-400" />
                          <div className="absolute -top-1 -right-1">
                            <UnreadMessageBadge projectId={project._id} refreshInterval={60000} className="text-[10px] min-w-[16px] h-4 px-1" />
                          </div>
                        </div>
                        <button
                          onClick={() => navigate(`/project/${project._id}`)}
                          className="inline-flex items-center gap-1 px-3 py-1 rounded-lg text-blue-400 hover:text-blue-300 hover:bg-blue-500/10 transition-all text-sm"
                        >
                          <Eye className="w-3 h-3" />
                          <span>View</span>
                        </button>
                      </div>
                    </div>
                  </div>
                );
              })
            )}
          </div>

          <div className="mt-4 text-xs lg:text-sm text-gray-400">
            Showing {filteredProjects.length} of {projects.length} projects
          </div>
        </div>
      </main>
    </div>
  );
};

export default ClientPortal;