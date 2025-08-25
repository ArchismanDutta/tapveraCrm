import React, { useEffect, useState, useRef } from "react";

const ChatPage = ({ currentUser }) => {
  const [users, setUsers] = useState([]);
  const [selectedUser, setSelectedUser] = useState(null);
  const [messages, setMessages] = useState([]);
  const ws = useRef(null);

  useEffect(() => {
    // Fetch all users
    fetch("/api/users/all", {
      headers: { Authorization: `Bearer ${localStorage.getItem("token")}` },
    })
      .then((res) => res.json())
      .then(setUsers);

    // Setup WebSocket connection
    ws.current = new WebSocket("ws://localhost:5000");

    ws.current.onopen = () => {
      ws.current.send(
        JSON.stringify({ type: "register", userId: currentUser.id })
      );
    };

    ws.current.onmessage = (event) => {
      const data = JSON.parse(event.data);
      if (
        data.type === "private_message" &&
        data.senderId === selectedUser?._id
      ) {
        setMessages((prev) => [...prev, data]);
      }
    };

    return () => ws.current.close();
  }, [currentUser.id, selectedUser]);

  const selectUser = (user) => {
    setSelectedUser(user);
    fetch(`/api/chat/${user._id}`, {
      headers: { Authorization: `Bearer ${localStorage.getItem("token")}` },
    })
      .then((res) => res.json())
      .then(setMessages);
  };

  const sendMessage = (msg) => {
    if (!ws.current || ws.current.readyState !== WebSocket.OPEN) return;
    if (!selectedUser || !selectedUser._id) {
      console.error("No recipient selected");
      return;
    }

    ws.current.send(
      JSON.stringify({
        type: "private_message",
        senderId: currentUser.id,
        recipientId: selectedUser._id,
        message: msg,
      })
    );

    // Optimistically add to messages
    setMessages((prev) => [
      ...prev,
      { senderId: currentUser.id, message: msg, timestamp: new Date() },
    ]);
  };

  return (
    <div className="flex h-screen bg-gray-100">
      {/* Sidebar */}
      <div className="w-1/4 bg-white border-r border-gray-300 flex flex-col">
        <h3 className="text-xl font-bold p-4 border-b">Contacts</h3>
        <div className="flex-1 overflow-y-auto">
          {users.map((user) => (
            <div
              key={user._id}
              onClick={() => selectUser(user)}
              className={`p-3 cursor-pointer hover:bg-gray-100 ${
                selectedUser?._id === user._id
                  ? "bg-gray-200 font-semibold"
                  : ""
              }`}
            >
              <p>{user.name}</p>
              <span className="text-sm text-gray-500">{user.role}</span>
            </div>
          ))}
        </div>
      </div>

      {/* Chat Window */}
      <div className="flex flex-col flex-1">
        {/* Chat Header */}
        <div className="p-4 border-b bg-white flex items-center">
          <h3 className="text-lg font-semibold">
            Chat with {selectedUser?.name || "..."}
          </h3>
        </div>

        {/* Messages */}
        <div className="flex-1 overflow-y-auto p-4 space-y-3 bg-gray-50">
          {messages.map((msg, idx) => (
            <div
              key={idx}
              className={`flex ${
                msg.senderId === currentUser.id
                  ? "justify-end"
                  : "justify-start"
              }`}
            >
              <div
                className={`max-w-xs px-4 py-2 rounded-2xl shadow ${
                  msg.senderId === currentUser.id
                    ? "bg-blue-500 text-white rounded-br-none"
                    : "bg-gray-200 text-gray-900 rounded-bl-none"
                }`}
              >
                <p>{msg.message}</p>
                <small className="block text-xs opacity-70">
                  {new Date(msg.timestamp).toLocaleTimeString([], {
                    hour: "2-digit",
                    minute: "2-digit",
                  })}
                </small>
              </div>
            </div>
          ))}
        </div>

        {/* Input Box */}
        {selectedUser && (
          <div className="p-4 border-t bg-white flex items-center gap-2">
            <input
              type="text"
              placeholder="Type a message..."
              className="flex-1 p-2 border rounded-xl focus:outline-none focus:ring focus:ring-blue-300"
              onKeyDown={(e) => {
                if (e.key === "Enter" && e.target.value.trim()) {
                  sendMessage(e.target.value);
                  e.target.value = "";
                }
              }}
            />
            <button
              onClick={() => {
                const input = document.querySelector("input[type=text]");
                if (input.value.trim()) {
                  sendMessage(input.value);
                  input.value = "";
                }
              }}
              className="px-4 py-2 bg-blue-500 text-white rounded-xl hover:bg-blue-600"
            >
              Send
            </button>
          </div>
        )}
      </div>
    </div>
  );
};

export default ChatPage;
