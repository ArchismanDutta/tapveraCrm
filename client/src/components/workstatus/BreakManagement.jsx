// File: src/components/workstatus/BreakManagement.jsx
import React, { useState, useEffect } from "react";

const breakTypes = ["Lunch", "Coffee", "Personal"];

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
    <div className="bg-[#161c2c] p-4 rounded-xl shadow-md space-y-3 w-full border border-[#232945]">
      <h3 className="font-semibold text-lg border-b border-[#232945] pb-2 text-gray-100">
        Break Management
      </h3>

      {/* Break Duration */}
      <p className="text-xl font-mono font-semibold text-orange-400">{breakDuration}</p>

      {/* Start / Resume Button */}
      <div className="flex flex-col sm:flex-row gap-3 mt-2 w-full">
        {onBreak ? (
          <button
            onClick={onResumeWork}
            className="w-full bg-green-400 text-gray-900 px-5 py-3 rounded-lg shadow hover:bg-green-500 font-semibold transition"
            aria-label="Resume Work"
          >
            Resume Work
          </button>
        ) : (
          <button
            onClick={() => onStartBreak(localSelectedType)}
            disabled={!localSelectedType || !currentlyWorking}
            className={`w-full px-5 py-3 rounded-lg shadow font-semibold transition ${
              localSelectedType && currentlyWorking
                ? "bg-orange-400 text-gray-900 hover:bg-orange-500 focus:outline-none focus:ring-2 focus:ring-orange-500"
                : "bg-[#232945] text-gray-500 cursor-not-allowed"
            }`}
            aria-label="Start Break"
          >
            Start Break
          </button>
        )}
      </div>

      {/* Break Type Selection */}
      <div className="flex flex-row gap-3 mt-4 w-full">
        {breakTypes.map((type) => (
          <button
            key={type}
            onClick={() => handleBreakTypeClick(type)}
            className={`flex-1 border border-[#232945] px-4 py-2 rounded-lg font-medium transition ${
              localSelectedType === type
                ? "bg-orange-400 text-gray-900"
                : "bg-[#181f37] text-gray-200 hover:bg-[#232945] focus:outline-none focus:ring-2 focus:ring-orange-500"
            }`}
            aria-pressed={localSelectedType === type}
            disabled={onBreak} // allow selecting type before break, but not during active break
          >
            {type}
          </button>
        ))}
      </div>

      {/* Status indicator */}
      {onBreak && (
        <p className="text-sm text-gray-400 mt-2 italic">
          Currently on <span className="text-orange-400 font-semibold">{localSelectedType}</span> break
        </p>
      )}
    </div>
  );
};

export default BreakManagement;
