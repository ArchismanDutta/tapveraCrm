import React from "react";

const GRADIENTS = [
  "from-blue-400 via-blue-500 to-blue-600",
  "from-purple-400 via-purple-500 to-purple-600",
  "from-green-400 via-green-500 to-green-600",
];

const StatCard = ({ value, label, icon, index = 0 }) => {
  const gradientClass = GRADIENTS[index % GRADIENTS.length];
  return (
    <div
      className={`rounded-2xl p-7 text-white shadow-lg bg-gradient-to-br ${gradientClass} w-full`}
    >
      <div className="w-14 h-14 flex items-center justify-center rounded-full bg-white/30 shadow mb-4">
        <span className="text-white text-2xl">{icon}</span>
      </div>
      <h3 className="text-3xl font-bold leading-tight">{value}</h3>
      <p className="text-white text-sm mt-2">{label}</p>
    </div>
  );
};

export default StatCard;
