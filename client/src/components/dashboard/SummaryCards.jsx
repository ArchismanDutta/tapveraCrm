// src/components/dashboard/SummaryCards.jsx
import React from "react";
import { Link } from "react-router-dom";

const SummaryCards = ({ data }) => {
  return (
    <div>
      {/* Cards Grid */}
      <div className="grid grid-cols-4 gap-6 mb-6">
        {data.map((item, idx) => (
          <div key={idx} className={`p-5 rounded-xl shadow-sm ${item.bg}`}>
            <div className="text-2xl font-bold mb-1">{item.count}</div>
            <div className="text-sm text-gray-600">{item.label}</div>
          </div>
        ))}
      </div>

      {/* All Tasks Button */}
      <div className="flex justify-end">
        <Link
          to="/tasks"
          className="px-4 py-2 bg-gradient-to-r from-yellow-200 via-yellow-300 to-orange-300 text-black rounded-lg shadow hover:bg-gradient-to-r from-yellow-200 via-yellow-400 to-orange-400 transition"
        >
          View All Tasks →
        </Link>
      </div>
    </div>
  );
};

export default SummaryCards;
