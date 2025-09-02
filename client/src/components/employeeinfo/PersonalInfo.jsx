import React from "react";

const PersonalInfo = ({ info }) => (
  <div className="p-6 rounded-2xl shadow border border-[#283255] bg-[#181f34] text-blue-100">
    <h3 className="text-xl font-semibold text-blue-300 mb-3">🧍 Personal Info</h3>
    <p><strong>Date of Birth:</strong> {info.dob ? new Date(info.dob).toLocaleDateString() : "N/A"}</p>
    <p><strong>Gender:</strong> {info.gender || "N/A"}</p>
    <p><strong>Location:</strong> {info.location || "N/A"}</p>
    <p><strong>Blood Group:</strong> {info.bloodGroup || "N/A"}</p>
  </div>
);

export default PersonalInfo;
