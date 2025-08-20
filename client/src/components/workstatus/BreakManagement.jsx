import React, { useState, useEffect } from "react";

const breakTypes = ["Lunch", "Coffee", "Personal"];

const BreakManagement = ({
  breakDuration,
  onBreak,
  onStartBreak,
  onResumeWork,
  onSelectBreakType,
  selectedBreakType,
  currentlyWorking
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
    <div className="bg-white p-4 rounded-xl shadow-md space-y-2 w-full">
      <h3 className="font-semibold text-lg border-b border-gray-200 pb-2">Break Management</h3>
      <p className="text-xl font-mono font-semibold">{breakDuration}</p>

      <div className="flex flex-col sm:flex-row gap-3 mt-2 w-full">
        {onBreak ? (
          <button
            onClick={onResumeWork}
            className="w-full bg-yellow-500 text-white px-5 py-3 rounded-lg shadow hover:bg-yellow-600 transition"
            aria-label="Resume Work"
          >
            Resume Work
          </button>
        ) : (
          <button
            onClick={() => onStartBreak(localSelectedType)}
            disabled={!localSelectedType || onBreak || !currentlyWorking}
            className={`w-full px-5 py-3 rounded-lg shadow transition ${
              localSelectedType && !onBreak && currentlyWorking
                ? "bg-orange-500 text-white hover:bg-yellow-600"
                : "bg-gray-300 text-gray-500 cursor-not-allowed"
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
            className={`flex-1 border border-gray-300 px-4 py-2 rounded-lg transition ${
              localSelectedType === type
                ? "bg-blue-500 text-white"
                : "hover:bg-gray-100"
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
