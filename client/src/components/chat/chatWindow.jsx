import React, { useState } from "react";

const ChatWindow = ({ messages, sendMessage, conversationId }) => {
  const [input, setInput] = useState("");

  const handleSendMessage = () => {
    if (!input.trim()) return;
    sendMessage(conversationId, input.trim());
    setInput("");
  };

  return (
    <div>
      <div
        style={{
          height: "400px",
          overflowY: "auto",
          border: "1px solid #ccc",
          padding: "10px",
        }}
      >
        {messages.map((msg) => (
          <div key={msg.messageId}>
            <b>{msg.senderId}</b>: {msg.message}{" "}
            <small>{new Date(msg.timestamp).toLocaleTimeString()}</small>
          </div>
        ))}
      </div>
      <input
        type="text"
        value={input}
        onChange={(e) => setInput(e.target.value)}
        onKeyDown={(e) => e.key === "Enter" && handleSendMessage()}
        style={{ width: "80%" }}
        placeholder="Type a message"
      />
      <button onClick={handleSendMessage} style={{ width: "19%" }}>
        Send
      </button>
    </div>
  );
};

export default ChatWindow;
