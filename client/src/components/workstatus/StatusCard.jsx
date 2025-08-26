import React from "react";

const StatusCard = ({
  workDuration,
  breakTime,
  arrivalTime,
  currentlyWorking,
  onPunchIn,
  onPunchOut,
}) => (
  <div className="bg-[#161c2c] p-4 rounded-xl shadow-md flex flex-col sm:flex-row gap-4 sm:gap-12 items-center justify-between w-full border border-[#232945]">
    <div className="space-y-1 text-gray-200 font-semibold">
      <p>
        Work Duration:{" "}
        <span className="font-bold text-orange-400">{workDuration}</span>
      </p>
      <p>
        Break Time: <span className="font-bold text-orange-400">{breakTime}</span>
      </p>
      <p>
        Arrival Time:{" "}
        <span className="font-bold text-orange-400">{arrivalTime || "--"}</span>
      </p>
    </div>
    <div>
      {currentlyWorking ? (
        <span className="bg-green-500 text-black px-4 py-2 rounded-full font-semibold">
          Currently Working
        </span>
      ) : (
        <span className="bg-[#232945] text-gray-400 px-4 py-2 rounded-full font-semibold">
          Not Working
        </span>
      )}
    </div>
    <div className="flex gap-2">
      <button
        onClick={onPunchIn}
        disabled={currentlyWorking}
        className={`bg-green-500 text-gray-900 px-4 py-2 rounded-lg shadow hover:bg-orange-600 font-semibold transition ${
          currentlyWorking ? "opacity-50 cursor-not-allowed" : ""
        }`}
      >
        Punch In
      </button>
      <button
        onClick={onPunchOut}
        disabled={!currentlyWorking}
        className={`bg-orange-500 text-gray-900 px-4 py-2 rounded-lg shadow hover:bg-orange-600 font-semibold transition ${
          !currentlyWorking ? "opacity-50 cursor-not-allowed" : ""
        }`}
      >
        Punch Out
      </button>
    </div>
  </div>
);

export default StatusCard;
