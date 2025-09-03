import React, { useState, useEffect, useRef } from "react";

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
  const chatEndRef = useRef(null);

  const handleSendMessage = () => {
    if (!input.trim()) return;
    sendMessage(conversationId, input.trim());
    setInput("");
  };

  const getSenderName = (senderId) => {
    const member = conversationMembers.find((m) => m._id === senderId);
    return member ? member.name : "Unknown";
  };

  // Normalize messages for consistent fields
  const normalizedMessages = messages.map((msg) => ({
    messageId:
      msg.messageId || msg._id || Math.random().toString(36).substring(2, 9),
    senderId: String(
      msg.senderId || (msg.sender?._id ?? msg.sender) || "unknown"
    ),
    message: msg.message || msg.text || "---",
    timestamp: msg.timestamp || msg.createdAt || Date.now(),
  }));

  useEffect(() => {
    chatEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [normalizedMessages]);

  return (
    <div className="flex flex-col h-full bg-gray-900 text-gray-100">
      <div className="flex-1 overflow-y-auto p-4 space-y-3 hide-scrollbar">
        {normalizedMessages.length === 0 ? (
          <p className="text-gray-500 text-center text-sm">
            No messages yet...
          </p>
        ) : (
          normalizedMessages.map((msg, index) => {
            // Ensure currentUserId and senderId are compared as strings
            const isSelf = String(msg.senderId) === String(currentUserId);

            const prevMsg = normalizedMessages[index - 1];
            const showDateDivider =
              !prevMsg ||
              new Date(msg.timestamp).toDateString() !==
                new Date(prevMsg.timestamp).toDateString();

            return (
              <React.Fragment key={msg.messageId}>
                {showDateDivider && <DateDivider date={msg.timestamp} />}
                <div
                  className={`flex w-full ${
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
                      <p className="text-sm">{msg.message}</p>
                      <span className="block text-[10px] text-gray-400 mt-1 text-right">
                        {new Date(msg.timestamp).toLocaleTimeString([], {
                          hour: "2-digit",
                          minute: "2-digit",
                        })}
                      </span>
                    </div>
                  </div>
                </div>
              </React.Fragment>
            );
          })
        )}
        <div ref={chatEndRef} />
      </div>

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
