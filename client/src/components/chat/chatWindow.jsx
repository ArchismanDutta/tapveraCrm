import React, { useState, useEffect, useRef } from "react";
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
  Lightbulb,
  Clock,
  Zap,
  Plus,
} from "lucide-react";
import MediaLightbox from "../common/MediaLightbox";
import MessageDateSeparator from "../message/MessageDateSeparator";
import TypingIndicator from "../message/TypingIndicator";
import useMessageSuggestions from "../../hooks/useMessageSuggestions";
import MentionInput from "../common/MentionInput";
import MentionText from "../common/MentionText";
import { messageMentionsUser, resolveMentionedUserIds } from "../../utils/mentions";
import { useWebSocketContext } from "../../contexts/WebSocketContext";

// ─── Main component ──────────────────────────────────────────────────────────
// Styling here is kept in lockstep with ChatPage.jsx (its parent shell) —
// same light/dark theme tokens, same blue accent — so this looks like it
// belongs inside the "Messages" page it lives in, the same way
// ProjectMessagePanel was brought in line with ProjectDetailPage's teal theme.
const ChatWindow = ({
  messages,
  sendMessage,
  conversationId,
  currentUserId,
  conversationMembers,
}) => {
  const [input, setInput] = useState("");
  const [selectedFiles, setSelectedFiles] = useState([]);
  const [replyingTo, setReplyingTo] = useState(null);
  const [mentionedUsers, setMentionedUsers] = useState([]);
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
  const commonEmojis = ["👍", "❤️", "😂", "😮", "😢", "🎉", "🔥", "👏"];
  const chatEndRef = useRef(null);
  const fileInputRef = useRef(null);
  const textareaRef = useRef(null);
  const prevMessagesLengthRef = useRef(0);
  const emojiPickerRef = useRef(null);
  const typingTimeoutRef = useRef(null);

  // ── shared real-time connection (see WebSocketContext) ──
  const {
    isConnected: wsConnected,
    sendChatTyping,
    sendChatStopTyping,
  } = useWebSocketContext();

  // Message suggestions
  const { getSuggestions, getQuickReplies } = useMessageSuggestions(conversationId, messages);
  const [suggestions, setSuggestions] = useState([]);
  const [selectedSuggestionIndex, setSelectedSuggestionIndex] = useState(0);
  const [showSuggestions, setShowSuggestions] = useState(false);
  const [quickReplies, setQuickReplies] = useState([]);
  const [showQuickReplies, setShowQuickReplies] = useState(true);
  const suggestionsRef = useRef(null);

  // ── typing indicator ──
  const resolveMyName = () => {
    // Resolve the current user's own display name. localStorage's "user"
    // record is set at login for every role and always reflects who's
    // actually typing; conversationMembers is kept only as a fallback (e.g.
    // if that record is ever missing).
    try {
      const storedUser = JSON.parse(localStorage.getItem("user") || "{}");
      if (storedUser?.name) return storedUser.name;
    } catch {
      // fall through to the members-list lookup below
    }
    const member = Array.isArray(conversationMembers)
      ? conversationMembers.find((m) => m._id === currentUserId)
      : null;
    return member?.name || "User";
  };

  const sendTypingIndicator = () => {
    if (!wsConnected || !conversationId) return;
    sendChatTyping(conversationId, resolveMyName());
    if (typingTimeoutRef.current) clearTimeout(typingTimeoutRef.current);
    typingTimeoutRef.current = setTimeout(() => {
      stopTypingIndicator();
    }, 3000);
  };

  const stopTypingIndicator = () => {
    if (!wsConnected || !conversationId) return;
    sendChatStopTyping(conversationId);
  };

  const handleSendMessage = async () => {
    if (!input.trim() && selectedFiles.length === 0) return;

    const API_BASE = import.meta.env.VITE_API_BASE || "http://localhost:5000";
    const token = localStorage.getItem("token");

    stopTypingIndicator();
    if (typingTimeoutRef.current) clearTimeout(typingTimeoutRef.current);

    try {
      // If there are files, reply, or mentions, use HTTP POST (FormData required)
      if (selectedFiles.length > 0 || replyingTo || mentionedUsers.length > 0) {
        console.log('[ChatWindow] Sending message with files:', selectedFiles.length);
        const formData = new FormData();
        formData.append("conversationId", conversationId);
        formData.append("message", input.trim() || "(File attachment)");
        if (replyingTo) {
          formData.append("replyTo", replyingTo._id || replyingTo.messageId);
        }
        // Resolve rather than mapping _id directly: @everyone is a sentinel
        // option, not a person, so its placeholder id must never reach the
        // server — it would be stored as a mention of a user that doesn't
        // exist and would notify nobody. resolveMentionedUserIds expands it to
        // the real members (minus you) and passes named mentions through.
        const mentionIds = resolveMentionedUserIds(
          input.trim(),
          conversationMembers,
          currentUserId
        );
        if (mentionIds.length > 0) {
          formData.append("mentions", JSON.stringify(mentionIds));
        }
        selectedFiles.forEach((file) => {
          console.log('[ChatWindow] Adding file:', file.name, file.type, file.size);
          formData.append("files", file);
        });

        console.log('[ChatWindow] Sending to:', `${API_BASE}/api/chat/messages`);
        const response = await fetch(`${API_BASE}/api/chat/messages`, {
          method: "POST",
          headers: {
            Authorization: `Bearer ${token}`,
          },
          body: formData,
        });

        if (!response.ok) {
          const errorData = await response.json().catch(() => ({}));
          console.error('[ChatWindow] Upload error:', response.status, errorData);
          throw new Error(errorData.error || "Failed to send message");
        }

        const result = await response.json();
        console.log('[ChatWindow] Upload success:', result);

        // Clear input and attachments after successful send
        setInput("");
        setSelectedFiles([]);
        setReplyingTo(null);
        setMentionedUsers([]);

        // The WebSocket will handle displaying the new message
      } else {
        // Simple text message - use WebSocket for real-time
        sendMessage(conversationId, input.trim());
        setInput("");
      }
    } catch (error) {
      console.error("[ChatWindow] Error sending message:", error);
      alert(`Failed to send message: ${error.message}`);
    }
  };

  const handleFileSelect = (e) => {
    const files = Array.from(e.target.files);
    if (files.length + selectedFiles.length > 5) {
      alert("Maximum 5 files allowed");
      return;
    }
    setSelectedFiles((prev) => [...prev, ...files]);
  };

  const removeFile = (index) => {
    setSelectedFiles((prev) => prev.filter((_, i) => i !== index));
  };

  const handleReply = (msg) => {
    setReplyingTo(msg);
  };

  const handleReaction = async (messageId, emoji) => {
    try {
      const API_BASE = import.meta.env.VITE_API_BASE || "http://localhost:5000";
      const token = localStorage.getItem("token");
      const response = await fetch(
        `${API_BASE}/api/chat/messages/${messageId}/react`,
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

      // The WebSocket will handle updating the message with the new reaction
      setShowEmojiPicker(null);
    } catch (error) {
      console.error("Error adding reaction:", error);
      alert("Failed to add reaction. Please try again.");
    }
  };

  const scrollToMessage = (messageId) => {
    const element = document.getElementById(`message-${messageId}`);
    if (element) {
      element.scrollIntoView({ behavior: "smooth", block: "center" });
      // Highlight the message briefly
      element.classList.add("bg-blue-100", "dark:bg-blue-500/20");
      setTimeout(() => {
        element.classList.remove("bg-blue-100", "dark:bg-blue-500/20");
      }, 2000);
    }
  };

  const clearFilters = () => {
    setMessageSearchTerm("");
    setSearchSender("");
    setDateFilter({ start: "", end: "" });
  };

  const copyToClipboard = (text) => {
    navigator.clipboard.writeText(text);
    setCopiedText(text);
    setTimeout(() => setCopiedText(null), 2000);
  };

  const handleSummarize = async () => {
    if (!conversationId) return;

    setSummaryLoading(true);
    setShowSummaryModal(true);
    setSummary("");

    const API_BASE = import.meta.env.VITE_API_BASE || "http://localhost:5000";
    const token = localStorage.getItem("token");

    try {
      const response = await fetch(
        `${API_BASE}/api/chat/conversations/${conversationId}/summarize`,
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

  // Format text helpers
  const insertFormatting = (before, after = before) => {
    const textarea = textareaRef.current;
    if (!textarea) return;

    const start = textarea.selectionStart;
    const end = textarea.selectionEnd;
    const selectedText = input.substring(start, end);
    const beforeText = input.substring(0, start);
    const afterText = input.substring(end);

    const newText = beforeText + before + selectedText + after + afterText;
    setInput(newText);

    // Set cursor position after formatting
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
    const lineStart = input.lastIndexOf("\n", start - 1) + 1;
    const beforeLine = input.substring(0, lineStart);
    const afterLine = input.substring(lineStart);
    setInput(beforeLine + "## " + afterLine);
    setTimeout(() => {
      textarea.focus();
      textarea.setSelectionRange(lineStart + 3, lineStart + 3);
    }, 0);
  };
  const formatBullet = () => {
    const textarea = textareaRef.current;
    if (!textarea) return;
    const start = textarea.selectionStart;
    const lineStart = input.lastIndexOf("\n", start - 1) + 1;
    const beforeLine = input.substring(0, lineStart);
    const afterLine = input.substring(lineStart);
    setInput(beforeLine + "- " + afterLine);
    setTimeout(() => {
      textarea.focus();
      textarea.setSelectionRange(lineStart + 2, lineStart + 2);
    }, 0);
  };
  const formatNumbered = () => {
    const textarea = textareaRef.current;
    if (!textarea) return;
    const start = textarea.selectionStart;
    const lineStart = input.lastIndexOf("\n", start - 1) + 1;
    const beforeLine = input.substring(0, lineStart);
    const afterLine = input.substring(lineStart);
    setInput(beforeLine + "1. " + afterLine);
    setTimeout(() => {
      textarea.focus();
      textarea.setSelectionRange(lineStart + 3, lineStart + 3);
    }, 0);
  };

  const getSenderName = (senderId) => {
    const member = Array.isArray(conversationMembers) ? conversationMembers.find((m) => m._id === senderId) : null;
    return member?.name || "Unknown";
  };

  const getFileIcon = (fileType) => {
    switch (fileType) {
      case "image":
        return <ImageIcon className="w-4 h-4" />;
      case "video":
        return <Video className="w-4 h-4" />;
      default:
        return <FileIcon className="w-4 h-4" />;
    }
  };

  // Normalize messages for consistent fields while preserving all original properties
  const normalizedMessages = messages.map((msg) => ({
    ...msg, // Preserve all original properties
    messageId:
      msg.messageId || msg._id || Math.random().toString(36).substring(2, 9),
    senderId: String(
      msg.senderId || (msg.sender?._id ?? msg.sender) || "unknown"
    ),
    message: msg.message || msg.text || "---",
    timestamp: msg.timestamp || msg.createdAt || Date.now(),
    attachments: msg.attachments || [],
    replyTo: msg.replyTo || null,
    reactions: msg.reactions || [], // Explicitly preserve reactions
  }));

  // Apply filters
  const filteredMessages = normalizedMessages.filter((msg) => {
    // Search by message content
    if (
      messageSearchTerm &&
      !msg.message.toLowerCase().includes(messageSearchTerm.toLowerCase())
    ) {
      return false;
    }

    // Filter by sender name
    if (searchSender) {
      const senderName = getSenderName(msg.senderId);
      if (!senderName.toLowerCase().includes(searchSender.toLowerCase())) {
        return false;
      }
    }

    // Filter by date range
    if (dateFilter.start || dateFilter.end) {
      const msgDate = new Date(msg.timestamp).toISOString().split("T")[0];
      if (dateFilter.start && msgDate < dateFilter.start) return false;
      if (dateFilter.end && msgDate > dateFilter.end) return false;
    }

    return true;
  });

  // Auto-scroll only when new messages are added (not when reactions update)
  useEffect(() => {
    if (filteredMessages.length > prevMessagesLengthRef.current) {
      chatEndRef.current?.scrollIntoView({ behavior: "smooth" });
    }
    prevMessagesLengthRef.current = filteredMessages.length;
  }, [filteredMessages]);

  // Close emoji picker when clicking outside
  useEffect(() => {
    const handleClickOutside = (event) => {
      if (emojiPickerRef.current && !emojiPickerRef.current.contains(event.target)) {
        setShowEmojiPicker(null);
      }
      if (suggestionsRef.current && !suggestionsRef.current.contains(event.target)) {
        setShowSuggestions(false);
      }
    };

    if (showEmojiPicker !== null || showSuggestions) {
      document.addEventListener('mousedown', handleClickOutside);
    }

    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, [showEmojiPicker, showSuggestions]);

  // Update suggestions when input changes
  useEffect(() => {
    if (input.trim().length >= 2) {
      const newSuggestions = getSuggestions(input, 8);
      setSuggestions(newSuggestions);
      setShowSuggestions(newSuggestions.length > 0);
      setSelectedSuggestionIndex(0);
    } else {
      setShowSuggestions(false);
      setSuggestions([]);
    }
  }, [input, getSuggestions]);

  // Update quick replies based on last message
  useEffect(() => {
    if (Array.isArray(messages) && messages.length > 0) {
      const lastMessage = messages[messages.length - 1];
      if (lastMessage && String(lastMessage?.senderId || lastMessage?.sender?._id) !== String(currentUserId)) {
        const replies = getQuickReplies(lastMessage?.message || lastMessage?.text || '');
        setQuickReplies(replies || []);
      } else {
        setQuickReplies([]);
      }
    }
  }, [messages, currentUserId, getQuickReplies]);

  // Typing indicator — listen for other members typing in this conversation.
  useEffect(() => {
    if (!conversationId) return undefined;

    const handleTyping = (event) => {
      const data = event.detail || {};
      if (data.conversationId !== conversationId || data.userId === currentUserId) return;
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
      if (data.conversationId !== conversationId) return;
      setTypingUsers((prev) => prev.filter((u) => u.userId !== data.userId));
    };

    window.addEventListener("chat-typing", handleTyping);
    window.addEventListener("chat-stop-typing", handleStopTyping);
    return () => {
      window.removeEventListener("chat-typing", handleTyping);
      window.removeEventListener("chat-stop-typing", handleStopTyping);
    };
  }, [conversationId, currentUserId]);

  // Reset typing state when switching conversations
  useEffect(() => {
    setTypingUsers([]);
    if (typingTimeoutRef.current) clearTimeout(typingTimeoutRef.current);
  }, [conversationId]);

  // Handle suggestion selection
  const acceptSuggestion = (suggestion) => {
    setInput(suggestion.text);
    setShowSuggestions(false);
    textareaRef.current?.focus();
  };

  // Handle quick reply click
  const handleQuickReply = (text) => {
    setInput(text);
    textareaRef.current?.focus();
  };

  return (
    <div className="flex h-full flex-col bg-slate-50 text-slate-900 dark:bg-[#0b0d12] dark:text-slate-100">
      {/* Search and Filter Panel */}
      <div className="border-b border-slate-200 bg-white dark:border-white/10 dark:bg-[#10131c]">
        <div className="flex items-center">
          <button
            onClick={() => setShowFilters(!showFilters)}
            className="flex flex-1 items-center gap-2 px-4 py-2 text-left text-sm text-slate-600 transition hover:bg-slate-100 dark:text-slate-300 dark:hover:bg-white/[0.06]"
          >
            <Filter className="h-4 w-4" />
            <span>Search & Filters {showFilters ? "▼" : "▶"}</span>
          </button>
          {!wsConnected && (
            <span className="inline-flex items-center gap-1.5 rounded-full bg-rose-50 px-2 py-1 text-[10px] text-rose-700 dark:bg-rose-500/10 dark:text-rose-300">
              <span className="h-1.5 w-1.5 rounded-full bg-rose-400" />
              Reconnecting
            </span>
          )}
          <button
            onClick={handleSummarize}
            className="flex items-center gap-2 border-l border-slate-200 px-4 py-2 text-sm text-slate-600 transition hover:bg-slate-100 dark:border-white/10 dark:text-slate-300 dark:hover:bg-white/[0.06]"
            title="Summarize conversation"
          >
            <Sparkles className="h-4 w-4 text-blue-500 dark:text-blue-400" />
            <span>Summarize</span>
          </button>
        </div>
        {showFilters && (
          <div className="grid grid-cols-1 gap-3 border-t border-slate-200 bg-slate-50 p-3 dark:border-white/10 dark:bg-[#0d1017] sm:grid-cols-2">
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
            <div className="flex gap-2">
              <input
                type="date"
                value={dateFilter.start}
                onChange={(e) =>
                  setDateFilter((prev) => ({ ...prev, start: e.target.value }))
                }
                className="app-control flex-1 px-3 py-2 text-sm"
              />
              <input
                type="date"
                value={dateFilter.end}
                onChange={(e) =>
                  setDateFilter((prev) => ({ ...prev, end: e.target.value }))
                }
                className="app-control flex-1 px-3 py-2 text-sm"
              />
            </div>
            {(messageSearchTerm || searchSender || dateFilter.start || dateFilter.end) && (
              <button
                onClick={clearFilters}
                className="flex items-center justify-center gap-2 rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700 transition hover:bg-red-100 dark:border-red-500/30 dark:bg-red-600/20 dark:text-red-400 dark:hover:bg-red-600/40 sm:col-span-2"
              >
                <XCircle className="w-4 h-4" />
                Clear Filters
              </button>
            )}
          </div>
        )}
      </div>

      <div className="flex-1 overflow-y-auto p-3 sm:px-5 sm:py-4">
        {filteredMessages.length === 0 ? (
          <p className="mt-10 text-center text-sm text-slate-500 dark:text-slate-400">
            No messages found...
          </p>
        ) : (
          filteredMessages.map((msg, index) => {
            // Ensure currentUserId and senderId are compared as strings
            const isSelf = String(msg.senderId) === String(currentUserId);

            // Someone addressed you here (by name or via @everyone). Worth
            // marking the whole bubble, not just the name: the point is to be
            // findable when scrolling back through a busy group, which a chip
            // buried mid-paragraph isn't. Never applies to your own messages —
            // you can't summon yourself.
            const mentionsMe =
              !isSelf &&
              messageMentionsUser(
                msg.message || msg.text || "",
                conversationMembers,
                currentUserId
              );

            const prevMsg = filteredMessages[index - 1];
            const showDateDivider =
              !prevMsg ||
              new Date(msg.timestamp).toDateString() !==
                new Date(prevMsg.timestamp).toDateString();

            return (
              <React.Fragment key={msg.messageId}>
                {showDateDivider && <MessageDateSeparator date={msg.timestamp} />}
                <div
                  id={`message-${msg.messageId || msg._id}`}
                  className={`flex w-full transition-colors duration-500 ${
                    isSelf ? "justify-end" : "justify-start"
                  } mb-3`}
                >
                  <div className="flex max-w-[85%] flex-col sm:max-w-[70%]">
                    {!isSelf && (
                      <p className="mb-1 px-1 text-xs text-slate-500 dark:text-gray-400">
                        {getSenderName(msg.senderId)}
                      </p>
                    )}
                    <div
                      className={`w-fit max-w-full rounded-xl border p-3 shadow-sm transition-colors duration-200 ${
                        isSelf
                          ? "border-blue-600/20 bg-blue-600 text-white dark:border-blue-400/15"
                          : mentionsMe
                          ? "border-amber-200 border-l-4 border-l-amber-400 bg-amber-50/70 text-slate-900 dark:border-amber-400/25 dark:border-l-amber-400 dark:bg-amber-400/[0.07] dark:text-white"
                          : "border-slate-200 bg-white text-slate-900 dark:border-white/10 dark:bg-[#1a2433] dark:text-white"
                      }`}
                    >
                      {/* Reply Preview */}
                      {msg.replyTo && (
                        <div
                          onClick={() => scrollToMessage(msg.replyTo?._id || msg.replyTo?.messageId)}
                          className="mb-2 cursor-pointer overflow-hidden rounded border-l-2 border-blue-400 bg-black/10 px-2 py-1 text-xs transition hover:bg-black/15 dark:bg-black/20 dark:hover:bg-black/30"
                          style={{ wordBreak: 'break-word', overflowWrap: 'anywhere' }}
                        >
                          <p className={`truncate font-semibold ${isSelf ? "text-blue-50" : "text-slate-700 dark:text-blue-300"}`}>
                            {msg.replyTo?.senderId?.name ||
                             (Array.isArray(conversationMembers) ? conversationMembers.find(m => m?._id === msg.replyTo?.senderId) : null)?.name ||
                             "Unknown"}
                          </p>
                          <p className={`overflow-hidden italic ${isSelf ? "text-blue-50/80" : "text-slate-500 dark:text-gray-400"}`} style={{
                            display: '-webkit-box',
                            WebkitLineClamp: 2,
                            WebkitBoxOrient: 'vertical',
                            wordBreak: 'break-word',
                            overflowWrap: 'anywhere'
                          }}>
                            {msg.replyTo?.message || "..."}
                          </p>
                        </div>
                      )}

                      {/* Message with Markdown rendering */}
                      {msg.message || msg.text ? (
                        <div className={`prose prose-sm max-w-none break-words text-sm leading-relaxed ${isSelf ? "prose-invert text-white" : "prose-slate dark:prose-invert dark:text-white"}`}>
                          <ReactMarkdown
                            remarkPlugins={[remarkGfm]}
                            rehypePlugins={[rehypeRaw]}
                            components={{
                              // Custom styling for markdown elements
                              p: ({ children }) => (
                                <p className="mb-1 last:mb-0 whitespace-pre-wrap">
                                  <MentionText
                                    members={conversationMembers}
                                    currentUserId={currentUserId}
                                    isSelf={isSelf}
                                  >
                                    {children}
                                  </MentionText>
                                </p>
                              ),
                              h1: ({ children }) => (
                                <h1 className="text-lg font-bold mb-1">
                                  {children}
                                </h1>
                              ),
                              h2: ({ children }) => (
                                <h2 className="text-base font-bold mb-1">
                                  {children}
                                </h2>
                              ),
                              h3: ({ children }) => (
                                <h3 className="text-sm font-bold mb-1">
                                  {children}
                                </h3>
                              ),
                              ul: ({ children }) => (
                                <ul className="list-disc list-inside mb-1">
                                  {children}
                                </ul>
                              ),
                              ol: ({ children }) => (
                                <ol className="list-decimal list-inside mb-1">
                                  {children}
                                </ol>
                              ),
                              li: ({ children }) => (
                                <li className="ml-2">
                                  <MentionText
                                    members={conversationMembers}
                                    currentUserId={currentUserId}
                                    isSelf={isSelf}
                                  >
                                    {children}
                                  </MentionText>
                                </li>
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
                                  href={href || '#'}
                                  target="_blank"
                                  rel="noopener noreferrer"
                                  className={`underline ${isSelf ? "text-blue-50 hover:text-white" : "text-blue-600 hover:text-blue-700 dark:text-blue-300 dark:hover:text-blue-200"}`}
                                >
                                  {children}
                                </a>
                              ),
                            }}
                          >
                            {msg.message || msg.text || ''}
                          </ReactMarkdown>
                        </div>
                      ) : null}

                      {/* Attachments */}
                      {Array.isArray(msg.attachments) && msg.attachments.length > 0 && (
                        <div className="mt-3 space-y-2">
                          {msg.attachments.map((att, attIdx) => {
                            if (!att) return null;
                            const isMedia = att?.fileType === "image" || att?.fileType === "video";
                            const mediaAttachments = Array.isArray(msg.attachments) ? msg.attachments.filter(a => a?.fileType === "image" || a?.fileType === "video") : [];

                            return (
                              <div key={att?._id || attIdx}>
                                {!isMedia && att?.url && (
                                  <div className="flex items-center gap-2 rounded border border-[#1e2a35]/0 bg-black/10 p-2 dark:bg-black/20">
                                    {getFileIcon(att?.fileType)}
                                    <div className="min-w-0 flex-1">
                                      <div className={`truncate text-xs ${isSelf ? "text-white" : "text-slate-900 dark:text-white"}`}>
                                        {att?.filename || 'Unknown file'}
                                      </div>
                                      <div className={`text-xs ${isSelf ? "text-blue-50/75" : "text-slate-500 dark:text-gray-400"}`}>
                                        {att?.size ? `${(att.size / 1024).toFixed(1)} KB` : 'N/A'}
                                      </div>
                                    </div>
                                    <a
                                      href={att.url?.startsWith('http') ? att.url : `${import.meta.env.VITE_API_BASE || 'http://localhost:5000'}${att.url || ''}`}
                                      target="_blank"
                                      rel="noopener noreferrer"
                                      className="rounded p-1 hover:bg-black/10 dark:hover:bg-white/10"
                                      download
                                    >
                                      <Download className={`h-4 w-4 ${isSelf ? "text-blue-50/80" : "text-slate-500 dark:text-gray-300"}`} />
                                    </a>
                                  </div>
                                )}

                                {att?.fileType === "image" && att?.url && (
                                  <div className="relative group">
                                    <img
                                      src={att.url?.startsWith('http') ? att.url : `${import.meta.env.VITE_API_BASE || 'http://localhost:5000'}${att.url || ''}`}
                                      alt={att?.filename || 'Image'}
                                      className="h-48 w-48 cursor-pointer rounded object-cover transition-opacity hover:opacity-90"
                                      onClick={() => {
                                        setLightboxAllMedia(mediaAttachments);
                                        setLightboxIndex(mediaAttachments.findIndex(a => a?._id === att._id));
                                        setLightboxMedia(att);
                                      }}
                                    />
                                  </div>
                                )}

                                {att?.fileType === "video" && att?.url && (
                                  <div className="relative">
                                    <video
                                      src={att.url?.startsWith('http') ? att.url : `${import.meta.env.VITE_API_BASE || 'http://localhost:5000'}${att.url || ''}`}
                                      className="h-48 w-48 cursor-pointer rounded object-cover"
                                      onClick={() => {
                                        setLightboxAllMedia(mediaAttachments);
                                        setLightboxIndex(mediaAttachments.findIndex(a => a?._id === att._id));
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

                      {/* Reactions Display */}
                      {Array.isArray(msg.reactions) && msg.reactions.length > 0 && (
                        <div className="mt-2 flex flex-wrap gap-1">
                          {msg.reactions.map((reaction, idx) => {
                            if (!reaction) return null;
                            const userReacted = Array.isArray(reaction?.users) && reaction.users.includes(String(currentUserId));
                            return (
                              <button
                                key={idx}
                                onClick={() => handleReaction(msg.messageId, reaction?.emoji)}
                                className={`flex items-center gap-1 rounded-full px-2 py-0.5 text-xs transition-all ${
                                  userReacted
                                    ? "border border-blue-300 bg-blue-100 text-blue-700 dark:border-blue-400 dark:bg-blue-500/30 dark:text-white"
                                    : "bg-black/10 hover:bg-black/15 dark:bg-black/20 dark:hover:bg-black/30"
                                }`}
                                title={userReacted ? "Remove reaction" : "Add reaction"}
                              >
                                <span>{reaction?.emoji || ''}</span>
                                <span className={`text-[10px] ${isSelf ? "text-blue-50/80" : "text-slate-500 dark:text-gray-300"}`}>
                                  {Array.isArray(reaction?.users) ? reaction.users.length : 0}
                                </span>
                              </button>
                            );
                          })}
                        </div>
                      )}

                      <div className="mt-1 flex items-center justify-between gap-3">
                        <span className={`text-[10px] ${isSelf ? "text-blue-50/80" : "text-slate-500 dark:text-gray-400"}`}>
                          {msg?.timestamp ? new Date(msg.timestamp).toLocaleTimeString([], {
                            hour: "2-digit",
                            minute: "2-digit",
                          }) : ''}
                        </span>
                        <div className="relative flex items-center gap-1 opacity-100 transition-opacity sm:opacity-0 sm:group-hover:opacity-100">
                          <button
                            onClick={() => handleReply(msg)}
                            className="rounded-md p-1 transition-colors hover:bg-black/10 dark:hover:bg-white/10"
                            title="Reply to message"
                          >
                            <ReplyIcon className={`h-3.5 w-3.5 ${isSelf ? "text-blue-50/80 hover:text-white" : "text-slate-400 hover:text-blue-600 dark:text-gray-400 dark:hover:text-blue-400"}`} />
                          </button>
                          <button
                            onClick={() => copyToClipboard(msg.message || msg.text || '')}
                            className="rounded-md p-1 transition-colors hover:bg-black/10 dark:hover:bg-white/10"
                            title="Copy message"
                          >
                            {copiedText === (msg.message || msg.text) ? (
                              <Check className="h-3.5 w-3.5 text-green-400" />
                            ) : (
                              <Copy className={`h-3.5 w-3.5 ${isSelf ? "text-blue-50/80 hover:text-white" : "text-slate-400 hover:text-blue-600 dark:text-gray-400 dark:hover:text-blue-400"}`} />
                            )}
                          </button>
                          <button
                            onClick={() =>
                              setShowEmojiPicker(
                                showEmojiPicker === msg.messageId ? null : msg.messageId
                              )
                            }
                            className="rounded-md p-1 transition-colors hover:bg-black/10 dark:hover:bg-white/10"
                            title="Add reaction"
                          >
                            <Smile className={`h-3.5 w-3.5 ${isSelf ? "text-blue-50/80 hover:text-white" : "text-slate-400 hover:text-yellow-500 dark:text-gray-400 dark:hover:text-yellow-400"}`} />
                          </button>

                          {/* Emoji Picker Popup */}
                          {showEmojiPicker === msg.messageId && (
                            <div
                              ref={emojiPickerRef}
                              className={`absolute ${isSelf ? 'right-0' : 'left-0'} bottom-full z-50 mb-1 flex gap-1 rounded-lg border border-slate-200 bg-white p-2 shadow-2xl shadow-slate-900/15 dark:border-[#232945] dark:bg-[#1a2332]`}
                            >
                              {commonEmojis.map((emoji, emojiIdx) => (
                                <button
                                  key={emojiIdx}
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    handleReaction(msg.messageId, emoji);
                                  }}
                                  className="rounded p-1.5 text-lg transition-transform hover:scale-125 hover:bg-slate-100 dark:hover:bg-white/10"
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
          })
        )}
        <div ref={chatEndRef} />
      </div>

      {/* Typing Indicator */}
      <TypingIndicator typingUsers={typingUsers} />

      {/* Reply Preview Bar */}
      {replyingTo && (
        <div className="flex items-start justify-between gap-2 overflow-hidden border-t border-blue-200 bg-blue-50 px-4 py-2 dark:border-blue-400/20 dark:bg-blue-500/10">
          <div className="min-w-0 flex-1 overflow-hidden text-sm text-slate-700 dark:text-gray-300">
            <div className="mb-1 flex items-center gap-2 text-sm text-blue-700 dark:text-blue-300">
              <ReplyIcon className="w-3 h-3 flex-shrink-0" />
              <span className="font-medium truncate">Replying to {getSenderName(replyingTo?.senderId)}</span>
            </div>
            <div className="overflow-hidden text-xs text-slate-500 dark:text-gray-400" style={{
              display: '-webkit-box',
              WebkitLineClamp: 2,
              WebkitBoxOrient: 'vertical',
              wordBreak: 'break-word',
              overflowWrap: 'anywhere'
            }}>
              {replyingTo?.message || ''}
            </div>
          </div>
          <button
            onClick={() => setReplyingTo(null)}
            className="flex-shrink-0 rounded p-1 hover:bg-black/5 dark:hover:bg-white/10"
          >
            <XCircle className="w-4 h-4 text-slate-400" />
          </button>
        </div>
      )}

      {/* File Preview */}
      {selectedFiles.length > 0 && (
        <div className="border-t border-slate-200 bg-white px-4 py-2 dark:border-white/10 dark:bg-[#10131c]">
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
                <span className="max-w-[150px] truncate text-xs text-slate-700 dark:text-gray-300">{file.name}</span>
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

      {/* Formatting Toolbar */}
      {showFormatting && (
        <div className="border-t border-slate-200 bg-slate-50 px-4 py-3 dark:border-white/10 dark:bg-[#0d1017]">
          <div className="flex flex-wrap gap-2">
            <button
              type="button"
              onClick={formatBold}
              className="rounded border border-slate-200 bg-white px-3 py-1.5 text-xs font-bold text-slate-700 transition-colors hover:bg-slate-100 dark:border-white/10 dark:bg-[#232945] dark:text-white dark:hover:bg-[#2a3142]"
              title="Bold (Ctrl+B)"
            >
              B
            </button>
            <button
              type="button"
              onClick={formatItalic}
              className="rounded border border-slate-200 bg-white px-3 py-1.5 text-xs italic text-slate-700 transition-colors hover:bg-slate-100 dark:border-white/10 dark:bg-[#232945] dark:text-white dark:hover:bg-[#2a3142]"
              title="Italic (Ctrl+I)"
            >
              I
            </button>
            <button
              type="button"
              onClick={formatStrikethrough}
              className="rounded border border-slate-200 bg-white px-3 py-1.5 text-xs line-through text-slate-700 transition-colors hover:bg-slate-100 dark:border-white/10 dark:bg-[#232945] dark:text-white dark:hover:bg-[#2a3142]"
              title="Strikethrough (Ctrl+U)"
            >
              S
            </button>
            <button
              type="button"
              onClick={formatCode}
              className="rounded border border-slate-200 bg-white px-3 py-1.5 font-mono text-xs text-slate-700 transition-colors hover:bg-slate-100 dark:border-white/10 dark:bg-[#232945] dark:text-white dark:hover:bg-[#2a3142]"
              title="Code (Ctrl+E)"
            >
              &lt;/&gt;
            </button>
            <button
              type="button"
              onClick={formatHeading}
              className="rounded border border-slate-200 bg-white px-3 py-1.5 text-xs font-bold text-slate-700 transition-colors hover:bg-slate-100 dark:border-white/10 dark:bg-[#232945] dark:text-white dark:hover:bg-[#2a3142]"
              title="Heading (Ctrl+D)"
            >
              H1
            </button>
            <button
              type="button"
              onClick={formatBullet}
              className="rounded border border-slate-200 bg-white px-3 py-1.5 text-xs text-slate-700 transition-colors hover:bg-slate-100 dark:border-white/10 dark:bg-[#232945] dark:text-white dark:hover:bg-[#2a3142]"
              title="Bullet List (Ctrl+L)"
            >
              • List
            </button>
            <button
              type="button"
              onClick={formatNumbered}
              className="rounded border border-slate-200 bg-white px-3 py-1.5 text-xs text-slate-700 transition-colors hover:bg-slate-100 dark:border-white/10 dark:bg-[#232945] dark:text-white dark:hover:bg-[#2a3142]"
              title="Numbered List (Ctrl+Shift+L)"
            >
              1. List
            </button>
          </div>
        </div>
      )}

      {/* Quick Replies */}
      {quickReplies.length > 0 && input.length === 0 && showQuickReplies && (
        <div className="border-t border-slate-200 bg-white px-4 py-2 dark:border-white/10 dark:bg-[#10131c]">
          <div className="mb-2 flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Zap className="h-4 w-4 text-yellow-500 dark:text-yellow-400" />
              <span className="text-xs text-slate-500 dark:text-gray-400">Quick Replies:</span>
            </div>
            <button
              onClick={() => setShowQuickReplies(false)}
              className="rounded p-1 transition-colors hover:bg-slate-100 dark:hover:bg-gray-700"
              title="Hide quick replies"
            >
              <XCircle className="h-4 w-4 text-slate-400" />
            </button>
          </div>
          <div className="flex flex-wrap gap-2">
            {quickReplies.map((reply, idx) => (
              <button
                key={idx}
                onClick={() => handleQuickReply(reply)}
                className="flex items-center gap-1 rounded-full border border-blue-200 bg-blue-50 px-3 py-1.5 text-xs text-slate-700 transition-all hover:scale-105 hover:bg-blue-100 dark:border-blue-400/30 dark:bg-blue-500/15 dark:text-blue-100 dark:hover:bg-blue-500/25"
              >
                <Lightbulb className="h-3 w-3 text-yellow-500 dark:text-yellow-400" />
                {reply}
              </button>
            ))}
          </div>
        </div>
      )}

      {/* Input Area */}
      <div className="relative border-t border-slate-200 bg-white p-2 dark:border-white/10 dark:bg-[#10131c] sm:px-3">
        {/* Suggestions Dropdown */}
        {showSuggestions && suggestions.length > 0 && (
          <div
            ref={suggestionsRef}
            className="absolute bottom-full left-0 right-0 z-50 mb-2 max-h-64 overflow-y-auto rounded-lg border border-slate-200 bg-white shadow-2xl shadow-slate-900/15 dark:border-[#232945] dark:bg-gray-900"
          >
            <div className="sticky top-0 flex items-center gap-2 border-b border-slate-200 bg-white p-2 dark:border-[#232945] dark:bg-gray-900">
              <Sparkles className="w-4 h-4 text-blue-400" />
              <span className="text-xs text-slate-500 dark:text-gray-400">
                Suggestions ({suggestions.length}) · <kbd className="rounded bg-slate-100 px-1 py-0.5 text-[10px] dark:bg-gray-700">↑↓</kbd> to navigate · <kbd className="rounded bg-slate-100 px-1 py-0.5 text-[10px] dark:bg-gray-700">Tab</kbd> or <kbd className="rounded bg-slate-100 px-1 py-0.5 text-[10px] dark:bg-gray-700">Enter</kbd> to select
              </span>
            </div>
            {suggestions.map((suggestion, idx) => (
              <button
                key={idx}
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
                      <Clock className="w-3 h-3 text-gray-400" />
                    )}
                    {suggestion.type === "quick" && (
                      <Zap className="w-3 h-3 text-yellow-400" />
                    )}
                    {suggestion.type === "task" && (
                      <Check className="w-3 h-3 text-green-400" />
                    )}
                    {suggestion.type === "project" && (
                      <FileIcon className="w-3 h-3 text-blue-400" />
                    )}
                    {suggestion.type === "frequent" && (
                      <Sparkles className="w-3 h-3 text-blue-400" />
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
                  ? "border-blue-300 bg-blue-50 text-blue-700 dark:border-blue-400/30 dark:bg-blue-500/10 dark:text-blue-300"
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
                  <Type className="h-4 w-4 text-blue-400" />
                  Formatting
                </button>
              </div>
            )}
          </div>

          <div className="min-w-0 flex-1" onFocus={() => {
            // Scroll to bottom when focused
            chatEndRef.current?.scrollIntoView({ behavior: "smooth" });
          }}>
            <MentionInput
              ref={textareaRef}
              value={input}
              onChange={(newValue, mentions) => {
                setInput(newValue);
                setMentionedUsers(mentions);
                if (newValue.length > 0) sendTypingIndicator();
                else stopTypingIndicator();
                // Auto-scroll to bottom when typing
                chatEndRef.current?.scrollIntoView({ behavior: "smooth" });
              }}
              users={conversationMembers || []}
              currentUserId={currentUserId}
              placeholder="Write a message... (@ to mention someone)"
              rows={1}
              className="h-11 w-full rounded-xl border-slate-200 bg-white py-2.5 text-slate-900 placeholder-slate-400 focus:border-blue-400/50 dark:border-white/10 dark:bg-[#101820] dark:text-white dark:placeholder-slate-500"
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
                    handleSendMessage();
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
            onClick={handleSendMessage}
            disabled={!input.trim() && selectedFiles.length === 0}
            className="flex h-11 flex-shrink-0 items-center gap-2 rounded-lg bg-blue-600 px-3 text-white shadow-lg shadow-blue-950/20 transition hover:bg-blue-500 disabled:cursor-not-allowed disabled:opacity-40 sm:px-4"
          >
            <Send className="h-4 w-4" />
            <span className="hidden text-sm sm:inline">Send</span>
          </button>
        </div>
      </div>

      {/* Media Lightbox */}
      {lightboxMedia && (
        <MediaLightbox
          media={lightboxMedia}
          allMedia={lightboxAllMedia}
          currentIndex={lightboxIndex}
          onClose={() => setLightboxMedia(null)}
          onNavigate={(newIndex) => {
            setLightboxIndex(newIndex);
            setLightboxMedia(lightboxAllMedia[newIndex]);
          }}
        />
      )}

      {/* AI Summary Modal */}
      {showSummaryModal && (
        <div
          className="fixed inset-0 z-[9999] flex items-center justify-center bg-slate-950/60 p-4 backdrop-blur-sm"
          onClick={() => setShowSummaryModal(false)}
        >
          <div
            className="flex max-h-[80vh] w-full max-w-3xl flex-col rounded-xl border border-slate-200 bg-white shadow-2xl dark:border-[#232945] dark:bg-[#0f1419]"
            onClick={(e) => e.stopPropagation()}
          >
            {/* Modal Header */}
            <div className="flex items-center justify-between border-b border-slate-200 p-4 dark:border-[#1e2a35]">
              <div className="flex items-center gap-3">
                <Sparkles className="h-5 w-5 text-blue-500 dark:text-blue-400" />
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

            {/* Days Selector */}
            <div className="border-b border-slate-200 bg-slate-50 px-4 py-3 dark:border-[#1e2a35] dark:bg-[#0a0e14]/50">
              <div className="flex items-center gap-3">
                <label className="text-sm text-slate-500 dark:text-gray-400">Time period:</label>
                <select
                  value={summaryDays}
                  onChange={(e) => setSummaryDays(Number(e.target.value))}
                  className="rounded border border-slate-200 bg-white px-3 py-1.5 text-sm text-slate-900 outline-none focus:ring-2 focus:ring-blue-500 dark:border-[#2a3340] dark:bg-[#141a21] dark:text-blue-100"
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
                  className="flex items-center gap-2 rounded bg-blue-600 px-4 py-1.5 text-sm text-white transition hover:bg-blue-500 disabled:cursor-not-allowed disabled:opacity-50"
                >
                  <Sparkles className="h-4 w-4" />
                  {summaryLoading ? "Generating..." : "Regenerate"}
                </button>
              </div>
            </div>

            {/* Modal Body */}
            <div className="flex-1 overflow-y-auto bg-slate-50/50 p-6 dark:bg-[#0a0e14]/30">
              {summaryLoading ? (
                <div className="flex h-full flex-col items-center justify-center gap-4">
                  <div className="relative">
                    <div className="h-16 w-16 animate-spin rounded-full border-4 border-blue-500/30 border-t-blue-500"></div>
                    <Sparkles className="absolute left-1/2 top-1/2 h-6 w-6 -translate-x-1/2 -translate-y-1/2 text-blue-400" />
                  </div>
                  <p className="text-sm text-slate-500 dark:text-gray-400">Analyzing conversation with AI...</p>
                </div>
              ) : (
                <div className="prose prose-sm prose-slate max-w-none dark:prose-invert">
                  <ReactMarkdown
                    remarkPlugins={[remarkGfm]}
                    components={{
                      p: ({ children }) => (
                        <p className="mb-3 leading-relaxed text-slate-700 dark:text-gray-200">{children}</p>
                      ),
                      h1: ({ children }) => (
                        <h1 className="mb-3 text-2xl font-bold text-slate-950 dark:text-gray-100">{children}</h1>
                      ),
                      h2: ({ children }) => (
                        <h2 className="mb-2 text-xl font-bold text-slate-950 dark:text-gray-100">{children}</h2>
                      ),
                      h3: ({ children }) => (
                        <h3 className="mb-2 text-lg font-bold text-slate-950 dark:text-gray-100">{children}</h3>
                      ),
                      ul: ({ children }) => (
                        <ul className="mb-3 list-inside list-disc space-y-1">{children}</ul>
                      ),
                      ol: ({ children }) => (
                        <ol className="mb-3 list-inside list-decimal space-y-1">{children}</ol>
                      ),
                      li: ({ children }) => (
                        <li className="ml-2 text-slate-700 dark:text-gray-200">{children}</li>
                      ),
                      strong: ({ children }) => (
                        <strong className="font-bold text-blue-700 dark:text-blue-300">{children}</strong>
                      ),
                      code: ({ inline, children }) =>
                        inline ? (
                          <code className="rounded bg-slate-100 px-1.5 py-0.5 text-xs text-blue-700 dark:bg-gray-900 dark:text-blue-300">
                            {children}
                          </code>
                        ) : (
                          <code className="block overflow-x-auto rounded bg-slate-100 p-3 text-sm text-slate-700 dark:bg-gray-900 dark:text-gray-300">
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
            <div className="flex items-center justify-between border-t border-slate-200 bg-slate-50 p-4 dark:border-[#1e2a35] dark:bg-[#0a0e14]/50">
              <div className="text-xs text-slate-500 dark:text-gray-500">
                Powered by AI · Last {summaryDays} day{summaryDays !== 1 ? 's' : ''}
              </div>
              <button
                onClick={() => copyToClipboard(summary)}
                disabled={!summary || summaryLoading}
                className="flex items-center gap-2 rounded border border-slate-200 bg-white px-4 py-2 text-sm text-slate-700 transition hover:bg-slate-100 disabled:cursor-not-allowed disabled:opacity-50 dark:border-[#2a3340] dark:bg-[#141a21] dark:text-gray-200 dark:hover:bg-[#1e2a35]"
              >
                {copiedText === summary ? (
                  <>
                    <Check className="h-4 w-4" />
                    Copied!
                  </>
                ) : (
                  <>
                    <Copy className="h-4 w-4" />
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

export default ChatWindow;
