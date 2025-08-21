import React, { useState } from "react";

const MessageInput = ({ chatId, onNewMessage }) => {
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);

  const sendMessage = async () => {
    if (!input.trim()) return;
    setLoading(true);
    try {
      const token = localStorage.getItem("token");
      const res = await fetch(`/api/chat/conversations/${chatId}/messages`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ content: input.trim() }),
      });

      if (!res.ok) throw new Error("Send failed");
      const newMessage = await res.json();

      // Normalize sender._id to string for consistency
      const normalizedMessage = {
        ...newMessage,
        sender: {
          _id: newMessage.sender?._id?.toString(),
          name: newMessage.sender?.name || "Me",
        },
      };

      onNewMessage(normalizedMessage);
      setInput("");
    } catch (err) {
      console.error(err);
      alert("Failed to send message");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="flex items-center p-3 border-t bg-gray-50">
      <input
        type="text"
        value={input}
        placeholder="Type a message..."
        className="flex-1 border border-gray-300 rounded-l-lg px-4 py-2 focus:outline-none focus:ring-2 focus:ring-green-400"
        onChange={(e) => setInput(e.target.value)}
        onKeyDown={(e) => e.key === "Enter" && sendMessage()}
        disabled={loading}
      />
      <button
        className={`px-4 py-2 rounded-r-lg font-semibold text-white shadow ${
          loading || !input.trim()
            ? "bg-green-300 cursor-not-allowed"
            : "bg-green-500 hover:bg-green-600"
        }`}
        onClick={sendMessage}
        disabled={loading || !input.trim()}
      >
        {loading ? "Sending..." : "Send"}
      </button>
    </div>
  );
};

export default MessageInput;
