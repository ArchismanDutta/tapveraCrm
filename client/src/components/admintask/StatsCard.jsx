import React from "react";
import { motion } from "framer-motion";

const StatCard = ({ title, value, icon: Icon }) => {
  return (
    <motion.div
      whileHover={{
        scale: 1.05,
        boxShadow: "0 20px 35px rgba(255,165,0,0.35)",
      }}
      transition={{ type: "spring", stiffness: 300, damping: 20 }}
      className="relative rounded-2xl p-6 shadow-lg overflow-hidden cursor-pointer select-none 
                 bg-gradient-to-br from-yellow-300 via-yellow-400 to-orange-400 text-black border border-yellow-200"
    >
      {/* Decorative light gradient overlay */}
      <div className="absolute inset-0 opacity-10 pointer-events-none bg-[radial-gradient(circle_at_top_left,white,transparent)]"></div>
      
      {/* Glow Effect */}
      <div className="absolute top-0 left-0 w-full h-full bg-gradient-to-br from-white/20 to-transparent opacity-30 pointer-events-none"></div>

      {/* Icon Section */}
      {Icon && (
        <div className="w-14 h-14 flex items-center justify-center bg-white/25 backdrop-blur-sm rounded-xl mb-4 shadow-md">
          <Icon className="text-black text-3xl drop-shadow-sm" />
        </div>
      )}

      {/* Title */}
      <span className="block text-sm font-semibold opacity-90 tracking-wide">
        {title}
      </span>

      {/* Value */}
      <span className="block text-5xl font-extrabold mt-2 drop-shadow-md">
        {value}
      </span>

      {/* Bottom highlight bar */}
      <div className="absolute bottom-0 left-0 w-full h-1 bg-gradient-to-r from-yellow-300 via-orange-400 to-yellow-300 opacity-50"></div>
    </motion.div>
  );
};

export default StatCard;
