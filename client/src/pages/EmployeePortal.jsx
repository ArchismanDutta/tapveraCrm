import React, { useCallback, useEffect, useMemo, useState } from "react";
import {
  ArrowLeft,
  ArrowRight,
  BarChart3,
  CalendarDays,
  CheckCircle2,
  CircleDot,
  ClipboardList,
  FileText,
  FolderKanban,
  MessageSquare,
  Search,
  Users,
} from "lucide-react";
import Sidebar from "../components/dashboard/Sidebar";
import PaymentBlockOverlay from "../components/payment/PaymentBlockOverlay";
import usePaymentCheck from "../hooks/usePaymentCheck";
import ProjectReportTab from "../components/project/ProjectReportTab";
import ProjectMessagePanel from "../components/message/ProjectMessagePanel";

const API_BASE = import.meta.env.VITE_API_BASE || "http://localhost:5000";

const normalizeProjects = (payload) => {
  const projectList = Array.isArray(payload)
    ? payload
    : Array.isArray(payload?.projects)
    ? payload.projects
    : [];

  return projectList.map((project) => ({
    ...project,
    clients:
      project.clients?.length > 0
        ? project.clients
        : project.client
        ? [project.client]
        : [],
  }));
};

const formatDate = (value) =>
  value
    ? new Date(value).toLocaleDateString("en-IN", {
        day: "2-digit",
        month: "short",
        year: "numeric",
        timeZone: "Asia/Kolkata",
      })
    : "Not set";

const getClientNames = (project) => {
  const names = (project.clients || [])
    .map((client) => client?.businessName || client?.clientName)
    .filter(Boolean);
  return names.length > 0 ? names.join(", ") : "No client assigned";
};

const getProjectTypes = (project) => {
  if (Array.isArray(project.type)) return project.type.filter(Boolean);
  if (typeof project.type === "string") {
    return project.type
      .split(",")
      .map((type) => type.trim())
      .filter(Boolean);
  }
  return [];
};

const getStatusStyle = (status) => {
  switch (String(status || "").toLowerCase()) {
    case "active":
    case "in progress":
    case "in-progress":
      return "border-blue-200 bg-blue-50 text-blue-700 dark:border-blue-400/20 dark:bg-blue-400/10 dark:text-blue-200";
    case "completed":
      return "border-emerald-200 bg-emerald-50 text-emerald-700 dark:border-emerald-400/20 dark:bg-emerald-400/10 dark:text-emerald-200";
    case "inactive":
    case "rejected":
      return "border-rose-200 bg-rose-50 text-rose-700 dark:border-rose-400/20 dark:bg-rose-400/10 dark:text-rose-200";
    case "pending":
      return "border-amber-200 bg-amber-50 text-amber-700 dark:border-amber-400/20 dark:bg-amber-400/10 dark:text-amber-200";
    default:
      return "border-slate-200 bg-slate-50 text-slate-600 dark:border-white/10 dark:bg-white/[0.04] dark:text-slate-300";
  }
};

const EmployeePortal = ({ onLogout }) => {
  const [collapsed, setCollapsed] = useState(false);
  const [projects, setProjects] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [searchTerm, setSearchTerm] = useState("");
  const [selectedProjectId, setSelectedProjectId] = useState(null);
  const [activeTab, setActiveTab] = useState("overview");
  const { activePayment, checkingPayment, clearPayment } = usePaymentCheck();

  const fetchEmployeeProjects = useCallback(async () => {
    try {
      setLoading(true);
      setError("");
      const token = localStorage.getItem("token");
      const response = await fetch(`${API_BASE}/api/projects?limit=100`, {
        headers: {
          Authorization: `Bearer ${token}`,
          "Content-Type": "application/json",
        },
      });

      if (!response.ok) throw new Error("Unable to load assigned projects");
      setProjects(normalizeProjects(await response.json()));
    } catch (fetchError) {
      console.error("Error fetching employee projects:", fetchError);
      setProjects([]);
      setError(fetchError.message || "Unable to load assigned projects");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchEmployeeProjects();
  }, [fetchEmployeeProjects]);

  const selectedProject = useMemo(
    () => projects.find((project) => project._id === selectedProjectId) || null,
    [projects, selectedProjectId]
  );

  const filteredProjects = useMemo(() => {
    const query = searchTerm.trim().toLowerCase();
    if (!query) return projects;

    return projects.filter((project) => {
      const searchable = [
        project.projectName,
        getClientNames(project),
        project.status,
        ...getProjectTypes(project),
      ]
        .filter(Boolean)
        .join(" ")
        .toLowerCase();
      return searchable.includes(query);
    });
  }, [projects, searchTerm]);

  const stats = useMemo(() => {
    const active = projects.filter((project) =>
      ["active", "in progress", "in-progress"].includes(
        String(project.status || "").toLowerCase()
      )
    ).length;
    const completed = projects.filter(
      (project) => String(project.status || "").toLowerCase() === "completed"
    ).length;
    return { total: projects.length, active, completed };
  }, [projects]);

  const handlePaymentCleared = () => {
    clearPayment();
    fetchEmployeeProjects();
  };

  const openProject = (projectId) => {
    setSelectedProjectId(projectId);
    setActiveTab("overview");
  };

  if (checkingPayment) {
    return <PageLoader label="Checking account status..." />;
  }

  if (activePayment) {
    return (
      <PaymentBlockOverlay
        payment={activePayment}
        onPaymentCleared={handlePaymentCleared}
      />
    );
  }

  return (
    <div className="relative flex h-[100dvh] overflow-hidden bg-slate-50 font-sans text-slate-900 dark:bg-[#0b0d12] dark:text-slate-100">
      <Sidebar
        collapsed={collapsed}
        setCollapsed={setCollapsed}
        onLogout={onLogout}
        userRole="employee"
      />

      <main
        className={`h-[100dvh] min-w-0 flex-1 overflow-y-auto overflow-x-hidden px-3 py-4 transition-all duration-300 [scrollbar-gutter:stable] sm:px-5 lg:px-6 ${
          collapsed ? "ml-16" : "ml-16 sm:ml-56"
        }`}
        style={{ WebkitOverflowScrolling: "touch" }}
      >
        <div className="mx-auto max-w-[1500px] pb-8">
          {selectedProject ? (
            <ProjectWorkspace
              project={selectedProject}
              activeTab={activeTab}
              setActiveTab={setActiveTab}
              onBack={() => setSelectedProjectId(null)}
            />
          ) : (
            <ProjectPortfolio
              projects={filteredProjects}
              stats={stats}
              searchTerm={searchTerm}
              setSearchTerm={setSearchTerm}
              loading={loading}
              error={error}
              onRetry={fetchEmployeeProjects}
              onOpenProject={openProject}
            />
          )}
        </div>
      </main>
    </div>
  );
};

const PageLoader = ({ label }) => (
  <div className="flex h-[100dvh] items-center justify-center bg-slate-50 dark:bg-[#0b0d12]">
    <div className="text-center">
      <div className="mx-auto h-10 w-10 animate-spin rounded-full border-2 border-blue-200 border-t-blue-600 dark:border-white/10 dark:border-t-blue-400" />
      <p className="mt-4 text-sm font-medium text-slate-600 dark:text-slate-300">{label}</p>
    </div>
  </div>
);

const ProjectPortfolio = ({
  projects,
  stats,
  searchTerm,
  setSearchTerm,
  loading,
  error,
  onRetry,
  onOpenProject,
}) => (
  <div className="space-y-4 sm:space-y-5">
    <header className="rounded-2xl border border-slate-200 bg-white px-5 py-5 shadow-sm dark:border-white/10 dark:bg-[#10131c] sm:px-6">
      <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
        <div>
          <div className="text-xs font-semibold uppercase tracking-wider text-slate-500 dark:text-slate-400">Employee workspace</div>
          <h1 className="mt-1 text-2xl font-semibold tracking-tight text-slate-950 dark:text-white">My projects</h1>
          <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">Assigned projects, tasks, communication, and reports.</p>
        </div>
        <label className="relative block w-full lg:max-w-sm">
          <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
          <input
            type="search"
            value={searchTerm}
            onChange={(event) => setSearchTerm(event.target.value)}
            placeholder="Search projects or clients"
            className="h-10 w-full rounded-xl border border-slate-200 bg-slate-50 pl-9 pr-3 text-sm text-slate-900 outline-none transition placeholder:text-slate-400 focus:border-blue-500 focus:ring-2 focus:ring-blue-500/15 dark:border-white/10 dark:bg-white/[0.04] dark:text-white dark:placeholder:text-slate-500"
          />
        </label>
      </div>
    </header>

    <section className="grid grid-cols-3 gap-px overflow-hidden rounded-2xl border border-slate-200 bg-slate-200 shadow-sm dark:border-white/10 dark:bg-white/10">
      {[
        { label: "Assigned", value: stats.total, icon: FolderKanban },
        { label: "Active", value: stats.active, icon: CircleDot },
        { label: "Completed", value: stats.completed, icon: CheckCircle2 },
      ].map(({ label, value, icon: Icon }) => (
        <div key={label} className="flex items-center gap-3 bg-white px-4 py-3.5 dark:bg-[#10131c] sm:px-5">
          <div className="hidden h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-slate-100 text-slate-500 dark:bg-white/[0.05] dark:text-slate-300 sm:flex">
            {React.createElement(Icon, { className: "h-4 w-4" })}
          </div>
          <div>
            <div className="text-xl font-semibold text-slate-950 dark:text-white">{value}</div>
            <div className="text-xs text-slate-500 dark:text-slate-400">{label}</div>
          </div>
        </div>
      ))}
    </section>

    {loading ? (
      <div className="rounded-2xl border border-slate-200 bg-white py-16 text-center shadow-sm dark:border-white/10 dark:bg-[#10131c]">
        <div className="mx-auto h-8 w-8 animate-spin rounded-full border-2 border-blue-200 border-t-blue-600 dark:border-white/10 dark:border-t-blue-400" />
        <p className="mt-3 text-sm text-slate-500 dark:text-slate-400">Loading assigned projects...</p>
      </div>
    ) : error ? (
      <EmptyState
        icon={FolderKanban}
        title="Projects could not be loaded"
        description={error}
        actionLabel="Try again"
        onAction={onRetry}
      />
    ) : projects.length > 0 ? (
      <section className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-3">
        {projects.map((project) => (
          <ProjectCard
            key={project._id}
            project={project}
            onOpen={() => onOpenProject(project._id)}
          />
        ))}
      </section>
    ) : (
      <EmptyState
        icon={FolderKanban}
        title={searchTerm ? "No matching projects" : "No projects assigned"}
        description={
          searchTerm
            ? "Try a different project name, client, type, or status."
            : "Projects assigned to you will appear here."
        }
      />
    )}
  </div>
);

const ProjectCard = ({ project, onOpen }) => {
  const types = getProjectTypes(project);
  const teamSize = project.assignedTo?.length || 0;

  return (
    <button
      type="button"
      onClick={onOpen}
      className="group flex min-h-64 flex-col overflow-hidden rounded-2xl border border-slate-200 bg-white text-left shadow-sm transition hover:-translate-y-0.5 hover:border-slate-300 hover:shadow-md focus:outline-none focus:ring-2 focus:ring-blue-500 dark:border-white/10 dark:bg-[#10131c] dark:hover:border-white/20"
    >
      <div className="flex flex-1 flex-col p-5">
        <div className="mb-4 flex items-start justify-between gap-3">
          <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-blue-50 text-blue-600 dark:bg-blue-400/10 dark:text-blue-300">
            <FolderKanban className="h-4 w-4" />
          </div>
          <span className={`rounded-md border px-2 py-1 text-[11px] font-semibold ${getStatusStyle(project.status)}`}>
            {project.status || "Not set"}
          </span>
        </div>

        <h2 className="line-clamp-2 text-base font-semibold text-slate-950 transition group-hover:text-blue-700 dark:text-white dark:group-hover:text-blue-300">
          {project.projectName || "Untitled project"}
        </h2>
        <p className="mt-1 truncate text-sm text-slate-500 dark:text-slate-400">{getClientNames(project)}</p>

        {types.length > 0 && (
          <div className="mt-4 flex flex-wrap gap-1.5">
            {types.slice(0, 3).map((type) => (
              <span key={type} className="rounded-md bg-slate-100 px-2 py-1 text-[11px] font-medium text-slate-600 dark:bg-white/[0.05] dark:text-slate-300">
                {type}
              </span>
            ))}
          </div>
        )}

        <div className="mt-auto grid grid-cols-2 gap-3 pt-5 text-xs text-slate-500 dark:text-slate-400">
          <span className="inline-flex items-center gap-1.5"><CalendarDays className="h-3.5 w-3.5" />{formatDate(project.startDate)}</span>
          <span className="inline-flex items-center justify-end gap-1.5"><Users className="h-3.5 w-3.5" />{teamSize} {teamSize === 1 ? "member" : "members"}</span>
        </div>
      </div>

      <div className="flex items-center justify-between border-t border-slate-200 px-5 py-3 text-xs font-semibold text-slate-600 dark:border-white/10 dark:text-slate-300">
        <span>Open project</span>
        <ArrowRight className="h-4 w-4 transition-transform group-hover:translate-x-0.5" />
      </div>
    </button>
  );
};

const ProjectWorkspace = ({ project, activeTab, setActiveTab, onBack }) => {
  const currentUser = useMemo(
    () => JSON.parse(localStorage.getItem("user") || "{}"),
    []
  );
  const tabs = [
    { id: "overview", label: "Overview", icon: FolderKanban },
    { id: "tasks", label: "Tasks", icon: ClipboardList },
    { id: "messages", label: "Messages", icon: MessageSquare },
    { id: "report", label: "Report", icon: BarChart3 },
  ];

  return (
    <div className="space-y-4 sm:space-y-5">
      <header className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm dark:border-white/10 dark:bg-[#10131c]">
        <div className="flex flex-col gap-4 px-5 py-5 sm:flex-row sm:items-center sm:justify-between sm:px-6">
          <div className="flex min-w-0 items-start gap-3">
            <button
              type="button"
              onClick={onBack}
              className="mt-0.5 flex h-9 w-9 shrink-0 items-center justify-center rounded-xl border border-slate-200 text-slate-500 transition hover:bg-slate-50 hover:text-slate-900 dark:border-white/10 dark:text-slate-300 dark:hover:bg-white/[0.05] dark:hover:text-white"
              aria-label="Back to projects"
            >
              <ArrowLeft className="h-4 w-4" />
            </button>
            <div className="min-w-0">
              <div className="text-xs font-medium text-slate-500 dark:text-slate-400">{getClientNames(project)}</div>
              <h1 className="mt-1 truncate text-xl font-semibold text-slate-950 dark:text-white sm:text-2xl">{project.projectName}</h1>
            </div>
          </div>
          <span className={`w-fit rounded-md border px-2.5 py-1.5 text-xs font-semibold ${getStatusStyle(project.status)}`}>
            {project.status || "Not set"}
          </span>
        </div>

        <nav className="flex gap-1 overflow-x-auto border-t border-slate-200 px-3 py-2 dark:border-white/10 sm:px-5" aria-label="Project sections">
          {tabs.map(({ id, label, icon: Icon }) => (
            <button
              key={id}
              type="button"
              onClick={() => setActiveTab(id)}
              className={`inline-flex h-9 items-center gap-2 whitespace-nowrap rounded-lg px-3 text-sm font-medium transition ${
                activeTab === id
                  ? "bg-slate-900 text-white dark:bg-slate-100 dark:text-slate-900"
                  : "text-slate-500 hover:bg-slate-50 hover:text-slate-900 dark:text-slate-400 dark:hover:bg-white/[0.05] dark:hover:text-white"
              }`}
            >
              {React.createElement(Icon, { className: "h-4 w-4" })} {label}
            </button>
          ))}
        </nav>
      </header>

      {activeTab === "overview" && <ProjectOverview project={project} />}
      {activeTab === "tasks" && (
        <ProjectTasksSection projectId={project._id} />
      )}
      {activeTab === "messages" && (
        <div className="min-h-[620px] overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm dark:border-white/10 dark:bg-[#10131c]" style={{ height: "calc(100dvh - 220px)" }}>
          <ProjectMessagePanel projectId={project._id} currentUser={currentUser} />
        </div>
      )}
      {activeTab === "report" && (
        <div className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm dark:border-white/10 dark:bg-[#10131c]">
          <ProjectReportTab
            projectId={project._id}
            userRole="employee"
            userId={currentUser?._id}
          />
        </div>
      )}
    </div>
  );
};

const ProjectOverview = ({ project }) => {
  const progress = Math.max(0, Math.min(Number(project.progress) || 0, 100));
  const types = getProjectTypes(project);

  return (
    <div className="space-y-4">
      <section className="grid grid-cols-2 gap-px overflow-hidden rounded-2xl border border-slate-200 bg-slate-200 shadow-sm dark:border-white/10 dark:bg-white/10 lg:grid-cols-4">
        {[
          { label: "Start date", value: formatDate(project.startDate), icon: CalendarDays },
          { label: "End date", value: formatDate(project.endDate), icon: CalendarDays },
          { label: "Team", value: `${project.assignedTo?.length || 0} members`, icon: Users },
          { label: "Type", value: types.join(", ") || "Not set", icon: FileText },
        ].map(({ label, value, icon: Icon }) => (
          <div key={label} className="flex min-w-0 items-center gap-3 bg-white p-4 dark:bg-[#10131c]">
            <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-slate-100 text-slate-500 dark:bg-white/[0.05] dark:text-slate-300">{React.createElement(Icon, { className: "h-4 w-4" })}</div>
            <div className="min-w-0"><div className="text-xs text-slate-500 dark:text-slate-400">{label}</div><div className="mt-0.5 truncate text-sm font-semibold text-slate-900 dark:text-white">{value}</div></div>
          </div>
        ))}
      </section>

      <div className="grid gap-4 lg:grid-cols-[minmax(0,1.5fr)_minmax(280px,0.5fr)]">
        <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm dark:border-white/10 dark:bg-[#10131c]">
          <h2 className="text-base font-semibold text-slate-950 dark:text-white">Project brief</h2>
          <p className="mt-3 text-sm leading-6 text-slate-600 dark:text-slate-300">{project.description || "No project description has been added."}</p>

          {project.progress !== undefined && (
            <div className="mt-6 border-t border-slate-200 pt-5 dark:border-white/10">
              <div className="mb-2 flex items-center justify-between text-xs"><span className="font-medium text-slate-600 dark:text-slate-300">Overall progress</span><span className="text-slate-500 dark:text-slate-400">{progress}%</span></div>
              <div className="h-1.5 overflow-hidden rounded-full bg-slate-100 dark:bg-white/[0.07]"><div className="h-full rounded-full bg-blue-600" style={{ width: `${progress}%` }} /></div>
            </div>
          )}
        </section>

        <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm dark:border-white/10 dark:bg-[#10131c]">
          <h2 className="text-base font-semibold text-slate-950 dark:text-white">Project team</h2>
          <div className="mt-4 space-y-3">
            {(project.assignedTo || []).length > 0 ? (
              project.assignedTo.slice(0, 6).map((member, index) => (
                <div key={member._id || index} className="flex items-center gap-3">
                  <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-slate-900 text-xs font-semibold text-white dark:bg-slate-100 dark:text-slate-900">{String(member.name || member.email || "U").charAt(0).toUpperCase()}</div>
                  <div className="min-w-0"><div className="truncate text-sm font-medium text-slate-900 dark:text-white">{member.name || "Team member"}</div>{member.email && <div className="truncate text-xs text-slate-500 dark:text-slate-400">{member.email}</div>}</div>
                </div>
              ))
            ) : (
              <p className="text-sm text-slate-500 dark:text-slate-400">No team members assigned.</p>
            )}
          </div>
        </section>
      </div>
    </div>
  );
};

const EmptyState = ({ icon: Icon, title, description, actionLabel, onAction }) => (
  <section className="rounded-2xl border border-dashed border-slate-300 bg-white px-6 py-14 text-center dark:border-white/15 dark:bg-[#10131c]">
    <div className="mx-auto flex h-11 w-11 items-center justify-center rounded-xl bg-slate-100 text-slate-500 dark:bg-white/[0.05] dark:text-slate-300">{React.createElement(Icon, { className: "h-5 w-5" })}</div>
    <h2 className="mt-4 text-base font-semibold text-slate-950 dark:text-white">{title}</h2>
    <p className="mx-auto mt-1 max-w-md text-sm text-slate-500 dark:text-slate-400">{description}</p>
    {actionLabel && (
      <button type="button" onClick={onAction} className="mt-4 rounded-xl bg-blue-600 px-4 py-2 text-sm font-semibold text-white transition hover:bg-blue-700">{actionLabel}</button>
    )}
  </section>
);

const ProjectTasksSection = ({ projectId }) => {
  const [tasks, setTasks] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [updatingTaskId, setUpdatingTaskId] = useState(null);

  const fetchProjectTasks = useCallback(async () => {
    try {
      setLoading(true);
      setError("");
      const token = localStorage.getItem("token");
      const response = await fetch(`${API_BASE}/api/tasks`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (!response.ok) throw new Error("Unable to load project tasks");
      const payload = await response.json();
      const allTasks = Array.isArray(payload) ? payload : payload?.tasks || [];
      setTasks(
        allTasks.filter((task) =>
          String(task.project?._id || task.project || "") === String(projectId)
        )
      );
    } catch (fetchError) {
      console.error("Error fetching project tasks:", fetchError);
      setError(fetchError.message || "Unable to load project tasks");
    } finally {
      setLoading(false);
    }
  }, [projectId]);

  useEffect(() => {
    fetchProjectTasks();
  }, [fetchProjectTasks]);

  const handleStatusChange = async (taskId, newStatus) => {
    try {
      setUpdatingTaskId(taskId);
      const token = localStorage.getItem("token");
      const response = await fetch(`${API_BASE}/api/tasks/${taskId}/status`, {
        method: "PATCH",
        headers: {
          Authorization: `Bearer ${token}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ status: newStatus }),
      });
      if (!response.ok) {
        const payload = await response.json().catch(() => ({}));
        throw new Error(payload.message || "Status update failed");
      }
      await fetchProjectTasks();
    } catch (updateError) {
      console.error("Error updating task status:", updateError);
      setError(updateError.message || "Status update failed");
    } finally {
      setUpdatingTaskId(null);
    }
  };

  if (loading) return <PageLoaderCard label="Loading project tasks..." />;
  if (error && tasks.length === 0) {
    return <EmptyState icon={ClipboardList} title="Tasks could not be loaded" description={error} actionLabel="Try again" onAction={fetchProjectTasks} />;
  }
  if (tasks.length === 0) {
    return <EmptyState icon={ClipboardList} title="No project tasks" description="Tasks linked to this project will appear here." />;
  }

  return (
    <div className="space-y-3">
      {error && <div className="rounded-xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-700 dark:border-rose-400/20 dark:bg-rose-400/10 dark:text-rose-200">{error}</div>}
      {tasks.map((task) => {
        const status = String(task.status || "pending").toLowerCase();
        return (
          <article key={task._id} className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm dark:border-white/10 dark:bg-[#10131c]">
            <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
              <div className="min-w-0">
                <div className="flex flex-wrap items-center gap-2">
                  <h2 className="text-sm font-semibold text-slate-950 dark:text-white">{task.title}</h2>
                  <span className={`rounded-md border px-2 py-0.5 text-[11px] font-semibold ${getStatusStyle(task.status)}`}>{task.status || "Pending"}</span>
                  <span className={`rounded-md border px-2 py-0.5 text-[11px] font-semibold ${task.priority === "High" ? "border-rose-200 bg-rose-50 text-rose-700 dark:border-rose-400/20 dark:bg-rose-400/10 dark:text-rose-200" : task.priority === "Medium" ? "border-amber-200 bg-amber-50 text-amber-700 dark:border-amber-400/20 dark:bg-amber-400/10 dark:text-amber-200" : "border-slate-200 bg-slate-50 text-slate-600 dark:border-white/10 dark:bg-white/[0.04] dark:text-slate-300"}`}>{task.priority || "Normal"}</span>
                </div>
                {task.description && <p className="mt-2 text-sm leading-6 text-slate-600 dark:text-slate-300">{task.description}</p>}
                <p className="mt-2 text-xs text-slate-500 dark:text-slate-400">Due {task.dueDate ? formatDate(task.dueDate) : "date not set"}</p>
              </div>

              {status !== "completed" && (
                <label className="shrink-0 text-xs text-slate-500 dark:text-slate-400">
                  <span className="sr-only">Update task status</span>
                  <select
                    value={status === "rejected" ? "" : status}
                    onChange={(event) => event.target.value && handleStatusChange(task._id, event.target.value)}
                    disabled={updatingTaskId === task._id}
                    className="h-9 rounded-lg border border-slate-200 bg-white px-3 text-sm text-slate-700 outline-none focus:border-blue-500 dark:border-white/10 dark:bg-white/[0.04] dark:text-slate-200"
                  >
                    {status === "rejected" && <option value="" disabled>Move to...</option>}
                    <option value="pending">Pending</option>
                    <option value="in-progress">In progress</option>
                    <option value="completed">Completed</option>
                  </select>
                </label>
              )}
            </div>

            {status === "rejected" && (
              <div className="mt-4 rounded-xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-700 dark:border-rose-400/20 dark:bg-rose-400/10 dark:text-rose-200">
                <span className="font-semibold">Revision requested:</span> {task.rejectionReason || "No reason provided"}
              </div>
            )}
          </article>
        );
      })}
    </div>
  );
};

const PageLoaderCard = ({ label }) => (
  <div className="rounded-2xl border border-slate-200 bg-white py-16 text-center shadow-sm dark:border-white/10 dark:bg-[#10131c]">
    <div className="mx-auto h-8 w-8 animate-spin rounded-full border-2 border-blue-200 border-t-blue-600 dark:border-white/10 dark:border-t-blue-400" />
    <p className="mt-3 text-sm text-slate-500 dark:text-slate-400">{label}</p>
  </div>
);

export default EmployeePortal;
