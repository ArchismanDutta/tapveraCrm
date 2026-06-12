// File: src/components/admintask/TaskTable.jsx
// Card-based task list — no horizontal scroll, with pagination.
import React, { useState } from "react";
import axios from "axios";
import dayjs from "dayjs";
import relativeTime from "dayjs/plugin/relativeTime";
import { Eye, Edit3, Trash2, MessageCircle, XCircle, ChevronLeft, ChevronRight } from "lucide-react";
import TaskRemarksModal from "../task/TaskRemarksModal";
import TaskDetailModal from "./TaskDetailModal";

dayjs.extend(relativeTime);

const API_BASE = import.meta.env.VITE_API_BASE || "http://localhost:5000";

// ─── Helpers ──────────────────────────────────────────────────────────────────
const PRIORITY_STYLES = {
  High:   "bg-red-500/15 text-red-300 border border-red-500/30",
  Medium: "bg-yellow-500/15 text-yellow-300 border border-yellow-500/30",
  Low:    "bg-green-500/15 text-green-300 border border-green-500/30",
};
const STATUS_STYLES = {
  pending:      "bg-slate-500/20 text-slate-300 border border-slate-500/30",
  "in-progress":"bg-blue-500/15 text-blue-300 border border-blue-500/30",
  completed:    "bg-green-500/15 text-green-300 border border-green-500/30",
  rejected:     "bg-red-500/15 text-red-300 border border-red-500/30",
};

const badge = (text, styles) => (
  <span className={`inline-flex items-center px-2 py-0.5 rounded-md text-xs font-semibold ${styles}`}>
    {text}
  </span>
);

const isOverdue = (task) =>
  task.dueDate && !["completed", "rejected"].includes(task.status) && dayjs(task.dueDate).isBefore(dayjs());

// ─── Info Row helper ───────────────────────────────────────────────────────────
const InfoRow = ({ icon, label, children, className = "" }) => (
  <div className={`flex items-start gap-2 ${className}`}>
    <span className="flex-shrink-0 mt-0.5 text-gray-500">{icon}</span>
    <div className="flex items-start gap-1.5 min-w-0 flex-wrap">
      <span className="text-gray-500 text-xs flex-shrink-0">{label}</span>
      <span className="text-xs font-medium min-w-0">{children}</span>
    </div>
  </div>
);

// ─── Single Task Card ──────────────────────────────────────────────────────────
const TaskCard = ({ task, onView, onEdit, onDelete, onReject, onRemarks, onViewDetails }) => {
  const overdue = isOverdue(task);
  const assignees = Array.isArray(task.assignedTo) ? task.assignedTo : [];

  return (
    <div className={`border rounded-2xl flex flex-col transition-all duration-200 hover:shadow-xl hover:shadow-black/40 overflow-hidden
      ${task.status === "completed" ? "bg-[#0f1520] opacity-60 hover:opacity-80" : "bg-[#141c2e]"}
      ${task.status === "rejected" ? "border-red-500/30 hover:border-red-500/50"
        : overdue        ? "border-orange-500/30 hover:border-orange-500/50"
        : task.status === "completed" ? "border-[rgba(84,123,209,0.08)]"
        : "border-[rgba(84,123,209,0.15)] hover:border-[rgba(84,123,209,0.35)]"}`}>

      {/* ── Coloured top accent bar ── */}
      <div className={`h-1 w-full flex-shrink-0 ${
        task.status === "completed" ? "bg-green-500"
          : task.status === "rejected" ? "bg-red-500"
          : task.status === "in-progress" ? "bg-blue-500"
          : overdue ? "bg-orange-500"
          : "bg-[rgba(84,123,209,0.5)]"}`} />

      <div className="p-4 flex flex-col gap-3 flex-1">

        {/* ── Title + badges ── */}
        <div className="flex items-start justify-between gap-2">
          <button onClick={() => onViewDetails?.(task)} className="text-left flex-1 min-w-0">
            <h3 className="font-semibold text-white text-sm leading-snug hover:text-cyan-300 transition-colors">
              {task.title || "Untitled Task"}
            </h3>
          </button>
          <div className="flex items-center gap-1.5 flex-shrink-0 flex-wrap justify-end">
            {badge(task.priority || "—", PRIORITY_STYLES[task.priority] || "bg-gray-500/20 text-gray-300")}
            {overdue && badge("Overdue", "bg-orange-500/15 text-orange-300 border border-orange-500/30")}
          </div>
        </div>

        {/* ── Description ── */}
        {task.description ? (
          <p className="text-gray-400 text-xs leading-relaxed whitespace-pre-wrap break-words border-l-2 border-[rgba(84,123,209,0.2)] pl-2">
            {task.description}
          </p>
        ) : (
          <p className="text-gray-600 text-xs italic border-l-2 border-[rgba(84,123,209,0.1)] pl-2">No description.</p>
        )}

        {/* ── Structured info rows ── */}
        <div className="bg-[#0d1220] rounded-xl p-3 space-y-2">
          {/* Created by */}
          <InfoRow
            icon={<svg className="w-3 h-3" fill="currentColor" viewBox="0 0 20 20"><path d="M10 9a3 3 0 100-6 3 3 0 000 6zm-7 9a7 7 0 1114 0H3z"/></svg>}
            label="Created by:">
            <span className="text-gray-200">{task.assignedBy?.name || "—"}</span>
          </InfoRow>

          {/* Created on */}
          <InfoRow
            icon={<svg className="w-3 h-3 text-indigo-400" fill="currentColor" viewBox="0 0 20 20"><path fillRule="evenodd" d="M6 2a1 1 0 00-1 1v1H4a2 2 0 00-2 2v10a2 2 0 002 2h12a2 2 0 002-2V6a2 2 0 00-2-2h-1V3a1 1 0 10-2 0v1H7V3a1 1 0 00-1-1zm0 5a1 1 0 000 2h8a1 1 0 100-2H6z" clipRule="evenodd"/></svg>}
            label="Created on:">
            <span className="text-indigo-300">{task.createdAt ? dayjs(task.createdAt).format("MMM D, YYYY · h:mm A") : "—"}</span>
          </InfoRow>

          {/* Due date */}
          <InfoRow
            icon={<svg className="w-3 h-3" fill="currentColor" viewBox="0 0 20 20"><path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm1-12a1 1 0 10-2 0v4a1 1 0 00.293.707l2.828 2.829a1 1 0 101.415-1.415L11 9.586V6z" clipRule="evenodd"/></svg>}
            label="Due:">
            {task.dueDate
              ? <span className={overdue ? "text-orange-300 font-semibold" : "text-gray-200"}>{dayjs(task.dueDate).format("MMM D, YYYY · h:mm A")}</span>
              : <span className="text-gray-600 italic">No due date</span>}
          </InfoRow>

          {/* Assigned to */}
          {assignees.length > 0 && (
            <div className="flex items-start gap-2">
              <span className="flex-shrink-0 mt-0.5 text-gray-500">
                <svg className="w-3 h-3" fill="currentColor" viewBox="0 0 20 20"><path d="M9 6a3 3 0 11-6 0 3 3 0 016 0zM17 6a3 3 0 11-6 0 3 3 0 016 0zM12.93 17c.046-.327.07-.66.07-1a6.97 6.97 0 00-1.5-4.33A5 5 0 0119 16v1h-6.07zM6 11a5 5 0 015 5v1H1v-1a5 5 0 015-5z"/></svg>
              </span>
              <div className="flex-1 min-w-0">
                <span className="text-gray-500 text-xs">Assigned to:</span>
                <div className="flex flex-wrap gap-1 mt-1">
                  {assignees.map((u, i) => (
                    <span key={u._id || i}
                      className="inline-flex items-center gap-1 pl-1 pr-2 py-0.5 rounded-full bg-[rgba(84,123,209,0.12)] border border-[rgba(84,123,209,0.2)] text-xs text-gray-300"
                      title={u.name || u.email}>
                      <img
                        src={u.photo || `https://ui-avatars.com/api/?name=${encodeURIComponent(u.name || "U")}&background=1e2d4a&color=94a3b8&size=20`}
                        alt="" className="w-4 h-4 rounded-full object-cover flex-shrink-0"
                      />
                      <span className="truncate max-w-[80px]">{u.name || u.email}</span>
                    </span>
                  ))}
                </div>
              </div>
            </div>
          )}

          {/* Project */}
          {task.project && (
            <InfoRow
              icon={<svg className="w-3 h-3 text-cyan-500" fill="currentColor" viewBox="0 0 20 20"><path d="M2 6a2 2 0 012-2h5l2 2h5a2 2 0 012 2v6a2 2 0 01-2 2H4a2 2 0 01-2-2V6z"/></svg>}
              label="Project:">
              <span className="text-cyan-400 truncate">{task.project.projectName || "—"}</span>
            </InfoRow>
          )}

          {/* Completed at */}
          {task.completedAt && (
            <InfoRow
              icon={<svg className="w-3 h-3 text-green-500" fill="currentColor" viewBox="0 0 20 20"><path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd"/></svg>}
              label="Completed:">
              <span className="text-green-400">{dayjs(task.completedAt).format("MMM D, YYYY · h:mm A")}</span>
            </InfoRow>
          )}

          {/* Rejection reason */}
          {task.status === "rejected" && task.rejectionReason && (
            <InfoRow
              icon={<svg className="w-3 h-3 text-red-400" fill="currentColor" viewBox="0 0 20 20"><path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.707 7.293a1 1 0 00-1.414 1.414L8.586 10l-1.293 1.293a1 1 0 101.414 1.414L10 11.414l1.293 1.293a1 1 0 001.414-1.414L11.414 10l1.293-1.293a1 1 0 00-1.414-1.414L10 8.586 8.707 7.293z" clipRule="evenodd"/></svg>}
              label="Rejected:">
              <span className="text-red-300">{task.rejectionReason}</span>
            </InfoRow>
          )}
        </div>

        {/* ── Footer: status + actions ── */}
        <div className="flex items-center justify-between pt-1 mt-auto">
          {badge(task.status || "—", STATUS_STYLES[task.status] || "bg-gray-500/20 text-gray-300")}
          <div className="flex items-center gap-0.5">
            <ActionBtn icon={Eye} label="Details" color="text-blue-400 hover:text-blue-300" onClick={() => onViewDetails?.(task)} />
            <ActionBtn icon={Edit3} label="Edit" color="text-emerald-400 hover:text-emerald-300" onClick={() => onEdit?.(task)} />
            <ActionBtn icon={MessageCircle} label="Remarks" color="text-yellow-400 hover:text-yellow-300" onClick={() => onRemarks?.(task)} />
            {task.status === "completed" && (
              <ActionBtn icon={XCircle} label="Reject" color="text-red-400 hover:text-red-300" onClick={() => onReject?.(task)} />
            )}
            <ActionBtn icon={Trash2} label="Delete" color="text-red-500 hover:text-red-400" onClick={() => onDelete?.(task._id)} />
          </div>
        </div>

      </div>
    </div>
  );
};

const ActionBtn = ({ icon: Icon, label, color, onClick }) => (
  <button
    type="button"
    title={label}
    onClick={onClick}
    className={`p-1.5 rounded-lg ${color} hover:bg-white/8 transition-colors`}
  >
    <Icon size={14} />
  </button>
);

// ─── Pagination ────────────────────────────────────────────────────────────────
const Pagination = ({ page, totalPages, total, limit, onPageChange }) => {
  if (totalPages <= 1) return null;

  const start = (page - 1) * limit + 1;
  const end = Math.min(page * limit, total);

  // Build page range (max 5 buttons)
  const getPages = () => {
    if (totalPages <= 7) return Array.from({ length: totalPages }, (_, i) => i + 1);
    const pages = [];
    if (page <= 4) {
      for (let i = 1; i <= 5; i++) pages.push(i);
      pages.push("...");
      pages.push(totalPages);
    } else if (page >= totalPages - 3) {
      pages.push(1);
      pages.push("...");
      for (let i = totalPages - 4; i <= totalPages; i++) pages.push(i);
    } else {
      pages.push(1);
      pages.push("...");
      for (let i = page - 1; i <= page + 1; i++) pages.push(i);
      pages.push("...");
      pages.push(totalPages);
    }
    return pages;
  };

  return (
    <div className="flex flex-col sm:flex-row items-center justify-between gap-3 pt-4 border-t border-[rgba(84,123,209,0.1)]">
      <p className="text-xs text-gray-400">
        Showing <span className="text-white font-medium">{start}–{end}</span> of <span className="text-white font-medium">{total}</span> tasks
      </p>
      <div className="flex items-center gap-1">
        <button
          onClick={() => onPageChange(page - 1)}
          disabled={page === 1}
          className="p-1.5 rounded-lg border border-[rgba(84,123,209,0.2)] text-gray-400 hover:text-white hover:border-cyan-500/50 disabled:opacity-30 disabled:cursor-not-allowed transition"
        >
          <ChevronLeft size={14} />
        </button>
        {getPages().map((p, i) =>
          p === "..." ? (
            <span key={`ellipsis-${i}`} className="px-1.5 text-gray-500 text-sm">…</span>
          ) : (
            <button
              key={p}
              onClick={() => onPageChange(p)}
              className={`min-w-[32px] h-8 rounded-lg text-xs font-medium transition border ${
                p === page
                  ? "bg-cyan-500/20 border-cyan-500/50 text-cyan-300"
                  : "border-[rgba(84,123,209,0.2)] text-gray-400 hover:text-white hover:border-cyan-500/30"
              }`}
            >
              {p}
            </button>
          )
        )}
        <button
          onClick={() => onPageChange(page + 1)}
          disabled={page === totalPages}
          className="p-1.5 rounded-lg border border-[rgba(84,123,209,0.2)] text-gray-400 hover:text-white hover:border-cyan-500/50 disabled:opacity-30 disabled:cursor-not-allowed transition"
        >
          <ChevronRight size={14} />
        </button>
      </div>
    </div>
  );
};

// ─── Main TaskTable ────────────────────────────────────────────────────────────
const TaskTable = ({
  tasks = [],
  total = 0,
  page = 1,
  totalPages = 1,
  limit = 10,
  onPageChange,
  onViewTask,
  onEditTask,
  onDeleteTask,
  onRejectTask,
  loading = false,
}) => {
  const [selectedTask, setSelectedTask] = useState(null);   // remarks modal
  const [rejectingTask, setRejectingTask] = useState(null); // reject modal
  const [rejectionReason, setRejectionReason] = useState("");
  const [rejectLoading, setRejectLoading] = useState(false);
  const [detailTask, setDetailTask] = useState(null);       // detail modal

  const safeTasks = Array.isArray(tasks) ? tasks : [];

  // ── Open remarks modal ──
  const openRemarks = async (task) => {
    try {
      const token = localStorage.getItem("token");
      const r = await axios.get(`${API_BASE}/api/tasks/${task._id}`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      setSelectedTask(r.data);
    } catch { alert("Could not load remarks."); }
  };

  const handleAddRemark = async (comment) => {
    if (!selectedTask || !comment.trim()) return;
    try {
      const token = localStorage.getItem("token");
      const r = await axios.post(
        `${API_BASE}/api/tasks/${selectedTask._id}/remarks`,
        { comment },
        { headers: { Authorization: `Bearer ${token}` } }
      );
      if (r.data?.remarks) setSelectedTask((p) => ({ ...p, remarks: r.data.remarks }));
    } catch { alert("Could not add remark."); }
  };

  // ── Open detail modal ──
  const openDetails = async (task) => {
    try {
      const token = localStorage.getItem("token");
      const r = await axios.get(`${API_BASE}/api/tasks/${task._id}`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      setDetailTask(r.data);
    } catch { alert("Could not load task details."); }
  };

  // ── Reject task ──
  const handleReject = async () => {
    if (!rejectionReason.trim()) return alert("Please provide a rejection reason.");
    setRejectLoading(true);
    try {
      const token = localStorage.getItem("token");
      await axios.patch(
        `${API_BASE}/api/tasks/${rejectingTask._id}/reject`,
        { reason: rejectionReason },
        { headers: { Authorization: `Bearer ${token}` } }
      );
      setRejectingTask(null);
      setRejectionReason("");
      if (onRejectTask) onRejectTask(rejectingTask._id);
    } catch (err) {
      alert(err.response?.data?.message || "Failed to reject task.");
    } finally {
      setRejectLoading(false);
    }
  };

  // ── Loading skeleton ──
  if (loading) {
    return (
      <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
        {Array.from({ length: 6 }).map((_, i) => (
          <div key={i} className="bg-[#141c2e] border border-[rgba(84,123,209,0.1)] rounded-xl p-4 animate-pulse">
            <div className="h-4 bg-[rgba(84,123,209,0.15)] rounded w-3/4 mb-3" />
            <div className="h-3 bg-[rgba(84,123,209,0.1)] rounded w-full mb-2" />
            <div className="h-3 bg-[rgba(84,123,209,0.1)] rounded w-2/3 mb-4" />
            <div className="flex gap-2">
              <div className="h-5 w-16 bg-[rgba(84,123,209,0.1)] rounded-md" />
              <div className="h-5 w-20 bg-[rgba(84,123,209,0.1)] rounded-md" />
            </div>
          </div>
        ))}
      </div>
    );
  }

  // ── Empty state ──
  if (safeTasks.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-16 text-center">
        <div className="w-16 h-16 bg-[rgba(84,123,209,0.08)] rounded-2xl flex items-center justify-center mb-4">
          <svg className="w-8 h-8 text-gray-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2" />
          </svg>
        </div>
        <p className="text-gray-400 font-medium">No tasks found</p>
        <p className="text-gray-500 text-sm mt-1">Try adjusting your filters or create a new task</p>
      </div>
    );
  }

  return (
    <>
      {/* Cards Grid */}
      <div className="grid grid-cols-1 xl:grid-cols-2 gap-4 mb-4">
        {safeTasks.map((task, i) => (
          <TaskCard
            key={task._id || i}
            task={task}
            onViewDetails={openDetails}
            onEdit={onEditTask}
            onDelete={onDeleteTask}
            onRemarks={openRemarks}
            onReject={setRejectingTask}
          />
        ))}
      </div>

      {/* Pagination */}
      <Pagination page={page} totalPages={totalPages} total={total} limit={limit} onPageChange={onPageChange} />

      {/* Remarks Modal */}
      {selectedTask && (
        <TaskRemarksModal task={selectedTask} onClose={() => setSelectedTask(null)} onAddRemark={handleAddRemark} />
      )}

      {/* Task Detail Modal */}
      {detailTask && <TaskDetailModal task={detailTask} onClose={() => setDetailTask(null)} />}

      {/* Reject Modal */}
      {rejectingTask && (
        <div className="fixed inset-0 flex items-center justify-center z-50 bg-black/70 backdrop-blur-sm">
          <div className="bg-[#141c2e] border border-red-500/30 rounded-2xl p-6 w-full max-w-md mx-4 shadow-2xl text-white">
            <div className="flex items-center justify-between mb-4">
              <div className="flex items-center gap-3">
                <div className="p-2 bg-red-500/10 rounded-xl"><XCircle className="w-5 h-5 text-red-400" /></div>
                <h2 className="text-lg font-bold text-red-400">Reject Task</h2>
              </div>
              <button onClick={() => { setRejectingTask(null); setRejectionReason(""); }}
                className="p-2 hover:bg-red-500/20 rounded-xl text-gray-400 hover:text-red-400 transition">
                <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 20 20"><path fillRule="evenodd" d="M4.293 4.293a1 1 0 011.414 0L10 8.586l4.293-4.293a1 1 0 111.414 1.414L11.414 10l4.293 4.293a1 1 0 01-1.414 1.414L10 11.414l-4.293 4.293a1 1 0 01-1.414-1.414L8.586 10 4.293 5.707a1 1 0 010-1.414z" clipRule="evenodd" /></svg>
              </button>
            </div>
            <p className="text-sm text-gray-400 mb-1">Task: <span className="font-medium text-white">{rejectingTask.title}</span></p>
            <p className="text-xs text-gray-500 mb-4">This reason will be visible to the assignees.</p>
            <textarea
              value={rejectionReason}
              onChange={(e) => setRejectionReason(e.target.value)}
              rows={4}
              placeholder="Enter rejection reason…"
              autoFocus
              className="bg-[#0d1220] border border-[rgba(84,123,209,0.25)] rounded-xl p-3 w-full text-white text-sm resize-none focus:ring-2 focus:ring-red-500/50 outline-none mb-4"
            />
            <div className="flex gap-3 justify-end">
              <button onClick={() => { setRejectingTask(null); setRejectionReason(""); }}
                className="px-5 py-2 bg-gray-700 hover:bg-gray-600 rounded-xl text-sm font-medium transition">Cancel</button>
              <button onClick={handleReject} disabled={rejectLoading}
                className="px-5 py-2 bg-red-500 hover:bg-red-600 disabled:opacity-50 rounded-xl text-sm font-medium transition">
                {rejectLoading ? "Rejecting…" : "Reject"}
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
};

export default TaskTable;
