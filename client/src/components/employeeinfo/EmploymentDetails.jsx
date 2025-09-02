import React from "react";

const EmploymentDetails = ({ info }) => (
  <div className="p-6 rounded-2xl shadow border border-[#283255] bg-[#181f34] text-blue-100">
    <h3 className="text-xl font-semibold text-blue-300 mb-3">💼 Employment Details</h3>
    <p><strong>Employee ID:</strong> {info.employeeId || "N/A"}</p>
    <p><strong>Designation:</strong> {info.designation || "N/A"}</p>
    <p><strong>Department:</strong> {info.department || "N/A"}</p>
    <p><strong>Date of Joining:</strong> {info.dateOfJoining ? new Date(info.dateOfJoining).toLocaleDateString() : "N/A"}</p>
    <p><strong>Status:</strong> {info.status || "N/A"}</p>
    {info.jobLevel && <p><strong>Job Level:</strong> {info.jobLevel}</p>}
  </div>
);

export default EmploymentDetails;
