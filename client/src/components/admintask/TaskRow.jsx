import React, { useState, useRef } from "react";
import ReactDOM from "react-dom";
import { Eye, Trash2, Edit3 } from "lucide-react";

const priorityColors = {
  High: "bg-red-700 text-red-100 border border-red-600",
  Medium: "bg-yellow-500 text-yellow-900 border border-yellow-400",
  Low: "bg-green-600 text-green-100 border border-green-500",
};

const statusColors = {
  pending: "bg-blue-600 text-blue-100 border border-blue-500",
  "in-progress": "bg-purple-600 text-purple-100 border border-purple-500",
  completed: "bg-green-600 text-green-100 border border-green-500",
};

const avatarSmall = "w-5 h-5 rounded-full border-2 border-yellow-400";

// helper: truncate description to word limit
const truncateWords = (text, limit = 30) => {
  if (!text) return "";
  const words = text.split(/\s+/);
  if (words.length <= limit) return text;
  return words.slice(0, limit).join(" ") + "…";
};

const TaskRow = ({ task, onView, onEdit, onDelete }) => {
  const [showTooltip, setShowTooltip] = useState(false);
  const [tooltipPosition, setTooltipPosition] = useState({ top: 0, left: 0 });
  const titleRef = useRef(null);

  const normalizedStatus = (task.status || "pending")
    .toLowerCase()
    .replace(/\s+/g, "-");

  const formatStatusText = (status) =>
    status.replace(/-/g, " ").replace(/\b\w/g, (c) => c.toUpperCase());

  // Show tooltip with smart positioning
  const handleMouseEnter = () => {
    if (titleRef.current) {
      const rect = titleRef.current.getBoundingClientRect();
      const tooltipWidth = 280; // estimated tooltip width
      let left = rect.left + window.scrollX;

      if (left + tooltipWidth > window.innerWidth - 20) {
        left = window.innerWidth - tooltipWidth - 20;
      }

      setTooltipPosition({
        top: rect.bottom + window.scrollY + 10,
        left,
      });
    }
    setShowTooltip(true);
  };

  const handleMouseLeave = () => setShowTooltip(false);

  return (
    <tr className="hover:bg-[rgba(255,128,0,0.06)] text-xs">
      {/* Task Title with tooltip */}
      <td className="p-2 font-medium max-w-[220px] truncate cursor-pointer relative">
        <div
          ref={titleRef}
          onMouseEnter={handleMouseEnter}
          onMouseLeave={handleMouseLeave}
        >
          {task.title}

          {showTooltip &&
            task.description &&
            ReactDOM.createPortal(
              <div
                className="absolute z-50"
                style={{
                  top: tooltipPosition.top + "px",
                  left: tooltipPosition.left + "px",
                  maxWidth: "280px",
                }}
              >
                <div
                  className="relative p-3 rounded-2xl shadow-lg border border-white/30 
                             bg-white/20 backdrop-blur-md text-black font-medium text-sm"
                  style={{
                    wordWrap: "break-word",
                    overflowWrap: "break-word",
                    whiteSpace: "normal",
                    boxShadow: "0 4px 20px rgba(255,165,0,0.3)", // warm glow
                  }}
                >
                  {/* Tooltip Header */}
                  <div className="flex items-center gap-2 mb-1">
                    <span role="img" aria-label="info" className="text-xl">
                      💡
                    </span>
                    <span className="font-bold text-orange-600">
                      Task Description
                    </span>
                  </div>

                  {/* Tooltip Content (limited to 30 words) */}
                  <div className="leading-snug italic">
                    {truncateWords(task.description, 30)}
                  </div>
                </div>
              </div>,
              document.body
            )}
        </div>
      </td>

      {/* Assigned To */}
      <td className="p-2 max-w-[140px]">
        <div className="flex flex-col gap-1">
          {Array.isArray(task.assignedTo) && task.assignedTo.length > 0 ? (
            task.assignedTo.slice(0, 3).map((user, idx) => (
              <div key={idx} className="flex items-center gap-2">
                <img
                  src={`https://i.pravatar.cc/32?u=${user._id || user}`}
                  alt={user.name || "User"}
                  className={avatarSmall}
                  onError={(e) => {
                    e.target.onerror = null;
                    e.target.src = "https://i.pravatar.cc/32";
                  }}
                />
                <span>{user.name || user.email || "Unknown"}</span>
              </div>
            ))
          ) : (
            <span className="text-blue-400">Unassigned</span>
          )}
          {task.assignedTo.length > 3 && (
            <span className="text-xs text-blue-300">
              +{task.assignedTo.length - 3} more
            </span>
          )}
        </div>
      </td>

      {/* Assigned By */}
      <td className="p-2 max-w-[140px]">
        {task.assignedBy ? (
          <div className="flex items-center gap-2">
            <img
              src={`https://i.pravatar.cc/32?u=${task.assignedBy._id}`}
              alt={task.assignedBy.name || "User"}
              className={avatarSmall}
              onError={(e) => {
                e.target.onerror = null;
                e.target.src = "https://i.pravatar.cc/32";
              }}
            />
            <span>
              {task.assignedBy.name || task.assignedBy.email || "Unknown"}
            </span>
          </div>
        ) : (
          <span className="text-blue-400 italic">Unknown</span>
        )}
      </td>

      {/* Due Date & Time */}
      <td className="p-2 whitespace-nowrap max-w-[110px]">{task.dueDate}</td>

      {/* Priority */}
      <td className="p-2">
        <span
          className={`px-2 py-0.5 rounded text-xs font-semibold ${
            priorityColors[task.priority] ||
            "bg-gray-600 text-gray-100 border border-gray-500"
          }`}
        >
          {task.priority}
        </span>
      </td>

      {/* Status */}
      <td className="p-2">
        <span
          className={`px-2 py-0.5 rounded text-xs font-semibold whitespace-nowrap ${
            statusColors[normalizedStatus] ||
            "bg-gray-600 text-gray-100 border border-gray-500"
          }`}
          title={formatStatusText(normalizedStatus)}
        >
          {formatStatusText(normalizedStatus)}
        </span>
      </td>

      {/* Actions */}
      <td className="p-2 flex gap-1 justify-center">
        <button
          onClick={onView}
          className="p-1 rounded text-blue-400 hover:bg-blue-900"
        >
          <Eye size={14} />
        </button>
        <button
          onClick={onEdit}
          className="p-1 rounded text-green-400 hover:bg-green-900"
        >
          <Edit3 size={14} />
        </button>
        <button
          onClick={onDelete}
          className="p-1 rounded text-red-500 hover:bg-red-900"
        >
          <Trash2 size={14} />
        </button>
      </td>
    </tr>
  );
};

export default TaskRow;
