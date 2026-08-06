import React, { useState, useEffect, useRef } from "react";
import { useLocation } from "react-router-dom";
import axios from "axios";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import rehypeRaw from "rehype-raw";
import { BrowserNotificationManager } from "../utils/browserNotifications";
import { useWebSocketContext } from "../contexts/WebSocketContext";
// Phase 4b: this page carried a THIRD complete copy of project chat, alongside
// ProjectMessagePanel (employee view) and the chat surface. Same store, same
// API module now — so "unread" means one thing whether you are looking at a
// project as an admin or as an assignee.
import { useDispatch, useSelector } from "react-redux";
import * as messagingApi from "../api/messagingApi";
import {
  fetchMessages as fetchThreadMessages,
  selectMessages,
  selectTyping,
} from "../store/slices/threadsSlice";
import useMessageSuggestions from "../hooks/useMessageSuggestions";
import ProjectTaskModal from "../components/project/ProjectTaskModal";
import ProjectTaskEditModal from "../components/project/ProjectTaskEditModal";
import UnreadMessageBadge from "../components/message/UnreadMessageBadge";
import ProjectReportTab from "../components/project/ProjectReportTab";
import ProjectCommunicationContext from "../components/project/ProjectCommunicationContext";
import MentionInput from "../components/common/MentionInput";
import MessageStatus from "../components/message/MessageStatus";
import TypingIndicator from "../components/message/TypingIndicator";
import MessageDateSeparator from "../components/message/MessageDateSeparator";
import PinnedMessagesModal from "../components/message/PinnedMessagesModal";
import ThreadSummaryModal from "../components/message/ThreadSummaryModal";
import EmojiPickerEnhanced from "../components/chat/EmojiPickerEnhanced";
import NewMessagesButton from "../components/chat/NewMessagesButton";
import {
  ArrowLeft,
  ArrowDown,
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
  Pin,
  Menu,
  X,
  Info,
  ChevronRight,
  ChevronUp,
  ChevronDown,
  MoreHorizontal,
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
  const dispatch = useDispatch();

  const SCOPE = messagingApi.SCOPES.PROJECT;
  // Thread history from the store. Previously local state fed by a fetch, a
  // localStorage cache, and a socket listener that appended directly — three
  // writers to one array.
  const messages = useSelector(selectMessages(SCOPE, projectId));
  const typingMap = useSelector(selectTyping(SCOPE, projectId));

  const [project, setProject] = useState(null);
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
  const [mentionedUsers, setMentionedUsers] = useState([]);
  const [searchTerm, setSearchTerm] = useState("");
  const [searchSender, setSearchSender] = useState("");
  const [dateFilter, setDateFilter] = useState({ start: "", end: "" });
  const [showFilters, setShowFilters] = useState(false);
  const [showFormatting, setShowFormatting] = useState(false);
  const [showEmojiPicker, setShowEmojiPicker] = useState(null);
  const [showActions, setShowActions] = useState(false);
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
  const prevMessagesLengthRef = useRef(0);
  // Message ids already reported as read this session — see the
  // IntersectionObserver effect.
  const markedReadRef = useRef(new Set());
  const {
    isConnected: wsConnected,
    joinProject,
    leaveProject,
    sendProjectTyping,
    sendProjectStopTyping,
  } = useWebSocketContext();

  // Message suggestions
  const { getSuggestions } = useMessageSuggestions(projectId, messages);
  const [suggestions, setSuggestions] = useState([]);
  const [selectedSuggestionIndex, setSelectedSuggestionIndex] = useState(0);
  const [showSuggestions, setShowSuggestions] = useState(false);

  // New state for Tasks 8-11
  const [typingUsers, setTypingUsers] = useState([]);
  const [showPinnedModal, setShowPinnedModal] = useState(false);
  const [showEnhancedEmojiPicker, setShowEnhancedEmojiPicker] = useState(false);
  const typingTimeoutRef = useRef(null);
  const [starredMessageIds, setStarredMessageIds] = useState(new Set());
  const [showStarredOnly, setShowStarredOnly] = useState(false);
  const [newMessagesCount, setNewMessagesCount] = useState(0);
  const [showNewMessagesButton, setShowNewMessagesButton] = useState(false);
  const [showSidebar, setShowSidebar] = useState(
    () => typeof window === "undefined" || window.innerWidth >= 768
  );
  const [showComposerTools, setShowComposerTools] = useState(false);
  const suggestionsRef = useRef(null);

  // Initial data load for this project
  useEffect(() => {
    fetchProjectDetails();
    fetchMessages();
    fetchStarredMessages();
  }, [projectId]);

  // Real-time project room — join on mount / project change, leave on
  // unmount. The actual socket connection is owned by WebSocketContext
  // (one shared connection for the whole app); this used to open its own
  // separate `new WebSocket(...)` here, which was the duplicate-connection
  // bug flagged in docs/NOTIFICATION_SYSTEM_FIXES.md.
  useEffect(() => {
    if (!projectId) return undefined;

    // Joining the room is all this effect does now.
    //
    // All four `project-*` window listeners are gone. Message data, typing and
    // read receipts come from the store; the browser-notification side effect
    // moved to WebSocketContext, which is mounted app-wide — so a project
    // message now notifies you whether or not you happen to have that project's
    // page open, which is what a notification is for.
    joinProject(projectId);
    return () => leaveProject(projectId);
  }, [projectId, joinProject, leaveProject]);

  // Keep the "N messages" counter in step with what the store holds.
  useEffect(() => {
    setTotalMessages((prev) => Math.max(prev, messages.length));
  }, [messages.length]);

  // Typing, derived from the store. Replaces a listener that leaked a 3s
  // setTimeout for every typing event received.
  useEffect(() => {
    const others = Object.entries(typingMap || {})
      .filter(([id]) => String(id) !== String(userId))
      .map(([id, userName]) => ({ userId: id, userName }));

    setTypingUsers(others);
    if (others.length === 0) return undefined;

    const t = setTimeout(() => setTypingUsers([]), 4000);
    return () => clearTimeout(t);
  }, [typingMap, userId]);

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

  // Handle suggestion selection
  const acceptSuggestion = (suggestion) => {
    setNewMessage(suggestion.text);
    setShowSuggestions(false);
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
    if (chatContainerRef.current) {
      chatContainerRef.current.scrollTo({
        top: chatContainerRef.current.scrollHeight,
        behavior: "smooth"
      });
    }
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
      // Populate tasks directly from project response — bypasses role-based filter issues
      if (Array.isArray(projectData.tasks) && projectData.tasks.length > 0) {
        setTasks(projectData.tasks);
      }
    } catch (error) {
      console.error("Error fetching project:", error);
      showNotification("Error loading project details", "error");
    } finally {
      setLoading(false);
    }
  };

  const fetchMessages = async (page = 1, append = false) => {
    try {
      if (append) setLoadingMoreMessages(true);

      // Filters are sent to the server because this surface paginates — unlike
      // ProjectMessagePanel, it cannot filter client-side over a partial list.
      const params = {
        page,
        limit: 50,
        ...(searchTerm ? { search: searchTerm } : {}),
        ...(searchSender ? { senderName: searchSender } : {}),
        ...(dateFilter.start ? { startDate: dateFilter.start } : {}),
        ...(dateFilter.end ? { endDate: dateFilter.end } : {}),
      };

      const action = await dispatch(
        fetchThreadMessages({ scope: SCOPE, threadId: projectId, params })
      );
      const pagination = action?.payload?.pagination;

      // The store merges by id and keeps the list ordered, so "append" needs no
      // special handling here — the previous version concatenated and re-sorted
      // the whole array manually on every page.
      if (pagination) {
        setCurrentPage(pagination.page);
        setHasMoreMessages(pagination.hasMore);
        setTotalMessages(pagination.total);
      }

      if (!append) markMessagesAsRead();
    } catch (error) {
      console.error("Error fetching messages:", error);
    } finally {
      setLoadingMoreMessages(false);
    }
  };

  const loadMoreMessages = async () => {
    if (hasMoreMessages && !loadingMoreMessages) {
      // Save scroll position before loading
      const container = chatContainerRef.current;
      const previousScrollHeight = container?.scrollHeight || 0;
      const previousScrollTop = container?.scrollTop || 0;

      await fetchMessages(currentPage + 1, true);

      // Restore scroll position after loading older messages
      // This prevents the view from jumping to the top
      // Use longer timeout to ensure DOM updates are complete after sorting
      setTimeout(() => {
        if (container) {
          const newScrollHeight = container.scrollHeight;
          const addedHeight = newScrollHeight - previousScrollHeight;
          // Adjust scroll position to account for newly added messages at the top
          container.scrollTop = previousScrollTop + addedHeight;
        }
      }, 150);
    }
  };

  // The localStorage message cache this page used is gone deliberately.
  //
  // It was a second source of truth for message bodies (the store is the
  // first), it had a QuotaExceededError handler that evicted OTHER projects'
  // caches to make room, and — the actual reason — it left client conversation
  // content sitting in localStorage after logout, unencrypted, readable by
  // anyone with access to the machine. The store gives the same instant-render
  // benefit within a session without persisting message bodies to disk.
  //
  // This effect purges anything a previously-deployed build already wrote, so
  // upgrading doesn't leave that content behind forever.
  useEffect(() => {
    try {
      Object.keys(localStorage)
        .filter((k) => k.startsWith("project_messages_"))
        .forEach((k) => localStorage.removeItem(k));
    } catch {
      /* ignore */
    }
  }, []);

  // Mark all messages in this project as read
  const markMessagesAsRead = async () => {
    try {
      await messagingApi.markRead(SCOPE, projectId);

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
        if (chatContainerRef.current) {
          chatContainerRef.current.scrollTo({
            top: chatContainerRef.current.scrollHeight,
            behavior: "smooth"
          });
        }
      }, 300);

      // Clear navigation state
      window.history.replaceState({}, document.title);
    }
  }, [location.state]);

  const fetchTasks = async () => {
    setLoadingTasks(true);
    try {
      const token = localStorage.getItem("token");
      // Re-fetch the project to get fresh tasks (avoids role-based API filter issues)
      const res = await axios.get(`${API_BASE}/api/projects/${projectId}`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (Array.isArray(res.data?.tasks)) {
        setTasks(res.data.tasks);
      }
    } catch (error) {
      console.error("Error fetching tasks:", error);
      showNotification("Error loading tasks", "error");
    } finally {
      setLoadingTasks(false);
    }
  };

  // Reject a completed task with a reason (admin / super-admin)
  const handleRejectCompletedTask = async (taskId) => {
    if (!approvalRemark.trim()) {
      showNotification("Please provide a rejection reason", "error");
      return;
    }
    try {
      const token = localStorage.getItem("token");
      await axios.patch(
        `${API_BASE}/api/tasks/${taskId}/reject`,
        { reason: approvalRemark },
        { headers: { Authorization: `Bearer ${token}` } }
      );
      showNotification("Task rejected", "success");
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

  const handleUpdateTaskStatus = async (taskId, newStatus) => {
    try {
      const token = localStorage.getItem("token");
      await axios.patch(
        `${API_BASE}/api/tasks/${taskId}/status`,
        { status: newStatus },
        { headers: { Authorization: `Bearer ${token}` } }
      );
      // Optimistically update local state
      setTasks((prev) =>
        prev.map((t) => (t._id === taskId ? { ...t, status: newStatus } : t))
      );
      showNotification("Task status updated!", "success");
    } catch (error) {
      console.error("Error updating task status:", error);
      showNotification("Failed to update task status", "error");
    }
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

  // Scroll detection for New Messages Button
  useEffect(() => {
    const container = chatContainerRef.current;
    if (!container) return;

    const handleScroll = () => {
      const { scrollTop, scrollHeight, clientHeight } = container;
      const distanceFromBottom = scrollHeight - scrollTop - clientHeight;

      // Show button if user scrolled up more than 200px from bottom
      if (distanceFromBottom > 200) {
        setShowNewMessagesButton(true);
      } else {
        setShowNewMessagesButton(false);
        setNewMessagesCount(0);
      }
    };

    container.addEventListener('scroll', handleScroll);
    return () => container.removeEventListener('scroll', handleScroll);
  }, []);

  // Track new messages when scrolled up
  useEffect(() => {
    if (showNewMessagesButton && messages.length > prevMessagesLengthRef.current) {
      const newMsgsCount = messages.length - prevMessagesLengthRef.current;
      setNewMessagesCount((prev) => prev + newMsgsCount);
    }
  }, [messages.length, showNewMessagesButton]);

  // Intersection Observer for read receipts
  useEffect(() => {
    const observer = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          if (!entry.isIntersecting) return;

          const messageId = entry.target.getAttribute('data-message-id');
          const messageOwnerId = entry.target.getAttribute('data-owner-id');
          if (!messageId || messageOwnerId === userId) return;

          // Marked-once guard: this effect rebuilds the observer on every
          // `messages` change, so without it a message that stays on screen is
          // re-POSTed on every render.
          if (markedReadRef.current.has(messageId)) return;
          markedReadRef.current.add(messageId);

          messagingApi
            .markMessageRead(SCOPE, projectId, messageId)
            .catch((error) => {
              markedReadRef.current.delete(messageId);
              console.error('Error marking message as read:', error);
            });
        });
      },
      { threshold: 0.5 }
    );

    const messageElements = document.querySelectorAll('[data-message-id]');
    messageElements.forEach(el => observer.observe(el));

    return () => observer.disconnect();
  }, [messages, projectId, userId]);

  const handleSendMessage = async (e) => {
    e.preventDefault();
    if (!newMessage.trim() && selectedFiles.length === 0) return;

    setSending(true);
    try {
      // Response unused: the server broadcasts the saved message to the project
      // room and to each member's personal room, so it reaches this client (and
      // every other) through the store.
      await messagingApi.sendMessage(SCOPE, projectId, {
        body: newMessage || "(File attachment)",
        files: selectedFiles,
        replyTo: replyingTo ? replyingTo._id : null,
        mentions: mentionedUsers.map((u) => ({ user: u._id, userModel: "User" })),
        senderType: userRole,
      });


      setNewMessage("");
      setSelectedFiles([]);
      setReplyingTo(null);
      setMentionedUsers([]);
      // No refetch — the thunk already put the sent message in the store, and
      // the socket echo dedupes against it. This used to reload the whole
      // first page of the thread after every send.
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
      await messagingApi.react(SCOPE, projectId, messageId, emoji);
      // The server broadcasts `thread:updated`, which patches this one message
      // in the store — no local mutation needed.
      setShowEmojiPicker(null);
    } catch (error) {
      console.error("Error adding reaction:", error);
      showNotification("Failed to add reaction", "error");
    }
  };

  const handleToggleImportant = async (messageId, attachmentId) => {
    try {
      const data = await messagingApi.toggleAttachmentImportant(
        projectId,
        messageId,
        attachmentId
      );

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

  // Typing indicator functions
  const sendTypingIndicator = () => {
    if (wsConnected) {
      // Resolve the current user's own display name. assignedTo only lists
      // employees on this project, so an admin/superadmin (or a client)
      // typing would never be found there and would silently show up as
      // "User" to everyone else. localStorage's "user" record is set at
      // login for every role and always reflects who's actually typing, so
      // it's checked first; the project arrays are kept only as a fallback.
      let myName;
      try {
        const storedUser = JSON.parse(localStorage.getItem("user") || "{}");
        myName = storedUser?.name || storedUser?.clientName;
      } catch {
        myName = null;
      }
      if (!myName) {
        myName =
          project?.assignedTo?.find((u) => u._id === userId)?.name ||
          project?.clients?.find((c) => c._id === userId)?.clientName;
      }

      sendProjectTyping(projectId, myName || "User");

      // Clear existing timeout
      if (typingTimeoutRef.current) {
        clearTimeout(typingTimeoutRef.current);
      }

      // Stop typing after 3 seconds
      typingTimeoutRef.current = setTimeout(() => {
        stopTypingIndicator();
      }, 3000);
    }
  };

  const stopTypingIndicator = () => {
    if (wsConnected) {
      sendProjectStopTyping(projectId);
    }
  };

  // Jump to message function for pinned messages modal
  const handleJumpToMessage = (messageId) => {
    const messageElement = document.getElementById(`message-${messageId}`);
    if (messageElement) {
      messageElement.scrollIntoView({ behavior: 'smooth', block: 'center' });
      // Highlight the message briefly with flash animation
      messageElement.classList.add('animate-highlightFlash');
      setTimeout(() => {
        messageElement.classList.remove('animate-highlightFlash');
      }, 2000);
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
      const text = await messagingApi.summarize(SCOPE, currentProjectId, summaryDays);
      setSummary(text || "No summary available.");
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

  // Starred messages functionality
  const fetchStarredMessages = async () => {
    try {
      const starred = await messagingApi.listStarred(projectId);
      setStarredMessageIds(new Set(starred.map((msg) => msg._id)));
    } catch (error) {
      console.error("Error fetching starred messages:", error);
    }
  };

  const toggleStarMessage = async (messageId) => {
    try {
      // The server exposes ONE endpoint that toggles:
      //   POST /api/projects/:projectId/messages/:messageId/star
      // This used to send DELETE to unstar. No such route exists, so every
      // unstar 404'd and reported "Failed to update starred status" — the
      // feature only ever worked in one direction. The response tells us which
      // way it went, so local state follows the server rather than guessing.
      const result = await messagingApi.toggleStar(projectId, messageId);
      const nowStarred = result?.action === "star";

      setStarredMessageIds((prev) => {
        const next = new Set(prev);
        if (nowStarred) next.add(messageId);
        else next.delete(messageId);
        return next;
      });

      showNotification(
        nowStarred ? "Added to starred messages" : "Removed from starred messages",
        "success"
      );
    } catch (error) {
      console.error("Error toggling star:", error);
      showNotification("Failed to update starred status", "error");
    }
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
      <div className="flex min-h-screen items-center justify-center bg-slate-50 dark:bg-gradient-to-br dark:from-[#141a21] dark:via-[#191f2b] dark:to-[#101218]">
        <div className="text-center">
          <div className="w-12 h-12 border-4 border-blue-500/20 border-t-blue-500 rounded-full animate-spin mx-auto mb-4"></div>
          <p className="text-slate-500 dark:text-gray-400">Loading project details...</p>
        </div>
      </div>
    );
  }

  if (!project) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-slate-50 dark:bg-gradient-to-br dark:from-[#141a21] dark:via-[#191f2b] dark:to-[#101218]">
        <div className="text-center">
          <AlertCircle className="w-12 h-12 text-red-400 mx-auto mb-4" />
          <p className="text-slate-500 dark:text-gray-400">Project not found</p>
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
  const projectClientName = project.clients?.length
    ? project.clients.map((client) => client?.businessName || client?.clientName).filter(Boolean).join(", ")
    : "No client assigned";
  const lastMessage = messages[messages.length - 1];
  const isClientUser = userRole === "client";
  const lastMessageFromClient = lastMessage?.senderType === "client";
  const responseState = !lastMessage
    ? { label: "Start the conversation", classes: "border-slate-200 bg-slate-100 text-slate-700 dark:border-slate-500/20 dark:bg-slate-500/10 dark:text-slate-300" }
    : isClientUser
      ? lastMessageFromClient
        ? { label: "Waiting on project team", classes: "border-sky-200 bg-sky-50 text-sky-700 dark:border-sky-400/20 dark:bg-sky-500/10 dark:text-sky-300" }
        : { label: "Your response requested", classes: "border-amber-200 bg-amber-50 text-amber-700 dark:border-amber-400/25 dark:bg-amber-500/10 dark:text-amber-300" }
      : lastMessageFromClient
        ? { label: "Team response required", classes: "border-amber-200 bg-amber-50 text-amber-700 dark:border-amber-400/25 dark:bg-amber-500/10 dark:text-amber-300" }
        : { label: "Waiting on client", classes: "border-sky-200 bg-sky-50 text-sky-700 dark:border-sky-400/20 dark:bg-sky-500/10 dark:text-sky-300" };

  return (
    <div className="flex h-screen flex-col overflow-hidden bg-slate-50 text-slate-900 dark:bg-[#090f14] dark:text-blue-100">
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

      {/* Compact project header */}
      <header className="relative z-30 border-b border-slate-200 bg-white/95 backdrop-blur-xl dark:border-white/10 dark:bg-[#0c1319]/95">
        <div className="flex min-h-16 flex-wrap items-center gap-3 px-3 py-2 sm:px-5">
          <button
            type="button"
            onClick={onBack}
            className="rounded-lg p-2 text-slate-500 transition hover:bg-slate-100 hover:text-slate-900 dark:text-slate-400 dark:hover:bg-white/5 dark:hover:text-white"
            aria-label="Go back"
          >
            <ArrowLeft className="h-5 w-5" />
          </button>

          <div className={`rounded-xl border p-2 ${colors.bg} ${colors.border}`}>
            <Icon className={`h-5 w-5 ${colors.text}`} />
          </div>

          <div className="min-w-[12rem] flex-1">
            <div className="flex flex-wrap items-center gap-2">
              <h1 className="max-w-xl truncate text-lg font-semibold tracking-tight text-slate-950 dark:text-white sm:text-xl">
                {project.projectName}
              </h1>
              <span className="inline-flex items-center gap-1.5 rounded-full border border-teal-200 bg-teal-50 px-2.5 py-1 text-[11px] font-medium capitalize text-teal-700 dark:border-teal-400/20 dark:bg-teal-500/10 dark:text-teal-300">
                <span className="h-1.5 w-1.5 rounded-full bg-teal-400" />
                {project.status || status}
              </span>
              <span className={`inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-[11px] font-medium ${responseState.classes}`}>
                <Clock className="h-3 w-3" />
                {responseState.label}
              </span>
            </div>
            <p className="mt-1 truncate text-xs text-slate-500 dark:text-slate-400">{projectClientName}</p>
          </div>

          <button
            type="button"
            onClick={() => setShowSidebar((visible) => !visible)}
            className={`flex items-center gap-2 rounded-lg border px-3 py-2 text-sm transition ${
              showSidebar
                ? "border-teal-300 bg-teal-50 text-teal-700 dark:border-teal-400/25 dark:bg-teal-500/10 dark:text-teal-300"
                : "border-slate-200 bg-slate-50 text-slate-600 hover:bg-slate-100 hover:text-slate-950 dark:border-white/10 dark:bg-white/[0.035] dark:text-slate-300 dark:hover:bg-white/[0.06] dark:hover:text-white"
            }`}
            aria-label={showSidebar ? "Hide project details" : "Show project details"}
          >
            <Info className="h-4 w-4" />
            <span className="hidden sm:inline">Project details</span>
          </button>
        </div>
      </header>

      {/* Main Content - Full Width Layout */}
      <div className="relative flex flex-1 overflow-hidden">
        {/* Overlay for mobile when sidebar is open */}
        {showSidebar && (
          <div
            className="absolute inset-0 z-30 bg-black/60 backdrop-blur-[1px] md:hidden"
            onClick={() => setShowSidebar(false)}
          />
        )}

        {showSidebar && (
          <ProjectCommunicationContext
            project={project}
            tasks={tasks}
            messages={messages}
            userRole={userRole}
            onClose={() => setShowSidebar(false)}
            onOpenPinned={() => setShowPinnedModal(true)}
            onOpenTasks={() => setActiveTab("tasks")}
          />
        )}

        {/* Main project workspace */}
        <div className={`min-w-0 flex-1 transition-[margin] duration-300 ${showSidebar ? 'md:mr-[22rem]' : 'mr-0'}`}>
          <div className="flex h-full flex-col bg-slate-50 dark:bg-[#090f14]">
            {/* Project sections */}
            <div className="border-b border-slate-200 bg-white dark:border-white/10 dark:bg-[#0d151c]">
              <div className="flex items-center gap-6 overflow-x-auto px-4 sm:px-5">
                <button
                  type="button"
                  onClick={() => setActiveTab("chat")}
                  className={`flex shrink-0 items-center gap-2 border-b-2 px-1 py-2.5 text-sm font-medium transition-all ${
                    activeTab === "chat"
                      ? "border-teal-500 text-teal-700 dark:border-teal-400 dark:text-teal-300"
                      : "border-transparent text-slate-500 hover:text-slate-900 dark:text-slate-400 dark:hover:text-white"
                  }`}
                >
                  <Mail className="h-4 w-4" />
                  <span>Chat</span>
                  <UnreadMessageBadge projectId={projectId} className="text-xs" />
                </button>
                <button
                  type="button"
                  onClick={() => setActiveTab("tasks")}
                  className={`flex shrink-0 items-center gap-2 border-b-2 px-1 py-2.5 text-sm font-medium transition-all ${
                    activeTab === "tasks"
                      ? "border-teal-500 text-teal-700 dark:border-teal-400 dark:text-teal-300"
                      : "border-transparent text-slate-500 hover:text-slate-900 dark:text-slate-400 dark:hover:text-white"
                  }`}
                >
                  <ListTodo className="h-4 w-4" />
                  <span>Tasks</span>
                  {tasks.length > 0 && (
                    <span className="rounded-full bg-teal-50 px-1.5 py-0.5 text-[10px] font-semibold text-teal-700 dark:bg-teal-500/15 dark:text-teal-300">
                      {tasks.length}
                    </span>
                  )}
                </button>
                <button
                  type="button"
                  onClick={() => setActiveTab("report")}
                  className={`flex shrink-0 items-center gap-2 border-b-2 px-1 py-2.5 text-sm font-medium transition-all ${
                    activeTab === "report"
                      ? "border-teal-500 text-teal-700 dark:border-teal-400 dark:text-teal-300"
                      : "border-transparent text-slate-500 hover:text-slate-900 dark:text-slate-400 dark:hover:text-white"
                  }`}
                >
                  <BarChart3 className="h-4 w-4" />
                  <span>Report</span>
                </button>
              </div>
            </div>

            {/* Chat Tab Content */}
            {activeTab === "chat" && (
              <>
                {/* Chat Header */}
                <div className="relative flex items-center justify-between gap-3 border-b border-slate-200 bg-white px-3 py-2 dark:border-white/10 dark:bg-[#0d151c] sm:px-4">
                  <div className="flex min-w-0 items-center gap-2">
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

                  <div className="flex items-center gap-2">
                    <button
                      type="button"
                      onClick={() => setShowFilters((visible) => !visible)}
                      className={`rounded-lg border p-2 transition ${
                        showFilters
                          ? "border-teal-300 bg-teal-50 text-teal-700 dark:border-teal-400/25 dark:bg-teal-500/10 dark:text-teal-300"
                          : "border-slate-200 bg-slate-50 text-slate-500 hover:bg-slate-100 hover:text-slate-950 dark:border-white/10 dark:bg-white/[0.03] dark:text-slate-400 dark:hover:bg-white/[0.06] dark:hover:text-white"
                      }`}
                      aria-label="Search conversation"
                    >
                      <Search className="h-4 w-4" />
                    </button>
                    <button
                      type="button"
                      onClick={() => setShowActions((visible) => !visible)}
                      className="rounded-lg border border-slate-200 bg-slate-50 p-2 text-slate-500 transition hover:bg-slate-100 hover:text-slate-950 dark:border-white/10 dark:bg-white/[0.03] dark:text-slate-400 dark:hover:bg-white/[0.06] dark:hover:text-white"
                      aria-label="More conversation actions"
                    >
                      <MoreHorizontal className="h-4 w-4" />
                    </button>
                  </div>

                  {showActions && (
                    <div className="absolute right-3 top-[calc(100%+0.5rem)] z-50 w-52 rounded-xl border border-slate-200 bg-white p-1.5 shadow-2xl shadow-slate-900/15 dark:border-white/10 dark:bg-[#131c24] dark:shadow-black/40">
                      <button
                        type="button"
                        onClick={() => { setShowPinnedModal(true); setShowActions(false); }}
                        className="flex w-full items-center gap-3 rounded-lg px-3 py-2 text-left text-sm text-slate-600 transition hover:bg-slate-100 hover:text-slate-950 dark:text-slate-300 dark:hover:bg-white/5 dark:hover:text-white"
                      >
                        <Pin className="h-4 w-4 text-amber-400" />
                        Pinned messages
                      </button>
                      <button
                        type="button"
                        onClick={() => { setShowStarredOnly((visible) => !visible); setShowActions(false); }}
                        className="flex w-full items-center gap-3 rounded-lg px-3 py-2 text-left text-sm text-slate-600 transition hover:bg-slate-100 hover:text-slate-950 dark:text-slate-300 dark:hover:bg-white/5 dark:hover:text-white"
                      >
                        <Star className={`h-4 w-4 text-amber-400 ${showStarredOnly ? "fill-amber-400" : ""}`} />
                        {showStarredOnly ? "Show all messages" : "Starred messages"}
                      </button>
                      <button
                        type="button"
                        onClick={() => { handleSummarize(); setShowActions(false); }}
                        className="flex w-full items-center gap-3 rounded-lg px-3 py-2 text-left text-sm text-slate-600 transition hover:bg-slate-100 hover:text-slate-950 dark:text-slate-300 dark:hover:bg-white/5 dark:hover:text-white"
                      >
                        <Sparkles className="h-4 w-4 text-teal-400" />
                        Summarize
                      </button>
                      <button
                        type="button"
                        onClick={() => { exportChat(); setShowActions(false); }}
                        className="flex w-full items-center gap-3 rounded-lg px-3 py-2 text-left text-sm text-slate-600 transition hover:bg-slate-100 hover:text-slate-950 dark:text-slate-300 dark:hover:bg-white/5 dark:hover:text-white"
                      >
                        <Download className="h-4 w-4 text-sky-400" />
                        Export conversation
                      </button>
                    </div>
                  )}
                </div>

              {/* Search and Filters */}
              {showFilters && (
                <div className="grid grid-cols-1 gap-3 border-b border-slate-200 bg-slate-50 p-3 dark:border-white/10 dark:bg-[#0b1218] sm:grid-cols-2 lg:grid-cols-4">
                  <div className="relative">
                    <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
                    <input
                      type="text"
                      placeholder="Search messages..."
                      value={searchTerm}
                      onChange={(e) => setSearchTerm(e.target.value)}
                      className="app-control w-full py-2 pl-10 pr-4 text-sm"
                    />
                  </div>

                  <input
                    type="text"
                    placeholder="Filter by sender..."
                    value={searchSender}
                    onChange={(e) => setSearchSender(e.target.value)}
                    className="app-control px-4 py-2 text-sm"
                  />

                  <input
                    type="date"
                    placeholder="Start date"
                    value={dateFilter.start}
                    onChange={(e) => setDateFilter({ ...dateFilter, start: e.target.value })}
                    className="app-control px-4 py-2 text-sm"
                  />

                  <div className="flex gap-2">
                    <input
                      type="date"
                      placeholder="End date"
                      value={dateFilter.end}
                      onChange={(e) => setDateFilter({ ...dateFilter, end: e.target.value })}
                      className="app-control flex-1 px-4 py-2 text-sm"
                    />
                    {(searchTerm || searchSender || dateFilter.start || dateFilter.end) && (
                      <button
                        onClick={clearFilters}
                        className="rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-red-700 transition-colors hover:bg-red-100 dark:border-red-500/30 dark:bg-red-600/20 dark:text-red-400 dark:hover:bg-red-600/40"
                        title="Clear filters"
                      >
                        <XCircle className="w-4 h-4" />
                      </button>
                    )}
                  </div>
                </div>
              )}

            {/* Messages Container */}
            <div
              ref={chatContainerRef}
              className="flex-1 overflow-y-auto bg-slate-50 dark:bg-[#090f14]"
            >
              {messages.length === 0 ? (
                <div className="flex h-full flex-col items-center justify-center text-center">
                  <Mail className="mb-4 h-12 w-12 text-slate-400 sm:h-16 sm:w-16" />
                  <p className="text-sm text-slate-700 dark:text-slate-300 sm:text-base">
                    No messages yet
                  </p>
                  <p className="mt-2 text-xs text-slate-500 dark:text-slate-400 sm:text-sm">
                    Start the conversation by sending a message
                  </p>
                </div>
              ) : (
                <div className="w-full space-y-3 p-3 sm:px-5 sm:py-4">
                  {/* Load More Messages Button - At Top */}
                  {hasMoreMessages && (
                    <div className="flex justify-center py-4">
                      <button
                        onClick={loadMoreMessages}
                        disabled={loadingMoreMessages}
                        className="flex items-center gap-2 rounded-lg border border-blue-200 bg-blue-50 px-4 py-2 text-blue-700 transition-colors hover:bg-blue-100 disabled:cursor-not-allowed disabled:opacity-50 dark:border-blue-500/30 dark:bg-blue-600/20 dark:text-blue-400 dark:hover:bg-blue-600/40"
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

                  {messages.filter((msg) => !showStarredOnly || starredMessageIds.has(msg._id)).map((msg, idx) => {
                  const isOwnMessage =
                    msg.sentBy?._id === userId || msg.sentBy === userId;
                  const senderType = msg.senderType || "user";

                  const senderDesignation = msg.sentBy?.designation || "Team Member";
                  const senderName = msg.sentBy?.name
                    || msg.sentBy?.clientName
                    || msg.sentBy?.businessName
                    || (senderType === "client" ? projectClientName : senderDesignation);
                  const senderRole = senderType === "client"
                    ? "Client"
                    : msg.sentBy?.designation || "Project team";
                  const senderDisplay = isOwnMessage
                    ? "You"
                    : isClientUser && senderType !== "client"
                      ? senderRole
                      : `${senderName} - ${senderRole}`;

                  // Check if we need to show date separator
                  const showDateSeparator = idx === 0 ||
                    new Date(messages[idx - 1].createdAt).toDateString() !== new Date(msg.createdAt).toDateString();

                  return (
                    <React.Fragment key={idx}>
                      {showDateSeparator && <MessageDateSeparator date={msg.createdAt} />}
                      <div
                        id={`message-${msg._id}`}
                        data-message-id={msg._id}
                        data-owner-id={msg.sentBy?._id || msg.sentBy}
                        className={`flex ${
                          isOwnMessage ? "justify-end" : "justify-start"
                        } transition-colors duration-300 animate-slideIn`}
                      >
                      <div
                        className={`min-w-0 max-w-[88%] sm:max-w-[62%] xl:max-w-[56%] ${
                          isOwnMessage ? "items-end" : "items-start"
                        } flex flex-col`}
                      >
                        <div className="flex items-center gap-2 mb-1 px-1 max-w-full">
                          {!isOwnMessage && (
                            <div className="flex h-6 w-6 flex-shrink-0 items-center justify-center rounded-full bg-slate-200 text-xs font-semibold text-slate-700 dark:bg-[#2a3942] dark:text-gray-300">
                              {senderDisplay.charAt(0).toUpperCase()}
                            </div>
                          )}
                          <span className="truncate text-xs text-slate-500 dark:text-gray-400">
                            {senderDisplay}
                          </span>
                        </div>

                        <div
                          className={`relative group w-fit max-w-full ${
                            isOwnMessage
                              ? "border-teal-600/20 bg-teal-600 text-white dark:border-teal-400/15 dark:bg-[#075d55]"
                              : "border-slate-200 bg-white text-slate-900 dark:border-white/10 dark:bg-[#1a242d] dark:text-white"
                          } overflow-hidden rounded-xl border p-3 shadow-sm shadow-slate-900/5 transition-colors duration-200 break-words dark:shadow-black/10`}
                        >
                          {/* Reply Preview */}
                          {msg.replyTo && (
                            <div className="mb-2 overflow-hidden rounded border-l-4 border-teal-500 bg-black/10 p-2 dark:bg-black/20" style={{ wordBreak: 'break-word', overflowWrap: 'anywhere' }}>
                              <div className="flex items-center gap-1 mb-1">
                                <Reply className="h-3 w-3 flex-shrink-0 text-teal-200 dark:text-[#00a884]" />
                                <span className={`truncate text-xs font-semibold ${isOwnMessage ? "text-teal-50" : "text-slate-700 dark:text-gray-200"}`}>
                                  {msg.replyTo.sentBy ?
                                    (msg.replyTo.senderType === "client" ? "Client" : (msg.replyTo.sentBy.designation || "Team Member")) :
                                    "Unknown User"}
                                </span>
                              </div>
                              <div className={`overflow-hidden whitespace-pre-wrap text-xs ${isOwnMessage ? "text-teal-50/80" : "text-slate-500 dark:text-gray-400"}`} style={{
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
                              <div className={`prose prose-sm max-w-none break-words text-sm leading-relaxed overflow-wrap-anywhere ${isOwnMessage ? "prose-invert text-white" : "prose-slate dark:prose-invert dark:text-white"}`}>
                                <ReactMarkdown
                                  remarkPlugins={[remarkGfm]}
                                  rehypePlugins={[rehypeRaw]}
                                  components={{
                                    p: ({ children }) => <p className="mb-2 last:mb-0 whitespace-pre-wrap break-words">{children}</p>,
                                    h1: ({ children }) => <h1 className="text-lg font-bold mb-2">{children}</h1>,
                                    h2: ({ children }) => <h2 className="text-base font-bold mb-2">{children}</h2>,
                                    h3: ({ children }) => <h3 className="text-sm font-bold mb-2">{children}</h3>,
                                    ul: ({ children }) => <ul className="list-disc mb-2 space-y-1 pl-5">{children}</ul>,
                                    ol: ({ children }) => <ol className="list-decimal mb-2 space-y-1 pl-5">{children}</ol>,
                                    li: ({ children }) => <li className="ml-0 break-words">{children}</li>,
                                    code: ({ inline, children }) =>
                                      inline ? (
                                        <code className="rounded bg-black/10 px-1 text-xs dark:bg-black/30">{children}</code>
                                      ) : (
                                        <code className="block overflow-x-auto whitespace-pre-wrap rounded bg-black/10 p-2 text-xs dark:bg-black/30">{children}</code>
                                      ),
                                    strong: ({ children }) => <strong className="font-bold">{children}</strong>,
                                    em: ({ children }) => <em className="italic">{children}</em>,
                                    a: ({ href, children }) => (
                                      // Own-message links use text-white, not
                                      // text-blue-*: src/index.css forces any
                                      // a[class*="text-blue-"] to the brand teal
                                      // with !important, which is the same colour
                                      // as this bubble (teal-on-teal, invisible).
                                      <a href={href} target="_blank" rel="noopener noreferrer" className={`${isOwnMessage ? "text-white decoration-white/60 hover:decoration-white" : "text-blue-600 hover:text-blue-700 dark:text-blue-300 dark:hover:text-blue-200"} underline decoration-1 underline-offset-2`}>{children}</a>
                                    ),
                                    br: () => <br />,
                                  }}
                                >
                                  {(() => {
                                    let text = msg.message;

                                    // Convert common bullet patterns to markdown
                                    text = text.replace(/^[\u2022\u25E6\u2023\u2043]\s*/gm, '- '); // • ◦ ‣ ⁃
                                    text = text.replace(/^[*]\s+/gm, '- '); // * bullets
                                    text = text.replace(/^[-]\s*(?=\S)/gm, '- '); // Normalize existing - bullets

                                    // Convert numbered lists (1. 2. 3. etc)
                                    text = text.replace(/^(\d+)[.)]\s*/gm, '$1. ');

                                    // Add empty line before lists for proper markdown parsing
                                    text = text.replace(/([^\n])\n([-*+]|\d+\.)\s/g, '$1\n\n$2 ');

                                    // Preserve line breaks with markdown syntax
                                    text = text.replace(/\n/g, '  \n');

                                    return text;
                                  })()}
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
                                  <div className="flex items-center gap-2 rounded bg-black/10 p-2 dark:bg-black/20">
                                    {getFileIcon(att.fileType)}
                                    <div className="flex-1 min-w-0">
                                      <div className="flex items-center gap-2">
                                        <div className={`truncate text-xs ${isOwnMessage ? "text-white" : "text-slate-900 dark:text-white"}`}>
                                          {att.filename}
                                        </div>
                                        {att.isImportant && (
                                          <span className="text-xs text-yellow-400 flex items-center gap-1 flex-shrink-0">
                                            <Star className="w-3 h-3 fill-yellow-400" />
                                            Important
                                          </span>
                                        )}
                                      </div>
                                      <div className={`text-xs ${isOwnMessage ? "text-teal-50/75" : "text-slate-500 dark:text-gray-400"}`}>
                                        {(att.size / 1024).toFixed(1)} KB
                                      </div>
                                    </div>
                                    <button
                                      onClick={() => handleToggleImportant(msg._id, att._id, att.isImportant)}
                                      className={`p-1.5 rounded transition-colors ${
                                        att.isImportant
                                          ? "text-yellow-400 hover:bg-yellow-400/20"
                                          : "text-slate-400 hover:bg-slate-100 hover:text-yellow-500 dark:text-gray-400 dark:hover:bg-white/10 dark:hover:text-yellow-400"
                                      }`}
                                      title={att.isImportant ? "Remove from important" : "Mark as important (won't be auto-deleted)"}
                                    >
                                      <Star className={`w-4 h-4 ${att.isImportant ? "fill-yellow-400" : ""}`} />
                                    </button>
                                    <a
                                      href={`${API_BASE}/api/projects/${projectId}/messages/${msg._id}/attachments/${att._id}/download`}
                                      className="rounded p-1 hover:bg-slate-100 dark:hover:bg-white/10"
                                      onClick={(e) => {
                                        e.preventDefault();
                                        // Shared helper — it also defers
                                        // revokeObjectURL, which this used to
                                        // call synchronously after click(),
                                        // occasionally cancelling the download
                                        // before the browser had written it.
                                        messagingApi
                                          .downloadAttachment(SCOPE, projectId, msg._id, att._id, att.filename)
                                          .catch((error) => {
                                            console.error('Download error:', error);
                                            showNotification('Failed to download file', 'error');
                                          });
                                      }}
                                    >
                                      <Download className={`h-4 w-4 ${isOwnMessage ? "text-teal-50/80" : "text-slate-500 dark:text-gray-300"}`} />
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
                                        ? "border border-blue-300 bg-blue-100 text-blue-700 dark:border-blue-400 dark:bg-blue-500/30 dark:text-white"
                                        : "bg-black/10 hover:bg-black/15 dark:bg-black/20 dark:hover:bg-black/30"
                                    }`}
                                    title={userReacted ? "Remove reaction" : "Add reaction"}
                                  >
                                    <span>{reaction.emoji}</span>
                                    <span className={`text-[10px] ${isOwnMessage ? "text-teal-50/80" : "text-slate-500 dark:text-gray-300"}`}>
                                      {reaction.users?.length || 0}
                                    </span>
                                  </button>
                                );
                              })}
                            </div>
                          )}

                          <div className="mt-2 flex items-center justify-between gap-3">
                            <div className="flex items-center gap-2">
                              <span className={`text-xs ${isOwnMessage ? "text-teal-50/80" : "text-slate-500 dark:text-gray-400"}`}>
                                {new Date(msg.createdAt).toLocaleTimeString([], {
                                  hour: "2-digit",
                                  minute: "2-digit",
                                })}
                              </span>
                              {/* Only show status for own messages (team messages) */}
                              {isOwnMessage && (
                                <MessageStatus status={msg.status || 'sent'} />
                              )}
                            </div>

                            <div className="relative flex gap-1 opacity-100 transition-opacity sm:opacity-0 sm:group-hover:opacity-100">
                              <button
                                onClick={() => handleReply(msg)}
                                className="rounded-md p-1.5 transition-colors hover:bg-black/10 dark:hover:bg-white/10"
                                title="Reply to message"
                              >
                                <Reply className={`h-3.5 w-3.5 ${isOwnMessage ? "text-teal-50/80 hover:text-white" : "text-slate-400 hover:text-teal-600 dark:text-gray-400 dark:hover:text-[#00a884]"}`} />
                              </button>
                              <button
                                onClick={() =>
                                  setShowEmojiPicker(
                                    showEmojiPicker === msg._id ? null : msg._id
                                  )
                                }
                                className="rounded-md p-1.5 transition-colors hover:bg-black/10 dark:hover:bg-white/10"
                                title="Add reaction"
                              >
                                <Smile className={`h-3.5 w-3.5 ${isOwnMessage ? "text-teal-50/80 hover:text-white" : "text-slate-400 hover:text-yellow-500 dark:text-gray-400 dark:hover:text-yellow-400"}`} />
                              </button>
                              <button
                                onClick={() => copyToClipboard(msg.message)}
                                className="rounded-md p-1.5 transition-colors hover:bg-black/10 dark:hover:bg-white/10"
                                title="Copy message"
                              >
                                {copiedText === msg.message ? (
                                  <Check className="w-3.5 h-3.5 text-green-400" />
                                ) : (
                                  <Copy className={`h-3.5 w-3.5 ${isOwnMessage ? "text-teal-50/80 hover:text-white" : "text-slate-400 hover:text-blue-600 dark:text-gray-400 dark:hover:text-blue-400"}`} />
                                )}
                              </button>
                              <button
                                onClick={() => toggleStarMessage(msg._id)}
                                className="rounded-md p-1.5 transition-colors hover:bg-black/10 dark:hover:bg-white/10"
                                title={starredMessageIds.has(msg._id) ? "Remove from starred" : "Add to starred"}
                              >
                                <Star className={`h-3.5 w-3.5 ${starredMessageIds.has(msg._id) ? "fill-yellow-400 text-yellow-400" : isOwnMessage ? "text-teal-50/80 hover:text-white" : "text-slate-400 hover:text-yellow-500 dark:text-gray-400 dark:hover:text-yellow-400"}`} />
                              </button>

                              {/* Emoji Picker Popup */}
                              {showEmojiPicker === msg._id && (
                                <div className={`emoji-picker-container absolute ${isOwnMessage ? 'right-0' : 'left-0'} bottom-full z-50 mb-2 flex gap-1 rounded-lg border border-slate-200 bg-white p-2 shadow-2xl shadow-slate-900/15 dark:border-[#232945] dark:bg-[#1a2332]`}>
                                  {commonEmojis.map((emoji, emojiIdx) => (
                                    <button
                                      key={emojiIdx}
                                      onClick={(e) => {
                                        e.stopPropagation();
                                        handleReaction(msg._id, emoji);
                                      }}
                                      className="rounded p-1.5 text-lg transition-all hover:scale-110 hover:bg-slate-100 dark:hover:bg-white/10"
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
                    </React.Fragment>
                  );
                  })}

                  <div ref={messagesEndRef} />
                </div>
              )}
            </div>

            {/* New Messages Button - Scroll to Bottom */}
            {showNewMessagesButton && (
              <NewMessagesButton
                count={newMessagesCount}
                onClick={() => {
                  scrollToBottom();
                  setNewMessagesCount(0);
                }}
              />
            )}

            {/* Message Input */}
            <div className="border-t border-slate-200 bg-white p-2 dark:border-white/10 dark:bg-[#0d151c] sm:px-3">
              {/* Reply Preview */}
              {replyingTo && (
                <div className="mb-2 flex items-start justify-between gap-2 overflow-hidden rounded-lg border border-teal-200 bg-teal-50 p-2.5 dark:border-teal-400/20 dark:bg-teal-500/10" style={{ maxWidth: '100%' }}>
                  <div className="flex-1 min-w-0 overflow-hidden">
                    <div className="mb-1 flex items-center gap-2 text-sm text-teal-800 dark:text-gray-300">
                      <Reply className="w-4 h-4 flex-shrink-0" />
                      <span className="font-medium truncate">
                        Replying to {replyingTo.sentBy ?
                          (replyingTo.sentBy.name || replyingTo.sentBy.clientName || "Unknown User") :
                          "Unknown User"}
                      </span>
                    </div>
                    <div className="overflow-hidden text-xs text-slate-600 dark:text-gray-300" style={{
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
                    className="flex-shrink-0 rounded p-1 hover:bg-slate-100 dark:hover:bg-white/10"
                    title="Cancel reply"
                  >
                    <XCircle className="h-4 w-4 text-slate-400 hover:text-red-500 dark:hover:text-red-400" />
                  </button>
                </div>
              )}

              {/* Selected Files Preview */}
              {selectedFiles.length > 0 && (
                <div className="mb-2 flex flex-wrap gap-2">
                  {selectedFiles.map((file, idx) => (
                    <div
                      key={idx}
                      className="flex items-center gap-2 rounded-lg border border-slate-200 bg-slate-50 px-3 py-2 dark:border-white/10 dark:bg-white/[0.04]"
                    >
                      <File className="h-4 w-4 text-slate-500 dark:text-gray-300" />
                      <span className="max-w-[150px] truncate text-xs text-slate-700 dark:text-white">
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
              )}

              {/* Formatting Toolbar */}
              {showFormatting && (
                <div className="mb-3 rounded-lg border border-slate-200 bg-slate-50 p-3 dark:border-white/10 dark:bg-[#101820]">
                  <div className="flex flex-wrap gap-2">
                    <button type="button" onClick={formatBold} className="rounded border border-slate-200 bg-white px-3 py-1.5 text-xs font-bold text-slate-700 transition-colors hover:bg-slate-100 dark:border-white/10 dark:bg-[#232945] dark:text-white dark:hover:bg-[#2a3142]" title="Bold (Ctrl+B)">
                      <span className="font-bold">B</span>
                    </button>
                    <button type="button" onClick={formatItalic} className="rounded border border-slate-200 bg-white px-3 py-1.5 text-xs italic text-slate-700 transition-colors hover:bg-slate-100 dark:border-white/10 dark:bg-[#232945] dark:text-white dark:hover:bg-[#2a3142]" title="Italic (Ctrl+I)">
                      <span className="italic">I</span>
                    </button>
                    <button type="button" onClick={formatStrikethrough} className="rounded border border-slate-200 bg-white px-3 py-1.5 text-xs text-slate-700 transition-colors hover:bg-slate-100 dark:border-white/10 dark:bg-[#232945] dark:text-white dark:hover:bg-[#2a3142]" title="Strikethrough (Ctrl+U)">
                      <span className="line-through">S</span>
                    </button>
                    <button type="button" onClick={formatCode} className="rounded border border-slate-200 bg-white px-3 py-1.5 text-xs font-mono text-slate-700 transition-colors hover:bg-slate-100 dark:border-white/10 dark:bg-[#232945] dark:text-white dark:hover:bg-[#2a3142]" title="Code (Ctrl+E)">
                      &lt;/&gt;
                    </button>
                    <button type="button" onClick={formatHeading} className="rounded border border-slate-200 bg-white px-3 py-1.5 text-xs font-bold text-slate-700 transition-colors hover:bg-slate-100 dark:border-white/10 dark:bg-[#232945] dark:text-white dark:hover:bg-[#2a3142]" title="Heading (Ctrl+D)">
                      H1
                    </button>
                    <button type="button" onClick={formatBullet} className="rounded border border-slate-200 bg-white px-3 py-1.5 text-xs text-slate-700 transition-colors hover:bg-slate-100 dark:border-white/10 dark:bg-[#232945] dark:text-white dark:hover:bg-[#2a3142]" title="Bullet List (Ctrl+L)">
                      • List
                    </button>
                    <button type="button" onClick={formatNumbered} className="rounded border border-slate-200 bg-white px-3 py-1.5 text-xs text-slate-700 transition-colors hover:bg-slate-100 dark:border-white/10 dark:bg-[#232945] dark:text-white dark:hover:bg-[#2a3142]" title="Numbered List (Ctrl+Shift+L)">
                      1. List
                    </button>
                  </div>
                  <div className="hidden">
                    <div><strong>Keyboard Shortcuts:</strong> Ctrl+B (Bold) • Ctrl+I (Italic) • Ctrl+U (Strike) • Ctrl+E/K (Code) • Ctrl+D (Heading) • Ctrl+L (Bullet) • Ctrl+Shift+L (Numbered)</div>
                    <div><strong>Markdown:</strong> **bold** *italic* ~~strikethrough~~ `code` ## Heading - Bullet 1. Numbered</div>
                  </div>
                </div>
              )}

              {/* Typing Indicator */}
              <TypingIndicator typingUsers={typingUsers} />

              <form
                onSubmit={handleSendMessage}
                className="flex items-center gap-2"
              >
                <input
                  ref={fileInputRef}
                  type="file"
                  multiple
                  accept="image/*,video/*,.pdf,.doc,.docx,.xls,.xlsx,.txt"
                  onChange={handleFileSelect}
                  className="hidden"
                />

                <div className="relative flex-shrink-0">
                  <button
                    type="button"
                    onClick={() => setShowComposerTools((visible) => !visible)}
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
                        onClick={() => { setShowFormatting((visible) => !visible); setShowComposerTools(false); }}
                        className="flex w-full items-center gap-3 rounded-lg px-3 py-2 text-left text-sm text-slate-600 transition hover:bg-slate-100 hover:text-slate-950 dark:text-slate-300 dark:hover:bg-white/5 dark:hover:text-white"
                      >
                        <Type className="h-4 w-4 text-teal-400" />
                        Formatting
                      </button>
                      <button
                        type="button"
                        onClick={() => { setShowEnhancedEmojiPicker(true); setShowComposerTools(false); }}
                        className="flex w-full items-center gap-3 rounded-lg px-3 py-2 text-left text-sm text-slate-600 transition hover:bg-slate-100 hover:text-slate-950 dark:text-slate-300 dark:hover:bg-white/5 dark:hover:text-white"
                      >
                        <Smile className="h-4 w-4 text-amber-400" />
                        Emoji
                      </button>
                    </div>
                  )}

                  {showEnhancedEmojiPicker && (
                    <div className="absolute bottom-[calc(100%+0.5rem)] left-0 z-50">
                      <EmojiPickerEnhanced
                        onSelect={(emoji) => {
                          setNewMessage((prev) => prev + emoji);
                          setShowEnhancedEmojiPicker(false);
                          textareaRef.current?.focus();
                        }}
                        onClose={() => setShowEnhancedEmojiPicker(false)}
                      />
                    </div>
                  )}
                </div>

                <div className="flex-1 relative">
                  {/* Suggestions Dropdown */}
                  {showSuggestions && suggestions.length > 0 && (
                    <div
                      ref={suggestionsRef}
                      className="absolute bottom-full left-0 right-0 z-50 mb-2 max-h-64 overflow-y-auto rounded-lg border border-slate-200 bg-white shadow-2xl shadow-slate-900/15 dark:border-[#232945] dark:bg-gray-900"
                    >
                      <div className="sticky top-0 flex items-center gap-2 border-b border-slate-200 bg-white p-2 dark:border-[#232945] dark:bg-gray-900">
                        <Sparkles className="w-4 h-4 text-blue-400" />
                        <span className="text-xs text-slate-500 dark:text-gray-400">
                          Suggestions ({suggestions.length}) - <kbd className="rounded bg-slate-100 px-1 py-0.5 text-[10px] dark:bg-gray-700">Up/Down</kbd> to navigate - <kbd className="rounded bg-slate-100 px-1 py-0.5 text-[10px] dark:bg-gray-700">Tab</kbd> or <kbd className="rounded bg-slate-100 px-1 py-0.5 text-[10px] dark:bg-gray-700">Enter</kbd> to select
                        </span>
                      </div>
                      {suggestions.map((suggestion, idx) => (
                        <button
                          key={idx}
                          type="button"
                          onClick={() => acceptSuggestion(suggestion)}
                          className={`w-full border-l-2 px-4 py-2 text-left transition-colors hover:bg-slate-100 dark:hover:bg-gray-800 ${
                            idx === selectedSuggestionIndex
                              ? "border-blue-500 bg-blue-50 dark:bg-gray-800"
                              : "border-transparent"
                          }`}
                        >
                          <div className="flex items-start gap-2">
                            <div className="flex-shrink-0 mt-1">
                              {suggestion.type === "history" && (
                                <Clock className="w-3 h-3 text-slate-400 dark:text-gray-400" />
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
                                <Sparkles className="w-3 h-3 text-[#00a884]" />
                              )}
                            </div>
                            <div className="flex-1 min-w-0">
                              <p className="truncate text-sm text-slate-800 dark:text-gray-200">
                                {suggestion.text}
                              </p>
                              <p className="text-xs capitalize text-slate-500 dark:text-gray-500">
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

                  <MentionInput
                    ref={textareaRef}
                    value={newMessage}
                    onChange={(newValue, mentions) => {
                      setNewMessage(newValue);
                      setMentionedUsers(mentions);
                      // Send typing indicator when user types
                      if (newValue.length > 0) {
                        sendTypingIndicator();
                      }
                    }}
                    users={project?.assignedTo || []}
                    placeholder="Write a message..."
                    rows={1}
                    className="h-11 w-full rounded-xl border-slate-200 bg-white py-2.5 text-slate-900 placeholder-slate-400 focus:border-teal-400/50 dark:border-white/10 dark:bg-[#101820] dark:text-white dark:placeholder-slate-500"
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
                  />
                </div>

                <button
                  type="submit"
                  disabled={sending || (!newMessage.trim() && selectedFiles.length === 0)}
                  className="flex h-11 flex-shrink-0 items-center justify-center gap-2 rounded-lg bg-teal-600 px-3 text-white shadow-lg shadow-teal-950/20 transition hover:bg-teal-500 disabled:cursor-not-allowed disabled:opacity-40 sm:px-4"
                >
                  {sending ? (
                    <div className="w-4 h-4 border-2 border-white/20 border-t-white rounded-full animate-spin"></div>
                  ) : (
                    <>
                      <Send className="w-4 h-4" />
                      <span className="hidden sm:inline text-sm">Send</span>
                    </>
                  )}
                </button>
              </form>
            </div>
              </>
            )}

            {/* Tasks Tab Content */}
            {activeTab === "tasks" && (
              <div className="flex-1 flex flex-col overflow-hidden">
                {/* Tasks Header with Create Button */}
                {(userRole === "super-admin" || userRole === "superadmin" || userRole === "admin") && (
                  <div className="border-b border-slate-200 bg-white p-4 dark:border-[#2a3942] dark:bg-[#202c33]">
                    <div className="flex items-center justify-between">
                      <div>
                        <h2 className="text-base font-semibold text-slate-900 dark:text-white flex items-center gap-2">
                          <ListTodo className="w-5 h-5 text-[#00a884]" />
                          Project Tasks
                        </h2>
                        <p className="text-xs text-slate-500 dark:text-gray-400 mt-1">
                          {tasks.length} task{tasks.length !== 1 ? "s" : ""}
                        </p>
                      </div>
                      <button
                        onClick={() => setShowTaskModal(true)}
                        className="flex items-center gap-2 px-4 py-2 bg-[#00a884] hover:bg-[#128C7E] text-white rounded-lg transition-all font-medium shadow-lg"
                      >
                        <Plus className="w-5 h-5" />
                        <span className="hidden sm:inline">Create Task</span>
                        <span className="sm:hidden">New</span>
                      </button>
                    </div>
                  </div>
                )}

                {/* Tasks List */}
                <div className="flex-1 overflow-y-auto bg-slate-50 p-4 dark:bg-[#0b141a]">
                  {loadingTasks ? (
                    <div className="flex items-center justify-center h-full">
                      <div className="w-12 h-12 border-4 border-[#00a884]/20 border-t-[#00a884] rounded-full animate-spin"></div>
                    </div>
                  ) : tasks.length === 0 ? (
                    <div className="flex flex-col items-center justify-center h-full text-center">
                      <ListTodo className="w-16 h-16 text-slate-300 dark:text-gray-600 mb-4" />
                      <p className="text-slate-400 dark:text-gray-500 text-base">No tasks for this project</p>
                      <p className="text-slate-300 dark:text-gray-600 text-sm mt-2">
                        {(userRole === "super-admin" || userRole === "superadmin" || userRole === "admin")
                          ? "Click 'Create Task' to assign tasks to team members"
                          : "Tasks will appear here when assigned by your admin"}
                      </p>
                    </div>
                  ) : (
                  <div className="space-y-3">
                    {tasks.map((task) => (
                      <div
                        key={task._id}
                        className="rounded-xl border border-slate-200 bg-white p-4 transition-colors hover:border-[#00a884] dark:border-[#2a3942] dark:bg-[#202c33]"
                      >
                        <div className="flex items-start justify-between gap-4 mb-4">
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center justify-between mb-2">
                              <h3 className="text-slate-900 dark:text-white font-semibold text-base sm:text-lg flex items-center gap-2">
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
                              <p className="text-slate-500 dark:text-gray-400 text-sm mb-3">{task.description}</p>
                            )}

                            <div className="space-y-3">
                              <div className="flex items-center gap-1 text-xs text-slate-400 dark:text-gray-500">
                                <Calendar className="w-3 h-3" />
                                <span>Due: {task.dueDate ? new Date(task.dueDate).toLocaleDateString() : "No due date"}</span>
                              </div>

                              {/* Assigned Employees */}
                              {task.assignedTo && task.assignedTo.length > 0 && (
                                <div>
                                  <p className="text-xs text-slate-400 dark:text-gray-500 mb-2 flex items-center gap-1">
                                    <Users className="w-3 h-3" />
                                    Assigned to:
                                  </p>
                                  <div className="flex flex-wrap gap-2">
                                    {task.assignedTo.map((emp, idx) => (
                                      <div
                                        key={idx}
                                        className="flex items-center gap-2 bg-[#00a884]/10 border border-[#00a884]/30 rounded-full px-3 py-1"
                                      >
                                        {(userRole === "admin" || userRole === "super-admin" || userRole === "superadmin") ? (
                                          // Show name for admins/super-admins
                                          <>
                                            <div className="w-5 h-5 rounded-full bg-[#00a884] flex items-center justify-center text-white text-[10px] font-semibold flex-shrink-0">
                                              {(emp.name || "U").charAt(0).toUpperCase()}
                                            </div>
                                            <span className="text-slate-900 dark:text-white text-xs font-medium">
                                              {emp.name || "Unknown"}
                                            </span>
                                          </>
                                        ) : (
                                          // Show employee ID and designation for clients
                                          <>
                                            <Briefcase className="w-3 h-3 text-[#00a884]" />
                                            <span className="text-slate-900 dark:text-white text-xs font-medium">
                                              {emp.employeeId || emp._id?.substring(0, 8) || "N/A"}
                                            </span>
                                            <span className="text-slate-500 dark:text-gray-400 text-xs">|</span>
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
                                : "bg-slate-200 text-slate-600 border border-slate-300 dark:bg-gray-500/20 dark:text-gray-400 dark:border-gray-500/50"
                            }`}
                          >
                            {task.status}
                          </span>
                        </div>

                        {/* Rejection info */}
                        {task.status === "rejected" && (
                          <div className="mt-4 pt-4 border-t border-slate-200 dark:border-[#232945]">
                            <p className="text-red-400 text-sm font-medium mb-1">❌ Rejected</p>
                            <p className="text-slate-700 dark:text-gray-300 text-sm">
                              {task.rejectionReason || "No reason provided"}
                            </p>
                            {task.rejectedAt && (
                              <p className="text-xs text-slate-400 dark:text-gray-500 mt-1">
                                Rejected on: {new Date(task.rejectedAt).toLocaleString()}
                              </p>
                            )}
                          </div>
                        )}

                        {/* Status update for assigned employees (non-admin) */}
                        {userRole !== "admin" && userRole !== "super-admin" && userRole !== "superadmin" &&
                          task.status !== "completed" && task.status !== "rejected" &&
                          task.assignedTo?.some((emp) => emp._id?.toString() === userId?.toString()) && (
                          <div className="mt-4 pt-4 border-t border-slate-200 dark:border-[#232945]">
                            <p className="text-xs text-slate-400 dark:text-gray-500 mb-2">Update your status:</p>
                            <div className="flex gap-2">
                              {task.status !== "in-progress" && (
                                <button
                                  onClick={() => handleUpdateTaskStatus(task._id, "in-progress")}
                                  className="flex-1 px-3 py-2 bg-blue-600/20 hover:bg-blue-600/40 text-blue-400 rounded-lg border border-blue-500/30 transition-colors text-xs font-medium"
                                >
                                  Mark In Progress
                                </button>
                              )}
                              <button
                                onClick={() => handleUpdateTaskStatus(task._id, "completed")}
                                className="flex-1 px-3 py-2 bg-green-600/20 hover:bg-green-600/40 text-green-400 rounded-lg border border-green-500/30 transition-colors text-xs font-medium"
                              >
                                Mark Complete
                              </button>
                            </div>
                          </div>
                        )}

                        {/* Completion review (admin / task assigner can reject completed tasks with a reason) */}
                        {task.status === "completed" &&
                          (userRole === "super-admin" || userRole === "superadmin" || userRole === "admin") && (
                          <div className="mt-4 pt-4 border-t border-slate-200 dark:border-[#232945]">
                            {selectedTask === task._id ? (
                              <div className="space-y-3">
                                <textarea
                                  value={approvalRemark}
                                  onChange={(e) => setApprovalRemark(e.target.value)}
                                  placeholder="Rejection reason (required)..."
                                  className="h-20 w-full resize-none rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm text-slate-900 placeholder-slate-400 focus:border-[#00a884] focus:outline-none dark:border-[#232945] dark:bg-[#191f2b] dark:text-white dark:placeholder-gray-500"
                                />
                                <div className="flex gap-2">
                                  <button
                                    onClick={() => handleRejectCompletedTask(task._id)}
                                    className="flex-1 flex items-center justify-center gap-2 px-4 py-2 bg-red-600/20 hover:bg-red-600/40 text-red-400 rounded-lg border border-red-500/30 transition-colors"
                                  >
                                    <ThumbsDown className="w-4 h-4" />
                                    Reject Task
                                  </button>
                                  <button
                                    onClick={() => {
                                      setSelectedTask(null);
                                      setApprovalRemark("");
                                    }}
                                    className="rounded-lg bg-slate-200 px-4 py-2 text-slate-700 transition-colors hover:bg-slate-300 dark:bg-gray-600/20 dark:text-gray-400 dark:hover:bg-gray-600/40"
                                  >
                                    Cancel
                                  </button>
                                </div>
                              </div>
                            ) : (
                              <button
                                onClick={() => setSelectedTask(task._id)}
                                className="w-full px-4 py-2 bg-red-600/10 hover:bg-red-600/30 text-red-300 rounded-lg border border-red-500/30 transition-colors font-medium"
                              >
                                Reject Completed Task...
                              </button>
                            )}
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

      <ThreadSummaryModal
        open={showSummaryModal}
        onClose={() => setShowSummaryModal(false)}
        days={summaryDays}
        onDaysChange={setSummaryDays}
        loading={summaryLoading}
        summary={summary}
        onRegenerate={handleSummarize}
        onCopy={copyToClipboard}
        copied={copiedText === summary}
      />

      {/* Pinned Messages Modal */}
      {showPinnedModal && (
        <PinnedMessagesModal
          projectId={projectId}
          onClose={() => setShowPinnedModal(false)}
          onJumpToMessage={handleJumpToMessage}
        />
      )}
    </div>
  );
};


export default ProjectDetailPage;
