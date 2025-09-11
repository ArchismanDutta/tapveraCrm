// src/components/workstatus/StatusCard.jsx
import React from "react";

const StatusCard = ({
  workDuration,
  breakTime,
  arrivalTime,
  currentlyWorking,
  alreadyPunchedIn = false,   // Prevent multiple punch-ins
  alreadyPunchedOut = false,  // Prevent multiple punch-outs
  onPunchIn,
  onPunchOut,
  onRequestFlexible,          // Flexible shift request
}) => {
  // Convert arrivalTime ISO to local time string
  const formattedArrivalTime = arrivalTime
    ? (() => {
        const date = new Date(arrivalTime); // Convert ISO to Date
        return date.toLocaleTimeString([], {
          hour: "2-digit",
          minute: "2-digit",
          hour12: true,
        });
      })()
    : "--";

  return (
    <div className="bg-[#161c2c] border border-[#232945] rounded-2xl shadow-lg p-6 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-6 w-full transition-all">
      
      {/* Info Section */}
      <div className="flex-1 flex flex-col sm:flex-row sm:items-center sm:gap-12 gap-4">
        <div className="space-y-2">
          <p className="text-gray-300 font-medium">
            Work Duration:{" "}
            <span className="text-orange-400 font-bold">{workDuration}</span>
          </p>
          <p className="text-gray-300 font-medium">
            Break Time:{" "}
            <span className="text-orange-400 font-bold">{breakTime}</span>
          </p>
          <p className="text-gray-300 font-medium">
            Arrival Time:{" "}
            <span className="text-orange-400 font-bold">{formattedArrivalTime}</span>
          </p>
        </div>

        {/* Status Badge */}
        <div className="mt-3 sm:mt-0">
          {currentlyWorking ? (
            <span className="inline-flex items-center whitespace-nowrap bg-green-500/90 text-black px-3 py-1 rounded-full font-semibold shadow transition-all text-sm">
              Currently Working
            </span>
          ) : (
            <span className="inline-flex items-center whitespace-nowrap bg-[#232945] text-gray-400 px-3 py-1 rounded-full font-semibold shadow transition-all text-sm">
              Not Working
            </span>
          )}
        </div>
      </div>

      {/* Buttons Section */}
      <div className="flex flex-col gap-3 mt-3 sm:mt-0">
        <div className="flex gap-3">
          {/* Punch In */}
          <button
            onClick={onPunchIn}
            disabled={currentlyWorking || alreadyPunchedIn}
            title={
              currentlyWorking || alreadyPunchedIn
                ? "You cannot punch in now"
                : "Punch In"
            }
            className={`px-4 py-2 rounded-lg font-semibold transition-all shadow-md duration-200 ${
              currentlyWorking || alreadyPunchedIn
                ? "bg-green-500 opacity-50 cursor-not-allowed text-gray-800"
                : "bg-green-500 hover:bg-green-600 text-gray-900"
            }`}
          >
            Punch In
          </button>

          {/* Punch Out */}
          <button
            onClick={onPunchOut}
            disabled={!currentlyWorking || alreadyPunchedOut}
            title={
              !currentlyWorking || alreadyPunchedOut
                ? "You cannot punch out now"
                : "Punch Out"
            }
            className={`px-4 py-2 rounded-lg font-semibold transition-all shadow-md duration-200 ${
              !currentlyWorking || alreadyPunchedOut
                ? "bg-orange-500 opacity-50 cursor-not-allowed text-gray-800"
                : "bg-orange-500 hover:bg-orange-600 text-gray-900"
            }`}
          >
            Punch Out
          </button>
        </div>

        {/* Flexible Shift Request */}
        <button
          onClick={onRequestFlexible}
          disabled={currentlyWorking} // optional safeguard
          className={`px-4 py-2 rounded-lg font-medium shadow transition ${
            currentlyWorking
              ? "bg-blue-600/40 text-gray-400 cursor-not-allowed"
              : "bg-blue-600 hover:bg-blue-700 text-white"
          }`}
          title="Request a flexible shift"
        >
          Request Flexible Shift
        </button>
      </div>
    </div>
  );
};

export default StatusCard;
