// EmploymentDetails.jsx
import React from "react";

const EmploymentDetails = ({ info = {} }) => {
  const { designation = "N/A", department = "N/A", dateOfJoining = "N/A", status = "N/A" } = info;

  const statusColor = status.toLowerCase() === "active" ? "bg-green-500" : "bg-red-500";

  return (
    <div className="border rounded-3xl shadow-xl p-8 bg-gradient-to-r from-indigo-50 to-indigo-100 hover:from-indigo-100 hover:to-indigo-200 transition-colors duration-400 transform hover:scale-[1.03]">
      <h2 className="text-3xl font-extrabold text-indigo-900 mb-6 tracking-wide">Employment Details</h2>

      <p className="text-indigo-800 text-lg mb-4"><strong className="font-semibold">Designation:</strong> {designation}</p>
      <p className="text-indigo-800 text-lg mb-4"><strong className="font-semibold">Department:</strong> {department}</p>
      <p className="text-indigo-800 text-lg mb-4"><strong className="font-semibold">Date of Joining:</strong> {dateOfJoining}</p>

      <p className="text-lg font-semibold text-indigo-900 flex items-center">
        Status:
        <span className={`ml-3 inline-block rounded-full px-5 py-1 text-white text-center font-bold ${statusColor} drop-shadow-md`}>
          {status}
        </span>
      </p>
    </div>
  );
};

export default EmploymentDetails;
