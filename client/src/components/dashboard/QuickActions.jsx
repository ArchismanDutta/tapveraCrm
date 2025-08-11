// src/components/dashboard/QuickActions.jsx
import React from "react";

const QuickActions = ({ actions }) => {
  return (
    <div className="bg-white rounded-xl shadow p-6">
      <h2 className="text-lg font-semibold mb-4">Quick Actions</h2>
      <div className="grid grid-cols-2 gap-4 text-sm">
        {actions.map((action, idx) => (
          <button
            key={idx}
            onClick={action.onClick}
            className={`p-3 rounded-lg text-sm text-left transition-all duration-200 ease-in-out cursor-pointer hover:scale-105
              ${action.colorClass} hover:opacity-90 active:scale-95`}
          >
            {action.label}
          </button>
        ))}
      </div>
    </div>
  );
};

export default QuickActions;
