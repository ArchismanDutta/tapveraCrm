import React, { useState, useEffect, useMemo } from "react";
import { useLocation } from "react-router-dom";
import CreateGroupModal from "../components/chat/CreateGroupModal";
import ManageGroupModal from "../components/chat/ManageGroupModal";
import ChatWindow from "../components/chat/chatWindow";
import { useWebSocketContext } from "../contexts/WebSocketContext";
import Sidebar from "../components/dashboard/Sidebar";
import { Search, Filter, X, SortAsc, Users, Settings } from "lucide-react";

// Custom hook for debouncing
const useDebounce = (value, delay) => {
  const [debouncedValue, setDebouncedValue] = useState(value);

  useEffect(() => {
    const handler = setTimeout(() => {
      setDebouncedValue(value);
    }, delay);

    return () => {
      clearTimeout(handler);
    };
  }, [value, delay]);

  return debouncedValue;
};

const ChatPage = ({ onLogout }) => {
  const location = useLocation();
  const [collapsed, setCollapsed] = useState(false);
  const [userRole, setUserRole] = useState(null);
  const [jwtToken, setJwtToken] = useState(null);
  const [conversations, setConversations] = useState([]);
  const [selectedConversation, setSelectedConversation] = useState(null);
  const [showCreateGroup, setShowCreateGroup] = useState(false);
  const [showManageGroup, setShowManageGroup] = useState(false);
  const [initialMessages, setInitialMessages] = useState([]);

  // New state for tracking unread messages
  const [unreadMessages, setUnreadMessages] = useState({}); // { conversationId: count }

  // Search and filter state
  const [searchTerm, setSearchTerm] = useState("");
  const [filterType, setFilterType] = useState("all"); // all, unread, read
  const [sortBy, setSortBy] = useState("recent"); // recent, alphabetical, unread
  const [showFilters, setShowFilters] = useState(false);

  // Debounced search term
  const debouncedSearchTerm = useDebounce(searchTerm, 300);

  // Use WebSocket context
  const {
    chatMessages: liveMessages,
    allChatMessages: allMessages,
    sendMessage,
    setActiveConversation,
    setConversations: updateWebSocketConversations,
  } = useWebSocketContext();

  const API_BASE = import.meta.env.VITE_API_BASE || "http://localhost:5000";
  const currentUserId = JSON.parse(localStorage.getItem("user"))?._id;

  useEffect(() => {
    const storedUser = localStorage.getItem("user");
    const storedRole = localStorage.getItem("role");
    const storedToken = localStorage.getItem("token");

    if (storedUser && storedRole && storedToken) {
      setUserRole(storedRole);
      setJwtToken(storedToken);
      fetchConversations(storedToken);
    }
  }, []);

  useEffect(() => {
    if (!selectedConversation || !jwtToken) return;

    const fetchMessages = async () => {
      try {
        const res = await fetch(
          `${API_BASE}/api/chat/messages/${selectedConversation._id}`,
          {
            headers: { Authorization: `Bearer ${jwtToken}` },
          }
        );
        if (!res.ok) throw new Error("Failed to fetch messages");
        const data = await res.json();
        setInitialMessages(data);
      } catch (error) {
        console.error(error);
      }
    };

    fetchMessages();
  }, [selectedConversation, jwtToken]);

  // Listen for global unread map updates and initialize from storage
  useEffect(() => {
    const onMap = (e) => {
      const incoming = e.detail?.map || {};
      setUnreadMessages(incoming);
    };
    window.addEventListener("chat-unread-map", onMap);
    try {
      const raw = sessionStorage.getItem("chat_unread_map");
      if (raw) setUnreadMessages(JSON.parse(raw));
    } catch {}
    return () => window.removeEventListener("chat-unread-map", onMap);
  }, []);

  // Track new live messages for unread counts
  useEffect(() => {
    // Only proceed if we have allMessages (from updated WebSocket hook)
    if (allMessages && allMessages.length > 0) {
      // Get the latest message
      const latestMessage = allMessages[allMessages.length - 1];
      const messageFromCurrentUser =
        String(latestMessage.senderId || latestMessage.sender?._id) ===
        String(currentUserId);
      const isSelectedConversation =
        selectedConversation?._id === latestMessage.conversationId;

      // Don't count messages from current user or messages in currently selected conversation
      if (!messageFromCurrentUser && !isSelectedConversation) {
        setUnreadMessages((prev) => ({
          ...prev,
          [latestMessage.conversationId]:
            (prev[latestMessage.conversationId] || 0) + 1,
        }));
      }

      // Persist total and map in sessionStorage for Sidebar on route changes
      try {
        sessionStorage.setItem("chat_unread_map", JSON.stringify(unreadMessages));
        const total = Object.values(unreadMessages).reduce((a, b) => a + Number(b || 0), 0);
        sessionStorage.setItem("chat_unread_total", String(total));
        window.dispatchEvent(new CustomEvent("chat-unread-total", { detail: { total } }));
        window.dispatchEvent(new CustomEvent("chat-unread-map", { detail: { map: unreadMessages } }));
      } catch {}
    } else if (liveMessages && liveMessages.length > 0) {
      // Fallback: use liveMessages for basic unread tracking if allMessages isn't available
      const latestMessage = liveMessages[liveMessages.length - 1];
      const messageFromCurrentUser =
        String(latestMessage.senderId || latestMessage.sender?._id) ===
        String(currentUserId);

      // For messages in non-selected conversations, increment unread count
      if (
        !messageFromCurrentUser &&
        latestMessage.conversationId &&
        latestMessage.conversationId !== selectedConversation?._id
      ) {
        setUnreadMessages((prev) => ({
          ...prev,
          [latestMessage.conversationId]:
            (prev[latestMessage.conversationId] || 0) + 1,
        }));
      }

      try {
        sessionStorage.setItem("chat_unread_map", JSON.stringify(unreadMessages));
        const total = Object.values(unreadMessages).reduce((a, b) => a + Number(b || 0), 0);
        sessionStorage.setItem("chat_unread_total", String(total));
        window.dispatchEvent(new CustomEvent("chat-unread-total", { detail: { total } }));
        window.dispatchEvent(new CustomEvent("chat-unread-map", { detail: { map: unreadMessages } }));
      } catch {}
    }
  }, [allMessages, liveMessages, selectedConversation, currentUserId]);

  // Broadcast total unread count for sidebar badge
  useEffect(() => {
    const total = Object.values(unreadMessages).reduce((a, b) => a + Number(b || 0), 0);
    try {
      sessionStorage.setItem("chat_unread_total", String(total));
      sessionStorage.setItem("chat_unread_map", JSON.stringify(unreadMessages));
    } catch {}
    window.dispatchEvent(
      new CustomEvent("chat-unread-total", { detail: { total } })
    );
    window.dispatchEvent(
      new CustomEvent("chat-unread-map", { detail: { map: unreadMessages } })
    );
  }, [unreadMessages]);

  // Merge messages from initial fetch, live WS, and any optimistic ones from the hook (in allMessages)
  const combinedMessages = React.useMemo(() => {
    const map = new Map();
    const put = (m) => map.set(String(m._id || m.messageId || `${m.senderId}-${m.timestamp}`), m);
    initialMessages.forEach(put);
    (allMessages || []).forEach(put);
    (liveMessages || []).forEach(put);
    return Array.from(map.values()).sort((a, b) => new Date(a.timestamp) - new Date(b.timestamp));
  }, [initialMessages, allMessages, liveMessages]);

  const fetchConversations = async (token) => {
    try {
      const res = await fetch(`${API_BASE}/api/chat/groups`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (!res.ok) throw new Error("Failed to fetch conversations");
      const data = await res.json();
      setConversations(data);
      // Update WebSocket context with conversations
      updateWebSocketConversations(data);
      // After conversations load, broadcast a fresh unread map event so list can render badges
      try {
        const raw = sessionStorage.getItem("chat_unread_map");
        const map = raw ? JSON.parse(raw) : {};
        window.dispatchEvent(new CustomEvent("chat-unread-map", { detail: { map } }));
      } catch {}
    } catch (error) {
      console.error(error);
    }
  };

  // Auto-open conversation from notification navigation
  useEffect(() => {
    if (location.state?.openConversationId && conversations.length > 0) {
      const targetConversation = conversations.find(
        conv => conv._id === location.state.openConversationId
      );

      if (targetConversation) {
        setSelectedConversation(targetConversation);
        setActiveConversation(targetConversation._id);

        // Clear the conversation's unread count
        setUnreadMessages(prev => {
          const updated = { ...prev };
          delete updated[targetConversation._id];
          return updated;
        });

        // Mark messages as read
        if (jwtToken) {
          fetch(`${API_BASE}/api/chat/${targetConversation._id}/mark-read`, {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              Authorization: `Bearer ${jwtToken}`,
            },
            body: JSON.stringify({ userId: currentUserId }),
          }).catch(err => console.error('Failed to mark messages as read:', err));
        }

        // Clear navigation state
        window.history.replaceState({}, document.title);
      }
    }
  }, [location.state, conversations, jwtToken, currentUserId]);

  const handleCreateGroup = async (name, memberIds) => {
    try {
      const res = await fetch(`${API_BASE}/api/chat/groups`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${jwtToken}`,
        },
        body: JSON.stringify({ name, memberIds }),
      });
      if (!res.ok) throw new Error("Failed to create group");
      const newGroup = await res.json();
      const updatedConversations = [newGroup, ...conversations];
      setConversations(updatedConversations);
      // Update WebSocket context with new conversations
      updateWebSocketConversations(updatedConversations);
      setShowCreateGroup(false);
    } catch (error) {
      alert(error.message);
    }
  };

  const handleDeleteConversation = async (conversationId) => {
    if (!window.confirm("Are you sure you want to delete this conversation?"))
      return;

    try {
      const res = await fetch(
        `${API_BASE}/api/chat/conversations/${conversationId}`,
        {
          method: "DELETE",
          headers: { Authorization: `Bearer ${jwtToken}` },
        }
      );

      if (!res.ok) {
        const errorData = await res.json();
        throw new Error(errorData.error || "Failed to delete conversation");
      }

      // Remove deleted conversation from list
      const updatedConversations = conversations.filter((conv) => conv._id !== conversationId);
      setConversations(updatedConversations);
      // Update WebSocket context
      updateWebSocketConversations(updatedConversations);

      // Clear selected conversation if deleted
      if (selectedConversation?._id === conversationId) {
        setSelectedConversation(null);
        setActiveConversation(null);
        setInitialMessages([]);
      }

      // Clean up unread messages tracking
      setUnreadMessages((prev) => {
        const updated = { ...prev };
        delete updated[conversationId];
        return updated;
      });

      alert("Conversation deleted successfully");
    } catch (error) {
      alert(error.message);
    }
  };

  // Handle conversation selection and clear unread count
  const handleSelectConversation = (conv) => {
    setSelectedConversation(conv);
    // Update WebSocket context with active conversation
    setActiveConversation(conv._id);

    // Clear unread count for selected conversation
    setUnreadMessages((prev) => {
      const updated = { ...prev };
      delete updated[conv._id];
      return updated;
    });

    // Notify global hook about active conversation (to avoid counting those messages)
    window.dispatchEvent(
      new CustomEvent("chat-active-conversation", { detail: { conversationId: conv._id } })
    );
  };

  // Get unread count for a conversation
  const getUnreadCount = (conversationId) => {
    return unreadMessages[conversationId] || 0;
  };

  // Filter and sort conversations
  const filteredAndSortedConversations = useMemo(() => {
    let filtered = [...conversations];

    // Apply search filter
    if (debouncedSearchTerm) {
      filtered = filtered.filter((conv) => {
        const searchLower = debouncedSearchTerm.toLowerCase();

        // Search by conversation name
        const nameMatch = (conv.name || "").toLowerCase().includes(searchLower);

        // Search by member names
        const memberMatch = conv.members?.some((member) =>
          (member.name || "").toLowerCase().includes(searchLower)
        );

        return nameMatch || memberMatch;
      });
    }

    // Apply unread/read filter
    if (filterType === "unread") {
      filtered = filtered.filter((conv) => getUnreadCount(conv._id) > 0);
    } else if (filterType === "read") {
      filtered = filtered.filter((conv) => getUnreadCount(conv._id) === 0);
    }

    // Apply sorting
    filtered.sort((a, b) => {
      switch (sortBy) {
        case "alphabetical":
          return (a.name || "").localeCompare(b.name || "");
        case "unread":
          return getUnreadCount(b._id) - getUnreadCount(a._id);
        case "recent":
        default:
          // Sort by last message time (you may need to add this field)
          // For now, keep original order
          return 0;
      }
    });

    return filtered;
  }, [conversations, debouncedSearchTerm, filterType, sortBy, unreadMessages]);

  return (
    <div className="flex h-screen bg-[#101525] text-gray-100">
      {/* Shared Sidebar (same as AttendancePage) */}
      <Sidebar
        onLogout={onLogout}
        collapsed={collapsed}
        setCollapsed={setCollapsed}
        userRole={userRole || "employee"}
      />

      {/* Main Chat Area */}
      <main
        className={`flex-1 flex transition-all duration-300 h-screen ${
          collapsed ? "ml-20" : "ml-72"
        }`}
      >
        {/* Conversations Panel */}
        <div className="w-1/4 border-r border-gray-700 bg-gray-800 flex flex-col h-full ">
          {/* Header with title and filter button */}
          <div className="p-4 pb-3 border-b border-gray-700">
            <div className="flex items-center justify-between mb-3">
              <h3 className="text-lg font-bold text-white">Conversations</h3>
              <button
                onClick={() => setShowFilters(!showFilters)}
                className={`p-2 rounded-lg transition-colors ${
                  showFilters
                    ? "bg-blue-600 text-white"
                    : "bg-gray-700 text-gray-400 hover:bg-gray-600"
                }`}
                title="Toggle filters"
              >
                <Filter className="w-4 h-4" />
              </button>
            </div>

            {/* Search Bar */}
            <div className="relative">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 w-4 h-4 text-gray-400" />
              <input
                type="text"
                placeholder="Search conversations or members..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="w-full pl-10 pr-10 py-2 bg-gray-900 border border-gray-600 rounded-lg text-white text-sm placeholder-gray-500 focus:outline-none focus:border-blue-500 transition-colors"
              />
              {searchTerm && (
                <button
                  onClick={() => setSearchTerm("")}
                  className="absolute right-3 top-1/2 transform -translate-y-1/2 text-gray-400 hover:text-white transition-colors"
                >
                  <X className="w-4 h-4" />
                </button>
              )}
            </div>

            {/* Filter and Sort Options */}
            {showFilters && (
              <div className="mt-3 space-y-2 p-3 bg-gray-900 rounded-lg border border-gray-600">
                {/* Filter Tabs */}
                <div>
                  <label className="text-xs text-gray-400 mb-1.5 block">Filter</label>
                  <div className="flex gap-2">
                    {["all", "unread", "read"].map((type) => (
                      <button
                        key={type}
                        onClick={() => setFilterType(type)}
                        className={`flex-1 px-3 py-1.5 rounded text-xs font-medium transition-all ${
                          filterType === type
                            ? "bg-blue-600 text-white"
                            : "bg-gray-700 text-gray-300 hover:bg-gray-600"
                        }`}
                      >
                        {type === "all"
                          ? `All (${conversations.length})`
                          : type === "unread"
                          ? `Unread (${
                              conversations.filter(
                                (c) => getUnreadCount(c._id) > 0
                              ).length
                            })`
                          : `Read (${
                              conversations.filter(
                                (c) => getUnreadCount(c._id) === 0
                              ).length
                            })`}
                      </button>
                    ))}
                  </div>
                </div>

                {/* Sort Options */}
                <div>
                  <label className="text-xs text-gray-400 mb-1.5 block flex items-center gap-1">
                    <SortAsc className="w-3 h-3" />
                    Sort By
                  </label>
                  <select
                    value={sortBy}
                    onChange={(e) => setSortBy(e.target.value)}
                    className="w-full px-3 py-1.5 bg-gray-700 border border-gray-600 rounded text-xs text-white focus:outline-none focus:border-blue-500 transition-colors"
                  >
                    <option value="recent">Most Recent</option>
                    <option value="alphabetical">Alphabetical</option>
                    <option value="unread">Most Unread</option>
                  </select>
                </div>

                {/* Active Filters Info */}
                {(searchTerm || filterType !== "all" || sortBy !== "recent") && (
                  <div className="pt-2 border-t border-gray-700">
                    <div className="flex items-center justify-between">
                      <span className="text-xs text-gray-400">
                        Showing {filteredAndSortedConversations.length} of{" "}
                        {conversations.length}
                      </span>
                      <button
                        onClick={() => {
                          setSearchTerm("");
                          setFilterType("all");
                          setSortBy("recent");
                        }}
                        className="text-xs text-blue-400 hover:text-blue-300 transition-colors"
                      >
                        Clear all
                      </button>
                    </div>
                  </div>
                )}
              </div>
            )}
          </div>

          {/* Conversations List */}
          <div className="flex-1 overflow-y-auto px-4 pb-2">
            {filteredAndSortedConversations.length === 0 ? (
              <div className="flex flex-col items-center justify-center h-full text-center px-4">
                <Users className="w-12 h-12 text-gray-600 mb-3" />
                <p className="text-sm text-gray-400 mb-1">
                  {searchTerm
                    ? "No conversations found"
                    : filterType === "unread"
                    ? "No unread conversations"
                    : "No conversations yet"}
                </p>
                {searchTerm && (
                  <button
                    onClick={() => setSearchTerm("")}
                    className="text-xs text-blue-400 hover:text-blue-300 mt-2"
                  >
                    Clear search
                  </button>
                )}
              </div>
            ) : (
              <ul className="list-none p-0 space-y-2 mt-2">
                {filteredAndSortedConversations.map((conv) => {
                const unreadCount = getUnreadCount(conv._id);
                const hasUnread = unreadCount > 0;

                return (
                  <li
                    key={conv._id}
                    className={`cursor-pointer px-3 py-2 rounded transition-colors relative ${
                      selectedConversation?._id === conv._id
                        ? "bg-gray-700 text-white"
                        : hasUnread
                        ? "bg-blue-900/30 border border-blue-500/50 hover:bg-blue-800/40"
                        : "hover:bg-gray-600"
                    }`}
                    onClick={() => handleSelectConversation(conv)}
                  >
                    <div className="flex justify-between items-center">
                      <span className={`${hasUnread ? "font-semibold" : ""}`}>
                        {conv.name || "Unnamed Group"}
                      </span>
                      {hasUnread && (
                        <span className="bg-blue-500 text-white text-xs rounded-full px-2 py-1 min-w-[20px] text-center">
                          {unreadCount > 99 ? "99+" : unreadCount}
                        </span>
                      )}
                    </div>
                    {hasUnread && (
                      <div className="absolute left-0 top-1/2 transform -translate-y-1/2 w-1 h-8 bg-blue-500 rounded-r"></div>
                    )}
                  </li>
                );
              })}
            </ul>
            )}
          </div>
          {(userRole === "admin" || userRole === "super-admin") && (
            <div className="p-4 pt-0">
              <button
                onClick={() => setShowCreateGroup(true)}
                className="w-full bg-indigo-600 text-white px-3 py-2 rounded-lg hover:bg-indigo-700 transition-colors shadow-sm"
              >
                + New Group
              </button>
            </div>
          )}
        </div>

        {/* Chat Panel */}
        <div className="flex-1 flex flex-col h-full bg-gray-900">
          {selectedConversation ? (
            <>
              {/* Header */}
              <div className="flex justify-between items-center p-4 border-b border-gray-700 bg-gray-800">
                <h4 className="text-lg font-semibold text-white">
                  {selectedConversation.name || "Group Chat"}
                </h4>
                <div className="flex items-center gap-4">
                  {selectedConversation.members && (
                    <div className="text-sm text-gray-400">
                      Members:{" "}
                      {selectedConversation.members
                        .map((m) => m.name || m._id)
                        .join(", ")}
                    </div>
                  )}

                  {(userRole === "admin" || userRole === "super-admin") && (
                    <>
                      <button
                        title="Manage Group Members"
                        onClick={() => setShowManageGroup(true)}
                        className="flex items-center gap-2 px-3 py-1.5 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors text-sm font-medium"
                      >
                        <Settings className="w-4 h-4" />
                        Manage
                      </button>
                      <button
                        title="Delete Conversation"
                        onClick={() =>
                          handleDeleteConversation(selectedConversation._id)
                        }
                        className="text-red-500 hover:text-red-700 transition"
                      >
                        🗑️
                      </button>
                    </>
                  )}
                </div>
              </div>

              {/* Messages - scrollable */}
              <div className="flex-1 overflow-y-auto p-4">
                <ChatWindow
                  messages={combinedMessages}
                  sendMessage={sendMessage}
                  conversationId={selectedConversation._id}
                  currentUserId={currentUserId}
                  conversationMembers={selectedConversation.members || []}
                />
              </div>
            </>
          ) : (
            <div className="flex items-center justify-center flex-1 text-gray-500 text-center font-medium">
              Select a conversation to start chatting
            </div>
          )}
        </div>
      </main>

      {/* Create Group Modal */}
      <CreateGroupModal
        isOpen={showCreateGroup}
        onClose={() => setShowCreateGroup(false)}
        onCreate={handleCreateGroup}
        jwtToken={jwtToken}
      />

      {/* Manage Group Modal */}
      <ManageGroupModal
        isOpen={showManageGroup}
        onClose={() => setShowManageGroup(false)}
        conversation={selectedConversation}
        jwtToken={jwtToken}
        onGroupUpdated={() => {
          // Refresh conversations list
          const token = localStorage.getItem("token");
          fetchConversations(token);
        }}
      />
    </div>
  );
};

export default ChatPage;
