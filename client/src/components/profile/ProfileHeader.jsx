import React from "react";
import { Edit2, MessageCircle } from "lucide-react";
import { useNavigate } from "react-router-dom"; // Import useNavigate

const ProfileHeader = ({ avatar, name, role, team, onEdit }) => {
  const navigate = useNavigate(); // Initialize navigation

  const handleMessageClick = () => {
    // Redirect to the messages page (you can change the path as needed)
    navigate("/messages");
  };

  return (
    <div className="bg-white p-7 rounded-2xl shadow flex items-center gap-8 max-w-3xl mx-auto mt-2">
      <img
        src={avatar}
        alt={name}
        className="w-28 h-28 rounded-full object-cover border-4 border-blue-100 shadow"
      />
      <div className="flex-1">
        <h1 className="text-2xl font-semibold">{name}</h1>
        <div className="flex gap-4 mt-1 text-gray-600">
          <span className="bg-blue-50 text-blue-700 px-3 py-1 rounded-full text-xs font-bold">
            {role}
          </span>
          <span className="bg-green-50 text-green-700 px-3 py-1 rounded-full text-xs font-bold">
            {team}
          </span>
        </div>
        <div className="mt-4 flex gap-3">
          <button
            onClick={onEdit}
            className="flex items-center gap-2 px-4 py-2 rounded-lg bg-blue-50 hover:bg-blue-100 border transition"
          >
            <Edit2 size={18} /> <span className="text-blue-700 font-semibold">Edit</span>
          </button>
          <button
            onClick={handleMessageClick}
            className="flex items-center gap-2 px-4 py-2 rounded-lg bg-green-50 hover:bg-green-100 border transition"
          >
            <MessageCircle size={18} /> <span className="text-green-700 font-semibold">Message</span>
          </button>
        </div>
      </div>
    </div>
  );
};

export default ProfileHeader;
