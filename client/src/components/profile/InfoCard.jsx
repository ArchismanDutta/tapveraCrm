// src/components/profile/InfoCard.jsx
import React from "react";

const InfoCard = ({ title, data }) => {
  return (
    <div className="bg-white p-6 rounded-lg shadow border border-black-500">
      <h2 className="text-lg font-semibold mb-4">{title}</h2>
      <ul className="space-y-3">
        {data.map((item, idx) => (
          <li key={idx} className="flex items-center gap-3">
            <span className="text-pinkAccent">{item.icon}</span>
            <div>
              <p className="text-sm text-gray-500">{item.label}</p>
              <p className="font-medium">{item.value}</p>
            </div>
          </li>
        ))}
      </ul>
    </div>
  );
};

export default InfoCard;
