import React, { useState, useRef, useEffect } from "react";

const MessagesPanel = ({ messages = [], onSendMessage }) => {
  const [input, setInput] = useState("");
  const [sending, setSending] = useState(false);
  const messagesEndRef = useRef(null);

  const handleSend = () => {
    if (!input.trim()) return;
    setSending(true);

    setTimeout(() => {
      onSendMessage(input);
      setInput("");
      setSending(false);
    }, 300);
  };

  useEffect(() => {
    if (messagesEndRef.current) {
      messagesEndRef.current.scrollIntoView({ behavior: "smooth" });
    }
  }, [messages]);

  return (
    <div
      className="bg-gradient-to-br from-[#141a29] via-[#181d2a] to-[#1b2233] rounded-xl shadow-lg p-5 border border-[#262e4a] flex flex-col text-blue-100"
      style={{
        maxHeight: "80vh",
        minHeight: "350px",
        height: "100%",
      }}
    >
      <h3 className="font-bold text-lg text-[#ff8000] mb-4 flex items-center gap-2">
        💬 Messages
      </h3>

      {/* Messages container */}
      <div
        className="flex-1 overflow-y-auto mb-3 space-y-3 pr-1 scrollbar-thin scrollbar-thumb-[#ff9500]/80 scrollbar-track-transparent"
        style={{ minHeight: "0" }}
      >
        {messages.map((msg, index) => (
          <div
            key={index}
            className={`flex ${
              msg.sender === "me" ? "justify-end" : "justify-start"
            }`}
          >
            {msg.sender !== "me" && (
              <div className="bg-[#ff8000] flex items-center justify-center text-black font-bold rounded-full h-8 w-8 mr-2 shadow-lg">
                {msg.sender.charAt(0).toUpperCase()}
              </div>
            )}

            <div
              className={`rounded-xl px-3 py-2 text-sm shadow max-w-[70%] break-words ${
                msg.sender === "me"
                  ? "bg-gradient-to-r from-[#ff8000] via-[#ff9500] to-[#ff8000] text-black"
                  : "bg-[#222b41]/90 text-blue-100 border border-[#ff8000]"
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
          className="border border-[#ff8000] focus:border-[#ff9500] focus:ring-1 focus:ring-[#ff9500] w-full p-2 rounded-lg text-sm bg-[#141a29] text-blue-100 caret-[#ff8000]"
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={(e) => e.key === "Enter" && handleSend()}
        />
        <button
          onClick={handleSend}
          disabled={sending}
          className={`px-4 py-2 rounded-lg font-semibold shadow-md focus:outline-none focus:ring-2 focus:ring-[#ff8000] transition-all duration-200 bg-gradient-to-r from-[#ff8000] via-[#ff9500] to-[#ff8000] text-black hover:from-[#ff9500] hover:to-[#ff8000] text-sm transform active:scale-95 ${
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
