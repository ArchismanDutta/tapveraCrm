import React, { useEffect, useRef, useState } from "react";
import { FaClock, FaCommentDots, FaFolder, FaUserTie } from "react-icons/fa";
import dayjs from "dayjs";
import taskApi from "../../api/taskApi";
import TaskRemarksModal from "./TaskRemarksModal";
import { useAchievements } from "../../contexts/AchievementContext";

const priorityColors = {
  High: "border-rose-200 bg-rose-50 text-rose-700 dark:border-rose-500/20 dark:bg-rose-500/10 dark:text-rose-300",
  Medium: "border-amber-200 bg-amber-50 text-amber-700 dark:border-amber-500/20 dark:bg-amber-500/10 dark:text-amber-300",
  Low: "border-slate-200 bg-slate-100 text-slate-600 dark:border-white/10 dark:bg-white/[0.06] dark:text-slate-300",
};

const statusColors = {
  pending: "border-slate-200 bg-slate-100 text-slate-600 dark:border-white/10 dark:bg-white/[0.06] dark:text-slate-300",
  "in-progress": "border-blue-200 bg-blue-50 text-blue-700 dark:border-blue-500/20 dark:bg-blue-500/10 dark:text-blue-300",
  completed: "border-emerald-200 bg-emerald-50 text-emerald-700 dark:border-emerald-500/20 dark:bg-emerald-500/10 dark:text-emerald-300",
  rejected: "border-rose-200 bg-rose-50 text-rose-700 dark:border-rose-500/20 dark:bg-rose-500/10 dark:text-rose-300",
};

const statusAccent = {
  pending: "border-l-slate-300 dark:border-l-slate-600",
  "in-progress": "border-l-blue-500",
  completed: "border-l-emerald-500",
  rejected: "border-l-rose-500",
};

const badgeBase = "inline-flex items-center rounded-full border px-2 py-0.5 text-[11px] font-medium";

// Detects whether clamped text is actually being cut off, so the
// "Show more" toggle only appears when there is something more to show.
const useIsClamped = (text, expanded) => {
  const ref = useRef(null);
  const [isClamped, setIsClamped] = useState(false);

  useEffect(() => {
    const el = ref.current;
    if (!el || expanded) return undefined;

    let active = true;
    const measure = () => {
      if (active) setIsClamped(el.scrollHeight - el.clientHeight > 1);
    };
    measure();

    // Web fonts can change the line count after the first paint.
    if (typeof document !== "undefined" && document.fonts?.ready) {
      document.fonts.ready.then(measure).catch(() => {});
    }

    if (typeof ResizeObserver === "undefined") {
      return () => {
        active = false;
      };
    }

    const observer = new ResizeObserver(measure);
    observer.observe(el);
    return () => {
      active = false;
      observer.disconnect();
    };
  }, [text, expanded]);

  return [ref, isClamped];
};

const TaskItem = ({ task, onStatusUpdated, isKanbanCard = false }) => {
  const status = task.status || "pending";
  const [loading, setLoading] = useState(false);
  const [showRemarks, setShowRemarks] = useState(false);
  const [remarks, setRemarks] = useState(task.remarks || []);
  const [descriptionExpanded, setDescriptionExpanded] = useState(false);
  const [descriptionRef, descriptionClamped] = useIsClamped(task.description, descriptionExpanded);
  const { triggerAchievement } = useAchievements();

  const handleStatusChange = async (newStatus) => {
    if (!newStatus || newStatus === status) return;
    setLoading(true);
    try {
      const updated = await taskApi.updateStatus(task._id, newStatus);
      if (newStatus === "completed" && status !== "completed") {
        triggerAchievement("TASK_COMPLETED", {
          priority: task.priority,
          wasOverdue: Boolean(task.dueDate && dayjs().isAfter(dayjs(task.dueDate))),
        });
      }
      onStatusUpdated?.(updated);
    } catch (err) {
      console.error("Status update failed:", err);
      alert(err.response?.data?.message || "Failed to update status.");
    } finally {
      setLoading(false);
    }
  };

  const handleAddRemark = async (comment) => {
    try {
      const updated = await taskApi.addRemark(task._id, comment);
      setRemarks(updated.remarks || []);
      triggerAchievement("COMMENT_ADDED");
    } catch (err) {
      console.error("Failed to add remark:", err);
      alert(err.response?.data?.message || "Could not add remark.");
    }
  };

  const overdue = Boolean(
    task.dueDate && !["completed", "rejected"].includes(status) && dayjs().isAfter(dayjs(task.dueDate), "day"),
  );
  const assignees = Array.isArray(task.assignedTo)
    ? task.assignedTo
    : task.assignedTo
      ? [task.assignedTo]
      : [];
  const priorityClass = priorityColors[task.priority] || priorityColors.Low;
  const statusClass = statusColors[status] || statusColors.pending;
  const statusLabel = status.replace("-", " ");

  const descriptionToggle =
    descriptionClamped || descriptionExpanded ? (
      <button
        type="button"
        onClick={(event) => {
          event.stopPropagation();
          setDescriptionExpanded((prev) => !prev);
        }}
        aria-expanded={descriptionExpanded}
        className="mt-1 rounded text-[11px] font-medium text-blue-600 transition hover:underline focus:outline-none focus-visible:ring-2 focus-visible:ring-blue-500/40 dark:text-blue-400"
      >
        {descriptionExpanded ? "Show less" : "Show more"}
      </button>
    ) : null;

  if (isKanbanCard) {
    return (
      <div className="cursor-move rounded-xl border border-slate-200 bg-white p-4 shadow-sm transition hover:border-slate-300 dark:border-white/10 dark:bg-[#12151c] dark:hover:border-white/20">
        <div className="flex items-start justify-between gap-3">
          <h4 className="text-sm font-semibold leading-5 text-slate-900 dark:text-slate-100">{task.title}</h4>
          <span className={`${badgeBase} ${priorityClass}`}>{task.priority || "Low"}</span>
        </div>
        {task.description && (
          <div className="mt-2">
            <p
              ref={descriptionRef}
              className={`whitespace-pre-line break-words text-xs leading-5 text-slate-500 dark:text-slate-400 ${
                descriptionExpanded ? "max-h-56 overflow-y-auto pr-1" : "line-clamp-2"
              }`}
            >
              {task.description}
            </p>
            {descriptionToggle}
          </div>
        )}
        <div className="mt-4 flex items-center justify-between border-t border-slate-100 pt-3 dark:border-white/[0.07]">
          <span className={`flex items-center gap-1.5 text-xs ${overdue ? "text-rose-600 dark:text-rose-300" : "text-slate-500 dark:text-slate-400"}`}>
            <FaClock size={10} />
            {task.dueDate ? dayjs(task.dueDate).format("DD MMM") : "No due date"}
          </span>
          <button
            type="button"
            onClick={() => setShowRemarks(true)}
            className="flex items-center gap-1.5 rounded-lg px-2 py-1 text-xs text-slate-500 transition hover:bg-slate-100 hover:text-slate-800 dark:text-slate-400 dark:hover:bg-white/[0.06] dark:hover:text-slate-100"
          >
            <FaCommentDots size={11} /> {remarks.length}
          </button>
        </div>
        {showRemarks && (
          <TaskRemarksModal task={{ ...task, remarks }} onClose={() => setShowRemarks(false)} onAddRemark={handleAddRemark} />
        )}
      </div>
    );
  }

  return (
    <article
      className={`rounded-2xl border border-l-[3px] bg-white px-4 py-4 shadow-sm transition hover:border-slate-300 hover:shadow-md dark:border-white/10 dark:bg-[#12151c] dark:hover:border-white/20 ${statusAccent[status] || statusAccent.pending} ${status === "completed" ? "opacity-75" : ""}`}
    >
      <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-2">
            <h3 className="min-w-0 text-sm font-semibold text-slate-900 dark:text-slate-100 sm:text-[15px]">{task.title}</h3>
            <span className={`${badgeBase} capitalize ${statusClass}`}>{statusLabel}</span>
            <span className={`${badgeBase} ${priorityClass}`}>{task.priority || "Low"}</span>
            {overdue && (
              <span className={`${badgeBase} border-rose-200 bg-rose-50 text-rose-700 dark:border-rose-500/20 dark:bg-rose-500/10 dark:text-rose-300`}>Overdue</span>
            )}
          </div>

          {task.description && (
            <div className="mt-2 max-w-3xl">
              <p
                ref={descriptionRef}
                className={`whitespace-pre-line break-words text-xs leading-5 text-slate-500 dark:text-slate-400 ${
                  descriptionExpanded ? "" : "line-clamp-2"
                }`}
              >
                {task.description}
              </p>
              {descriptionToggle}
            </div>
          )}

          <div className="mt-3 flex flex-wrap items-center gap-x-5 gap-y-2 text-xs text-slate-500 dark:text-slate-400">
            <span className={`flex items-center gap-1.5 ${overdue ? "font-medium text-rose-600 dark:text-rose-300" : ""}`}>
              <FaClock size={10} />
              {task.dueDate ? `Due ${dayjs(task.dueDate).format("DD MMM YYYY")}` : "No due date"}
            </span>
            <span className="flex items-center gap-1.5">
              <FaUserTie size={10} />
              {task.assignedBy?.name || "Unknown assigner"}
            </span>
            {task.project && (
              <span className="flex min-w-0 items-center gap-1.5">
                <FaFolder size={10} />
                <span className="max-w-40 truncate">{task.project?.projectName || "Project"}</span>
              </span>
            )}
            {assignees.length > 0 && (
              <span>
                Assigned to {assignees[0]?.name || assignees[0]?.email || "team member"}
                {assignees.length > 1 ? ` +${assignees.length - 1}` : ""}
              </span>
            )}
          </div>

          {status === "rejected" && (
            <div className="mt-3 rounded-xl border border-rose-200 bg-rose-50 px-3 py-2 text-xs text-rose-700 dark:border-rose-500/20 dark:bg-rose-500/10 dark:text-rose-200">
              <span className="font-semibold">Needs revision:</span> {task.rejectionReason || "No reason provided"}
            </div>
          )}
        </div>

        <div className="flex shrink-0 items-center gap-2 border-t border-slate-100 pt-3 dark:border-white/[0.07] lg:border-0 lg:pt-0">
          {status === "completed" ? (
            <span className="rounded-lg border border-emerald-200 bg-emerald-50 px-3 py-2 text-xs font-medium text-emerald-700 dark:border-emerald-500/20 dark:bg-emerald-500/10 dark:text-emerald-300">
              Completed
            </span>
          ) : (
            <select
              aria-label={`Update status for ${task.title}`}
              value={status === "rejected" ? "" : status}
              onChange={(event) => handleStatusChange(event.target.value)}
              disabled={loading}
              className="rounded-lg border border-slate-200 bg-white px-3 py-2 text-xs font-medium text-slate-700 outline-none transition focus:border-blue-500 focus:ring-2 focus:ring-blue-500/15 disabled:opacity-50 dark:border-white/10 dark:bg-white/[0.04] dark:text-slate-200"
            >
              {status === "rejected" && <option value="" disabled>Change status</option>}
              <option value="pending">Pending</option>
              <option value="in-progress">In progress</option>
              <option value="completed">Completed</option>
            </select>
          )}
          <button
            type="button"
            onClick={() => setShowRemarks(true)}
            className="flex items-center gap-1.5 rounded-lg border border-slate-200 bg-white px-3 py-2 text-xs font-medium text-slate-600 transition hover:bg-slate-50 hover:text-slate-900 dark:border-white/10 dark:bg-white/[0.04] dark:text-slate-300 dark:hover:bg-white/[0.08] dark:hover:text-white"
          >
            <FaCommentDots size={11} />
            <span className="hidden sm:inline">Comments</span>
            {remarks.length > 0 && <span>{remarks.length}</span>}
          </button>
        </div>
      </div>

      {showRemarks && (
        <TaskRemarksModal task={{ ...task, remarks }} onClose={() => setShowRemarks(false)} onAddRemark={handleAddRemark} />
      )}
    </article>
  );
};

export default TaskItem;
