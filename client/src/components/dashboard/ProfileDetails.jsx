// src/components/dashboard/ProfileDetails.jsx
import React from "react";
import PropTypes from "prop-types";

const ProfileDetails = ({ details, className }) => {
  return (
    <div className={`bg-white rounded-xl border p-6 shadow mt-8 ${className || ""}`}>
      <h2 className="text-lg font-semibold mb-4">Profile Details</h2>
      <ul className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        {Object.entries(details).map(([key, value]) => (
          <li key={key}>
            <p className="text-gray-500 text-sm capitalize">{key.replace(/([A-Z])/g, " $1")}</p>
            <p className="text-black font-medium">{value}</p>
          </li>
        ))}
      </ul>
    </div>
  );
};

ProfileDetails.propTypes = {
  details: PropTypes.object.isRequired,
  className: PropTypes.string,
};

export default ProfileDetails;
