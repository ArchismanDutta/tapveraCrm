import React from "react";

const EmploymentDetails = ({ info }) => (
  <div className="p-6 rounded-2xl shadow-md border border-[#283255] bg-[#181f34] text-blue-100">
    <h3 className="text-xl font-bold text-cyan-300 mb-4 flex items-center gap-2">
      <span role="img" aria-label="Employment">💼</span> Employment Details
    </h3>
    <div className="space-y-2">
      <p>
        <span className="font-semibold">Employee ID:</span>{" "}
        <span className="text-cyan-200">{info.employeeId || "N/A"}</span>
      </p>
      <p>
        <span className="font-semibold">Designation:</span>{" "}
        <span className="text-cyan-200">{info.designation || "N/A"}</span>
      </p>
      <p>
        <span className="font-semibold">Department:</span>{" "}
        <span className="text-cyan-200">{info.department || "N/A"}</span>
      </p>
      <p>
        <span className="font-semibold">Date of Joining:</span>{" "}
        <span className="text-cyan-200">
          {info.dateOfJoining ? new Date(info.dateOfJoining).toLocaleDateString() : "N/A"}
        </span>
      </p>
      <p>
        <span className="font-semibold">Status:</span>{" "}
        <span className="text-cyan-200">{info.status || "N/A"}</span>
      </p>
      {info.jobLevel && (
        <p>
          <span className="font-semibold">Job Level:</span>{" "}
          <span className="text-cyan-200">{info.jobLevel}</span>
        </p>
      )}
    </div>
  </div>
);

export default EmploymentDetails;
