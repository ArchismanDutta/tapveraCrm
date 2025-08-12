// src/components/DailyEmailSender.jsx
import React, { useState } from "react";
import { FaPaperPlane } from "react-icons/fa";
import { Sunrise, Moon } from "lucide-react";
import tapveraLogo from "../assets/tapvera.png";

const DailyEmailSender = ({ onClose }) => {
  const [template, setTemplate] = useState("start");
  const [task, setTask] = useState("");
  const [status, setStatus] = useState("");
  const [showToast, setShowToast] = useState(false);

  const handleSend = async () => {
    if (!task.trim()) {
      setShowToast(true);
      setTimeout(() => setShowToast(false), 2000);
      return;
    }

    try {
      const res = await fetch("http://localhost:5001/send", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ template, task }),
      });

      const data = await res.json();
      if (res.ok) {
        setStatus("✅ Email sent successfully!");
        setTask("");
      } else {
        setStatus("❌ Error: " + data.error);
      }
    } catch (err) {
      setStatus("❌ Request failed: " + err.message);
    }
  };

  return (
    <div className="bg-linear-gradient(90deg,rgba(255, 255, 255, 1) 0%, rgba(13, 5, 5, 1) 50%, rgba(64, 64, 64, 1) 100%);, backdrop-blur-xl border border-white/20 rounded-2xl shadow-2xl p-6 w-full max-w-lg relative text-white">
      {/* Close Button */}
      <button
        onClick={onClose}
        className="absolute top-3 right-3 text-gray-300 hover:text-white transition"
      >
        ✖
      </button>

      {/* Logo */}
      <div className="flex justify-center mb-4">
        <img src={tapveraLogo} alt="Tapvera Logo" className="h-10 drop-shadow-lg" />
      </div>

      <h2 className="text-xl font-bold mb-4">Daily Task Update Email Sender</h2>

      {/* Template Switch */}
      <div className="grid grid-cols-2 bg-white/10 border border-white/20 rounded-lg overflow-hidden mb-4">
        {[
          { type: "start", label: "Start of Day", icon: <Sunrise size={18} /> },
          { type: "end", label: "End of Day", icon: <Moon size={18} /> },
        ].map(({ type, label, icon }) => (
          <button
            key={type}
            onClick={() => setTemplate(type)}
            className={`flex items-center justify-center gap-2 py-2 font-semibold transition ${
              template === type
                ? type === "start"
                  ? "bg-gradient-to-b from-yellow-400 to-orange-400 text-black"
                  : "bg-gradient-to-b from-orange-400 to-red-400 text-black"
                : "text-gray-300 hover:text-white"
            }`}
          >
            {icon} {label}
          </button>
        ))}
      </div>

      {/* Task Input */}
      <textarea
        rows="5"
        placeholder="Enter your task here..."
        value={task}
        onChange={(e) => setTask(e.target.value)}
        className="w-full resize-none p-3 rounded-lg border border-white/20 bg-white/10 text-white placeholder-gray-300 focus:outline-none focus:ring-2 focus:ring-yellow-400"
      />

      {/* Send Button */}
      <button
        onClick={handleSend}
        className="mt-4 w-full flex items-center justify-center gap-2 py-3 rounded-lg font-semibold bg-gradient-to-b from-yellow-400 to-orange-400 text-black shadow-lg hover:scale-[1.02] transition"
      >
        <FaPaperPlane /> Send Email
      </button>

      {/* Status */}
      {status && (
        <div
          className={`mt-3 text-center py-2 rounded-lg border text-sm ${
            status.startsWith("✅")
              ? "text-yellow-400 border-yellow-500/30 bg-yellow-500/10"
              : "text-red-400 border-red-500/30 bg-red-500/10"
          }`}
        >
          {status}
        </div>
      )}

      {/* Toast */}
      {showToast && (
        <div className="absolute top-4 right-4 bg-yellow-500/10 text-yellow-400 border border-yellow-500/30 px-4 py-2 rounded-lg shadow-lg">
          ⚠️ Please enter your task first
        </div>
      )}
    </div>
  );
};

export default DailyEmailSender;
