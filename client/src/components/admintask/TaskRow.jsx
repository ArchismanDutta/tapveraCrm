import React, { useState, useRef, useEffect } from "react";
import ReactDOM from "react-dom";
import { Eye, Trash2, Edit3, MessageCircle } from "lucide-react";
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
  const [remarksOpen, setRemarksOpen] = useState(false);
  const [remarks, setRemarks] = useState(task.remarks || []);
  const [comment, setComment] = useState("");
  const [loading, setLoading] = useState(false);
  const rowRef = useRef(null);

  const API_BASE = import.meta.env.VITE_API_BASE || "http://localhost:5000";

  const toggleRemarks = async () => {
    if (!remarksOpen) {
      // fetch latest remarks
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

  // close remarks if clicked outside
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
    <tr ref={rowRef} className="border-b text-sm hover:bg-[rgba(255,128,0,0.1)] transition-colors duration-200 text-blue-100 relative">
      <td className="p-3 font-medium">{task.title || "Untitled Task"}</td>
      <td className="p-3 flex flex-wrap items-center gap-2">
        {Array.isArray(task.assignedTo) && task.assignedTo.length > 0 ? (
          task.assignedTo.map((user, idx) => (
            <div key={user._id || idx} className="flex items-center gap-1">
              <img
                src={`https://i.pravatar.cc/40?u=${user._id || idx}`}
                alt={user.name || "User"}
                className="w-7 h-7 rounded-full border-2 border-yellow-400 object-cover"
              />
              <span className="text-xs sm:text-sm">{user.name || user.email || "Unknown"}</span>
            </div>
          ))
        ) : (
          <span className="text-blue-400 text-xs sm:text-sm">Unassigned</span>
        )}
      </td>
      <td className="p-3 text-blue-300 text-xs sm:text-sm">{task.dueDate || "No due date"}</td>
      <td className="p-3">
        <span className={`px-2 py-0.5 rounded-full text-xs font-semibold ${priorityColors[task.priority] || "bg-gray-500 text-gray-100"}`}>
          {task.priority || "N/A"}
        </span>
      </td>
      <td className="p-3">
        <span className={`px-2 py-0.5 rounded-full text-xs font-semibold ${statusColors[task.status] || "bg-gray-500 text-gray-100"}`}>
          {task.status || "N/A"}
        </span>
      </td>
      <td className="p-3 flex gap-2 justify-center">
        <button onClick={onView} className="p-1.5 rounded-lg text-blue-400 hover:bg-blue-900" title="View Task"><Eye size={16} /></button>
        <button onClick={onEdit} className="p-1.5 rounded-lg text-green-400 hover:bg-green-900" title="Edit Task"><Edit3 size={16} /></button>
        <button onClick={onDelete} className="p-1.5 rounded-lg text-red-500 hover:bg-red-900" title="Delete Task"><Trash2 size={16} /></button>
        <button onClick={toggleRemarks} className="p-1.5 rounded-lg text-yellow-400 hover:bg-yellow-900" title="Remarks"><MessageCircle size={16} /></button>
      </td>

      {remarksOpen && (
        <tr className="absolute left-0 top-full w-full bg-[#161c2c] border border-[rgba(191,111,47,0.2)] rounded-xl z-20">
          <td colSpan={6} className="p-3">
            <div className="max-h-40 overflow-y-auto mb-2">
              {remarks.length > 0 ? remarks.map((r, i) => (
                <div key={i} className="border-b border-gray-700 py-1 text-sm">
                  <span className="font-semibold">{r.user?.name || r.user?.email || "Unknown"}:</span> {r.comment}
                </div>
              )) : <p className="text-gray-400 text-sm italic">No remarks yet.</p>}
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
              <button onClick={handleAddRemark} disabled={loading} className="px-3 py-1 rounded bg-[#bf6f2f] hover:bg-[#bf6f2f]/90">
                {loading ? "Adding..." : "Add"}
              </button>
            </div>
          </td>
        </tr>
      )}
    </tr>
  );
};

export default TaskRow;
