import React from "react";

// Not using pastel gradients, but instead a translucent dark background for glass-morphism effect
const GLASS_BG = "bg-[rgba(22,28,48,0.68)]";
const GLASS_BORDER = "border border-[rgba(84,123,209,0.13)]";
const GLASS_SHADOW =
  "shadow-[0_8px_32px_0_rgba(10,40,100,0.14),_inset_0_1.5px_10px_0_rgba(84,123,209,0.08)]";
const GLASS_BLUR = "backdrop-blur-[10px]";

// The StatCard
const StatCard = ({ value, label }) => (
  <div
    className={`rounded-2xl p-8 min-w-[220px] flex flex-col justify-center ${GLASS_BG} ${GLASS_BORDER} ${GLASS_SHADOW} ${GLASS_BLUR} transition duration-300`}
    style={{
      boxShadow:
        "0 8px 32px 0 rgba(10,40,100,0.14), 0 1.5px 10px 0 rgba(84,123,209,0.08) inset",
      background: "rgba(22,28,48,0.68)",
      border: "1.5px solid rgba(84,123,209,0.13)",
      backdropFilter: "blur(10px)",
      WebkitBackdropFilter: "blur(10px)",
    }}
  >
    <div className="text-5xl font-extrabold text-[#e83e18] mb-1">{value}</div>
    <div className="text-lg font-semibold text-blue-100">{label}</div>
  </div>
);

export default StatCard;
