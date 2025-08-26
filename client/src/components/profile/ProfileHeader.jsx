import React from "react";
import { Edit2, MessageCircle } from "lucide-react";
import { useNavigate } from "react-router-dom";

const ProfileHeader = ({ avatar, name, role, team, onEdit }) => {
  const navigate = useNavigate();

  const handleMessageClick = () => {
    navigate("/messages");
  };

  return (
    <div
      className="bg-[#181d2a]/70 backdrop-blur-xl p-7 rounded-3xl shadow-2xl flex items-center gap-8 max-w-3xl mx-auto mt-4 border border-[#262e4a]"
      style={{
        boxShadow: "inset 0 1px 10px 0 rgba(91, 122, 201, 0.18), 0 6px 30px 0 rgba(36, 44, 92, 0.15)",
        backdropFilter: "blur(16px)",
        WebkitBackdropFilter: "blur(16px)",
      }}
    >
      <img
        src={avatar}
        alt={name}
        className="w-28 h-28 rounded-full object-cover border-4 border-[#262e4a] shadow-lg"
      />
      <div className="flex-1">
        <h1 className="text-2xl font-semibold text-blue-100">{name}</h1>
        <div className="flex gap-4 mt-2 text-blue-400">
          <span className="bg-[#232842] text-[#ff8000] px-4 py-1 rounded-full text-xs font-bold tracking-wide">
            {role}
          </span>
          <span className="bg-[#232842] text-[#66ff99] px-4 py-1 rounded-full text-xs font-bold tracking-wide">
            {team}
          </span>
        </div>
        <div className="mt-5 flex gap-4">
          <button
            onClick={onEdit}
            className="flex items-center gap-2 px-5 py-2 rounded-lg bg-[#232842] hover:bg-[#2c3461] border border-[#262e4a] text-[#ff8000] font-semibold transition shadow-md"
          >
            <Edit2 size={18} />
            <span>Edit</span>
          </button>
          <button
            onClick={handleMessageClick}
            className="flex items-center gap-2 px-5 py-2 rounded-lg bg-[#232842] hover:bg-[#2c3461] border border-[#262e4a] text-[#66ff99] font-semibold transition shadow-md"
          >
            <MessageCircle size={18} />
            <span>Message</span>
          </button>
        </div>
      </div>
    </div>
  );
};

export default ProfileHeader;
