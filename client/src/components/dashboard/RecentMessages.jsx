import React from "react";
import { MessageCircle, Reply, MoreHorizontal } from "lucide-react";

// Define accent colors (muted pink and soft border)
const colors = {
  accent: "#C07A7A",            // Muted, friendly "pink"
  accentLight: "#f9ecec",       // Gentle background highlight
  avatarBorder: "#e3bdbd",      // Softer border for avatar
  border: "#ebe7e3",            // Card border
  title: "#885353",             // Heading (not ultra black)
  messageBg: "#fff",
  msgName: "#423037",
  msgText: "#88807b",
  msgTime: "#b9b1ab",
};

const RecentMessages = ({ messages }) => (
  <div
    className="rounded-xl shadow-sm px-6 py-5"
    style={{
      background: colors.messageBg,
      border: `1px solid ${colors.border}`,
      maxWidth: 440,
      margin: "0 auto",
    }}
  >
    <h2
      className="text-base font-semibold mb-4 flex items-center gap-2 tracking-tight"
      style={{ color: colors.title }}
    >
      <MessageCircle className="w-5 h-5" style={{ color: colors.accent }} />
      Recent Messages
    </h2>

    {messages.map((msg, idx) => (
      <div
        key={idx}
        className="flex items-center mb-3 px-2 py-2 rounded-lg transition-colors group cursor-pointer"
        style={{
          background: "none",
          minHeight: 52,
        }}
        onMouseOver={e => (e.currentTarget.style.background = colors.accentLight)}
        onMouseOut={e => (e.currentTarget.style.background = "none")}
      >
        {/* Avatar */}
        <img
          src={msg.img}
          alt={msg.name}
          className="w-10 h-10 rounded-full object-cover"
          style={{
            border: `2px solid ${colors.avatarBorder}`,
            background: "#fff",
          }}
        />

        {/* Message Content */}
        <div className="flex-1 min-w-0 ml-3">
          <p
            className="text-sm font-medium truncate"
            style={{ color: colors.msgName }}
            title={msg.name}
          >
            {msg.name}
          </p>
          <p
            className="text-xs truncate"
            title={msg.msg}
            style={{ color: colors.msgText, marginTop: ".15rem" }}
          >
            {msg.msg}
          </p>
        </div>

        {/* Time */}
        <span
          className="text-xs ml-2"
          style={{ color: colors.msgTime, minWidth: 38, textAlign: "right" }}
        >
          {msg.time}
        </span>

        {/* Actions: shown on hover */}
        <div
          className="flex items-center gap-1.5 ml-2 opacity-0 group-hover:opacity-100 transition-opacity duration-150"
        >
          <button
            className="p-1 rounded-full hover:bg-[#f4dedf] outline-none focus:ring-2 focus:ring-[#ead6d3] transition"
            tabIndex={0}
            style={{ border: "none" }}
            aria-label="Reply"
          >
            <Reply className="w-4 h-4" style={{ color: colors.accent }} />
          </button>
          <button
            className="p-1 rounded-full hover:bg-[#f0e9e9] outline-none focus:ring-2 focus:ring-[#e8dedd] transition"
            tabIndex={0}
            style={{ border: "none" }}
            aria-label="More"
          >
            <MoreHorizontal className="w-4 h-4" style={{ color: "#a09b98" }} />
          </button>
        </div>
      </div>
    ))}
  </div>
);

export default RecentMessages;
