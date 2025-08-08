import React, { useState, useRef, useEffect } from "react";

const MessagesPanel = ({ messages = [], onSendMessage }) => {
  const [input, setInput] = useState("");
  const [sending, setSending] = useState(false);
  const messagesEndRef = useRef(null);

  const handleSend = () => {
    if (!input.trim()) return;
    setSending(true);

    // Simulate quick send delay
    setTimeout(() => {
      onSendMessage(input);
      setInput("");
      setSending(false);
    }, 300);
  };

  // Always scroll to the latest message on update
  useEffect(() => {
    if (messagesEndRef.current) {
      messagesEndRef.current.scrollIntoView({ behavior: "smooth" });
    }
  }, [messages]);

  return (
    <div
      className="bg-gradient-to-br from-yellow-50 via-orange-50 to-yellow-100 rounded-xl shadow-lg p-5 border border-yellow-200 flex flex-col"
      style={{
        maxHeight: "80vh", // prevent overflowing the screen
        minHeight: "350px", // nice minimum size
        height: "100%",
      }}
    >
      <h3 className="font-bold text-lg text-orange-500 mb-4 flex items-center gap-2">
        💬 Messages
      </h3>

      {/* Messages container */}
      <div
        className="flex-1 overflow-y-auto mb-3 space-y-3 pr-1"
        style={{ minHeight: "0" }} // flexbox scroll fix
      >
        {messages.map((msg, index) => (
          <div
            key={index}
            className={`flex ${
              msg.sender === "me" ? "justify-end" : "justify-start"
            }`}
          >
            {msg.sender !== "me" && (
              <div className="bg-yellow-200 flex items-center justify-center text-orange-800 font-bold rounded-full h-8 w-8 mr-2 shadow-sm">
                {msg.sender.charAt(0).toUpperCase()}
              </div>
            )}
            <div
              className={`rounded-xl px-3 py-2 text-sm shadow-sm max-w-[70%] break-words ${
                msg.sender === "me"
                  ? "bg-gradient-to-r from-yellow-300 via-orange-300 to-orange-400 text-black"
                  : "bg-white/80 text-gray-800 border border-yellow-100"
              }`}
            >
              {msg.text}
            </div>
          </div>
        ))}
        <div ref={messagesEndRef} />
      </div>

      {/* Input area */}
      <div className="flex gap-2 mt-2">
        <input
          type="text"
          placeholder="Type a message..."
          className="border border-yellow-200 focus:border-orange-400 focus:ring-1 focus:ring-orange-300 w-full p-2 rounded-lg text-sm bg-white/70"
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={(e) => e.key === "Enter" && handleSend()}
        />
        <button
          onClick={handleSend}
          disabled={sending}
          className={`px-4 py-2 rounded-lg font-semibold shadow-md focus:outline-none focus:ring-2 focus:ring-orange-400 transition-all duration-200 bg-gradient-to-r from-yellow-300 via-orange-300 to-orange-400 text-black hover:from-orange-400 hover:to-yellow-300 text-sm transform active:scale-95 ${
            sending ? "opacity-70 cursor-not-allowed" : ""
          }`}
        >
          {sending ? "..." : "Send"}
        </button>
      </div>
    </div>
  );
};

export default MessagesPanel;
