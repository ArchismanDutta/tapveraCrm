import React from "react";

const ContactInfo = ({ info }) => (
  <div className="p-6 rounded-2xl shadow-md border border-[#283255] bg-[#181f34] text-blue-100">
    <h3 className="text-xl font-bold text-cyan-300 mb-4 flex items-center gap-2">
      <span role="img" aria-label="Contact">📞</span> Contact Info
    </h3>
    <div className="space-y-2">
      <p>
        <span className="font-semibold">Email:</span>{" "}
        <span className="text-cyan-200">{info.email || "N/A"}</span>
      </p>
      <p>
        <span className="font-semibold">Phone:</span>{" "}
        <span className="text-cyan-200">{info.phone || "N/A"}</span>
      </p>
      <p>
        <span className="font-semibold">Address:</span>{" "}
        <span className="text-cyan-200">{info.address || "N/A"}</span>
      </p>
      <p>
        <span className="font-semibold">Emergency Contact:</span>{" "}
        <span className="text-cyan-200">{info.emergencyContact || "N/A"}</span>
      </p>
    </div>
  </div>
);

export default ContactInfo;
