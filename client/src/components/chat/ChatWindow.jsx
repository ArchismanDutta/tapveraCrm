import React, { useState } from "react";

const ChatWindow = ({ messages, onSendMessage, selectedUser, currentUserId }) => {
  const [text, setText] = useState("");

  if (!selectedUser) {
    return (
      <div className="flex-1 flex items-center justify-center">
        Select a user to chat
      </div>
    );
  }

  return (
    <div className="flex-1 flex flex-col">
      <div className="flex-1 overflow-y-auto p-4">
        {messages.map((msg, index) => (
          <div
            key={index}
            className={`mb-2 ${
              msg.sender._id === currentUserId ? "text-right" : "text-left"
            }`}
          >
            <span className="inline-block bg-pink-200 px-3 py-1 rounded">
              {msg.message}
            </span>
          </div>
        ))}
      </div>
      <div className="p-4 flex">
        <input
          value={text}
          onChange={(e) => setText(e.target.value)}
          className="flex-1 border rounded p-2"
          placeholder="Type a message..."
        />
        <button
          onClick={() => {
            onSendMessage(text);
            setText("");
          }}
          className="ml-2 bg-pink-500 text-white px-4 py-2 rounded"
        >
          Send
        </button>
      </div>
    </div>
  );
};

export default ChatWindow;
