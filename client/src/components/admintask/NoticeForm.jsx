import React, { useState } from "react";
import API from "../../api";

export default function NoticeForm({ onPublish }) {
  const [message, setMessage] = useState("");

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!message.trim()) return;

    try {
      await API.post("/notices", { message });
      onPublish?.("✅ Notice published successfully!");
      setMessage("");
    } catch (err) {
      console.error("publishNotice error:", err);
      onPublish?.("❌ Failed to publish notice");
    }
  };

  return (
    <form
      onSubmit={handleSubmit}
      className="bg-gray-800 rounded-xl shadow-md p-6 mb-8 text-gray-200"
    >
      <h2 className="text-lg font-semibold text-gray-200 mb-4">📢 Publish Notice</h2>
      <textarea
        className="border border-gray-600 bg-gray-700 rounded-lg p-3 w-full text-sm text-gray-200 placeholder-gray-400 focus:ring-2 focus:ring-orange-400 focus:border-orange-400"
        rows={4}
        placeholder="Write a notice for all employees..."
        value={message}
        onChange={(e) => setMessage(e.target.value)}
        required
      />
      <button
        type="submit"
        className="mt-3 px-4 py-2 bg-blue-500 text-white rounded-lg hover:bg-orange-600 focus:outline-none focus:ring-2 focus:ring-orange-500"
      >
        Publish now
      </button>
    </form>
  );
}
