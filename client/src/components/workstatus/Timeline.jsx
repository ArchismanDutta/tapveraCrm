import React from "react";

// Helper: format ISO timestamp to "hh:mm AM/PM" in local time
export const formatLocalTime = (isoString) => {
  if (!isoString) return "--";
  const date = new Date(isoString);
  let hours = date.getHours();
  const minutes = date.getMinutes();
  const ampm = hours >= 12 ? "PM" : "AM";
  hours = hours % 12 || 12; // Convert 0 → 12
  return `${hours}:${minutes.toString().padStart(2, "0")} ${ampm}`;
};

const Timeline = ({ timeline = [] }) => {
  return (
    <div className="bg-[#161c2c] p-6 rounded-xl shadow-lg w-full border border-[#232945] transition-all hover:shadow-xl">
      {/* Header */}
      <h3 className="font-semibold mb-4 text-lg text-gray-100 border-b border-[#232945] pb-2">
        Today's Timeline
      </h3>

      {/* Empty state */}
      {timeline.length === 0 ? (
        <p className="text-gray-400 text-sm">No timeline events available.</p>
      ) : (
        <ul className="space-y-3">
          {timeline.map((item, index) => (
            <li
              key={index}
              className="flex justify-between items-center bg-[#232945] p-3 rounded-lg hover:bg-[#2a3050] transition-colors"
            >
              <span className="font-medium text-gray-200">{item.type}</span>
              <span className="text-orange-400 font-semibold text-sm">
                {formatLocalTime(item.time)}
              </span>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
};

export default Timeline;
