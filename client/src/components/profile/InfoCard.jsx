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
  <div
    className="bg-[#181d2a]/70 p-7 rounded-3xl shadow-2xl border border-[#262e4a] backdrop-blur-xl"
    style={{
      boxShadow: "inset 0 1px 10px 0 rgba(91, 122, 201, 0.18), 0 6px 30px 0 rgba(36, 44, 92, 0.15)",
      backdropFilter: "blur(16px)",
      WebkitBackdropFilter: "blur(16px)"
    }}
  >
    <h2 className="text-lg font-semibold mb-6 text-blue-100">{title}</h2>
    <ul className="space-y-5">
      {data.map((item, idx) => (
        <li key={idx} className="flex items-center gap-4">
          <span className="text-[#ff8000]">{item.icon}</span>
          <div>
            <p className="text-xs text-blue-300 mb-1">{item.label}</p>
            <p className="font-medium text-blue-50 leading-tight">
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
