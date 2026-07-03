// File: src/pages/UnifiedTaskPage.jsx
//
// Tab structure:
//   ALL roles        → My Tasks | Assigned by Me | Create Task
//   admin/super-admin additionally → All Tasks | Analytics
import React, { useState, useEffect, useCallback, useRef } from "react";
import dayjs from "dayjs";
import { useNavigate } from "react-router-dom";
import {
  FaSearch, FaSync, FaDownload, FaPlus, FaChartBar, FaTasks,
  FaTimes, FaFilter, FaUserAlt, FaListUl,
} from "react-icons/fa";

import Sidebar from "../components/dashboard/Sidebar";
import TaskForm from "../components/admintask/TaskForm";
import TaskTable from "../components/admintask/TaskTable";
import TaskList from "../components/task/TaskList";
import PaymentBlockOverlay from "../components/payment/PaymentBlockOverlay";
import usePaymentCheck from "../hooks/usePaymentCheck";
import API from "../api";
import taskApi from "../api/taskApi";

// ─────────────────────────────────────────────────────────────────────────────
// Helpers
// ─────────────────────────────────────────────────────────────────────────────
const getUser = () => { try { return JSON.parse(localStorage.getItem("user") || "{}"); } catch { return {}; } };
const normalizeRole = (r) => {
  if (!r) return "employee";
  const s = r.toLowerCase().replace(/\s+/g, "-");
  return s === "superadmin" ? "super-admin" : s;
};
const ADMIN_ROLES = ["admin", "super-admin"];
const isAdmin = (r) => ADMIN_ROLES.includes(normalizeRole(r));
const PAGE_SIZE = 10;

const INPUT_CLS = "rounded-xl border border-slate-200 bg-white text-slate-700 text-xs outline-none transition focus:border-blue-500 focus:ring-2 focus:ring-blue-500/15 cursor-pointer dark:border-white/10 dark:bg-white/[0.04] dark:text-slate-200";

// ─────────────────────────────────────────────────────────────────────────────
// Tab Bar (shared)
// ─────────────────────────────────────────────────────────────────────────────
const TabBar = ({ tabs, active, onChange }) => (
  <div role="tablist" aria-label="Task views" className="mb-5 flex w-fit max-w-full items-center gap-1 overflow-x-auto rounded-xl border border-slate-200 bg-white p-1 shadow-sm dark:border-white/10 dark:bg-[#12151c]">
    {tabs.map((t) => (
      <button key={t.id} type="button" role="tab" aria-selected={active === t.id} onClick={() => onChange(t.id)}
        className={`flex items-center gap-2 whitespace-nowrap rounded-lg border px-4 py-2.5 text-xs font-medium transition ${
          active === t.id
            ? "border-blue-600 bg-blue-600 text-white shadow-sm dark:border-blue-400/30 dark:bg-blue-500 dark:text-white"
            : "border-transparent text-slate-500 hover:border-slate-200 hover:bg-slate-100 hover:text-slate-800 dark:text-slate-400 dark:hover:border-white/10 dark:hover:bg-white/[0.06] dark:hover:text-slate-100"}`}>
        {t.icon}<span>{t.label}</span>
      </button>
    ))}
  </div>
);

// ─────────────────────────────────────────────────────────────────────────────
// Edit Task Modal
// ─────────────────────────────────────────────────────────────────────────────
const EditTaskModal = ({ task, onSave, onCancel, users }) => {
  const [edited, setEdited] = useState(task || {});
  const [assignedIds, setAssignedIds] = useState([]);
  const [dropOpen, setDropOpen] = useState(false);
  const [search, setSearch] = useState("");
  const [allUsers, setAllUsers] = useState(users || []);
  const ref = useRef(null);

  useEffect(() => {
    setEdited(task ? { ...task } : {});
    const a = Array.isArray(task?.assignedTo) ? task.assignedTo : task?.assignedTo ? [task.assignedTo] : [];
    setAssignedIds(a.map((u) => (typeof u === "object" ? u._id : u)));
  }, [task]);

  useEffect(() => {
    if (!users || !users.length)
      API.get("/api/users/assignable").then((r) => setAllUsers(Array.isArray(r.data) ? r.data : [])).catch(() => {});
  }, [users]);

  useEffect(() => {
    const h = (e) => { if (ref.current && !ref.current.contains(e.target)) setDropOpen(false); };
    document.addEventListener("mousedown", h);
    return () => document.removeEventListener("mousedown", h);
  }, []);

  const toggle = (id) => setAssignedIds((p) => p.includes(id) ? p.filter((x) => x !== id) : [...p, id]);
  const set = (f, v) => setEdited((p) => ({ ...p, [f]: v }));
  const submit = (e) => {
    e.preventDefault();
    if (!edited.title?.trim() || !assignedIds.length) return;
    onSave({ _id: edited._id, title: edited.title, description: edited.description || "",
      assignedTo: assignedIds, dueDate: edited.dueDate || null, priority: edited.priority, status: edited.status });
  };
  const names = allUsers.filter((u) => assignedIds.includes(u._id)).map((u) => u.name);
  const filtered = allUsers.filter((u) => u.name.toLowerCase().includes(search.toLowerCase()));
  const dv = edited?.dueDate
    ? (typeof edited.dueDate === "string" ? edited.dueDate.slice(0, 10) : dayjs(edited.dueDate).format("YYYY-MM-DD"))
    : "";

  return (
    <div className="fixed inset-0 flex items-center justify-center z-50 bg-black/70 backdrop-blur-sm">
      <form onSubmit={submit}
        className="bg-[#141c2e] border border-[rgba(84,123,209,0.25)] rounded-2xl p-7 w-full max-w-2xl mx-4 shadow-2xl text-white space-y-5 max-h-[90vh] overflow-y-auto">
        <div className="flex items-center justify-between">
          <h2 className="text-lg font-bold text-orange-400">Edit Task</h2>
          <button type="button" onClick={onCancel} className="p-2 hover:bg-red-500/15 rounded-xl text-gray-400 hover:text-red-400 transition"><FaTimes size={14} /></button>
        </div>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div>
            <label className="block text-xs font-medium mb-1.5 text-gray-400">Title</label>
            <input type="text" value={edited.title || ""} onChange={(e) => set("title", e.target.value)} required
              className="bg-[#0d1220] border border-[rgba(84,123,209,0.25)] rounded-xl p-3 w-full text-white text-sm outline-none" />
          </div>
          <div className="relative" ref={ref}>
            <label className="block text-xs font-medium mb-1.5 text-gray-400">Assign To</label>
            <div onClick={() => setDropOpen((p) => !p)}
              className="bg-[#0d1220] border border-[rgba(84,123,209,0.25)] rounded-xl p-3 w-full text-sm text-white cursor-pointer min-h-[46px] truncate">
              {names.length ? names.join(", ") : <span className="text-gray-500">Select people…</span>}
            </div>
            {dropOpen && (
              <div className="absolute left-0 top-full mt-1 bg-[#141c2e] border border-[rgba(84,123,209,0.25)] rounded-xl shadow-2xl w-full z-50 max-h-52 overflow-y-auto">
                <div className="p-2 border-b border-[rgba(84,123,209,0.15)]">
                  <input type="text" placeholder="Search…" value={search} onChange={(e) => setSearch(e.target.value)}
                    className="bg-[#0d1220] border border-[rgba(84,123,209,0.2)] rounded-lg p-2 w-full text-white text-sm outline-none" />
                </div>
                {filtered.map((u) => (
                  <label key={u._id} className="flex items-center gap-2 px-3 py-2 hover:bg-orange-500/8 cursor-pointer text-sm">
                    <input type="checkbox" checked={assignedIds.includes(u._id)} onChange={() => toggle(u._id)} className="accent-orange-400" />
                    <span className="text-white">{u.name}</span>
                    <span className="text-gray-500 text-xs ml-auto capitalize">{u.role}</span>
                  </label>
                ))}
              </div>
            )}
          </div>
          <div>
            <label className="block text-xs font-medium mb-1.5 text-gray-400">Due Date</label>
            <input type="date" value={dv} onChange={(e) => set("dueDate", e.target.value)} required
              className="bg-[#0d1220] border border-[rgba(84,123,209,0.25)] rounded-xl p-3 w-full text-white text-sm outline-none" />
          </div>
          <div>
            <label className="block text-xs font-medium mb-1.5 text-gray-400">Priority</label>
            <select value={edited.priority || ""} onChange={(e) => set("priority", e.target.value)} required
              className="bg-[#0d1220] border border-[rgba(84,123,209,0.25)] rounded-xl p-3 w-full text-white text-sm outline-none cursor-pointer">
              <option value="">Select</option>
              <option value="Low">Low</option>
              <option value="Medium">Medium</option>
              <option value="High">High</option>
            </select>
          </div>
        </div>
        <div>
          <label className="block text-xs font-medium mb-1.5 text-gray-400">Description</label>
          <textarea value={edited.description || ""} onChange={(e) => set("description", e.target.value)} rows={3}
            className="bg-[#0d1220] border border-[rgba(84,123,209,0.25)] rounded-xl p-3 w-full text-white text-sm resize-none outline-none" />
        </div>
        <div>
          <label className="block text-xs font-medium mb-1.5 text-gray-400">Status</label>
          <select value={edited.status || "pending"} onChange={(e) => set("status", e.target.value)} required
            className="bg-[#0d1220] border border-[rgba(84,123,209,0.25)] rounded-xl p-3 w-full text-white text-sm outline-none cursor-pointer">
            <option value="pending">Pending</option>
            <option value="in-progress">In Progress</option>
            <option value="completed">Completed</option>
            {edited.status === "rejected" && <option value="rejected">Rejected</option>}
          </select>
        </div>
        <div className="flex justify-end gap-3">
          <button type="button" onClick={onCancel} className="px-5 py-2 bg-gray-700 hover:bg-gray-600 rounded-xl text-sm font-medium transition">Cancel</button>
          <button type="submit" className="px-5 py-2 bg-orange-500 hover:bg-orange-600 rounded-xl text-sm font-medium transition">Save Changes</button>
        </div>
      </form>
    </div>
  );
};

// ─────────────────────────────────────────────────────────────────────────────
// Analytics Panel (admin only)
// ─────────────────────────────────────────────────────────────────────────────
const AnalyticsPanel = ({ users }) => {
  const [searchTerm, setSearchTerm] = useState("");
  const [showDrop, setShowDrop] = useState(false);
  const [selected, setSelected] = useState(null);
  const [analytics, setAnalytics] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const dropRef = useRef(null);

  useEffect(() => {
    const h = (e) => { if (dropRef.current && !dropRef.current.contains(e.target)) setShowDrop(false); };
    document.addEventListener("mousedown", h);
    return () => document.removeEventListener("mousedown", h);
  }, []);

  const select = async (u) => {
    setSelected(u); setSearchTerm(u.name); setShowDrop(false);
    setLoading(true); setError("");
    try {
      const r = await API.get(`/api/tasks/analytics/employee/${u._id}`);
      setAnalytics(r.data);
    } catch { setError("Failed to fetch analytics."); setAnalytics(null); }
    finally { setLoading(false); }
  };

  const clear = () => { setSelected(null); setSearchTerm(""); setAnalytics(null); setError(""); };
  const filtered = users.filter((u) => u.name.toLowerCase().includes(searchTerm.toLowerCase()));
  const sc = (s) => ({ completed: "text-green-400 bg-green-400/10 border-green-500/30",
    "in-progress": "text-blue-400 bg-blue-400/10 border-blue-500/30",
    pending: "text-yellow-400 bg-yellow-400/10 border-yellow-500/30",
    rejected: "text-red-400 bg-red-400/10 border-red-500/30" }[s] || "text-gray-400") + " border rounded px-2 py-0.5 text-xs font-medium";

  return (
    <div className="space-y-5">
      <div className="flex flex-col sm:flex-row gap-4 items-start sm:items-center">
        <label className="text-sm font-medium text-gray-400 whitespace-nowrap">Employee:</label>
        <div className="relative flex-1 max-w-md" ref={dropRef}>
          <input value={searchTerm} onFocus={() => setShowDrop(true)}
            onChange={(e) => { setSearchTerm(e.target.value); setShowDrop(true); if (!e.target.value.trim()) clear(); }}
            placeholder="Search by name…"
            className="bg-[#0d1220] border border-[rgba(84,123,209,0.25)] rounded-xl p-3 w-full text-white text-sm outline-none pr-9" />
          {selected && <button onClick={clear} className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-red-400"><FaTimes size={12} /></button>}
          {showDrop && searchTerm && filtered.length > 0 && (
            <div className="absolute top-full left-0 right-0 mt-1 bg-[#141c2e] border border-[rgba(84,123,209,0.2)] rounded-xl shadow-2xl max-h-48 overflow-y-auto z-50">
              {filtered.map((u) => (
                <div key={u._id} onMouseDown={(e) => { e.preventDefault(); select(u); }}
                  className="px-3 py-2.5 hover:bg-orange-500/8 cursor-pointer border-b border-[rgba(84,123,209,0.06)] last:border-b-0">
                  <p className="text-white text-sm font-medium">{u.name}</p>
                  <p className="text-gray-400 text-xs">{u.email}</p>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      {loading && <div className="flex gap-3 py-10 justify-center items-center">
        <div className="w-5 h-5 border-2 border-orange-500 border-t-transparent rounded-full animate-spin" />
        <span className="text-gray-400 text-sm">Loading…</span>
      </div>}
      {error && <div className="bg-red-500/10 border border-red-500/30 rounded-xl p-4 text-red-400 text-sm">{error}</div>}

      {analytics && !loading && (
        <div className="space-y-5">
          <div className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-8 gap-3">
            {[
              { label: "Total", value: analytics.summary.totalTasks, c: "text-blue-400" },
              { label: "Done", value: analytics.summary.completedTasks, c: "text-green-400" },
              { label: "Active", value: analytics.summary.inProgressTasks, c: "text-cyan-400" },
              { label: "Pending", value: analytics.summary.pendingTasks, c: "text-yellow-400" },
              { label: "Overdue", value: analytics.summary.overdueTasks, c: "text-red-400" },
              { label: "Rate", value: `${analytics.summary.completionRate}%`, c: "text-orange-400" },
              { label: "High", value: analytics.summary.highPriorityTasks, c: "text-red-300" },
              { label: "Medium", value: analytics.summary.mediumPriorityTasks, c: "text-yellow-300" },
            ].map((item) => (
              <div key={item.label} className="bg-[#0d1220] border border-[rgba(84,123,209,0.12)] rounded-xl p-3 text-center">
                <p className={`text-xl font-bold ${item.c}`}>{item.value}</p>
                <p className="text-xs text-gray-500 mt-0.5">{item.label}</p>
              </div>
            ))}
          </div>
          {analytics.recentTasks?.length > 0 && (
            <div className="bg-[#0d1220] border border-[rgba(84,123,209,0.12)] rounded-xl overflow-hidden">
              <div className="px-4 py-3 border-b border-[rgba(84,123,209,0.1)]">
                <h3 className="text-sm font-semibold text-orange-400">Recent Tasks</h3>
              </div>
              <div className="divide-y divide-[rgba(84,123,209,0.06)]">
                {analytics.recentTasks.slice(0, 8).map((t) => (
                  <div key={t._id} className="px-4 py-3 flex items-center gap-3 hover:bg-[rgba(84,123,209,0.04)]">
                    <span className="text-white text-sm truncate flex-1">{t.title}</span>
                    <span className={sc(t.status)}>{t.status}</span>
                    <span className="text-gray-400 text-xs hidden sm:block">{t.dueDate ? dayjs(t.dueDate).format("MMM D") : "—"}</span>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      )}

      {!selected && !loading && (
        <div className="flex flex-col items-center justify-center py-14 text-center">
          <div className="w-14 h-14 bg-[rgba(84,123,209,0.06)] rounded-2xl flex items-center justify-center mb-3">
            <FaChartBar className="text-gray-500" size={20} />
          </div>
          <p className="text-gray-400 text-sm">Search for an employee to view their analytics</p>
        </div>
      )}
    </div>
  );
};

// ─────────────────────────────────────────────────────────────────────────────
// Admin – All Tasks panel (with full filter bar + TaskTable)
// ─────────────────────────────────────────────────────────────────────────────
const AllTasksPanel = ({ users, onEditTask, onRefreshStats }) => {
  const [tasks, setTasks] = useState([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [loading, setLoading] = useState(false);
  const [showFilters, setShowFilters] = useState(false);
  const [filters, setFilters] = useState({ search: "", status: "all", priority: "all", assignee: "all", dateFrom: "", dateTo: "" });
  const [debounced, setDebounced] = useState(filters);
  const navigate = useNavigate();

  useEffect(() => { const t = setTimeout(() => setDebounced(filters), 400); return () => clearTimeout(t); }, [filters]);
  useEffect(() => { setPage(1); }, [debounced]);

  const fetchTasks = useCallback(async (pg = 1) => {
    const token = localStorage.getItem("token");
    if (!token) return navigate("/login", { replace: true });
    setLoading(true);
    try {
      const params = { page: pg, limit: PAGE_SIZE };
      if (debounced.search) params.search = debounced.search;
      if (debounced.status !== "all") params.status = debounced.status;
      if (debounced.priority !== "all") params.priority = debounced.priority;

      const r = await API.get("/api/tasks", { params, headers: { Authorization: `Bearer ${token}` } });
      let list = r.data?.tasks || [];

      // Client-side filters not supported as backend query params
      if (debounced.assignee !== "all") {
        list = list.filter((t) =>
          Array.isArray(t.assignedTo)
            ? t.assignedTo.some((u) => (u._id || u) === debounced.assignee)
            : (t.assignedTo?._id || t.assignedTo) === debounced.assignee
        );
      }
      if (debounced.dateFrom) list = list.filter((t) => t.dueDate && dayjs(t.dueDate).isAfter(dayjs(debounced.dateFrom).startOf("day")));
      if (debounced.dateTo) list = list.filter((t) => t.dueDate && dayjs(t.dueDate).isBefore(dayjs(debounced.dateTo).endOf("day")));

      setTasks(list);
      setTotal(r.data?.total || 0);
      setPage(r.data?.page || 1);
      setTotalPages(r.data?.totalPages || 1);
    } catch { console.error("Failed to fetch tasks"); }
    finally { setLoading(false); }
  }, [debounced, navigate]);

  useEffect(() => { fetchTasks(page); }, [page, debounced, fetchTasks]);

  const handleDelete = async (id) => {
    if (!window.confirm("Delete this task?")) return;
    try { await taskApi.deleteTask(id); fetchTasks(page); onRefreshStats?.(); } catch (error) { console.error("Failed to delete task:", error); }
  };

  const clearFilters = () => setFilters({ search: "", status: "all", priority: "all", assignee: "all", dateFrom: "", dateTo: "" });

  const exportCSV = () => {
    if (!tasks.length) return;
    const rows = [["Title", "Status", "Priority", "Due Date", "Assigned To", "Assigned By"],
      ...tasks.map((t) => [t.title, t.status, t.priority,
        t.dueDate ? dayjs(t.dueDate).format("YYYY-MM-DD") : "—",
        Array.isArray(t.assignedTo) ? t.assignedTo.map((u) => u.name || u).join("; ") : "—",
        t.assignedBy?.name || "—"])];
    const csv = rows.map((r) => r.map((c) => `"${String(c).replace(/"/g, '""')}"`).join(",")).join("\n");
    const a = document.createElement("a");
    a.href = URL.createObjectURL(new Blob([csv], { type: "text/csv" }));
    a.download = `all-tasks-${dayjs().format("YYYY-MM-DD")}.csv`;
    a.click();
  };

  const hasFilter = filters.status !== "all" || filters.priority !== "all" || filters.assignee !== "all" || filters.dateFrom || filters.dateTo || filters.search;

  return (
    <div className="space-y-4">
      {/* Filter bar */}
      <div className="bg-[#0d1220] border border-[rgba(84,123,209,0.12)] rounded-xl p-4 space-y-3">
        <div className="flex flex-col sm:flex-row gap-2 items-start sm:items-center justify-between">
          <div className="relative flex-1 max-w-sm">
            <FaSearch className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-500" size={11} />
            <input type="text" placeholder="Search tasks…" value={filters.search}
              onChange={(e) => setFilters((p) => ({ ...p, search: e.target.value }))}
              className={`${INPUT_CLS} pl-8 pr-3 py-2 w-full`} />
          </div>
          <div className="flex items-center gap-2 flex-shrink-0">
            <button onClick={() => setShowFilters((p) => !p)}
              className={`flex items-center gap-1.5 px-3 py-2 rounded-xl text-xs font-medium border transition ${
                showFilters || hasFilter
                  ? "bg-cyan-500/15 border-cyan-500/30 text-cyan-400"
                  : `${INPUT_CLS} hover:border-cyan-500/40`}`}>
              <FaFilter size={10} /> Filters {hasFilter && <span className="w-1.5 h-1.5 bg-orange-400 rounded-full" />}
            </button>
            {hasFilter && (
              <button onClick={clearFilters} className="px-3 py-2 rounded-xl text-xs font-medium bg-red-500/10 border border-red-500/25 text-red-400 hover:bg-red-500/20 transition">Clear</button>
            )}
            <button onClick={() => fetchTasks(1)} disabled={loading} className={`p-2 ${INPUT_CLS} hover:border-cyan-500/40 transition`}>
              <FaSync className={loading ? "animate-spin" : ""} size={11} />
            </button>
            <button onClick={exportCSV} className={`p-2 ${INPUT_CLS} hover:border-green-500/40 transition`}>
              <FaDownload size={11} />
            </button>
          </div>
        </div>

        {showFilters && (
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-2 pt-2 border-t border-[rgba(84,123,209,0.1)]">
            {[
              { label: "Status", key: "status", options: [["all", "All Status"], ["pending", "Pending"], ["in-progress", "In Progress"], ["completed", "Completed"], ["rejected", "Rejected"]] },
              { label: "Priority", key: "priority", options: [["all", "All Priority"], ["High", "High"], ["Medium", "Medium"], ["Low", "Low"]] },
            ].map(({ label, key, options }) => (
              <div key={key}>
                <label className="block text-xs text-gray-500 mb-1">{label}</label>
                <select value={filters[key]} onChange={(e) => setFilters((p) => ({ ...p, [key]: e.target.value }))}
                  className={`${INPUT_CLS} px-2 py-2 w-full`}>
                  {options.map(([v, l]) => <option key={v} value={v}>{l}</option>)}
                </select>
              </div>
            ))}
            <div>
              <label className="block text-xs text-gray-500 mb-1">Assignee</label>
              <select value={filters.assignee} onChange={(e) => setFilters((p) => ({ ...p, assignee: e.target.value }))}
                className={`${INPUT_CLS} px-2 py-2 w-full`}>
                <option value="all">All</option>
                {users.map((u) => <option key={u._id} value={u._id}>{u.name}</option>)}
              </select>
            </div>
            <div>
              <label className="block text-xs text-gray-500 mb-1">From</label>
              <input type="date" value={filters.dateFrom} onChange={(e) => setFilters((p) => ({ ...p, dateFrom: e.target.value }))}
                className={`${INPUT_CLS} px-2 py-2 w-full`} />
            </div>
            <div>
              <label className="block text-xs text-gray-500 mb-1">To</label>
              <input type="date" value={filters.dateTo} onChange={(e) => setFilters((p) => ({ ...p, dateTo: e.target.value }))}
                className={`${INPUT_CLS} px-2 py-2 w-full`} />
            </div>
          </div>
        )}

        {/* Active chips */}
        {hasFilter && (
          <div className="flex flex-wrap gap-1.5 pt-1">
            {filters.status !== "all" && <Chip label={`Status: ${filters.status}`} onRemove={() => setFilters((p) => ({ ...p, status: "all" }))} color="cyan" />}
            {filters.priority !== "all" && <Chip label={`Priority: ${filters.priority}`} onRemove={() => setFilters((p) => ({ ...p, priority: "all" }))} color="orange" />}
            {filters.assignee !== "all" && <Chip label={`Assignee: ${users.find((u) => u._id === filters.assignee)?.name || "?"}`} onRemove={() => setFilters((p) => ({ ...p, assignee: "all" }))} color="purple" />}
            {filters.dateFrom && <Chip label={`From: ${filters.dateFrom}`} onRemove={() => setFilters((p) => ({ ...p, dateFrom: "" }))} color="green" />}
            {filters.dateTo && <Chip label={`To: ${filters.dateTo}`} onRemove={() => setFilters((p) => ({ ...p, dateTo: "" }))} color="green" />}
          </div>
        )}
        <p className="text-gray-600 text-xs">{total} task{total !== 1 ? "s" : ""} found</p>
      </div>

      <TaskTable
        tasks={tasks} total={total} page={page} totalPages={totalPages} limit={PAGE_SIZE}
        onPageChange={setPage}
        onEditTask={onEditTask}
        onDeleteTask={handleDelete}
        onRejectTask={() => { fetchTasks(page); onRefreshStats?.(); }}
        loading={loading}
      />
    </div>
  );
};

// Small chip helper
const Chip = ({ label, onRemove, color }) => (
  <span className={`flex items-center gap-1 px-2 py-0.5 bg-${color}-500/10 border border-${color}-500/25 rounded-full text-xs text-${color}-400`}>
    {label}
    <button onClick={onRemove}><FaTimes size={8} /></button>
  </span>
);

// ─────────────────────────────────────────────────────────────────────────────
// Shared – per-scope task list panel (My Tasks / Assigned by Me)
// ─────────────────────────────────────────────────────────────────────────────
const ScopedTaskPanel = ({ scope, onTaskCreated }) => {
  const [tasks, setTasks] = useState([]);
  const [loading, setLoading] = useState(false);
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [totalTasks, setTotalTasks] = useState(0);
  const [filters, setFilters] = useState({ status: "all", priority: "all", search: "" });
  const [debounced, setDebounced] = useState(filters);

  useEffect(() => { const t = setTimeout(() => setDebounced(filters), 400); return () => clearTimeout(t); }, [filters]);
  useEffect(() => { setPage(1); }, [debounced]);

  const fetchTasks = useCallback(async (pg = 1) => {
    setLoading(true);
    try {
      const params = { scope, page: pg, limit: PAGE_SIZE };
      if (debounced.status !== "all") params.status = debounced.status;
      if (debounced.priority !== "all") params.priority = debounced.priority;
      if (debounced.search) params.search = debounced.search;
      const data = await taskApi.getTasks(params);
      const list = data?.tasks || (Array.isArray(data) ? data : []);
      setTasks(list);
      setTotalTasks(data?.total ?? list.length);
      setPage(data?.page ?? pg);
      setTotalPages(data?.totalPages ?? 1);
    } catch (err) { console.error("ScopedTaskPanel fetch error:", err); }
    finally { setLoading(false); }
  }, [scope, debounced]);

  useEffect(() => { fetchTasks(page); }, [page, fetchTasks]);

  // Expose refresh callback for parent (after create)
  useEffect(() => { if (onTaskCreated) onTaskCreated.current = () => fetchTasks(1); }, [fetchTasks, onTaskCreated]);

  const handleStatusChange = useCallback(async (taskId, newStatus) => {
    try {
      const updated = await taskApi.updateStatus(taskId, newStatus);
      setTasks((p) => p.map((t) => (t._id === updated._id ? updated : t)));
    } catch (err) { alert(err.response?.data?.message || "Failed to update status."); }
  }, []);

  const handleTaskUpdated = useCallback((updated) => {
    setTasks((p) => p.map((t) => (t._id === updated._id ? updated : t)));
  }, []);

  const exportCSV = () => {
    if (!tasks.length) return;
    const rows = [["Title", "Status", "Priority", "Due Date", "Assigned By", "Assigned To"],
      ...tasks.map((t) => [t.title, t.status, t.priority,
        t.dueDate ? dayjs(t.dueDate).format("YYYY-MM-DD") : "—",
        t.assignedBy?.name || "—",
        Array.isArray(t.assignedTo) ? t.assignedTo.map((u) => u.name || u).join("; ") : "—"])];
    const csv = rows.map((r) => r.map((c) => `"${String(c).replace(/"/g, '""')}"`).join(",")).join("\n");
    const a = document.createElement("a"); a.href = URL.createObjectURL(new Blob([csv], { type: "text/csv" }));
    a.download = `tasks-${scope}-${dayjs().format("YYYY-MM-DD")}.csv`; a.click();
  };

  const clearFilters = () => setFilters({ status: "all", priority: "all", search: "" });
  const hasFilter = filters.status !== "all" || filters.priority !== "all" || !!filters.search;

  const toggleStatusPill = (status) => {
    setFilters((current) => ({
      ...current,
      status:
        current.status === status && current.priority === "all"
          ? "all"
          : status,
      priority: "all",
    }));
  };

  const toggleHighPill = () => {
    setFilters((current) => ({
      ...current,
      status: "all",
      priority:
        current.priority === "High" && current.status === "all"
          ? "all"
          : "High",
    }));
  };

  const quickPills = [
    { label: "All", active: !hasFilter, onClick: clearFilters },
    { label: "Pending", active: filters.status === "pending" && filters.priority === "all", onClick: () => toggleStatusPill("pending") },
    { label: "In Progress", active: filters.status === "in-progress" && filters.priority === "all", onClick: () => toggleStatusPill("in-progress") },
    { label: "High", active: filters.priority === "High" && filters.status === "all", onClick: toggleHighPill },
    { label: "Completed", active: filters.status === "completed" && filters.priority === "all", onClick: () => toggleStatusPill("completed") },
  ];

  // Mini stat counts (from current page only — good enough for a quick summary)
  const counts = {
    pending: tasks.filter((t) => t.status === "pending").length,
    inProgress: tasks.filter((t) => t.status === "in-progress").length,
    completed: tasks.filter((t) => t.status === "completed").length,
    rejected: tasks.filter((t) => t.status === "rejected").length,
  };

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-2 overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm dark:border-white/10 dark:bg-[#12151c] sm:grid-cols-4">
        {[
          { label: "Total", value: totalTasks, c: "text-slate-900 dark:text-slate-100" },
          { label: "Pending", value: counts.pending, c: "text-amber-600 dark:text-amber-300" },
          { label: "In progress", value: counts.inProgress, c: "text-blue-600 dark:text-blue-300" },
          { label: "Completed", value: counts.completed, c: "text-emerald-600 dark:text-emerald-300" },
        ].map((s) => (
          <div key={s.label} className="border-b border-r border-slate-100 px-4 py-3 last:border-r-0 dark:border-white/[0.07] sm:border-b-0">
            <p className="text-[11px] font-medium uppercase tracking-wide text-slate-500 dark:text-slate-400">{s.label}</p>
            <p className={`mt-1 text-xl font-semibold ${s.c}`}>{s.value}</p>
          </div>
        ))}
      </div>

      <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm dark:border-white/10 dark:bg-[#12151c]">
        <div className="flex flex-col items-start justify-between gap-3 lg:flex-row lg:items-center">
          <div className="relative w-full flex-1 lg:max-w-sm">
            <FaSearch className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" size={11} />
            <input type="text" placeholder="Search tasks..." value={filters.search}
              onChange={(e) => setFilters({ ...filters, search: e.target.value })}
              className="w-full rounded-xl border border-slate-200 bg-slate-50 py-2.5 pl-9 pr-3 text-sm text-slate-800 outline-none transition placeholder:text-slate-400 focus:border-blue-500 focus:bg-white focus:ring-2 focus:ring-blue-500/15 dark:border-white/10 dark:bg-white/[0.035] dark:text-slate-100 dark:focus:bg-white/[0.05]" />
          </div>
          <div className="flex items-center gap-2 flex-wrap">
            <select value={filters.status} onChange={(e) => setFilters({ ...filters, status: e.target.value })}
              className={`${INPUT_CLS} px-3 py-2`}>
              <option value="all">All Status</option>
              <option value="pending">Pending</option>
              <option value="in-progress">In Progress</option>
              <option value="completed">Completed</option>
              <option value="rejected">Rejected</option>
            </select>
            <select value={filters.priority} onChange={(e) => setFilters({ ...filters, priority: e.target.value })}
              className={`${INPUT_CLS} px-3 py-2`}>
              <option value="all">All Priority</option>
              <option value="High">High</option>
              <option value="Medium">Medium</option>
              <option value="Low">Low</option>
            </select>
            {hasFilter && (
              <button onClick={clearFilters} className="rounded-xl px-3 py-2 text-xs font-medium text-rose-600 transition hover:bg-rose-50 dark:text-rose-300 dark:hover:bg-rose-500/10">Clear</button>
            )}
            <button aria-label="Refresh tasks" onClick={() => fetchTasks(page)} disabled={loading} className={`p-2.5 ${INPUT_CLS}`}>
              <FaSync className={loading ? "animate-spin" : ""} size={11} />
            </button>
            <button aria-label="Export tasks" onClick={exportCSV} className={`p-2.5 ${INPUT_CLS}`}>
              <FaDownload size={11} />
            </button>
          </div>
        </div>

        <div className="mt-3 flex flex-wrap gap-1.5 border-t border-slate-100 pt-3 dark:border-white/[0.07]">
          {quickPills.map((qp) => (
            <button key={qp.label} type="button" aria-pressed={qp.active} onClick={qp.onClick}
              className={`rounded-full border px-3 py-1.5 text-xs font-medium transition ${
                qp.active
                  ? "border-blue-600 bg-blue-600 text-white shadow-sm dark:border-blue-400 dark:bg-blue-500 dark:text-white"
                  : "border-slate-200 bg-white text-slate-500 hover:border-slate-300 hover:text-slate-800 dark:border-white/10 dark:bg-white/[0.03] dark:text-slate-400 dark:hover:border-white/20 dark:hover:text-slate-100"}`}>
              {qp.label}
            </button>
          ))}
        </div>

      </div>

      <TaskList tasks={tasks} onStatusChange={handleStatusChange} onTaskUpdated={handleTaskUpdated} loading={loading} viewMode="list" />

      {totalPages > 1 && (
        <div className="flex items-center justify-between border-t border-slate-200 pt-3 dark:border-white/10">
          <p className="text-xs text-slate-500 dark:text-slate-400">Page {page} of {totalPages} · {totalTasks} total</p>
          <div className="flex gap-1">
            <button disabled={page === 1} onClick={() => setPage((p) => p - 1)}
              className={`px-3 py-2 ${INPUT_CLS} disabled:cursor-not-allowed disabled:opacity-40`}>Previous</button>
            <button disabled={page === totalPages} onClick={() => setPage((p) => p + 1)}
              className={`px-3 py-2 ${INPUT_CLS} disabled:cursor-not-allowed disabled:opacity-40`}>Next</button>
          </div>
        </div>
      )}
    </div>
  );
};

// ─────────────────────────────────────────────────────────────────────────────
// Create Task Panel
// ─────────────────────────────────────────────────────────────────────────────
const CreateTaskPanel = ({ users = [], onCreated }) => {
  const handleCreate = async (task) => {
    try {
      const payload = { ...task, assignedTo: Array.isArray(task.assignedTo) ? task.assignedTo : task.assignedTo ? [task.assignedTo] : [] };
      const createdTask = await taskApi.createTask(payload);
      onCreated?.(createdTask);
      return createdTask;
    } catch (err) {
      console.error("Failed to create task:", err);
      throw err;
    }
  };

  return (
    <div className="grid max-w-6xl items-start gap-4 xl:grid-cols-[minmax(0,1fr)_300px]">
      <section className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm dark:border-white/10 dark:bg-[#12151c]">
        <div className="border-b border-slate-100 px-5 py-4 dark:border-white/[0.07]">
          <p className="text-xs font-semibold uppercase tracking-wider text-blue-600 dark:text-blue-300">New assignment</p>
          <h2 className="mt-1 text-lg font-semibold text-slate-950 dark:text-white">Create a task</h2>
          <p className="mt-1 max-w-2xl text-sm text-slate-500 dark:text-slate-400">
            Define the outcome, choose the right assignees, and set a realistic deadline.
          </p>
        </div>
        <div className="p-4 sm:p-5">
          <TaskForm onCreate={handleCreate} users={users} />
        </div>
      </section>

      <aside className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm dark:border-white/10 dark:bg-[#12151c] xl:sticky xl:top-5">
        <h3 className="text-sm font-semibold text-slate-950 dark:text-white">Before you assign</h3>
        <p className="mt-1 text-xs leading-5 text-slate-500 dark:text-slate-400">
          A useful task gives the assignees enough context to act without another meeting.
        </p>
        <ol className="mt-4 space-y-4">
          {[
            ["01", "Name the outcome", "Use a specific, action-led title."],
            ["02", "Add the context", "Include links, constraints, or acceptance criteria."],
            ["03", "Choose assignees", "Select the people responsible for delivery."],
            ["04", "Set the deadline", "Use priority to signal urgency, not importance alone."],
          ].map(([number, title, description]) => (
            <li key={number} className="flex gap-3">
              <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-lg border border-blue-200 bg-blue-50 text-[10px] font-bold text-blue-700 dark:border-blue-400/20 dark:bg-blue-400/10 dark:text-blue-200">
                {number}
              </span>
              <span>
                <span className="block text-xs font-semibold text-slate-800 dark:text-slate-200">{title}</span>
                <span className="mt-0.5 block text-[11px] leading-4 text-slate-500 dark:text-slate-400">{description}</span>
              </span>
            </li>
          ))}
        </ol>
        <div className="mt-5 rounded-xl border border-amber-200 bg-amber-50 p-3 text-xs leading-5 text-amber-800 dark:border-amber-400/20 dark:bg-amber-400/10 dark:text-amber-200">
          Selecting a project limits the assignee list to active members of that project.
        </div>
      </aside>
    </div>
  );
};

// ─────────────────────────────────────────────────────────────────────────────
// Main Page
// ─────────────────────────────────────────────────────────────────────────────
export default function UnifiedTaskPage({ onLogout }) {
  const user = getUser();
  const role = normalizeRole(user.role);
  const adminUser = isAdmin(role);

  const [collapsed, setCollapsed] = useState(false);
  const [activeTab, setActiveTab] = useState("mine");
  const [users, setUsers] = useState([]);
  const [editingTask, setEditingTask] = useState(null);
  const [popupMsg, setPopupMsg] = useState("");
  const [currentTime, setCurrentTime] = useState(new Date());
  const [statCounts, setStatCounts] = useState({ total: 0, assignedByMe: 0, dueToday: 0, overdue: 0, completed: 0, rejected: 0 });
  const refreshMineRef = useRef(null);
  const refreshAssignedRef = useRef(null);
  const { activePayment, checkingPayment, clearPayment } = usePaymentCheck();

  const showPopup = (msg) => { setPopupMsg(msg); setTimeout(() => setPopupMsg(""), 3000); };

  const fetchStats = useCallback(async () => {
    const token = localStorage.getItem("token");
    if (!token || !adminUser) return;
    try {
      const r = await API.get("/api/tasks", { params: { limit: 1000 }, headers: { Authorization: `Bearer ${token}` } });
      const all = r.data?.tasks || [];
      const today = dayjs().startOf("day");
      const uid = getUser()._id;
      setStatCounts({
        total: r.data?.total || 0,
        assignedByMe: all.filter((t) => t.assignedBy?._id === uid).length,
        dueToday: all.filter((t) => t.dueDate && dayjs(t.dueDate).isSame(today, "day")).length,
        overdue: all.filter((t) => t.dueDate && dayjs(t.dueDate).isBefore(today, "day") && !["completed", "rejected"].includes(t.status || "")).length,
        completed: all.filter((t) => t.status === "completed").length,
        rejected: all.filter((t) => t.status === "rejected").length,
      });
    } catch (error) { console.error("Failed to fetch task statistics:", error); }
  }, [adminUser]);

  const handleEditSave = async (task) => {
    try {
      const payload = { ...task, assignedTo: Array.isArray(task.assignedTo) ? task.assignedTo : task.assignedTo ? [task.assignedTo] : [] };
      await taskApi.updateTask(task._id || task.id, payload);
      setEditingTask(null);
      showPopup("✅ Task updated!");
      fetchStats();
    } catch (err) { showPopup(`❌ ${err.response?.data?.message || "Update failed"}`); }
  };

  useEffect(() => {
    fetchStats();
    API.get("/api/users/assignable", { headers: { Authorization: `Bearer ${localStorage.getItem("token")}` } })
      .then((r) => setUsers(Array.isArray(r.data) ? r.data : [])).catch(() => {});
    const ci = setInterval(() => setCurrentTime(new Date()), 1000);
    return () => clearInterval(ci);
  }, [fetchStats]);

  if (checkingPayment) return (
    <div className="flex h-[100dvh] items-center justify-center bg-slate-50 dark:bg-[#0b0d12]">
      <div className="h-9 w-9 animate-spin rounded-full border-2 border-slate-200 border-t-blue-600 dark:border-white/10 dark:border-t-blue-400" />
    </div>
  );
  if (activePayment) return <PaymentBlockOverlay payment={activePayment} onPaymentCleared={clearPayment} />;

  // ── Tab definitions ──────────────────────────────────────────────────────
  const baseTabs = [
    { id: "mine", label: "My Tasks", icon: <FaUserAlt size={11} /> },
    { id: "assigned-by-me", label: "Assigned by Me", icon: <FaListUl size={11} /> },
    { id: "create", label: "Create Task", icon: <FaPlus size={11} /> },
  ];
  const adminTabs = [
    { id: "all", label: "All Tasks", icon: <FaTasks size={11} /> },
    ...baseTabs,
    { id: "analytics", label: "Analytics", icon: <FaChartBar size={11} /> },
  ];
  const tabs = adminUser ? adminTabs : baseTabs;

  const hour = currentTime.getHours();
  const greeting = hour < 12 ? "Morning" : hour < 18 ? "Afternoon" : "Evening";

  const STAT_DEFS = [
    { label: "Total", value: statCounts.total, c: "text-blue-400", b: "border-blue-500/20" },
    { label: "Assigned By Me", value: statCounts.assignedByMe, c: "text-orange-400", b: "border-orange-500/20" },
    { label: "Due Today", value: statCounts.dueToday, c: "text-green-400", b: "border-green-500/20" },
    { label: "Overdue", value: statCounts.overdue, c: "text-red-400", b: "border-red-500/20" },
    { label: "Completed", value: statCounts.completed, c: "text-purple-400", b: "border-purple-500/20" },
    { label: "Rejected", value: statCounts.rejected, c: "text-rose-400", b: "border-rose-500/20" },
  ];

  return (
    <div className="relative flex h-[100dvh] overflow-hidden bg-slate-50 text-slate-900 dark:bg-[#0b0d12] dark:text-slate-100">
      <Sidebar collapsed={collapsed} setCollapsed={setCollapsed} userRole={adminUser ? "admin" : role} onLogout={onLogout} />
      <main className={`min-w-0 flex-1 overflow-y-auto transition-[margin] duration-300 ${collapsed ? "ml-16" : "ml-16 sm:ml-56"}`}>
        <div className="mx-auto w-full max-w-[1500px] px-4 py-5 sm:px-6 lg:px-8 lg:py-7">

        {popupMsg && (
          <div className="fixed right-5 top-5 z-50 flex items-center gap-2 rounded-xl border border-slate-200 bg-white px-4 py-3 text-slate-800 shadow-xl dark:border-white/10 dark:bg-[#171a22] dark:text-slate-100">
            <div className="h-2 w-2 rounded-full bg-emerald-500" />
            <span className="text-sm font-medium">{popupMsg.replace(/[✅❌]/g, "").trim()}</span>
          </div>
        )}

        <section className="mb-5 overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm dark:border-white/10 dark:bg-[#10131c]">
          <div className="flex flex-col gap-5 p-4 lg:flex-row lg:items-center lg:justify-between lg:p-5">
            <div className="min-w-0">
              <div className="mb-4 inline-flex items-center gap-2 rounded-lg border border-blue-200 bg-blue-50 px-3 py-1.5 text-xs font-medium text-blue-700 dark:border-blue-400/20 dark:bg-blue-400/10 dark:text-blue-200">
                <span className="h-1.5 w-1.5 rounded-full bg-blue-500" />
                {currentTime.toLocaleDateString("en-IN", { weekday: "long", day: "numeric", month: "long", year: "numeric" })}
              </div>
              <p className="text-xs font-semibold uppercase tracking-wider text-slate-500 dark:text-slate-400">Work</p>
              <h1 className="mt-1 text-2xl font-semibold tracking-tight text-slate-950 dark:text-white">
                {adminUser ? "Task management" : "My tasks"}
              </h1>
              <p className="mt-1 max-w-2xl text-sm text-slate-500 dark:text-slate-400">
                {adminUser ? `Good ${greeting}, ${user.name || "Admin"}. Review priorities, assignments, and team progress.` : "Focus on what is due, update progress, and keep work moving."}
              </p>
            </div>

            <div className="flex flex-wrap items-center gap-2">
              <div className="rounded-lg border border-slate-200 bg-slate-50 px-3 py-2 text-right dark:border-white/10 dark:bg-white/[0.03]">
                <p className="text-[10px] font-medium uppercase tracking-wider text-slate-400">Local time</p>
                <p className="font-mono text-sm font-semibold text-slate-700 dark:text-slate-200">
                  {currentTime.toLocaleTimeString("en-IN", { hour: "2-digit", minute: "2-digit", second: "2-digit" })}
                </p>
              </div>
              <button
                type="button"
                onClick={() => setActiveTab(activeTab === "create" ? "mine" : "create")}
                className="inline-flex h-10 items-center justify-center gap-2 rounded-lg bg-blue-600 px-4 text-sm font-semibold text-white transition hover:bg-blue-700 dark:bg-blue-500 dark:hover:bg-blue-400"
              >
                {activeTab === "create" ? <FaUserAlt size={12} /> : <FaPlus size={12} />}
                {activeTab === "create" ? "View my tasks" : "Create task"}
              </button>
            </div>
          </div>
        </section>

        {/* Admin summary stats */}
        {adminUser && (
          <div className="mb-5 grid grid-cols-2 gap-3 sm:grid-cols-3 xl:grid-cols-6">
            {STAT_DEFS.map((s) => (
              <div key={s.label} className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm dark:border-white/10 dark:bg-[#12151c]">
                <p className={`text-2xl font-semibold ${s.c}`}>{s.value}</p>
                <p className="mt-0.5 text-xs font-medium text-slate-500 dark:text-slate-400">{s.label}</p>
              </div>
            ))}
          </div>
        )}

        {/* Tab bar */}
        <TabBar tabs={tabs} active={activeTab} onChange={setActiveTab} />

        {/* ── Panels ─────────────────────────────────────────────────────── */}

        {/* All Tasks (admin only) */}
        {activeTab === "all" && adminUser && (
          <div className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm dark:border-white/10 dark:bg-[#12151c]">
            <div className="flex items-center justify-between border-b border-slate-100 px-5 py-4 dark:border-white/[0.07]">
              <div>
                <h2 className="text-base font-semibold text-slate-950 dark:text-white">All tasks</h2>
                <p className="mt-0.5 text-xs text-slate-500 dark:text-slate-400">{statCounts.total} total across the team</p>
              </div>
            </div>
            <div className="p-5">
              <AllTasksPanel users={users} onEditTask={setEditingTask} onRefreshStats={fetchStats} />
            </div>
          </div>
        )}

        {/* My Tasks */}
        {activeTab === "mine" && (
          <ScopedTaskPanel scope="mine" onTaskCreated={refreshMineRef} />
        )}

        {/* Assigned by Me */}
        {activeTab === "assigned-by-me" && (
          <ScopedTaskPanel scope="assigned-by-me" onTaskCreated={refreshAssignedRef} />
        )}

        {/* Create Task */}
        {activeTab === "create" && (
          <CreateTaskPanel
            users={users}
            onCreated={() => {
              showPopup("✅ Task created!");
              if (refreshMineRef.current) refreshMineRef.current();
              if (refreshAssignedRef.current) refreshAssignedRef.current();
              fetchStats();
              setActiveTab("assigned-by-me");
            }}
          />
        )}

        {/* Analytics (admin only) */}
        {activeTab === "analytics" && adminUser && (
          <div className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm dark:border-white/10 dark:bg-[#12151c]">
            <div className="border-b border-slate-100 px-5 py-4 dark:border-white/[0.07]">
              <h2 className="text-base font-semibold text-slate-950 dark:text-white">Employee analytics</h2>
              <p className="mt-0.5 text-xs text-slate-500 dark:text-slate-400">Individual performance and completion rates</p>
            </div>
            <div className="p-5">
              <AnalyticsPanel users={users} />
            </div>
          </div>
        )}

        {editingTask && <EditTaskModal task={editingTask} onSave={handleEditSave} onCancel={() => setEditingTask(null)} users={users} />}
        </div>
      </main>
    </div>
  );
}
