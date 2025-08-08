// src/components/dashboard/SummaryCards.jsx
import React from "react";

const SummaryCards = ({ data }) => {
  return (
    <div className="grid grid-cols-4 gap-6 mb-8">
      {data.map((item, idx) => (
        <div key={idx} className={`p-5 rounded-xl shadow-sm ${item.bg}`}>
          <div className="text-2xl font-bold mb-1">{item.count}</div>
          <div className="text-sm text-gray-600">{item.label}</div>
        </div>
      ))}
    </div>
  );
};

export default SummaryCards;
