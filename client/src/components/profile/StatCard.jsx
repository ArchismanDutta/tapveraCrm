import React from "react";

const StatCard = ({ value, label, icon }) => {
  return (
    <div className="rounded-xl p-6 text-white shadow-lg bg-gradient-to-br from-[#fb994a] via-[#ff9625] to-[#c8d11f] w-full">
      {/* Icon Circle */}
      <div className="w-14 h-14 flex items-center justify-center rounded-full bg-white/20 shadow-md mb-4">
        <div className="text-white text-2xl">{icon}</div>
      </div>

      {/* Stat Value */}
      <h3 className="text-3xl font-bold leading-tight">{value}</h3>

      {/* Label */}
      <p className="text-white/80 text-sm mt-1">{label}</p>
    </div>
  );
};  

export default StatCard;
