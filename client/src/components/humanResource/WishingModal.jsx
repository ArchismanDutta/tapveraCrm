// File: src/components/humanResource/WishingModal.jsx
import React, { useState, useEffect } from "react";

const birthdayTemplates = [
  "🎉 Happy Birthday, [name]! Wishing you a wonderful day!",
  "🥳 Many happy returns, [name]! Enjoy your special day.",
];

const anniversaryTemplates = [
  "💖 Happy Work Anniversary, [name]! Thank you for your dedication!",
  "🌟 Congratulations on your work milestone, [name]!",
];

const WishingModal = ({
  isOpen,
  onClose,
  birthdays = [],
  anniversaries = [],
  defaultType = "birthday",
  onSend,
}) => {
  const [selectedUsers, setSelectedUsers] = useState([]);
  const [messageType, setMessageType] = useState(defaultType);
  const [message, setMessage] = useState("");

  useEffect(() => {
    setMessageType(defaultType);
    setSelectedUsers([]);
    setMessage("");
  }, [isOpen, defaultType]);

  const handleToggleUser = (user) => {
    setSelectedUsers((prev) =>
      prev.some((u) => u._id === user._id)
        ? prev.filter((u) => u._id !== user._id)
        : [...prev, user]
    );
  };

  const handleTemplateSelect = (template) => {
    if (selectedUsers.length === 1) {
      setMessage(template.replace("[name]", selectedUsers[0].name));
    } else {
      setMessage(template.replace(/\[name\]/g, "[name]"));
    }
  };

  const handleSend = () => {
    if (!message || selectedUsers.length === 0) {
      return alert("Select users and write a message.");
    }
    onSend(selectedUsers, message, messageType);
    setSelectedUsers([]);
    setMessage("");
    onClose();
  };

  if (!isOpen) return null;

  const options = messageType === "birthday" ? birthdays : anniversaries;
  const templates = messageType === "birthday" ? birthdayTemplates : anniversaryTemplates;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
      <div className="bg-[#1a1f36] rounded-xl w-full max-w-md p-6 shadow-lg">
        <h2 className="text-xl font-semibold mb-4">Send Wishes</h2>

        {/* Wish Type */}
        <div className="mb-4">
          <label className="block mb-1">Wish Type:</label>
          <select
            className="w-full p-2 rounded bg-[#101525] text-gray-100"
            value={messageType}
            onChange={(e) => setMessageType(e.target.value)}
          >
            <option value="birthday">Birthday</option>
            <option value="anniversary">Anniversary</option>
          </select>
        </div>

        {/* Select Users */}
        <div className="mb-4">
          <label className="block mb-1">Select Users:</label>
          <div className="max-h-40 overflow-auto border rounded p-2 bg-[#101525]">
            {options.length > 0 ? (
              options.map((u) => (
                <div key={u._id} className="flex items-center mb-1">
                  <input
                    type="checkbox"
                    className="mr-2"
                    checked={selectedUsers.some((su) => su._id === u._id)}
                    onChange={() => handleToggleUser(u)}
                  />
                  <span>{u.name}</span>
                </div>
              ))
            ) : (
              <p className="text-gray-400 text-sm">No users available</p>
            )}
          </div>
        </div>

        {/* Choose Template */}
        <div className="mb-4">
          <label className="block mb-1">Choose Template:</label>
          <div className="flex gap-2 flex-wrap">
            {templates.map((t, idx) => (
              <button
                key={idx}
                className="bg-blue-600 text-white px-3 py-1 rounded hover:bg-blue-700 text-sm"
                onClick={() => handleTemplateSelect(t)}
              >
                {selectedUsers.length === 1
                  ? t.replace("[name]", selectedUsers[0].name)
                  : t.replace(/\[name\]/g, "[name]")}
              </button>
            ))}
          </div>
        </div>

        {/* Custom Message */}
        <div className="mb-4">
          <label className="block mb-1">Custom Message:</label>
          <textarea
            className="w-full p-2 rounded bg-[#101525] text-gray-100"
            rows={3}
            value={message}
            onChange={(e) => setMessage(e.target.value)}
            placeholder="Write your message here..."
          />
        </div>

        {/* Actions */}
        <div className="flex justify-end gap-2">
          <button
            className="px-4 py-2 bg-gray-600 rounded hover:bg-gray-700"
            onClick={onClose}
          >
            Cancel
          </button>
          <button
            className="px-4 py-2 bg-green-500 rounded hover:bg-green-600 text-white"
            onClick={handleSend}
          >
            Send
          </button>
        </div>
      </div>
    </div>
  );
};

export default WishingModal;
