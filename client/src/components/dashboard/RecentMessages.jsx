// src/components/dashboard/RecentMessages.jsx
import React from "react";
import PropTypes from "prop-types";

const RecentMessages = ({ messages }) => (
  <div className="bg-white rounded-xl border p-6 shadow">
    <h2 className="text-lg font-semibold mb-4">Recent Messages</h2>
    <ul className="space-y-4 max-h-64 overflow-y-auto">
      {messages.map(({ id, avatar, sender, message, time }) => (
        <li key={id} className="flex items-start gap-3">
          <img
            src={avatar}
            alt={`${sender} avatar`}
            className="h-10 w-10 rounded-full border object-cover"
            loading="lazy"
          />
          <div>
            <p className="font-semibold">{sender}</p>
            <p className="text-sm text-gray-500">{message}</p>
            <span className="text-xs text-gray-400">{time}</span>
          </div>
        </li>
      ))}
    </ul>
  </div>
);

RecentMessages.propTypes = {
  messages: PropTypes.arrayOf(
    PropTypes.shape({
      id: PropTypes.oneOfType([PropTypes.number, PropTypes.string]).isRequired,
      avatar: PropTypes.string.isRequired,
      sender: PropTypes.string.isRequired,
      message: PropTypes.string.isRequired,
      time: PropTypes.string.isRequired,
    })
  ).isRequired,
};

export default RecentMessages;
