// src/components/workstatus/StatusCard.jsx
import React from "react";

const StatusCard = ({
  workDuration,
  breakTime,
  arrivalTime,
  currentlyWorking,
  alreadyPunchedIn = false,
  onPunchIn,
  onPunchOut,
  onRequestFlexible,
  isLoading = false,
}) => {
  // Convert arrivalTime to local time string; handle ISO Date, Date object, or already-formatted string
  const formattedArrivalTime = (() => {
    console.log("🔍 StatusCard arrivalTime received:", arrivalTime, typeof arrivalTime);
    if (!arrivalTime) return "--";
    // If it's already a string that isn't parseable as date, show as-is
    if (typeof arrivalTime === "string") {
      const parsed = new Date(arrivalTime);
      if (isNaN(parsed.getTime())) return arrivalTime;
      return parsed.toLocaleTimeString([], {
        hour: "2-digit",
        minute: "2-digit",
        hour12: true,
      });
    }
    if (arrivalTime instanceof Date) {
      return arrivalTime.toLocaleTimeString([], {
        hour: "2-digit",
        minute: "2-digit",
        hour12: true,
      });
    }
    // Fallback: try to convert
    const parsed = new Date(arrivalTime);
    if (isNaN(parsed.getTime())) return "--";
    return parsed.toLocaleTimeString([], {
      hour: "2-digit",
      minute: "2-digit",
      hour12: true,
    });
  })();

  return (
    <div className="bg-[#161c2c] border border-[#232945] rounded-lg shadow-md p-3 transition-all hover:border-[#2c3454]">
      {/* Loading Indicator */}
      {isLoading && (
        <div className="mb-2 p-1.5 bg-cyan-500/20 border border-cyan-500/30 rounded">
          <div className="flex items-center gap-1">
            <div className="w-2.5 h-2.5 bg-cyan-400 rounded-full animate-pulse"></div>
            <span className="text-cyan-400 text-xs">Processing...</span>
          </div>
        </div>
      )}

      {/* Stats Grid */}
      <div className="grid grid-cols-3 gap-2 mb-3">
        <div className="bg-[#0f1419] p-2 rounded border border-[#232945]">
          <div className="flex items-center justify-between mb-1">
            <p className="text-xs text-gray-400">Work</p>
            <div className="w-5 h-5 bg-cyan-500 rounded flex items-center justify-center">
              <svg className="w-3 h-3 text-white" fill="currentColor" viewBox="0 0 20 20">
                <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm1-12a1 1 0 10-2 0v4a1 1 0 00.293.707l2.828 2.829a1 1 0 101.415-1.415L11 9.586V6z" clipRule="evenodd" />
              </svg>
            </div>
          </div>
          <p className="text-lg font-bold text-white">{workDuration}</p>
        </div>

        <div className="bg-[#0f1419] p-2 rounded border border-[#232945]">
          <div className="flex items-center justify-between mb-1">
            <p className="text-xs text-gray-400">Break</p>
            <div className="w-5 h-5 bg-orange-500 rounded flex items-center justify-center">
              <svg className="w-3 h-3 text-white" fill="currentColor" viewBox="0 0 20 20">
                <path fillRule="evenodd" d="M4 4a2 2 0 00-2 2v8a2 2 0 002 2h12a2 2 0 002-2V6a2 2 0 00-2-2H4zm0 2h12v8H4V6z" clipRule="evenodd" />
              </svg>
            </div>
          </div>
          <p className="text-lg font-bold text-white">{breakTime}</p>
        </div>

        <div className="bg-[#0f1419] p-2 rounded border border-[#232945]">
          <div className="flex items-center justify-between mb-1">
            <p className="text-xs text-gray-400">Arrival</p>
            <div className="w-5 h-5 bg-green-500 rounded flex items-center justify-center">
              <svg className="w-3 h-3 text-white" fill="currentColor" viewBox="0 0 20 20">
                <path fillRule="evenodd" d="M6 2a1 1 0 00-1 1v1H4a2 2 0 00-2 2v10a2 2 0 002 2h12a2 2 0 002-2V6a2 2 0 00-2-2h-1V3a1 1 0 10-2 0v1H7V3a1 1 0 00-1-1zm0 5a1 1 0 000 2h8a1 1 0 100-2H6z" clipRule="evenodd" />
              </svg>
            </div>
          </div>
          <p className="text-lg font-bold text-white">{formattedArrivalTime}</p>
        </div>
      </div>

      {/* Action Buttons */}
      <div className="grid grid-cols-3 gap-2">
        <button
          onClick={onPunchIn}
          disabled={currentlyWorking || alreadyPunchedIn || isLoading}
          className={`py-4 px-3 rounded-lg font-bold text-xs uppercase transition-all ${
            currentlyWorking || alreadyPunchedIn || isLoading
              ? "bg-green-500/20 border border-green-500/30 text-green-400/60 cursor-not-allowed"
              : "bg-gradient-to-r from-green-500 to-emerald-600 hover:from-green-600 hover:to-emerald-700 text-white shadow-lg"
          }`}
        >
          {isLoading ? "..." : alreadyPunchedIn ? "Punched" : "Punch In"}
        </button>

        <button
          onClick={onPunchOut}
          disabled={!currentlyWorking || isLoading}
          className={`py-2 px-3 rounded-lg font-bold text-xs uppercase transition-all ${
            !currentlyWorking || isLoading
              ? "bg-orange-500/20 border border-orange-500/30 text-orange-400/60 cursor-not-allowed"
              : "bg-gradient-to-r from-orange-500 to-red-600 hover:from-orange-600 hover:to-red-700 text-white shadow-lg"
          }`}
        >
          {isLoading ? "..." : "Punch Out"}
        </button>

        <button
          onClick={onRequestFlexible}
          disabled={currentlyWorking || isLoading}
          className={`py-2 px-3 rounded-lg font-bold text-xs uppercase transition-all ${
            currentlyWorking || isLoading
              ? "bg-blue-500/20 border border-blue-500/30 text-blue-400/60 cursor-not-allowed"
              : "bg-gradient-to-r from-blue-500 to-purple-600 hover:from-blue-600 hover:to-purple-700 text-white shadow-lg"
          }`}
        >
          {isLoading ? "..." : "Flexible"}
        </button>
      </div>
    </div>
  );
};

export default StatusCard;
