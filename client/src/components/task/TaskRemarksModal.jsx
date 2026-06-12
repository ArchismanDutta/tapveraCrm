import React, { useState, useEffect, useRef } from "react";
import axios from "axios";
import dayjs from "dayjs";
import { FaCommentDots, FaTimes, FaLink, FaPaperPlane } from "react-icons/fa";

const API_BASE = import.meta.env.VITE_API_BASE || "http://localhost:5000";

// ── Render remark text with clickable URL highlights ──
const URL_REGEX = /(https?:\/\/[^\s]+)/g;

function RichText({ text }) {
  if (!text) return null;
  const parts = text.split(URL_REGEX);
  return (
    <>
      {parts.map((part, i) =>
        URL_REGEX.test(part) ? (
          <a
            key={i}
            href={part}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center gap-1 text-blue-400 underline underline-offset-2 hover:text-blue-300 break-all transition-colors"
            onClick={(e) => e.stopPropagation()}
          >
            <FaLink size={10} className="flex-shrink-0" />
            {part}
          </a>
        ) : (
          <span key={i}>{part}</span>
        )
      )}
    </>
  );
}

// ── Avatar initials ──
function Avatar({ name }) {
  const initials = (name || "?")
    .split(" ")
    .map((w) => w[0])
    .join("")
    .slice(0, 2)
    .toUpperCase();
  return (
    <div className="w-7 h-7 rounded-full bg-gradient-to-br from-indigo-500 to-blue-700 flex items-center justify-center flex-shrink-0 text-xs font-bold text-white">
      {initials}
    </div>
  );
}

export default function TaskRemarksModal({ task, onClose, onAddRemark }) {
  const [comment, setComment] = useState("");
  const [loading, setLoading] = useState(false);
  const [remarks, setRemarks] = useState(task.remarks || []);
  const modalRef = useRef(null);
  const bottomRef = useRef(null);
  const textareaRef = useRef(null);

  // Close on outside click
  useEffect(() => {
    const handleClickOutside = (e) => {
      if (modalRef.current && !modalRef.current.contains(e.target)) onClose();
    };
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, [onClose]);

  // Fetch remarks
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

  useEffect(() => { fetchRemarks(); }, [task._id]);
  useEffect(() => {
    const id = setInterval(fetchRemarks, 5000);
    return () => clearInterval(id);
  }, [task._id]);

  // Scroll to bottom when remarks change
  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [remarks.length]);

  // Auto-focus textarea
  useEffect(() => {
    setTimeout(() => textareaRef.current?.focus(), 50);
  }, []);

  const handleSubmit = async () => {
    if (!comment.trim()) return;
    setLoading(true);
    try {
      await onAddRemark(comment);
      setComment("");
      setRemarks((prev) => [
        ...prev,
        { comment, user: { name: "You" }, createdAt: new Date().toISOString(), _id: Date.now() },
      ]);
    } catch (err) {
      console.error("Failed to add remark:", err);
      alert("Could not add remark.");
    } finally {
      setLoading(false);
    }
  };

  const handleKeyDown = (e) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      handleSubmit();
    }
  };

  const hasUrl = (text) => URL_REGEX.test(text);
  // reset lastIndex since URL_REGEX is global
  const testUrl = (text) => { URL_REGEX.lastIndex = 0; return URL_REGEX.test(text); };

  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-[rgba(5,8,18,0.8)] backdrop-blur-md">
      <div
        ref={modalRef}
        className="w-full sm:max-w-lg bg-[#0f1525] rounded-t-2xl sm:rounded-2xl border border-[rgba(84,123,209,0.2)] shadow-2xl flex flex-col overflow-hidden"
        style={{ maxHeight: "90vh" }}
      >
        {/* ── Header ── */}
        <div className="flex items-center gap-3 px-5 py-4 border-b border-[rgba(84,123,209,0.12)] bg-[#0d1220]">
          <FaCommentDots className="text-orange-400 flex-shrink-0" size={16} />
          <div className="flex-1 min-w-0">
            <p className="text-xs text-gray-500 font-medium uppercase tracking-wider">Remarks</p>
            <h2 className="text-sm font-semibold text-white truncate">{task.title || "Task"}</h2>
          </div>
          <span className="px-2 py-0.5 text-xs rounded-full bg-orange-500/20 text-orange-300 border border-orange-500/30 font-medium">
            {remarks.length}
          </span>
          <button
            onClick={onClose}
            className="p-1.5 rounded-lg hover:bg-white/10 text-gray-400 hover:text-white transition"
          >
            <FaTimes size={14} />
          </button>
        </div>

        {/* ── Remarks list ── */}
        <div className="flex-1 overflow-y-auto px-4 py-3 space-y-3 scrollbar-thin scrollbar-thumb-[rgba(84,123,209,0.3)] scrollbar-track-transparent">
          {remarks.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-10 text-center">
              <FaCommentDots size={28} className="text-gray-600 mb-2" />
              <p className="text-gray-500 text-sm">No remarks yet.</p>
              <p className="text-gray-600 text-xs mt-1">Be the first to add one.</p>
            </div>
          ) : (
            remarks.map((r, idx) => {
              const isYou = r.user?.name === "You";
              const hasLink = testUrl(r.comment || "");
              return (
                <div
                  key={r._id || idx}
                  className={`flex gap-2.5 ${isYou ? "flex-row-reverse" : "flex-row"}`}
                >
                  {!isYou && <Avatar name={r.user?.name || r.user?.email} />}

                  <div className={`max-w-[80%] ${isYou ? "items-end" : "items-start"} flex flex-col gap-0.5`}>
                    {/* name + time */}
                    <div className={`flex items-center gap-1.5 text-xs ${isYou ? "flex-row-reverse" : ""}`}>
                      <span className="text-gray-400 font-medium">
                        {isYou ? "You" : (r.user?.name || r.user?.email || "Unknown")}
                      </span>
                      {r.createdAt && (
                        <span className="text-gray-600">
                          {dayjs(r.createdAt).format("DD MMM, hh:mm A")}
                        </span>
                      )}
                    </div>

                    {/* bubble */}
                    <div className={`relative rounded-2xl px-3.5 py-2.5 text-sm leading-relaxed break-words ${
                      isYou
                        ? "bg-[rgba(84,123,209,0.2)] border border-[rgba(84,123,209,0.3)] text-white rounded-tr-sm"
                        : "bg-[#161e33] border border-[rgba(84,123,209,0.1)] text-gray-200 rounded-tl-sm"
                    }`}>
                      <RichText text={r.comment || ""} />

                      {/* URL badge */}
                      {hasLink && (
                        <span className="inline-flex items-center gap-1 mt-1.5 px-2 py-0.5 rounded-full bg-blue-500/15 border border-blue-500/25 text-blue-400 text-xs">
                          <FaLink size={9} /> Contains link
                        </span>
                      )}
                    </div>
                  </div>
                </div>
              );
            })
          )}
          <div ref={bottomRef} />
        </div>

        {/* ── Input ── */}
        <div className="px-4 py-3 border-t border-[rgba(84,123,209,0.12)] bg-[#0d1220]">
          <div className="flex items-end gap-2">
            <textarea
              ref={textareaRef}
              className="flex-1 resize-none rounded-xl px-3.5 py-2.5 bg-[#161e33] border border-[rgba(84,123,209,0.2)] text-white text-sm placeholder-gray-600 focus:outline-none focus:border-[rgba(84,123,209,0.5)] focus:ring-1 focus:ring-[rgba(84,123,209,0.25)] transition scrollbar-thin scrollbar-thumb-[rgba(84,123,209,0.3)] scrollbar-track-transparent"
              value={comment}
              onChange={(e) => setComment(e.target.value)}
              onKeyDown={handleKeyDown}
              placeholder="Add a remark… (Enter to send, Shift+Enter for newline)"
              rows={2}
              disabled={loading}
            />
            <button
              onClick={handleSubmit}
              disabled={loading || !comment.trim()}
              className="flex-shrink-0 p-3 rounded-xl bg-orange-600 hover:bg-orange-500 disabled:opacity-40 disabled:cursor-not-allowed text-white transition shadow-lg shadow-orange-900/30"
            >
              <FaPaperPlane size={14} />
            </button>
          </div>
          <p className="text-gray-600 text-xs mt-1.5 pl-1">Enter to send · Shift+Enter for new line</p>
        </div>
      </div>
    </div>
  );
}
