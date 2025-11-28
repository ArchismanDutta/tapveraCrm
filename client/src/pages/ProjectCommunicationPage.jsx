import React, { useState, useEffect } from "react";
import API from "../api";
import { useNavigate } from "react-router-dom";
import {
  MessageSquare,
  Search,
  RefreshCw,
  Filter,
  ArrowRight,
  Users,
  Calendar,
  AlertCircle,
  CheckCircle,
  Clock,
  TrendingUp,
  User,
  Briefcase,
  BarChart3,
  ChevronLeft,
  ChevronRight,
  ListTodo,
} from "lucide-react";
import Sidebar from "../components/dashboard/Sidebar";
import CommunicationAnalytics from "../components/analytics/CommunicationAnalytics";

const ProjectCommunicationPage = ({ onLogout }) => {
  const navigate = useNavigate();
  const [projects, setProjects] = useState([]);
  const [loading, setLoading] = useState(false);
  const [searchTerm, setSearchTerm] = useState("");
  const [filterStatus, setFilterStatus] = useState("all"); // all, needsResponse, waitingOnClient
  const [filterClient, setFilterClient] = useState("all"); // all, or specific client ID
  const [filterProjectStatus, setFilterProjectStatus] = useState("all"); // all, new, ongoing, completed
  const [filterCommunicationStatus, setFilterCommunicationStatus] = useState("all"); // all, recent, thisWeek, overdue, criticallyOverdue, noMessages
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);
  const [userRole, setUserRole] = useState("admin");
  const [selectedProjectForAnalytics, setSelectedProjectForAnalytics] = useState(null);

  // Pagination state
  const [currentPage, setCurrentPage] = useState(1);
  const [itemsPerPage, setItemsPerPage] = useState(10);

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

    fetchProjects();
  }, []);

  const fetchProjects = async () => {
    setLoading(true);
    try {
      const res = await API.get("/api/projects/communication-status");
      setProjects(res.data);
    } catch (error) {
      console.error("Error fetching projects:", error);
    } finally {
      setLoading(false);
    }
  };

  // Get color indicator based on communication status
  const getStatusColor = (status) => {
    switch (status) {
      case "recent": // Today
        return {
          bg: "bg-green-500/20",
          text: "text-green-400",
          border: "border-green-500/50",
          dot: "bg-green-400",
        };
      case "thisWeek": // 1-7 days
        return {
          bg: "bg-yellow-500/20",
          text: "text-yellow-400",
          border: "border-yellow-500/50",
          dot: "bg-yellow-400",
        };
      case "overdue": // 7+ days
        return {
          bg: "bg-red-500/20",
          text: "text-red-400",
          border: "border-red-500/50",
          dot: "bg-red-400",
        };
      default: // No messages
        return {
          bg: "bg-gray-500/20",
          text: "text-gray-400",
          border: "border-gray-500/50",
          dot: "bg-gray-400",
        };
    }
  };

  // Get status label
  const getStatusLabel = (communication) => {
    const { status, daysSinceLastMessage } = communication;

    if (status === "none") return "No messages";
    if (status === "recent") return "Today";
    if (daysSinceLastMessage === 1) return "1 day ago";
    return `${daysSinceLastMessage} days ago`;
  };

  // Get sender indicator (who needs to respond)
  const getSenderIndicator = (communication) => {
    if (!communication.lastSenderType) return null;

    const isClient = communication.lastSenderType === "client";
    const isAdmin = communication.lastSenderType === "admin" || communication.lastSenderType === "super-admin";

    return {
      icon: isClient ? User : Briefcase,
      text: isClient ? "Client sent last" : "Admin sent last",
      needsResponse: isClient, // If client sent last, admin needs to respond
      color: isClient ? "text-blue-400" : "text-purple-400",
    };
  };

  // Get unique clients for filter dropdown
  const uniqueClients = Array.from(
    new Set(
      projects
        .flatMap((p) => p.clients || [])
        .map((c) => JSON.stringify({ _id: c._id, name: c.clientName || c.businessName }))
    )
  ).map((str) => JSON.parse(str));

  // Filter projects
  const filteredProjects = projects.filter((project) => {
    // Search filter
    const matchesSearch =
      project.projectName?.toLowerCase().includes(searchTerm.toLowerCase()) ||
      project.clients?.some((c) =>
        c.clientName?.toLowerCase().includes(searchTerm.toLowerCase())
      );

    if (!matchesSearch) return false;

    // Client filter
    if (filterClient !== "all") {
      const hasClient = project.clients?.some((c) => c._id === filterClient);
      if (!hasClient) return false;
    }

    // Project status filter
    if (filterProjectStatus !== "all" && project.status !== filterProjectStatus) {
      return false;
    }

    // Communication status filter (needsResponse/waitingOnClient)
    if (filterStatus !== "all") {
      const senderInfo = getSenderIndicator(project.communication);

      if (filterStatus === "needsResponse") {
        // Show projects where client sent last message (admin needs to respond)
        if (!(senderInfo && senderInfo.needsResponse)) return false;
      }

      if (filterStatus === "waitingOnClient") {
        // Show projects where admin sent last message (waiting on client)
        if (!(senderInfo && !senderInfo.needsResponse)) return false;
      }
    }

    // Communication status filter (recent, thisWeek, overdue, etc.)
    if (filterCommunicationStatus !== "all") {
      if (filterCommunicationStatus === "recent") {
        return project.communication.status === "recent";
      }
      if (filterCommunicationStatus === "thisWeek") {
        return project.communication.status === "thisWeek";
      }
      if (filterCommunicationStatus === "overdue") {
        return project.communication.status === "overdue";
      }
      if (filterCommunicationStatus === "criticallyOverdue") {
        return project.communication.daysSinceLastMessage > 14;
      }
      if (filterCommunicationStatus === "noMessages") {
        return project.communication.status === "none";
      }
      if (filterCommunicationStatus === "active") {
        return project.communication.status === "recent" || project.communication.status === "thisWeek";
      }
    }

    return true;
  });

  // Statistics
  const stats = {
    total: projects.length,
    recent: projects.filter((p) => p.communication.status === "recent").length,
    thisWeek: projects.filter((p) => p.communication.status === "thisWeek").length,
    overdue: projects.filter((p) => p.communication.status === "overdue").length,
    needsResponse: projects.filter((p) => {
      const sender = getSenderIndicator(p.communication);
      return sender && sender.needsResponse;
    }).length,
    noMessages: projects.filter((p) => p.communication.status === "none").length,
    criticallyOverdue: projects.filter((p) => p.communication.daysSinceLastMessage > 14).length, // 2+ weeks
  };

  // Pagination calculations
  const totalPages = Math.ceil(filteredProjects.length / itemsPerPage);
  const startIndex = (currentPage - 1) * itemsPerPage;
  const endIndex = startIndex + itemsPerPage;
  const paginatedProjects = filteredProjects.slice(startIndex, endIndex);

  // Reset to page 1 when filters change
  useEffect(() => {
    setCurrentPage(1);
  }, [searchTerm, filterStatus, filterClient, filterProjectStatus, filterCommunicationStatus]);

  const handlePageChange = (page) => {
    setCurrentPage(page);
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const handleItemsPerPageChange = (newItemsPerPage) => {
    setItemsPerPage(newItemsPerPage);
    setCurrentPage(1);
  };

  return (
    <div className="flex bg-gradient-to-br from-[#141a21] via-[#191f2b] to-[#101218] font-sans text-blue-100 min-h-screen">
      {/* Sidebar */}
      <Sidebar
        collapsed={sidebarCollapsed}
        setCollapsed={setSidebarCollapsed}
        onLogout={onLogout}
        userRole={userRole}
      />

      {/* Main Content */}
      <main
        className={`flex-1 p-8 overflow-y-auto transition-all duration-300 ${
          sidebarCollapsed ? "ml-20" : "ml-72"
        }`}
      >
        {/* Header */}
        <div className="flex flex-col lg:flex-row lg:justify-between lg:items-start gap-6 mb-8">
          <div>
            <h1 className="text-3xl font-bold text-white tracking-tight mb-2">
              Communication Tracking
            </h1>
            <p className="text-blue-300">
              Monitor project communication and identify projects needing attention
            </p>
          </div>

          <button
            onClick={fetchProjects}
            className="flex items-center gap-2 px-4 py-2 rounded-lg bg-blue-600/20 hover:bg-blue-600/40 text-blue-400 border border-blue-500/30 transition-colors"
            disabled={loading}
          >
            <RefreshCw className={`w-4 h-4 ${loading ? "animate-spin" : ""}`} />
            <span className="hidden sm:inline">Refresh</span>
          </button>
        </div>

        {/* Enhanced Summary Dashboard */}
        <div className="bg-gradient-to-r from-purple-600/20 to-pink-600/20 rounded-xl shadow-xl border border-purple-500/30 p-6 mb-8">
          <div className="flex items-center gap-3 mb-4">
            <TrendingUp className="w-6 h-6 text-purple-400" />
            <h2 className="text-xl font-bold text-white">Communication Health Overview</h2>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            <div
              className="bg-[#191f2b]/50 rounded-lg p-4 border border-[#232945] cursor-pointer hover:bg-[#191f2b] transition-all hover:scale-105"
              onClick={() => {
                setFilterStatus('needsResponse');
                setFilterCommunicationStatus('all');
              }}
            >
              <div className="flex items-center justify-between mb-2">
                <p className="text-sm text-gray-400">Urgent Action Required</p>
                <AlertCircle className="w-4 h-4 text-red-400" />
              </div>
              <p className="text-3xl font-bold text-red-400">{stats.needsResponse}</p>
              <p className="text-xs text-gray-500 mt-1">Clients waiting for response</p>
            </div>

            <div
              className="bg-[#191f2b]/50 rounded-lg p-4 border border-[#232945] cursor-pointer hover:bg-[#191f2b] transition-all hover:scale-105"
              onClick={() => {
                setFilterStatus('all');
                setFilterCommunicationStatus('criticallyOverdue');
              }}
            >
              <div className="flex items-center justify-between mb-2">
                <p className="text-sm text-gray-400">Critically Overdue</p>
                <Clock className="w-4 h-4 text-orange-400" />
              </div>
              <p className="text-3xl font-bold text-orange-400">{stats.criticallyOverdue}</p>
              <p className="text-xs text-gray-500 mt-1">No communication for 14+ days</p>
            </div>

            <div
              className="bg-[#191f2b]/50 rounded-lg p-4 border border-[#232945] cursor-pointer hover:bg-[#191f2b] transition-all hover:scale-105"
              onClick={() => {
                setFilterStatus('all');
                setFilterCommunicationStatus('active');
              }}
            >
              <div className="flex items-center justify-between mb-2">
                <p className="text-sm text-gray-400">Active Communication</p>
                <CheckCircle className="w-4 h-4 text-green-400" />
              </div>
              <p className="text-3xl font-bold text-green-400">{stats.recent + stats.thisWeek}</p>
              <p className="text-xs text-gray-500 mt-1">Communicated in last 7 days</p>
            </div>
          </div>
        </div>

        {/* Statistics Cards */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-6 mb-8">
          <div
            className="bg-[#191f2b]/70 rounded-xl shadow-xl border border-[#232945] p-6 cursor-pointer hover:bg-[#191f2b] transition-all hover:scale-105"
            onClick={() => {
              setFilterStatus('all');
              setFilterCommunicationStatus('all');
            }}
          >
            <div className="flex items-center justify-between mb-3">
              <div className="p-3 rounded-lg bg-blue-600/20">
                <MessageSquare className="w-6 h-6 text-blue-400" />
              </div>
            </div>
            <p className="text-sm text-gray-400 mb-1">Total Projects</p>
            <p className="text-3xl font-bold text-white">{stats.total}</p>
          </div>

          <div
            className="bg-[#191f2b]/70 rounded-xl shadow-xl border border-[#232945] p-6 cursor-pointer hover:bg-[#191f2b] transition-all hover:scale-105"
            onClick={() => {
              setFilterStatus('all');
              setFilterCommunicationStatus('recent');
            }}
          >
            <div className="flex items-center justify-between mb-3">
              <div className="p-3 rounded-lg bg-green-600/20">
                <CheckCircle className="w-6 h-6 text-green-400" />
              </div>
            </div>
            <p className="text-sm text-gray-400 mb-1">Recent (Today)</p>
            <p className="text-3xl font-bold text-green-400">{stats.recent}</p>
          </div>

          <div
            className="bg-[#191f2b]/70 rounded-xl shadow-xl border border-[#232945] p-6 cursor-pointer hover:bg-[#191f2b] transition-all hover:scale-105"
            onClick={() => {
              setFilterStatus('all');
              setFilterCommunicationStatus('thisWeek');
            }}
          >
            <div className="flex items-center justify-between mb-3">
              <div className="p-3 rounded-lg bg-yellow-600/20">
                <Clock className="w-6 h-6 text-yellow-400" />
              </div>
            </div>
            <p className="text-sm text-gray-400 mb-1">This Week</p>
            <p className="text-3xl font-bold text-yellow-400">{stats.thisWeek}</p>
          </div>

          <div
            className="bg-[#191f2b]/70 rounded-xl shadow-xl border border-[#232945] p-6 cursor-pointer hover:bg-[#191f2b] transition-all hover:scale-105"
            onClick={() => {
              setFilterStatus('all');
              setFilterCommunicationStatus('overdue');
            }}
          >
            <div className="flex items-center justify-between mb-3">
              <div className="p-3 rounded-lg bg-red-600/20">
                <AlertCircle className="w-6 h-6 text-red-400" />
              </div>
            </div>
            <p className="text-sm text-gray-400 mb-1">Overdue (7+ days)</p>
            <p className="text-3xl font-bold text-red-400">{stats.overdue}</p>
          </div>

          <div
            className="bg-[#191f2b]/70 rounded-xl shadow-xl border border-[#232945] p-6 cursor-pointer hover:bg-[#191f2b] transition-all hover:scale-105"
            onClick={() => {
              setFilterStatus('needsResponse');
              setFilterCommunicationStatus('all');
            }}
          >
            <div className="flex items-center justify-between mb-3">
              <div className="p-3 rounded-lg bg-orange-600/20">
                <TrendingUp className="w-6 h-6 text-orange-400" />
              </div>
            </div>
            <p className="text-sm text-gray-400 mb-1">Needs Response</p>
            <p className="text-3xl font-bold text-orange-400">{stats.needsResponse}</p>
          </div>
        </div>

        {/* Filters and Table */}
        <div className="bg-[#191f2b]/70 rounded-xl shadow-xl border border-[#232945] p-6">
          <div className="flex flex-col lg:flex-row justify-between items-start lg:items-center gap-4 mb-6">
            <div className="flex items-center gap-2">
              <MessageSquare className="w-5 h-5 text-blue-400" />
              <h3 className="text-lg font-semibold text-white">All Projects</h3>
              {loading && (
                <div className="w-4 h-4 border-2 border-blue-500/20 border-t-blue-500 rounded-full animate-spin"></div>
              )}
            </div>

            <div className="flex flex-wrap items-center gap-3 w-full lg:w-auto">
              {/* Search Bar */}
              <div className="relative flex-1 lg:flex-initial lg:w-64">
                <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 w-4 h-4 text-gray-500" />
                <input
                  type="text"
                  placeholder="Search projects..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="w-full pl-10 pr-4 py-2 bg-[#0f1419] border border-[#232945] rounded-lg text-white placeholder-gray-500 focus:outline-none focus:border-blue-500 transition-colors"
                />
              </div>

              {/* Communication Status Filter */}
              <select
                value={filterStatus}
                onChange={(e) => setFilterStatus(e.target.value)}
                className="px-4 py-2 bg-[#0f1419] border border-[#232945] rounded-lg text-white focus:outline-none focus:border-blue-500 transition-colors"
              >
                <option value="all">All Communication</option>
                <option value="needsResponse">Needs Response</option>
                <option value="waitingOnClient">Waiting on Client</option>
              </select>

              {/* Client Filter */}
              <select
                value={filterClient}
                onChange={(e) => setFilterClient(e.target.value)}
                className="px-4 py-2 bg-[#0f1419] border border-[#232945] rounded-lg text-white focus:outline-none focus:border-blue-500 transition-colors"
              >
                <option value="all">All Clients</option>
                {uniqueClients.map((client) => (
                  <option key={client._id} value={client._id}>
                    {client.name}
                  </option>
                ))}
              </select>

              {/* Project Status Filter */}
              <select
                value={filterProjectStatus}
                onChange={(e) => setFilterProjectStatus(e.target.value)}
                className="px-4 py-2 bg-[#0f1419] border border-[#232945] rounded-lg text-white focus:outline-none focus:border-blue-500 transition-colors"
              >
                <option value="all">All Status</option>
                <option value="new">New</option>
                <option value="ongoing">Ongoing</option>
                <option value="completed">Completed</option>
              </select>
            </div>
          </div>

          {/* Table */}
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="border-b-2 border-[#232945]">
                  <th className="text-left pl-6 pr-4 py-4 text-base font-semibold text-gray-400 w-[20%]">
                    Project Name
                  </th>
                  <th className="text-left pl-6 pr-4 py-4 text-base font-semibold text-gray-400 w-[15%]">
                    Client
                  </th>
                  <th className="text-left pl-6 pr-4 py-4 text-base font-semibold text-gray-400 w-[12%]">
                    Status
                  </th>
                  <th className="text-left pl-6 pr-4 py-4 text-base font-semibold text-gray-400 w-[12%]">
                    Last Activity
                  </th>
                  <th className="text-left pl-6 pr-4 py-4 text-base font-semibold text-gray-400 w-[13%]">
                    Last Sender
                  </th>
                  <th className="text-left pl-6 pr-4 py-4 text-base font-semibold text-gray-400 w-[10%]">
                    Pending Tasks
                  </th>
                  <th className="text-left pl-6 pr-4 py-4 text-base font-semibold text-gray-400 w-[18%]">
                    Actions
                  </th>
                </tr>
              </thead>
              <tbody>
                {paginatedProjects.length === 0 ? (
                  <tr>
                    <td colSpan="7" className="text-center py-12">
                      <MessageSquare className="w-12 h-12 text-gray-600 mx-auto mb-3" />
                      <p className="text-gray-500 text-base">
                        {searchTerm || filterStatus !== "all" || filterClient !== "all" || filterProjectStatus !== "all" || filterCommunicationStatus !== "all"
                          ? "No projects found matching your filters"
                          : "No projects found"}
                      </p>
                    </td>
                  </tr>
                ) : (
                  paginatedProjects.map((project) => {
                    const statusColor = getStatusColor(project.communication.status);
                    const senderInfo = getSenderIndicator(project.communication);
                    const SenderIcon = senderInfo?.icon;

                    return (
                      <tr
                        key={project._id}
                        className="border-b border-[#232945] hover:bg-[#0f1419] transition-colors cursor-pointer"
                        onClick={() => navigate(`/project/${project._id}`)}
                      >
                        <td className="pl-6 pr-4 py-5">
                          <div className="flex items-center gap-2">
                            <div
                              className={`w-2 h-2 rounded-full ${statusColor.dot}`}
                            ></div>
                            <span className="text-white font-semibold text-base">
                              {project.projectName}
                            </span>
                            {/* Response time warning badge */}
                            {senderInfo && senderInfo.needsResponse && project.communication.daysSinceLastMessage >= 3 && (
                              <span className="px-2 py-0.5 rounded text-xs font-semibold bg-orange-500/20 text-orange-400 border border-orange-500/50">
                                ⚠️ {project.communication.daysSinceLastMessage}d
                              </span>
                            )}
                            {project.communication.daysSinceLastMessage > 14 && (
                              <span className="px-2 py-0.5 rounded text-xs font-semibold bg-red-500/20 text-red-400 border border-red-500/50">
                                🚨 Critical
                              </span>
                            )}
                          </div>
                        </td>
                        <td className="pl-6 pr-4 py-5 text-gray-300 text-base">
                          {project.clients && project.clients.length > 0
                            ? project.clients.map((c) => c.clientName || c.businessName).join(", ")
                            : "No client"}
                        </td>
                        <td className="pl-6 pr-4 py-5">
                          <span
                            className={`px-3 py-1.5 rounded-full text-xs font-semibold ${statusColor.bg} ${statusColor.text} border ${statusColor.border} inline-flex items-center gap-1.5`}
                          >
                            {getStatusLabel(project.communication)}
                          </span>
                        </td>
                        <td className="pl-6 pr-4 py-5 text-gray-300 text-sm">
                          {project.communication.lastActivityDate ? (
                            <div className="flex items-center gap-2">
                              <Calendar className="w-4 h-4 text-gray-500" />
                              {new Date(
                                project.communication.lastActivityDate
                              ).toLocaleDateString()}
                            </div>
                          ) : (
                            "N/A"
                          )}
                        </td>
                        <td className="pl-6 pr-4 py-5">
                          {senderInfo ? (
                            <div className="flex items-center gap-2">
                              <SenderIcon className={`w-4 h-4 ${senderInfo.color}`} />
                              <div>
                                <p className={`text-sm font-medium ${senderInfo.color}`}>
                                  {project.communication.lastSenderDesignation || project.communication.lastSender || "Team Member"}
                                </p>
                                <p className="text-xs text-gray-500">
                                  {senderInfo.needsResponse
                                    ? "Needs response"
                                    : "Waiting on client"}
                                </p>
                              </div>
                            </div>
                          ) : (
                            <span className="text-gray-500 text-sm">No messages</span>
                          )}
                        </td>
                        <td className="pl-6 pr-4 py-5">
                          <div className="flex items-center gap-2">
                            <ListTodo className="w-4 h-4 text-blue-400" />
                            <span className={`text-base font-semibold ${
                              project.pendingTaskCount > 0 ? 'text-blue-400' : 'text-gray-500'
                            }`}>
                              {project.pendingTaskCount || 0}
                            </span>
                          </div>
                        </td>
                        <td className="pl-6 pr-4 py-5">
                          <div className="flex items-center gap-2">
                            <button
                              onClick={(e) => {
                                e.stopPropagation();
                                navigate(`/project/${project._id}`, { state: { scrollToMessages: true } });
                              }}
                              className="inline-flex items-center gap-1 px-3 py-1.5 rounded-lg text-blue-400 hover:text-blue-300 hover:bg-blue-500/10 transition-all text-sm"
                              title="View project and messages"
                            >
                              <MessageSquare className="w-3 h-3" />
                              Chat
                            </button>
                            <button
                              onClick={(e) => {
                                e.stopPropagation();
                                setSelectedProjectForAnalytics({
                                  id: project._id,
                                  name: project.projectName
                                });
                              }}
                              className="inline-flex items-center gap-1 px-3 py-1.5 rounded-lg text-purple-400 hover:text-purple-300 hover:bg-purple-500/10 transition-all text-sm"
                              title="View detailed analytics"
                            >
                              <BarChart3 className="w-3 h-3" />
                              Analytics
                            </button>
                            {senderInfo && senderInfo.needsResponse && (
                              <span
                                className="px-2 py-1 rounded text-xs font-semibold bg-orange-500/20 text-orange-400 border border-orange-500/50"
                                title="Client is waiting for your response"
                              >
                                Reply
                              </span>
                            )}
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
          <div className="mt-6 space-y-4">
            {/* Top Row: Items per page & Results info */}
            <div className="flex flex-col sm:flex-row items-center justify-between gap-4 text-sm">
              <div className="flex items-center gap-4">
                <div className="flex items-center gap-2">
                  <span className="text-gray-400">Show</span>
                  <select
                    value={itemsPerPage}
                    onChange={(e) => handleItemsPerPageChange(Number(e.target.value))}
                    className="px-3 py-1.5 bg-[#0f1419] border border-[#232945] rounded-lg text-white focus:outline-none focus:border-blue-500 transition-colors"
                  >
                    <option value={5}>5</option>
                    <option value={10}>10</option>
                    <option value={25}>25</option>
                    <option value={50}>50</option>
                    <option value={100}>100</option>
                  </select>
                  <span className="text-gray-400">per page</span>
                </div>

                <div className="text-gray-400">
                  Showing {filteredProjects.length === 0 ? 0 : startIndex + 1}-{Math.min(endIndex, filteredProjects.length)} of {filteredProjects.length}
                  {filteredProjects.length !== projects.length && (
                    <span className="text-gray-500"> (filtered from {projects.length})</span>
                  )}
                </div>
              </div>

              {/* Clear filters */}
              {(searchTerm || filterStatus !== "all" || filterClient !== "all" || filterProjectStatus !== "all" || filterCommunicationStatus !== "all") && (
                <button
                  onClick={() => {
                    setSearchTerm("");
                    setFilterStatus("all");
                    setFilterClient("all");
                    setFilterProjectStatus("all");
                    setFilterCommunicationStatus("all");
                  }}
                  className="text-blue-400 hover:text-blue-300 transition-colors whitespace-nowrap"
                >
                  Clear all filters
                </button>
              )}
            </div>

            {/* Bottom Row: Page navigation centered */}
            {totalPages > 1 && (
              <div className="flex justify-center">
                <div className="flex items-center gap-2">
                  {/* Previous button */}
                  <button
                    onClick={() => handlePageChange(currentPage - 1)}
                    disabled={currentPage === 1}
                    className={`p-2 rounded-lg border transition-all ${
                      currentPage === 1
                        ? 'bg-[#0f1419] border-[#232945] text-gray-600 cursor-not-allowed'
                        : 'bg-[#0f1419] border-[#232945] text-blue-400 hover:bg-blue-500/10 hover:border-blue-500/50'
                    }`}
                  >
                    <ChevronLeft className="w-4 h-4" />
                  </button>

                  {/* Page numbers */}
                  <div className="flex items-center gap-1">
                    {Array.from({ length: totalPages }, (_, i) => i + 1).map((page) => {
                      // Show first page, last page, current page, and pages around current
                      const showPage =
                        page === 1 ||
                        page === totalPages ||
                        (page >= currentPage - 1 && page <= currentPage + 1);

                      const showEllipsisBefore = page === currentPage - 2 && currentPage > 3;
                      const showEllipsisAfter = page === currentPage + 2 && currentPage < totalPages - 2;

                      if (showEllipsisBefore || showEllipsisAfter) {
                        return (
                          <span key={page} className="px-2 text-gray-600">
                            ...
                          </span>
                        );
                      }

                      if (!showPage) return null;

                      return (
                        <button
                          key={page}
                          onClick={() => handlePageChange(page)}
                          className={`min-w-[36px] h-9 px-3 rounded-lg border transition-all ${
                            currentPage === page
                              ? 'bg-blue-600 border-blue-500 text-white font-semibold'
                              : 'bg-[#0f1419] border-[#232945] text-gray-400 hover:bg-blue-500/10 hover:border-blue-500/50 hover:text-blue-400'
                          }`}
                        >
                          {page}
                        </button>
                      );
                    })}
                  </div>

                  {/* Next button */}
                  <button
                    onClick={() => handlePageChange(currentPage + 1)}
                    disabled={currentPage === totalPages}
                    className={`p-2 rounded-lg border transition-all ${
                      currentPage === totalPages
                        ? 'bg-[#0f1419] border-[#232945] text-gray-600 cursor-not-allowed'
                        : 'bg-[#0f1419] border-[#232945] text-blue-400 hover:bg-blue-500/10 hover:border-blue-500/50'
                    }`}
                  >
                    <ChevronRight className="w-4 h-4" />
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>
      </main>

      {/* Analytics Modal */}
      {selectedProjectForAnalytics && (
        <CommunicationAnalytics
          projectId={selectedProjectForAnalytics.id}
          projectName={selectedProjectForAnalytics.name}
          onClose={() => setSelectedProjectForAnalytics(null)}
        />
      )}
    </div>
  );
};

export default ProjectCommunicationPage;
