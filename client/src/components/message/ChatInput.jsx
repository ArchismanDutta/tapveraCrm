import React from "react";
import { Send, Smile, Paperclip } from "lucide-react";

export default function ChatInput({
  newMessage,
  setNewMessage,
  sendMessage,
  handleTyping,
}) {
  return (
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
  );
}
