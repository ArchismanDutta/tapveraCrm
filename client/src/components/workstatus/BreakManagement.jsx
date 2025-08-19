import React from "react";

const BreakManagement = ({ breakDuration, onBreak, onStartBreak, onResumeWork }) => (
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
          onClick={onStartBreak}
          className="flex-grow bg-orange-500 text-white px-5 py-3 rounded-lg shadow hover:bg-yellow-600 transition"
          aria-label="Start Break"
        >
          Start Break
        </button>
      )}
    </div>
    <div className="flex gap-3 mt-4">
      <button className="flex-grow border border-gray-300 px-4 py-2 rounded-lg hover:bg-gray-100 transition">
        Lunch
      </button>
      <button className="flex-grow border border-gray-300 px-4 py-2 rounded-lg hover:bg-gray-100 transition">
        Coffee
      </button>
      <button className="flex-grow border border-gray-300 px-4 py-2 rounded-lg hover:bg-gray-100 transition">
        Personal
      </button>
    </div>
  </div>
);

export default BreakManagement;
