// src/components/profile/ProfileHeader.jsx
import React from "react";
import { Edit2, MessageCircle } from "lucide-react";

const ProfileHeader = ({ avatar, name, role, onEdit, onMessage }) => {
  return (
    <div className="bg-white p-6 rounded-lg shadow flex items-center gap-6">
      <img src={avatar} alt={name} className="w-24 h-24 rounded-full object-cover border" />
      <div className="flex-1">
        <h1 className="text-xl font-semibold">{name}</h1>
        <p className="text-gray-600">{role}</p>
        <div className="mt-3 flex gap-3">
          <button onClick={onEdit} className="flex items-center gap-1 px-3 py-1 border rounded hover:bg-gray-100">
            <Edit2 size={16} /> Edit
          </button>
          <button onClick={onMessage} className="flex items-center gap-1 px-3 py-1 border rounded hover:bg-gray-100">
            <MessageCircle size={16} /> Message
          </button>
        </div>
      </div>
    </div>
  );
};

export default ProfileHeader;
