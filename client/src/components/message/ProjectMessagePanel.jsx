import React, { useState, useEffect, useRef, useCallback } from "react";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import rehypeRaw from "rehype-raw";
import {
  Filter,
  X as XCircle,
  Copy,
  Check,
  Reply as ReplyIcon,
  Image as ImageIcon,
  File as FileIcon,
  Video,
  Download,
  Search,
  Smile,
  Paperclip,
  Type,
  Send,
  Sparkles,
  Plus,
} from "lucide-react";
import MediaLightbox from "../common/MediaLightbox";
import MessageDateSeparator from "./MessageDateSeparator";
import MessageStatus from "./MessageStatus";
import TypingIndicator from "./TypingIndicator";
import { useWebSocketContext } from "../../contexts/WebSocketContext";

const API_BASE = import.meta.env.VITE_API_BASE || "http://localhost:5000";

const commonEmojis = ["👍", "❤️", "😂", "😮", "😢", "🙏", "🔥", "✅"];

// ─── Main component ──────────────────────────────────────────────────────────
// Styling here is intentionally kept in lockstep with the admin-facing chat
// (the inline "Chat" tab in pages/ProjectDetailPage.jsx) — same light/dark
// theme tokens, same teal accent, same input layout — so an employee and an
// admin looking at the same project conversation see the same UI, just
// through two different page shells (EmployeePortal vs ProjectDetailPage).
const ProjectMessagePanel = ({ projectId, currentUser }) => {
  // ── state ──
  const [messages, setMessages] = useState([]);
  const [input, setInput] = useState("");
  const [selectedFiles, setSelectedFiles] = useState([]);
  const [replyingTo, setReplyingTo] = useState(null);
  const [messageSearchTerm, setMessageSearchTerm] = useState("");
  const [searchSender, setSearchSender] = useState("");
  const [dateFilter, setDateFilter] = useState({ start: "", end: "" });
  const [showFilters, setShowFilters] = useState(false);
  const [showFormatting, setShowFormatting] = useState(false);
  const [showComposerTools, setShowComposerTools] = useState(false);
  const [showEmojiPicker, setShowEmojiPicker] = useState(null);
  const [copiedText, setCopiedText] = useState(null);
  const [lightboxMedia, setLightboxMedia] = useState(null);
  const [lightboxIndex, setLightboxIndex] = useState(0);
  const [lightboxAllMedia, setLightboxAllMedia] = useState([]);
  const [showSummaryModal, setShowSummaryModal] = useState(false);
  const [summary, setSummary] = useState("");
  const [summaryLoading, setSummaryLoading] = useState(false);
  const [summaryDays, setSummaryDays] = useState(7);
  const [typingUsers, setTypingUsers] = useState([]);

  // ── refs ──
  const chatEndRef = useRef(null);
  const fileInputRef = useRef(null);
  const textareaRef = useRef(null);
  const emojiPickerRef = useRef(null);
  const prevLengthRef = useRef(0);
  const typingTimeoutRef = useRef(null);

  // ── shared real-time connection (see WebSocketContext) ──
  const {
    isConnected: wsConnected,
    joinProject,
    leaveProject,
    sendProjectMessage,
    sendProjectTyping,
    sendProjectStopTyping,
  } = useWebSocketContext();

  // ── resolve current user ──
  const user = currentUser || JSON.parse(localStorage.getItem("user") || "{}");

  // ── helpers ──
  const getSenderName = (sentBy) => {
    if (!sentBy) return "Unknown";
    if (typeof sentBy === "object")
      return sentBy.name || sentBy.clientName || "Unknown";
    return "Unknown";
  };

  const isOwn = (msg) => {
    const id =
      typeof msg.sentBy === "object" ? msg.sentBy?._id : msg.sentBy;
    return String(id) === String(user._id);
  };

  const getFileIcon = (fileType) => {
    if (fileType === "image") return <ImageIcon className="h-4 w-4 text-blue-400" />;
    if (fileType === "video") return <Video className="h-4 w-4 text-purple-400" />;
    return <FileIcon className="h-4 w-4 text-slate-400" />;
  };

  const scrollToMessage = (id) => {
    const el = document.getElementById(`pmsg-${id}`);
    if (!el) return;
    el.scrollIntoView({ behavior: "smooth", block: "center" });
    el.classList.add("bg-teal-100", "dark:bg-teal-900/30");
    setTimeout(() => el.classList.remove("bg-teal-100", "dark:bg-teal-900/30"), 1500);
  };

  const copyToClipboard = (text) => {
    navigator.clipboard.writeText(text || "");
    setCopiedText(text);
    setTimeout(() => setCopiedText(null), 2000);
  };

  const removeFile = (idx) =>
    setSelectedFiles((prev) => prev.filter((_, i) => i !== idx));

  const handleFileSelect = (e) => {
    const files = Array.from(e.target.files || []);
    setSelectedFiles((prev) => [...prev, ...files].slice(0, 5));
    e.target.value = "";
  };

  // ── formatting helpers ──
  const wrapSelection = (before, after = before) => {
    const el = textareaRef.current;
    if (!el) return;
    const s = el.selectionStart;
    const e2 = el.selectionEnd;
    const sel = input.substring(s, e2);
    setInput(input.substring(0, s) + before + sel + after + input.substring(e2));
    setTimeout(() => {
      el.selectionStart = el.selectionEnd = s + before.length + sel.length + after.length;
      el.focus();
    }, 0);
  };
  const formatBold = () => wrapSelection("**");
  const formatItalic = () => wrapSelection("*");
  const formatStrike = () => wrapSelection("~~");
  const formatCode = () => wrapSelection("`");
  const formatHeading = () => setInput((p) => "## " + p);
  const formatBullet = () => setInput((p) => p + "\n- ");
  const formatNumbered = () => setInput((p) => p + "\n1. ");

  // ── typing indicator ──
  const sendTypingIndicator = () => {
    if (!wsConnected) return;
    sendProjectTyping(projectId, user?.name || "User");
    if (typingTimeoutRef.current) clearTimeout(typingTimeoutRef.current);
    typingTimeoutRef.current = setTimeout(() => {
      stopTypingIndicator();
    }, 3000);
  };

  const stopTypingIndicator = () => {
    if (!wsConnected) return;
    sendProjectStopTyping(projectId);
  };

  const handleKeyDown = (e) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
    if (e.ctrlKey || e.metaKey) {
      if (e.key === "b") { e.preventDefault(); formatBold(); }
      if (e.key === "i") { e.preventDefault(); formatItalic(); }
      if (e.key === "u") { e.preventDefault(); formatStrike(); }
      if (e.key === "e" || e.key === "k") { e.preventDefault(); formatCode(); }
      if (e.key === "d") { e.preventDefault(); formatHeading(); }
      if (e.key === "l" && !e.shiftKey) { e.preventDefault(); formatBullet(); }
      if (e.key === "l" && e.shiftKey) { e.preventDefault(); formatNumbered(); }
    }
  };

  // ── API ──
  const fetchMessages = useCallback(async () => {
    if (!projectId) return;
    try {
      const token = localStorage.getItem("token");
      const params = new URLSearchParams();
      if (messageSearchTerm) params.append("search", messageSearchTerm);
      if (searchSender) params.append("senderName", searchSender);
      if (dateFilter.start) params.append("startDate", dateFilter.start);
      if (dateFilter.end) params.append("endDate", dateFilter.end);
      const qs = params.toString();
      const resp = await fetch(
        `${API_BASE}/api/projects/${projectId}/messages${qs ? `?${qs}` : ""}`,
        { headers: { Authorization: `Bearer ${token}` } }
      );
      const data = await resp.json();
      setMessages(data.messages || data);
    } catch (err) {
      console.error("fetchMessages error:", err);
    }
  }, [projectId, messageSearchTerm, searchSender, dateFilter]);

  const handleSend = async () => {
    if (!input.trim() && selectedFiles.length === 0) return;
    try {
      const token = localStorage.getItem("token");
      const formData = new FormData();
      formData.append("message", input || "(File attachment)");
      formData.append("sentBy", user._id);
      formData.append("senderType", user.role || "employee");
      if (replyingTo) formData.append("replyTo", replyingTo._id);
      selectedFiles.forEach((f) => formData.append("files", f));

      const resp = await fetch(
        `${API_BASE}/api/projects/${projectId}/messages`,
        {
          method: "POST",
          headers: { Authorization: `Bearer ${token}` },
          body: formData,
        }
      );
      const messageData = await resp.json();

      sendProjectMessage(projectId, messageData);
      stopTypingIndicator();
      if (typingTimeoutRef.current) clearTimeout(typingTimeoutRef.current);

      await fetchMessages();
      setInput("");
      setSelectedFiles([]);
      setReplyingTo(null);
    } catch (err) {
      console.error("Send error:", err);
    }
  };

  const handleReaction = async (msgId, emoji) => {
    try {
      const token = localStorage.getItem("token");
      await fetch(
        `${API_BASE}/api/projects/${projectId}/messages/${msgId}/react`,
        {
          method: "POST",
          headers: {
            Authorization: `Bearer ${token}`,
            "Content-Type": "application/json",
          },
          body: JSON.stringify({ emoji }),
        }
      );
      setShowEmojiPicker(null);
      await fetchMessages();
    } catch (err) {
      console.error("Reaction error:", err);
    }
  };

  const handleSummarize = async () => {
    setSummaryLoading(true);
    setShowSummaryModal(true);
    try {
      const token = localStorage.getItem("token");
      const resp = await fetch(
        `${API_BASE}/api/projects/${projectId}/messages/summarize`,
        {
          method: "POST",
          headers: {
            Authorization: `Bearer ${token}`,
            "Content-Type": "application/json",
          },
          body: JSON.stringify({ days: summaryDays }),
        }
      );
      const data = await resp.json();
      setSummary(data.summary || "No summary available.");
    } catch {
      setSummary("Failed to generate summary.");
    } finally {
      setSummaryLoading(false);
    }
  };

  const clearFilters = () => {
    setMessageSearchTerm("");
    setSearchSender("");
    setDateFilter({ start: "", end: "" });
  };

  // ── effects ──
  useEffect(() => {
    fetchMessages();
  }, [fetchMessages]);

  // Auto-scroll on new messages only
  useEffect(() => {
    if (messages.length > prevLengthRef.current) {
      chatEndRef.current?.scrollIntoView({ behavior: "smooth" });
    }
    prevLengthRef.current = messages.length;
  }, [messages]);

  // Real-time — join this project's room on the shared socket connection
  // (see WebSocketContext) instead of opening a second connection of its own.
  useEffect(() => {
    if (!projectId) return undefined;

    joinProject(projectId);

    const handleProjectMessage = (event) => {
      const data = event.detail || {};
      if (data.projectId === projectId) {
        fetchMessages();
      }
    };

    const handleTyping = (event) => {
      const data = event.detail || {};
      if (data.projectId !== projectId || data.userId === user._id) return;
      setTypingUsers((prev) => {
        const exists = prev.some((u) => u.userId === data.userId);
        if (!exists) return [...prev, { userId: data.userId, userName: data.userName }];
        return prev;
      });
      setTimeout(() => {
        setTypingUsers((prev) => prev.filter((u) => u.userId !== data.userId));
      }, 3000);
    };

    const handleStopTyping = (event) => {
      const data = event.detail || {};
      if (data.projectId !== projectId) return;
      setTypingUsers((prev) => prev.filter((u) => u.userId !== data.userId));
    };

    // Real-time read receipts — fired when anyone (any tab/user) marks a
    // message read via the intersection observer below, so this message's
    // checkmark advances to "read" without needing a refetch.
    const handleMessageRead = (event) => {
      const data = event.detail || {};
      if (data.projectId !== projectId) return;
      setMessages((prevMessages) =>
        prevMessages.map((msg) =>
          msg._id === data.messageId ? { ...msg, status: "read" } : msg
        )
      );
    };

    window.addEventListener("project-message", handleProjectMessage);
    window.addEventListener("project-typing", handleTyping);
    window.addEventListener("project-stop-typing", handleStopTyping);
    window.addEventListener("project-message-read", handleMessageRead);
    return () => {
      leaveProject(projectId);
      window.removeEventListener("project-message", handleProjectMessage);
      window.removeEventListener("project-typing", handleTyping);
      window.removeEventListener("project-stop-typing", handleStopTyping);
      window.removeEventListener("project-message-read", handleMessageRead);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [projectId, joinProject, leaveProject, fetchMessages]);

  // Intersection Observer for read receipts — marks each non-own message as
  // read (POST .../messages/:messageId/read) once it's at least 50% visible,
  // mirroring ProjectDetailPage.jsx's admin-side behavior exactly.
  useEffect(() => {
    const observer = new IntersectionObserver(
      (entries) => {
        entries.forEach(async (entry) => {
          if (entry.isIntersecting) {
            const messageId = entry.target.getAttribute("data-message-id");
            const messageOwnerId = entry.target.getAttribute("data-owner-id");

            if (messageId && messageOwnerId !== String(user._id)) {
              try {
                const token = localStorage.getItem("token");
                await fetch(
                  `${API_BASE}/api/projects/${projectId}/messages/${messageId}/read`,
                  {
                    method: "POST",
                    headers: { Authorization: `Bearer ${token}` },
                  }
                );
              } catch (error) {
                console.error("Error marking message as read:", error);
              }
            }
          }
        });
      },
      { threshold: 0.5 }
    );

    const messageElements = document.querySelectorAll("[data-message-id]");
    messageElements.forEach((el) => observer.observe(el));

    return () => observer.disconnect();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [messages, projectId]);

  // Close emoji picker on outside click
  useEffect(() => {
    const handler = (e) => {
      if (emojiPickerRef.current && !emojiPickerRef.current.contains(e.target)) {
        setShowEmojiPicker(null);
      }
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, []);

  // ── local filtering (instant UI feedback) ──
  const filteredMessages = messages.filter((msg) => {
    if (
      messageSearchTerm &&
      !msg.message?.toLowerCase().includes(messageSearchTerm.toLowerCase())
    )
      return false;
    if (searchSender) {
      const name = getSenderName(msg.sentBy).toLowerCase();
      if (!name.includes(searchSender.toLowerCase())) return false;
    }
    if (dateFilter.start && new Date(msg.createdAt) < new Date(dateFilter.start))
      return false;
    if (
      dateFilter.end &&
      new Date(msg.createdAt) > new Date(dateFilter.end + "T23:59:59")
    )
      return false;
    return true;
  });

  // ── render ──
  return (
    <div className="flex h-full flex-col bg-slate-50 text-slate-900 dark:bg-[#090f14] dark:text-slate-100">

      {/* ── Conversation header ── */}
      <div className="flex items-center gap-2 border-b border-slate-200 bg-white px-3 py-2 dark:border-white/10 dark:bg-[#0d151c] sm:px-4">
        <h2 className="truncate text-sm font-medium text-slate-900 dark:text-slate-200">Project conversation</h2>
        <span className="text-[11px] text-slate-500 dark:text-slate-500">
          {messages.length} message{messages.length !== 1 ? "s" : ""}
        </span>
        {!wsConnected && (
          <span className="inline-flex items-center gap-1.5 rounded-full bg-rose-50 px-2 py-1 text-[10px] text-rose-700 dark:bg-rose-500/10 dark:text-rose-300">
            <span className="h-1.5 w-1.5 rounded-full bg-rose-400" />
            Reconnecting
          </span>
        )}
      </div>

      {/* ── Search & Filter panel ── */}
      <div className="border-b border-slate-200 bg-white dark:border-white/10 dark:bg-[#0d151c]">
        <div className="flex items-center">
          <button
            onClick={() => setShowFilters(!showFilters)}
            className="flex flex-1 items-center gap-2 px-4 py-2 text-left text-sm text-slate-600 transition hover:bg-slate-100 dark:text-slate-300 dark:hover:bg-white/[0.06]"
          >
            <Filter className="h-4 w-4" />
            <span>Search & Filters {showFilters ? "▼" : "▶"}</span>
          </button>
          <button
            onClick={handleSummarize}
            className="flex items-center gap-2 border-l border-slate-200 px-4 py-2 text-sm text-slate-600 transition hover:bg-slate-100 dark:border-white/10 dark:text-slate-300 dark:hover:bg-white/[0.06]"
            title="AI summary of this conversation"
          >
            <Sparkles className="h-4 w-4 text-teal-500 dark:text-teal-400" />
            <span>Summarize</span>
          </button>
        </div>

        {showFilters && (
          <div className="grid grid-cols-1 gap-3 border-t border-slate-200 bg-slate-50 p-3 dark:border-white/10 dark:bg-[#0b1218] sm:grid-cols-2">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
              <input
                type="text"
                placeholder="Search messages..."
                value={messageSearchTerm}
                onChange={(e) => setMessageSearchTerm(e.target.value)}
                className="app-control w-full py-2 pl-10 pr-4 text-sm"
              />
            </div>
            <input
              type="text"
              placeholder="Filter by sender name..."
              value={searchSender}
              onChange={(e) => setSearchSender(e.target.value)}
              className="app-control px-4 py-2 text-sm"
            />
            <input
              type="date"
              value={dateFilter.start}
              onChange={(e) => setDateFilter((p) => ({ ...p, start: e.target.value }))}
              className="app-control px-4 py-2 text-sm"
            />
            <div className="flex gap-2">
              <input
                type="date"
                value={dateFilter.end}
                onChange={(e) => setDateFilter((p) => ({ ...p, end: e.target.value }))}
                className="app-control flex-1 px-4 py-2 text-sm"
              />
              {(messageSearchTerm || searchSender || dateFilter.start || dateFilter.end) && (
                <button
                  onClick={clearFilters}
                  className="rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-red-700 transition-colors hover:bg-red-100 dark:border-red-500/30 dark:bg-red-600/20 dark:text-red-400 dark:hover:bg-red-600/40"
                  title="Clear filters"
                >
                  <XCircle className="h-4 w-4" />
                </button>
              )}
            </div>
          </div>
        )}
      </div>

      {/* ── Message list ── */}
      <div className="flex-1 overflow-y-auto bg-slate-50 p-3 dark:bg-[#090f14] sm:px-5 sm:py-4">
        {filteredMessages.length === 0 && (
          <p className="mt-10 text-center text-sm text-slate-500 dark:text-slate-400">
            {messages.length === 0
              ? "No messages yet — be the first!"
              : "No messages match your filters."}
          </p>
        )}

        {filteredMessages.map((msg, index) => {
          const own = isOwn(msg);
          const senderName = getSenderName(msg.sentBy);
          const prevMsg = filteredMessages[index - 1];
          const showDivider =
            !prevMsg ||
            new Date(msg.createdAt).toDateString() !==
              new Date(prevMsg.createdAt).toDateString();

          return (
            <React.Fragment key={msg._id}>
              {showDivider && <MessageDateSeparator date={msg.createdAt} />}

              <div
                id={`pmsg-${msg._id}`}
                data-message-id={msg._id}
                data-owner-id={msg.sentBy?._id || msg.sentBy}
                className={`flex w-full transition-colors duration-500 ${
                  own ? "justify-end" : "justify-start"
                } mb-3`}
              >
                <div className="flex max-w-[85%] flex-col sm:max-w-[70%]">
                  {/* Sender name (other side only) */}
                  {!own && (
                    <p className="mb-1 px-1 text-xs text-slate-500 dark:text-gray-400">
                      {senderName}
                      {msg.senderType === "client" && " (Client)"}
                      {msg.senderType === "superadmin" && " (Admin)"}
                    </p>
                  )}

                  <div
                    className={`relative group w-fit max-w-full overflow-hidden rounded-xl border p-3 shadow-sm transition-colors duration-200 ${
                      own
                        ? "border-teal-600/20 bg-teal-600 text-white dark:border-teal-400/15 dark:bg-[#075d55]"
                        : "border-slate-200 bg-white text-slate-900 dark:border-white/10 dark:bg-[#1a242d] dark:text-white"
                    }`}
                  >
                    {/* Reply preview */}
                    {msg.replyTo && (
                      <div
                        onClick={() => scrollToMessage(msg.replyTo._id)}
                        className="mb-2 cursor-pointer overflow-hidden rounded border-l-2 border-teal-400 bg-black/10 px-2 py-1 text-xs transition hover:bg-black/15 dark:bg-black/20 dark:hover:bg-black/30"
                        style={{ wordBreak: "break-word", overflowWrap: "anywhere" }}
                      >
                        <p className={`truncate font-semibold ${own ? "text-teal-50" : "text-slate-700 dark:text-blue-300"}`}>
                          {getSenderName(msg.replyTo.sentBy)}
                        </p>
                        <p
                          className={`overflow-hidden italic ${own ? "text-teal-50/80" : "text-slate-500 dark:text-gray-400"}`}
                          style={{
                            display: "-webkit-box",
                            WebkitLineClamp: 2,
                            WebkitBoxOrient: "vertical",
                          }}
                        >
                          {msg.replyTo.message || "..."}
                        </p>
                      </div>
                    )}

                    {/* Markdown body */}
                    {msg.message && (
                      <div className={`prose prose-sm max-w-none break-words text-sm leading-relaxed ${own ? "prose-invert text-white" : "prose-slate dark:prose-invert dark:text-white"}`}>
                        <ReactMarkdown
                          remarkPlugins={[remarkGfm]}
                          rehypePlugins={[rehypeRaw]}
                          components={{
                            p: ({ children }) => (
                              <p className="mb-1 whitespace-pre-wrap last:mb-0">{children}</p>
                            ),
                            h1: ({ children }) => (
                              <h1 className="mb-1 text-lg font-bold">{children}</h1>
                            ),
                            h2: ({ children }) => (
                              <h2 className="mb-1 text-base font-bold">{children}</h2>
                            ),
                            h3: ({ children }) => (
                              <h3 className="mb-1 text-sm font-bold">{children}</h3>
                            ),
                            ul: ({ children }) => (
                              <ul className="mb-1 list-inside list-disc">{children}</ul>
                            ),
                            ol: ({ children }) => (
                              <ol className="mb-1 list-inside list-decimal">{children}</ol>
                            ),
                            li: ({ children }) => (
                              <li className="ml-2">{children}</li>
                            ),
                            code: ({ inline, children }) =>
                              inline ? (
                                <code className="rounded bg-black/10 px-1 text-xs dark:bg-black/30">
                                  {children}
                                </code>
                              ) : (
                                <code className="block overflow-x-auto rounded bg-black/10 p-2 text-xs dark:bg-black/30">
                                  {children}
                                </code>
                              ),
                            strong: ({ children }) => (
                              <strong className="font-bold">{children}</strong>
                            ),
                            em: ({ children }) => (
                              <em className="italic">{children}</em>
                            ),
                            a: ({ href, children }) => (
                              <a
                                href={href}
                                target="_blank"
                                rel="noopener noreferrer"
                                className={`underline ${own ? "text-teal-50 hover:text-white" : "text-blue-600 hover:text-blue-700 dark:text-blue-300 dark:hover:text-blue-200"}`}
                              >
                                {children}
                              </a>
                            ),
                          }}
                        >
                          {msg.message}
                        </ReactMarkdown>
                      </div>
                    )}

                    {/* Attachments */}
                    {msg.attachments?.length > 0 && (
                      <div className="mt-3 space-y-2">
                        {msg.attachments.map((att, ai) => {
                          const isMedia =
                            att.fileType === "image" || att.fileType === "video";
                          const mediaAtts = msg.attachments.filter(
                            (a) => a.fileType === "image" || a.fileType === "video"
                          );
                          const attUrl = att.url?.startsWith("http")
                            ? att.url
                            : `${API_BASE}${att.url}`;

                          return (
                            <div key={ai}>
                              {/* Non-media file */}
                              {!isMedia && (
                                <div className="flex items-center gap-2 rounded bg-black/10 p-2 dark:bg-black/20">
                                  {getFileIcon(att.fileType)}
                                  <div className="min-w-0 flex-1">
                                    <div className={`truncate text-xs ${own ? "text-white" : "text-slate-900 dark:text-white"}`}>
                                      {att.filename}
                                    </div>
                                    <div className={`text-xs ${own ? "text-teal-50/75" : "text-slate-500 dark:text-gray-400"}`}>
                                      {att.size
                                        ? `${(att.size / 1024).toFixed(1)} KB`
                                        : ""}
                                    </div>
                                  </div>
                                  <button
                                    onClick={async () => {
                                      const token = localStorage.getItem("token");
                                      const r = await fetch(
                                        `${API_BASE}/api/projects/${projectId}/messages/${msg._id}/attachments/${att._id}/download`,
                                        {
                                          headers: {
                                            Authorization: `Bearer ${token}`,
                                          },
                                        }
                                      );
                                      const blob = await r.blob();
                                      const url =
                                        window.URL.createObjectURL(blob);
                                      const a = document.createElement("a");
                                      a.href = url;
                                      a.download = att.filename;
                                      a.click();
                                      window.URL.revokeObjectURL(url);
                                    }}
                                    className="rounded p-1 hover:bg-black/10 dark:hover:bg-white/10"
                                    title="Download"
                                  >
                                    <Download className={`h-4 w-4 ${own ? "text-teal-50/80" : "text-slate-500 dark:text-gray-300"}`} />
                                  </button>
                                </div>
                              )}

                              {/* Image */}
                              {att.fileType === "image" && (
                                <div className="relative group">
                                  <img
                                    src={attUrl}
                                    alt={att.filename}
                                    className="h-48 w-48 cursor-pointer rounded object-cover transition-opacity hover:opacity-90"
                                    onClick={() => {
                                      setLightboxAllMedia(mediaAtts);
                                      setLightboxIndex(mediaAtts.indexOf(att));
                                      setLightboxMedia(att);
                                    }}
                                  />
                                </div>
                              )}

                              {/* Video */}
                              {att.fileType === "video" && (
                                <div className="relative">
                                  <video
                                    src={attUrl}
                                    className="h-48 w-48 cursor-pointer rounded object-cover"
                                    onClick={() => {
                                      setLightboxAllMedia(mediaAtts);
                                      setLightboxIndex(mediaAtts.indexOf(att));
                                      setLightboxMedia(att);
                                    }}
                                  />
                                  <div className="pointer-events-none absolute inset-0 flex items-center justify-center">
                                    <div className="rounded-full bg-black/50 p-3">
                                      <Video className="h-6 w-6 text-white" />
                                    </div>
                                  </div>
                                </div>
                              )}
                            </div>
                          );
                        })}
                      </div>
                    )}

                    {/* Emoji reactions */}
                    {msg.reactions?.length > 0 && (
                      <div className="mt-2 flex flex-wrap gap-1">
                        {msg.reactions.map((reaction, ri) => {
                          const reacted = reaction.users?.includes(
                            String(user._id)
                          );
                          return (
                            <button
                              key={ri}
                              onClick={() =>
                                handleReaction(msg._id, reaction.emoji)
                              }
                              className={`flex items-center gap-1 rounded-full px-2 py-0.5 text-xs transition-all ${
                                reacted
                                  ? "border border-blue-300 bg-blue-100 text-blue-700 dark:border-blue-400 dark:bg-blue-500/30 dark:text-white"
                                  : "bg-black/10 hover:bg-black/15 dark:bg-black/20 dark:hover:bg-black/30"
                              }`}
                            >
                              <span>{reaction.emoji}</span>
                              <span className={`text-[10px] ${own ? "text-teal-50/80" : "text-slate-500 dark:text-gray-300"}`}>
                                {reaction.users?.length || 0}
                              </span>
                            </button>
                          );
                        })}
                      </div>
                    )}

                    {/* Timestamp + action buttons */}
                    <div className="mt-1 flex items-center justify-between gap-3">
                      <div className="flex items-center gap-2">
                        <span className={`text-[10px] ${own ? "text-teal-50/80" : "text-slate-500 dark:text-gray-400"}`}>
                          {new Date(msg.createdAt).toLocaleTimeString([], {
                            hour: "2-digit",
                            minute: "2-digit",
                          })}
                        </span>
                        {own && <MessageStatus status={msg.status || "sent"} />}
                      </div>
                      <div className="relative flex items-center gap-1 opacity-100 transition-opacity sm:opacity-0 sm:group-hover:opacity-100">
                        <button
                          onClick={() => setReplyingTo(msg)}
                          className="rounded-md p-1 transition-colors hover:bg-black/10 dark:hover:bg-white/10"
                          title="Reply"
                        >
                          <ReplyIcon className={`h-3.5 w-3.5 ${own ? "text-teal-50/80 hover:text-white" : "text-slate-400 hover:text-teal-600 dark:text-gray-400 dark:hover:text-[#00a884]"}`} />
                        </button>
                        <button
                          onClick={() => copyToClipboard(msg.message)}
                          className="rounded-md p-1 transition-colors hover:bg-black/10 dark:hover:bg-white/10"
                          title="Copy"
                        >
                          {copiedText === msg.message ? (
                            <Check className="h-3.5 w-3.5 text-green-400" />
                          ) : (
                            <Copy className={`h-3.5 w-3.5 ${own ? "text-teal-50/80 hover:text-white" : "text-slate-400 hover:text-blue-600 dark:text-gray-400 dark:hover:text-blue-400"}`} />
                          )}
                        </button>
                        <button
                          onClick={() =>
                            setShowEmojiPicker(
                              showEmojiPicker === msg._id ? null : msg._id
                            )
                          }
                          className="rounded-md p-1 transition-colors hover:bg-black/10 dark:hover:bg-white/10"
                          title="React"
                        >
                          <Smile className={`h-3.5 w-3.5 ${own ? "text-teal-50/80 hover:text-white" : "text-slate-400 hover:text-yellow-500 dark:text-gray-400 dark:hover:text-yellow-400"}`} />
                        </button>

                        {/* Emoji picker popup */}
                        {showEmojiPicker === msg._id && (
                          <div
                            ref={emojiPickerRef}
                            className={`absolute ${
                              own ? "right-0" : "left-0"
                            } bottom-full z-50 mb-1 flex gap-1 rounded-lg border border-slate-200 bg-white p-2 shadow-2xl shadow-slate-900/15 dark:border-[#232945] dark:bg-[#1a2332]`}
                          >
                            {commonEmojis.map((emoji, ei) => (
                              <button
                                key={ei}
                                onClick={(e) => {
                                  e.stopPropagation();
                                  handleReaction(msg._id, emoji);
                                }}
                                className="rounded p-1.5 text-lg transition-transform hover:scale-125 hover:bg-slate-100 dark:hover:bg-white/10"
                              >
                                {emoji}
                              </button>
                            ))}
                          </div>
                        )}
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            </React.Fragment>
          );
        })}

        <div ref={chatEndRef} />
      </div>

      {/* ── Typing indicator ── */}
      <TypingIndicator typingUsers={typingUsers} />

      {/* ── Reply preview bar ── */}
      {replyingTo && (
        <div className="flex items-start justify-between gap-2 overflow-hidden border-t border-teal-200 bg-teal-50 px-4 py-2 dark:border-teal-400/20 dark:bg-teal-500/10">
          <div className="min-w-0 flex-1 text-sm text-slate-700 dark:text-gray-300">
            <div className="mb-1 flex items-center gap-2 text-sm text-teal-700 dark:text-teal-300">
              <ReplyIcon className="h-3 w-3 flex-shrink-0" />
              <span className="truncate font-medium">
                Replying to {getSenderName(replyingTo.sentBy)}
              </span>
            </div>
            <div
              className="overflow-hidden text-xs text-slate-500 dark:text-gray-400"
              style={{
                display: "-webkit-box",
                WebkitLineClamp: 2,
                WebkitBoxOrient: "vertical",
                wordBreak: "break-word",
                overflowWrap: "anywhere",
              }}
            >
              {replyingTo.message}
            </div>
          </div>
          <button
            onClick={() => setReplyingTo(null)}
            className="flex-shrink-0 rounded p-1 hover:bg-black/5 dark:hover:bg-white/10"
          >
            <XCircle className="h-4 w-4 text-slate-400" />
          </button>
        </div>
      )}

      {/* ── File preview chips ── */}
      {selectedFiles.length > 0 && (
        <div className="border-t border-slate-200 bg-white px-4 py-2 dark:border-white/10 dark:bg-[#0d151c]">
          <p className="mb-2 text-xs text-slate-500 dark:text-gray-400">
            Selected files ({selectedFiles.length}/5):
          </p>
          <div className="flex flex-wrap gap-2">
            {selectedFiles.map((file, idx) => (
              <div
                key={idx}
                className="flex items-center gap-2 rounded-lg border border-slate-200 bg-slate-50 px-3 py-2 dark:border-white/10 dark:bg-white/[0.04]"
              >
                <FileIcon className="h-4 w-4 text-slate-500 dark:text-gray-300" />
                <span className="max-w-[150px] truncate text-xs text-slate-700 dark:text-gray-300">
                  {file.name}
                </span>
                <button
                  onClick={() => removeFile(idx)}
                  className="rounded p-1 hover:bg-slate-100 dark:hover:bg-white/10"
                >
                  <XCircle className="h-3 w-3 text-slate-400" />
                </button>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* ── Formatting toolbar ── */}
      {showFormatting && (
        <div className="border-t border-slate-200 bg-slate-50 px-4 py-3 dark:border-white/10 dark:bg-[#101820]">
          <div className="flex flex-wrap gap-2">
            {[
              ["B", formatBold, "Bold (Ctrl+B)", "font-bold"],
              ["I", formatItalic, "Italic (Ctrl+I)", "italic"],
              ["S", formatStrike, "Strikethrough (Ctrl+U)", "line-through"],
              ["</>", formatCode, "Code (Ctrl+E)", "font-mono"],
              ["H1", formatHeading, "Heading", "font-bold"],
              ["• List", formatBullet, "Bullet (Ctrl+L)", ""],
              ["1. List", formatNumbered, "Numbered (Ctrl+Shift+L)", ""],
            ].map(([label, fn, title, extra]) => (
              <button
                key={label}
                type="button"
                onClick={fn}
                title={title}
                className={`rounded border border-slate-200 bg-white px-3 py-1.5 text-xs text-slate-700 transition-colors hover:bg-slate-100 dark:border-white/10 dark:bg-[#232945] dark:text-white dark:hover:bg-[#2a3142] ${extra}`}
              >
                {label}
              </button>
            ))}
          </div>
        </div>
      )}

      {/* ── Input area ── */}
      <div className="border-t border-slate-200 bg-white p-2 dark:border-white/10 dark:bg-[#0d151c] sm:px-3">
        <div className="flex items-center gap-2">
          <input
            type="file"
            ref={fileInputRef}
            onChange={handleFileSelect}
            multiple
            accept="image/*,video/*,.pdf,.doc,.docx,.xls,.xlsx,.txt"
            className="hidden"
          />

          <div className="relative flex-shrink-0">
            <button
              type="button"
              onClick={() => setShowComposerTools((v) => !v)}
              className={`flex h-11 w-11 items-center justify-center rounded-lg border transition ${
                showComposerTools
                  ? "border-teal-300 bg-teal-50 text-teal-700 dark:border-teal-400/30 dark:bg-teal-500/10 dark:text-teal-300"
                  : "border-slate-200 bg-slate-50 text-slate-500 hover:bg-slate-100 hover:text-slate-950 dark:border-white/10 dark:bg-white/[0.035] dark:text-slate-400 dark:hover:bg-white/[0.065] dark:hover:text-white"
              }`}
              aria-label="Add attachment or formatting"
            >
              <Plus className={`h-4 w-4 transition-transform ${showComposerTools ? "rotate-45" : ""}`} />
            </button>

            {showComposerTools && (
              <div className="absolute bottom-[calc(100%+0.5rem)] left-0 z-50 w-44 rounded-xl border border-slate-200 bg-white p-1.5 shadow-2xl shadow-slate-900/15 dark:border-white/10 dark:bg-[#131c24] dark:shadow-black/40">
                <button
                  type="button"
                  onClick={() => { fileInputRef.current?.click(); setShowComposerTools(false); }}
                  className="flex w-full items-center gap-3 rounded-lg px-3 py-2 text-left text-sm text-slate-600 transition hover:bg-slate-100 hover:text-slate-950 dark:text-slate-300 dark:hover:bg-white/5 dark:hover:text-white"
                >
                  <Paperclip className="h-4 w-4 text-sky-400" />
                  Attach files
                </button>
                <button
                  type="button"
                  onClick={() => { setShowFormatting((v) => !v); setShowComposerTools(false); }}
                  className="flex w-full items-center gap-3 rounded-lg px-3 py-2 text-left text-sm text-slate-600 transition hover:bg-slate-100 hover:text-slate-950 dark:text-slate-300 dark:hover:bg-white/5 dark:hover:text-white"
                >
                  <Type className="h-4 w-4 text-teal-400" />
                  Formatting
                </button>
              </div>
            )}
          </div>

          <textarea
            ref={textareaRef}
            value={input}
            onChange={(e) => {
              setInput(e.target.value);
              if (e.target.value.length > 0) sendTypingIndicator();
              else stopTypingIndicator();
            }}
            onKeyDown={handleKeyDown}
            placeholder="Write a message..."
            rows={1}
            className="h-11 flex-1 resize-none rounded-xl border border-slate-200 bg-white px-3 py-2.5 text-sm text-slate-900 placeholder-slate-400 outline-none transition focus:border-teal-400/50 focus:ring-2 focus:ring-teal-500/15 dark:border-white/10 dark:bg-[#101820] dark:text-white dark:placeholder-slate-500"
          />

          <button
            onClick={handleSend}
            disabled={!input.trim() && selectedFiles.length === 0}
            className="flex h-11 flex-shrink-0 items-center gap-2 rounded-lg bg-teal-600 px-3 text-white shadow-lg shadow-teal-950/20 transition hover:bg-teal-500 disabled:cursor-not-allowed disabled:opacity-40 sm:px-4"
          >
            <Send className="h-4 w-4" />
            <span className="hidden text-sm sm:inline">Send</span>
          </button>
        </div>
      </div>

      {/* ── Media lightbox ── */}
      {lightboxMedia && (
        <MediaLightbox
          media={lightboxMedia}
          allMedia={lightboxAllMedia}
          currentIndex={lightboxIndex}
          onClose={() => setLightboxMedia(null)}
          onNavigate={(i) => {
            setLightboxIndex(i);
            setLightboxMedia(lightboxAllMedia[i]);
          }}
        />
      )}

      {/* ── AI Summary modal ── */}
      {showSummaryModal && (
        <div
          className="fixed inset-0 z-[9999] flex items-center justify-center bg-slate-950/60 p-4 backdrop-blur-sm"
          onClick={() => setShowSummaryModal(false)}
        >
          <div
            className="flex max-h-[80vh] w-full max-w-3xl flex-col rounded-xl border border-slate-200 bg-white shadow-2xl dark:border-[#232945] dark:bg-[#0f1419]"
            onClick={(e) => e.stopPropagation()}
          >
            {/* Header */}
            <div className="flex items-center justify-between border-b border-slate-200 p-4 dark:border-[#1e2a35]">
              <div className="flex items-center gap-3">
                <Sparkles className="h-5 w-5 text-teal-500 dark:text-teal-400" />
                <h2 className="text-xl font-semibold text-slate-950 dark:text-white">
                  AI Conversation Summary
                </h2>
              </div>
              <button
                onClick={() => setShowSummaryModal(false)}
                className="rounded-lg p-2 transition hover:bg-slate-100 dark:hover:bg-[#141a21]"
              >
                <XCircle className="h-5 w-5 text-slate-400" />
              </button>
            </div>

            {/* Days selector */}
            <div className="flex items-center gap-3 border-b border-slate-200 bg-slate-50 px-4 py-3 dark:border-[#1e2a35] dark:bg-[#0a0e14]/50">
              <label className="text-sm text-slate-500 dark:text-gray-400">Time period:</label>
              <select
                value={summaryDays}
                onChange={(e) => setSummaryDays(Number(e.target.value))}
                className="rounded border border-slate-200 bg-white px-3 py-1.5 text-sm text-slate-900 outline-none focus:ring-2 focus:ring-teal-500/20 dark:border-[#2a3340] dark:bg-[#141a21] dark:text-blue-100"
              >
                <option value={1}>Last 24 hours</option>
                <option value={3}>Last 3 days</option>
                <option value={7}>Last week</option>
                <option value={14}>Last 2 weeks</option>
                <option value={30}>Last month</option>
              </select>
              <button
                onClick={handleSummarize}
                disabled={summaryLoading}
                className="flex items-center gap-2 rounded bg-teal-600 px-4 py-1.5 text-sm text-white transition hover:bg-teal-500 disabled:cursor-not-allowed disabled:opacity-50"
              >
                <Sparkles className="h-4 w-4" />
                {summaryLoading ? "Generating..." : "Regenerate"}
              </button>
            </div>

            {/* Body */}
            <div className="flex-1 overflow-y-auto bg-slate-50/50 p-6 dark:bg-[#0a0e14]/30">
              {summaryLoading ? (
                <div className="flex h-full flex-col items-center justify-center gap-4">
                  <div className="relative">
                    <div className="h-16 w-16 animate-spin rounded-full border-4 border-teal-500/30 border-t-teal-500" />
                    <Sparkles className="absolute left-1/2 top-1/2 h-6 w-6 -translate-x-1/2 -translate-y-1/2 text-teal-400" />
                  </div>
                  <p className="text-sm text-slate-500 dark:text-gray-400">
                    Analysing conversation with AI...
                  </p>
                </div>
              ) : (
                <div className="prose prose-sm prose-slate max-w-none dark:prose-invert">
                  <ReactMarkdown remarkPlugins={[remarkGfm]}>
                    {summary}
                  </ReactMarkdown>
                </div>
              )}
            </div>

            {/* Footer */}
            <div className="flex items-center justify-between border-t border-slate-200 bg-slate-50 p-4 dark:border-[#1e2a35] dark:bg-[#0a0e14]/50">
              <span className="text-xs text-slate-500 dark:text-gray-500">
                Powered by AI · Last {summaryDays} day
                {summaryDays !== 1 ? "s" : ""}
              </span>
              <button
                onClick={() => copyToClipboard(summary)}
                disabled={!summary || summaryLoading}
                className="flex items-center gap-2 rounded border border-slate-200 bg-white px-4 py-2 text-sm text-slate-700 transition hover:bg-slate-100 disabled:cursor-not-allowed disabled:opacity-50 dark:border-[#2a3340] dark:bg-[#141a21] dark:text-gray-200 dark:hover:bg-[#1e2a35]"
              >
                {copiedText === summary ? (
                  <>
                    <Check className="h-4 w-4" /> Copied!
                  </>
                ) : (
                  <>
                    <Copy className="h-4 w-4" /> Copy Summary
                  </>
                )}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default ProjectMessagePanel;
