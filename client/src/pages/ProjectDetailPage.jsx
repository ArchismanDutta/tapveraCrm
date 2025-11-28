import React, { useState, useEffect, useRef } from "react";
import { useLocation } from "react-router-dom";
import axios from "axios";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import rehypeRaw from "rehype-raw";
import { BrowserNotificationManager } from "../utils/browserNotifications";
import useMessageSuggestions from "../hooks/useMessageSuggestions";
import ProjectTaskModal from "../components/project/ProjectTaskModal";
import ProjectTaskEditModal from "../components/project/ProjectTaskEditModal";
import UnreadMessageBadge from "../components/message/UnreadMessageBadge";
import ProjectReportTab from "../components/project/ProjectReportTab";
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
  ListTodo,
  ExternalLink,
  ThumbsUp,
  ThumbsDown,
  Sparkles,
  Lightbulb,
  Zap,
  Plus,
  Edit2,
  Star,
  Briefcase,
  BarChart3,
} from "lucide-react";

const API_BASE = import.meta.env.VITE_API_BASE || "http://localhost:5000";

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
  const location = useLocation();
  const [project, setProject] = useState(null);
  const [messages, setMessages] = useState([]);
  const [newMessage, setNewMessage] = useState("");
  const [loading, setLoading] = useState(true);
  const [sending, setSending] = useState(false);
  const [notification, setNotification] = useState(null);
  const [activeTab, setActiveTab] = useState("chat");
  const [tasks, setTasks] = useState([]);
  const [loadingTasks, setLoadingTasks] = useState(false);
  const [selectedTask, setSelectedTask] = useState(null);
  const [approvalRemark, setApprovalRemark] = useState("");
  const [copiedText, setCopiedText] = useState(null);
  const [showTaskModal, setShowTaskModal] = useState(false);
  const [showEditTaskModal, setShowEditTaskModal] = useState(false);
  const [editingTask, setEditingTask] = useState(null);
  const [selectedFiles, setSelectedFiles] = useState([]);
  const [replyingTo, setReplyingTo] = useState(null);
  const [searchTerm, setSearchTerm] = useState("");
  const [searchSender, setSearchSender] = useState("");
  const [dateFilter, setDateFilter] = useState({ start: "", end: "" });
  const [showFilters, setShowFilters] = useState(false);
  const [showFormatting, setShowFormatting] = useState(false);
  const [showEmojiPicker, setShowEmojiPicker] = useState(null);
  const commonEmojis = ["👍", "❤️", "😂", "😮", "😢", "🎉", "🔥", "👏"];
  const [showSummaryModal, setShowSummaryModal] = useState(false);
  const [summary, setSummary] = useState("");
  const [summaryLoading, setSummaryLoading] = useState(false);
  const [summaryDays, setSummaryDays] = useState(7);
  const [currentPage, setCurrentPage] = useState(1);
  const [hasMoreMessages, setHasMoreMessages] = useState(true);
  const [totalMessages, setTotalMessages] = useState(0);
  const [loadingMoreMessages, setLoadingMoreMessages] = useState(false);
  const messagesEndRef = useRef(null);
  const chatContainerRef = useRef(null);
  const fileInputRef = useRef(null);
  const textareaRef = useRef(null);
  const wsRef = useRef(null);
  const prevMessagesLengthRef = useRef(0);
  const reconnectTimeoutRef = useRef(null);
  const reconnectAttemptsRef = useRef(0);
  const maxReconnectAttempts = 10;
  const [wsConnected, setWsConnected] = useState(false);

  // Message suggestions
  const { getSuggestions, getQuickReplies } = useMessageSuggestions(projectId, messages);
  const [suggestions, setSuggestions] = useState([]);
  const [selectedSuggestionIndex, setSelectedSuggestionIndex] = useState(0);
  const [showSuggestions, setShowSuggestions] = useState(false);
  const [quickReplies, setQuickReplies] = useState([]);
  const [showQuickReplies, setShowQuickReplies] = useState(true);
  const suggestionsRef = useRef(null);

  // WebSocket connection with exponential backoff reconnection
  useEffect(() => {
    fetchProjectDetails();
    fetchMessages();

    const token = localStorage.getItem("token");
    let isComponentMounted = true;

    // Determine WebSocket URL from environment variables
    const getWebSocketURL = () => {
      // 1) Explicit WS base overrides everything
      if (import.meta.env.VITE_WS_BASE) return import.meta.env.VITE_WS_BASE;

      // 2) Prefer API base if provided; convert http(s) -> ws(s)
      const apiBase = import.meta.env.VITE_API_BASE;
      if (apiBase) {
        try {
          const u = new URL(apiBase);
          u.protocol = u.protocol === "https:" ? "wss:" : "ws:";
          return `${u.protocol}//${u.host}`;
        } catch (error) {
          console.error("Failed to parse WebSocket URL:", error);
          return null;
        }
      }

      // 3) Fallback to window origin with default port
      if (typeof window !== "undefined" && window.location) {
        const protocol = window.location.protocol === "https:" ? "wss" : "ws";
        const defaultHost = window.location.hostname === "localhost"
          ? "localhost:5000"
          : window.location.host;
        return `${protocol}://${defaultHost}`;
      }

      // 4) Final fallback
      return "ws://localhost:5000";
    };

    const connectWebSocket = () => {
      if (!isComponentMounted) return;

      const wsURL = getWebSocketURL();
      console.log("[ProjectDetailPage] Connecting to WebSocket:", wsURL);
      const ws = new WebSocket(wsURL);
      wsRef.current = ws;

      ws.onopen = () => {
        console.log("WebSocket connected for project messages");
        setWsConnected(true);
        reconnectAttemptsRef.current = 0; // Reset reconnection attempts on successful connection
        // Authenticate
        ws.send(JSON.stringify({ type: "authenticate", token }));
      };

      ws.onmessage = (event) => {
        try {
          const data = JSON.parse(event.data);

          if (data.type === "authenticated") {
            console.log("WebSocket authenticated");
          } else if (data.type === "project_message") {
            console.log("Received real-time project message");

            // Add message to list if it's for this project
            if (data.projectId === projectId) {
              const messageData = data.messageData || data.message || {};

              // Check if message already exists (prevent duplicates)
              setMessages((prevMessages) => {
                const exists = prevMessages.some(
                  (m) => m._id === messageData._id
                );
                if (exists) return prevMessages;

                // Invalidate cache when new message arrives
                invalidateMessageCache();

                // Append new message and increment total count
                setTotalMessages((prev) => prev + 1);
                return [...prevMessages, messageData];
              });
            }

            // Show browser notification for project messages
            const messageData = data.messageData || data.message || {};
            const senderDesignation = messageData.senderType === "client"
              ? "Client"
              : (messageData.sentBy?.designation || "Team Member");

            // Don't notify for own messages
            if (messageData.sentBy?._id !== userId && messageData.sentBy !== userId) {
              const notificationManager = BrowserNotificationManager.getInstance();
              notificationManager.show(
                "New Project Message",
                `${senderDesignation}: ${messageData.message || "Sent an attachment"}`,
                {
                  tag: `project-${data.projectId}`,
                  icon: "/icon.png",
                  requireInteraction: false,
                }
              );
            }
          }
        } catch (error) {
          console.error("WebSocket message error:", error);
        }
      };

      ws.onerror = (error) => {
        console.error("[ProjectDetailPage] WebSocket error:", error);
        setWsConnected(false);
      };

      ws.onclose = () => {
        console.log("[ProjectDetailPage] WebSocket disconnected");
        setWsConnected(false);

        // Attempt to reconnect with exponential backoff
        if (isComponentMounted && reconnectAttemptsRef.current < maxReconnectAttempts) {
          const backoffDelay = Math.min(1000 * Math.pow(2, reconnectAttemptsRef.current), 30000);
          reconnectAttemptsRef.current += 1;

          console.log(
            `[ProjectDetailPage] Reconnecting in ${backoffDelay}ms (attempt ${reconnectAttemptsRef.current}/${maxReconnectAttempts})`
          );

          reconnectTimeoutRef.current = setTimeout(() => {
            connectWebSocket();
          }, backoffDelay);
        } else if (reconnectAttemptsRef.current >= maxReconnectAttempts) {
          console.error("[ProjectDetailPage] Max reconnection attempts reached");
        }
      };
    };

    // Initial connection
    connectWebSocket();

    return () => {
      isComponentMounted = false;

      // Clear reconnection timeout
      if (reconnectTimeoutRef.current) {
        clearTimeout(reconnectTimeoutRef.current);
        reconnectTimeoutRef.current = null;
      }

      // Close WebSocket
      if (wsRef.current) {
        const ws = wsRef.current;
        if (ws.readyState === WebSocket.OPEN || ws.readyState === WebSocket.CONNECTING) {
          ws.close();
        }
        wsRef.current = null;
      }

      // Reset connection state
      setWsConnected(false);
      reconnectAttemptsRef.current = 0;
    };
  }, [projectId]);

  // Auto-scroll only when new messages are added (not when reactions update)
  useEffect(() => {
    if (messages.length > prevMessagesLengthRef.current) {
      scrollToBottom();
    }
    prevMessagesLengthRef.current = messages.length;
  }, [messages]);

  // Update suggestions when input changes
  useEffect(() => {
    if (newMessage.trim().length >= 2) {
      const newSuggestions = getSuggestions(newMessage, 8);
      setSuggestions(newSuggestions);
      setShowSuggestions(newSuggestions.length > 0);
      setSelectedSuggestionIndex(0);
    } else {
      setShowSuggestions(false);
      setSuggestions([]);
    }
  }, [newMessage, getSuggestions]);

  // Update quick replies based on last message
  useEffect(() => {
    if (messages && messages.length > 0) {
      const lastMessage = messages[messages.length - 1];
      if (String(lastMessage.sentBy?._id || lastMessage.sentBy) !== String(userId)) {
        const replies = getQuickReplies(lastMessage.message);
        setQuickReplies(replies);
      } else {
        setQuickReplies([]);
      }
    }
  }, [messages, userId, getQuickReplies]);

  // Handle suggestion selection
  const acceptSuggestion = (suggestion) => {
    setNewMessage(suggestion.text);
    setShowSuggestions(false);
    textareaRef.current?.focus();
  };

  // Handle quick reply click
  const handleQuickReply = (text) => {
    setNewMessage(text);
    textareaRef.current?.focus();
  };

  // Close suggestions when clicking outside
  useEffect(() => {
    const handleClickOutside = (event) => {
      if (suggestionsRef.current && !suggestionsRef.current.contains(event.target)) {
        setShowSuggestions(false);
      }
    };

    if (showSuggestions) {
      document.addEventListener('mousedown', handleClickOutside);
    }

    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, [showSuggestions]);

  // Close emoji picker when clicking outside
  useEffect(() => {
    const handleClickOutside = (event) => {
      // Check if click is outside emoji picker
      if (showEmojiPicker && !event.target.closest('.emoji-picker-container') && !event.target.closest('[title="Add reaction"]')) {
        setShowEmojiPicker(null);
      }
    };

    if (showEmojiPicker) {
      document.addEventListener('mousedown', handleClickOutside);
    }

    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, [showEmojiPicker]);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  };

  const fetchProjectDetails = async () => {
    try {
      const token = localStorage.getItem("token");
      const res = await axios.get(`${API_BASE}/api/projects/${projectId}`, {
        headers: { Authorization: `Bearer ${token}` },
      });

      // Normalize project to handle both old (client) and new (clients) schema
      const projectData = res.data;
      if (projectData.client && (!projectData.clients || projectData.clients.length === 0)) {
        projectData.clients = [projectData.client];
      }

      setProject(projectData);
    } catch (error) {
      console.error("Error fetching project:", error);
      showNotification("Error loading project details", "error");
    } finally {
      setLoading(false);
    }
  };

  const fetchMessages = async (page = 1, append = false) => {
    try {
      if (append) {
        setLoadingMoreMessages(true);
      }

      const token = localStorage.getItem("token");

      // Try to load from cache first (only for initial load without filters)
      if (page === 1 && !append && !searchTerm && !searchSender && !dateFilter.start && !dateFilter.end) {
        try {
          const cacheKey = `project_messages_${projectId}`;
          const cached = localStorage.getItem(cacheKey);
          if (cached) {
            const { messages: cachedMessages, timestamp } = JSON.parse(cached);
            // Use cache if less than 5 minutes old
            if (Date.now() - timestamp < 5 * 60 * 1000) {
              setMessages(cachedMessages);
              console.log("[Cache] Loaded messages from cache");
            }
          }
        } catch (cacheError) {
          console.error("Cache read error:", cacheError);
        }
      }

      const params = new URLSearchParams();
      if (searchTerm) params.append("search", searchTerm);
      if (searchSender) params.append("senderName", searchSender);
      if (dateFilter.start) params.append("startDate", dateFilter.start);
      if (dateFilter.end) params.append("endDate", dateFilter.end);
      params.append("page", page);
      params.append("limit", "50");

      const queryString = params.toString();
      const url = `${API_BASE}/api/projects/${projectId}/messages${queryString ? `?${queryString}` : ""}`;

      const res = await axios.get(url, {
        headers: { Authorization: `Bearer ${token}` },
      });

      // Handle new pagination response format
      const { messages: newMessages, pagination } = res.data;

      if (append) {
        // Append new messages to existing ones
        setMessages((prev) => [...prev, ...newMessages]);
      } else {
        // Replace all messages (initial load or filter change)
        setMessages(newMessages);

        // Cache messages (only for initial load without filters)
        if (page === 1 && !searchTerm && !searchSender && !dateFilter.start && !dateFilter.end) {
          try {
            const cacheKey = `project_messages_${projectId}`;
            localStorage.setItem(
              cacheKey,
              JSON.stringify({
                messages: newMessages,
                timestamp: Date.now(),
              })
            );
            console.log("[Cache] Saved messages to cache");
          } catch (cacheError) {
            console.error("Cache write error:", cacheError);
            // If localStorage is full, clear old caches
            if (cacheError.name === "QuotaExceededError") {
              Object.keys(localStorage).forEach((key) => {
                if (key.startsWith("project_messages_") && key !== `project_messages_${projectId}`) {
                  localStorage.removeItem(key);
                }
              });
            }
          }
        }
      }

      setCurrentPage(pagination.page);
      setHasMoreMessages(pagination.hasMore);
      setTotalMessages(pagination.total);

      // Mark messages as read when viewing them
      if (!append) {
        markMessagesAsRead();
      }
    } catch (error) {
      console.error("Error fetching messages:", error);
    } finally {
      setLoadingMoreMessages(false);
    }
  };

  const loadMoreMessages = () => {
    if (hasMoreMessages && !loadingMoreMessages) {
      fetchMessages(currentPage + 1, true);
    }
  };

  // Helper to invalidate message cache
  const invalidateMessageCache = () => {
    try {
      const cacheKey = `project_messages_${projectId}`;
      localStorage.removeItem(cacheKey);
      console.log("[Cache] Invalidated message cache");
    } catch (error) {
      console.error("Cache invalidation error:", error);
    }
  };

  // Mark all messages in this project as read
  const markMessagesAsRead = async () => {
    try {
      const token = localStorage.getItem("token");
      await axios.patch(
        `${API_BASE}/api/projects/${projectId}/messages/mark-read`,
        {},
        {
          headers: { Authorization: `Bearer ${token}` },
        }
      );

      // Dispatch event to notify UnreadMessageBadge
      window.dispatchEvent(new CustomEvent('project-messages-read', {
        detail: { projectId }
      }));
    } catch (error) {
      // Silent fail - don't interrupt user experience
      console.error("Error marking messages as read:", error);
    }
  };

  // Handle navigation from notification - auto-open chat tab
  useEffect(() => {
    if (location.state?.scrollToMessages) {
      // Ensure chat tab is active
      setActiveTab("chat");

      // Scroll to messages after a short delay to ensure content is rendered
      setTimeout(() => {
        messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
      }, 300);

      // Clear navigation state
      window.history.replaceState({}, document.title);
    }
  }, [location.state]);

  const fetchTasks = async () => {
    setLoadingTasks(true);
    try {
      const token = localStorage.getItem("token");
      const res = await axios.get(`${API_BASE}/api/tasks`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      // Filter tasks that belong to this project
      // Handle both cases: project as string ID or as populated object
      const tasksData = Array.isArray(res.data) ? res.data : [];
      const projectTasks = tasksData.filter(task => {
        if (!task || !task.project) return false;
        const taskProjectId = typeof task.project === 'string' ? task.project : task.project._id;
        return taskProjectId === projectId;
      });
      setTasks(projectTasks);
    } catch (error) {
      console.error("Error fetching tasks:", error);
      showNotification("Error loading tasks", "error");
      setTasks([]); // Set empty array on error
    } finally {
      setLoadingTasks(false);
    }
  };

  const handleApproveSubmission = async (taskId) => {
    try {
      const token = localStorage.getItem("token");
      await axios.patch(
        `${API_BASE}/api/tasks/${taskId}/approve`,
        { approvalRemark },
        { headers: { Authorization: `Bearer ${token}` } }
      );
      showNotification("Task submission approved!", "success");
      setSelectedTask(null);
      setApprovalRemark("");
      fetchTasks();
    } catch (error) {
      showNotification(error.response?.data?.message || "Error approving task", "error");
    }
  };

  const handleRejectSubmission = async (taskId) => {
    if (!approvalRemark.trim()) {
      showNotification("Please provide a rejection reason", "error");
      return;
    }
    try {
      const token = localStorage.getItem("token");
      await axios.patch(
        `${API_BASE}/api/tasks/${taskId}/reject-submission`,
        { approvalRemark },
        { headers: { Authorization: `Bearer ${token}` } }
      );
      showNotification("Task submission rejected", "success");
      setSelectedTask(null);
      setApprovalRemark("");
      fetchTasks();
    } catch (error) {
      showNotification(error.response?.data?.message || "Error rejecting task", "error");
    }
  };

  const handleTaskCreated = () => {
    showNotification("Task created successfully!", "success");
    fetchTasks(); // Refresh tasks list
  };

  const handleEditTask = (task) => {
    setEditingTask(task);
    setShowEditTaskModal(true);
  };

  const handleTaskUpdated = () => {
    showNotification("Task updated successfully!", "success");
    fetchTasks(); // Refresh tasks list
  };

  // Re-fetch when filters change (reset to page 1)
  useEffect(() => {
    if (projectId) {
      setCurrentPage(1);
      fetchMessages(1, false);
    }
  }, [searchTerm, searchSender, dateFilter]);

  // Fetch tasks when Tasks tab is active
  useEffect(() => {
    if (activeTab === "tasks" && projectId) {
      fetchTasks();
    }
  }, [activeTab, projectId]);

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
      // Scroll to bottom after sending message
      setTimeout(() => scrollToBottom(), 100);
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

      const updatedMessage = await response.json();

      // Optimistically update just this message in state
      setMessages((prevMessages) =>
        prevMessages.map((msg) =>
          msg._id === messageId ? updatedMessage : msg
        )
      );

      setShowEmojiPicker(null);
    } catch (error) {
      console.error("Error adding reaction:", error);
      showNotification("Failed to add reaction", "error");
    }
  };

  const handleToggleImportant = async (messageId, attachmentId) => {
    try {
      const token = localStorage.getItem("token");
      const response = await fetch(
        `${API_BASE}/api/projects/${projectId}/messages/${messageId}/attachments/${attachmentId}/toggle-important`,
        {
          method: "PATCH",
          headers: {
            Authorization: `Bearer ${token}`,
            "Content-Type": "application/json",
          },
        }
      );

      if (!response.ok) {
        throw new Error("Failed to toggle importance");
      }

      const data = await response.json();

      // Refresh messages to show updated status
      await fetchMessages();
      showNotification(
        data.isImportant ? "Marked as important - won't be auto-deleted" : "Removed from important files",
        "success"
      );
    } catch (error) {
      console.error("Error toggling importance:", error);
      showNotification("Failed to update file importance", "error");
    }
  };

  const clearFilters = () => {
    setSearchTerm("");
    setSearchSender("");
    setDateFilter({ start: "", end: "" });
  };

  const handleSummarize = async () => {
    // Use projectId prop or project._id from state
    const currentProjectId = projectId || project?._id;

    if (!currentProjectId) {
      console.error("No project ID available");
      return;
    }

    setSummaryLoading(true);
    setShowSummaryModal(true);
    setSummary("");

    try {
      const token = localStorage.getItem("token");
      const response = await fetch(
        `${API_BASE}/api/projects/${currentProjectId}/messages/summarize`,
        {
          method: "POST",
          headers: {
            Authorization: `Bearer ${token}`,
            "Content-Type": "application/json",
          },
          body: JSON.stringify({ days: summaryDays }),
        }
      );

      if (!response.ok) {
        throw new Error("Failed to generate summary");
      }

      const data = await response.json();
      setSummary(data.summary || "No summary available.");
    } catch (error) {
      console.error("Error generating summary:", error);
      setSummary("Failed to generate summary. Please try again.");
    } finally {
      setSummaryLoading(false);
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

  const showNotification = (message, type) => {
    setNotification({ message, type });
    setTimeout(() => setNotification(null), 3000);
  };

  const getProjectStatus = (project) => {
  if (!project) return "inactive";
  
  const today = new Date();
  const endDate = project.endDate ? new Date(project.endDate) : null;

  // Normalize status to lowercase for comparison
  const status = project.status?.toLowerCase();

  if (status === "completed") return "completed";
  if (status === "inactive") return "inactive";
  if (status === "expired") return "expired";
  if (endDate && endDate < today && status !== "completed") return "needsRenewal";
  if (status === "active" || status === "ongoing") return "active";
  if (status === "new") return "active"; // Treat "new" as active
  
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
  // Handle project.type as array (take first type) or string
  const primaryType = Array.isArray(project.type) ? project.type[0] : project.type;
  const colors = PROJECT_TYPE_COLORS[primaryType] || PROJECT_TYPE_COLORS["Website"]; // fallback to Website colors
  const Icon = PROJECT_TYPE_ICONS[primaryType] || PROJECT_TYPE_ICONS["Website"]; // fallback to Website icon

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
                  {project.clients && project.clients.length > 0
                    ? project.clients.map(c => c?.businessName || c?.clientName).join(", ")
                    : "N/A"}
                </p>
              </div>
            </div>
            <span
              className={`px-2 sm:px-3 py-1 rounded-full text-xs font-medium ${colors.bg} ${colors.text} border ${colors.border} flex-shrink-0`}
            >
              {Array.isArray(project.type) ? project.type.join(", ") : project.type}
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
              {project.assignedTo && project.assignedTo.length > 0 ? (
                project.assignedTo.map((emp, idx) => (
                  <div
                    key={idx}
                    className="flex items-center gap-3 p-3 bg-[#0f1419] rounded-lg border border-[#232945]"
                  >
                    <div className="w-10 h-10 rounded-full bg-gradient-to-br from-purple-500 to-pink-500 flex items-center justify-center text-white font-semibold flex-shrink-0">
                      {(emp.name || emp.employeeId || "U").charAt(0).toUpperCase()}
                    </div>
                    <div className="min-w-0 flex-1">
                      {(userRole === "admin" || userRole === "super-admin" || userRole === "superadmin") ? (
                        // Show name for admins/super-admins
                        <>
                          <p className="text-white font-medium text-sm">
                            {emp.name || "Unknown"}
                          </p>
                          <p className="text-xs text-blue-400">
                            {emp.designation || "No designation"}
                          </p>
                        </>
                      ) : (
                        // Show employee ID and designation for clients
                        <>
                          <div className="flex items-center gap-2 mb-1">
                            <Briefcase className="w-3 h-3 text-purple-400 flex-shrink-0" />
                            <p className="text-white font-medium text-sm">
                              {emp.employeeId || emp._id?.substring(0, 8) || "N/A"}
                            </p>
                          </div>
                          <p className="text-xs text-blue-400">
                            {emp.designation || "No designation"}
                          </p>
                        </>
                      )}
                    </div>
                  </div>
                ))
              ) : (
                <div className="p-4 bg-[#0f1419] rounded-lg border border-[#232945] text-center">
                  <Users className="w-8 h-8 text-gray-600 mx-auto mb-2" />
                  <p className="text-gray-400 text-sm">No team members assigned</p>
                </div>
              )}
            </div>
          </div>

          {/* Project Creator Card */}
          {project.createdBy && (
            <div className="bg-[#191f2b]/70 rounded-xl shadow-xl border border-[#232945] p-4 sm:p-6">
              <h2 className="text-base sm:text-lg font-semibold text-white mb-4 flex items-center gap-2">
                <Star className="w-5 h-5 text-yellow-400" />
                Project Creator
              </h2>

              <div className="flex items-center gap-3 p-3 bg-[#0f1419] rounded-lg border border-[#232945]">
                <div className="w-10 h-10 rounded-full bg-gradient-to-br from-yellow-500 to-orange-500 flex items-center justify-center text-white font-semibold flex-shrink-0">
                  {(project.createdBy.name || "U").charAt(0).toUpperCase()}
                </div>
                <div className="min-w-0 flex-1">
                  <p className="text-white font-medium text-sm">
                    {project.createdBy.name || "Unknown"}
                  </p>
                  {project.createdBy.email && (
                    <p className="text-xs text-yellow-400">
                      {project.createdBy.email}
                    </p>
                  )}
                </div>
              </div>
            </div>
          )}

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
          <div className="bg-[#191f2b]/70 rounded-xl shadow-xl border border-[#232945] h-[calc(100vh-8rem)] lg:h-[calc(100vh-7rem)] flex flex-col" style={{ minHeight: "650px" }}>
            {/* Tabs */}
            <div className="border-b border-[#232945]">
              <div className="flex">
                <button
                  onClick={() => setActiveTab("chat")}
                  className={`flex-1 flex items-center justify-center gap-2 px-4 py-4 font-medium transition-all ${
                    activeTab === "chat"
                      ? "bg-purple-600/20 text-purple-400 border-b-2 border-purple-500"
                      : "text-gray-400 hover:text-white hover:bg-[#0f1419]"
                  }`}
                >
                  <Mail className="w-5 h-5" />
                  <span>Chat</span>
                  <UnreadMessageBadge projectId={projectId} refreshInterval={30000} />
                </button>
                <button
                  onClick={() => setActiveTab("tasks")}
                  className={`flex-1 flex items-center justify-center gap-2 px-4 py-4 font-medium transition-all ${
                    activeTab === "tasks"
                      ? "bg-purple-600/20 text-purple-400 border-b-2 border-purple-500"
                      : "text-gray-400 hover:text-white hover:bg-[#0f1419]"
                  }`}
                >
                  <ListTodo className="w-5 h-5" />
                  <span>Tasks</span>
                  {tasks.length > 0 && (
                    <span className="px-2 py-0.5 rounded-full bg-green-600/30 text-green-400 text-xs">
                      {tasks.length}
                    </span>
                  )}
                </button>
                <button
                  onClick={() => setActiveTab("report")}
                  className={`flex-1 flex items-center justify-center gap-2 px-4 py-4 font-medium transition-all ${
                    activeTab === "report"
                      ? "bg-purple-600/20 text-purple-400 border-b-2 border-purple-500"
                      : "text-gray-400 hover:text-white hover:bg-[#0f1419]"
                  }`}
                >
                  <BarChart3 className="w-5 h-5" />
                  <span>Project Report</span>
                </button>
              </div>
            </div>

            {/* Chat Tab Content */}
            {activeTab === "chat" && (
              <>
                {/* Chat Header */}
                <div className="p-4 sm:p-6 border-b border-[#232945] space-y-3">
                  <div className="flex items-center justify-between">
                    <div>
                      <h2 className="text-base sm:text-lg font-semibold text-white flex items-center gap-2">
                        <Mail className="w-5 h-5 text-blue-400" />
                        Project Conversation
                      </h2>
                      <div className="flex items-center gap-3 mt-1">
                        <p className="text-xs sm:text-sm text-gray-400">
                          {messages.length} message{messages.length !== 1 ? "s" : ""}
                        </p>
                        <div className="flex items-center gap-1.5">
                          <div
                            className={`w-2 h-2 rounded-full ${
                              wsConnected ? "bg-green-400 animate-pulse" : "bg-red-400"
                            }`}
                          ></div>
                          <span className="text-xs text-gray-500">
                            {wsConnected ? "Connected" : "Disconnected"}
                          </span>
                        </div>
                      </div>
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
                    onClick={handleSummarize}
                    className="flex items-center gap-2 px-3 py-2 rounded-lg bg-purple-600/20 hover:bg-purple-600/40 text-purple-400 border border-purple-500/30 transition-colors text-sm"
                    title="Summarize conversation"
                  >
                    <Sparkles className="w-4 h-4" />
                    <span className="hidden sm:inline">Summarize</span>
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
                  const senderType = msg.senderType || "user";

                  // Show designation instead of name, similar to team members sidebar
                  const senderDesignation = msg.sentBy?.designation || "Team Member";
                  const senderDisplay = senderType === "client"
                    ? "Client"
                    : senderDesignation;

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
                              {senderDisplay.charAt(0).toUpperCase()}
                            </div>
                          )}
                          <span className="text-xs text-blue-400 truncate">
                            {senderDisplay}
                          </span>
                        </div>

                        <div
                          className={`relative group ${
                            isOwnMessage
                              ? "bg-gradient-to-r from-purple-600 to-pink-600"
                              : "bg-[#0f1419] border border-[#232945]"
                          } rounded-lg p-3 sm:p-4`}
                        >
                          {/* Reply Preview */}
                          {msg.replyTo && (
                            <div className="mb-2 p-2 bg-black/20 rounded border-l-2 border-purple-400/50 overflow-hidden" style={{ wordBreak: 'break-word', overflowWrap: 'anywhere' }}>
                              <div className="flex items-center gap-1 mb-1">
                                <Reply className="w-3 h-3 text-purple-400 flex-shrink-0" />
                                <span className="text-xs text-purple-300 font-semibold truncate">
                                  {msg.replyTo.sentBy ?
                                    (msg.replyTo.senderType === "client" ? "Client" : (msg.replyTo.sentBy.designation || "Team Member")) :
                                    "Unknown User"}
                                </span>
                              </div>
                              <div className="text-xs text-gray-300 overflow-hidden whitespace-pre-wrap" style={{
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
                            <>
                              <div className="text-white text-sm leading-relaxed break-words prose prose-invert prose-sm max-w-none">
                                <ReactMarkdown
                                  remarkPlugins={[remarkGfm]}
                                  rehypePlugins={[rehypeRaw]}
                                  components={{
                                    p: ({ children }) => <p className="mb-2 last:mb-0 whitespace-pre-wrap">{children}</p>,
                                    h1: ({ children }) => <h1 className="text-lg font-bold mb-2">{children}</h1>,
                                    h2: ({ children }) => <h2 className="text-base font-bold mb-2">{children}</h2>,
                                    h3: ({ children }) => <h3 className="text-sm font-bold mb-2">{children}</h3>,
                                    ul: ({ children }) => <ul className="list-disc list-inside mb-2 space-y-1">{children}</ul>,
                                    ol: ({ children }) => <ol className="list-decimal list-inside mb-2 space-y-1">{children}</ol>,
                                    li: ({ children }) => <li className="ml-2">{children}</li>,
                                    code: ({ inline, children }) =>
                                      inline ? (
                                        <code className="bg-black/30 px-1 rounded text-xs">{children}</code>
                                      ) : (
                                        <code className="block bg-black/30 p-2 rounded text-xs overflow-x-auto whitespace-pre-wrap">{children}</code>
                                      ),
                                    strong: ({ children }) => <strong className="font-bold">{children}</strong>,
                                    em: ({ children }) => <em className="italic">{children}</em>,
                                    a: ({ href, children }) => (
                                      <a href={href} target="_blank" rel="noopener noreferrer" className="text-blue-300 underline hover:text-blue-200">{children}</a>
                                    ),
                                    br: () => <br />,
                                  }}
                                >
                                  {msg.message.replace(/\n/g, '  \n')}
                                </ReactMarkdown>
                              </div>
                              {/* Mentioned Users */}
                              {msg.mentions && msg.mentions.length > 0 && (
                                <div className="flex flex-wrap gap-1 mt-2">
                                  {msg.mentions.map((mention, idx) => (
                                    <span
                                      key={idx}
                                      className={`inline-flex items-center gap-1 px-2 py-0.5 rounded text-xs ${
                                        mention.user?._id === userId
                                          ? 'bg-yellow-500/20 text-yellow-400 border border-yellow-500/30'
                                          : 'bg-blue-500/20 text-blue-400 border border-blue-500/30'
                                      }`}
                                      title={mention.user?.email || mention.user?.name}
                                    >
                                      <Users className="w-3 h-3" />
                                      @{mention.user?.name || mention.user?.clientName || 'Unknown'}
                                    </span>
                                  ))}
                                </div>
                              )}
                            </>
                          )}

                          {/* Attachments */}
                          {msg.attachments && msg.attachments.length > 0 && (
                            <div className="mt-3 space-y-2">
                              {msg.attachments.map((att, attIdx) => (
                                <div
                                  key={attIdx}
                                  className="flex flex-col gap-2"
                                >
                                  <div className="flex items-center gap-2 p-2 bg-black/20 rounded">
                                    {getFileIcon(att.fileType)}
                                    <div className="flex-1 min-w-0">
                                      <div className="flex items-center gap-2">
                                        <div className="text-xs text-white truncate">
                                          {att.filename}
                                        </div>
                                        {att.isImportant && (
                                          <span className="text-xs text-yellow-400 flex items-center gap-1 flex-shrink-0">
                                            <Star className="w-3 h-3 fill-yellow-400" />
                                            Important
                                          </span>
                                        )}
                                      </div>
                                      <div className="text-xs text-gray-400">
                                        {(att.size / 1024).toFixed(1)} KB
                                      </div>
                                    </div>
                                    <button
                                      onClick={() => handleToggleImportant(msg._id, att._id, att.isImportant)}
                                      className={`p-1.5 rounded transition-colors ${
                                        att.isImportant
                                          ? "text-yellow-400 hover:bg-yellow-400/20"
                                          : "text-gray-400 hover:text-yellow-400 hover:bg-white/10"
                                      }`}
                                      title={att.isImportant ? "Remove from important" : "Mark as important (won't be auto-deleted)"}
                                    >
                                      <Star className={`w-4 h-4 ${att.isImportant ? "fill-yellow-400" : ""}`} />
                                    </button>
                                    <a
                                      href={`${API_BASE}/api/projects/${projectId}/messages/${msg._id}/attachments/${att._id}/download`}
                                      className="p-1 hover:bg-white/10 rounded"
                                      onClick={(e) => {
                                        e.preventDefault();
                                        const token = localStorage.getItem("token");
                                        fetch(`${API_BASE}/api/projects/${projectId}/messages/${msg._id}/attachments/${att._id}/download`, {
                                          headers: {
                                            'Authorization': `Bearer ${token}`
                                          }
                                        })
                                        .then(response => {
                                          if (!response.ok) throw new Error('Download failed');
                                          return response.blob();
                                        })
                                        .then(blob => {
                                          const url = window.URL.createObjectURL(blob);
                                          const a = document.createElement('a');
                                          a.href = url;
                                          a.download = att.filename || 'download';
                                          document.body.appendChild(a);
                                          a.click();
                                          window.URL.revokeObjectURL(url);
                                          document.body.removeChild(a);
                                        })
                                        .catch(error => {
                                          console.error('Download error:', error);
                                          showNotification('Failed to download file', 'error');
                                        });
                                      }}
                                    >
                                      <Download className="w-4 h-4 text-gray-300" />
                                    </a>
                                  </div>
                                  {att.fileType === "image" && (
                                    <img
                                      src={att.url.startsWith('http') ? att.url : `${API_BASE}${att.url}`}
                                      alt={att.filename}
                                      className="w-full max-w-sm rounded"
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
                                <div className={`emoji-picker-container absolute ${isOwnMessage ? 'right-0' : 'left-0'} bottom-full mb-2 p-2 bg-[#1a2332] border border-[#232945] rounded-lg shadow-2xl z-50 flex gap-1`}>
                                  {commonEmojis.map((emoji, emojiIdx) => (
                                    <button
                                      key={emojiIdx}
                                      onClick={(e) => {
                                        e.stopPropagation();
                                        handleReaction(msg._id, emoji);
                                      }}
                                      className="hover:bg-white/10 hover:scale-110 p-1.5 rounded transition-all text-lg"
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

              {/* Load More Messages Button */}
              {hasMoreMessages && messages.length > 0 && (
                <div className="flex justify-center py-4">
                  <button
                    onClick={loadMoreMessages}
                    disabled={loadingMoreMessages}
                    className="flex items-center gap-2 px-4 py-2 bg-blue-600/20 hover:bg-blue-600/40 text-blue-400 border border-blue-500/30 rounded-lg transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    {loadingMoreMessages ? (
                      <>
                        <div className="w-4 h-4 border-2 border-blue-400 border-t-transparent rounded-full animate-spin"></div>
                        <span>Loading...</span>
                      </>
                    ) : (
                      <>
                        <Plus className="w-4 h-4" />
                        <span>Load More Messages ({totalMessages - messages.length} remaining)</span>
                      </>
                    )}
                  </button>
                </div>
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

              {/* Quick Replies */}
              {quickReplies.length > 0 && newMessage.length === 0 && showQuickReplies && (
                <div className="mb-3 p-3 bg-[#0f1419] border border-[#232945] rounded-lg">
                  <div className="flex items-center justify-between mb-2">
                    <div className="flex items-center gap-2">
                      <Zap className="w-4 h-4 text-yellow-400" />
                      <span className="text-xs text-gray-400">Quick Replies:</span>
                    </div>
                    <button
                      type="button"
                      onClick={() => setShowQuickReplies(false)}
                      className="p-1 hover:bg-[#232945] rounded transition-colors"
                      title="Hide quick replies"
                    >
                      <XCircle className="w-4 h-4 text-gray-400" />
                    </button>
                  </div>
                  <div className="flex flex-wrap gap-2">
                    {quickReplies.map((reply, idx) => (
                      <button
                        key={idx}
                        type="button"
                        onClick={() => handleQuickReply(reply)}
                        className="px-3 py-1.5 bg-gradient-to-r from-blue-600/20 to-purple-600/20 hover:from-blue-600/30 hover:to-purple-600/30 border border-blue-500/30 rounded-full text-xs text-gray-200 transition-all hover:scale-105 flex items-center gap-1"
                      >
                        <Lightbulb className="w-3 h-3 text-yellow-400" />
                        {reply}
                      </button>
                    ))}
                  </div>
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
                  {/* Suggestions Dropdown */}
                  {showSuggestions && suggestions.length > 0 && (
                    <div
                      ref={suggestionsRef}
                      className="absolute bottom-full left-0 right-0 mb-2 bg-gray-900 border border-[#232945] rounded-lg shadow-2xl max-h-64 overflow-y-auto z-50"
                    >
                      <div className="p-2 border-b border-[#232945] flex items-center gap-2 sticky top-0 bg-gray-900">
                        <Sparkles className="w-4 h-4 text-blue-400" />
                        <span className="text-xs text-gray-400">
                          Suggestions ({suggestions.length}) • <kbd className="px-1 py-0.5 bg-gray-700 rounded text-[10px]">↑↓</kbd> to navigate • <kbd className="px-1 py-0.5 bg-gray-700 rounded text-[10px]">Tab</kbd> or <kbd className="px-1 py-0.5 bg-gray-700 rounded text-[10px]">Enter</kbd> to select
                        </span>
                      </div>
                      {suggestions.map((suggestion, idx) => (
                        <button
                          key={idx}
                          type="button"
                          onClick={() => acceptSuggestion(suggestion)}
                          className={`w-full text-left px-4 py-2 hover:bg-gray-800 transition-colors border-l-2 ${
                            idx === selectedSuggestionIndex
                              ? "bg-gray-800 border-blue-500"
                              : "border-transparent"
                          }`}
                        >
                          <div className="flex items-start gap-2">
                            <div className="flex-shrink-0 mt-1">
                              {suggestion.type === "history" && (
                                <Clock className="w-3 h-3 text-gray-400" />
                              )}
                              {suggestion.type === "quick" && (
                                <Zap className="w-3 h-3 text-yellow-400" />
                              )}
                              {suggestion.type === "task" && (
                                <Check className="w-3 h-3 text-green-400" />
                              )}
                              {suggestion.type === "project" && (
                                <File className="w-3 h-3 text-blue-400" />
                              )}
                              {suggestion.type === "frequent" && (
                                <Sparkles className="w-3 h-3 text-purple-400" />
                              )}
                            </div>
                            <div className="flex-1 min-w-0">
                              <p className="text-sm text-gray-200 truncate">
                                {suggestion.text}
                              </p>
                              <p className="text-xs text-gray-500 capitalize">
                                {suggestion.type === "history" && "From your history"}
                                {suggestion.type === "quick" && "Quick reply"}
                                {suggestion.type === "task" && "Task suggestion"}
                                {suggestion.type === "project" && "Project suggestion"}
                                {suggestion.type === "frequent" && "Frequently used"}
                              </p>
                            </div>
                          </div>
                        </button>
                      ))}
                    </div>
                  )}

                  <textarea
                    ref={textareaRef}
                    value={newMessage}
                    onChange={(e) => {
                      setNewMessage(e.target.value);
                    }}
                    onFocus={() => {
                      // Don't auto-scroll - let user stay where they are reading
                    }}
                    onKeyDown={(e) => {
                      // Handle suggestion navigation
                      if (showSuggestions && suggestions.length > 0) {
                        if (e.key === "ArrowDown") {
                          e.preventDefault();
                          setSelectedSuggestionIndex(prev =>
                            prev < suggestions.length - 1 ? prev + 1 : 0
                          );
                          return;
                        }
                        if (e.key === "ArrowUp") {
                          e.preventDefault();
                          setSelectedSuggestionIndex(prev =>
                            prev > 0 ? prev - 1 : suggestions.length - 1
                          );
                          return;
                        }
                        if (e.key === "Tab") {
                          e.preventDefault();
                          acceptSuggestion(suggestions[selectedSuggestionIndex]);
                          return;
                        }
                        if (e.key === "Escape") {
                          e.preventDefault();
                          setShowSuggestions(false);
                          return;
                        }
                      }

                      // Send message on Enter (without Shift)
                      if (e.key === "Enter" && !e.shiftKey && !e.ctrlKey && !e.metaKey) {
                        e.preventDefault();
                        // Accept suggestion if visible
                        if (showSuggestions && suggestions.length > 0) {
                          acceptSuggestion(suggestions[selectedSuggestionIndex]);
                        } else {
                          handleSendMessage(e);
                        }
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
              </>
            )}

            {/* Tasks Tab Content */}
            {activeTab === "tasks" && (
              <div className="flex-1 flex flex-col overflow-hidden">
                {/* Tasks Header with Create Button */}
                {(userRole === "super-admin" || userRole === "superadmin" || userRole === "admin") && (
                  <div className="p-4 sm:p-6 border-b border-[#232945]">
                    <div className="flex items-center justify-between">
                      <div>
                        <h2 className="text-base sm:text-lg font-semibold text-white flex items-center gap-2">
                          <ListTodo className="w-5 h-5 text-green-400" />
                          Project Tasks
                        </h2>
                        <p className="text-xs sm:text-sm text-gray-400 mt-1">
                          {tasks.length} task{tasks.length !== 1 ? "s" : ""}
                        </p>
                      </div>
                      <button
                        onClick={() => setShowTaskModal(true)}
                        className="flex items-center gap-2 px-4 py-2 bg-gradient-to-r from-purple-600 to-pink-600 hover:from-purple-700 hover:to-pink-700 text-white rounded-lg transition-all font-medium shadow-lg"
                      >
                        <Plus className="w-5 h-5" />
                        <span className="hidden sm:inline">Create Task</span>
                        <span className="sm:hidden">New</span>
                      </button>
                    </div>
                  </div>
                )}

                {/* Tasks List */}
                <div className="flex-1 overflow-y-auto p-4 sm:p-6">
                  {loadingTasks ? (
                    <div className="flex items-center justify-center h-full">
                      <div className="w-12 h-12 border-4 border-blue-500/20 border-t-blue-500 rounded-full animate-spin"></div>
                    </div>
                  ) : tasks.length === 0 ? (
                    <div className="flex flex-col items-center justify-center h-full text-center">
                      <ListTodo className="w-12 h-12 sm:w-16 sm:h-16 text-gray-600 mb-4" />
                      <p className="text-gray-500 text-sm sm:text-base">No tasks for this project</p>
                      <p className="text-gray-600 text-xs sm:text-sm mt-2">
                        {(userRole === "super-admin" || userRole === "superadmin" || userRole === "admin")
                          ? "Click 'Create Task' to assign tasks to team members"
                          : "Tasks will appear here when assigned by your admin"}
                      </p>
                    </div>
                  ) : (
                  <div className="space-y-4">
                    {tasks.map((task) => (
                      <div
                        key={task._id}
                        className="bg-[#0f1419] rounded-lg border border-[#232945] p-4 sm:p-6 hover:border-purple-500/50 transition-colors"
                      >
                        <div className="flex items-start justify-between gap-4 mb-4">
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center justify-between mb-2">
                              <h3 className="text-white font-semibold text-base sm:text-lg flex items-center gap-2">
                                {task.title}
                                <span
                                  className={`px-2 py-0.5 rounded-full text-xs font-medium ${
                                    task.priority === "High"
                                      ? "bg-red-500/20 text-red-400 border border-red-500/50"
                                      : task.priority === "Medium"
                                      ? "bg-yellow-500/20 text-yellow-400 border border-yellow-500/50"
                                      : "bg-blue-500/20 text-blue-400 border border-blue-500/50"
                                  }`}
                                >
                                  {task.priority}
                                </span>
                              </h3>
                              {/* Edit Button - Only for admins */}
                              {(userRole === "super-admin" || userRole === "superadmin" || userRole === "admin") && (
                                <button
                                  onClick={() => handleEditTask(task)}
                                  className="p-2 rounded-lg text-blue-400 hover:text-blue-300 hover:bg-blue-600/20 transition-all flex-shrink-0"
                                  title="Edit task"
                                >
                                  <Edit2 className="w-4 h-4" />
                                </button>
                              )}
                            </div>
                            {task.description && (
                              <p className="text-gray-400 text-sm mb-3">{task.description}</p>
                            )}

                            <div className="space-y-3">
                              <div className="flex items-center gap-1 text-xs text-gray-500">
                                <Calendar className="w-3 h-3" />
                                <span>Due: {task.dueDate ? new Date(task.dueDate).toLocaleDateString() : "No due date"}</span>
                              </div>

                              {/* Assigned Employees */}
                              {task.assignedTo && task.assignedTo.length > 0 && (
                                <div>
                                  <p className="text-xs text-gray-500 mb-2 flex items-center gap-1">
                                    <Users className="w-3 h-3" />
                                    Assigned to:
                                  </p>
                                  <div className="flex flex-wrap gap-2">
                                    {task.assignedTo.map((emp, idx) => (
                                      <div
                                        key={idx}
                                        className="flex items-center gap-2 bg-purple-600/10 border border-purple-500/30 rounded-full px-3 py-1"
                                      >
                                        {(userRole === "admin" || userRole === "super-admin" || userRole === "superadmin") ? (
                                          // Show name for admins/super-admins
                                          <>
                                            <div className="w-5 h-5 rounded-full bg-gradient-to-br from-purple-500 to-pink-500 flex items-center justify-center text-white text-[10px] font-semibold flex-shrink-0">
                                              {(emp.name || "U").charAt(0).toUpperCase()}
                                            </div>
                                            <span className="text-white text-xs font-medium">
                                              {emp.name || "Unknown"}
                                            </span>
                                          </>
                                        ) : (
                                          // Show employee ID and designation for clients
                                          <>
                                            <Briefcase className="w-3 h-3 text-purple-400" />
                                            <span className="text-white text-xs font-medium">
                                              {emp.employeeId || emp._id?.substring(0, 8) || "N/A"}
                                            </span>
                                            <span className="text-gray-400 text-xs">|</span>
                                            <span className="text-blue-400 text-xs">
                                              {emp.designation || "No designation"}
                                            </span>
                                          </>
                                        )}
                                      </div>
                                    ))}
                                  </div>
                                </div>
                              )}
                            </div>
                          </div>

                          <span
                            className={`px-3 py-1 rounded-full text-xs font-medium flex-shrink-0 ${
                              task.status === "completed"
                                ? "bg-green-500/20 text-green-400 border border-green-500/50"
                                : task.status === "in-progress"
                                ? "bg-blue-500/20 text-blue-400 border border-blue-500/50"
                                : task.status === "rejected"
                                ? "bg-red-500/20 text-red-400 border border-red-500/50"
                                : "bg-gray-500/20 text-gray-400 border border-gray-500/50"
                            }`}
                          >
                            {task.status}
                          </span>
                        </div>

                        {/* Submission Details */}
                        {task.submittedAt && (
                          <div className="mt-4 pt-4 border-t border-[#232945]">
                            <div className="mb-3">
                              <p className="text-xs text-gray-500 mb-2">
                                Submitted by: {
                                  (userRole === "admin" || userRole === "super-admin" || userRole === "superadmin")
                                    ? (task.assignedTo?.[0]?.name || "Unknown")
                                    : `${task.assignedTo?.[0]?.employeeId || task.assignedTo?.[0]?._id?.substring(0, 8) || "Unknown"} (${task.assignedTo?.[0]?.designation || "No designation"})`
                                }
                              </p>
                              <p className="text-xs text-gray-500">
                                Submitted on: {new Date(task.submittedAt).toLocaleString()}
                              </p>
                            </div>

                            {task.submissionUrl && (
                              <div className="mb-2">
                                <p className="text-xs text-gray-400 mb-1">URL:</p>
                                <a
                                  href={task.submissionUrl}
                                  target="_blank"
                                  rel="noopener noreferrer"
                                  className="text-blue-400 hover:text-blue-300 text-sm flex items-center gap-1 underline"
                                >
                                  {task.submissionUrl}
                                  <ExternalLink className="w-3 h-3" />
                                </a>
                              </div>
                            )}

                            {task.submissionText && (
                              <div className="mb-2">
                                <p className="text-xs text-gray-400 mb-1">Details:</p>
                                <p className="text-white text-sm bg-black/20 p-3 rounded">{task.submissionText}</p>
                              </div>
                            )}

                            {task.submissionRemark && (
                              <div className="mb-2">
                                <p className="text-xs text-gray-400 mb-1">Remark:</p>
                                <p className="text-gray-300 text-sm italic">{task.submissionRemark}</p>
                              </div>
                            )}

                            {/* Approval Status */}
                            <div className="mt-4">
                              <div className="flex items-center gap-2 mb-2">
                                <p className="text-xs text-gray-400">Approval Status:</p>
                                <span
                                  className={`px-2 py-0.5 rounded-full text-xs font-medium ${
                                    task.approvalStatus === "approved"
                                      ? "bg-green-500/20 text-green-400"
                                      : task.approvalStatus === "rejected"
                                      ? "bg-red-500/20 text-red-400"
                                      : "bg-yellow-500/20 text-yellow-400"
                                  }`}
                                >
                                  {task.approvalStatus}
                                </span>
                              </div>

                              {task.approvalRemark && (
                                <div className="mb-3">
                                  <p className="text-xs text-gray-400 mb-1">Admin Feedback:</p>
                                  <p className="text-white text-sm bg-purple-600/10 p-3 rounded border border-purple-500/30">
                                    {task.approvalRemark}
                                  </p>
                                </div>
                              )}

                              {/* Approval Actions (Only for admin, super-admin, or task assigner for pending submissions) */}
                              {((userRole === "super-admin" || userRole === "superadmin" || userRole === "admin" || task.assignedBy?._id === userId) && task.approvalStatus === "pending") && (
                                <div className="mt-3">
                                  {selectedTask === task._id ? (
                                    <div className="space-y-3">
                                      <textarea
                                        value={approvalRemark}
                                        onChange={(e) => setApprovalRemark(e.target.value)}
                                        placeholder="Add feedback (optional for approval, required for rejection)..."
                                        className="w-full px-3 py-2 bg-[#191f2b] border border-[#232945] rounded-lg text-white text-sm placeholder-gray-500 focus:outline-none focus:border-purple-500 h-20 resize-none"
                                      />
                                      <div className="flex gap-2">
                                        <button
                                          onClick={() => handleApproveSubmission(task._id)}
                                          className="flex-1 flex items-center justify-center gap-2 px-4 py-2 bg-green-600/20 hover:bg-green-600/40 text-green-400 rounded-lg border border-green-500/30 transition-colors"
                                        >
                                          <ThumbsUp className="w-4 h-4" />
                                          Approve
                                        </button>
                                        <button
                                          onClick={() => handleRejectSubmission(task._id)}
                                          className="flex-1 flex items-center justify-center gap-2 px-4 py-2 bg-red-600/20 hover:bg-red-600/40 text-red-400 rounded-lg border border-red-500/30 transition-colors"
                                        >
                                          <ThumbsDown className="w-4 h-4" />
                                          Reject
                                        </button>
                                        <button
                                          onClick={() => {
                                            setSelectedTask(null);
                                            setApprovalRemark("");
                                          }}
                                          className="px-4 py-2 bg-gray-600/20 hover:bg-gray-600/40 text-gray-400 rounded-lg transition-colors"
                                        >
                                          Cancel
                                        </button>
                                      </div>
                                    </div>
                                  ) : (
                                    <button
                                      onClick={() => setSelectedTask(task._id)}
                                      className="w-full px-4 py-2 bg-purple-600/20 hover:bg-purple-600/40 text-purple-400 rounded-lg border border-purple-500/30 transition-colors font-medium"
                                    >
                                      Review Submission
                                    </button>
                                  )}
                                </div>
                              )}
                            </div>
                          </div>
                        )}

                        {/* No submission yet */}
                        {!task.submittedAt && (
                          <div className="mt-4 pt-4 border-t border-[#232945]">
                            <p className="text-gray-500 text-sm italic">No submission yet</p>
                          </div>
                        )}
                      </div>
                    ))}
                  </div>
                )}
                </div>
              </div>
            )}

            {/* Project Report Tab Content */}
            {activeTab === "report" && (
              <ProjectReportTab
                projectId={projectId}
                userRole={userRole}
                userId={userId}
              />
            )}
          </div>
        </div>
      </div>

      {/* Task Creation Modal */}
      {showTaskModal && project && (
        <ProjectTaskModal
          projectId={projectId}
          projectEmployees={project.assignedTo || []}
          onClose={() => setShowTaskModal(false)}
          onTaskCreated={handleTaskCreated}
        />
      )}

      {/* Task Edit Modal */}
      {showEditTaskModal && editingTask && project && (
        <ProjectTaskEditModal
          task={editingTask}
          projectEmployees={project.assignedTo || []}
          onClose={() => {
            setShowEditTaskModal(false);
            setEditingTask(null);
          }}
          onTaskUpdated={handleTaskUpdated}
        />
      )}

      {/* AI Summary Modal */}
      {showSummaryModal && (
        <div
          className="fixed inset-0 bg-black bg-opacity-75 flex items-center justify-center p-4"
          style={{ zIndex: 9999 }}
          onClick={() => setShowSummaryModal(false)}
        >
          <div
            className="bg-[#0f1419] rounded-lg shadow-2xl max-w-3xl w-full max-h-[80vh] flex flex-col border border-[#232945]"
            onClick={(e) => e.stopPropagation()}
          >
            {/* Modal Header */}
            <div className="flex items-center justify-between p-4 border-b border-[#232945]">
              <div className="flex items-center gap-3">
                <Sparkles className="w-5 h-5 text-purple-400" />
                <h2 className="text-xl font-semibold text-white">
                  AI Project Summary
                </h2>
              </div>
              <button
                onClick={() => setShowSummaryModal(false)}
                className="p-2 hover:bg-[#232945] rounded-lg transition"
              >
                <XCircle className="w-5 h-5 text-gray-400" />
              </button>
            </div>

            {/* Days Selector */}
            <div className="px-4 py-3 border-b border-[#232945] bg-[#0a0e14]">
              <div className="flex items-center gap-3">
                <label className="text-sm text-gray-400">Time period:</label>
                <select
                  value={summaryDays}
                  onChange={(e) => setSummaryDays(Number(e.target.value))}
                  className="px-3 py-1.5 bg-[#0f1419] text-white rounded border border-[#232945] focus:outline-none focus:ring-2 focus:ring-purple-500 text-sm"
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
            </div>

            {/* Modal Body */}
            <div className="flex-1 overflow-y-auto p-6">
              {summaryLoading ? (
                <div className="flex flex-col items-center justify-center h-full gap-4">
                  <div className="relative">
                    <div className="w-16 h-16 border-4 border-purple-500/30 border-t-purple-500 rounded-full animate-spin"></div>
                    <Sparkles className="w-6 h-6 text-purple-400 absolute top-1/2 left-1/2 transform -translate-x-1/2 -translate-y-1/2" />
                  </div>
                  <p className="text-gray-400 text-sm">Analyzing project messages with AI...</p>
                </div>
              ) : (
                <div className="prose prose-invert prose-sm max-w-none">
                  <ReactMarkdown
                    remarkPlugins={[remarkGfm]}
                    rehypePlugins={[rehypeRaw]}
                    components={{
                      p: ({ children }) => (
                        <p className="mb-3 text-gray-200 leading-relaxed">{children}</p>
                      ),
                      h1: ({ children }) => (
                        <h1 className="text-2xl font-bold mb-3 text-white">{children}</h1>
                      ),
                      h2: ({ children }) => (
                        <h2 className="text-xl font-bold mb-2 text-white">{children}</h2>
                      ),
                      h3: ({ children }) => (
                        <h3 className="text-lg font-bold mb-2 text-white">{children}</h3>
                      ),
                      ul: ({ children }) => (
                        <ul className="list-disc list-inside mb-3 space-y-1">{children}</ul>
                      ),
                      ol: ({ children }) => (
                        <ol className="list-decimal list-inside mb-3 space-y-1">{children}</ol>
                      ),
                      li: ({ children }) => (
                        <li className="ml-2 text-gray-200">{children}</li>
                      ),
                      strong: ({ children }) => (
                        <strong className="font-bold text-purple-300">{children}</strong>
                      ),
                      code: ({ inline, children }) =>
                        inline ? (
                          <code className="bg-[#0a0e14] px-1.5 py-0.5 rounded text-purple-300 text-xs">
                            {children}
                          </code>
                        ) : (
                          <code className="block bg-[#0a0e14] p-3 rounded text-sm overflow-x-auto text-gray-300">
                            {children}
                          </code>
                        ),
                    }}
                  >
                    {summary}
                  </ReactMarkdown>
                </div>
              )}
            </div>

            {/* Modal Footer */}
            <div className="p-4 border-t border-[#232945] flex justify-between items-center bg-[#0a0e14]">
              <div className="text-xs text-gray-500">
                Powered by AI • Last {summaryDays} day{summaryDays !== 1 ? 's' : ''}
              </div>
              <button
                onClick={() => {
                  navigator.clipboard.writeText(summary);
                  setCopiedText(summary);
                  setTimeout(() => setCopiedText(null), 2000);
                }}
                disabled={!summary || summaryLoading}
                className="px-4 py-2 bg-[#0f1419] hover:bg-[#232945] text-gray-200 rounded transition disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2 text-sm border border-[#232945]"
              >
                {copiedText === summary ? (
                  <>
                    <Check className="w-4 h-4" />
                    Copied!
                  </>
                ) : (
                  <>
                    <Copy className="w-4 h-4" />
                    Copy Summary
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

export default ProjectDetailPage;
