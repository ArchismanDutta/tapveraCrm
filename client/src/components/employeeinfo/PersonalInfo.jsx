import React from "react";

const PersonalInfo = ({ info }) => (
  <div className="p-6 rounded-2xl shadow border border-[#283255] bg-[#181f34] text-blue-100">
    <h3 className="text-2xl font-semibold text-blue-300 mb-4">🧍 Personal Info</h3>
    <p className="mb-2">
      <strong>Date of Birth:</strong>{" "}
      <span className="text-blue-200">{info.dob ? new Date(info.dob).toLocaleDateString() : "N/A"}</span>
    </p>
    <p className="mb-2">
      <strong>Gender:</strong> <span className="text-blue-200">{info.gender || "N/A"}</span>
    </p>
    <p className="mb-2">
      <strong>Location:</strong> <span className="text-blue-200">{info.location || "N/A"}</span>
    </p>
    <p>
      <strong>Blood Group:</strong> <span className="text-blue-200">{info.bloodGroup || "N/A"}</span>
    </p>
  </div>
);

export default PersonalInfo;
