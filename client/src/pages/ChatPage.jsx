import React, { useState } from "react";
import Sidebar from "../components/chat/Sidebar";
import ChatPanel from "../components/chat/ChatPanel";
import DetailsPanel from "../components/chat/DetailsPanel";

const ChatPage = () => {
  const [selectedChat, setSelectedChat] = useState(null);

  return (
    <div className="flex h-screen">
      <Sidebar selectedChat={selectedChat} onSelectChat={setSelectedChat} />
      <div className="flex-1 flex">
        {selectedChat ? (
          <>
            <ChatPanel selectedChat={selectedChat} />
            <DetailsPanel selectedChat={selectedChat} />
          </>
        ) : (
          <div className="flex-1 flex items-center justify-center text-gray-400">
            Select an employee to start chatting
          </div>
        )}
      </div>
    </div>
  );
};

export default ChatPage;
