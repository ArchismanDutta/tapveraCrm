import React from "react";

const ContactInfo = ({ info = {} }) => {
  const { email = "N/A", phone = "N/A", address = "N/A" } = info;

  return (
    <div
      className="border border-[#2a2d48] rounded-2xl shadow-xl p-8 bg-gradient-to-tr from-[#1a1e2c] to-[#222734] 
                 hover:shadow-3xl transition-shadow duration-500 transform hover:-translate-y-1 text-white"
      style={{ backdropFilter: "blur(10px)" }}
    >
      <h2 className="text-3xl font-extrabold text-indigo-400 mb-6 tracking-wide uppercase drop-shadow-sm">
        Contact Information
      </h2>
      <p className="text-gray-300 text-lg mb-3">
        <strong className="text-indigo-400">Email:</strong> {email}
      </p>
      <p className="text-gray-300 text-lg mb-3">
        <strong className="text-indigo-400">Phone:</strong> {phone}
      </p>
      <p className="text-gray-300 text-lg">
        <strong className="text-indigo-400">Address:</strong> {address}
      </p>
    </div>
  );
};

export default ContactInfo;
