import React from "react";
import { Edit2, MessageCircle } from "lucide-react";
import { useNavigate } from "react-router-dom"; // Import useNavigate

const ProfileHeader = ({ avatar, name, role, team, onEdit }) => {
  const navigate = useNavigate();

  const handleMessageClick = () => {
    navigate("/messages");
  };

  return (
    <div className="bg-[#181d2a]/70 backdrop-blur-xl p-7 rounded-2xl shadow flex items-center gap-8 max-w-3xl mx-auto mt-2 border border-[#262e4a]">
      <img
        src={avatar}
        alt={name}
        className="w-28 h-28 rounded-full object-cover border-4 border-[#262e4a] shadow"
      />
      <div className="flex-1">
        <h1 className="text-2xl font-semibold text-blue-100">{name}</h1>
        <div className="flex gap-4 mt-1 text-blue-400">
          <span className="bg-[#232842] text-[#ff8000] px-3 py-1 rounded-full text-xs font-bold">
            {role}
          </span>
          <span className="bg-[#232842] text-[#66ff99] px-3 py-1 rounded-full text-xs font-bold">
            {team}
          </span>
        </div>
        <div className="mt-4 flex gap-3">
          <button
            onClick={onEdit}
            className="flex items-center gap-2 px-4 py-2 rounded-lg bg-[#232842] hover:bg-[#2c3461] border border-[#262e4a] text-[#ff8000] transition"
          >
            <Edit2 size={18} />{" "}
            <span className="font-semibold">Edit</span>
          </button>
          <button
            onClick={handleMessageClick}
            className="flex items-center gap-2 px-4 py-2 rounded-lg bg-[#232842] hover:bg-[#2c3461] border border-[#262e4a] text-[#66ff99] transition"
          >
            <MessageCircle size={18} />{" "}
            <span className="font-semibold">Message</span>
          </button>
        </div>
      </div>
    </div>
  );
};

export default ProfileHeader;
