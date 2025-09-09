import React from "react";

const ShiftDetails = ({ shift }) => {
  if (!shift) {
    return (
      <div className="p-6 rounded-2xl shadow-md border border-[#283255] bg-[#181f34] text-blue-400 text-center font-semibold">
        No shift assigned
      </div>
    );
  }
  return (
    <div
      className={`p-6 rounded-2xl shadow-md border 
      ${shift.isFlexible
        ? "bg-gradient-to-r from-[#25c289]/10 via-[#181f34] to-[#181f34] border-green-300"
        : "bg-blue-900/25 border-blue-400"}
      text-blue-100`}
    >
      <h3 className="text-xl font-bold text-cyan-300 mb-4 flex items-center gap-2">
        <span role="img" aria-label="Shift">⏰</span> Shift Details
      </h3>
      <div className="space-y-2">
        <p>
          <span className="font-semibold">Shift Name:</span>{" "}
          <span className="text-cyan-200">{shift.name || "N/A"}</span>
        </p>
        <p>
          <span className="font-semibold">Start Time:</span>{" "}
          <span className="text-cyan-200">{shift.start || "N/A"}</span>
        </p>
        <p>
          <span className="font-semibold">End Time:</span>{" "}
          <span className="text-cyan-200">{shift.end || "N/A"}</span>
        </p>
        <p>
          <span className="font-semibold">Duration:</span>{" "}
          <span className="text-cyan-200">{shift.durationHours ?? "N/A"} hours</span>
        </p>
        <p>
          <span className="font-semibold">Flexible:</span>{" "}
          {shift.isFlexible ? (
            <span className="text-green-400 font-medium">Yes</span>
          ) : (
            <span className="text-pink-400 font-medium">No</span>
          )}
        </p>
      </div>
    </div>
  );
};

export default ShiftDetails;
