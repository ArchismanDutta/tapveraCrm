// File: src/components/humanResource/ActiveLeavesModal.jsx
import React from "react";

const ActiveLeavesModal = ({ isOpen, onClose, leaves }) => {
  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40">
      <div className="bg-[#1a1f36] rounded-xl shadow-xl w-full max-w-lg p-6 flex flex-col gap-5 border border-gray-700">
        <h2 className="text-2xl font-bold text-gray-100">Active Leaves</h2>

        {leaves && leaves.length > 0 ? (
          <div className="flex flex-col gap-3 max-h-72 overflow-y-auto scrollbar-thin scrollbar-thumb-gray-600 scrollbar-track-gray-800">
            {leaves.map((leave) => (
              <div
                key={leave._id}
                className="flex justify-between text-gray-200 text-sm px-3 py-2 rounded hover:bg-gray-700 transition-colors"
              >
                <div>
                  <span className="font-semibold">{leave.employee?.name}</span>{" "}
                  - {leave.employee?.designation || leave.employee?.role}
                </div>
                <div className="font-mono text-gray-400">
                  {new Date(leave.period.start).toLocaleDateString()} -{" "}
                  {new Date(leave.period.end).toLocaleDateString()}
                </div>
              </div>
            ))}
          </div>
        ) : (
          <p className="text-gray-400 italic text-sm">No employees currently on leave.</p>
        )}

        <div className="flex justify-end mt-5">
          <button
            onClick={onClose}
            className="px-5 py-2 rounded bg-gray-700 hover:bg-gray-600 text-white font-semibold transition"
          >
            Close
          </button>
        </div>
      </div>
    </div>
  );
};

export default ActiveLeavesModal;
