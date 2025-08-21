// components/StatusCard.jsx

import React from "react";

const StatusCard = ({
  workDuration,
  breakTime,
  arrivalTime,
  currentlyWorking,
  onPunchIn,
  onPunchOut,
}) => (
  <div className="bg-white p-4 rounded-xl shadow-md flex flex-col sm:flex-row gap-4 sm:gap-12 items-center justify-between w-full">
    <div className="space-y-1 text-gray-700 font-semibold">
      <p>
        Work Duration: <span className="font-bold text-gray-900">{workDuration}</span>
      </p>
      <p>
        Break Time: <span className="font-bold text-gray-900">{breakTime}</span>
      </p>
      <p>
        Arrival Time: <span className="font-bold text-gray-900">{arrivalTime || "--"}</span>
      </p>
    </div>

    <div>
      {currentlyWorking ? (
        <span className="bg-green-100 text-green-800 px-4 py-2 rounded-full font-semibold">
          Currently Working
        </span>
      ) : (
        <span className="bg-gray-100 text-gray-700 px-4 py-2 rounded-full font-semibold">
          Not Working
        </span>
      )}
    </div>

    <div className="flex gap-2">
      <button
        onClick={onPunchIn}
        disabled={currentlyWorking}
        className={`bg-green-600 text-white px-4 py-2 rounded-lg shadow hover:bg-green-700 transition ${
          currentlyWorking ? "opacity-50 cursor-not-allowed" : ""
        }`}
      >
        Punch In
      </button>
      <button
        onClick={onPunchOut}
        disabled={!currentlyWorking}
        className={`bg-red-600 text-white px-4 py-2 rounded-lg shadow hover:bg-red-700 transition ${
          !currentlyWorking ? "opacity-50 cursor-not-allowed" : ""
        }`}
      >
        Punch Out
      </button>
    </div>
  </div>
);

export default StatusCard;
