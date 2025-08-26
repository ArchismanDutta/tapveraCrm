import React, { useEffect, useState, useRef } from "react";
import { useSelector, useDispatch } from "react-redux";


import ContactsList from "../components/message/ContactList";
import ChatHeader from "../components/message/ChatHeader";
import MessagesList from "../components/message/MessagesList";
import ChatInput from "../components/message/ChatInput";

import {
  setUsers,
  selectUser as selectUserAction,
  addMessages,
  addMessage,
  setTypingUser,
  removeTypingUser,
  clearNewMessages,
} from "../store/slices/chatSlice";
import Sidebar from "../components/dashboard/Sidebar";

const ChatPage = ({ currentUser, onLogout }) => {
  const dispatch = useDispatch();

  const users = useSelector((state) => state.chat.users);
  const selectedUser = useSelector((state) => state.chat.selectedUser);
  const messagesByUser = useSelector((state) => state.chat.messagesByUser);
  const typingUsers = useSelector((state) => state.chat.typingUsers);
  const newMessagesByUser = useSelector(
    (state) => state.chat.newMessagesByUser
  );

  const [newMessage, setNewMessage] = useState("");
  const [searchTerm, setSearchTerm] = useState("");
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);

  const ws = useRef(null);
  const userId = currentUser.id || currentUser._id;

  useEffect(() => {
    // Fetch all users once
    fetch("/api/users/all", {
      headers: { Authorization: `Bearer ${localStorage.getItem("token")}` },
    })
      .then((res) => res.json())
      .then((data) => dispatch(setUsers(data)));
  }, [dispatch]);

  useEffect(() => {
    ws.current = new WebSocket("ws://localhost:5000");

    ws.current.onopen = () => {
      ws.current.send(JSON.stringify({ type: "register", userId }));
    };

    ws.current.onmessage = (event) => {
      const data = JSON.parse(event.data);

      if (data.type === "private_message") {
        const chatPartnerId =
          data.senderId === userId ? data.recipientId : data.senderId;

        dispatch(addMessage({ userId: chatPartnerId, message: data }));
      }

      if (data.type === "typing") {
        dispatch(setTypingUser(data.userId));
        setTimeout(() => dispatch(removeTypingUser(data.userId)), 2000);
      }
    };

    return () => ws.current && ws.current.close();
  }, [userId, dispatch]);

  const selectUser = (user) => {
    dispatch(selectUserAction(user));
    dispatch(clearNewMessages(user._id));

    if (!messagesByUser[user._id]) {
      fetch(`/api/chat/${user._id}`, {
        headers: { Authorization: `Bearer ${localStorage.getItem("token")}` },
      })
        .then((res) => res.json())
        .then((msgs) =>
          dispatch(addMessages({ userId: user._id, messages: msgs }))
        );
    }
  };

  const sendMessage = () => {
    if (!newMessage.trim() || !ws.current || !selectedUser) return;

    const messageObj = {
      type: "private_message",
      senderId: userId,
      recipientId: selectedUser._id,
      message: newMessage,
      timestamp: new Date(),
    };

    ws.current.send(JSON.stringify(messageObj));
    dispatch(addMessage({ userId: selectedUser._id, message: messageObj }));
    setNewMessage("");
  };

  const handleTyping = () => {
    if (ws.current && selectedUser) {
      ws.current.send(
        JSON.stringify({
          type: "typing",
          userId,
          recipientId: selectedUser._id,
        })
      );
    }
  };

  const messagesToShow = selectedUser
    ? messagesByUser[selectedUser._id] || []
    : [];

  const filteredUsers = users.filter((u) =>
    u.name.toLowerCase().includes(searchTerm.toLowerCase())
  );

  return (
    <div className="flex h-screen overflow-hidden">
      {/* Sidebar (unchanged) */}
      <Sidebar
        collapsed={sidebarCollapsed}
        setCollapsed={setSidebarCollapsed}
        onLogout={onLogout}
      />

      {/* Main Chat Area with margin-left */}
      <div
        className={`flex-1 flex bg-gray-50 h-full overflow-hidden transition-all duration-300
    ${sidebarCollapsed ? "ml-20" : "ml-64"}`}
      >
        <div className="flex flex-col flex-1 h-full overflow-hidden">
          <ChatHeader selectedUser={selectedUser} typingUsers={typingUsers} />

          <MessagesList
            messagesToShow={messagesToShow}
            userId={userId}
            typingUsers={typingUsers}
            selectedUser={selectedUser}
          />

          {selectedUser && (
            <ChatInput
              newMessage={newMessage}
              setNewMessage={setNewMessage}
              sendMessage={sendMessage}
              handleTyping={handleTyping}
            />
          )}
        </div>

        <ContactsList
          filteredUsers={filteredUsers}
          selectedUser={selectedUser}
          newMessagesByUser={newMessagesByUser}
          selectUser={selectUser}
          searchTerm={searchTerm}
          setSearchTerm={setSearchTerm}
        />
      </div>
    </div>
  );
};

export default ChatPage;
