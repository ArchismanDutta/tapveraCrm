import React from "react";

const MessageBubble = ({ message, fromMe }) => {
  const senderName = message.sender?.name || "Unknown";

  return (
    <div className={`flex mb-2 ${fromMe ? "justify-end" : "justify-start"}`}>
      {/* Avatar for received messages */}
      {!fromMe && (
        <div className="w-8 h-8 rounded-full bg-gray-300 flex items-center justify-center mr-2">
          {senderName[0].toUpperCase()}
        </div>
      )}

      {/* Message bubble */}
      <div
        className={`max-w-xs md:max-w-md px-4 py-2 rounded-lg shadow break-words ${
          fromMe
            ? "bg-green-500 text-white rounded-bl-lg rounded-tr-lg"
            : "bg-gray-200 text-gray-900 rounded-br-lg rounded-tl-lg"
        }`}
      >
        {/* Sender name for received messages */}
        {!fromMe && (
          <div className="text-xs font-semibold mb-1">{senderName}</div>
        )}

        {/* Message content */}
        <div>{message.content}</div>

        {/* Timestamp */}
        <div className="text-xs text-gray-400 text-right mt-1">
          {new Date(message.timestamp || message.createdAt).toLocaleTimeString(
            [],
            { hour: "2-digit", minute: "2-digit" }
          )}
        </div>
      </div>
    </div>
  );
};

export default MessageBubble;
