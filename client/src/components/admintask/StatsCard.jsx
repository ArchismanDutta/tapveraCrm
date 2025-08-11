import React from "react";
import { motion } from "framer-motion";

const StatsCard = ({ title, value, colorScheme = "orange" }) => {
  // Define color schemes for different cards
  const colorSchemes = {
    blue: "bg-gradient-to-br from-blue-50 via-blue-100 to-blue-200 border-blue-200",
    green: "bg-gradient-to-br from-green-50 via-green-100 to-green-200 border-green-200",
    purple: "bg-gradient-to-br from-purple-50 via-purple-100 to-purple-200 border-purple-200",
    pink: "bg-gradient-to-br from-pink-50 via-pink-100 to-pink-200 border-pink-200",
    yellow: "bg-gradient-to-br from-yellow-50 via-yellow-100 to-yellow-200 border-yellow-200",
    orange: "bg-gradient-to-br from-orange-50 via-orange-100 to-orange-200 border-orange-200",
  };

  return (
    <motion.div
      whileHover={{
        scale: 1.02,
        boxShadow: "0 8px 20px rgba(255, 165, 0, 0.15)",
      }}
      transition={{ type: "spring", stiffness: 300, damping: 20 }}
      className={`
        relative
        rounded-3xl
        p-6
        shadow-md
        cursor-pointer
        select-none
        ${colorSchemes[colorScheme] || colorSchemes.orange}
        min-h-[140px]
        flex flex-col justify-between
      `}
    >
      {/* Large number at top-left */}
      <div className="flex justify-start">
        <span className="text-4xl font-bold text-black-500">{value}</span>
      </div>
      {/* Text at bottom-left */}
      <div className="flex justify-start">
        <span className="text-sm font-medium text-black-500 leading-tight">{title}</span>
      </div>
    </motion.div>
  );
};

export default StatsCard;
