import React, { useRef, useEffect } from "react";
import { motion } from "framer-motion";

export default function MessagesList({
  messagesToShow,
  userId,
  typingUsers,
  selectedUser,
}) {
  const bottomRef = useRef(null);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "auto" });
  }, [messagesToShow]);

  return (
    <div className="flex-1 overflow-y-auto p-4 space-y-3 bg-gradient-to-b from-gray-100 to-gray-200 hide-scrollbar">
      {messagesToShow.map((msg, idx) => {
        const isOutgoing = msg.senderId === userId;
        return (
          <motion.div
            key={idx}
            initial={{ opacity: 0, x: isOutgoing ? 20 : -20 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ duration: 0.15 }}
            className={`flex ${isOutgoing ? "justify-end" : "justify-start"}`}
          >
            <div
              className={`max-w-xs px-4 py-2 rounded-2xl shadow text-sm ${
                isOutgoing
                  ? "bg-blue-500 text-white rounded-br-none"
                  : "bg-white text-gray-900 border border-gray-200 rounded-bl-none"
              }`}
            >
              <p className="break-words">{msg.message}</p>
              <small
                className={`block text-[8px] opacity-70 mt-1 ${
                  isOutgoing ? "text-right" : "text-left"
                }`}
              >
                {new Date(msg.timestamp).toLocaleTimeString([], {
                  hour: "2-digit",
                  minute: "2-digit",
                })}
              </small>
            </div>
          </motion.div>
        );
      })}
      {typingUsers[selectedUser?._id] && (
        <div className="flex justify-start">
          <div className="bg-gray-300 px-3 py-2 rounded-2xl max-w-xs flex gap-1">
            <motion.span
              className="w-2 h-2 bg-gray-600 rounded-full"
              animate={{ opacity: [0.3, 1, 0.3] }}
              transition={{ repeat: Infinity, duration: 1 }}
            />
            <motion.span
              className="w-2 h-2 bg-gray-600 rounded-full"
              animate={{ opacity: [0.3, 1, 0.3] }}
              transition={{ repeat: Infinity, duration: 1, delay: 0.2 }}
            />
            <motion.span
              className="w-2 h-2 bg-gray-600 rounded-full"
              animate={{ opacity: [0.3, 1, 0.3] }}
              transition={{ repeat: Infinity, duration: 1, delay: 0.4 }}
            />
          </div>
        </div>
      )}
      <div ref={bottomRef} />
    </div>
  );
}
