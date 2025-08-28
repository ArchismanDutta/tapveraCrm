// File: src/components/humanResource/StatCard.jsx
import React from "react";

const StatCard = ({ icon, title, value, subtitle, color, onClick }) => (
  <div
    onClick={onClick}
    className="bg-[#1a1f36] border border-gray-700 rounded-2xl shadow-lg p-5 flex items-center gap-4 hover:bg-[#222945] transition cursor-pointer"
  >
    <div
      className={`p-4 rounded-2xl flex items-center justify-center text-2xl text-white shadow-md ${color}`}
    >
      {icon}
    </div>
    <div>
      <h4 className="text-gray-400 text-sm">{title}</h4>
      <p className="text-3xl font-bold text-gray-100">{value}</p>
      {subtitle && <span className="text-xs font-medium text-gray-500">{subtitle}</span>}
    </div>
  </div>
);

export default StatCard;
