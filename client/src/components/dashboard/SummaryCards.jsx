import React from "react";
import { Link } from "react-router-dom";

// Theme map for glassy bluish cards
const glassTheme = "bg-gradient-to-br from-[#252a43]/80 via-[#1a1d2e]/80 to-[#232746]/90 border border-blue-200 shadow-lg";

const SummaryCards = ({ data }) => (
  <div className="w-full">
    <div className="grid grid-cols-1 md:grid-cols-3 gap-8 mb-6">
      {data.map((item, idx) => (
        <div
          key={idx}
          className={`rounded-2xl px-8 py-7 flex flex-col justify-center items-start ${glassTheme}`}
          style={{
            boxShadow: "inset 0 1px 8px 0 rgba(91, 122, 201, 0.16), 0 4px 32px 0 rgba(36, 44, 92, 0.13)",
            borderWidth: "2px",
            backdropFilter: "blur(15px)",
            WebkitBackdropFilter: "blur(15px)",
            borderColor: "rgba(180,210,255,0.20)"
          }}
        >
          <span className="text-5xl font-extrabold mb-2 text-[#547bd1] tracking-tight drop-shadow-sm">{item.count}</span>
          <span className="text-lg font-semibold text-blue-100">{item.label}</span>
        </div>
      ))}
    </div>
    <div className="flex justify-end">
      <Link
        to="/tasks"
        className="px-5 py-2 rounded-xl font-bold bg-gradient-to-r from-yellow-200 via-yellow-300 to-orange-300 text-blue-900 shadow hover:from-yellow-300 hover:to-orange-400 tracking-tight transition"
        style={{
          backdropFilter: "blur(6px)",
          WebkitBackdropFilter: "blur(6px)"
        }}
      >
        View All Tasks →
      </Link>
    </div>
  </div>
);

export default SummaryCards;
