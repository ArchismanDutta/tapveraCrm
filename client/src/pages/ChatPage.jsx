import React, { useState, useEffect } from "react";
import useChatWebSocket from "../hooks/useChatWebSocket"; // Create this hook file with WS logic
import ChatWindow from "../components/chat/chatWindow"; // Your chat window component

const API_BASE = "http://localhost:5000/api/chat"; // Adjust as needed

const ChatPage = () => {
  const [jwtToken, setJwtToken] = useState("");
  const [conversations, setConversations] = useState([]);
  const [selectedConversation, setSelectedConversation] = useState(null);

  const { messages, sendMessage } = useChatWebSocket(
    jwtToken,
    selectedConversation?._id
  );

  useEffect(() => {
    if (!jwtToken) return;

    fetch(`${API_BASE}/groups`, {
      headers: { Authorization: `Bearer ${jwtToken}` },
    })
      .then((res) => res.json())
      .then((data) => setConversations(data))
      .catch(console.error);
  }, [jwtToken]);

  useEffect(() => {
    // Replace with actual login token retrieval logic
    const token = localStorage.getItem("token") || "YOUR_JWT_TOKEN_HERE";
    setJwtToken(token);
  }, []);

  return (
    <div style={{ display: "flex", height: "100vh" }}>
      <div
        style={{
          width: "25%",
          borderRight: "1px solid #ccc",
          padding: "10px",
          overflowY: "auto",
        }}
      >
        <h3>Conversations</h3>
        <ul style={{ listStyle: "none", padding: 0 }}>
          {conversations.map((conv) => (
            <li
              key={conv._id}
              style={{
                cursor: "pointer",
                backgroundColor:
                  selectedConversation?._id === conv._id
                    ? "#e0e0e0"
                    : "transparent",
                padding: "5px",
                marginBottom: "5px",
              }}
              onClick={() => setSelectedConversation(conv)}
            >
              {conv.name || conv._id}
            </li>
          ))}
        </ul>
      </div>
      <div style={{ flexGrow: 1, padding: "10px" }}>
        {selectedConversation ? (
          <>
            {/* Show group members above chat window */}
            {selectedConversation.members && (
              <div
                style={{
                  marginBottom: "10px",
                  fontSize: "0.9em",
                  color: "#666",
                }}
              >
                Members:{" "}
                {selectedConversation.members
                  .map((m) => m.name || m._id)
                  .join(", ")}
              </div>
            )}

            <ChatWindow
              messages={messages}
              sendMessage={sendMessage}
              conversationId={selectedConversation._id}
            />
          </>
        ) : (
          <div>Select a conversation to start chatting</div>
        )}
      </div>
    </div>
  );
};

export default ChatPage;
