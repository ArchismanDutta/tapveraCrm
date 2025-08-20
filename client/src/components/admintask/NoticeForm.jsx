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
      className="bg-white rounded-xl shadow-md p-6 mb-8"
    >
      <h2 className="text-lg font-semibold text-gray-700 mb-4">
        📢 Publish Notice
      </h2>
      <textarea
        className="border border-gray-300 rounded-lg p-3 w-full text-sm focus:ring-2 focus:ring-orange-400"
        rows={4}
        placeholder="Write a notice for all employees..."
        value={message}
        onChange={(e) => setMessage(e.target.value)}
        required
      />
      <button
        type="submit"
        className="mt-3 px-4 py-2 bg-orange-500 text-white rounded-lg hover:bg-orange-600"
      >
        Publish now
      </button>
    </form>
  );
}
