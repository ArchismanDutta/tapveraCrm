import React, { useEffect, useState } from "react";
import axios from "axios";

const ChatSidebar = ({ onSelectUser }) => {
  const [users, setUsers] = useState([]);

  useEffect(() => {
    const fetchUsers = async () => {
      try {
        const token = localStorage.getItem("token");
        const res = await axios.get("http://localhost:5000/api/chat/users", {
          headers: { Authorization: `Bearer ${token}` },
        });
        setUsers(res.data);
      } catch (err) {
        console.error("Error fetching users", err);
      }
    };
    fetchUsers();
  }, []);

  return (
    <div className="w-1/4 bg-gray-100 p-4">
      <h2 className="text-lg font-bold mb-4">Chats</h2>
      {users.map((user) => (
        <div
          key={user._id}
          onClick={() => onSelectUser(user)}
          className="cursor-pointer p-2 hover:bg-gray-200 rounded"
        >
          {user.name}
        </div>
      ))}
    </div>
  );
};

export default ChatSidebar;
