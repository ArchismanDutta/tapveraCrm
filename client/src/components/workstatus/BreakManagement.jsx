import React, { useState, useEffect } from "react";

const breakTypes = ["Lunch", "Coffee", "Personal"];

const BreakManagement = ({
  breakDuration,
  onBreak,
  onStartBreak,
  onResumeWork,
  onSelectBreakType,
  selectedBreakType,
  currentlyWorking,
}) => {
  const [localSelectedType, setLocalSelectedType] = useState(selectedBreakType || "");

  useEffect(() => {
    setLocalSelectedType(selectedBreakType || "");
  }, [selectedBreakType]);

  const handleBreakTypeClick = (type) => {
    setLocalSelectedType(type);
    if (onSelectBreakType) onSelectBreakType(type);
  };

  return (
    <div className="bg-[#161c2c] p-4 rounded-xl shadow-md space-y-2 w-full border border-[#232945]">
      <h3 className="font-semibold text-lg border-b border-[#232945] pb-2 text-gray-100">Break Management</h3>
      <p className="text-xl font-mono font-semibold text-orange-400">{breakDuration}</p>
      <div className="flex flex-col sm:flex-row gap-3 mt-2 w-full">
        {onBreak ? (
          <button
            onClick={onResumeWork}
            className="w-full bg-orange-400 text-gray-900 px-5 py-3 rounded-lg shadow hover:bg-orange-500 font-semibold transition"
            aria-label="Resume Work"
          >
            Resume Work
          </button>
        ) : (
          <button
            onClick={() => onStartBreak(localSelectedType)}
            disabled={!localSelectedType || onBreak || !currentlyWorking}
            className={`w-full px-5 py-3 rounded-lg shadow font-semibold transition ${
              localSelectedType && !onBreak && currentlyWorking
                ? "bg-orange-400 text-gray-900 hover:bg-orange-500"
                : "bg-[#232945] text-gray-500 cursor-not-allowed"
            }`}
            aria-label="Start Break"
          >
            Start Break
          </button>
        )}
      </div>
      <div className="flex flex-row gap-3 mt-4 w-full">
        {breakTypes.map((type) => (
          <button
            key={type}
            onClick={() => handleBreakTypeClick(type)}
            className={`flex-1 border border-[#232945] px-4 py-2 rounded-lg font-medium transition ${
              localSelectedType === type
                ? "bg-orange-400 text-gray-900"
                : "bg-[#181f37] text-gray-200 hover:bg-[#232945]"
            }`}
            aria-pressed={localSelectedType === type}
            disabled={onBreak || !currentlyWorking}
          >
            {type}
          </button>
        ))}
      </div>
    </div>
  );
};

export default BreakManagement;
