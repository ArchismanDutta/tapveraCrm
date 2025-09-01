import React from "react";

const PersonalInfo = ({ info = {} }) => {
  const { dob = "N/A", gender = "N/A", nationality = "N/A" } = info;

  return (
    <div
      className="border border-purple-700 shadow-2xl rounded-3xl p-8
                 bg-gradient-to-tr from-purple-900/20 to-purple-800/20
                 hover:from-purple-900/30 hover:to-purple-800/30
                 transition-colors duration-300 transform hover:-translate-y-1"
      style={{ backdropFilter: "blur(12px)" }}
    >
      <h2 className="text-3xl font-extrabold text-purple-300 mb-6 tracking-wide drop-shadow-md">
        Personal Information
      </h2>
      <p className="text-purple-200 text-lg mb-4">
        <strong className="font-semibold">Date of Birth:</strong> {dob}
      </p>
      <p className="text-purple-200 text-lg mb-4">
        <strong className="font-semibold">Gender:</strong> {gender}
      </p>
      <p className="text-purple-200 text-lg">
        <strong className="font-semibold">Nationality:</strong> {nationality}
      </p>
    </div>
  );
};

export default PersonalInfo;
