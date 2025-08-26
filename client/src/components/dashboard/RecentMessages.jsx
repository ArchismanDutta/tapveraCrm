import React from "react";
import { MessageCircle, Reply, MoreHorizontal } from "lucide-react";

const colors = {
  accent: "#ff8000",         // Neon orange accent
  accentLight: "#232945",    // Glassy neon hover
  avatarBorder: "#ffb366",   // Neon orange border for avatar
  border: "#232945",         // Glass card border
  title: "#ffc87c",          // Neon orange title
  messageBg: "linear-gradient(90deg, #191f2b 70%, #232945 100%)", // Glassy gradient
  msgName: "#ffc87c",        // Light neon username
  msgText: "#dab875",        // Softer neon for message text
  msgTime: "#ffaa33",        // Muted neon for timestamp
};

const RecentMessages = ({ messages }) => (
  <div
    className="rounded-2xl shadow-xl px-7 py-6 w-full border"
    style={{
      background: colors.messageBg,
      border: `1.5px solid ${colors.border}`,
      margin: "0 auto",
    }}
  >
    <h2
      className="text-base font-extrabold mb-5 flex items-center gap-2 tracking-tight drop-shadow"
      style={{ color: colors.title }}
    >
      <MessageCircle className="w-5 h-5" color={colors.accent} />
      Recent Messages
    </h2>

    {messages.map((msg, idx) => (
      <div
        key={idx}
        className="flex items-center mb-2 last:mb-0 px-3 py-2 rounded-xl cursor-pointer transition-all duration-150 group shadow-none hover:shadow-lg"
        style={{
          minHeight: 52,
          background: "",
        }}
      >
        {/* Avatar */}
        <img
          src={msg.img}
          alt={msg.name}
          className="w-10 h-10 rounded-full object-cover border-2 shadow"
          style={{
            borderColor: colors.avatarBorder,
            background: "#181d2a",
          }}
        />

        {/* Message Content */}
        <div className="flex-1 min-w-0 ml-4">
          <p
            className="text-sm font-semibold tracking-tight truncate"
            title={msg.name}
            style={{ color: colors.msgName }}
          >
            {msg.name}
          </p>
          <p
            className="text-xs truncate mt-0.5 font-medium"
            title={msg.msg}
            style={{ color: colors.msgText }}
          >
            {msg.msg}
          </p>
        </div>

        {/* Time */}
        <span
          className="text-xs ml-2"
          style={{
            color: colors.msgTime,
            minWidth: 38,
            textAlign: "right"
          }}
        >
          {msg.time}
        </span>

        {/* Actions on hover */}
        <div className="flex items-center gap-2 ml-2 opacity-0 group-hover:opacity-100 transition-opacity duration-150">
          <button
            className="p-1 rounded-lg hover:bg-[#2e313a] outline-none focus:ring-2 focus:ring-orange-400 transition"
            tabIndex={0}
            aria-label="Reply"
            style={{ border: "none" }}
          >
            <Reply className="w-4 h-4" color={colors.accent} />
          </button>
          <button
            className="p-1 rounded-lg hover:bg-[#2e313a] outline-none focus:ring-2 focus:ring-gray-400 transition"
            tabIndex={0}
            aria-label="More"
            style={{ border: "none" }}
          >
            <MoreHorizontal className="w-4 h-4" color="#a09b98" />
          </button>
        </div>
      </div>
    ))}
  </div>
);

export default RecentMessages;
