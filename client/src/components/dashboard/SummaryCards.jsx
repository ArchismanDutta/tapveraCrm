import React from "react";
import { Link } from "react-router-dom";
import { TrendingUp, TrendingDown, Minus } from "lucide-react";

// Theme map for glassy bluish cards
const glassTheme = "bg-gradient-to-br from-[#252a43]/80 via-[#1a1d2e]/80 to-[#232746]/90 border border-blue-200 shadow-lg";

const SummaryCards = ({ data }) => (
  <div className="w-full">
    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-6">
      {data.map((item, idx) => {
        const Icon = item.icon;
        return (
          <div
            key={idx}
            className={`rounded-2xl px-6 py-6 flex flex-col justify-between items-start ${glassTheme} relative overflow-hidden group hover:scale-105 transition-all duration-300`}
            style={{
              boxShadow: "inset 0 1px 8px 0 rgba(91, 122, 201, 0.16), 0 4px 32px 0 rgba(36, 44, 92, 0.13)",
              borderWidth: "2px",
              backdropFilter: "blur(15px)",
              WebkitBackdropFilter: "blur(15px)",
              borderColor: item.urgent ? "rgba(255, 100, 100, 0.40)" : "rgba(180,210,255,0.20)"
            }}
          >
            {/* Background icon */}
            {Icon && (
              <div className="absolute top-2 right-2 opacity-10 group-hover:opacity-20 transition-opacity">
                <Icon className="w-12 h-12" />
              </div>
            )}

            {/* Urgent indicator */}
            {item.urgent && (
              <div className="absolute top-0 right-0 w-3 h-3 bg-red-500 rounded-full animate-pulse"></div>
            )}

            <div className="flex items-center justify-between w-full mb-2">
              <div className="flex items-center gap-2">
                {Icon && (
                  <div className={`p-2 rounded-lg ${
                    item.color === "red" ? "bg-red-500/20 text-red-400" :
                    item.color === "orange" ? "bg-orange-500/20 text-orange-400" :
                    item.color === "green" ? "bg-green-500/20 text-green-400" :
                    "bg-blue-500/20 text-blue-400"
                  }`}>
                    <Icon className="w-4 h-4" />
                  </div>
                )}
                <span className="text-lg font-semibold text-blue-100">{item.label}</span>
              </div>
              {item.trend && (
                <div className="flex items-center gap-1 text-xs">
                  {item.trend.includes("+") ? (
                    <TrendingUp className="w-3 h-3 text-green-400" />
                  ) : item.trend.includes("-") ? (
                    <TrendingDown className="w-3 h-3 text-red-400" />
                  ) : (
                    <Minus className="w-3 h-3 text-gray-400" />
                  )}
                  <span className={item.trend.includes("+") ? "text-green-400" : item.trend.includes("-") ? "text-red-400" : "text-gray-400"}>
                    {item.trend}
                  </span>
                </div>
              )}
            </div>

            <div className="flex items-end justify-between w-full">
              <span className={`text-4xl font-extrabold tracking-tight drop-shadow-sm ${
                item.urgent ? "text-red-400" : "text-[#547bd1]"
              }`}>
                {item.count}
              </span>
              {item.urgent && (
                <div className="text-xs text-red-400 font-medium">
                  Urgent
                </div>
              )}
            </div>
          </div>
        );
      })}
    </div>
    <div className="flex justify-end">
      <Link
        to="/tasks"
        className="px-6 py-3 rounded-xl font-semibold bg-gradient-to-r from-[#547bd1] to-[#4a6bc2] text-white shadow-lg hover:from-[#4a6bc2] hover:to-[#3f5ba8] transition-all duration-200 border border-blue-400/30"
        style={{
          backdropFilter: "blur(10px)",
          WebkitBackdropFilter: "blur(10px)",
          boxShadow: "0 4px 15px rgba(84, 123, 209, 0.3)"
        }}
      >
        View All Tasks →
      </Link>
    </div>
  </div>
);

export default SummaryCards;
