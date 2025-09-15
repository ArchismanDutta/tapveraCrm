import React, { useState, useEffect } from "react";
import CreateGroupModal from "../components/chat/CreateGroupModal";
import ChatWindow from "../components/chat/chatWindow";
import useChatWebSocket from "../hooks/useChatWebSocket";
import Sidebar from "../components/dashboard/Sidebar";

const ChatPage = ({ onLogout }) => {
  const [collapsed, setCollapsed] = useState(false);
  const [userRole, setUserRole] = useState(null);
  const [jwtToken, setJwtToken] = useState(null);
  const [conversations, setConversations] = useState([]);
  const [selectedConversation, setSelectedConversation] = useState(null);
  const [showCreateGroup, setShowCreateGroup] = useState(false);
  const [initialMessages, setInitialMessages] = useState([]);

  // New state for tracking unread messages
  const [unreadMessages, setUnreadMessages] = useState({}); // { conversationId: count }

  // Updated WebSocket hook call - make sure your hook supports these parameters
  const webSocketResult = useChatWebSocket(
    jwtToken,
    selectedConversation?._id,
    conversations // Pass conversations array if your updated hook supports it
  );

  // Destructure with fallback for backward compatibility
  const {
    messages: liveMessages,
    allMessages = [], // Default to empty array if not available
    sendMessage,
  } = webSocketResult;

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
      setConversations((prev) => [newGroup, ...prev]);
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
      setConversations((prev) =>
        prev.filter((conv) => conv._id !== conversationId)
      );

      // Clear selected conversation if deleted
      if (selectedConversation?._id === conversationId) {
        setSelectedConversation(null);
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
          <h3 className="text-lg font-bold p-4 pb-0 text-white">
            Conversations
          </h3>
          <div className="flex-1 overflow-y-auto px-4 pb-2">
            <ul className="list-none p-0 space-y-2">
              {conversations.map((conv) => {
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
                    <button
                      title="Delete Conversation"
                      onClick={() =>
                        handleDeleteConversation(selectedConversation._id)
                      }
                      className="text-red-500 hover:text-red-700 transition"
                    >
                      🗑️
                    </button>
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

      {/* Group Modal */}
      <CreateGroupModal
        isOpen={showCreateGroup}
        onClose={() => setShowCreateGroup(false)}
        onCreate={handleCreateGroup}
        jwtToken={jwtToken}
      />
    </div>
  );
};

export default ChatPage;
