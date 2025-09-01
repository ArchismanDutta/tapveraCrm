import React from "react";

const EmploymentDetails = ({ info = {} }) => {
  const { designation = "N/A", department = "N/A", dateOfJoining = "N/A", status = "N/A" } = info;

  const statusLower = status.toLowerCase();
  const statusColor = statusLower === "active"
    ? "bg-green-500"
    : statusLower === "on leave"
    ? "bg-yellow-500"
    : "bg-red-500";

  return (
    <div
      className="border border-indigo-700 rounded-3xl shadow-lg p-8 bg-gradient-to-r from-indigo-900/20 to-indigo-800/20
                 hover:from-indigo-900/30 hover:to-indigo-800/30 transition-colors duration-300 transform hover:scale-105"
      style={{ backdropFilter: "blur(12px)" }}
    >
      <h2 className="text-3xl font-extrabold text-indigo-200 mb-6 tracking-wide drop-shadow-md">
        Employment Details
      </h2>

      <p className="text-indigo-100 text-lg mb-4">
        <strong className="font-semibold">Designation:</strong> {designation}
      </p>
      <p className="text-indigo-100 text-lg mb-4">
        <strong className="font-semibold">Department:</strong> {department}
      </p>
      <p className="text-indigo-100 text-lg mb-4">
        <strong className="font-semibold">Date of Joining:</strong> {dateOfJoining}
      </p>

      <p className="text-lg font-semibold text-indigo-200 flex items-center">
        Status:
        <span
          className={`ml-3 inline-block rounded-full px-5 py-1 text-white text-center font-bold ${statusColor} drop-shadow-lg`}
        >
          {status}
        </span>
      </p>
    </div>
  );
};

export default EmploymentDetails;
