// src/components/workstatus/BreakManagement.jsx
import React, { useState, useEffect } from "react";

const breakTypes = ["Lunch", "Coffee", "Personal"];

const breakTypeIcons = {
  Lunch: (
    <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 20 20">
      <path fillRule="evenodd" d="M6 2a2 2 0 00-2 2v12a2 2 0 002 2h8a2 2 0 002-2V4a2 2 0 00-2-2H6zm4 14a4 4 0 004-4v-2a4 4 0 00-4-4 4 4 0 00-4 4v2a4 4 0 004 4z" clipRule="evenodd" />
    </svg>
  ),
  Coffee: (
    <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 20 20">
      <path d="M2 6a2 2 0 012-2h5l2 2h5a2 2 0 012 2v6a2 2 0 01-2 2H4a2 2 0 01-2-2V6z" />
    </svg>
  ),
  Personal: (
    <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 20 20">
      <path fillRule="evenodd" d="M10 9a3 3 0 100-6 3 3 0 000 6zm-7 9a7 7 0 1114 0H3z" clipRule="evenodd" />
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
}) => {
  const [localSelectedType, setLocalSelectedType] = useState(selectedBreakType || "");

  // Keep local in sync with parent
  useEffect(() => {
    setLocalSelectedType(selectedBreakType || "");
  }, [selectedBreakType]);

  const handleBreakTypeClick = (type) => {
    setLocalSelectedType(type);
    if (onSelectBreakType) onSelectBreakType(type);
  };

  return (
    <div className="bg-slate-800/50 backdrop-blur-sm border border-slate-700/50 rounded-2xl shadow-xl p-6 transition-all hover:shadow-2xl hover:border-slate-600/50">
      
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <h3 className="text-xl font-bold text-white">Break Management</h3>
        <div className="w-10 h-10 bg-gradient-to-r from-orange-500 to-red-500 rounded-xl flex items-center justify-center">
          <svg className="w-5 h-5 text-white" fill="currentColor" viewBox="0 0 20 20">
            <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zM7 9a1 1 0 100-2 1 1 0 000 2zm7-1a1 1 0 11-2 0 1 1 0 012 0zm-.464 5.535a1 1 0 10-1.415-1.414 3 3 0 01-4.242 0 1 1 0 00-1.415 1.414 5 5 0 007.072 0z" clipRule="evenodd" />
          </svg>
        </div>
      </div>

      {/* Break Duration Display */}
      <div className="bg-slate-900/60 p-4 rounded-xl border border-slate-700/30 mb-6">
        <p className="text-sm font-medium text-gray-400 mb-1">Current Break Duration</p>
        <p className="text-3xl font-mono font-bold text-white">{breakDuration}</p>
      </div>

      {/* Break Type Selection */}
      <div className="mb-6">
        <p className="text-sm font-medium text-gray-300 mb-3">Select Break Type</p>
        <div className="grid grid-cols-3 gap-3">
          {breakTypes.map((type) => (
            <button
              key={type}
              onClick={() => handleBreakTypeClick(type)}
              className={`p-3 rounded-xl font-medium transition-all duration-200 border ${
                localSelectedType === type
                  ? "bg-gradient-to-r from-purple-500/20 to-pink-500/20 border-purple-400/50 text-purple-300 shadow-lg"
                  : "bg-slate-900/40 border-slate-700/50 text-gray-300 hover:bg-slate-800/60 hover:border-slate-600/50"
              }`}
              disabled={onBreak}
            >
              <div className="flex flex-col items-center space-y-2">
                <div className={`${localSelectedType === type ? 'text-purple-400' : 'text-gray-400'}`}>
                  {breakTypeIcons[type]}
                </div>
                <span className="text-xs">{type}</span>
              </div>
            </button>
          ))}
        </div>
      </div>

      {/* Action Button */}
      <div className="space-y-3">
        {onBreak ? (
          <button
            onClick={onResumeWork}
            className="w-full bg-gradient-to-r from-green-500 to-emerald-600 hover:from-green-600 hover:to-emerald-700 text-white py-4 px-6 rounded-xl font-bold text-sm uppercase tracking-wide shadow-lg hover:shadow-green-500/25 transition-all duration-200 transform hover:scale-105"
          >
            Resume Work
          </button>
        ) : (
          <button
            onClick={() => onStartBreak(localSelectedType)}
            disabled={!localSelectedType || !currentlyWorking}
            className={`w-full py-4 px-6 rounded-xl font-bold text-sm uppercase tracking-wide transition-all duration-200 ${
              localSelectedType && currentlyWorking
                ? "bg-gradient-to-r from-orange-500 to-red-600 hover:from-orange-600 hover:to-red-700 text-white shadow-lg hover:shadow-orange-500/25 transform hover:scale-105"
                : "bg-slate-700/50 border border-slate-600/50 text-slate-400 cursor-not-allowed"
            }`}
          >
            Start Break
          </button>
        )}

        {/* Status indicator */}
        {onBreak && localSelectedType && (
          <div className="flex items-center justify-center space-x-2 text-sm text-orange-400 bg-orange-500/10 border border-orange-500/20 rounded-lg p-3">
            <div className="w-2 h-2 bg-orange-400 rounded-full animate-pulse"></div>
            <span>Currently on <span className="font-semibold">{localSelectedType}</span> break</span>
          </div>
        )}
      </div>
    </div>
  );
};

export default BreakManagement;