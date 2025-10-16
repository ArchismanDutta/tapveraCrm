import React, { useState, useEffect, useRef } from "react";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import rehypeRaw from "rehype-raw";
import {
  Calendar,
  Clock,
  Users,
  MessageSquare,
  ChevronRight,
  Search,
  Filter,
  FileText,
  AlertCircle,
  Send,
  ArrowLeft,
  Paperclip,
  X as XCircle,
  Download,
  Copy,
  Check,
  Reply,
  Image as ImageIcon,
  File,
  Video,
  Type,
  Smile,
} from "lucide-react";
import Sidebar from "../components/dashboard/Sidebar";

const EmployeePortal = ({ onLogout }) => {
  const [collapsed, setCollapsed] = useState(false);
  const [selectedProject, setSelectedProject] = useState(null);
  const [activeTab, setActiveTab] = useState("overview");
  const [searchTerm, setSearchTerm] = useState("");
  const [projects, setProjects] = useState([]);
  const [messages, setMessages] = useState([]);
  const [newMessage, setNewMessage] = useState("");
  const [loading, setLoading] = useState(true);
  const [selectedFiles, setSelectedFiles] = useState([]);
  const [replyingTo, setReplyingTo] = useState(null);
  const [copiedText, setCopiedText] = useState(null);
  const [messageSearchTerm, setMessageSearchTerm] = useState("");
  const [searchSender, setSearchSender] = useState("");
  const [dateFilter, setDateFilter] = useState({ start: "", end: "" });
  const [showFilters, setShowFilters] = useState(false);
  const [showFormatting, setShowFormatting] = useState(false);
  const [showEmojiPicker, setShowEmojiPicker] = useState(null); // messageId or null
  const fileInputRef = useRef(null);
  const textareaRef = useRef(null);
  const wsRef = useRef(null);
  const messagesEndRef = useRef(null);
  const prevMessagesLengthRef = useRef(0);

  const commonEmojis = ["👍", "❤️", "😂", "😮", "😢", "🎉", "🔥", "👏"];

  // Fetch projects assigned to the employee
  useEffect(() => {
    fetchEmployeeProjects();
  }, []);

  // WebSocket connection for real-time messages
  useEffect(() => {
    const token = localStorage.getItem("token");
    const ws = new WebSocket(`ws://localhost:5000`);
    wsRef.current = ws;

    ws.onopen = () => {
      console.log("WebSocket connected for employee portal");
      ws.send(JSON.stringify({ type: "authenticate", token }));
    };

    ws.onmessage = (event) => {
      try {
        const data = JSON.parse(event.data);

        if (data.type === "authenticated") {
          console.log("WebSocket authenticated");
        } else if (data.type === "project_message" && data.projectId === selectedProject) {
          console.log("Received real-time project message");
          fetchProjectMessages(selectedProject);
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
  }, [selectedProject]);

  const fetchEmployeeProjects = async () => {
    try {
      setLoading(true);
      const token = localStorage.getItem("token");
      const response = await fetch('http://localhost:5000/api/projects', {
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        }
      });

      if (!response.ok) {
        throw new Error('Failed to fetch projects');
      }

      const data = await response.json();
      setProjects(data);
    } catch (error) {
      console.error("Error fetching projects:", error);
      setProjects([]);
    } finally {
      setLoading(false);
    }
  };

  const fetchProjectMessages = async (projectId) => {
    try {
      const token = localStorage.getItem("token");
      const params = new URLSearchParams();
      if (messageSearchTerm) params.append("search", messageSearchTerm);
      if (searchSender) params.append("senderName", searchSender);
      if (dateFilter.start) params.append("startDate", dateFilter.start);
      if (dateFilter.end) params.append("endDate", dateFilter.end);

      const queryString = params.toString();
      const url = `http://localhost:5000/api/projects/${projectId}/messages${queryString ? `?${queryString}` : ""}`;

      const response = await fetch(url, {
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        }
      });

      if (!response.ok) {
        throw new Error('Failed to fetch messages');
      }

      const data = await response.json();
      setMessages(data);
    } catch (error) {
      console.error("Error fetching messages:", error);
      setMessages([]);
    }
  };

  // Re-fetch when filters change
  useEffect(() => {
    if (selectedProject) {
      fetchProjectMessages(selectedProject);
    }
  }, [messageSearchTerm, searchSender, dateFilter]);

  // Auto-scroll only when new messages are added (not when reactions update)
  useEffect(() => {
    if (messages.length > prevMessagesLengthRef.current) {
      scrollToBottom();
    }
    prevMessagesLengthRef.current = messages.length;
  }, [messages]);

  const clearFilters = () => {
    setMessageSearchTerm("");
    setSearchSender("");
    setDateFilter({ start: "", end: "" });
  };

  const getStatusColor = (status) => {
    switch (status?.toLowerCase()) {
      case "in progress":
        return "bg-blue-100 text-blue-800";
      case "active":
        return "bg-green-600/20 text-green-800";
      case "completed":
        return "bg-blue-500/10 text-white";
      case "pending":
        return "bg-yellow-600/20 text-yellow-800";
      default:
        return "bg-blue-500/10 text-white";
    }
  };

  const handleFileSelect = (e) => {
    const files = Array.from(e.target.files || []);
    if (files.length + selectedFiles.length > 5) {
      alert("Maximum 5 files allowed");
      return;
    }
    setSelectedFiles([...selectedFiles, ...files]);
  };

  const removeFile = (index) => {
    setSelectedFiles(selectedFiles.filter((_, i) => i !== index));
  };

  const handleReply = (message) => {
    setReplyingTo(message);
  };

  const scrollToMessage = (messageId) => {
    const element = document.getElementById(`message-${messageId}`);
    if (element) {
      element.scrollIntoView({ behavior: "smooth", block: "center" });
      // Highlight the message briefly
      element.classList.add("bg-blue-500", "bg-opacity-20");
      setTimeout(() => {
        element.classList.remove("bg-blue-500", "bg-opacity-20");
      }, 2000);
    }
  };

  const copyToClipboard = (text) => {
    navigator.clipboard.writeText(text);
    setCopiedText(text);
    setTimeout(() => setCopiedText(null), 2000);
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

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  };

  const handleReaction = async (messageId, emoji) => {
    try {
      const token = localStorage.getItem("token");
      const response = await fetch(
        `http://localhost:5000/api/projects/${selectedProject}/messages/${messageId}/react`,
        {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${token}`,
            'Content-Type': 'application/json'
          },
          body: JSON.stringify({ emoji })
        }
      );

      if (!response.ok) {
        throw new Error('Failed to add reaction');
      }

      // Refresh messages to show updated reactions
      await fetchProjectMessages(selectedProject);
      setShowEmojiPicker(null);
    } catch (error) {
      console.error("Error adding reaction:", error);
    }
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

  const handleSendMessage = async (e) => {
    e.preventDefault();
    if (!newMessage.trim() && selectedFiles.length === 0) return;

    try {
      const token = localStorage.getItem("token");
      const user = JSON.parse(localStorage.getItem("user") || "{}");
      const formData = new FormData();

      formData.append("message", newMessage || "(File attachment)");
      formData.append("sentBy", user._id);
      formData.append("senderType", user.role || 'employee');

      if (replyingTo) {
        formData.append("replyTo", replyingTo._id);
      }

      // Append files
      selectedFiles.forEach((file) => {
        formData.append("files", file);
      });

      const response = await fetch(`http://localhost:5000/api/projects/${selectedProject}/messages`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${token}`
        },
        body: formData
      });

      if (!response.ok) {
        throw new Error('Failed to send message');
      }

      const messageData = await response.json();

      // Broadcast via WebSocket for real-time updates
      if (wsRef.current && wsRef.current.readyState === WebSocket.OPEN) {
        wsRef.current.send(JSON.stringify({
          type: "project_message",
          projectId: selectedProject,
          messageData: messageData
        }));
      }

      // Refresh messages and clear form
      await fetchProjectMessages(selectedProject);
      setNewMessage("");
      setSelectedFiles([]);
      setReplyingTo(null);
    } catch (error) {
      console.error("Error sending message:", error);
      alert("Failed to send message. Please try again.");
    }
  };

  const filteredProjects = projects.filter(
    (project) =>
      project.projectName?.toLowerCase().includes(searchTerm.toLowerCase()) ||
      project.type?.toLowerCase().includes(searchTerm.toLowerCase()) ||
      project.client?.clientName?.toLowerCase().includes(searchTerm.toLowerCase()) ||
      project.client?.businessName?.toLowerCase().includes(searchTerm.toLowerCase())
  );

  // Project Detail View
  if (selectedProject) {
    const project = projects.find((p) => p._id === selectedProject);

    if (!project) return null;

    return (
      <div className="flex bg-gradient-to-br from-[#141a21] via-[#191f2b] to-[#101218] font-sans text-blue-100 min-h-screen">
        <Sidebar
          collapsed={collapsed}
          setCollapsed={setCollapsed}
          onLogout={onLogout}
          userRole="employee"
        />

        <main
          className={`flex-1 overflow-y-auto transition-all duration-300 ${
            collapsed ? "ml-20" : "ml-72"
          }`}
        >
          <div className="p-4 sm:p-6 lg:p-8">
        {/* Header */}
        <div className="bg-[#191f2b]/70 border-b border-[#232945] sticky top-0 z-10">
          <div className="px-4 sm:px-6 lg:px-8 py-4">
            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
              <div className="flex items-center gap-3">
                <button
                  onClick={() => setSelectedProject(null)}
                  className="flex items-center gap-2 text-blue-400 hover:text-blue-300 text-sm sm:text-base transition-colors"
                >
                  <ArrowLeft className="w-4 h-4" />
                  Back
                </button>
                <div className="min-w-0">
                  <h1 className="text-lg sm:text-2xl font-bold text-white truncate">
                    {project.projectName}
                  </h1>
                  <p className="text-xs sm:text-sm text-blue-300 truncate">
                    {project.client?.businessName || project.client?.clientName}
                  </p>
                </div>
              </div>
              <span
                className={`px-3 py-1 rounded-full text-xs sm:text-sm font-medium whitespace-nowrap ${
                  project.status === "Active" ? "bg-green-500/20 text-green-400" :
                  project.status === "Completed" ? "bg-[#232945]0/20 text-gray-400" :
                  project.status === "Inactive" ? "bg-red-500/20 text-red-400" :
                  "bg-blue-500/20 text-blue-400"
                }`}
              >
                {project.status}
              </span>
            </div>
          </div>
        </div>

        {/* Tabs */}
        <div className="bg-[#191f2b]/70 border-b border-[#232945]">
          <div className="px-4 sm:px-6 lg:px-8">
            <div className="flex gap-2 sm:gap-6 overflow-x-auto">
              {["overview", "tasks", "messages"].map((tab) => (
                <button
                  key={tab}
                  onClick={() => setActiveTab(tab)}
                  className={`py-3 sm:py-4 px-2 sm:px-4 text-sm font-medium border-b-2 whitespace-nowrap transition-colors ${
                    activeTab === tab
                      ? "border-blue-500 text-blue-400"
                      : "border-transparent text-blue-300 hover:text-white"
                  }`}
                >
                  {tab.charAt(0).toUpperCase() + tab.slice(1)}
                </button>
              ))}
            </div>
          </div>
        </div>

        {/* Content */}
        <div className="px-4 sm:px-6 lg:px-8 py-6">
          {activeTab === "overview" && (
            <div className="space-y-6">
              {/* Project Info Cards */}
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
                <div className="bg-[#191f2b]/70 p-4 sm:p-6 rounded-lg shadow-xl border border-[#232945]">
                  <div className="flex items-center gap-3">
                    <div className="p-2 bg-blue-100 rounded-lg">
                      <Calendar className="w-5 h-5 sm:w-6 sm:h-6 text-blue-600" />
                    </div>
                    <div className="min-w-0">
                      <p className="text-xs sm:text-sm text-blue-300">
                        Start Date
                      </p>
                      <p className="text-sm sm:text-base font-semibold text-white truncate">
                        {project.startDate}
                      </p>
                    </div>
                  </div>
                </div>
                <div className="bg-[#191f2b]/70 p-4 sm:p-6 rounded-lg shadow-sm border border-[#232945]">
                  <div className="flex items-center gap-3">
                    <div className="p-2 bg-red-100 rounded-lg">
                      <Clock className="w-5 h-5 sm:w-6 sm:h-6 text-red-600" />
                    </div>
                    <div className="min-w-0">
                      <p className="text-xs sm:text-sm text-blue-300">
                        End Date
                      </p>
                      <p className="text-sm sm:text-base font-semibold text-white truncate">
                        {project.endDate}
                      </p>
                    </div>
                  </div>
                </div>
                <div className="bg-[#191f2b]/70 p-4 sm:p-6 rounded-lg shadow-sm border border-[#232945]">
                  <div className="flex items-center gap-3">
                    <div className="p-2 bg-green-600/20 rounded-lg">
                      <Users className="w-5 h-5 sm:w-6 sm:h-6 text-green-600" />
                    </div>
                    <div className="min-w-0">
                      <p className="text-xs sm:text-sm text-blue-300">
                        Team Members
                      </p>
                      <p className="text-sm sm:text-base font-semibold text-white">
                        {project.assignedTo?.length || 0}
                      </p>
                    </div>
                  </div>
                </div>
                <div className="bg-[#191f2b]/70 p-4 sm:p-6 rounded-lg shadow-sm border border-[#232945]">
                  <div className="flex items-center gap-3">
                    <div className="p-2 bg-purple-100 rounded-lg">
                      <FileText className="w-5 h-5 sm:w-6 sm:h-6 text-purple-600" />
                    </div>
                    <div className="min-w-0">
                      <p className="text-xs sm:text-sm text-blue-300">
                        Project Type
                      </p>
                      <p className="text-sm sm:text-base font-semibold text-white truncate">
                        {project.type}
                      </p>
                    </div>
                  </div>
                </div>
              </div>

              {/* Project Description */}
              <div className="bg-[#191f2b]/70 p-4 sm:p-6 rounded-lg shadow-sm border border-[#232945]">
                <h3 className="text-base sm:text-lg font-semibold text-white mb-3">
                  Project Description
                </h3>
                <p className="text-sm sm:text-base text-gray-700 leading-relaxed">
                  {project.description || "No description available"}
                </p>
              </div>

              {/* Progress */}
              {project.progress !== undefined && (
                <div className="bg-[#191f2b]/70 p-4 sm:p-6 rounded-lg shadow-sm border border-[#232945]">
                  <div className="flex justify-between items-center mb-2">
                    <h3 className="text-base sm:text-lg font-semibold text-white">
                      Progress
                    </h3>
                    <span className="text-sm sm:text-base font-semibold text-blue-600">
                      {project.progress}%
                    </span>
                  </div>
                  <div className="w-full bg-gray-200 rounded-full h-2 sm:h-3">
                    <div
                      className="bg-blue-600 h-2 sm:h-3 rounded-full transition-all duration-300"
                      style={{ width: `${project.progress}%` }}
                    ></div>
                  </div>
                </div>
              )}

              {/* Team Members */}
              {project.assignedTo && project.assignedTo.length > 0 && (
                <div className="bg-[#191f2b]/70 p-4 sm:p-6 rounded-lg shadow-sm border border-[#232945]">
                  <h3 className="text-base sm:text-lg font-semibold text-white mb-4">
                    Team Members
                  </h3>
                  <div className="flex flex-wrap gap-2">
                    {project.assignedTo.map((member, index) => (
                      <span
                        key={member._id || index}
                        className="px-3 py-1 bg-blue-500/10 text-white rounded-full text-xs sm:text-sm"
                      >
                        {member.name || member.email || 'Unknown'}
                      </span>
                    ))}
                  </div>
                </div>
              )}
            </div>
          )}

          {activeTab === "tasks" && (
            <div className="bg-[#191f2b]/70 rounded-lg shadow-sm border border-[#232945]">
              <div className="p-4 sm:p-6">
                <h3 className="text-base sm:text-lg font-semibold text-white mb-4">
                  Project Tasks
                </h3>
                {project.tasks && project.tasks.length > 0 ? (
                  <div className="space-y-3">
                    {project.tasks.map((task) => (
                      <div
                        key={task.id}
                        className="flex flex-col sm:flex-row sm:items-center justify-between p-3 sm:p-4 bg-[#232945] rounded-lg gap-2"
                      >
                        <div className="flex-1 min-w-0">
                          <h4 className="text-sm sm:text-base font-medium text-white mb-1">
                            {task.name}
                          </h4>
                          <p className="text-xs sm:text-sm text-blue-300">
                            Due: {task.dueDate}
                          </p>
                        </div>
                        <span
                          className={`px-3 py-1 rounded-full text-xs font-medium ${getStatusColor(
                            task.status
                          )} whitespace-nowrap`}
                        >
                          {task.status}
                        </span>
                      </div>
                    ))}
                  </div>
                ) : (
                  <p className="text-sm sm:text-base text-blue-300">
                    No tasks available
                  </p>
                )}
              </div>
            </div>
          )}

          {activeTab === "messages" && (
            <div
              className="bg-[#191f2b]/70 rounded-lg shadow-sm border border-[#232945] flex flex-col"
              style={{ height: "calc(100vh - 300px)" }}
            >
              {/* Messages Header */}
              <div className="p-4 border-b border-[#232945] space-y-3">
                <div className="flex items-center justify-between">
                  <div>
                    <h3 className="text-base sm:text-lg font-semibold text-white">
                      Project Updates & Messages
                    </h3>
                    <p className="text-xs sm:text-sm text-blue-300 mt-1">
                      {messages.length} message{messages.length !== 1 ? "s" : ""}
                    </p>
                  </div>

                  <button
                    onClick={() => setShowFilters(!showFilters)}
                    className="flex items-center gap-2 px-3 py-2 rounded-lg bg-blue-600/20 hover:bg-blue-600/40 text-blue-400 border border-blue-500/30 transition-colors text-sm"
                    title="Toggle filters"
                  >
                    <Filter className="w-4 h-4" />
                    <span className="hidden sm:inline">Filters</span>
                  </button>
                </div>

                {/* Search and Filters */}
                {showFilters && (
                  <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3 pt-3 border-t border-[#232945]">
                    <div className="relative">
                      <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 w-4 h-4 text-gray-400" />
                      <input
                        type="text"
                        placeholder="Search messages..."
                        value={messageSearchTerm}
                        onChange={(e) => setMessageSearchTerm(e.target.value)}
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
                      {(messageSearchTerm || searchSender || dateFilter.start || dateFilter.end) && (
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

              {/* Messages List */}
              <div className="flex-1 overflow-y-auto p-4 space-y-4">
                {messages.length > 0 ? (
                  messages.map((msg) => {
                    const user = JSON.parse(localStorage.getItem("user") || "{}");
                    const isOwnMessage = msg.sentBy?._id === user._id || msg.sentBy === user._id;
                    const senderName = msg.sentBy?.name || msg.sentBy?.clientName || "Unknown";

                    return (
                    <div
                      key={msg._id}
                      className={`flex ${
                        isOwnMessage ? "justify-end" : "justify-start"
                      }`}
                    >
                      <div
                        className={`relative group max-w-xs sm:max-w-md lg:max-w-lg ${
                          isOwnMessage
                            ? "bg-blue-600 text-white"
                            : "bg-blue-500/10 text-white"
                        } rounded-lg p-3 sm:p-4`}
                      >
                        {/* Reply Preview */}
                        {msg.replyTo && (
                          <div className="mb-2 p-2 bg-black/20 rounded border-l-2 border-white/30 overflow-hidden" style={{ wordBreak: 'break-word', overflowWrap: 'anywhere' }}>
                            <div className="text-xs text-gray-300 font-semibold mb-1 truncate">
                              {msg.replyTo.sentBy?.name || msg.replyTo.sentBy?.clientName || "Unknown"}
                            </div>
                            <div className="text-xs text-gray-400 overflow-hidden" style={{
                              display: '-webkit-box',
                              WebkitLineClamp: 2,
                              WebkitBoxOrient: 'vertical',
                              wordBreak: 'break-word',
                              overflowWrap: 'anywhere'
                            }}>
                              {msg.replyTo.message}
                            </div>
                          </div>
                        )}

                        <div className="flex items-center justify-between mb-1">
                          <span className="text-xs sm:text-sm font-semibold">
                            {senderName}
                            {msg.senderType === "client" && " (Client)"}
                            {msg.senderType === "superadmin" && " (Admin)"}
                          </span>
                          <span
                            className={`text-xs ${
                              isOwnMessage
                                ? "text-blue-100"
                                : "text-gray-400"
                            }`}
                          >
                            {new Date(msg.createdAt).toLocaleTimeString([], {
                              hour: "2-digit",
                              minute: "2-digit",
                            })}
                          </span>
                        </div>

                        {/* Message with Markdown rendering */}
                        {msg.message && (
                          <div className="text-sm sm:text-base break-words prose prose-invert prose-sm max-w-none">
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
                                  href={att.url.startsWith('http') ? att.url : `http://localhost:5000${att.url}`}
                                  target="_blank"
                                  rel="noopener noreferrer"
                                  className="p-1 hover:bg-white/10 rounded"
                                  download
                                >
                                  <Download className="w-4 h-4 text-gray-300" />
                                </a>
                                {att.fileType === "image" && (
                                  <img
                                    src={att.url.startsWith('http') ? att.url : `http://localhost:5000${att.url}`}
                                    alt={att.filename}
                                    className="w-full max-w-sm mt-2 rounded"
                                  />
                                )}
                              </div>
                            ))}
                          </div>
                        )}

                        {/* Reactions */}
                        {msg.reactions && msg.reactions.length > 0 && (
                          <div className="flex flex-wrap gap-1 mt-2">
                            {msg.reactions.map((reaction, idx) => {
                              const userReacted = reaction.users?.some(
                                (u) => u.user === user._id || u.user?._id === user._id
                              );
                              return (
                                <button
                                  key={idx}
                                  onClick={() => handleReaction(msg._id, reaction.emoji)}
                                  className={`flex items-center gap-1 px-2 py-1 rounded-full text-xs transition-colors ${
                                    userReacted
                                      ? "bg-blue-500/30 border border-blue-400"
                                      : "bg-black/20 hover:bg-black/30"
                                  }`}
                                  title={`${reaction.users?.length || 0} reaction${reaction.users?.length !== 1 ? 's' : ''}`}
                                >
                                  <span>{reaction.emoji}</span>
                                  <span className="text-gray-300">{reaction.users?.length || 0}</span>
                                </button>
                              );
                            })}
                          </div>
                        )}

                        <div className="flex items-center justify-between mt-2">
                          <span
                            className={`text-xs ${
                              isOwnMessage
                                ? "text-blue-100"
                                : "text-gray-400"
                            }`}
                          >
                            {new Date(msg.createdAt).toLocaleDateString()}
                          </span>

                          <div className="flex gap-1 relative">
                            <button
                              onClick={() => handleReply(msg)}
                              className="p-1 rounded hover:bg-white/10 transition-colors"
                              title="Reply to message"
                            >
                              <Reply className="w-3 h-3 text-gray-400 hover:text-purple-400" />
                            </button>
                            <button
                              onClick={() => copyToClipboard(msg.message)}
                              className="p-1 rounded hover:bg-white/10 transition-colors"
                              title="Copy message"
                            >
                              {copiedText === msg.message ? (
                                <Check className="w-3 h-3 text-green-400" />
                              ) : (
                                <Copy className="w-3 h-3 text-gray-400 hover:text-blue-400" />
                              )}
                            </button>
                            <button
                              onClick={() => setShowEmojiPicker(showEmojiPicker === msg._id ? null : msg._id)}
                              className="p-1 rounded hover:bg-white/10 transition-colors"
                              title="Add reaction"
                            >
                              <Smile className="w-3 h-3 text-gray-400 hover:text-yellow-400" />
                            </button>

                            {/* Emoji Picker Popup */}
                            {showEmojiPicker === msg._id && (
                              <div className={`absolute ${isOwnMessage ? 'right-0' : 'left-0'} bottom-full mb-1 p-2 bg-[#1a2332] border border-[#232945] rounded-lg shadow-xl z-50`}>
                                <div className="flex gap-1">
                                  {commonEmojis.map((emoji) => (
                                    <button
                                      key={emoji}
                                      onClick={() => handleReaction(msg._id, emoji)}
                                      className="p-1 hover:bg-white/10 rounded text-lg transition-transform hover:scale-125"
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
                  )})
                ) : (
                  <div className="flex items-center justify-center h-full">
                    <p className="text-sm sm:text-base text-gray-400">
                      No messages yet. Start the conversation!
                    </p>
                  </div>
                )}
                <div ref={messagesEndRef} />
              </div>

              {/* Message Input */}
              <div className="p-4 border-t border-[#232945]">
                {/* Reply Preview */}
                {replyingTo && (
                  <div className="mb-3 p-3 bg-blue-600/20 border border-blue-500/30 rounded-lg flex items-start justify-between overflow-hidden">
                    <div className="flex-1 min-w-0 overflow-hidden">
                      <div className="flex items-center gap-2 text-sm text-blue-300 mb-1">
                        <Reply className="w-3 h-3 flex-shrink-0" />
                        <span className="truncate">Replying to {replyingTo.sentBy?.name || replyingTo.sentBy?.clientName}</span>
                      </div>
                      <div className="text-xs text-gray-400 overflow-hidden" style={{
                        display: '-webkit-box',
                        WebkitLineClamp: 2,
                        WebkitBoxOrient: 'vertical',
                        wordBreak: 'break-word',
                        overflowWrap: 'anywhere'
                      }}>
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
                    <div className="flex flex-wrap gap-2 mb-2">
                      <button type="button" onClick={formatBold} className="px-2 py-1 bg-[#232945] hover:bg-[#2a3142] rounded text-xs font-bold text-white" title="Bold (Ctrl+B)">B</button>
                      <button type="button" onClick={formatItalic} className="px-2 py-1 bg-[#232945] hover:bg-[#2a3142] rounded text-xs italic text-white" title="Italic (Ctrl+I)">I</button>
                      <button type="button" onClick={formatStrikethrough} className="px-2 py-1 bg-[#232945] hover:bg-[#2a3142] rounded text-xs line-through text-white" title="Strikethrough (Ctrl+U)">S</button>
                      <button type="button" onClick={formatCode} className="px-2 py-1 bg-[#232945] hover:bg-[#2a3142] rounded text-xs font-mono text-white" title="Code (Ctrl+E)">&lt;/&gt;</button>
                      <button type="button" onClick={formatHeading} className="px-2 py-1 bg-[#232945] hover:bg-[#2a3142] rounded text-xs font-bold text-white" title="Heading (Ctrl+D)">H</button>
                      <button type="button" onClick={formatBullet} className="px-2 py-1 bg-[#232945] hover:bg-[#2a3142] rounded text-xs text-white" title="Bullet List (Ctrl+L)">• List</button>
                      <button type="button" onClick={formatNumbered} className="px-2 py-1 bg-[#232945] hover:bg-[#2a3142] rounded text-xs text-white" title="Numbered List (Ctrl+Shift+L)">1. List</button>
                    </div>
                    <div className="text-xs text-gray-500 space-y-1">
                      <p><strong>Keyboard Shortcuts:</strong> Ctrl+B (Bold) • Ctrl+I (Italic) • Ctrl+U (Strike) • Ctrl+E/K (Code) • Ctrl+D (Heading) • Ctrl+L (Bullet) • Ctrl+Shift+L (Numbered)</p>
                      <p><strong>Markdown:</strong> **bold** *italic* ~~strikethrough~~ `code` ## Heading - Bullet 1. Numbered</p>
                    </div>
                  </div>
                )}

                <form onSubmit={handleSendMessage} className="flex gap-2">
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
                    className="flex-shrink-0 px-3 py-2 bg-gray-600/20 hover:bg-gray-600/40 text-gray-300 rounded-lg transition-colors"
                    title="Attach files"
                  >
                    <Paperclip className="w-5 h-5" />
                  </button>

                  <button
                    type="button"
                    onClick={() => setShowFormatting(!showFormatting)}
                    className="flex-shrink-0 px-3 py-2 bg-gray-600/20 hover:bg-gray-600/40 text-gray-300 rounded-lg transition-colors"
                    title="Text formatting"
                  >
                    <Type className="w-5 h-5" />
                  </button>

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

                      if (isCtrlOrCmd) {
                        const key = e.key.toLowerCase();
                        let handled = false;

                        if (e.shiftKey) {
                          if (key === 'l') {
                            e.preventDefault();
                            e.stopPropagation();
                            formatNumbered();
                            handled = true;
                          }
                        } else {
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
                    placeholder="Type your message... (Shift+Enter for new line, Ctrl+B for bold)"
                    className="flex-1 px-3 sm:px-4 py-2 bg-[#232945] border border-[#232945] text-white placeholder-gray-400 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 text-sm sm:text-base resize-none overflow-y-auto"
                    rows="2"
                    style={{ maxHeight: "150px" }}
                  />
                  <button
                    type="submit"
                    disabled={!newMessage.trim() && selectedFiles.length === 0}
                    className="px-4 sm:px-6 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors flex items-center gap-2 text-sm sm:text-base whitespace-nowrap disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    <Send className="w-4 h-4" />
                    <span className="hidden sm:inline">Send</span>
                  </button>
                </form>
                <p className="text-xs text-gray-500 mt-2">
                  Max 5 files • Supports formatting: **bold** *italic* `code` ## heading - lists
                </p>
              </div>
            </div>
          )}
        </div>
        </div>
        </main>
      </div>
    );
  }

  // Projects List View
  return (
    <div className="flex bg-gradient-to-br from-[#141a21] via-[#191f2b] to-[#101218] font-sans text-blue-100 min-h-screen">
      <Sidebar
        collapsed={collapsed}
        setCollapsed={setCollapsed}
        onLogout={onLogout}
        userRole="employee"
      />

      <main
        className={`flex-1 overflow-y-auto transition-all duration-300 ${
          collapsed ? "ml-20" : "ml-72"
        }`}
      >
        <div className="p-4 sm:p-6 lg:p-8">
      {/* Header */}
      <div className="bg-[#191f2b]/70 border-b border-[#232945] rounded-xl mb-6">
        <div className="px-4 sm:px-6 lg:px-8 py-6">
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
            <div>
              <h1 className="text-2xl sm:text-3xl font-bold text-white">
                My Projects
              </h1>
              <p className="text-sm sm:text-base text-blue-300 mt-1">
                View and manage your assigned projects
              </p>
            </div>
          </div>
        </div>
      </div>

      {/* Stats Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 sm:gap-6 mb-6">
          <div className="bg-[#191f2b]/70 p-4 sm:p-6 rounded-lg shadow-xl border border-[#232945]">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-xs sm:text-sm text-blue-300">
                  Total Projects
                </p>
                <p className="text-2xl sm:text-3xl font-bold text-white mt-1">
                  {projects.length}
                </p>
              </div>
              <div className="p-3 bg-blue-600/20 rounded-lg border border-blue-500/30">
                <FileText className="w-6 h-6 sm:w-8 sm:h-8 text-blue-400" />
              </div>
            </div>
          </div>
          <div className="bg-[#191f2b]/70 p-4 sm:p-6 rounded-lg shadow-xl border border-[#232945]">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-xs sm:text-sm text-blue-300">
                  Active Projects
                </p>
                <p className="text-2xl sm:text-3xl font-bold text-green-400 mt-1">
                  {
                    projects.filter(
                      (p) =>
                        p.status?.toLowerCase() === "active" ||
                        p.status?.toLowerCase() === "in progress"
                    ).length
                  }
                </p>
              </div>
              <div className="p-3 bg-green-600/20 rounded-lg">
                <Clock className="w-6 h-6 sm:w-8 sm:h-8 text-green-600" />
              </div>
            </div>
          </div>
          <div className="bg-[#191f2b]/70 p-4 sm:p-6 rounded-lg shadow-sm border border-[#232945]">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-xs sm:text-sm text-blue-300">Completed</p>
                <p className="text-2xl sm:text-3xl font-bold text-blue-300 mt-1">
                  {
                    projects.filter(
                      (p) => p.status?.toLowerCase() === "completed"
                    ).length
                  }
                </p>
              </div>
              <div className="p-3 bg-blue-500/10 rounded-lg">
                <AlertCircle className="w-6 h-6 sm:w-8 sm:h-8 text-blue-300" />
              </div>
            </div>
          </div>
          <div className="bg-[#191f2b]/70 p-4 sm:p-6 rounded-lg shadow-sm border border-[#232945]">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-xs sm:text-sm text-blue-300">Pending</p>
                <p className="text-2xl sm:text-3xl font-bold text-yellow-400 mt-1">
                  {
                    projects.filter(
                      (p) => p.status?.toLowerCase() === "pending"
                    ).length
                  }
                </p>
              </div>
              <div className="p-3 bg-yellow-600/20 rounded-lg">
                <Calendar className="w-6 h-6 sm:w-8 sm:h-8 text-yellow-400" />
              </div>
            </div>
          </div>
        </div>

        {/* Search and Filter */}
        <div className="mb-6 flex flex-col sm:flex-row gap-4">
          <div className="flex-1 relative">
            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 w-5 h-5" />
            <input
              type="text"
              placeholder="Search projects..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full pl-10 pr-4 py-2 bg-[#232945] border border-[#232945] text-white placeholder-gray-400 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 text-sm sm:text-base"
            />
          </div>
        </div>

        {/* Projects List */}
        {loading ? (
          <div className="flex items-center justify-center py-12">
            <div className="text-center">
              <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto mb-4"></div>
              <p className="text-sm sm:text-base text-blue-300">
                Loading projects...
              </p>
            </div>
          </div>
        ) : filteredProjects.length > 0 ? (
          <div className="bg-[#191f2b]/70 rounded-lg shadow-sm border border-[#232945] overflow-hidden">
            <div className="overflow-x-auto">
              <table className="min-w-full divide-y divide-gray-200">
                <thead className="bg-[#232945]">
                  <tr>
                    <th className="px-4 sm:px-6 py-3 text-left text-xs font-medium text-gray-400 uppercase tracking-wider">
                      Project Name
                    </th>
                    <th className="px-4 sm:px-6 py-3 text-left text-xs font-medium text-gray-400 uppercase tracking-wider hidden lg:table-cell">
                      Type
                    </th>
                    <th className="px-4 sm:px-6 py-3 text-left text-xs font-medium text-gray-400 uppercase tracking-wider hidden md:table-cell">
                      Client
                    </th>
                    <th className="px-4 sm:px-6 py-3 text-left text-xs font-medium text-gray-400 uppercase tracking-wider hidden sm:table-cell">
                      Start Date
                    </th>
                    <th className="px-4 sm:px-6 py-3 text-left text-xs font-medium text-gray-400 uppercase tracking-wider">
                      Status
                    </th>
                    <th className="px-4 sm:px-6 py-3 text-left text-xs font-medium text-gray-400 uppercase tracking-wider">
                      Action
                    </th>
                  </tr>
                </thead>
                <tbody className="bg-[#191f2b]/70 divide-y divide-gray-200">
                  {filteredProjects.map((project) => (
                    <tr key={project._id} className="hover:bg-[#232945]">
                      <td className="px-4 sm:px-6 py-4">
                        <div className="text-sm font-medium text-white">
                          {project.projectName}
                        </div>
                        <div className="text-xs text-gray-400 lg:hidden">
                          {project.type}
                        </div>
                      </td>
                      <td className="px-4 sm:px-6 py-4 hidden lg:table-cell">
                        <div className="text-sm text-white">
                          {project.type}
                        </div>
                      </td>
                      <td className="px-4 sm:px-6 py-4 hidden md:table-cell">
                        <div className="text-sm text-white">
                          {project.client?.businessName || project.client?.clientName}
                        </div>
                      </td>
                      <td className="px-4 sm:px-6 py-4 hidden sm:table-cell">
                        <div className="text-sm text-white">
                          {project.startDate ? new Date(project.startDate).toLocaleDateString() : 'N/A'}
                        </div>
                      </td>
                      <td className="px-4 sm:px-6 py-4">
                        <span
                          className={`px-2 py-1 inline-flex text-xs leading-5 font-semibold rounded-full ${getStatusColor(
                            project.status
                          )}`}
                        >
                          {project.status}
                        </span>
                      </td>
                      <td className="px-4 sm:px-6 py-4">
                        <button
                          onClick={() => {
                            setSelectedProject(project._id);
                            fetchProjectMessages(project._id);
                          }}
                          className="text-blue-600 hover:text-blue-900 font-medium text-sm flex items-center gap-1"
                        >
                          Details
                          <ChevronRight className="w-4 h-4" />
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        ) : (
          <div className="bg-[#191f2b]/70 rounded-lg shadow-sm border border-[#232945] p-8 sm:p-12 text-center">
            <FileText className="w-12 h-12 sm:w-16 sm:h-16 text-gray-400 mx-auto mb-4" />
            <h3 className="text-lg sm:text-xl font-semibold text-white mb-2">
              No Projects Found
            </h3>
            <p className="text-sm sm:text-base text-blue-300">
              {searchTerm
                ? "No projects match your search criteria."
                : "You have no assigned projects yet."}
            </p>
          </div>
        )}
      </div>
      </main>
    </div>
  );
};

export default EmployeePortal;
