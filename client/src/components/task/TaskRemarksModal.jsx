import React, { useState, useEffect, useRef } from "react";
import axios from "axios";

export default function TaskRemarksModal({ task, onClose, onAddRemark }) {
  const [comment, setComment] = useState("");
  const [loading, setLoading] = useState(false);
  const [remarks, setRemarks] = useState([]);
  const modalRef = useRef(null);

  const API_BASE = import.meta.env.VITE_API_BASE || "http://localhost:5000";

  // Close modal on outside click
  useEffect(() => {
    const handleClickOutside = (event) => {
      if (modalRef.current && !modalRef.current.contains(event.target)) {
        onClose();
      }
    };
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, [onClose]);

  // Fetch latest remarks
  const fetchRemarks = async () => {
    try {
      const token = localStorage.getItem("token");
      if (!token) return;

      const res = await axios.get(`${API_BASE}/api/tasks/${task._id}`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (res.data?.remarks) setRemarks(res.data.remarks);
    } catch (err) {
      console.error("Failed to fetch remarks:", err);
    }
  };

  // Initial fetch when modal opens
  useEffect(() => {
    fetchRemarks();
  }, [task._id]);

  // Polling every 5 seconds for live updates
  useEffect(() => {
    const intervalId = setInterval(fetchRemarks, 5000);
    return () => clearInterval(intervalId);
  }, [task._id]);

  // Add remark
  const handleSubmit = async () => {
    if (!comment.trim()) return;
    setLoading(true);
    try {
      await onAddRemark(comment); // call parent function to add remark in backend
      setComment("");

      // Optimistically add remark to local state
      setRemarks((prev) => [
        ...prev,
        { comment, user: { name: "You" }, _id: Date.now() },
      ]);
    } catch (err) {
      console.error("Failed to add remark:", err);
      alert("Could not add remark.");
    } finally {
      setLoading(false);
    }
  };

  // Submit on Enter key (without shift)
  const handleKeyDown = (e) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      handleSubmit();
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-[rgba(22,28,48,0.75)] backdrop-blur-md">
      <div
        ref={modalRef}
        className="bg-[#161c2c] rounded-xl p-4 text-white shadow-lg min-w-[250px] max-w-sm border border-[rgba(191,111,47,0.2)]"
      >
        <h2 className="text-lg font-bold mb-2">{task.title || "Task"} - Remarks</h2>

        {/* Remarks list */}
        <div className="space-y-2 max-h-48 overflow-y-auto scrollbar-thin scrollbar-thumb-[#bf6f2f]/50 scrollbar-track-[#1b2233] p-2 bg-[#1b2233] rounded">
          {remarks.length > 0 ? (
            remarks.map((r) => (
              <div key={r._id} className="border-b border-gray-700 py-1 text-sm">
                <span className="font-semibold">
                  {r.user?.name || r.user?.email || "Unknown"}:
                </span>{" "}
                {r.comment || ""}
              </div>
            ))
          ) : (
            <p className="text-gray-400 text-sm italic">No remarks yet.</p>
          )}
        </div>

        {/* Add new remark */}
        <textarea
          className="w-full p-2 rounded bg-[#1b2233] text-blue-100 placeholder-blue-400 focus:outline-none focus:ring-2 focus:ring-[#bf6f2f] transition mt-2"
          value={comment}
          onChange={(e) => setComment(e.target.value)}
          onKeyDown={handleKeyDown}
          placeholder="Add a remark..."
          rows={3}
          disabled={loading}
        />

        {/* Buttons */}
        <div className="flex justify-end mt-2 gap-2">
          <button
            onClick={onClose}
            className="px-3 py-1 rounded-lg border border-[#bf6f2f] hover:bg-[#bf6f2f]/20 transition"
          >
            Close
          </button>
          <button
            onClick={handleSubmit}
            className="px-3 py-1 rounded-lg bg-[#bf6f2f] hover:bg-[#bf6f2f]/90 transition disabled:opacity-50"
            disabled={loading}
          >
            {loading ? "Adding..." : "Add Remark"}
          </button>
        </div>
      </div>
    </div>
  );
}
