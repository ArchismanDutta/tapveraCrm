import React from "react";

const formatDate = (date) => {
  if (!date) return "-";
  const d = new Date(date);
  if (isNaN(d)) return "-";
  return d.toLocaleDateString(undefined, { month: "short", day: "numeric" });
};

const UpcomingAnniversaries = ({ anniversaries }) => {
  return (
    <div className="bg-[#1a1f36] border border-gray-700 rounded-2xl shadow-lg p-5">
      <h3 className="text-lg font-semibold text-gray-100 mb-4 flex items-center">
        🎉 Upcoming Work Anniversaries
      </h3>
      <ul className="space-y-3 max-h-64 overflow-auto scrollbar-thin scrollbar-thumb-gray-600 scrollbar-track-transparent">
        {anniversaries.length === 0 && (
          <li className="text-gray-400 text-sm text-center py-4">
            No upcoming anniversaries
          </li>
        )}
        {anniversaries.map((a, idx) => {
          const originalYear = a.originalDoj
            ? new Date(a.originalDoj).getFullYear()
            : null;

          return (
            <li
              key={idx}
              className="flex items-center justify-between p-3 rounded-xl hover:bg-[#2a314d] transition"
            >
              <div className="flex items-center gap-3">
                {a.avatar ? (
                  <img
                    src={a.avatar}
                    alt={a.name}
                    className="w-10 h-10 rounded-full object-cover ring-2 ring-indigo-500/50"
                  />
                ) : (
                  <div className="w-10 h-10 bg-indigo-600 rounded-full flex items-center justify-center font-bold text-white">
                    {a.name.charAt(0)}
                  </div>
                )}
                <div>
                  <p className="font-medium text-gray-100">{a.name}</p>
                  <span className="text-xs text-gray-400">
                    {a.designation || "Employee"}{" "}
                    {originalYear && `• Joined ${originalYear}`}
                  </span>
                </div>
              </div>
              <span className="px-3 py-1 rounded-full text-xs font-medium bg-gray-700 text-gray-300">
                {formatDate(a.nextDate)}
              </span>
            </li>
          );
        })}
      </ul>
    </div>
  );
};

export default UpcomingAnniversaries;
