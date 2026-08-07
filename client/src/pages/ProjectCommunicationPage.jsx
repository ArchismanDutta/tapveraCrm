import React, { useCallback, useEffect, useRef, useState } from "react";
import API from "../api";
import { useNavigate } from "react-router-dom";
import {
  MessageSquare,
  Search,
  RefreshCw,
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
  ChevronDown,
  Filter,
  ListTodo,
} from "lucide-react";
import Sidebar from "../components/dashboard/Sidebar";
import CommunicationAnalytics from "../components/analytics/CommunicationAnalytics";

/**
 * One counter in the attention strip.
 *
 * Extracted because the three were identical apart from colour and copy, and
 * the responsive rules below would otherwise have to be written out three
 * times — which is how two of them end up drifting from the third.
 *
 * `aria-label` carries the full wording at every size, so shortening the
 * visible label on a phone doesn't shorten what a screen reader announces.
 */
const AttentionCard = ({ label, shortLabel, caption, value, icon: Icon, tone, onClick }) => (
  <button
    type="button"
    onClick={onClick}
    aria-label={`${label}: ${value}. ${caption}`}
    className={`communication-stat-card text-left ${tone.card}`}
  >
    <div className="flex items-start justify-between gap-1.5 sm:mb-2 sm:gap-3">
      <p className={`text-[11px] font-medium leading-tight sm:text-sm ${tone.label}`}>
        <span className="sm:hidden">{shortLabel}</span>
        <span className="hidden sm:inline">{label}</span>
      </p>
      <Icon className={`h-3.5 w-3.5 shrink-0 sm:h-4 sm:w-4 ${tone.icon}`} />
    </div>
    <p className={`text-xl font-semibold leading-tight sm:text-3xl ${tone.value}`}>{value}</p>
    {/* The caption explains the number; on a ~105px card it would wrap to four
        lines and undo the point of the compact strip. The `aria-label` above
        keeps it available to assistive tech regardless. */}
    <p className={`mt-1 hidden text-xs sm:block ${tone.caption}`}>{caption}</p>
  </button>
);

const ProjectCommunicationPage = ({ onLogout }) => {
  const navigate = useNavigate();
  const [projects, setProjects] = useState([]);
  const [loading, setLoading] = useState(false);
  const [loadError, setLoadError] = useState("");
  const [searchTerm, setSearchTerm] = useState("");
  const [filterStatus, setFilterStatus] = useState("all"); // all, needsResponse, waitingOnClient
  const [filterClient, setFilterClient] = useState("all"); // all, or specific client ID
  const [filterProjectStatus, setFilterProjectStatus] = useState("all"); // all, new, ongoing, completed
  const [filterCommunicationStatus, setFilterCommunicationStatus] = useState("all"); // all, recent, thisWeek, overdue, criticallyOverdue, noMessages
  // Selects are folded away by default on a phone; ignored from `sm` up, where
  // the grid is always visible.
  const [showFiltersOnMobile, setShowFiltersOnMobile] = useState(false);
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);
  const [userRole, setUserRole] = useState("admin");
  const [selectedProjectForAnalytics, setSelectedProjectForAnalytics] = useState(null);
  const mainRef = useRef(null);

  // Pagination state
  const [currentPage, setCurrentPage] = useState(1);
  const [itemsPerPage, setItemsPerPage] = useState(10);

  const fetchProjects = useCallback(async () => {
    setLoading(true);
    setLoadError("");
    try {
      const res = await API.get("/api/projects/communication-status");
      setProjects(Array.isArray(res.data) ? res.data : []);
    } catch (error) {
      console.error("Error fetching projects:", error);
      setLoadError("We could not load project communication data. Please try again.");
    } finally {
      setLoading(false);
    }
  }, []);

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
  }, [fetchProjects]);

  // Get color indicator based on communication status
  const getStatusColor = (status) => {
    switch (status) {
      case "recent": // Today
        return {
          bg: "bg-emerald-50 dark:bg-emerald-400/10",
          text: "text-emerald-700 dark:text-emerald-300",
          border: "border-emerald-200 dark:border-emerald-400/20",
          dot: "bg-emerald-500",
        };
      case "thisWeek": // 1-7 days
        return {
          bg: "bg-amber-50 dark:bg-amber-400/10",
          text: "text-amber-700 dark:text-amber-300",
          border: "border-amber-200 dark:border-amber-400/20",
          dot: "bg-amber-500",
        };
      case "overdue": // 7+ days
        return {
          bg: "bg-rose-50 dark:bg-rose-400/10",
          text: "text-rose-700 dark:text-rose-300",
          border: "border-rose-200 dark:border-rose-400/20",
          dot: "bg-rose-500",
        };
      default: // No messages
        return {
          bg: "bg-slate-100 dark:bg-white/[0.06]",
          text: "text-slate-600 dark:text-slate-300",
          border: "border-slate-200 dark:border-white/10",
          dot: "bg-slate-400",
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
    return {
      icon: isClient ? User : Briefcase,
      text: isClient ? "Client sent last" : "Admin sent last",
      needsResponse: isClient, // If client sent last, admin needs to respond
      color: isClient ? "text-blue-600 dark:text-blue-300" : "text-violet-600 dark:text-violet-300",
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
    mainRef.current?.scrollTo({ top: 0, behavior: "smooth" });
  };

  const handleItemsPerPageChange = (newItemsPerPage) => {
    setItemsPerPage(newItemsPerPage);
    setCurrentPage(1);
  };

  const clearFilters = () => {
    setSearchTerm("");
    setFilterStatus("all");
    setFilterClient("all");
    setFilterProjectStatus("all");
    setFilterCommunicationStatus("all");
  };

  // Counts only the SELECTS — the four controls that fold away on a phone.
  // Search is always visible, so badging it would be telling the user about
  // something already on screen.
  const activeFilterCount =
    (filterStatus !== "all" ? 1 : 0) +
    (filterClient !== "all" ? 1 : 0) +
    (filterProjectStatus !== "all" ? 1 : 0) +
    (filterCommunicationStatus !== "all" ? 1 : 0);

  const hasActiveFilters = Boolean(searchTerm) || activeFilterCount > 0;

  return (
    <div className="app-shell communication-theme h-[100dvh] overflow-hidden">
      {/* Sidebar */}
      <Sidebar
        collapsed={sidebarCollapsed}
        setCollapsed={setSidebarCollapsed}
        onLogout={onLogout}
        userRole={userRole}
      />

      {/* Main Content */}
      <main
        ref={mainRef}
        className={`app-main h-[100dvh] overflow-y-auto overflow-x-hidden px-3 py-4 transition-all duration-300 [overscroll-behavior-y:auto] [scrollbar-gutter:stable] sm:px-5 lg:px-6 ${
          sidebarCollapsed ? "app-offset app-offset-collapsed" : "app-offset"
        }`}
        style={{ WebkitOverflowScrolling: "touch" }}
      >
        <div className="app-page space-y-4 pb-8 sm:space-y-5">
          {/* Header */}
          <section className="app-header flex flex-col gap-4 overflow-hidden rounded-2xl px-5 py-4 sm:px-6 sm:py-5 lg:flex-row lg:items-center lg:justify-between">
          <div className="flex items-start gap-3">
            <div className="mt-0.5 flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl bg-blue-50 text-blue-600 ring-1 ring-blue-100 dark:bg-blue-400/10 dark:text-blue-300 dark:ring-blue-400/20">
              <MessageSquare className="h-5 w-5" />
            </div>
            <div>
              <p className="app-eyebrow">Project operations</p>
              <h1 className="app-title">Communication tracking</h1>
              <p className="app-description">
                Monitor project communication and identify projects needing attention
              </p>
            </div>
          </div>

          {/* `self-start` stops this stretching to the full width of the header.
              The parent is `flex flex-col` below `lg`, so a flex item with the
              default `align-items: stretch` became a full-width bar containing
              a single centred icon — it read as an empty panel rather than a
              button.

              The label is shown at every size for the same reason: it sits
              alone on its own row here with room to spare, and `hidden
              sm:inline` was reducing it to an unlabelled glyph on exactly the
              screens where an unlabelled glyph is hardest to interpret. */}
          <button
            type="button"
            onClick={fetchProjects}
            className="app-secondary-button inline-flex h-10 shrink-0 items-center justify-center gap-2 self-start rounded-xl px-4 text-sm font-semibold disabled:cursor-not-allowed disabled:opacity-60"
            disabled={loading}
          >
            <RefreshCw className={`h-4 w-4 ${loading ? "animate-spin" : ""}`} />
            <span>Refresh</span>
          </button>
          </section>

          {/* Enhanced Summary Dashboard */}
          <section className="app-panel rounded-2xl p-4 sm:p-5">
          <div className="mb-4 flex items-center gap-3">
            <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-blue-50 text-blue-600 dark:bg-blue-400/10 dark:text-blue-300"><TrendingUp className="h-4 w-4" /></div>
            <div>
              <h2 className="text-base font-semibold text-slate-950 dark:text-white">Attention overview</h2>
              <p className="mt-0.5 text-xs text-slate-500 dark:text-slate-400">Select a category to filter the project list</p>
            </div>
          </div>

          {/* Three-across on a phone, one-per-row from `md`.
              Stacked at full size these ran ~380px — the whole first screen
              given to three numbers, pushing the project list they filter out
              of sight. As a strip they cost about 70px and still read at a
              glance, which is all a counter needs to do.

              Each card drops its caption and shortens its label below `sm`:
              at roughly 105px wide "Urgent action required" wraps to three
              lines and stops being scannable, which is the opposite of what a
              summary strip is for. The full wording returns with the room. */}
          <div className="grid grid-cols-3 gap-2 sm:gap-3">
            <AttentionCard
              label="Urgent action required"
              shortLabel="Urgent"
              caption="Clients waiting for response"
              value={stats.needsResponse}
              icon={AlertCircle}
              tone={{
                card: 'border-rose-200 bg-rose-50 hover:bg-rose-100 dark:border-rose-400/20 dark:bg-rose-400/[0.07] dark:hover:bg-rose-400/10',
                label: 'text-rose-900 dark:text-rose-100',
                icon: 'text-rose-600 dark:text-rose-300',
                value: 'text-rose-700 dark:text-rose-200',
                caption: 'text-rose-700/70 dark:text-rose-200/60',
              }}
              onClick={() => {
                setFilterStatus('needsResponse');
                setFilterCommunicationStatus('all');
              }}
            />

            <AttentionCard
              label="Critically overdue"
              shortLabel="Overdue"
              caption="No communication for 14+ days"
              value={stats.criticallyOverdue}
              icon={Clock}
              tone={{
                card: 'border-amber-200 bg-amber-50 hover:bg-amber-100 dark:border-amber-400/20 dark:bg-amber-400/[0.07] dark:hover:bg-amber-400/10',
                label: 'text-amber-900 dark:text-amber-100',
                icon: 'text-amber-600 dark:text-amber-300',
                value: 'text-amber-700 dark:text-amber-200',
                caption: 'text-amber-700/70 dark:text-amber-200/60',
              }}
              onClick={() => {
                setFilterStatus('all');
                setFilterCommunicationStatus('criticallyOverdue');
              }}
            />

            <AttentionCard
              label="Active communication"
              shortLabel="Active"
              caption="Communicated in last 7 days"
              value={stats.recent + stats.thisWeek}
              icon={CheckCircle}
              tone={{
                card: 'border-emerald-200 bg-emerald-50 hover:bg-emerald-100 dark:border-emerald-400/20 dark:bg-emerald-400/[0.07] dark:hover:bg-emerald-400/10',
                label: 'text-emerald-900 dark:text-emerald-100',
                icon: 'text-emerald-600 dark:text-emerald-300',
                value: 'text-emerald-700 dark:text-emerald-200',
                caption: 'text-emerald-700/70 dark:text-emerald-200/60',
              }}
              onClick={() => {
                setFilterStatus('all');
                setFilterCommunicationStatus('active');
              }}
            />
          </div>
          </section>

          {/* Filters and Table */}
          <section className="app-panel rounded-2xl p-4 sm:p-5">
          <div className="mb-5 flex flex-col gap-5">
            <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
              <div className="flex items-center gap-2">
                <MessageSquare className="h-5 w-5 text-blue-600 dark:text-blue-300" />
                <div>
                  <h3 className="text-base font-semibold text-slate-950 dark:text-white">Projects</h3>
                  <p className="text-xs text-slate-500 dark:text-slate-400">{filteredProjects.length} of {projects.length} projects</p>
                </div>
                {loading && (
                  <div className="h-4 w-4 animate-spin rounded-full border-2 border-blue-500/20 border-t-blue-600"></div>
                )}
              </div>
              <div className="flex items-center gap-2">
                {/* Disclosure for the four selects, phone only. Stacked at full
                    width they ran ~280px on top of the search box — the project
                    list they filter started below the fold. The count tells you
                    filters are active while they're folded away; a hidden
                    filter is how people conclude their data has gone missing. */}
                <button
                  type="button"
                  onClick={() => setShowFiltersOnMobile((v) => !v)}
                  aria-expanded={showFiltersOnMobile}
                  aria-controls="communication-filter-fields"
                  className="app-secondary-button inline-flex h-9 items-center justify-center gap-1.5 rounded-lg px-3 text-xs font-semibold sm:hidden"
                >
                  <Filter className="h-3.5 w-3.5" />
                  Filters
                  {activeFilterCount > 0 && (
                    <span className="inline-flex h-4 min-w-4 items-center justify-center rounded-full bg-blue-600 px-1 text-[10px] font-semibold leading-none text-white">
                      {activeFilterCount}
                    </span>
                  )}
                  <ChevronDown className={`h-3.5 w-3.5 transition-transform ${showFiltersOnMobile ? 'rotate-180' : ''}`} />
                </button>

                {hasActiveFilters && (
                  <button
                    type="button"
                    onClick={clearFilters}
                    className="app-secondary-button inline-flex h-9 shrink-0 items-center justify-center rounded-lg px-3 text-xs font-semibold"
                  >
                    Clear filters
                  </button>
                )}
              </div>
            </div>

            {/* Search stays out of the disclosure — it's the control people
                actually reach for, and burying it behind a tap would be a
                regression dressed up as tidiness. */}
            <div className="relative min-w-0 sm:hidden">
              <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
              <input
                type="search"
                aria-label="Search projects"
                placeholder="Search projects"
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="app-control h-10 w-full rounded-xl pl-9 pr-3 text-sm outline-none transition placeholder:text-slate-400 focus:border-blue-500 focus:ring-2 focus:ring-blue-500/15"
              />
            </div>

            <div
              id="communication-filter-fields"
              className={`w-full gap-3 sm:grid sm:grid-cols-2 xl:grid-cols-5 ${showFiltersOnMobile ? 'grid' : 'hidden'}`}
            >
              {/* Search Bar — desktop copy; the always-visible one above takes
                  over below `sm`. */}
              <div className="relative hidden min-w-0 sm:block sm:col-span-2 xl:col-span-1">
                <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
                <input
                  type="search"
                  aria-label="Search projects"
                  placeholder="Search projects"
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="app-control h-10 w-full rounded-xl pl-9 pr-3 text-sm outline-none transition placeholder:text-slate-400 focus:border-blue-500 focus:ring-2 focus:ring-blue-500/15"
                />
              </div>

              {/* Communication Status Filter */}
              <select
                value={filterStatus}
                onChange={(e) => setFilterStatus(e.target.value)}
                aria-label="Filter by response status"
                className="app-control h-10 rounded-xl px-3 text-sm outline-none transition focus:border-blue-500 focus:ring-2 focus:ring-blue-500/15"
              >
                <option value="all">All Communication</option>
                <option value="needsResponse">Needs Response</option>
                <option value="waitingOnClient">Waiting on Client</option>
              </select>

              {/* Client Filter */}
              <select
                value={filterClient}
                onChange={(e) => setFilterClient(e.target.value)}
                aria-label="Filter by client"
                className="app-control h-10 rounded-xl px-3 text-sm outline-none transition focus:border-blue-500 focus:ring-2 focus:ring-blue-500/15"
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
                aria-label="Filter by project status"
                className="app-control h-10 rounded-xl px-3 text-sm outline-none transition focus:border-blue-500 focus:ring-2 focus:ring-blue-500/15"
              >
                <option value="all">All Status</option>
                <option value="new">New</option>
                <option value="ongoing">Ongoing</option>
                <option value="completed">Completed</option>
              </select>

              <select
                value={filterCommunicationStatus}
                onChange={(e) => setFilterCommunicationStatus(e.target.value)}
                aria-label="Filter by communication recency"
                className="app-control h-10 rounded-xl px-3 text-sm outline-none transition focus:border-blue-500 focus:ring-2 focus:ring-blue-500/15"
              >
                <option value="all">Any activity</option>
                <option value="recent">Today</option>
                <option value="thisWeek">This week</option>
                <option value="overdue">Overdue</option>
                <option value="criticallyOverdue">Critical</option>
                <option value="noMessages">No messages</option>
              </select>
            </div>
          </div>

          {loadError && projects.length === 0 && (
            <div className="mb-5 flex flex-col items-center rounded-xl border border-rose-200 bg-rose-50 px-4 py-8 text-center dark:border-rose-400/20 dark:bg-rose-400/[0.07]">
              <AlertCircle className="h-7 w-7 text-rose-600 dark:text-rose-300" />
              <p className="mt-3 text-sm font-semibold text-rose-900 dark:text-rose-100">Communication data unavailable</p>
              <p className="mt-1 text-xs text-rose-700/70 dark:text-rose-200/60">{loadError}</p>
              <button type="button" onClick={fetchProjects} className="mt-4 h-9 rounded-lg bg-rose-600 px-4 text-xs font-semibold text-white transition hover:bg-rose-700">Try again</button>
            </div>
          )}

          {/* Mobile project cards */}
          <div className="space-y-4 2xl:hidden">
            {paginatedProjects.map((project) => {
              const statusColor = getStatusColor(project.communication.status);
              const senderInfo = getSenderIndicator(project.communication);
              const SenderIcon = senderInfo?.icon;

              return (
                <article key={project._id} className="communication-project-card rounded-2xl p-4">
                  <button type="button" onClick={() => navigate(`/project/${project._id}`)} className="w-full text-left">
                    <div className="flex items-start justify-between gap-3">
                      <div className="min-w-0">
                        <div className="flex items-center gap-2">
                          <span className={`h-2 w-2 shrink-0 rounded-full ${statusColor.dot}`} />
                          <h4 className="truncate text-sm font-semibold text-slate-950 dark:text-white">{project.projectName}</h4>
                        </div>
                        <p className="mt-1 truncate pl-4 text-xs text-slate-500 dark:text-slate-400">
                          {project.clients?.length ? project.clients.map((client) => client.clientName || client.businessName).join(", ") : "No client assigned"}
                        </p>
                      </div>
                      <span className={`inline-flex shrink-0 items-center rounded-lg border px-2 py-1 text-[11px] font-semibold ${statusColor.bg} ${statusColor.text} ${statusColor.border}`}>
                        {getStatusLabel(project.communication)}
                      </span>
                    </div>

                    <div className="mt-4 grid grid-cols-2 gap-3 border-t border-slate-100 pt-3 dark:border-white/[0.07]">
                      <div>
                        <p className="text-[11px] text-slate-400">Last sender</p>
                        {senderInfo ? (
                          <div className="mt-1 flex items-center gap-1.5">
                            <SenderIcon className={`h-3.5 w-3.5 ${senderInfo.color}`} />
                            <p className={`truncate text-xs font-medium ${senderInfo.color}`}>{project.communication.lastSenderDesignation || project.communication.lastSender || "Team member"}</p>
                          </div>
                        ) : <p className="mt-1 text-xs text-slate-500">No messages</p>}
                      </div>
                      <div>
                        <p className="text-[11px] text-slate-400">Pending tasks</p>
                        <p className="mt-1 text-xs font-semibold text-slate-700 dark:text-slate-200">{project.pendingTaskCount || 0}</p>
                      </div>
                    </div>
                  </button>

                  <div className="mt-3 flex gap-2">
                    <button type="button" onClick={() => navigate(`/project/${project._id}`, { state: { scrollToMessages: true } })} className="communication-chat-button inline-flex h-9 flex-1 items-center justify-center gap-2 rounded-lg text-xs font-semibold">
                      <MessageSquare className="h-3.5 w-3.5" /> Open chat
                    </button>
                    <button type="button" onClick={() => setSelectedProjectForAnalytics({ id: project._id, name: project.projectName })} className="app-secondary-button inline-flex h-9 flex-1 items-center justify-center gap-2 rounded-lg text-xs font-semibold">
                      <BarChart3 className="h-3.5 w-3.5" /> Analytics
                    </button>
                  </div>
                </article>
              );
            })}

            {!loadError && !loading && paginatedProjects.length === 0 && (
              <div className="flex flex-col items-center py-12 text-center">
                <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-slate-100 text-slate-400 dark:bg-white/[0.06]"><MessageSquare className="h-5 w-5" /></div>
                <p className="mt-3 text-sm font-medium text-slate-700 dark:text-slate-200">No projects found</p>
                <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">{hasActiveFilters ? "Try adjusting or clearing your filters." : "Projects will appear here when available."}</p>
              </div>
            )}
          </div>

          {/* Desktop table */}
          <div className="hidden overflow-hidden rounded-2xl border border-slate-200 dark:border-white/10 2xl:block">
            <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="border-b border-slate-200 dark:border-white/10">
                  <th className="w-[20%] px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide text-slate-500 dark:text-slate-400">
                    Project Name
                  </th>
                  <th className="w-[15%] px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide text-slate-500 dark:text-slate-400">
                    Client
                  </th>
                  <th className="w-[12%] px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide text-slate-500 dark:text-slate-400">
                    Status
                  </th>
                  <th className="w-[12%] px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide text-slate-500 dark:text-slate-400">
                    Last Activity
                  </th>
                  <th className="w-[13%] px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide text-slate-500 dark:text-slate-400">
                    Last Sender
                  </th>
                  <th className="w-[10%] px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide text-slate-500 dark:text-slate-400">
                    Pending Tasks
                  </th>
                  <th className="w-[18%] px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide text-slate-500 dark:text-slate-400">
                    Actions
                  </th>
                </tr>
              </thead>
              <tbody>
                {loadError && projects.length === 0 ? null : loading && projects.length === 0 ? (
                  <tr>
                    <td colSpan="7" className="py-14 text-center">
                      <div className="inline-flex items-center gap-2 text-sm text-slate-500 dark:text-slate-400"><RefreshCw className="h-4 w-4 animate-spin" /> Loading projects</div>
                    </td>
                  </tr>
                ) : paginatedProjects.length === 0 ? (
                  <tr>
                    <td colSpan="7" className="py-14 text-center">
                      <div className="mx-auto flex h-11 w-11 items-center justify-center rounded-xl bg-slate-100 text-slate-400 dark:bg-white/[0.06]"><MessageSquare className="h-5 w-5" /></div>
                      <p className="mt-3 text-sm text-slate-500 dark:text-slate-400">
                        {hasActiveFilters ? "No projects match your filters" : "No projects found"}
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
                        className="cursor-pointer border-b border-slate-100 transition-colors last:border-b-0 hover:bg-slate-50 dark:border-white/[0.07] dark:hover:bg-white/[0.025]"
                        onClick={() => navigate(`/project/${project._id}`)}
                      >
                        <td className="px-4 py-4">
                          <div className="flex items-center gap-2">
                            <div
                              className={`w-2 h-2 rounded-full ${statusColor.dot}`}
                            ></div>
                            <span className="text-sm font-semibold text-slate-950 dark:text-white">
                              {project.projectName}
                            </span>
                            {/* Response time warning badge */}
                            {senderInfo && senderInfo.needsResponse && project.communication.daysSinceLastMessage >= 3 && (
                              <span className="inline-flex items-center gap-1 rounded-md border border-amber-200 bg-amber-50 px-2 py-0.5 text-[11px] font-semibold text-amber-700 dark:border-amber-400/20 dark:bg-amber-400/10 dark:text-amber-300">
                                <AlertCircle className="h-3 w-3" /> {project.communication.daysSinceLastMessage}d
                              </span>
                            )}
                            {project.communication.daysSinceLastMessage > 14 && (
                              <span className="inline-flex items-center gap-1 rounded-md border border-rose-200 bg-rose-50 px-2 py-0.5 text-[11px] font-semibold text-rose-700 dark:border-rose-400/20 dark:bg-rose-400/10 dark:text-rose-300">
                                <AlertCircle className="h-3 w-3" /> Critical
                              </span>
                            )}
                          </div>
                        </td>
                        <td className="px-4 py-4 text-sm text-slate-600 dark:text-slate-300">
                          {project.clients && project.clients.length > 0
                            ? project.clients.map((c) => c.clientName || c.businessName).join(", ")
                            : "No client"}
                        </td>
                        <td className="px-4 py-4">
                          <span
                            className={`px-3 py-1.5 rounded-full text-xs font-semibold ${statusColor.bg} ${statusColor.text} border ${statusColor.border} inline-flex items-center gap-1.5`}
                          >
                            {getStatusLabel(project.communication)}
                          </span>
                        </td>
                        <td className="px-4 py-4 text-sm text-slate-600 dark:text-slate-300">
                          {project.communication.lastActivityDate ? (
                            <div className="flex items-center gap-2">
                              <Calendar className="h-4 w-4 text-slate-400" />
                              {new Date(
                                project.communication.lastActivityDate
                              ).toLocaleDateString()}
                            </div>
                          ) : (
                            "N/A"
                          )}
                        </td>
                        <td className="px-4 py-4">
                          {senderInfo ? (
                            <div className="flex items-center gap-2">
                              <SenderIcon className={`w-4 h-4 ${senderInfo.color}`} />
                              <div>
                                <p className={`text-sm font-medium ${senderInfo.color}`}>
                                  {project.communication.lastSenderDesignation || project.communication.lastSender || "Team Member"}
                                </p>
                                <p className="text-xs text-slate-500 dark:text-slate-400">
                                  {senderInfo.needsResponse
                                    ? "Needs response"
                                    : "Waiting on client"}
                                </p>
                              </div>
                            </div>
                          ) : (
                            <span className="text-sm text-slate-500 dark:text-slate-400">No messages</span>
                          )}
                        </td>
                        <td className="px-4 py-4">
                          <div className="flex items-center gap-2">
                            <ListTodo className="h-4 w-4 text-blue-600 dark:text-blue-300" />
                            <span className={`text-base font-semibold ${
                              project.pendingTaskCount > 0 ? 'text-blue-600 dark:text-blue-300' : 'text-slate-400'
                            }`}>
                              {project.pendingTaskCount || 0}
                            </span>
                          </div>
                        </td>
                        <td className="px-4 py-4">
                          <div className="flex items-center gap-2">
                            <button
                              onClick={(e) => {
                                e.stopPropagation();
                                navigate(`/project/${project._id}`, { state: { scrollToMessages: true } });
                              }}
                              className="communication-chat-button inline-flex h-8 items-center gap-1.5 rounded-lg px-3 text-xs font-semibold"
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
                              className="app-secondary-button inline-flex h-8 items-center gap-1.5 rounded-lg px-3 text-xs font-semibold"
                              title="View detailed analytics"
                            >
                              <BarChart3 className="w-3 h-3" />
                              Analytics
                            </button>
                            {senderInfo && senderInfo.needsResponse && (
                              <span
                                className="rounded-md border border-amber-200 bg-amber-50 px-2 py-1 text-[11px] font-semibold text-amber-700 dark:border-amber-400/20 dark:bg-amber-400/10 dark:text-amber-300"
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
          </div>

          {/* Pagination Controls */}
          {!(loadError && projects.length === 0) && (
          <div className="mt-5 space-y-4 border-t border-slate-200 pt-4 dark:border-white/10">
            {/* Top Row: Items per page & Results info */}
            <div className="flex flex-col sm:flex-row items-center justify-between gap-4 text-sm">
              <div className="flex items-center gap-4">
                <div className="flex items-center gap-2">
                  <span className="text-slate-500 dark:text-slate-400">Show</span>
                  <select
                    value={itemsPerPage}
                    onChange={(e) => handleItemsPerPageChange(Number(e.target.value))}
                    className="app-control h-9 rounded-lg px-3 text-sm outline-none focus:border-blue-500"
                  >
                    <option value={5}>5</option>
                    <option value={10}>10</option>
                    <option value={25}>25</option>
                    <option value={50}>50</option>
                    <option value={100}>100</option>
                  </select>
                  <span className="text-slate-500 dark:text-slate-400">per page</span>
                </div>

                <div className="text-slate-500 dark:text-slate-400">
                  Showing {filteredProjects.length === 0 ? 0 : startIndex + 1}-{Math.min(endIndex, filteredProjects.length)} of {filteredProjects.length}
                  {filteredProjects.length !== projects.length && (
                    <span className="text-slate-400 dark:text-slate-500"> (filtered from {projects.length})</span>
                  )}
                </div>
              </div>

              <div className="hidden sm:block" />
            </div>

            {/* Bottom Row: Page navigation centered */}
            {totalPages > 1 && (
              <div className="flex justify-center">
                <div className="flex items-center gap-2">
                  {/* Previous button */}
                  <button
                    onClick={() => handlePageChange(currentPage - 1)}
                    disabled={currentPage === 1}
                    aria-label="Previous page"
                    className={`rounded-lg border p-2 transition ${
                      currentPage === 1
                        ? 'cursor-not-allowed border-slate-200 bg-slate-100 text-slate-300 dark:border-white/10 dark:bg-white/[0.03] dark:text-slate-600'
                        : 'border-slate-200 bg-white text-slate-600 hover:bg-slate-50 dark:border-white/10 dark:bg-white/[0.04] dark:text-slate-300 dark:hover:bg-white/[0.07]'
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
                          <span key={page} className="px-2 text-slate-400">
                            ...
                          </span>
                        );
                      }

                      if (!showPage) return null;

                      return (
                        <button
                          key={page}
                          onClick={() => handlePageChange(page)}
                          aria-label={`Page ${page}`}
                          aria-current={currentPage === page ? "page" : undefined}
                          className={`h-9 min-w-[36px] rounded-lg border px-3 text-sm transition ${
                            currentPage === page
                              ? 'border-blue-600 bg-blue-600 font-semibold text-white'
                              : 'border-slate-200 bg-white text-slate-600 hover:bg-slate-50 dark:border-white/10 dark:bg-white/[0.04] dark:text-slate-300 dark:hover:bg-white/[0.07]'
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
                    aria-label="Next page"
                    className={`rounded-lg border p-2 transition ${
                      currentPage === totalPages
                        ? 'cursor-not-allowed border-slate-200 bg-slate-100 text-slate-300 dark:border-white/10 dark:bg-white/[0.03] dark:text-slate-600'
                        : 'border-slate-200 bg-white text-slate-600 hover:bg-slate-50 dark:border-white/10 dark:bg-white/[0.04] dark:text-slate-300 dark:hover:bg-white/[0.07]'
                    }`}
                  >
                    <ChevronRight className="w-4 h-4" />
                  </button>
                </div>
              </div>
            )}
          </div>
          )}
        </section>
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
