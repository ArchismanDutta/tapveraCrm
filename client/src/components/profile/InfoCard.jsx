import React from "react";

const formatDate = (dateString) => {
  if (!dateString) return "N/A";
  const date = new Date(dateString);
  return date.toLocaleDateString("en-GB", {
    day: "2-digit",
    month: "short",
    year: "numeric",
  });
};

const InfoCard = ({ title, data }) => (
  <div className="bg-[#181d2a]/70 p-7 rounded-2xl shadow-lg border border-[#262e4a]">
    <h2 className="text-lg font-semibold mb-5 text-blue-100">{title}</h2>
    <ul className="space-y-5">
      {data.map((item, idx) => (
        <li key={idx} className="flex items-center gap-4">
          <span className="text-[#ff8000]">{item.icon}</span>
          <div>
            <p className="text-xs text-blue-300 mb-0.5">{item.label}</p>
            <p className="font-medium text-blue-50">
              {item.label.toLowerCase() === "dob"
                ? formatDate(item.value)
                : item.value || "N/A"}
            </p>
          </div>
        </li>
      ))}
    </ul>
  </div>
);

export default InfoCard;
