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
} from "lucide-react";
import MediaLightbox from "../common/MediaLightbox";

const API_BASE = import.meta.env.VITE_API_BASE || "http://localhost:5000";

const commonEmojis = ["👍", "❤️", "😂", "😮", "😢", "🙏", "🔥", "✅"];

const getWebSocketURL = () => {
  if (import.meta.env.VITE_WS_BASE) return import.meta.env.VITE_WS_BASE;
  const apiBase = import.meta.env.VITE_API_BASE;
  if (apiBase) {
    try {
      const u = new URL(apiBase);
      u.protocol = u.protocol === "https:" ? "wss:" : "ws:";
      return `${u.protocol}//${u.host}`;
    } catch {}
  }
  if (typeof window !== "undefined") {
    const protocol = window.location.protocol === "https:" ? "wss" : "ws";
    const host =
      window.location.hostname === "localhost"
        ? "localhost:5000"
        : window.location.host;
    return `${protocol}://${host}`;
  }
  return "ws://localhost:5000";
};

// ─── Date divider (Today / Yesterday / date) ────────────────────────────────
const DateDivider = ({ date }) => {
  const now = new Date();
  const d = new Date(date);
  const yesterday = new Date(now);
  yesterday.setDate(now.getDate() - 1);
  const label =
    now.toDateString() === d.toDateString()
      ? "Today"
      : yesterday.toDateString() === d.toDateString()
      ? "Yesterday"
      : d.toLocaleDateString();
  return (
    <div className="flex justify-center my-3 w-full">
      <span className="bg-gray-700 text-gray-300 rounded-full px-3 py-1 text-xs select-none">
        {label}
      </span>
    </div>
  );
};

// ─── Main component ──────────────────────────────────────────────────────────
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
  const [showEmojiPicker, setShowEmojiPicker] = useState(null);
  const [copiedText, setCopiedText] = useState(null);
  const [lightboxMedia, setLightboxMedia] = useState(null);
  const [lightboxIndex, setLightboxIndex] = useState(0);
  const [lightboxAllMedia, setLightboxAllMedia] = useState([]);
  const [showSummaryModal, setShowSummaryModal] = useState(false);
  const [summary, setSummary] = useState("");
  const [summaryLoading, setSummaryLoading] = useState(false);
  const [summaryDays, setSummaryDays] = useState(7);

  // ── refs ──
  const chatEndRef = useRef(null);
  const fileInputRef = useRef(null);
  const textareaRef = useRef(null);
  const wsRef = useRef(null);
  const emojiPickerRef = useRef(null);
  const prevLengthRef = useRef(0);

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
    if (fileType === "image") return <ImageIcon className="w-4 h-4 text-blue-400" />;
    if (fileType === "video") return <Video className="w-4 h-4 text-purple-400" />;
    return <FileIcon className="w-4 h-4 text-gray-400" />;
  };

  const scrollToMessage = (id) => {
    const el = document.getElementById(`pmsg-${id}`);
    if (!el) return;
    el.scrollIntoView({ behavior: "smooth", block: "center" });
    el.classList.add("bg-blue-900/30");
    setTimeout(() => el.classList.remove("bg-blue-900/30"), 1500);
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

      if (wsRef.current?.readyState === WebSocket.OPEN) {
        wsRef.current.send(
          JSON.stringify({ type: "project_message", projectId, messageData })
        );
      }

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

  // WebSocket
  useEffect(() => {
    if (!projectId) return;
    const token = localStorage.getItem("token");
    const ws = new WebSocket(getWebSocketURL());
    wsRef.current = ws;
    ws.onopen = () =>
      ws.send(JSON.stringify({ type: "authenticate", token }));
    ws.onmessage = (evt) => {
      try {
        const data = JSON.parse(evt.data);
        if (data.type === "project_message" && data.projectId === projectId) {
          fetchMessages();
        }
      } catch {}
    };
    return () => ws.close();
  }, [projectId]);

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
    <div className="flex flex-col h-full bg-gray-900 text-gray-100">

      {/* ── Search & Filter panel ── */}
      <div className="bg-gray-800 border-b border-gray-700">
        <div className="flex items-center">
          <button
            onClick={() => setShowFilters(!showFilters)}
            className="flex-1 px-4 py-2 text-sm text-left text-gray-300 hover:bg-gray-700 transition flex items-center gap-2"
          >
            <Filter className="w-4 h-4" />
            <span>Search & Filters {showFilters ? "▼" : "▶"}</span>
          </button>
          <button
            onClick={handleSummarize}
            className="px-4 py-2 text-sm text-gray-300 hover:bg-gray-700 transition flex items-center gap-2 border-l border-gray-700"
            title="AI summary of this conversation"
          >
            <Sparkles className="w-4 h-4 text-purple-400" />
            <span>Summarize</span>
          </button>
        </div>

        {showFilters && (
          <div className="p-4 space-y-3 border-t border-gray-700">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
              <input
                type="text"
                placeholder="Search messages..."
                value={messageSearchTerm}
                onChange={(e) => setMessageSearchTerm(e.target.value)}
                className="w-full pl-10 pr-4 py-2 bg-gray-700 text-gray-100 rounded border border-gray-600 focus:outline-none focus:ring-2 focus:ring-blue-500 text-sm"
              />
            </div>
            <input
              type="text"
              placeholder="Filter by sender name..."
              value={searchSender}
              onChange={(e) => setSearchSender(e.target.value)}
              className="w-full px-3 py-2 bg-gray-700 text-gray-100 rounded border border-gray-600 focus:outline-none focus:ring-2 focus:ring-blue-500 text-sm"
            />
            <div className="flex gap-2">
              <input
                type="date"
                value={dateFilter.start}
                onChange={(e) =>
                  setDateFilter((p) => ({ ...p, start: e.target.value }))
                }
                className="flex-1 px-3 py-2 bg-gray-700 text-gray-100 rounded border border-gray-600 focus:outline-none focus:ring-2 focus:ring-blue-500 text-sm"
              />
              <input
                type="date"
                value={dateFilter.end}
                onChange={(e) =>
                  setDateFilter((p) => ({ ...p, end: e.target.value }))
                }
                className="flex-1 px-3 py-2 bg-gray-700 text-gray-100 rounded border border-gray-600 focus:outline-none focus:ring-2 focus:ring-blue-500 text-sm"
              />
            </div>
            {(messageSearchTerm || searchSender || dateFilter.start || dateFilter.end) && (
              <button
                onClick={clearFilters}
                className="w-full px-3 py-2 bg-red-600 hover:bg-red-700 text-white rounded text-sm transition flex items-center justify-center gap-2"
              >
                <XCircle className="w-4 h-4" /> Clear Filters
              </button>
            )}
          </div>
        )}
      </div>

      {/* ── Message list ── */}
      <div className="flex-1 overflow-y-auto p-4 space-y-3 hide-scrollbar">
        {filteredMessages.length === 0 && (
          <p className="text-gray-500 text-center text-sm mt-10">
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
              {showDivider && <DateDivider date={msg.createdAt} />}

              <div
                id={`pmsg-${msg._id}`}
                className={`flex w-full transition-colors duration-500 ${
                  own ? "justify-end" : "justify-start"
                }`}
              >
                <div className="flex flex-col max-w-[70%]">
                  {/* Sender name (other side only) */}
                  {!own && (
                    <p className="text-xs font-semibold text-gray-400 mb-1">
                      {senderName}
                      {msg.senderType === "client" && " (Client)"}
                      {msg.senderType === "superadmin" && " (Admin)"}
                    </p>
                  )}

                  <div
                    className={`px-3 py-2 rounded-lg ${
                      own
                        ? "bg-blue-600 text-white rounded-br-none self-end"
                        : "bg-gray-700 text-gray-100 rounded-bl-none self-start"
                    }`}
                  >
                    {/* Reply preview */}
                    {msg.replyTo && (
                      <div
                        onClick={() => scrollToMessage(msg.replyTo._id)}
                        className="bg-gray-800 bg-opacity-50 px-2 py-1 rounded mb-2 text-xs border-l-2 border-blue-400 cursor-pointer hover:bg-opacity-70 transition overflow-hidden"
                        style={{ wordBreak: "break-word", overflowWrap: "anywhere" }}
                      >
                        <p className="text-blue-300 font-semibold truncate">
                          {getSenderName(msg.replyTo.sentBy)}
                        </p>
                        <p
                          className="text-gray-400 italic overflow-hidden"
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
                      <div className="text-sm prose prose-invert prose-sm max-w-none">
                        <ReactMarkdown
                          remarkPlugins={[remarkGfm]}
                          rehypePlugins={[rehypeRaw]}
                          components={{
                            p: ({ children }) => (
                              <p className="mb-1 last:mb-0">{children}</p>
                            ),
                            h1: ({ children }) => (
                              <h1 className="text-lg font-bold mb-1">{children}</h1>
                            ),
                            h2: ({ children }) => (
                              <h2 className="text-base font-bold mb-1">{children}</h2>
                            ),
                            h3: ({ children }) => (
                              <h3 className="text-sm font-bold mb-1">{children}</h3>
                            ),
                            ul: ({ children }) => (
                              <ul className="list-disc list-inside mb-1">{children}</ul>
                            ),
                            ol: ({ children }) => (
                              <ol className="list-decimal list-inside mb-1">{children}</ol>
                            ),
                            li: ({ children }) => (
                              <li className="ml-2">{children}</li>
                            ),
                            code: ({ inline, children }) =>
                              inline ? (
                                <code className="bg-gray-800 px-1 rounded text-xs">
                                  {children}
                                </code>
                              ) : (
                                <code className="block bg-gray-800 p-2 rounded text-xs overflow-x-auto">
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
                                className="text-blue-400 underline hover:text-blue-300"
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
                                <div className="flex items-center gap-2 p-2 bg-black/20 rounded">
                                  {getFileIcon(att.fileType)}
                                  <div className="flex-1 min-w-0">
                                    <div className="text-xs text-white truncate">
                                      {att.filename}
                                    </div>
                                    <div className="text-xs text-gray-400">
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
                                    className="p-1 hover:bg-white/10 rounded"
                                    title="Download"
                                  >
                                    <Download className="w-4 h-4 text-gray-300" />
                                  </button>
                                </div>
                              )}

                              {/* Image */}
                              {att.fileType === "image" && (
                                <div className="relative group">
                                  <img
                                    src={attUrl}
                                    alt={att.filename}
                                    className="w-48 h-48 object-cover rounded cursor-pointer hover:opacity-90 transition-opacity"
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
                                    className="w-48 h-48 object-cover rounded cursor-pointer"
                                    onClick={() => {
                                      setLightboxAllMedia(mediaAtts);
                                      setLightboxIndex(mediaAtts.indexOf(att));
                                      setLightboxMedia(att);
                                    }}
                                  />
                                  <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
                                    <div className="bg-black/50 rounded-full p-3">
                                      <Video className="w-6 h-6 text-white" />
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
                      <div className="flex flex-wrap gap-1 mt-2">
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
                              className={`flex items-center gap-1 px-2 py-0.5 rounded-full text-xs transition-all ${
                                reacted
                                  ? "bg-blue-500/30 border border-blue-400"
                                  : "bg-gray-700/50 hover:bg-gray-700"
                              }`}
                            >
                              <span>{reaction.emoji}</span>
                              <span className="text-gray-300 text-[10px]">
                                {reaction.users?.length || 0}
                              </span>
                            </button>
                          );
                        })}
                      </div>
                    )}

                    {/* Timestamp + action buttons */}
                    <div className="flex items-center justify-between mt-1">
                      <span className="text-[10px] text-gray-400">
                        {new Date(msg.createdAt).toLocaleTimeString([], {
                          hour: "2-digit",
                          minute: "2-digit",
                        })}
                      </span>
                      <div className="flex items-center gap-1 relative">
                        <button
                          onClick={() => setReplyingTo(msg)}
                          className="p-1 rounded hover:bg-white/10 transition-colors"
                          title="Reply"
                        >
                          <ReplyIcon className="w-3 h-3 text-gray-400 hover:text-purple-400" />
                        </button>
                        <button
                          onClick={() => copyToClipboard(msg.message)}
                          className="p-1 rounded hover:bg-white/10 transition-colors"
                          title="Copy"
                        >
                          {copiedText === msg.message ? (
                            <Check className="w-3 h-3 text-green-400" />
                          ) : (
                            <Copy className="w-3 h-3 text-gray-400 hover:text-blue-400" />
                          )}
                        </button>
                        <button
                          onClick={() =>
                            setShowEmojiPicker(
                              showEmojiPicker === msg._id ? null : msg._id
                            )
                          }
                          className="p-1 rounded hover:bg-white/10 transition-colors"
                          title="React"
                        >
                          <Smile className="w-3 h-3 text-gray-400 hover:text-yellow-400" />
                        </button>

                        {/* Emoji picker popup */}
                        {showEmojiPicker === msg._id && (
                          <div
                            ref={emojiPickerRef}
                            className={`absolute ${
                              own ? "right-0" : "left-0"
                            } bottom-full mb-1 p-2 bg-gray-800 border border-gray-600 rounded-lg shadow-xl z-50`}
                          >
                            <div className="flex gap-1">
                              {commonEmojis.map((emoji, ei) => (
                                <button
                                  key={ei}
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    handleReaction(msg._id, emoji);
                                  }}
                                  className="p-1 hover:bg-gray-700 rounded text-lg transition-transform hover:scale-125"
                                >
                                  {emoji}
                                </button>
                              ))}
                            </div>
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

      {/* ── Reply preview bar ── */}
      {replyingTo && (
        <div className="bg-gray-800 border-t border-gray-700 px-4 py-2 flex justify-between items-start gap-2 overflow-hidden">
          <div className="text-sm text-gray-300 flex-1 min-w-0">
            <div className="flex items-center gap-2 text-sm text-blue-400 mb-1">
              <ReplyIcon className="w-3 h-3 flex-shrink-0" />
              <span className="font-medium truncate">
                Replying to {getSenderName(replyingTo.sentBy)}
              </span>
            </div>
            <div
              className="text-xs text-gray-400 overflow-hidden"
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
            className="p-1 hover:bg-white/10 rounded flex-shrink-0"
          >
            <XCircle className="w-4 h-4 text-gray-400" />
          </button>
        </div>
      )}

      {/* ── File preview chips ── */}
      {selectedFiles.length > 0 && (
        <div className="bg-gray-800 border-t border-gray-700 px-4 py-2">
          <p className="text-xs text-gray-400 mb-2">
            Selected files ({selectedFiles.length}/5):
          </p>
          <div className="flex flex-wrap gap-2">
            {selectedFiles.map((file, idx) => (
              <div
                key={idx}
                className="flex items-center gap-2 bg-gray-700 px-3 py-1 rounded text-xs"
              >
                <FileIcon className="w-4 h-4 text-gray-400" />
                <span className="text-gray-300 truncate max-w-[150px]">
                  {file.name}
                </span>
                <button
                  onClick={() => removeFile(idx)}
                  className="p-1 hover:bg-white/10 rounded"
                >
                  <XCircle className="w-3 h-3 text-gray-400" />
                </button>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* ── Formatting toolbar ── */}
      {showFormatting && (
        <div className="bg-gray-800 border-t border-gray-700 px-4 py-2">
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
                onClick={fn}
                title={title}
                className={`px-3 py-1.5 bg-gray-700 hover:bg-gray-600 rounded text-xs transition-colors ${extra}`}
              >
                {label}
              </button>
            ))}
          </div>
          <p className="mt-2 text-xs text-gray-500">
            **bold** *italic* ~~strike~~ `code` ## heading - list 1. list
          </p>
        </div>
      )}

      {/* ── Input area ── */}
      <div className="sticky bottom-0 bg-gray-800 border-t border-gray-700">
        <div className="flex items-start gap-2 p-2">
          <input
            type="file"
            ref={fileInputRef}
            onChange={handleFileSelect}
            multiple
            accept="image/*,video/*,.pdf,.doc,.docx,.xls,.xlsx,.txt"
            className="hidden"
          />
          <button
            onClick={() => fileInputRef.current?.click()}
            className="px-3 py-2 bg-gray-700 hover:bg-gray-600 text-gray-300 rounded transition flex-shrink-0"
            title="Attach files"
          >
            <Paperclip className="w-5 h-5" />
          </button>
          <button
            onClick={() => setShowFormatting(!showFormatting)}
            className="px-3 py-2 bg-gray-700 hover:bg-gray-600 text-gray-300 rounded transition flex-shrink-0"
            title="Text formatting"
          >
            <Type className="w-5 h-5" />
          </button>
          <textarea
            ref={textareaRef}
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder="Type a message... (Enter to send, Shift+Enter for new line)"
            rows={2}
            className="flex-1 bg-gray-700 text-gray-100 border border-gray-600 rounded px-3 py-2 text-sm resize-none focus:outline-none focus:ring-2 focus:ring-blue-500 placeholder-gray-500"
          />
          <button
            onClick={handleSend}
            disabled={!input.trim() && selectedFiles.length === 0}
            className="px-4 py-2 rounded-lg bg-blue-600 hover:bg-blue-500 text-white font-medium shadow-md hover:shadow-lg transition flex-shrink-0 disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
          >
            <Send className="w-4 h-4" />
            <span>Send</span>
          </button>
        </div>
        <p className="text-xs text-gray-600 px-2 pb-2">
          Max 5 files · **bold** *italic* `code` ## heading
        </p>
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
          className="fixed inset-0 bg-black bg-opacity-75 flex items-center justify-center p-4"
          style={{ zIndex: 9999 }}
          onClick={() => setShowSummaryModal(false)}
        >
          <div
            className="bg-gray-800 rounded-lg shadow-2xl max-w-3xl w-full max-h-[80vh] flex flex-col border border-gray-700"
            onClick={(e) => e.stopPropagation()}
          >
            {/* Header */}
            <div className="flex items-center justify-between p-4 border-b border-gray-700">
              <div className="flex items-center gap-3">
                <Sparkles className="w-5 h-5 text-purple-400" />
                <h2 className="text-xl font-semibold text-gray-100">
                  AI Conversation Summary
                </h2>
              </div>
              <button
                onClick={() => setShowSummaryModal(false)}
                className="p-2 hover:bg-gray-700 rounded-lg transition"
              >
                <XCircle className="w-5 h-5 text-gray-400" />
              </button>
            </div>

            {/* Days selector */}
            <div className="px-4 py-3 border-b border-gray-700 bg-gray-800/50 flex items-center gap-3">
              <label className="text-sm text-gray-400">Time period:</label>
              <select
                value={summaryDays}
                onChange={(e) => setSummaryDays(Number(e.target.value))}
                className="px-3 py-1.5 bg-gray-700 text-gray-100 rounded border border-gray-600 focus:outline-none focus:ring-2 focus:ring-purple-500 text-sm"
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
                className="px-4 py-1.5 bg-purple-600 hover:bg-purple-500 text-white rounded text-sm transition disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
              >
                <Sparkles className="w-4 h-4" />
                {summaryLoading ? "Generating..." : "Regenerate"}
              </button>
            </div>

            {/* Body */}
            <div className="flex-1 overflow-y-auto p-6">
              {summaryLoading ? (
                <div className="flex flex-col items-center justify-center h-full gap-4">
                  <div className="relative">
                    <div className="w-16 h-16 border-4 border-purple-500/30 border-t-purple-500 rounded-full animate-spin" />
                    <Sparkles className="w-6 h-6 text-purple-400 absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2" />
                  </div>
                  <p className="text-gray-400 text-sm">
                    Analysing conversation with AI...
                  </p>
                </div>
              ) : (
                <div className="prose prose-invert prose-sm max-w-none">
                  <ReactMarkdown remarkPlugins={[remarkGfm]}>
                    {summary}
                  </ReactMarkdown>
                </div>
              )}
            </div>

            {/* Footer */}
            <div className="p-4 border-t border-gray-700 flex justify-between items-center bg-gray-800/50">
              <span className="text-xs text-gray-500">
                Powered by AI · Last {summaryDays} day
                {summaryDays !== 1 ? "s" : ""}
              </span>
              <button
                onClick={() => copyToClipboard(summary)}
                disabled={!summary || summaryLoading}
                className="px-4 py-2 bg-gray-700 hover:bg-gray-600 text-gray-200 rounded transition disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2 text-sm"
              >
                {copiedText === summary ? (
                  <>
                    <Check className="w-4 h-4" /> Copied!
                  </>
                ) : (
                  <>
                    <Copy className="w-4 h-4" /> Copy Summary
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
