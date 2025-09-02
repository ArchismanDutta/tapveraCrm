import React from "react";

const ShiftDetails = ({ shift }) => {
  if (!shift) {
    return (
      <div className="p-6 rounded-2xl shadow border border-[#283255] bg-[#181f34] text-blue-400">
        No shift assigned
      </div>
    );
  }
  return (
    <div
      className={`p-6 rounded-2xl shadow border ${
        shift.isFlexible
          ? "bg-gradient-to-r from-[#25c289]/10 via-[#181f34] to-[#181f34] border-green-300"
          : "bg-blue-900/20 border-blue-300"
      } text-blue-100`}
    >
      <h3 className="text-xl font-semibold text-blue-300 mb-3">⏰ Shift Details</h3>
      <p><strong>Shift Name:</strong> {shift.name || "N/A"}</p>
      <p><strong>Start Time:</strong> {shift.start || "N/A"}</p>
      <p><strong>End Time:</strong> {shift.end || "N/A"}</p>
      <p><strong>Duration:</strong> {shift.durationHours ?? "N/A"} hours</p>
      <p>
        <strong>Flexible:</strong>{" "}
        {shift.isFlexible ? (
          <span className="text-green-400 font-medium">Yes</span>
        ) : (
          <span className="text-pink-400 font-medium">No</span>
        )}
      </p>
    </div>
  );
};

export default ShiftDetails;
