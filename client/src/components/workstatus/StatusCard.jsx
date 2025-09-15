// src/components/workstatus/StatusCard.jsx
import React from "react";

const StatusCard = ({
  workDuration,
  breakTime,
  arrivalTime,
  currentlyWorking,
  alreadyPunchedIn = false,
  alreadyPunchedOut = false,
  onPunchIn,
  onPunchOut,
  onRequestFlexible,
}) => {
  // Convert arrivalTime ISO to local time string
  const formattedArrivalTime = arrivalTime
    ? (() => {
        const date = new Date(arrivalTime);
        return date.toLocaleTimeString([], {
          hour: "2-digit",
          minute: "2-digit",
          hour12: true,
        });
      })()
    : "--";

  return (
    <div className="bg-slate-800/50 backdrop-blur-sm border border-slate-700/50 rounded-2xl shadow-xl p-8 transition-all hover:shadow-2xl hover:border-slate-600/50">
      
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <h2 className="text-2xl font-bold text-white">Work Status</h2>
        {/* Status Badge */}
        {currentlyWorking ? (
          <span className="inline-flex items-center bg-gradient-to-r from-green-500 to-emerald-500 text-white px-4 py-2 rounded-full font-semibold text-sm shadow-lg">
            <div className="w-2 h-2 bg-white rounded-full mr-2 animate-pulse"></div>
            Currently Working
          </span>
        ) : (
          <span className="inline-flex items-center bg-gradient-to-r from-slate-600 to-slate-700 text-white px-4 py-2 rounded-full font-semibold text-sm">
            <div className="w-2 h-2 bg-gray-400 rounded-full mr-2"></div>
            Not Working
          </span>
        )}
      </div>

      {/* Stats Grid */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8">
        <div className="bg-slate-900/60 p-6 rounded-xl border border-slate-700/30">
          <div className="flex items-center justify-between mb-2">
            <p className="text-sm font-medium text-gray-400 uppercase tracking-wide">
              Work Duration
            </p>
            <div className="w-8 h-8 bg-gradient-to-r from-blue-500 to-cyan-500 rounded-lg flex items-center justify-center">
              <svg className="w-4 h-4 text-white" fill="currentColor" viewBox="0 0 20 20">
                <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm1-12a1 1 0 10-2 0v4a1 1 0 00.293.707l2.828 2.829a1 1 0 101.415-1.415L11 9.586V6z" clipRule="evenodd" />
              </svg>
            </div>
          </div>
          <p className="text-2xl font-bold text-white">{workDuration}</p>
        </div>

        <div className="bg-slate-900/60 p-6 rounded-xl border border-slate-700/30">
          <div className="flex items-center justify-between mb-2">
            <p className="text-sm font-medium text-gray-400 uppercase tracking-wide">
              Break Time
            </p>
            <div className="w-8 h-8 bg-gradient-to-r from-orange-500 to-red-500 rounded-lg flex items-center justify-center">
              <svg className="w-4 h-4 text-white" fill="currentColor" viewBox="0 0 20 20">
                <path fillRule="evenodd" d="M3 4a1 1 0 011-1h12a1 1 0 110 2H4a1 1 0 01-1-1zm0 4a1 1 0 011-1h12a1 1 0 110 2H4a1 1 0 01-1-1zm0 4a1 1 0 011-1h12a1 1 0 110 2H4a1 1 0 01-1-1z" clipRule="evenodd" />
              </svg>
            </div>
          </div>
          <p className="text-2xl font-bold text-white">{breakTime}</p>
        </div>

        <div className="bg-slate-900/60 p-6 rounded-xl border border-slate-700/30">
          <div className="flex items-center justify-between mb-2">
            <p className="text-sm font-medium text-gray-400 uppercase tracking-wide">
              Arrival Time
            </p>
            <div className="w-8 h-8 bg-gradient-to-r from-purple-500 to-pink-500 rounded-lg flex items-center justify-center">
              <svg className="w-4 h-4 text-white" fill="currentColor" viewBox="0 0 20 20">
                <path fillRule="evenodd" d="M6 2a1 1 0 00-1 1v1H4a2 2 0 00-2 2v10a2 2 0 002 2h12a2 2 0 002-2V6a2 2 0 00-2-2h-1V3a1 1 0 10-2 0v1H7V3a1 1 0 00-1-1zm0 5a1 1 0 000 2h8a1 1 0 100-2H6z" clipRule="evenodd" />
              </svg>
            </div>
          </div>
          <p className="text-2xl font-bold text-white">{formattedArrivalTime}</p>
        </div>
      </div>

      {/* Action Buttons */}
      <div className="flex flex-col sm:flex-row gap-4">
        {/* Punch In/Out Buttons */}
        <div className="flex gap-3 flex-1">
          <button
            onClick={onPunchIn}
            disabled={currentlyWorking || alreadyPunchedIn}
            className={`flex-1 py-4 px-6 rounded-xl font-bold text-sm uppercase tracking-wide transition-all duration-200 ${
              currentlyWorking || alreadyPunchedIn
                ? "bg-green-500/20 border border-green-500/30 text-green-400/60 cursor-not-allowed"
                : "bg-gradient-to-r from-green-500 to-emerald-600 hover:from-green-600 hover:to-emerald-700 text-white shadow-lg hover:shadow-green-500/25 transform hover:scale-105"
            }`}
          >
            {alreadyPunchedIn ? "Punched In" : "Punch In"}
          </button>

          <button
            onClick={onPunchOut}
            disabled={!currentlyWorking || alreadyPunchedOut}
            className={`flex-1 py-4 px-6 rounded-xl font-bold text-sm uppercase tracking-wide transition-all duration-200 ${
              !currentlyWorking || alreadyPunchedOut
                ? "bg-orange-500/20 border border-orange-500/30 text-orange-400/60 cursor-not-allowed"
                : "bg-gradient-to-r from-orange-500 to-red-600 hover:from-orange-600 hover:to-red-700 text-white shadow-lg hover:shadow-orange-500/25 transform hover:scale-105"
            }`}
          >
            {alreadyPunchedOut ? "Punched Out" : "Punch Out"}
          </button>
        </div>

        {/* Flexible Shift Button */}
        <button
          onClick={onRequestFlexible}
          disabled={currentlyWorking}
          className={`py-4 px-6 rounded-xl font-bold text-sm uppercase tracking-wide transition-all duration-200 ${
            currentlyWorking
              ? "bg-blue-500/20 border border-blue-500/30 text-blue-400/60 cursor-not-allowed"
              : "bg-gradient-to-r from-blue-500 to-purple-600 hover:from-blue-600 hover:to-purple-700 text-white shadow-lg hover:shadow-blue-500/25 transform hover:scale-105"
          }`}
        >
          Request Flexible Shift
        </button>
      </div>
    </div>
  );
};

export default StatusCard;