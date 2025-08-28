import React, { useState, useEffect, useRef } from "react";

const ChatWindow = ({
  messages,
  sendMessage,
  conversationId,
  currentUserId,
  conversationMembers, // New prop
}) => {
  const [input, setInput] = useState("");
  const chatEndRef = useRef(null);

  const handleSendMessage = () => {
    if (!input.trim()) return;
    sendMessage(conversationId, input.trim());
    setInput("");
  };

  // Helper to get sender name by ID
  const getSenderName = (senderId) => {
    const member = conversationMembers.find((m) => m._id === senderId);
    return member ? member.name : "Unknown";
  };

  // Auto scroll to bottom when new messages arrive
  useEffect(() => {
    chatEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  return (
    <div className="flex flex-col h-full bg-gray-900 text-gray-100">
      {/* Messages Area */}
      <div className="flex-1 overflow-y-auto p-4 space-y-3 hide-scrollbar">
        {messages.length === 0 ? (
          <p className="text-gray-500 text-center text-sm">No messages yet...</p>
        ) : (
          messages.map((msg) => {
            const isSelf = msg.senderId === currentUserId;
            return (
              <div
                key={msg.messageId}
                className={`flex flex-col ${isSelf ? "items-end" : "items-start"}`}
              >
                {!isSelf && (
                  <p className="text-xs font-semibold text-gray-400 mb-1">
                    {getSenderName(msg.senderId)}
                  </p>
                )}
                <div
                  className={`max-w-xs md:max-w-md px-3 py-2 rounded-lg ${
                    isSelf
                      ? "bg-blue-600 text-white rounded-br-none"
                      : "bg-gray-700 text-gray-100 rounded-bl-none"
                  }`}
                >
                  <p className="text-sm">{msg.message}</p>
                  <span className="block text-[10px] text-gray-400 mt-1 text-right">
                    {new Date(msg.timestamp).toLocaleTimeString([], {
                      hour: "2-digit",
                      minute: "2-digit",
                    })}
                  </span>
                </div>
              </div>
            );
          })
        )}
        <div ref={chatEndRef} />
      </div>

      {/* Sticky Input Box */}
      <div className="sticky bottom-0 flex items-center z-10">
        <input
          type="text"
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={(e) => e.key === "Enter" && handleSendMessage()}
          placeholder="Type a message..."
          className="flex-1 px-4 py-2 rounded-lg bg-gray-700 text-gray-100 border border-gray-600 focus:outline-none focus:ring-2 focus:ring-blue-500"
        />
        <button
          onClick={handleSendMessage}
          className="ml-2 px-4 py-2 rounded-lg bg-blue-600 hover:bg-blue-500 text-white font-medium shadow-md hover:shadow-lg transition"
        >
          Send
        </button>
      </div>
    </div>
  );
};

export default ChatWindow;
