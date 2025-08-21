import React, { useEffect, useState } from "react";
import { fetchUsers, getOrCreateConversation } from "../../api/api";

const Sidebar = ({ selectedChat, onSelectChat }) => {
  const [users, setUsers] = useState([]);
  const meId = localStorage.getItem("userId")?.toString();

  useEffect(() => {
    const loadUsers = async () => {
      try {
        const data = await fetchUsers();
        // Exclude self from the list just in case
        const filtered = data.filter((user) => user._id.toString() !== meId);
        setUsers(filtered);
      } catch (err) {
        console.error(err);
      }
    };
    loadUsers();
  }, [meId]);

  const handleUserClick = async (user) => {
    try {
      const conversation = await getOrCreateConversation(user._id);
      onSelectChat(conversation);
    } catch (err) {
      console.error("Failed to open conversation:", err);
    }
  };

  return (
    <div className="w-64 border-r h-full overflow-y-auto bg-gray-50 shadow">
      <h2 className="p-4 font-bold text-lg border-b">Employees</h2>
      {users.length === 0 && (
        <div className="p-4 text-gray-400">No other employees found</div>
      )}
      {users.map((user) => {
        // Check if this user is part of the currently selected conversation
        const isSelected =
          selectedChat?.members?.some((m) => m._id.toString() === user._id.toString());

        return (
          <div
            key={user._id}
            onClick={() => handleUserClick(user)}
            className={`p-3 cursor-pointer flex justify-between items-center hover:bg-gray-100 ${
              isSelected ? "bg-gray-200" : ""
            }`}
          >
            <span className="font-medium">{user.name}</span>
            <span className="text-xs text-gray-500">{user.role}</span>
          </div>
        );
      })}
    </div>
  );
};

export default Sidebar;
