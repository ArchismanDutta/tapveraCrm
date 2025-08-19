import React, { useState, useEffect } from "react";

const breakTypes = ["Lunch", "Coffee", "Personal"];

const BreakManagement = ({
  breakDuration,
  onBreak,
  onStartBreak,
  onResumeWork,
  onSelectBreakType,
  selectedBreakType,
}) => {
  const [localSelectedType, setLocalSelectedType] = useState(selectedBreakType || "");

  useEffect(() => {
    // Sync local selected with prop update from parent if needed
    setLocalSelectedType(selectedBreakType || "");
  }, [selectedBreakType]);

  const handleBreakTypeClick = (type) => {
    setLocalSelectedType(type);
    if (onSelectBreakType) onSelectBreakType(type);
  };

  return (
    <div className="bg-white p-6 rounded-xl shadow-md space-y-4">
      <h3 className="font-semibold text-lg border-b border-gray-200 pb-2">Break Management</h3>
      <p className="text-2xl font-mono font-semibold">{breakDuration}</p>

      <div className="flex gap-3">
        {onBreak ? (
          <button
            onClick={onResumeWork}
            className="flex-grow bg-yellow-500 text-white px-5 py-3 rounded-lg shadow hover:bg-yellow-600 transition"
            aria-label="Resume Work"
          >
            Resume Work
          </button>
        ) : (
          <button
            onClick={() => onStartBreak(localSelectedType)}
            disabled={!localSelectedType}
            className={`flex-grow px-5 py-3 rounded-lg shadow transition ${
              localSelectedType
                ? "bg-orange-500 text-white hover:bg-yellow-600"
                : "bg-gray-300 text-gray-500 cursor-not-allowed"
            }`}
            aria-label="Start Break"
          >
            Start Break
          </button>
        )}
      </div>

      <div className="flex gap-3 mt-4">
        {breakTypes.map((type) => (
          <button
            key={type}
            onClick={() => handleBreakTypeClick(type)}
            className={`flex-grow border border-gray-300 px-4 py-2 rounded-lg transition ${
              localSelectedType === type ? "bg-blue-500 text-white" : "hover:bg-gray-100"
            }`}
            aria-pressed={localSelectedType === type}
          >
            {type}
          </button>
        ))}
      </div>
    </div>
  );
};

export default BreakManagement;
