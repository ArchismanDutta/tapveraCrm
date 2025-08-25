// ContactInfo.jsx
import React from "react";

const ContactInfo = ({ info = {} }) => {
  const { email = "N/A", phone = "N/A", address = "N/A" } = info;

  return (
    <div className="border rounded-2xl shadow-xl p-8 bg-white hover:shadow-3xl transition-shadow duration-500 transform hover:-translate-y-1">
      <h2 className="text-3xl font-extrabold text-indigo-700 mb-6 tracking-wide uppercase drop-shadow-sm">Contact Information</h2>
      <p className="text-gray-800 text-lg mb-3"><strong className="text-indigo-600">Email:</strong> {email}</p>
      <p className="text-gray-800 text-lg mb-3"><strong className="text-indigo-600">Phone:</strong> {phone}</p>
      <p className="text-gray-800 text-lg"><strong className="text-indigo-600">Address:</strong> {address}</p>
    </div>
  );
};

export default ContactInfo;
