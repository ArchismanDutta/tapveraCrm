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
} from "lucide-react";
import MediaLightbox from "../common/MediaLightbox";
import useMessageSuggestions from "../../hooks/useMessageSuggestions";

const DateDivider = ({ date }) => {
  const now = new Date();
  const messageDate = new Date(date);
  let label;

  const isToday = now.toDateString() === messageDate.toDateString();
  const yesterday = new Date(now);
  yesterday.setDate(now.getDate() - 1);
  const isYesterday = yesterday.toDateString() === messageDate.toDateString();

  if (isToday) label = "Today";
  else if (isYesterday) label = "Yesterday";
  else label = messageDate.toLocaleDateString();

  return (
    <div className="flex justify-center my-3 w-full">
      <span className="bg-gray-700 text-gray-300 rounded-full px-3 py-1 text-xs select-none">
        {label}
      </span>
    </div>
  );
};

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
  const commonEmojis = ["👍", "❤️", "😂", "😮", "😢", "🎉", "🔥", "👏"];
  const chatEndRef = useRef(null);
  const fileInputRef = useRef(null);
  const textareaRef = useRef(null);
  const prevMessagesLengthRef = useRef(0);
  const emojiPickerRef = useRef(null);

  // Message suggestions
  const { getSuggestions, getQuickReplies } = useMessageSuggestions(conversationId, messages);
  const [suggestions, setSuggestions] = useState([]);
  const [selectedSuggestionIndex, setSelectedSuggestionIndex] = useState(0);
  const [showSuggestions, setShowSuggestions] = useState(false);
  const [quickReplies, setQuickReplies] = useState([]);
  const suggestionsRef = useRef(null);

  const handleSendMessage = async () => {
    if (!input.trim() && selectedFiles.length === 0) return;

    const API_BASE = import.meta.env.VITE_API_BASE || "http://localhost:5000";
    const token = localStorage.getItem("token");

    try {
      // If there are files or reply, use HTTP POST (FormData required)
      if (selectedFiles.length > 0 || replyingTo) {
        const formData = new FormData();
        formData.append("conversationId", conversationId);
        formData.append("message", input.trim());
        if (replyingTo) {
          formData.append("replyTo", replyingTo._id || replyingTo.messageId);
        }
        selectedFiles.forEach((file) => {
          formData.append("files", file);
        });

        const response = await fetch(`${API_BASE}/api/chat/messages`, {
          method: "POST",
          headers: {
            Authorization: `Bearer ${token}`,
          },
          body: formData,
        });

        if (!response.ok) {
          throw new Error("Failed to send message");
        }

        // Clear input and attachments after successful send
        setInput("");
        setSelectedFiles([]);
        setReplyingTo(null);

        // The WebSocket will handle displaying the new message
      } else {
        // Simple text message - use WebSocket for real-time
        sendMessage(conversationId, input.trim());
        setInput("");
      }
    } catch (error) {
      console.error("Error sending message:", error);
      alert("Failed to send message. Please try again.");
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
      element.classList.add("bg-blue-500", "bg-opacity-20");
      setTimeout(() => {
        element.classList.remove("bg-blue-500", "bg-opacity-20");
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
    const member = conversationMembers.find((m) => m._id === senderId);
    return member ? member.name : "Unknown";
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
    if (messages && messages.length > 0) {
      const lastMessage = messages[messages.length - 1];
      if (String(lastMessage.senderId || lastMessage.sender?._id) !== String(currentUserId)) {
        const replies = getQuickReplies(lastMessage.message || lastMessage.text);
        setQuickReplies(replies);
      } else {
        setQuickReplies([]);
      }
    }
  }, [messages, currentUserId, getQuickReplies]);

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
    <div className="flex flex-col h-full bg-gray-900 text-gray-100">
      {/* Search and Filter Panel */}
      <div className="bg-gray-800 border-b border-gray-700">
        <button
          onClick={() => setShowFilters(!showFilters)}
          className="w-full px-4 py-2 text-sm text-left text-gray-300 hover:bg-gray-700 transition flex items-center gap-2"
        >
          <Filter className="w-4 h-4" />
          <span>Search & Filters {showFilters ? "▼" : "▶"}</span>
        </button>
        {showFilters && (
          <div className="p-4 space-y-3 border-t border-gray-700">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 w-4 h-4 text-gray-400" />
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
                  setDateFilter((prev) => ({ ...prev, start: e.target.value }))
                }
                className="flex-1 px-3 py-2 bg-gray-700 text-gray-100 rounded border border-gray-600 focus:outline-none focus:ring-2 focus:ring-blue-500 text-sm"
              />
              <input
                type="date"
                value={dateFilter.end}
                onChange={(e) =>
                  setDateFilter((prev) => ({ ...prev, end: e.target.value }))
                }
                className="flex-1 px-3 py-2 bg-gray-700 text-gray-100 rounded border border-gray-600 focus:outline-none focus:ring-2 focus:ring-blue-500 text-sm"
              />
            </div>
            {(messageSearchTerm || searchSender || dateFilter.start || dateFilter.end) && (
              <button
                onClick={clearFilters}
                className="w-full px-3 py-2 bg-red-600 hover:bg-red-700 text-white rounded text-sm transition flex items-center justify-center gap-2"
              >
                <XCircle className="w-4 h-4" />
                Clear Filters
              </button>
            )}
          </div>
        )}
      </div>

      <div className="flex-1 overflow-y-auto p-4 space-y-3 hide-scrollbar">
        {filteredMessages.length === 0 ? (
          <p className="text-gray-500 text-center text-sm">
            No messages found...
          </p>
        ) : (
          filteredMessages.map((msg, index) => {
            // Ensure currentUserId and senderId are compared as strings
            const isSelf = String(msg.senderId) === String(currentUserId);

            const prevMsg = filteredMessages[index - 1];
            const showDateDivider =
              !prevMsg ||
              new Date(msg.timestamp).toDateString() !==
                new Date(prevMsg.timestamp).toDateString();

            return (
              <React.Fragment key={msg.messageId}>
                {showDateDivider && <DateDivider date={msg.timestamp} />}
                <div
                  id={`message-${msg.messageId || msg._id}`}
                  className={`flex w-full transition-colors duration-500 ${
                    isSelf ? "justify-end" : "justify-start"
                  }`}
                >
                  <div className="flex flex-col max-w-[70%]">
                    {!isSelf && (
                      <p className="text-xs font-semibold text-gray-400 mb-1">
                        {getSenderName(msg.senderId)}
                      </p>
                    )}
                    <div
                      className={`px-3 py-2 rounded-lg ${
                        isSelf
                          ? "bg-blue-600 text-white rounded-br-none self-end"
                          : "bg-gray-700 text-gray-100 rounded-bl-none self-start"
                      }`}
                    >
                      {/* Reply Preview */}
                      {msg.replyTo && (
                        <div
                          onClick={() => scrollToMessage(msg.replyTo._id || msg.replyTo.messageId)}
                          className="bg-gray-800 bg-opacity-50 px-2 py-1 rounded mb-2 text-xs border-l-2 border-blue-400 cursor-pointer hover:bg-opacity-70 transition overflow-hidden"
                          style={{ wordBreak: 'break-word', overflowWrap: 'anywhere' }}
                        >
                          <p className="text-blue-300 font-semibold truncate">
                            {msg.replyTo.senderId?.name ||
                             conversationMembers.find(m => m._id === msg.replyTo.senderId)?.name ||
                             "Unknown"}
                          </p>
                          <p className="text-gray-400 italic overflow-hidden" style={{
                            display: '-webkit-box',
                            WebkitLineClamp: 2,
                            WebkitBoxOrient: 'vertical',
                            wordBreak: 'break-word',
                            overflowWrap: 'anywhere'
                          }}>
                            {msg.replyTo.message || "..."}
                          </p>
                        </div>
                      )}

                      {/* Message with Markdown rendering */}
                      {msg.message && (
                        <div className="text-sm prose prose-invert prose-sm max-w-none">
                          <ReactMarkdown
                            remarkPlugins={[remarkGfm]}
                            rehypePlugins={[rehypeRaw]}
                            components={{
                              // Custom styling for markdown elements
                              p: ({ children }) => (
                                <p className="mb-1 last:mb-0">{children}</p>
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
                      {msg.attachments && msg.attachments.length > 0 && (
                        <div className="mt-3 space-y-2">
                          {msg.attachments.map((att, attIdx) => {
                            const isMedia = att.fileType === "image" || att.fileType === "video";
                            const mediaAttachments = msg.attachments.filter(a => a.fileType === "image" || a.fileType === "video");

                            return (
                              <div key={attIdx}>
                                {!isMedia && (
                                  <div className="flex items-center gap-2 p-2 bg-black/20 rounded">
                                    {getFileIcon(att.fileType)}
                                    <div className="flex-1 min-w-0">
                                      <div className="text-xs text-white truncate">
                                        {att.filename}
                                      </div>
                                      <div className="text-xs text-gray-400">
                                        {att.size ? `${(att.size / 1024).toFixed(1)} KB` : 'N/A'}
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
                                  </div>
                                )}

                                {att.fileType === "image" && (
                                  <div className="relative group">
                                    <img
                                      src={att.url.startsWith('http') ? att.url : `http://localhost:5000${att.url}`}
                                      alt={att.filename}
                                      className="w-48 h-48 object-cover rounded cursor-pointer hover:opacity-90 transition-opacity"
                                      onClick={() => {
                                        setLightboxAllMedia(mediaAttachments);
                                        setLightboxIndex(mediaAttachments.indexOf(att));
                                        setLightboxMedia(att);
                                      }}
                                    />
                                    <div className="absolute inset-0 bg-black/0 group-hover:bg-black/10 rounded transition-colors pointer-events-none" />
                                  </div>
                                )}

                                {att.fileType === "video" && (
                                  <div className="relative">
                                    <video
                                      src={att.url.startsWith('http') ? att.url : `http://localhost:5000${att.url}`}
                                      className="w-48 h-48 object-cover rounded cursor-pointer"
                                      onClick={() => {
                                        setLightboxAllMedia(mediaAttachments);
                                        setLightboxIndex(mediaAttachments.indexOf(att));
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

                      {/* Reactions Display */}
                      {msg.reactions && msg.reactions.length > 0 && (
                        <div className="flex flex-wrap gap-1 mt-2">
                          {msg.reactions.map((reaction, idx) => {
                            const userReacted = reaction.users?.includes(String(currentUserId));
                            return (
                              <button
                                key={idx}
                                onClick={() => handleReaction(msg.messageId, reaction.emoji)}
                                className={`flex items-center gap-1 px-2 py-0.5 rounded-full text-xs transition-all ${
                                  userReacted
                                    ? "bg-blue-500/30 border border-blue-400"
                                    : "bg-gray-700/50 hover:bg-gray-700"
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

                      <div className="flex items-center justify-between mt-1">
                        <span className="text-[10px] text-gray-400">
                          {new Date(msg.timestamp).toLocaleTimeString([], {
                            hour: "2-digit",
                            minute: "2-digit",
                          })}
                        </span>
                        <div className="flex items-center gap-1 relative">
                          <button
                            onClick={() => handleReply(msg)}
                            className="p-1 rounded hover:bg-white/10 transition-colors"
                            title="Reply to message"
                          >
                            <ReplyIcon className="w-3 h-3 text-gray-400 hover:text-purple-400" />
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
                            onClick={() =>
                              setShowEmojiPicker(
                                showEmojiPicker === msg.messageId ? null : msg.messageId
                              )
                            }
                            className="p-1 rounded hover:bg-white/10 transition-colors"
                            title="Add reaction"
                          >
                            <Smile className="w-3 h-3 text-gray-400 hover:text-yellow-400" />
                          </button>

                          {/* Emoji Picker Popup */}
                          {showEmojiPicker === msg.messageId && (
                            <div
                              ref={emojiPickerRef}
                              className={`absolute ${isSelf ? 'right-0' : 'left-0'} bottom-full mb-1 p-2 bg-gray-800 border border-gray-600 rounded-lg shadow-xl z-50`}
                            >
                              <div className="flex gap-1">
                                {commonEmojis.map((emoji, emojiIdx) => (
                                  <button
                                    key={emojiIdx}
                                    onClick={(e) => {
                                      e.stopPropagation();
                                      handleReaction(msg.messageId, emoji);
                                    }}
                                    className="p-1 hover:bg-gray-700 rounded text-lg transition-transform hover:scale-125"
                                    title={`React with ${emoji}`}
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
          })
        )}
        <div ref={chatEndRef} />
      </div>

      {/* Reply Preview Bar */}
      {replyingTo && (
        <div className="bg-gray-800 border-t border-gray-700 px-4 py-2 flex justify-between items-start gap-2 overflow-hidden">
          <div className="text-sm text-gray-300 flex-1 min-w-0 overflow-hidden">
            <div className="flex items-center gap-2 text-sm text-blue-400 mb-1">
              <ReplyIcon className="w-3 h-3 flex-shrink-0" />
              <span className="font-medium truncate">Replying to {getSenderName(replyingTo.senderId)}</span>
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

      {/* File Preview */}
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
                <span className="text-gray-300 truncate max-w-[150px]">{file.name}</span>
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

      {/* Formatting Toolbar */}
      {showFormatting && (
        <div className="bg-gray-800 border-t border-gray-700 px-4 py-2">
          <div className="flex flex-wrap gap-2">
            <button
              onClick={formatBold}
              className="px-3 py-1.5 bg-gray-700 hover:bg-gray-600 rounded text-xs font-bold transition-colors"
              title="Bold (Ctrl+B)"
            >
              B
            </button>
            <button
              onClick={formatItalic}
              className="px-3 py-1.5 bg-gray-700 hover:bg-gray-600 rounded text-xs italic transition-colors"
              title="Italic (Ctrl+I)"
            >
              I
            </button>
            <button
              onClick={formatStrikethrough}
              className="px-3 py-1.5 bg-gray-700 hover:bg-gray-600 rounded text-xs line-through transition-colors"
              title="Strikethrough (Ctrl+U)"
            >
              S
            </button>
            <button
              onClick={formatCode}
              className="px-3 py-1.5 bg-gray-700 hover:bg-gray-600 rounded text-xs font-mono transition-colors"
              title="Code (Ctrl+E)"
            >
              &lt;/&gt;
            </button>
            <button
              onClick={formatHeading}
              className="px-3 py-1.5 bg-gray-700 hover:bg-gray-600 rounded text-xs font-bold transition-colors"
              title="Heading (Ctrl+D)"
            >
              H1
            </button>
            <button
              onClick={formatBullet}
              className="px-3 py-1.5 bg-gray-700 hover:bg-gray-600 rounded text-xs transition-colors"
              title="Bullet List (Ctrl+L)"
            >
              • List
            </button>
            <button
              onClick={formatNumbered}
              className="px-3 py-1.5 bg-gray-700 hover:bg-gray-600 rounded text-xs transition-colors"
              title="Numbered List (Ctrl+Shift+L)"
            >
              1. List
            </button>
          </div>
          <div className="mt-2 text-xs text-gray-400 space-y-1">
            <p>
              <strong>Keyboard Shortcuts:</strong> Ctrl+B (Bold) • Ctrl+I (Italic) • Ctrl+U (Strike) • Ctrl+E/K (Code) • Ctrl+D (Heading) • Ctrl+L (Bullet) • Ctrl+Shift+L (Numbered)
            </p>
            <p>
              <strong>Markdown:</strong> **bold** *italic* ~~strikethrough~~ `code` ## Heading - Bullet 1. Numbered
            </p>
          </div>
        </div>
      )}

      {/* Quick Replies */}
      {quickReplies.length > 0 && input.length === 0 && (
        <div className="bg-gray-800 border-t border-gray-700 px-4 py-2">
          <div className="flex items-center gap-2 mb-2">
            <Zap className="w-4 h-4 text-yellow-400" />
            <span className="text-xs text-gray-400">Quick Replies:</span>
          </div>
          <div className="flex flex-wrap gap-2">
            {quickReplies.map((reply, idx) => (
              <button
                key={idx}
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

      {/* Input Area */}
      <div className="sticky bottom-0 bg-gray-800 border-t border-gray-700 relative">
        {/* Suggestions Dropdown */}
        {showSuggestions && suggestions.length > 0 && (
          <div
            ref={suggestionsRef}
            className="absolute bottom-full left-0 right-0 bg-gray-900 border-t border-l border-r border-gray-600 shadow-2xl max-h-64 overflow-y-auto"
          >
            <div className="p-2 border-b border-gray-700 flex items-center gap-2">
              <Sparkles className="w-4 h-4 text-blue-400" />
              <span className="text-xs text-gray-400">
                Suggestions ({suggestions.length}) • <kbd className="px-1 py-0.5 bg-gray-700 rounded text-[10px]">↑↓</kbd> to navigate • <kbd className="px-1 py-0.5 bg-gray-700 rounded text-[10px]">Tab</kbd> or <kbd className="px-1 py-0.5 bg-gray-700 rounded text-[10px]">Enter</kbd> to select
              </span>
            </div>
            {suggestions.map((suggestion, idx) => (
              <button
                key={idx}
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
                      <FileIcon className="w-3 h-3 text-blue-400" />
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
            onChange={(e) => {
              setInput(e.target.value);
              // Auto-scroll to bottom when typing
              chatEndRef.current?.scrollIntoView({ behavior: "smooth" });
            }}
            onFocus={() => {
              // Scroll to bottom when focused
              chatEndRef.current?.scrollIntoView({ behavior: "smooth" });
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
            placeholder="Type a message... (Ctrl+B for bold, Ctrl+I for italic)"
            className="flex-1 px-4 py-2 rounded-lg bg-gray-700 text-gray-100 border border-gray-600 focus:outline-none focus:ring-2 focus:ring-blue-500 resize-none overflow-y-auto"
            rows="2"
            style={{ maxHeight: "150px" }}
          />
          <button
            onClick={handleSendMessage}
            disabled={!input.trim() && selectedFiles.length === 0}
            className="px-4 py-2 rounded-lg bg-blue-600 hover:bg-blue-500 text-white font-medium shadow-md hover:shadow-lg transition flex-shrink-0 disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
          >
            <Send className="w-4 h-4" />
            <span>Send</span>
          </button>
        </div>
        <p className="text-xs text-gray-500 px-2 pb-2">
          Max 5 files • Supports formatting: **bold** *italic* `code` ## heading - lists
        </p>
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
    </div>
  );
};

export default ChatWindow;
