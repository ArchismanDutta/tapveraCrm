// PersonalInfo.jsx
import React from "react";

const PersonalInfo = ({ info = {} }) => {
  const { dob = "N/A", gender = "N/A", nationality = "N/A" } = info;

  return (
    <div className="border shadow-2xl rounded-3xl p-8 bg-gradient-to-tr from-purple-50 to-purple-100 hover:from-purple-100 hover:to-purple-200 transition-all duration-400 transform hover:-translate-y-1">
      <h2 className="text-3xl font-extrabold text-purple-900 mb-6 tracking-wide">Personal Information</h2>
      <p className="text-purple-800 text-lg mb-4"><strong className="font-semibold">Date of Birth:</strong> {dob}</p>
      <p className="text-purple-800 text-lg mb-4"><strong className="font-semibold">Gender:</strong> {gender}</p>
      <p className="text-purple-800 text-lg"><strong className="font-semibold">Nationality:</strong> {nationality}</p>
    </div>
  );
};

export default PersonalInfo;
