// src/components/workstatus/BreakManagement.jsx
import React, { useState, useEffect } from "react";

const breakTypes = ["Lunch", "Coffee", "Personal"];

const breakTypeIcons = {
  Lunch: (
    <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 20 20">
      <path
        fillRule="evenodd"
        d="M6 2a2 2 0 00-2 2v12a2 2 0 002 2h8a2 2 0 002-2V4a2 2 0 00-2-2H6zm4 14a4 4 0 004-4v-2a4 4 0 00-4-4 4 4 0 00-4 4v2a4 4 0 004 4z"
        clipRule="evenodd"
      />
    </svg>
  ),
  Coffee: (
    <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 20 20">
      <path d="M2 6a2 2 0 012-2h5l2 2h5a2 2 0 012 2v6a2 2 0 01-2 2H4a2 2 0 01-2-2V6z" />
    </svg>
  ),
  Personal: (
    <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 20 20">
      <path
        fillRule="evenodd"
        d="M10 9a3 3 0 100-6 3 3 0 000 6zm-7 9a7 7 0 1114 0H3z"
        clipRule="evenodd"
      />
    </svg>
  ),
};

const BreakManagement = ({
  breakDuration = "0h 00m",
  onBreak = false,
  onStartBreak,
  onResumeWork,
  onSelectBreakType,
  selectedBreakType,
  currentlyWorking = false,
  isLoading = false,
}) => {
  const [localSelectedType, setLocalSelectedType] = useState(
    selectedBreakType || ""
  );

  // Keep local in sync with parent
  useEffect(() => {
    setLocalSelectedType(selectedBreakType || "");
  }, [selectedBreakType]);

  const handleBreakTypeClick = (type) => {
    if (onBreak || isLoading) return; // Don't allow selection while on break or loading

    setLocalSelectedType(type);
    if (onSelectBreakType) onSelectBreakType(type);
  };

  const handleStartBreak = () => {
    if (!localSelectedType || !currentlyWorking || onBreak || isLoading) {
      return;
    }
    onStartBreak(localSelectedType);
  };

  const handleResumeWork = () => {
    if (!onBreak || isLoading) {
      return;
    }
    onResumeWork();
  };

  return (
    <div className="bg-slate-800/50 backdrop-blur-sm border border-slate-700/50 rounded-lg shadow-xl p-3 transition-all h-full flex flex-col max-h-[300px]">
      {/* Header */}
      <div className="flex items-center justify-between mb-2">
        <h3 className="text-sm font-bold text-white">Break</h3>
        <div className="w-6 h-6 bg-gradient-to-r from-orange-500 to-red-500 rounded flex items-center justify-center">
          <svg
            className="w-3.5 h-3.5 text-white"
            fill="currentColor"
            viewBox="0 0 20 20"
          >
            <path
              fillRule="evenodd"
              d="M10 18a8 8 0 100-16 8 8 0 000 16zM7 9a1 1 0 100-2 1 1 0 000 2zm7-1a1 1 0 11-2 0 1 1 0 012 0zm-.464 5.535a1 1 0 10-1.415-1.414 3 3 0 01-4.242 0 1 1 0 00-1.415 1.414 5 5 0 007.072 0z"
              clipRule="evenodd"
            />
          </svg>
        </div>
      </div>

      {/* Loading Indicator */}
      {isLoading && (
        <div className="mb-2 p-1.5 bg-orange-500/20 border border-orange-500/30 rounded">
          <div className="flex items-center gap-1">
            <div className="w-2.5 h-2.5 bg-orange-400 rounded-full animate-pulse"></div>
            <span className="text-orange-400 text-xs">Processing...</span>
          </div>
        </div>
      )}

      {/* Break Duration Display */}
      <div className="bg-slate-900/60 p-2 rounded border border-slate-700/30 mb-2">
        <p className="text-xs text-gray-400 mb-0.5">Break Duration</p>
        <p className="text-lg font-mono font-bold text-white">{breakDuration}</p>
      </div>

      {/* Break Type Selection */}
      <div className="mb-2 flex-1">
        <p className="text-xs text-gray-300 mb-1.5">Select Type</p>
        <div className="grid grid-cols-3 gap-1.5">
          {breakTypes.map((type) => (
            <button
              key={type}
              onClick={() => handleBreakTypeClick(type)}
              className={`p-1.5 rounded font-medium transition-all border text-xs ${
                localSelectedType === type
                  ? "bg-gradient-to-r from-purple-500/20 to-pink-500/20 border-purple-400/50 text-purple-300"
                  : "bg-slate-900/40 border-slate-700/50 text-gray-300 hover:bg-slate-800/60"
              } ${
                onBreak || isLoading
                  ? "opacity-50 cursor-not-allowed"
                  : "cursor-pointer"
              }`}
              disabled={onBreak || isLoading}
            >
              {type}
            </button>
          ))}
        </div>
      </div>

      {/* Action Button */}
      <div className="space-y-1.5">
        {onBreak ? (
          <button
            onClick={handleResumeWork}
            disabled={isLoading}
            className={`w-full py-2 px-3 rounded-lg font-bold text-xs uppercase transition-all ${
              isLoading
                ? "bg-green-500/20 border border-green-500/30 text-green-400/60 cursor-not-allowed"
                : "bg-gradient-to-r from-green-500 to-emerald-600 hover:from-green-600 hover:to-emerald-700 text-white shadow-lg"
            }`}
          >
            {isLoading ? "..." : "Resume Work"}
          </button>
        ) : (
          <button
            onClick={handleStartBreak}
            disabled={!localSelectedType || !currentlyWorking || isLoading}
            className={`w-full py-2 px-3 rounded-lg font-bold text-xs uppercase transition-all ${
              localSelectedType && currentlyWorking && !isLoading
                ? "bg-gradient-to-r from-orange-500 to-red-600 hover:from-orange-600 hover:to-red-700 text-white shadow-lg"
                : "bg-slate-700/50 border border-slate-600/50 text-slate-400 cursor-not-allowed"
            }`}
          >
            {isLoading ? "..." : "Start Break"}
          </button>
        )}

        {/* Status indicator */}
        {onBreak && localSelectedType && (
          <div className="flex items-center justify-center gap-1.5 text-xs text-orange-400 bg-orange-500/10 border border-orange-500/20 rounded p-1.5">
            <div className="w-1.5 h-1.5 bg-orange-400 rounded-full animate-pulse"></div>
            <span>On <span className="font-semibold">{localSelectedType}</span></span>
          </div>
        )}

        {/* Validation Messages */}
        {!currentlyWorking && !onBreak && (
          <div className="text-center text-xs text-gray-400 bg-slate-700/30 border border-slate-600/30 rounded p-1.5">
            Must be working to start break
          </div>
        )}

        {!localSelectedType && currentlyWorking && !onBreak && (
          <div className="text-center text-xs text-gray-400 bg-slate-700/30 border border-slate-600/30 rounded p-1.5">
            Select break type first
          </div>
        )}
      </div>
    </div>
  );
};

export default BreakManagement;
