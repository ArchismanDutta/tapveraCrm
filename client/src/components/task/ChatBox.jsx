import React, { useState } from "react";

const ChatBox = () => {
  const [messages, setMessages] = useState([
    { from: "Manager", text: "Please send the monthly report." },
    { from: "Me", text: "Working on it." },
  ]);
  const [newMessage, setNewMessage] = useState("");

  const sendMessage = (e) => {
    e.preventDefault();
    if (newMessage.trim()) {
      setMessages([...messages, { from: "Me", text: newMessage }]);
      setNewMessage("");
    }
  };

  return (
    <div className="flex flex-col h-full">
      <div className="flex-1 overflow-y-auto p-4 space-y-3">
        {messages.map((msg, i) => (
          <div
            key={i}
            className={`p-2 rounded-lg max-w-xs ${
              msg.from === "Me"
                ? "bg-pinkAccent text-white ml-auto"
                : "bg-gray-200"
            }`}
          >
            {msg.text}
          </div>
        ))}
      </div>
      <form onSubmit={sendMessage} className="p-3 border-t flex gap-2">
        <input
          type="text"
          value={newMessage}
          onChange={(e) => setNewMessage(e.target.value)}
          placeholder="Type a message..."
          className="flex-1 border rounded-lg px-3 py-2 text-sm"
        />
        <button
          type="submit"
          className="bg-pinkAccent text-white px-4 py-2 rounded-lg text-sm"
        >
          Send
        </button>
      </form>
    </div>
  );
};

export default ChatBox;
