import React, { useState } from "react";
import { FaPaperPlane } from "react-icons/fa";
import { Sunrise, Moon } from "lucide-react"; // Better contrast icons
import tapveraLogo from "../assets/tapvera.png";

const DailyEmailSender = () => {
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
    <div
      style={{
        background: "#000",
        minHeight: "100vh",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        padding: "20px",
        color: "#f5f5f5",
        fontFamily: "Inter, system-ui, sans-serif",
        position: "relative",
        overflow: "hidden",
      }}
    >
      {/* Orange Glow */}
      <div
        style={{
          position: "absolute",
          top: "-40%",
          left: "-20%",
          right: "-20%",
          height: "80%",
          background:
            "radial-gradient(circle at top, rgba(255,165,0,0.55), transparent 75%)",
          filter: "blur(100px)",
          zIndex: 0,
        }}
      ></div>

      {/* Toast */}
      {showToast && (
        <div
          style={{
            position: "absolute",
            top: "20px",
            right: "20px",
            background: "rgba(255,193,7,0.15)",
            color: "#ffb300",
            padding: "10px 18px",
            borderRadius: "10px",
            border: "1px solid rgba(255,193,7,0.3)",
            backdropFilter: "blur(6px)",
            boxShadow: "0 4px 12px rgba(0,0,0,0.25)",
            fontWeight: 500,
            zIndex: 2,
          }}
        >
          ⚠️ Please enter your task first
        </div>
      )}

      {/* Main Container */}
      <div
        style={{
          position: "relative",
          width: "100%",
          maxWidth: "640px",
          zIndex: 1,
        }}
      >
        {/* Tapvera Logo */}
        <div
          style={{
            display: "flex",
            justifyContent: "center",
            marginBottom: "16px",
          }}
        >
          <img
            src="/tapvera-logo.png" // <-- Change this path to your actual logo
            alt="Tapvera Logo"
            style={{
              height: "50px",
              objectFit: "contain",
              filter: "drop-shadow(0 2px 4px rgba(0,0,0,0.5))",
            }}
          />
        </div>

        {/* Card */}
        <div
          style={{
            background: "rgba(20,20,20,0.92)",
            border: "1px solid rgba(255,255,255,0.06)",
            borderRadius: "20px",
            boxShadow: "0 12px 35px rgba(0,0,0,0.6)",
            backdropFilter: "blur(16px)",
          }}
        >
          {/* Header */}
          <header
            style={{
              display: "flex",
              alignItems: "center",
              gap: "12px",
              padding: "20px",
              borderBottom: "1px solid rgba(255,255,255,0.05)",
              background:
                "linear-gradient(90deg, rgba(255,179,0,0.15), transparent 70%)",
              fontWeight: "bold",
              fontSize: "1.25rem",
            }}
          >
            <svg
              width="28"
              height="28"
              viewBox="0 0 24 24"
              fill="none"
              aria-hidden="true"
            >
              <circle cx="12" cy="12" r="10" stroke="#ffb300" strokeWidth="2" />
              <path
                d="M7 13l3 3 7-7"
                stroke="#ffb300"
                strokeWidth="2"
                fill="none"
                strokeLinecap="round"
                strokeLinejoin="round"
              />
            </svg>
            Daily Task Update Email Sender
          </header>

          {/* Content */}
          <div style={{ padding: "24px", display: "grid", gap: "20px" }}>
            {/* Template Switch */}
            <div
              style={{
                display: "grid",
                gridTemplateColumns: "1fr 1fr",
                background: "rgba(255,255,255,0.04)",
                border: "1px solid rgba(255,255,255,0.05)",
                borderRadius: "12px",
                overflow: "hidden",
              }}
            >
              {[
                { type: "start", label: "Start of Day", icon: <Sunrise size={18} /> },
                { type: "end", label: "End of Day", icon: <Moon size={18} /> },
              ].map(({ type, label, icon }) => (
                <button
                  key={type}
                  onClick={() => setTemplate(type)}
                  style={{
                    padding: "14px 0",
                    fontWeight: 600,
                    fontSize: "0.95rem",
                    cursor: "pointer",
                    border: "none",
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    gap: "8px",
                    background:
                      template === type
                        ? type === "start"
                          ? "linear-gradient(180deg,#ffc107,#ff9800)"
                          : "linear-gradient(180deg,#ff8a65,#ff7043)"
                        : "transparent",
                    color:
                      template === type ? "#0b0b0b" : "rgba(255,255,255,0.65)",
                    transition: "all 0.25s ease",
                  }}
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
              style={{
                resize: "none",
                padding: "14px",
                borderRadius: "12px",
                border: "1px solid rgba(255,255,255,0.05)",
                background: "rgba(255,255,255,0.05)",
                color: "#fff",
                fontSize: "14px",
                outline: "none",
                minHeight: "140px",
                backdropFilter: "blur(4px)",
                boxShadow: "inset 0 0 8px rgba(0,0,0,0.4)",
              }}
            />

            {/* Send Button */}
            <button
              onClick={handleSend}
              style={{
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                gap: "10px",
                border: "none",
                borderRadius: "12px",
                padding: "14px",
                fontWeight: 600,
                fontSize: "1rem",
                cursor: "pointer",
                background: "linear-gradient(180deg,#ffb300,#ff9800)",
                color: "#0b0b0b",
                boxShadow: "0 6px 18px rgba(255,179,0,0.3)",
                transition: "transform 0.15s ease, box-shadow 0.15s ease",
              }}
              onMouseEnter={(e) => {
                e.currentTarget.style.transform = "translateY(-2px)";
                e.currentTarget.style.boxShadow =
                  "0 8px 20px rgba(255,179,0,0.25)";
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.transform = "translateY(0)";
                e.currentTarget.style.boxShadow =
                  "0 6px 18px rgba(255,179,0,0.3)";
              }}
            >
              <FaPaperPlane />
              Send Email
            </button>

            {/* Status */}
            {status && (
              <div
                style={{
                  padding: "10px 14px",
                  borderRadius: "999px",
                  textAlign: "center",
                  fontSize: "0.9rem",
                  color:
                    status.startsWith("✅")
                      ? "#ffb300"
                      : status.startsWith("❌")
                      ? "#ff7043"
                      : "#fff176",
                  background:
                    status.startsWith("✅")
                      ? "rgba(255,179,0,0.08)"
                      : status.startsWith("❌")
                      ? "rgba(255,87,34,0.08)"
                      : "rgba(255,241,118,0.08)",
                  border: `1px solid ${
                    status.startsWith("✅")
                      ? "rgba(255,179,0,0.3)"
                      : status.startsWith("❌")
                      ? "rgba(255,87,34,0.3)"
                      : "rgba(255,241,118,0.3)"
                  }`,
                }}
              >
                {status}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};

export default DailyEmailSender;
