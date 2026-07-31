import React, { useState, useEffect, useRef } from "react";
import { Send, X, User, Clock, CheckCheck } from "lucide-react";
import { toast } from "react-toastify";
import API from "../../api";
import { useWebSocketContext } from "../../contexts/WebSocketContext";

const RequestChatModal = ({ request: initialRequest, onClose }) => {
  const [request, setRequest] = useState(initialRequest);
  const [messages, setMessages] = useState(initialRequest.messages || []);
  const [newMessage, setNewMessage] = useState("");
  const [sending, setSending] = useState(false);
  const messagesEndRef = useRef(null);
  const { socket } = useWebSocketContext();

  // Scroll to bottom when messages change
  useEffect(() => {
    scrollToBottom();
  }, [messages]);

  // Join request room for real-time updates
  useEffect(() => {
    if (!socket || !request._id) return;

    // Join the request room
    socket.emit("join-request", request._id);

    // Listen for new messages
    const handleNewMessage = (data) => {
      if (data.requestId === request._id) {
        setMessages((prev) => [...prev, data.message]);
      }
    };

    // Listen for status updates
    const handleRequestUpdate = (data) => {
      if (data.requestId === request._id) {
        setRequest((prev) => ({ ...prev, ...data }));
      }
    };

    socket.on("request-message", handleNewMessage);
    socket.on("request-update", handleRequestUpdate);

    // Mark messages as read
    markAsRead();

    return () => {
      socket.emit("leave-request", request._id);
      socket.off("request-message", handleNewMessage);
      socket.off("request-update", handleRequestUpdate);
    };
  }, [socket, request._id]);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  };

  const markAsRead = async () => {
    try {
      await API.put(`/api/client-requests/${request._id}/read`);
    } catch (error) {
      console.error("Error marking messages as read:", error);
    }
  };

  const handleSendMessage = async (e) => {
    e.preventDefault();

    if (!newMessage.trim()) return;

    setSending(true);
    try {
      const response = await API.post(`/api/client-requests/${request._id}/messages`, {
        message: newMessage.trim(),
      });

      // Update local state with the new request data (includes the new message)
      setRequest(response.data.data);
      setMessages(response.data.data.messages);
      setNewMessage("");

      // Emit via socket for real-time update to client
      if (socket) {
        socket.emit("send-request-message", {
          requestId: request._id,
          message: response.data.data.messages[response.data.data.messages.length - 1],
        });
      }
    } catch (error) {
      console.error("Error sending message:", error);
      toast.error("Failed to send message");
    } finally {
      setSending(false);
    }
  };

  const formatTime = (timestamp) => {
    const date = new Date(timestamp);
    return date.toLocaleTimeString("en-US", {
      hour: "2-digit",
      minute: "2-digit",
    });
  };

  const formatDate = (timestamp) => {
    const date = new Date(timestamp);
    const today = new Date();
    const yesterday = new Date(today);
    yesterday.setDate(yesterday.getDate() - 1);

    if (date.toDateString() === today.toDateString()) {
      return "Today";
    } else if (date.toDateString() === yesterday.toDateString()) {
      return "Yesterday";
    } else {
      return date.toLocaleDateString("en-US", {
        month: "short",
        day: "numeric",
        year: date.getFullYear() !== today.getFullYear() ? "numeric" : undefined,
      });
    }
  };

  // Group messages by date
  const groupedMessages = messages.reduce((groups, message) => {
    const date = formatDate(message.timestamp);
    if (!groups[date]) {
      groups[date] = [];
    }
    groups[date].push(message);
    return groups;
  }, {});

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-sm p-4">
      <div className="bg-white dark:bg-[#1a1f2e] rounded-xl shadow-2xl border border-gray-200 dark:border-gray-700 w-full max-w-4xl h-[85vh] flex flex-col">
        {/* Header */}
        <div className="flex items-center justify-between p-4 border-b border-gray-200 dark:border-gray-700 bg-gradient-to-r from-blue-600/10 to-purple-600/10">
          <div className="flex-1 min-w-0">
            <h2 className="text-xl font-bold text-gray-900 dark:text-white truncate">
              {request.title}
            </h2>
            <div className="flex items-center gap-3 mt-1">
              <span className="text-sm text-gray-600 dark:text-gray-400">
                {request.client?.clientName || request.client?.businessName}
              </span>
              <span className="text-xs text-gray-500 dark:text-gray-500">•</span>
              <span
                className={`px-2 py-0.5 rounded-full text-xs font-medium ${
                  request.type === "quote"
                    ? "bg-green-600/20 text-green-400"
                    : "bg-orange-600/20 text-orange-400"
                }`}
              >
                {request.type === "quote" ? "Quote Request" : "Support Ticket"}
              </span>
              {request.type === "support" && (
                <>
                  <span className="text-xs text-gray-500 dark:text-gray-500">•</span>
                  <span
                    className={`px-2 py-0.5 rounded-full text-xs font-medium ${
                      request.priority === "urgent"
                        ? "bg-red-600/20 text-red-400"
                        : request.priority === "high"
                        ? "bg-orange-600/20 text-orange-400"
                        : "bg-yellow-600/20 text-yellow-400"
                    }`}
                  >
                    {request.priority} priority
                  </span>
                </>
              )}
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-2 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-lg transition-colors ml-4"
          >
            <X className="w-5 h-5 text-gray-600 dark:text-gray-400" />
          </button>
        </div>

        {/* Request Details */}
        <div className="p-4 bg-gray-50 dark:bg-[#0f1419] border-b border-gray-200 dark:border-gray-700">
          <p className="text-sm text-gray-700 dark:text-gray-300 mb-2">
            <span className="font-semibold">Description:</span> {request.description}
          </p>

          {request.type === "quote" && (
            <div className="grid grid-cols-3 gap-4 mt-3">
              {request.projectType && (
                <div>
                  <p className="text-xs text-gray-500 dark:text-gray-500">Project Type</p>
                  <p className="text-sm font-medium text-gray-900 dark:text-white">
                    {request.projectType}
                  </p>
                </div>
              )}
              {request.budget && (
                <div>
                  <p className="text-xs text-gray-500 dark:text-gray-500">Budget</p>
                  <p className="text-sm font-medium text-gray-900 dark:text-white">
                    {request.budget} {request.currency ? `(${request.currency})` : ''}
                  </p>
                </div>
              )}
              {request.timeline && (
                <div>
                  <p className="text-xs text-gray-500 dark:text-gray-500">Timeline</p>
                  <p className="text-sm font-medium text-gray-900 dark:text-white">
                    {request.timeline}
                  </p>
                </div>
              )}
            </div>
          )}

          {request.type === "support" && request.category && (
            <div className="mt-2">
              <span className="text-xs text-gray-500 dark:text-gray-500">Category: </span>
              <span className="text-sm font-medium text-gray-900 dark:text-white">
                {request.category}
              </span>
            </div>
          )}
        </div>

        {/* Messages */}
        <div className="flex-1 overflow-y-auto p-4 space-y-4 bg-gray-50 dark:bg-[#0a0f16]">
          {Object.keys(groupedMessages).length === 0 ? (
            <div className="flex flex-col items-center justify-center h-full text-gray-400">
              <User className="w-12 h-12 mb-2" />
              <p>No messages yet. Start the conversation!</p>
            </div>
          ) : (
            Object.entries(groupedMessages).map(([date, msgs]) => (
              <div key={date}>
                {/* Date Separator */}
                <div className="flex items-center justify-center my-4">
                  <div className="h-px bg-gray-300 dark:bg-gray-600 flex-1"></div>
                  <span className="px-3 text-xs text-gray-500 dark:text-gray-400">
                    {date}
                  </span>
                  <div className="h-px bg-gray-300 dark:bg-gray-600 flex-1"></div>
                </div>

                {/* Messages for this date */}
                {msgs.map((message, index) => {
                  const isAdmin = message.senderModel === "User";
                  return (
                    <div
                      key={index}
                      className={`flex ${isAdmin ? "justify-end" : "justify-start"} mb-3`}
                    >
                      <div
                        className={`max-w-[70%] ${
                          isAdmin
                            ? "bg-blue-600 text-white"
                            : "bg-white dark:bg-[#1a1f2e] text-gray-900 dark:text-white border border-gray-200 dark:border-gray-700"
                        } rounded-lg p-3 shadow-sm`}
                      >
                        <div className="flex items-center gap-2 mb-1">
                          <span
                            className={`text-xs font-semibold ${
                              isAdmin ? "text-blue-200" : "text-gray-600 dark:text-gray-400"
                            }`}
                          >
                            {message.senderName}
                          </span>
                          <span
                            className={`text-xs ${
                              isAdmin ? "text-blue-200" : "text-gray-500 dark:text-gray-500"
                            }`}
                          >
                            •
                          </span>
                          <span
                            className={`text-xs ${
                              isAdmin ? "text-blue-200" : "text-gray-500 dark:text-gray-500"
                            }`}
                          >
                            {formatTime(message.timestamp)}
                          </span>
                        </div>
                        <p className="text-sm whitespace-pre-wrap break-words">
                          {message.message}
                        </p>
                        {isAdmin && (
                          <div className="flex items-center justify-end gap-1 mt-1">
                            {message.read ? (
                              <CheckCheck className="w-3 h-3 text-blue-200" />
                            ) : (
                              <CheckCheck className="w-3 h-3 text-blue-300/50" />
                            )}
                          </div>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            ))
          )}
          <div ref={messagesEndRef} />
        </div>

        {/* Message Input */}
        <form
          onSubmit={handleSendMessage}
          className="p-4 bg-white dark:bg-[#1a1f2e] border-t border-gray-200 dark:border-gray-700"
        >
          <div className="flex gap-2">
            <textarea
              value={newMessage}
              onChange={(e) => setNewMessage(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter" && !e.shiftKey) {
                  e.preventDefault();
                  handleSendMessage(e);
                }
              }}
              placeholder="Type your message... (Shift+Enter for new line)"
              rows={2}
              className="flex-1 px-4 py-2 bg-gray-50 dark:bg-[#0f1419] border border-gray-300 dark:border-gray-600 rounded-lg text-gray-900 dark:text-white placeholder-gray-500 focus:outline-none focus:border-blue-500 resize-none"
            />
            <button
              type="submit"
              disabled={sending || !newMessage.trim()}
              className="px-6 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
            >
              {sending ? (
                <div className="w-4 h-4 border-2 border-white/20 border-t-white rounded-full animate-spin" />
              ) : (
                <>
                  <Send className="w-4 h-4" />
                  Send
                </>
              )}
            </button>
          </div>
          <p className="text-xs text-gray-500 dark:text-gray-500 mt-2">
            Press Enter to send, Shift+Enter for new line
          </p>
        </form>
      </div>
    </div>
  );
};

export default RequestChatModal;
