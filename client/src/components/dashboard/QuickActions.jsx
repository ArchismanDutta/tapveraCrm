// src/components/dashboard/QuickActions.jsx
import React from "react";
import PropTypes from "prop-types";

const QuickActions = ({ actions }) => {
  return (
    <div className="bg-white rounded-xl shadow p-6">
      <h2 className="text-lg font-semibold mb-4">Quick Actions</h2>
      <div className="grid grid-cols-2 gap-4 text-sm">
        {actions.map(({ label, style, onClick }) => (
          <button
            key={label}
            onClick={onClick}
            type="button"
            className={`border px-3 py-2 rounded-md font-medium bg-transparent transition ${style} focus:outline-none focus:ring-2 focus:ring-offset-1`}
            aria-label={label}
          >
            {label}
          </button>
        ))}
      </div>
    </div>
  );
};

QuickActions.propTypes = {
  actions: PropTypes.arrayOf(
    PropTypes.shape({
      label: PropTypes.string.isRequired,
      style: PropTypes.string,
      onClick: PropTypes.func.isRequired,
    })
  ).isRequired,
};

export default QuickActions;
