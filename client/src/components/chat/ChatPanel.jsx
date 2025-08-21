import React, { useEffect, useState, useRef } from "react";
import { fetchMessages, sendMessage } from "../../api/api";
import MessageBubble from "./MessageBubble";

const ChatPanel = ({ selectedChat }) => {
  const [messages, setMessages] = useState([]);
  const [newMessage, setNewMessage] = useState("");
  const messagesEndRef = useRef();

  const meId = localStorage.getItem("userId")?.toString();

  // Determine the other user dynamically
  const otherUser = selectedChat?.members.find(
    (member) => member._id.toString() !== meId
  );

  // Fetch messages
  const loadMessages = async () => {
    if (!selectedChat) return;

    try {
      const data = await fetchMessages(selectedChat._id);

      // Normalize sender._id to string
      const normalized = data.map((msg) => ({
        ...msg,
        sender: {
          _id: msg.sender?._id?.toString() || meId,
          name: msg.sender?.name || "Unknown",
        },
      }));

      setMessages(normalized);
    } catch (err) {
      console.error(err);
    }
  };

  // Poll messages every 2 seconds
  useEffect(() => {
    loadMessages();
    const interval = setInterval(loadMessages, 2000);
    return () => clearInterval(interval);
  }, [selectedChat]);

  // Scroll to bottom on messages change
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  // Send new message
  const handleSend = async () => {
    if (!newMessage.trim()) return;

    try {
      const msg = await sendMessage(selectedChat._id, newMessage);

      const normalizedMsg = {
        ...msg,
        sender: {
          _id: msg.sender?._id?.toString() || meId,
          name: msg.sender?.name || "Me",
        },
      };

      setMessages((prev) => [...prev, normalizedMsg]);
      setNewMessage("");
    } catch (err) {
      console.error(err);
    }
  };

  if (!selectedChat)
    return (
      <div className="flex-1 flex items-center justify-center text-gray-400">
        Select an employee to start chatting
      </div>
    );

  return (
    <div className="flex-1 flex flex-col bg-white">
      {/* Header */}
      <div className="p-4 border-b bg-gray-50 font-bold shadow">
        {otherUser?.name || "Chat"}
      </div>

      {/* Messages */}
      <div className="flex-1 overflow-y-auto p-4 space-y-2">
        {messages.map((msg) => (
          <MessageBubble
            key={msg._id}
            message={msg}
            fromMe={msg.sender._id === meId} // align right if from me
          />
        ))}
        <div ref={messagesEndRef} />
      </div>

      {/* Input */}
      <div className="p-3 border-t bg-gray-50 flex">
        <input
          type="text"
          className="flex-1 border rounded-l-lg px-3 py-2 focus:outline-none"
          placeholder="Type a message..."
          value={newMessage}
          onChange={(e) => setNewMessage(e.target.value)}
          onKeyDown={(e) => e.key === "Enter" && handleSend()}
        />
        <button
          onClick={handleSend}
          className="bg-green-500 text-white px-4 rounded-r-lg font-semibold"
        >
          Send
        </button>
      </div>
    </div>
  );
};

export default ChatPanel;
