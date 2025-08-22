import React from "react";

const PunchOutConfirmPopup = ({ onCancel, onConfirm }) => {
  return (
    <div
      style={{
        position: "fixed",
        inset: 0,
        backgroundColor: "rgba(0,0,0,0.2)",
        backdropFilter: "blur(6px)",
        WebkitBackdropFilter: "blur(6px)",
        display: "flex",
        justifyContent: "center",
        alignItems: "center",
        zIndex: 9999,
      }}
    >
      <div className="bg-white rounded-lg shadow-lg p-6 max-w-md w-full">
        <h2 className="text-lg font-bold mb-4">Confirm Punch Out</h2>
        <p className="mb-6 text-gray-700">
          If you punch out now, you won't be able to punch in again for today.
          Are you sure you want to proceed?
        </p>
        <div className="flex justify-end space-x-3">
          <button
            onClick={onCancel}
            className="px-4 py-2 rounded bg-gray-300 hover:bg-gray-400"
          >
            Cancel
          </button>
          <button
            onClick={onConfirm}
            className="px-4 py-2 rounded bg-red-600 text-white hover:bg-red-700"
          >
            Punch Out Anyway
          </button>
        </div>
      </div>
    </div>
  );
};

export default PunchOutConfirmPopup;
