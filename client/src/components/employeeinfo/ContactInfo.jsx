import React from "react";

const ContactInfo = ({ info }) => (
  <div className="p-6 rounded-2xl shadow border border-[#283255] bg-[#181f34] text-blue-100">
    <h3 className="text-xl font-semibold text-blue-300 mb-3">📞 Contact Info</h3>
    <p><strong>Email:</strong> {info.email || "N/A"}</p>
    <p><strong>Phone:</strong> {info.phone || "N/A"}</p>
    <p><strong>Address:</strong> {info.address || "N/A"}</p>
    <p><strong>Emergency Contact:</strong> {info.emergencyContact || "N/A"}</p>
  </div>
);

export default ContactInfo;
