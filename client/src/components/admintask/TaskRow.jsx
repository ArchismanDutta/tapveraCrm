// File: src/components/admintask/TaskRow.jsx
import React, { useState, useRef, useEffect } from "react";
import { Eye, Trash2, Edit3, MessageCircle, XCircle } from "lucide-react";
import axios from "axios";

const priorityColors = {
  High: "bg-red-700 text-red-100 border border-red-600",
  Medium: "bg-yellow-500 text-yellow-900 border border-yellow-400",
  Low: "bg-green-600 text-green-100 border border-green-500",
};

const statusColors = {
  pending: "bg-blue-600 text-blue-100 border border-blue-500",
  "in-progress": "bg-purple-600 text-purple-100 border border-purple-500",
  completed: "bg-green-600 text-green-100 border border-green-500",
  rejected: "bg-red-600 text-red-100 border border-red-500",
};

const ACTIONS = [
  { icon: Eye, key: "view", color: "text-blue-400", tooltip: "View Task" },
  { icon: Edit3, key: "edit", color: "text-green-400", tooltip: "Edit Task" },
  { icon: Trash2, key: "delete", color: "text-red-500", tooltip: "Delete Task" },
  { icon: MessageCircle, key: "remarks", color: "text-yellow-400", tooltip: "Remarks" },
];

const TaskRow = ({ task, onView, onEdit, onDelete, onReject, onRemarks, onViewDetails }) => {
  const [remarksOpen, setRemarksOpen] = useState(false);
  const [remarks, setRemarks] = useState(task.remarks || []);
  const [comment, setComment] = useState("");
  const [loading, setLoading] = useState(false);

  // Tooltip states
  const [showTooltip, setShowTooltip] = useState(null);
  const [tooltipPos, setTooltipPos] = useState({});
  const [showTitleTooltip, setShowTitleTooltip] = useState(false);
  const [titleTooltipPos, setTitleTooltipPos] = useState({});

  const rowRef = useRef(null);
  const API_BASE = import.meta.env.VITE_API_BASE || "http://localhost:5000";

  // ✅ Truncate description helper
  const truncateDescription = (text, maxWords = 25) => {
    if (!text) return "No description available";
    const words = text.trim().split(/\s+/);
    if (words.length <= maxWords) return text;
    return words.slice(0, maxWords).join(" ") + "...";
  };

  const handleIconMouseEnter = (idx, e) => {
    const rect = e.currentTarget.getBoundingClientRect();
    setTooltipPos({
      top: rect.top + window.scrollY - 28,
      left: rect.left + rect.width / 2 + window.scrollX,
    });
    setShowTooltip(idx);
  };
  const handleIconMouseLeave = () => setShowTooltip(null);

  const handleTitleMouseEnter = (e) => {
    const rect = e.currentTarget.getBoundingClientRect();
    setTitleTooltipPos({
      top: rect.top + window.scrollY - 28,
      left: rect.left + rect.width / 2 + window.scrollX,
    });
    setShowTitleTooltip(true);
  };
  const handleTitleMouseLeave = () => setShowTitleTooltip(false);

  const toggleRemarks = async () => {
    if (!remarksOpen) {
      try {
        const token = localStorage.getItem("token");
        const res = await axios.get(`${API_BASE}/api/tasks/${task._id}`, {
          headers: { Authorization: `Bearer ${token}` },
        });
        setRemarks(res.data.remarks || []);
      } catch (err) {
        console.error(err);
        alert("Failed to fetch remarks");
      }
    }
    setRemarksOpen(!remarksOpen);
  };

  const handleAddRemark = async () => {
    if (!comment.trim()) return;
    setLoading(true);
    try {
      const token = localStorage.getItem("token");
      const res = await axios.post(
        `${API_BASE}/api/tasks/${task._id}/remarks`,
        { comment },
        { headers: { Authorization: `Bearer ${token}` } }
      );
      setRemarks(res.data.remarks || []);
      setComment("");
    } catch (err) {
      console.error(err);
      alert("Failed to add remark");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    const handleClickOutside = (event) => {
      if (rowRef.current && !rowRef.current.contains(event.target)) {
        setRemarksOpen(false);
      }
    };
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  return (
    <tr
      ref={rowRef}
      className="border-b border-blue-700/60 odd:bg-[#191f33] even:bg-[#161c2c] hover:bg-[#252e4d]/80 text-blue-100"
    >
      {/* Task Title */}
      <td
        className="px-1.5 py-2 font-medium cursor-pointer truncate relative hover:text-blue-400 transition-colors"
        onMouseEnter={handleTitleMouseEnter}
        onMouseLeave={handleTitleMouseLeave}
        onClick={() => onViewDetails && onViewDetails(task)}
        title="Click to view full task details"
      >
        {task.title || "Untitled Task"}
        {showTitleTooltip && (
          <div
            className="absolute z-50 bg-[#161c2c] text-blue-100 text-xs rounded px-2 py-1 shadow-lg whitespace-normal w-60 -translate-x-1/2"
            style={{ top: titleTooltipPos.top, left: titleTooltipPos.left }}
          >
            {truncateDescription(task.description)}
          </div>
        )}
      </td>

      {/* Assigned To */}
      <td className="px-1.5 py-2">
        <div className="flex items-center gap-0.5 overflow-hidden">
          {Array.isArray(task.assignedTo) && task.assignedTo.length > 0 ? (
            <>
              {/* Show only first avatar */}
              <img
                src={task.assignedTo[0].photo || `https://i.pravatar.cc/40?u=${task.assignedTo[0]._id || 0}`}
                alt={task.assignedTo[0].name || "User"}
                className="w-5 h-5 rounded-full border border-yellow-400 object-cover flex-shrink-0"
                title={task.assignedTo[0].name || task.assignedTo[0].email || "Unknown"}
              />
              <span className="text-[10px] truncate ml-1" title={task.assignedTo.map(u => u.name || u.email).join(", ")}>
                {task.assignedTo[0].name || task.assignedTo[0].email || "Unknown"}
                {task.assignedTo.length > 1 && ` +${task.assignedTo.length - 1}`}
              </span>
            </>
          ) : (
            <span className="text-blue-400 text-[10px] truncate">Unassigned</span>
          )}
        </div>
      </td>

      {/* Assigned By */}
      <td className="px-1.5 py-2 text-blue-300 text-[10px] truncate">
        {task.assignedBy?.name || "N/A"}
      </td>

      {/* Last Edited By */}
      <td className="px-1.5 py-2 text-[10px] truncate">
        {task.lastEditedBy ? (
          <div className="flex items-center gap-0.5">
            <div className="w-1.5 h-1.5 bg-orange-400 rounded-full flex-shrink-0"></div>
            <span className="text-orange-300 font-medium truncate" title={`Last edited by ${task.lastEditedBy.name || task.lastEditedBy.email || 'Unknown'}`}>
              {task.lastEditedBy.name || task.lastEditedBy.email || 'Unknown'}
            </span>
          </div>
        ) : (
          <span className="text-gray-500 italic" title="Task has not been edited since creation">Original</span>
        )}
      </td>

      {/* Due Date */}
      <td className="px-1.5 py-2 text-blue-200 text-[10px] truncate">
        {task.dueDate || "No due date"}
      </td>

      {/* Completed At */}
      <td className="px-1.5 py-2 text-blue-200 text-[10px] truncate">
        {task.completedAt || "—"}
      </td>

      {/* Priority */}
      <td className="px-1.5 py-2 truncate">
        <span
          className={`px-1.5 py-0.5 rounded-full text-[10px] font-semibold whitespace-nowrap ${
            priorityColors[task.priority] || "bg-gray-500 text-gray-100"
          }`}
        >
          {task.priority || "N/A"}
        </span>
      </td>

      {/* Status */}
      <td className="px-1.5 py-2 truncate">
        <span
          className={`px-1.5 py-0.5 rounded-full text-[10px] font-semibold whitespace-nowrap ${
            statusColors[task.status] || "bg-gray-500 text-gray-100"
          }`}
        >
          {task.status || "N/A"}
        </span>
      </td>

      {/* Actions */}
      <td className="px-1.5 py-2 relative">
        <div className="flex gap-0.5 items-center justify-center flex-nowrap">
          {ACTIONS.map((btn, idx) => (
            <div key={btn.key} className="relative flex-shrink-0">
              <button
                type="button"
                onClick={
                  btn.key === "view"
                    ? onView
                    : btn.key === "edit"
                    ? onEdit
                    : btn.key === "delete"
                    ? onDelete
                    : toggleRemarks
                }
                className={`rounded ${btn.color} hover:bg-white/10 transition flex items-center justify-center`}
                style={{ width: 20, height: 20 }}
                onMouseEnter={(e) => handleIconMouseEnter(idx, e)}
                onMouseLeave={handleIconMouseLeave}
              >
                <btn.icon size={12} />
              </button>

              {/* Inline tooltip */}
              {showTooltip === idx && (
                <div
                  className="absolute z-50 bg-[#161c2c] text-blue-100 text-[10px] rounded px-1.5 py-0.5 shadow-lg -translate-x-1/2 whitespace-nowrap"
                  style={{ top: tooltipPos.top, left: tooltipPos.left }}
                >
                  {btn.tooltip}
                </div>
              )}
            </div>
          ))}

          {/* Reject button - only show for completed tasks */}
          {task.status === "completed" && (
            <div className="relative flex-shrink-0">
              <button
                type="button"
                onClick={() => onReject && onReject(task)}
                className="rounded text-red-500 hover:bg-white/10 transition flex items-center justify-center"
                style={{ width: 20, height: 20 }}
                onMouseEnter={(e) => handleIconMouseEnter(999, e)}
                onMouseLeave={handleIconMouseLeave}
              >
                <XCircle size={12} />
              </button>

              {/* Reject tooltip */}
              {showTooltip === 999 && (
                <div
                  className="absolute z-50 bg-[#161c2c] text-blue-100 text-[10px] rounded px-1.5 py-0.5 shadow-lg -translate-x-1/2 whitespace-nowrap"
                  style={{ top: tooltipPos.top, left: tooltipPos.left }}
                >
                  Reject Task
                </div>
              )}
            </div>
          )}
        </div>

        {/* Remarks Modal */}
        {remarksOpen && (
          <div className="absolute top-10 left-1/2 -translate-x-1/2 w-72 bg-[#161c2c] border border-[rgba(191,111,47,0.2)] rounded-xl z-30 p-3 shadow-2xl">
            <div className="max-h-40 overflow-y-auto mb-2">
              {remarks.length > 0 ? (
                remarks.map((r, i) => (
                  <div
                    key={i}
                    className="border-b border-gray-700 py-1 text-sm flex flex-col"
                  >
                    <span className="font-semibold text-blue-300">
                      {r.user?.name || r.user?.email || "Unknown"}:
                    </span>
                    <span>{r.comment}</span>
                  </div>
                ))
              ) : (
                <p className="text-gray-400 text-sm italic">No remarks yet.</p>
              )}
            </div>
            <div className="flex gap-2">
              <input
                type="text"
                className="flex-1 px-2 py-1 rounded bg-[#1b2233] text-blue-100 focus:outline-none focus:ring-2 focus:ring-[#bf6f2f]"
                placeholder="Add a remark..."
                value={comment}
                onChange={(e) => setComment(e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && handleAddRemark()}
              />
              <button
                onClick={handleAddRemark}
                disabled={loading}
                className="px-2 py-1 rounded bg-[#bf6f2f] hover:bg-[#bf6f2f]/90 text-xs"
              >
                {loading ? "..." : "Add"}
              </button>
            </div>
          </div>
        )}

      </td>
    </tr>
  );
};

export default TaskRow;
