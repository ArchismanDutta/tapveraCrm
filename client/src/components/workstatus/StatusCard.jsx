import React from "react";

const StatusCard = ({ workDuration, breakTime, arrivalTime, currentlyWorking }) => (
  <div className="bg-white p-6 rounded-xl shadow-md flex flex-col lg:flex-row gap-6 lg:gap-12 items-center justify-between">
    <div className="space-y-1 text-gray-700 font-semibold">
      <p>Work Duration: <span className="font-bold text-gray-900">{workDuration}</span></p>
      <p>Break Time: <span className="font-bold text-gray-900">{breakTime}</span></p>
      <p>Arrival Time: <span className="font-bold text-gray-900">{arrivalTime}</span></p>
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
    <div className="flex gap-4">
      <button className="bg-green-600 text-white px-5 py-2 rounded-lg shadow hover:bg-green-700 transition focus:outline-none">
        Punch In
      </button>
      <button className="bg-red-600 text-white px-5 py-2 rounded-lg shadow hover:bg-red-700 transition focus:outline-none">
        Punch Out
      </button>
    </div>
  </div>
);

export default StatusCard;
