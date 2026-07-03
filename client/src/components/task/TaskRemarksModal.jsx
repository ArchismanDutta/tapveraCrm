import React, { useState, useEffect, useRef, useCallback } from "react";
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
      {parts.map((part, i) => {
        URL_REGEX.lastIndex = 0;
        return URL_REGEX.test(part) ? (
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
        );
      })}
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
    <div className="flex h-7 w-7 flex-shrink-0 items-center justify-center rounded-full bg-blue-600 text-xs font-semibold text-white">
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
  const fetchRemarks = useCallback(async () => {
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
  }, [task._id]);

  useEffect(() => { fetchRemarks(); }, [fetchRemarks]);
  useEffect(() => {
    const id = setInterval(fetchRemarks, 5000);
    return () => clearInterval(id);
  }, [fetchRemarks]);

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

  const testUrl = (text) => { URL_REGEX.lastIndex = 0; return URL_REGEX.test(text); };

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center bg-slate-950/55 backdrop-blur-sm sm:items-center">
      <div
        ref={modalRef}
        className="flex w-full flex-col overflow-hidden rounded-t-2xl border border-slate-200 bg-white shadow-2xl dark:border-white/10 dark:bg-[#12151c] sm:max-w-lg sm:rounded-2xl"
        style={{ maxHeight: "90vh" }}
      >
        {/* ── Header ── */}
        <div className="flex items-center gap-3 border-b border-slate-100 px-5 py-4 dark:border-white/[0.07]">
          <FaCommentDots className="flex-shrink-0 text-blue-600 dark:text-blue-400" size={16} />
          <div className="flex-1 min-w-0">
            <p className="text-xs font-medium uppercase tracking-wider text-slate-400">Comments</p>
            <h2 className="truncate text-sm font-semibold text-slate-900 dark:text-slate-100">{task.title || "Task"}</h2>
          </div>
          <span className="rounded-full bg-slate-100 px-2 py-0.5 text-xs font-medium text-slate-600 dark:bg-white/[0.07] dark:text-slate-300">
            {remarks.length}
          </span>
          <button
            onClick={onClose}
            className="rounded-lg p-1.5 text-slate-400 transition hover:bg-slate-100 hover:text-slate-800 dark:hover:bg-white/[0.07] dark:hover:text-white"
          >
            <FaTimes size={14} />
          </button>
        </div>

        {/* ── Remarks list ── */}
        <div className="flex-1 space-y-3 overflow-y-auto px-4 py-3">
          {remarks.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-10 text-center">
              <FaCommentDots size={26} className="mb-2 text-slate-300 dark:text-slate-600" />
              <p className="text-sm text-slate-500 dark:text-slate-400">No comments yet.</p>
              <p className="mt-1 text-xs text-slate-400 dark:text-slate-500">Start the conversation here.</p>
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
                      <span className="font-medium text-slate-500 dark:text-slate-400">
                        {isYou ? "You" : (r.user?.name || r.user?.email || "Unknown")}
                      </span>
                      {r.createdAt && (
                        <span className="text-slate-400 dark:text-slate-500">
                          {dayjs(r.createdAt).format("DD MMM, hh:mm A")}
                        </span>
                      )}
                    </div>

                    {/* bubble */}
                    <div className={`relative rounded-2xl px-3.5 py-2.5 text-sm leading-relaxed break-words ${
                      isYou
                        ? "rounded-tr-sm border border-blue-200 bg-blue-50 text-slate-800 dark:border-blue-500/20 dark:bg-blue-500/10 dark:text-slate-100"
                        : "rounded-tl-sm border border-slate-200 bg-slate-50 text-slate-700 dark:border-white/10 dark:bg-white/[0.04] dark:text-slate-200"
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
        <div className="border-t border-slate-100 px-4 py-3 dark:border-white/[0.07]">
          <div className="flex items-end gap-2">
            <textarea
              ref={textareaRef}
              className="flex-1 resize-none rounded-xl border border-slate-200 bg-slate-50 px-3.5 py-2.5 text-sm text-slate-800 outline-none transition placeholder:text-slate-400 focus:border-blue-500 focus:bg-white focus:ring-2 focus:ring-blue-500/15 dark:border-white/10 dark:bg-white/[0.04] dark:text-slate-100 dark:placeholder:text-slate-500"
              value={comment}
              onChange={(e) => setComment(e.target.value)}
              onKeyDown={handleKeyDown}
              placeholder="Add a comment..."
              rows={2}
              disabled={loading}
            />
            <button
              onClick={handleSubmit}
              disabled={loading || !comment.trim()}
              className="flex-shrink-0 rounded-xl bg-blue-600 p-3 text-white transition hover:bg-blue-700 disabled:cursor-not-allowed disabled:opacity-40"
            >
              <FaPaperPlane size={14} />
            </button>
          </div>
          <p className="mt-1.5 pl-1 text-xs text-slate-400 dark:text-slate-500">Enter to send · Shift+Enter for a new line</p>
        </div>
      </div>
    </div>
  );
}
