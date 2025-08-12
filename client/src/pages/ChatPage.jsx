import React, { useEffect, useState } from "react";
import { io } from "socket.io-client";
import axios from "axios";
import ChatSidebar from "../components/chat/ChatSidebar";
import ChatWindow from "../components/chat/ChatWindow";

const token = localStorage.getItem("token");

const socket = io("http://localhost:5000", {
  auth: { token }, // send JWT for socket auth
});

const ChatPage = () => {
  const [currentUser] = useState(JSON.parse(localStorage.getItem("user")));
  const [selectedUser, setSelectedUser] = useState(null);
  const [messages, setMessages] = useState([]);
  const [roomId, setRoomId] = useState(null);

  useEffect(() => {
    socket.on("receiveMessage", (message) => {
      if (message.room === roomId) {
        setMessages((prev) => [...prev, message]);
      }
    });

    return () => socket.off("receiveMessage");
  }, [roomId]);

  const fetchMessages = async (userId) => {
    try {
      const res = await axios.get(
        `http://localhost:5000/api/chat/messages?receiverId=${userId}`,
        { headers: { Authorization: `Bearer ${token}` } }
      );
      setMessages(res.data);
    } catch (err) {
      console.error("Error fetching messages", err);
    }
  };

  const handleSelectUser = (user) => {
    setSelectedUser(user);
    const room = [currentUser._id, user._id].sort().join("_");
    setRoomId(room);
    socket.emit("joinRoom", room);
    fetchMessages(user._id);
  };

  const sendMessage = (text) => {
    if (!text.trim()) return;
    socket.emit("sendMessage", {
      receiverId: selectedUser._id,
      message: text,
      room: roomId,
    });
  };

  return (
    <div className="flex h-screen">
      <ChatSidebar onSelectUser={handleSelectUser} />
      <ChatWindow
        messages={messages}
        onSendMessage={sendMessage}
        selectedUser={selectedUser}
        currentUserId={currentUser._id}
      />
    </div>
  );
};

export default ChatPage;
