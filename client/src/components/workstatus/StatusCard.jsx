// File: StatusCard.jsx
import React from "react";

const StatusCard = ({
  workDuration,
  breakTime,
  arrivalTime,
  currentlyWorking,
  alreadyPunchedIn = false,   // New prop
  alreadyPunchedOut = false,  // New prop
  onPunchIn,
  onPunchOut,
  onRequestFlexible, // new prop for flexible shift
}) => {
  return (
    <div className="bg-[#161c2c] border border-[#232945] rounded-xl shadow-lg p-6 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-6 w-full transition-all">
      
      {/* Info Section */}
      <div className="flex-1 flex flex-col sm:flex-row sm:items-center sm:gap-12 gap-4">
        <div className="space-y-2">
          <p className="text-gray-300 font-medium">
            Work Duration: <span className="text-orange-400 font-bold">{workDuration}</span>
          </p>
          <p className="text-gray-300 font-medium">
            Break Time: <span className="text-orange-400 font-bold">{breakTime}</span>
          </p>
          <p className="text-gray-300 font-medium">
            Arrival Time: <span className="text-orange-400 font-bold">{arrivalTime || "--"}</span>
          </p>
        </div>

        <div className="mt-3 sm:mt-0">
          {currentlyWorking ? (
            <span className="bg-green-500 text-black px-4 py-2 rounded-full font-semibold shadow-md">
              Currently Working
            </span>
          ) : (
            <span className="bg-[#232945] text-gray-400 px-4 py-2 rounded-full font-semibold shadow-md">
              Not Working
            </span>
          )}
        </div>
      </div>

      {/* Buttons Section */}
      <div className="flex flex-col gap-2 mt-3 sm:mt-0">
        <div className="flex gap-3">
          <button
            onClick={onPunchIn}
            disabled={currentlyWorking || alreadyPunchedIn}
            className={`px-4 py-2 rounded-lg font-semibold transition-all shadow-md duration-200 ${
              currentlyWorking || alreadyPunchedIn
                ? "bg-green-500 opacity-50 cursor-not-allowed"
                : "bg-green-500 hover:bg-green-600 text-gray-900"
            }`}
          >
            Punch In
          </button>

          <button
            onClick={onPunchOut}
            disabled={!currentlyWorking || alreadyPunchedOut}
            className={`px-4 py-2 rounded-lg font-semibold transition-all shadow-md duration-200 ${
              !currentlyWorking || alreadyPunchedOut
                ? "bg-orange-500 opacity-50 cursor-not-allowed"
                : "bg-orange-500 hover:bg-orange-600 text-gray-900"
            }`}
          >
            Punch Out
          </button>
        </div>

        {/* Flexible Shift Button */}
        <button
          onClick={onRequestFlexible}
          className="px-4 py-2 rounded-md bg-blue-600 hover:bg-blue-700 text-white font-medium shadow mt-2"
          title="Request a flexible shift"
        >
          Request Flexible Shift
        </button>
      </div>
    </div>
  );
};

export default StatusCard;
