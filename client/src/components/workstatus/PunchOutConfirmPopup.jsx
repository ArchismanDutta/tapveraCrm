// File: src/components/workstatus/PunchOutConfirmPopup.jsx
import React from "react";

const PunchOutConfirmPopup = ({ onCancel, onConfirm }) => {
  return (
    <div
      className="fixed inset-0 bg-black/40 backdrop-blur-sm flex items-center justify-center z-50"
      aria-modal="true"
      role="dialog"
    >
      <div className="bg-[#161c2c] rounded-2xl shadow-xl p-6 max-w-md w-full border border-[#232945] animate-fadeIn">
        {/* Header */}
        <h2 className="text-2xl font-bold mb-3 text-gray-100">
          Confirm Punch Out
        </h2>

        {/* Message */}
        <p className="mb-6 text-gray-300 leading-relaxed">
          If you punch out now, you{" "}
          <span className="font-semibold text-orange-400">
            won&apos;t be able to punch in again today
          </span>
          . <br />
          Are you sure you want to continue?
        </p>

        {/* Buttons */}
        <div className="flex justify-end gap-3">
          <button
            onClick={onCancel}
            className="px-5 py-2.5 rounded-lg bg-[#232945] text-gray-200 hover:bg-[#2f3557] transition font-medium"
          >
            Cancel
          </button>
          <button
            onClick={onConfirm}
            className="px-5 py-2.5 rounded-lg bg-red-500 text-white hover:bg-red-600 transition font-semibold shadow"
          >
            Punch Out Anyway
          </button>
        </div>
      </div>
    </div>
  );
};

export default PunchOutConfirmPopup;
