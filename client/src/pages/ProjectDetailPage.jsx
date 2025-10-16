import React, { useState, useEffect, useRef } from "react";
import axios from "axios";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import rehypeRaw from "rehype-raw";
import {
  ArrowLeft,
  Globe,
  TrendingUp,
  Package,
  Mail,
  Server,
  FileText,
  Calendar,
  Users,
  Clock,
  CheckCircle,
  AlertCircle,
  Send,
  Paperclip,
  Menu,
  X,
  Download,
  Copy,
  Check,
  Image as ImageIcon,
  File,
  Video,
  Reply,
  Search,
  Filter,
  XCircle,
  Type,
  Smile,
} from "lucide-react";

const API_BASE = "http://localhost:5000";

// Project Type Icons & Colors
const PROJECT_TYPE_ICONS = {
  Website: Globe,
  SEO: TrendingUp,
  "Google Marketing": Package,
  SMO: Mail,
  Hosting: Server,
  "Invoice App": FileText,
};

const PROJECT_TYPE_COLORS = {
  Website: {
    bg: "bg-blue-600/20",
    text: "text-blue-400",
    border: "border-blue-500/50",
  },
  SEO: {
    bg: "bg-green-600/20",
    text: "text-green-400",
    border: "border-green-500/50",
  },
  "Google Marketing": {
    bg: "bg-purple-600/20",
    text: "text-purple-400",
    border: "border-purple-500/50",
  },
  SMO: {
    bg: "bg-orange-600/20",
    text: "text-orange-400",
    border: "border-orange-500/50",
  },
  Hosting: {
    bg: "bg-cyan-600/20",
    text: "text-cyan-400",
    border: "border-cyan-500/50",
  },
  "Invoice App": {
    bg: "bg-pink-600/20",
    text: "text-pink-400",
    border: "border-pink-500/50",
  },
};

const ProjectDetailPage = ({ projectId, userRole, userId, onBack }) => {
  const [project, setProject] = useState(null);
  const [messages, setMessages] = useState([]);
  const [allMessages, setAllMessages] = useState([]);
  const [newMessage, setNewMessage] = useState("");
  const [loading, setLoading] = useState(true);
  const [sending, setSending] = useState(false);
  const [notification, setNotification] = useState(null);
  const [copiedText, setCopiedText] = useState(null);
  const [selectedFiles, setSelectedFiles] = useState([]);
  const [replyingTo, setReplyingTo] = useState(null);
  const [searchTerm, setSearchTerm] = useState("");
  const [searchSender, setSearchSender] = useState("");
  const [dateFilter, setDateFilter] = useState({ start: "", end: "" });
  const [showFilters, setShowFilters] = useState(false);
  const [showFormatting, setShowFormatting] = useState(false);
  const [showEmojiPicker, setShowEmojiPicker] = useState(null);
  const commonEmojis = ["👍", "❤️", "😂", "😮", "😢", "🎉", "🔥", "👏"];
  const messagesEndRef = useRef(null);
  const chatContainerRef = useRef(null);
  const fileInputRef = useRef(null);
  const textareaRef = useRef(null);
  const wsRef = useRef(null);
  const prevMessagesLengthRef = useRef(0);

  useEffect(() => {
    fetchProjectDetails();
    fetchMessages();

    // WebSocket connection for real-time messages
    const token = localStorage.getItem("token");
    const ws = new WebSocket(`ws://localhost:5000`);
    wsRef.current = ws;

    ws.onopen = () => {
      console.log("WebSocket connected for project messages");
      // Authenticate
      ws.send(JSON.stringify({ type: "authenticate", token }));
    };

    ws.onmessage = (event) => {
      try {
        const data = JSON.parse(event.data);

        if (data.type === "authenticated") {
          console.log("WebSocket authenticated");
        } else if (data.type === "project_message" && data.projectId === projectId) {
          // Received a new message for this project, refresh messages
          console.log("Received real-time project message");
          fetchMessages();
        }
      } catch (error) {
        console.error("WebSocket message error:", error);
      }
    };

    ws.onerror = (error) => {
      console.error("WebSocket error:", error);
    };

    ws.onclose = () => {
      console.log("WebSocket disconnected");
    };

    return () => {
      if (ws.readyState === WebSocket.OPEN || ws.readyState === WebSocket.CONNECTING) {
        ws.close();
      }
      wsRef.current = null;
    };
  }, [projectId]);

  // Auto-scroll only when new messages are added (not when reactions update)
  useEffect(() => {
    if (messages.length > prevMessagesLengthRef.current) {
      scrollToBottom();
    }
    prevMessagesLengthRef.current = messages.length;
  }, [messages]);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  };

  const fetchProjectDetails = async () => {
    try {
      const token = localStorage.getItem("token");
      const res = await axios.get(`${API_BASE}/api/projects/${projectId}`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      setProject(res.data);
    } catch (error) {
      console.error("Error fetching project:", error);
      showNotification("Error loading project details", "error");
    } finally {
      setLoading(false);
    }
  };

  const fetchMessages = async () => {
    try {
      const token = localStorage.getItem("token");
      const params = new URLSearchParams();
      if (searchTerm) params.append("search", searchTerm);
      if (searchSender) params.append("senderName", searchSender);
      if (dateFilter.start) params.append("startDate", dateFilter.start);
      if (dateFilter.end) params.append("endDate", dateFilter.end);

      const queryString = params.toString();
      const url = `${API_BASE}/api/projects/${projectId}/messages${queryString ? `?${queryString}` : ""}`;

      const res = await axios.get(url, {
        headers: { Authorization: `Bearer ${token}` },
      });
      setMessages(res.data);
      setAllMessages(res.data);
    } catch (error) {
      console.error("Error fetching messages:", error);
    }
  };

  // Re-fetch when filters change
  useEffect(() => {
    if (projectId) {
      fetchMessages();
    }
  }, [searchTerm, searchSender, dateFilter]);

  const handleSendMessage = async (e) => {
    e.preventDefault();
    if (!newMessage.trim() && selectedFiles.length === 0) return;

    setSending(true);
    try {
      const token = localStorage.getItem("token");
      const formData = new FormData();
      formData.append("message", newMessage || "(File attachment)");
      formData.append("sentBy", userId);
      formData.append("senderType", userRole);

      if (replyingTo) {
        formData.append("replyTo", replyingTo._id);
      }

      // Append files
      selectedFiles.forEach((file) => {
        formData.append("files", file);
      });

      const response = await axios.post(
        `${API_BASE}/api/projects/${projectId}/messages`,
        formData,
        {
          headers: {
            Authorization: `Bearer ${token}`,
            "Content-Type": "multipart/form-data",
          },
        }
      );

      // Broadcast via WebSocket for real-time updates
      if (wsRef.current && wsRef.current.readyState === WebSocket.OPEN) {
        wsRef.current.send(JSON.stringify({
          type: "project_message",
          projectId: projectId,
          messageData: response.data
        }));
      }

      setNewMessage("");
      setSelectedFiles([]);
      setReplyingTo(null);
      fetchMessages();
      showNotification("Message sent successfully!", "success");
    } catch (error) {
      console.error("Error sending message:", error);
      showNotification("Failed to send message", "error");
    } finally {
      setSending(false);
    }
  };

  const handleFileSelect = (e) => {
    const files = Array.from(e.target.files || []);
    if (files.length + selectedFiles.length > 5) {
      showNotification("Maximum 5 files allowed", "error");
      return;
    }
    setSelectedFiles([...selectedFiles, ...files]);
  };

  const removeFile = (index) => {
    setSelectedFiles(selectedFiles.filter((_, i) => i !== index));
  };

  const handleReply = (message) => {
    setReplyingTo(message);
    document.querySelector('textarea')?.focus();
  };

  const handleReaction = async (messageId, emoji) => {
    try {
      const token = localStorage.getItem("token");
      const response = await fetch(
        `${API_BASE}/api/projects/${projectId}/messages/${messageId}/react`,
        {
          method: "POST",
          headers: {
            Authorization: `Bearer ${token}`,
            "Content-Type": "application/json",
          },
          body: JSON.stringify({ emoji }),
        }
      );

      if (!response.ok) {
        throw new Error("Failed to add reaction");
      }

      // Refresh messages to show updated reactions
      await fetchMessages();
      setShowEmojiPicker(null);
    } catch (error) {
      console.error("Error adding reaction:", error);
      showNotification("Failed to add reaction", "error");
    }
  };

  const clearFilters = () => {
    setSearchTerm("");
    setSearchSender("");
    setDateFilter({ start: "", end: "" });
  };

  const getFileIcon = (fileType) => {
    switch (fileType) {
      case "image":
        return <ImageIcon className="w-4 h-4" />;
      case "video":
        return <Video className="w-4 h-4" />;
      default:
        return <File className="w-4 h-4" />;
    }
  };

  const showNotification = (message, type) => {
    setNotification({ message, type });
    setTimeout(() => setNotification(null), 3000);
  };

  const getProjectStatus = (project) => {
    const today = new Date();
    const endDate = new Date(project.endDate);

    if (project.status === "Completed") return "completed";
    if (project.status === "Inactive") return "inactive";
    if (endDate < today) return "needsRenewal";
    if (project.status === "Active") return "active";
    return "inactive";
  };

  const copyToClipboard = (text) => {
    navigator.clipboard.writeText(text);
    setCopiedText(text);
    setTimeout(() => setCopiedText(null), 2000);
    showNotification("Copied to clipboard!", "success");
  };

  // Format text helpers
  const insertFormatting = (before, after = before) => {
    const textarea = textareaRef.current;
    if (!textarea) return;

    const start = textarea.selectionStart;
    const end = textarea.selectionEnd;
    const selectedText = newMessage.substring(start, end);
    const beforeText = newMessage.substring(0, start);
    const afterText = newMessage.substring(end);

    const newText = beforeText + before + selectedText + after + afterText;
    setNewMessage(newText);

    setTimeout(() => {
      textarea.focus();
      const newPos = start + before.length + selectedText.length;
      textarea.setSelectionRange(newPos, newPos);
    }, 0);
  };

  const formatBold = () => insertFormatting("**");
  const formatItalic = () => insertFormatting("*");
  const formatCode = () => insertFormatting("`");
  const formatStrikethrough = () => insertFormatting("~~");
  const formatHeading = () => {
    const textarea = textareaRef.current;
    if (!textarea) return;
    const start = textarea.selectionStart;
    const lineStart = newMessage.lastIndexOf("\n", start - 1) + 1;
    const beforeLine = newMessage.substring(0, lineStart);
    const afterLine = newMessage.substring(lineStart);
    setNewMessage(beforeLine + "## " + afterLine);
    setTimeout(() => {
      textarea.focus();
      textarea.setSelectionRange(lineStart + 3, lineStart + 3);
    }, 0);
  };
  const formatBullet = () => {
    const textarea = textareaRef.current;
    if (!textarea) return;
    const start = textarea.selectionStart;
    const lineStart = newMessage.lastIndexOf("\n", start - 1) + 1;
    const beforeLine = newMessage.substring(0, lineStart);
    const afterLine = newMessage.substring(lineStart);
    setNewMessage(beforeLine + "- " + afterLine);
    setTimeout(() => {
      textarea.focus();
      textarea.setSelectionRange(lineStart + 2, lineStart + 2);
    }, 0);
  };
  const formatNumbered = () => {
    const textarea = textareaRef.current;
    if (!textarea) return;
    const start = textarea.selectionStart;
    const lineStart = newMessage.lastIndexOf("\n", start - 1) + 1;
    const beforeLine = newMessage.substring(0, lineStart);
    const afterLine = newMessage.substring(lineStart);
    setNewMessage(beforeLine + "1. " + afterLine);
    setTimeout(() => {
      textarea.focus();
      textarea.setSelectionRange(lineStart + 3, lineStart + 3);
    }, 0);
  };

  const exportChat = () => {
    const chatContent = messages
      .map(
        (m) =>
          `[${new Date(m.createdAt).toLocaleString()}] ${
            m.sentBy?.name || m.sentBy?.clientName || "Unknown"
          }: ${m.message}`
      )
      .join("\n\n");

    const blob = new Blob([chatContent], { type: "text/plain" });
    const url = window.URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `project-chat-${project?.projectName}-${
      new Date().toISOString().split("T")[0]
    }.txt`;
    a.click();
    showNotification("Chat exported successfully!", "success");
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-[#141a21] via-[#191f2b] to-[#101218] flex items-center justify-center">
        <div className="text-center">
          <div className="w-12 h-12 border-4 border-blue-500/20 border-t-blue-500 rounded-full animate-spin mx-auto mb-4"></div>
          <p className="text-gray-400">Loading project details...</p>
        </div>
      </div>
    );
  }

  if (!project) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-[#141a21] via-[#191f2b] to-[#101218] flex items-center justify-center">
        <div className="text-center">
          <AlertCircle className="w-12 h-12 text-red-400 mx-auto mb-4" />
          <p className="text-gray-400">Project not found</p>
          <button
            onClick={onBack}
            className="mt-4 px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg transition-colors"
          >
            Go Back
          </button>
        </div>
      </div>
    );
  }

  const status = getProjectStatus(project);
  const colors = PROJECT_TYPE_COLORS[project.type];
  const Icon = PROJECT_TYPE_ICONS[project.type];

  return (
    <div className="min-h-screen bg-gradient-to-br from-[#141a21] via-[#191f2b] to-[#101218] text-blue-100">
      {/* Notification Toast */}
      {notification && (
        <div
          className={`fixed top-4 right-4 z-50 px-6 py-4 rounded-lg shadow-2xl border flex items-center gap-3 animate-slide-in ${
            notification.type === "success"
              ? "bg-green-600/90 border-green-500 text-white"
              : "bg-red-600/90 border-red-500 text-white"
          }`}
        >
          {notification.type === "success" ? (
            <CheckCircle className="w-5 h-5" />
          ) : (
            <AlertCircle className="w-5 h-5" />
          )}
          <span className="font-medium">{notification.message}</span>
        </div>
      )}

      {/* Header */}
      <div className="sticky top-0 z-30 bg-[#191f2b]/95 backdrop-blur-sm border-b border-[#232945]">
        <div className="px-4 sm:px-6 lg:px-8 py-4">
          <div className="flex items-center gap-3 sm:gap-4">
            <button
              onClick={onBack}
              className="p-2 rounded-lg text-gray-400 hover:text-white hover:bg-[#0f1419] transition-all"
              title="Go back"
            >
              <ArrowLeft className="w-5 h-5" />
            </button>
            <div className="flex items-center gap-2 sm:gap-3 flex-1 min-w-0">
              <Icon
                className={`w-5 h-5 sm:w-6 sm:h-6 ${colors.text} flex-shrink-0`}
              />
              <div className="min-w-0 flex-1">
                <h1 className="text-lg sm:text-xl lg:text-2xl font-bold text-white truncate">
                  {project.projectName}
                </h1>
                <p className="text-xs sm:text-sm text-gray-400 truncate">
                  {project.client?.businessName || project.client?.clientName}
                </p>
              </div>
            </div>
            <span
              className={`px-2 sm:px-3 py-1 rounded-full text-xs font-medium ${colors.bg} ${colors.text} border ${colors.border} flex-shrink-0`}
            >
              {project.type}
            </span>
          </div>
        </div>
      </div>

      {/* Main Content */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4 sm:gap-6 p-4 sm:p-6 lg:p-8">
        {/* Left Column - Project Details */}
        <div className="lg:col-span-1 space-y-4 sm:space-y-6">
          {/* Project Info Card */}
          <div className="bg-[#191f2b]/70 rounded-xl shadow-xl border border-[#232945] p-4 sm:p-6">
            <h2 className="text-base sm:text-lg font-semibold text-white mb-4 flex items-center gap-2">
              <FileText className="w-5 h-5 text-blue-400" />
              Project Information
            </h2>

            <div className="space-y-4">
              <div>
                <p className="text-xs sm:text-sm text-gray-400 mb-1">Status</p>
                <span
                  className={`inline-flex items-center gap-2 px-3 py-1.5 rounded-full text-xs font-medium ${
                    status === "active"
                      ? "bg-green-500/20 text-green-400 border border-green-500/50"
                      : status === "completed"
                      ? "bg-purple-500/20 text-purple-400 border border-purple-500/50"
                      : status === "needsRenewal"
                      ? "bg-orange-500/20 text-orange-400 border border-orange-500/50"
                      : "bg-red-500/20 text-red-400 border border-red-500/50"
                  }`}
                >
                  <div
                    className={`w-2 h-2 rounded-full ${
                      status === "active"
                        ? "bg-green-400"
                        : status === "completed"
                        ? "bg-purple-400"
                        : status === "needsRenewal"
                        ? "bg-orange-400"
                        : "bg-red-400"
                    }`}
                  ></div>
                  {status === "active"
                    ? "Active"
                    : status === "completed"
                    ? "Completed"
                    : status === "needsRenewal"
                    ? "Needs Renewal"
                    : "Inactive"}
                </span>
              </div>

              <div>
                <p className="text-xs sm:text-sm text-gray-400 mb-1">
                  Priority
                </p>
                <span
                  className={`inline-flex px-3 py-1 rounded-full text-xs font-medium ${
                    project.priority === "High"
                      ? "bg-red-500/20 text-red-400 border border-red-500/50"
                      : project.priority === "Medium"
                      ? "bg-yellow-500/20 text-yellow-400 border border-yellow-500/50"
                      : "bg-blue-500/20 text-blue-400 border border-blue-500/50"
                  }`}
                >
                  {project.priority || "Medium"}
                </span>
              </div>

              <div>
                <p className="text-xs sm:text-sm text-gray-400 mb-1 flex items-center gap-1">
                  <Calendar className="w-3 h-3" />
                  Start Date
                </p>
                <p className="text-sm sm:text-base text-white">
                  {project.startDate
                    ? new Date(project.startDate).toLocaleDateString()
                    : "N/A"}
                </p>
              </div>

              <div>
                <p className="text-xs sm:text-sm text-gray-400 mb-1 flex items-center gap-1">
                  <Calendar className="w-3 h-3" />
                  End Date
                </p>
                <p className="text-sm sm:text-base text-white">
                  {project.endDate
                    ? new Date(project.endDate).toLocaleDateString()
                    : "N/A"}
                </p>
              </div>

              {project.budget && (
                <div>
                  <p className="text-xs sm:text-sm text-gray-400 mb-1">
                    Budget
                  </p>
                  <p className="text-sm sm:text-base text-white font-semibold">
                    ₹{project.budget}
                  </p>
                </div>
              )}
            </div>
          </div>

          {/* Team Members Card */}
          <div className="bg-[#191f2b]/70 rounded-xl shadow-xl border border-[#232945] p-4 sm:p-6">
            <h2 className="text-base sm:text-lg font-semibold text-white mb-4 flex items-center gap-2">
              <Users className="w-5 h-5 text-purple-400" />
              Team Members
            </h2>

            <div className="space-y-3">
              {project.assignedTo?.map((emp, idx) => (
                <div
                  key={idx}
                  className="flex items-center gap-3 p-3 bg-[#0f1419] rounded-lg border border-[#232945]"
                >
                  <div className="w-10 h-10 rounded-full bg-gradient-to-br from-purple-500 to-pink-500 flex items-center justify-center text-white font-semibold flex-shrink-0">
                    {(emp.name || "U").charAt(0).toUpperCase()}
                  </div>
                  <div className="min-w-0 flex-1">
                    <p className="text-white font-medium text-sm truncate">
                      {emp.name || "Unknown"}
                    </p>
                    <p className="text-xs text-gray-400 truncate">
                      {emp.email || "No email"}
                    </p>
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Description Card */}
          {project.description && (
            <div className="bg-[#191f2b]/70 rounded-xl shadow-xl border border-[#232945] p-4 sm:p-6">
              <h2 className="text-base sm:text-lg font-semibold text-white mb-4">
                Description
              </h2>
              <p className="text-sm text-gray-300 leading-relaxed break-words">
                {project.description}
              </p>
            </div>
          )}
        </div>

        {/* Right Column - Chat/Conversation */}
        <div className="lg:col-span-2">
          <div className="bg-[#191f2b]/70 rounded-xl shadow-xl border border-[#232945] h-[calc(100vh-12rem)] lg:h-[calc(100vh-10rem)] flex flex-col">
            {/* Chat Header */}
            <div className="p-4 sm:p-6 border-b border-[#232945] space-y-3">
              <div className="flex items-center justify-between">
                <div>
                  <h2 className="text-base sm:text-lg font-semibold text-white flex items-center gap-2">
                    <Mail className="w-5 h-5 text-blue-400" />
                    Project Conversation
                  </h2>
                  <p className="text-xs sm:text-sm text-gray-400 mt-1">
                    {messages.length} message{messages.length !== 1 ? "s" : ""}
                  </p>
                </div>

                <div className="flex gap-2">
                  <button
                    onClick={() => setShowFilters(!showFilters)}
                    className="flex items-center gap-2 px-3 py-2 rounded-lg bg-blue-600/20 hover:bg-blue-600/40 text-blue-400 border border-blue-500/30 transition-colors text-sm"
                    title="Toggle filters"
                  >
                    <Filter className="w-4 h-4" />
                    <span className="hidden sm:inline">Filters</span>
                  </button>
                  <button
                    onClick={exportChat}
                    className="flex items-center gap-2 px-3 py-2 rounded-lg bg-green-600/20 hover:bg-green-600/40 text-green-400 border border-green-500/30 transition-colors text-sm"
                    title="Export chat"
                  >
                    <Download className="w-4 h-4" />
                    <span className="hidden sm:inline">Export</span>
                  </button>
                </div>
              </div>

              {/* Search and Filters */}
              {showFilters && (
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3 pt-3 border-t border-[#232945]">
                  <div className="relative">
                    <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 w-4 h-4 text-gray-400" />
                    <input
                      type="text"
                      placeholder="Search messages..."
                      value={searchTerm}
                      onChange={(e) => setSearchTerm(e.target.value)}
                      className="w-full pl-10 pr-4 py-2 bg-[#0f1419] border border-[#232945] rounded-lg text-white text-sm placeholder-gray-500 focus:outline-none focus:border-purple-500"
                    />
                  </div>

                  <input
                    type="text"
                    placeholder="Filter by sender..."
                    value={searchSender}
                    onChange={(e) => setSearchSender(e.target.value)}
                    className="px-4 py-2 bg-[#0f1419] border border-[#232945] rounded-lg text-white text-sm placeholder-gray-500 focus:outline-none focus:border-purple-500"
                  />

                  <input
                    type="date"
                    placeholder="Start date"
                    value={dateFilter.start}
                    onChange={(e) => setDateFilter({ ...dateFilter, start: e.target.value })}
                    className="px-4 py-2 bg-[#0f1419] border border-[#232945] rounded-lg text-white text-sm focus:outline-none focus:border-purple-500"
                  />

                  <div className="flex gap-2">
                    <input
                      type="date"
                      placeholder="End date"
                      value={dateFilter.end}
                      onChange={(e) => setDateFilter({ ...dateFilter, end: e.target.value })}
                      className="flex-1 px-4 py-2 bg-[#0f1419] border border-[#232945] rounded-lg text-white text-sm focus:outline-none focus:border-purple-500"
                    />
                    {(searchTerm || searchSender || dateFilter.start || dateFilter.end) && (
                      <button
                        onClick={clearFilters}
                        className="px-3 py-2 bg-red-600/20 hover:bg-red-600/40 text-red-400 rounded-lg border border-red-500/30 transition-colors"
                        title="Clear filters"
                      >
                        <XCircle className="w-4 h-4" />
                      </button>
                    )}
                  </div>
                </div>
              )}
            </div>

            {/* Messages Container */}
            <div
              ref={chatContainerRef}
              className="flex-1 overflow-y-auto p-4 sm:p-6 space-y-4"
            >
              {messages.length === 0 ? (
                <div className="flex flex-col items-center justify-center h-full text-center">
                  <Mail className="w-12 h-12 sm:w-16 sm:h-16 text-gray-600 mb-4" />
                  <p className="text-gray-500 text-sm sm:text-base">
                    No messages yet
                  </p>
                  <p className="text-gray-600 text-xs sm:text-sm mt-2">
                    Start the conversation by sending a message
                  </p>
                </div>
              ) : (
                messages.map((msg, idx) => {
                  const isOwnMessage =
                    msg.sentBy?._id === userId || msg.sentBy === userId;
                  const senderName =
                    msg.sentBy?.name || msg.sentBy?.clientName || "Unknown";
                  const senderType = msg.senderType || "user";

                  return (
                    <div
                      key={idx}
                      className={`flex ${
                        isOwnMessage ? "justify-end" : "justify-start"
                      }`}
                    >
                      <div
                        className={`max-w-[85%] sm:max-w-[75%] ${
                          isOwnMessage ? "items-end" : "items-start"
                        } flex flex-col`}
                      >
                        <div className="flex items-center gap-2 mb-1 px-1">
                          {!isOwnMessage && (
                            <div className="w-6 h-6 rounded-full bg-gradient-to-br from-purple-500 to-pink-500 flex items-center justify-center text-white text-xs font-semibold flex-shrink-0">
                              {senderName.charAt(0).toUpperCase()}
                            </div>
                          )}
                          <span className="text-xs text-gray-400 truncate">
                            {senderName}
                            {senderType === "client" && " (Client)"}
                            {senderType === "superadmin" && " (Admin)"}
                          </span>
                        </div>

                        <div
                          className={`relative group ${
                            isOwnMessage
                              ? "bg-gradient-to-r from-purple-600 to-pink-600"
                              : "bg-[#0f1419] border border-[#232945]"
                          } rounded-lg p-3 sm:p-4 overflow-hidden`}
                        >
                          {/* Reply Preview */}
                          {msg.replyTo && (
                            <div className="mb-2 p-2 bg-black/20 rounded border-l-2 border-purple-400/50 overflow-hidden" style={{ wordBreak: 'break-word', overflowWrap: 'anywhere' }}>
                              <div className="flex items-center gap-1 mb-1">
                                <Reply className="w-3 h-3 text-purple-400 flex-shrink-0" />
                                <span className="text-xs text-purple-300 font-semibold truncate">
                                  {msg.replyTo.sentBy ?
                                    (msg.replyTo.sentBy.name || msg.replyTo.sentBy.clientName || "Unknown User") :
                                    "Unknown User"}
                                </span>
                              </div>
                              <div className="text-xs text-gray-300 overflow-hidden" style={{
                                display: '-webkit-box',
                                WebkitLineClamp: 2,
                                WebkitBoxOrient: 'vertical',
                                wordBreak: 'break-word',
                                overflowWrap: 'anywhere'
                              }}>
                                {msg.replyTo.message || "(No message content)"}
                              </div>
                            </div>
                          )}

                          {/* Message with Markdown rendering */}
                          {msg.message && (
                            <div className="text-white text-sm leading-relaxed break-words prose prose-invert prose-sm max-w-none">
                              <ReactMarkdown
                                remarkPlugins={[remarkGfm]}
                                rehypePlugins={[rehypeRaw]}
                                components={{
                                  p: ({ children }) => <p className="mb-1 last:mb-0">{children}</p>,
                                  h1: ({ children }) => <h1 className="text-lg font-bold mb-1">{children}</h1>,
                                  h2: ({ children }) => <h2 className="text-base font-bold mb-1">{children}</h2>,
                                  h3: ({ children }) => <h3 className="text-sm font-bold mb-1">{children}</h3>,
                                  ul: ({ children }) => <ul className="list-disc list-inside mb-1">{children}</ul>,
                                  ol: ({ children }) => <ol className="list-decimal list-inside mb-1">{children}</ol>,
                                  li: ({ children }) => <li className="ml-2">{children}</li>,
                                  code: ({ inline, children }) =>
                                    inline ? (
                                      <code className="bg-black/30 px-1 rounded text-xs">{children}</code>
                                    ) : (
                                      <code className="block bg-black/30 p-2 rounded text-xs overflow-x-auto">{children}</code>
                                    ),
                                  strong: ({ children }) => <strong className="font-bold">{children}</strong>,
                                  em: ({ children }) => <em className="italic">{children}</em>,
                                  a: ({ href, children }) => (
                                    <a href={href} target="_blank" rel="noopener noreferrer" className="text-blue-300 underline hover:text-blue-200">{children}</a>
                                  ),
                                }}
                              >
                                {msg.message}
                              </ReactMarkdown>
                            </div>
                          )}

                          {/* Attachments */}
                          {msg.attachments && msg.attachments.length > 0 && (
                            <div className="mt-3 space-y-2">
                              {msg.attachments.map((att, attIdx) => (
                                <div
                                  key={attIdx}
                                  className="flex items-center gap-2 p-2 bg-black/20 rounded"
                                >
                                  {getFileIcon(att.fileType)}
                                  <div className="flex-1 min-w-0">
                                    <div className="text-xs text-white truncate">
                                      {att.filename}
                                    </div>
                                    <div className="text-xs text-gray-400">
                                      {(att.size / 1024).toFixed(1)} KB
                                    </div>
                                  </div>
                                  <a
                                    href={att.url.startsWith('http') ? att.url : `${API_BASE}${att.url}`}
                                    target="_blank"
                                    rel="noopener noreferrer"
                                    className="p-1 hover:bg-white/10 rounded"
                                    download
                                  >
                                    <Download className="w-4 h-4 text-gray-300" />
                                  </a>
                                  {att.fileType === "image" && (
                                    <img
                                      src={att.url.startsWith('http') ? att.url : `${API_BASE}${att.url}`}
                                      alt={att.filename}
                                      className="w-full max-w-sm mt-2 rounded"
                                    />
                                  )}
                                </div>
                              ))}
                            </div>
                          )}

                          {/* Reactions Display */}
                          {msg.reactions && msg.reactions.length > 0 && (
                            <div className="flex flex-wrap gap-1 mt-2">
                              {msg.reactions.map((reaction, idx) => {
                                const userReacted = reaction.users?.some(
                                  (u) => u.user === userId || u.user?._id === userId
                                );
                                return (
                                  <button
                                    key={idx}
                                    onClick={() => handleReaction(msg._id, reaction.emoji)}
                                    className={`flex items-center gap-1 px-2 py-0.5 rounded-full text-xs transition-all ${
                                      userReacted
                                        ? "bg-blue-500/30 border border-blue-400"
                                        : "bg-black/20 hover:bg-black/30"
                                    }`}
                                    title={userReacted ? "Remove reaction" : "Add reaction"}
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

                          <div className="flex items-center justify-between gap-3 mt-2">
                            <span className="text-xs text-gray-400">
                              {new Date(msg.createdAt).toLocaleTimeString([], {
                                hour: "2-digit",
                                minute: "2-digit",
                                month: "short",
                                day: "numeric",
                              })}
                            </span>

                            <div className="flex gap-1 relative">
                              <button
                                onClick={() => handleReply(msg)}
                                className="p-1.5 rounded-md hover:bg-white/10 transition-colors"
                                title="Reply to message"
                              >
                                <Reply className="w-3.5 h-3.5 text-gray-400 hover:text-purple-400" />
                              </button>
                              <button
                                onClick={() =>
                                  setShowEmojiPicker(
                                    showEmojiPicker === msg._id ? null : msg._id
                                  )
                                }
                                className="p-1.5 rounded-md hover:bg-white/10 transition-colors"
                                title="Add reaction"
                              >
                                <Smile className="w-3.5 h-3.5 text-gray-400 hover:text-yellow-400" />
                              </button>
                              <button
                                onClick={() => copyToClipboard(msg.message)}
                                className="p-1.5 rounded-md hover:bg-white/10 transition-colors"
                                title="Copy message"
                              >
                                {copiedText === msg.message ? (
                                  <Check className="w-3.5 h-3.5 text-green-400" />
                                ) : (
                                  <Copy className="w-3.5 h-3.5 text-gray-400 hover:text-blue-400" />
                                )}
                              </button>

                              {/* Emoji Picker Popup */}
                              {showEmojiPicker === msg._id && (
                                <div className={`absolute ${isOwnMessage ? 'right-0' : 'left-0'} bottom-full mb-1 p-2 bg-[#1a2332] border border-[#232945] rounded-lg shadow-xl z-10 flex gap-1`}>
                                  {commonEmojis.map((emoji, emojiIdx) => (
                                    <button
                                      key={emojiIdx}
                                      onClick={(e) => {
                                        e.stopPropagation();
                                        handleReaction(msg._id, emoji);
                                      }}
                                      className="hover:bg-white/10 p-1.5 rounded transition-colors text-lg"
                                      title={`React with ${emoji}`}
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
                  );
                })
              )}
              <div ref={messagesEndRef} />
            </div>

            {/* Message Input */}
            <div className="p-4 sm:p-6 border-t border-[#232945]">
              {/* Reply Preview */}
              {replyingTo && (
                <div className="mb-3 p-3 bg-purple-600/20 border border-purple-500/30 rounded-lg flex items-start justify-between gap-2 overflow-hidden" style={{ maxWidth: '100%' }}>
                  <div className="flex-1 min-w-0 overflow-hidden">
                    <div className="flex items-center gap-2 text-sm text-purple-300 mb-1">
                      <Reply className="w-4 h-4 flex-shrink-0" />
                      <span className="font-medium truncate">
                        Replying to {replyingTo.sentBy ?
                          (replyingTo.sentBy.name || replyingTo.sentBy.clientName || "Unknown User") :
                          "Unknown User"}
                      </span>
                    </div>
                    <div className="text-xs text-gray-300 overflow-hidden" style={{
                      display: '-webkit-box',
                      WebkitLineClamp: 3,
                      WebkitBoxOrient: 'vertical',
                      wordBreak: 'break-word',
                      overflowWrap: 'anywhere'
                    }}>
                      {replyingTo.message || "(No message content)"}
                    </div>
                  </div>
                  <button
                    onClick={() => setReplyingTo(null)}
                    className="p-1 hover:bg-white/10 rounded flex-shrink-0"
                    title="Cancel reply"
                  >
                    <XCircle className="w-4 h-4 text-gray-400 hover:text-red-400" />
                  </button>
                </div>
              )}

              {/* Selected Files Preview */}
              {selectedFiles.length > 0 && (
                <div className="mb-3 flex flex-wrap gap-2">
                  {selectedFiles.map((file, idx) => (
                    <div
                      key={idx}
                      className="flex items-center gap-2 px-3 py-2 bg-purple-600/20 border border-purple-500/30 rounded-lg"
                    >
                      <File className="w-4 h-4 text-purple-300" />
                      <span className="text-xs text-white truncate max-w-[150px]">
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
              )}

              {/* Formatting Toolbar */}
              {showFormatting && (
                <div className="mb-3 p-3 bg-[#0f1419] border border-[#232945] rounded-lg">
                  <div className="flex flex-wrap gap-2 mb-3">
                    <button type="button" onClick={formatBold} className="px-3 py-1.5 bg-[#232945] hover:bg-[#2a3142] rounded text-xs font-bold text-white transition-colors" title="Bold (Ctrl+B)">
                      <span className="font-bold">B</span>
                    </button>
                    <button type="button" onClick={formatItalic} className="px-3 py-1.5 bg-[#232945] hover:bg-[#2a3142] rounded text-xs italic text-white transition-colors" title="Italic (Ctrl+I)">
                      <span className="italic">I</span>
                    </button>
                    <button type="button" onClick={formatStrikethrough} className="px-3 py-1.5 bg-[#232945] hover:bg-[#2a3142] rounded text-xs text-white transition-colors" title="Strikethrough (Ctrl+U)">
                      <span className="line-through">S</span>
                    </button>
                    <button type="button" onClick={formatCode} className="px-3 py-1.5 bg-[#232945] hover:bg-[#2a3142] rounded text-xs font-mono text-white transition-colors" title="Code (Ctrl+E)">
                      &lt;/&gt;
                    </button>
                    <button type="button" onClick={formatHeading} className="px-3 py-1.5 bg-[#232945] hover:bg-[#2a3142] rounded text-xs font-bold text-white transition-colors" title="Heading (Ctrl+D)">
                      H1
                    </button>
                    <button type="button" onClick={formatBullet} className="px-3 py-1.5 bg-[#232945] hover:bg-[#2a3142] rounded text-xs text-white transition-colors" title="Bullet List (Ctrl+L)">
                      • List
                    </button>
                    <button type="button" onClick={formatNumbered} className="px-3 py-1.5 bg-[#232945] hover:bg-[#2a3142] rounded text-xs text-white transition-colors" title="Numbered List (Ctrl+Shift+L)">
                      1. List
                    </button>
                  </div>
                  <div className="text-xs text-gray-500 space-y-1">
                    <div><strong>Keyboard Shortcuts:</strong> Ctrl+B (Bold) • Ctrl+I (Italic) • Ctrl+U (Strike) • Ctrl+E/K (Code) • Ctrl+D (Heading) • Ctrl+L (Bullet) • Ctrl+Shift+L (Numbered)</div>
                    <div><strong>Markdown:</strong> **bold** *italic* ~~strikethrough~~ `code` ## Heading - Bullet 1. Numbered</div>
                  </div>
                </div>
              )}

              <form
                onSubmit={handleSendMessage}
                className="flex gap-2 sm:gap-3"
              >
                <input
                  ref={fileInputRef}
                  type="file"
                  multiple
                  accept="image/*,video/*,.pdf,.doc,.docx,.xls,.xlsx,.txt"
                  onChange={handleFileSelect}
                  className="hidden"
                />

                <button
                  type="button"
                  onClick={() => fileInputRef.current?.click()}
                  className="flex-shrink-0 px-3 py-3 bg-gray-600/20 hover:bg-gray-600/40 text-gray-300 rounded-lg transition-colors"
                  title="Attach files"
                >
                  <Paperclip className="w-5 h-5" />
                </button>

                <button
                  type="button"
                  onClick={() => setShowFormatting(!showFormatting)}
                  className="flex-shrink-0 px-3 py-3 bg-gray-600/20 hover:bg-gray-600/40 text-gray-300 rounded-lg transition-colors"
                  title="Text formatting"
                >
                  <Type className="w-5 h-5" />
                </button>

                <div className="flex-1 relative">
                  <textarea
                    ref={textareaRef}
                    value={newMessage}
                    onChange={(e) => {
                      setNewMessage(e.target.value);
                      // Auto-scroll to bottom when typing
                      scrollToBottom();
                    }}
                    onFocus={() => {
                      // Scroll to bottom when focused
                      scrollToBottom();
                    }}
                    onKeyDown={(e) => {
                      // Send message on Enter (without Shift)
                      if (e.key === "Enter" && !e.shiftKey && !e.ctrlKey && !e.metaKey) {
                        e.preventDefault();
                        handleSendMessage(e);
                        return;
                      }

                      // Keyboard shortcuts (Ctrl/Cmd + key)
                      const isMac = /Mac|iPad|iPhone|iPod/.test(navigator.platform);
                      const isCtrlOrCmd = isMac ? e.metaKey : e.ctrlKey;

                      // Check if we should handle this shortcut
                      if (isCtrlOrCmd) {
                        const key = e.key.toLowerCase();
                        let handled = false;

                        // Check for Ctrl+Shift combinations
                        if (e.shiftKey) {
                          if (key === 'l') {
                            e.preventDefault();
                            e.stopPropagation();
                            formatNumbered();
                            handled = true;
                          }
                        } else {
                          // Regular Ctrl shortcuts
                          switch (key) {
                            case 'b':
                              e.preventDefault();
                              e.stopPropagation();
                              formatBold();
                              handled = true;
                              break;
                            case 'i':
                              e.preventDefault();
                              e.stopPropagation();
                              formatItalic();
                              handled = true;
                              break;
                            case 'u':
                              e.preventDefault();
                              e.stopPropagation();
                              formatStrikethrough();
                              handled = true;
                              break;
                            case 'e':
                            case 'k':
                              e.preventDefault();
                              e.stopPropagation();
                              formatCode();
                              handled = true;
                              break;
                            case 'd':
                              // Use Ctrl+D for heading (less likely to conflict)
                              e.preventDefault();
                              e.stopPropagation();
                              formatHeading();
                              handled = true;
                              break;
                            case 'l':
                              e.preventDefault();
                              e.stopPropagation();
                              formatBullet();
                              handled = true;
                              break;
                          }
                        }

                        if (handled) {
                          return false;
                        }
                      }
                    }}
                    placeholder="Type your message... (Ctrl+B for bold, Ctrl+I for italic)"
                    className="w-full px-4 py-3 bg-[#0f1419] border border-[#232945] rounded-lg text-white text-sm placeholder-gray-500 focus:outline-none focus:border-purple-500 transition-colors resize-none overflow-y-auto"
                    rows="2"
                    style={{ maxHeight: "150px" }}
                  />
                </div>

                <button
                  type="submit"
                  disabled={sending || (!newMessage.trim() && selectedFiles.length === 0)}
                  className="flex-shrink-0 px-4 sm:px-6 py-3 bg-gradient-to-r from-purple-600 to-pink-600 hover:from-purple-700 hover:to-pink-700 text-white rounded-lg transition-all disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
                >
                  {sending ? (
                    <div className="w-5 h-5 border-2 border-white/20 border-t-white rounded-full animate-spin"></div>
                  ) : (
                    <>
                      <Send className="w-4 h-4 sm:w-5 sm:h-5" />
                      <span className="hidden sm:inline">Send</span>
                    </>
                  )}
                </button>
              </form>
              <p className="text-xs text-gray-500 mt-2">
                <span className="font-medium">Shortcuts:</span> Shift+Enter (new line) • Ctrl+B (bold) • Ctrl+I (italic) • Max 5 files • Click formatting button for more options
              </p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default ProjectDetailPage;
