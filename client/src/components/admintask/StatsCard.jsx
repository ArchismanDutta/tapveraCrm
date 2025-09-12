// File: src/components/admintask/StatsCard.jsx
import React from "react";
import { motion } from "framer-motion";

const StatsCard = ({ title, value, colorScheme = "orange", onClick }) => {
  const colorSchemes = {
    blue: "bg-gradient-to-br from-[#324a9f] via-[#2b3f8c] to-[#20316c] border border-[#2b3f8c] text-blue-200",
    green: "bg-gradient-to-br from-[#3a7553] via-[#336b4c] to-[#2a543c] border border-[#336b4c] text-green-200",
    purple: "bg-gradient-to-br from-[#604a7b] via-[#563f6f] to-[#462f59] border border-[#563f6f] text-purple-200",
    pink: "bg-gradient-to-br from-[#a35267] via-[#913c51] to-[#702c3e] border border-[#913c51] text-pink-200",
    yellow: "bg-gradient-to-br from-[#b89c57] via-[#a2864c] to-[#7f6835] border border-[#a2864c] text-yellow-900",
    orange:
      "bg-gradient-to-br from-[#bf6f2f] via-[#af632a] to-[#8c4f1f] border border-[#af632a] text-yellow-900",
    teal: "bg-gradient-to-br from-[#2a9d8f] via-[#238f82] to-[#1f7a6e] border border-[#238f82] text-teal-50",
  };

  return (
    <motion.div
      whileHover={{
        scale: 1.03,
        boxShadow: "0 8px 24px rgba(191, 111, 47, 0.18)",
      }}
      transition={{ type: "spring", stiffness: 260, damping: 22 }}
      onClick={onClick}
      className={`relative rounded-3xl p-6 shadow-md cursor-pointer select-none min-h-[140px] flex flex-col justify-center ${colorSchemes[colorScheme] || colorSchemes.orange}`}
    >
      <div>
        <span className="text-4xl font-bold">{value}</span>
      </div>
      <div>
        <span className="text-sm font-semibold leading-tight">{title}</span>
      </div>
    </motion.div>
  );
};

export default StatsCard;
