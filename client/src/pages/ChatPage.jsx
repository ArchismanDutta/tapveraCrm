import React, { useState, useEffect } from "react";
import CreateGroupModal from "../components/chat/CreateGroupModal";
import ChatWindow from "../components/chat/ChatWindow";
import useChatWebSocket from "../hooks/useChatWebSocket";
import Sidebar from "../components/dashboard/Sidebar";

const ChatPage = ({ onLogout }) => {
  const [collapsed, setCollapsed] = useState(false);

  const [userRole, setUserRole] = useState(null);
  const [jwtToken, setJwtToken] = useState(null);
  const [conversations, setConversations] = useState([]);
  const [selectedConversation, setSelectedConversation] = useState(null);
  const { messages: liveMessages, sendMessage } = useChatWebSocket(
    jwtToken,
    selectedConversation?._id
  );

  const [showCreateGroup, setShowCreateGroup] = useState(false);
  const [initialMessages, setInitialMessages] = useState([]);

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
          `http://localhost:5000/api/chat/messages/${selectedConversation._id}`,
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

  const combinedMessages = [
    ...initialMessages,
    ...liveMessages.filter(
      (msg) => !initialMessages.find((m) => m._id === msg._id)
    ),
  ];

  const fetchConversations = async (token) => {
    try {
      const res = await fetch("http://localhost:5000/api/chat/groups", {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (!res.ok) throw new Error("Failed to fetch conversations");
      const data = await res.json();
      setConversations(data);
      if (data.length > 0) setSelectedConversation(data[0]);
    } catch (error) {
      console.error(error);
    }
  };

  const handleCreateGroup = async (name, memberIds) => {
    try {
      const res = await fetch("http://localhost:5000/api/chat/groups", {
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
              {conversations.map((conv) => (
                <li
                  key={conv._id}
                  className={`cursor-pointer px-3 py-2 rounded transition-colors ${
                    selectedConversation?._id === conv._id
                      ? "bg-gray-700 text-white"
                      : "hover:bg-gray-600"
                  }`}
                  onClick={() => setSelectedConversation(conv)}
                >
                  {conv.name || "Unnamed Group"}
                </li>
              ))}
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
                {selectedConversation.members && (
                  <div className="text-sm text-gray-400">
                    Members:{" "}
                    {selectedConversation.members
                      .map((m) => m.name || m._id)
                      .join(", ")}
                  </div>
                )}
              </div>
              {/* Messages - scrollable */}
              <div className="flex-1 overflow-y-auto p-4">
                <ChatWindow
                  messages={combinedMessages}
                  sendMessage={sendMessage}
                  conversationId={selectedConversation._id}
                  currentUserId={JSON.parse(localStorage.getItem("user"))?.id}
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
