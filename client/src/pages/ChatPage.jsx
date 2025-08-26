import React, { useEffect, useState, useRef } from "react";
import { useSelector, useDispatch } from "react-redux";
import Sidebar from "../components/dashboard/Sidebar";
import { motion } from "framer-motion";
import { Send, Smile, Paperclip, Circle } from "lucide-react";
import {
  setUsers,
  selectUser as selectUserAction,
  addMessages,
  addMessage,
  setTypingUser,
  removeTypingUser,
  clearNewMessages,
} from "../store/slices/chatSlice";

const ChatPage = ({ currentUser, onLogout }) => {
  const dispatch = useDispatch();
  const users = useSelector((state) => state.chat.users);
  const selectedUser = useSelector((state) => state.chat.selectedUser);
  const messagesByUser = useSelector((state) => state.chat.messagesByUser);
  const typingUsers = useSelector((state) => state.chat.typingUsers);
  const newMessagesByUser = useSelector(
    (state) => state.chat.newMessagesByUser
  );

  const [newMessage, setNewMessage] = useState("");
  const [searchTerm, setSearchTerm] = useState("");
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);
  const bottomRef = useRef(null);
  const ws = useRef(null);
  const userId = currentUser.id || currentUser._id;

  useEffect(() => {
    // Fetch all users once
    fetch("/api/users/all", {
      headers: { Authorization: `Bearer ${localStorage.getItem("token")}` },
    })
      .then((res) => res.json())
      .then((data) => dispatch(setUsers(data)));
  }, [dispatch]);

  useEffect(() => {
    ws.current = new WebSocket("ws://localhost:5000");

    ws.current.onopen = () => {
      ws.current.send(JSON.stringify({ type: "register", userId }));
    };

    ws.current.onmessage = (event) => {
      const data = JSON.parse(event.data);

      if (data.type === "private_message") {
        const chatPartnerId =
          data.senderId === userId ? data.recipientId : data.senderId;

        dispatch(addMessage({ userId: chatPartnerId, message: data }));
      }

      if (data.type === "typing") {
        dispatch(setTypingUser(data.userId));
        setTimeout(() => dispatch(removeTypingUser(data.userId)), 2000);
      }
    };

    return () => ws.current && ws.current.close();
  }, [userId, dispatch]);

  const selectUser = (user) => {
    dispatch(selectUserAction(user));
    dispatch(clearNewMessages(user._id));

    if (!messagesByUser[user._id]) {
      fetch(`/api/chat/${user._id}`, {
        headers: { Authorization: `Bearer ${localStorage.getItem("token")}` },
      })
        .then((res) => res.json())
        .then((msgs) =>
          dispatch(addMessages({ userId: user._id, messages: msgs }))
        );
    }
  };

  const sendMessage = () => {
    if (!newMessage.trim() || !ws.current || !selectedUser) return;

    const messageObj = {
      type: "private_message",
      senderId: userId,
      recipientId: selectedUser._id,
      message: newMessage,
      timestamp: new Date(),
    };

    ws.current.send(JSON.stringify(messageObj));
    dispatch(addMessage({ userId: selectedUser._id, message: messageObj }));
    setNewMessage("");
  };

  const handleTyping = () => {
    if (ws.current && selectedUser) {
      ws.current.send(
        JSON.stringify({
          type: "typing",
          userId,
          recipientId: selectedUser._id,
        })
      );
    }
  };

  const messagesToShow = selectedUser
    ? messagesByUser[selectedUser._id] || []
    : [];

  const filteredUsers = users.filter((u) =>
    u.name.toLowerCase().includes(searchTerm.toLowerCase())
  );

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messagesToShow]);

  return (
    <div className="flex h-screen overflow-hidden">
      <div
        className={`${
          sidebarCollapsed ? "w-20" : "w-64"
        } shrink-0 transition-all duration-300`}
      >
        <Sidebar
          collapsed={sidebarCollapsed}
          setCollapsed={setSidebarCollapsed}
          onLogout={onLogout}
        />
      </div>

      <div
        className={
          "flex-1 flex bg-gray-50 h-full overflow-hidden transition-all duration-300"
        }
      >
        {/* Chat column */}
        <div className="flex flex-col flex-1 h-full overflow-hidden">
          {/* Header */}
          <div className="p-4 border-b border-gray-300 bg-white flex items-center gap-3 shadow-sm shrink-0">
            {selectedUser ? (
              <>
                <img
                  src={`https://ui-avatars.com/api/?name=${selectedUser.name}`}
                  alt="avatar"
                  className="w-8 h-8 rounded-full"
                />
                <div className="flex items-center gap-2">
                  <h3 className="text-lg font-semibold">{selectedUser.name}</h3>
                  {typingUsers[selectedUser._id] ? (
                    <span className="text-xs text-gray-500 italic">
                      typing...
                    </span>
                  ) : (
                    <span className="text-xs text-green-500 flex items-center gap-1">
                      <Circle size={8} className="fill-green-500" />
                    </span>
                  )}
                </div>
              </>
            ) : (
              <h3 className="text-lg text-gray-500">Select a contact</h3>
            )}
          </div>

          {/* Messages (scrollable) */}
          <div className="flex-1 overflow-y-auto p-4 space-y-3 bg-gradient-to-b from-gray-100 to-gray-200 hide-scrollbar">
            {messagesToShow.map((msg, idx) => {
              const isOutgoing = msg.senderId === userId;
              return (
                <motion.div
                  key={idx}
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ duration: 0.2 }}
                  className={`flex ${
                    isOutgoing ? "justify-end" : "justify-start"
                  }`}
                >
                  <div
                    className={`max-w-xs px-4 py-2 rounded-2xl shadow text-sm ${
                      isOutgoing
                        ? "bg-blue-500 text-white rounded-br-none"
                        : "bg-white text-gray-900 border border-gray-200 rounded-bl-none"
                    }`}
                  >
                    <p className="break-">{msg.message}</p>
                    <small
                      className={`block text-[8px] opacity-70 mt-1 ${
                        isOutgoing ? "text-right" : "text-left"
                      }`}
                    >
                      {new Date(msg.timestamp).toLocaleTimeString([], {
                        hour: "2-digit",
                        minute: "2-digit",
                      })}
                    </small>
                  </div>
                </motion.div>
              );
            })}

            {/* Typing animation */}
            {typingUsers[selectedUser?._id] && (
              <div className="flex justify-start">
                <div className="bg-gray-300 px-3 py-2 rounded-2xl max-w-xs flex gap-1">
                  <motion.span
                    className="w-2 h-2 bg-gray-600 rounded-full"
                    animate={{ opacity: [0.3, 1, 0.3] }}
                    transition={{ repeat: Infinity, duration: 1 }}
                  />
                  <motion.span
                    className="w-2 h-2 bg-gray-600 rounded-full"
                    animate={{ opacity: [0.3, 1, 0.3] }}
                    transition={{ repeat: Infinity, duration: 1, delay: 0.2 }}
                  />
                  <motion.span
                    className="w-2 h-2 bg-gray-600 rounded-full"
                    animate={{ opacity: [0.3, 1, 0.3] }}
                    transition={{ repeat: Infinity, duration: 1, delay: 0.4 }}
                  />
                </div>
              </div>
            )}

            <div ref={bottomRef} />
          </div>

          {/* Input */}
          {selectedUser && (
            <div className="p-3 border-t border-gray-300 bg-white flex items-center gap-2 shadow-md shrink-0">
              <button className="p-2 hover:bg-gray-100 rounded-full">
                <Smile size={20} />
              </button>
              <button className="p-2 hover:bg-gray-100 rounded-full">
                <Paperclip size={20} />
              </button>
              <input
                type="text"
                value={newMessage}
                onChange={(e) => setNewMessage(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter") sendMessage();
                  else handleTyping();
                }}
                placeholder="Type a message..."
                className="flex-1 p-2 border border-gray-300 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-300"
              />
              <button
                onClick={sendMessage}
                disabled={!newMessage.trim()}
                className={`p-2 rounded-full transition ${
                  newMessage.trim()
                    ? "bg-blue-500 text-white hover:bg-blue-600"
                    : "bg-gray-200 text-gray-400 cursor-not-allowed"
                }`}
              >
                <Send size={20} />
              </button>
            </div>
          )}
        </div>

        {/* Contacts list */}
        <div className="w-1/4 bg-white border-l border-gray-300 flex flex-col h-full overflow-hidden">
          <div className="p-4 border-b border-gray-300 shrink-0">
            <h3 className="text-lg font-bold">Contacts</h3>
          </div>

          <div className="p-2 border-b border-gray-200 shrink-0">
            <input
              type="text"
              placeholder="Search..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full p-2 border border-gray-200 rounded-lg text-sm focus:ring focus:ring-blue-200"
            />
          </div>

          <div className="flex-1 overflow-y-auto hide-scrollbar">
            {filteredUsers.map((user) => {
              const isSelected = selectedUser?._id === user._id;
              const hasNewMessage = newMessagesByUser[user._id];

              return (
                <div
                  key={user._id}
                  onClick={() => selectUser(user)}
                  className={`flex items-center gap-3 p-3 cursor-pointer hover:bg-gray-100 ${
                    isSelected
                      ? "bg-blue-50"
                      : hasNewMessage
                      ? "bg-yellow-100 font-semibold"
                      : ""
                  }`}
                >
                  <img
                    src={`https://ui-avatars.com/api/?name=${user.name}`}
                    alt="avatar"
                    className="w-10 h-10 rounded-full"
                  />
                  <div>
                    <p className="font-medium">{user.name}</p>
                    <span className="text-xs text-gray-500">{user.role}</span>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      </div>
    </div>
  );
};

export default ChatPage;
