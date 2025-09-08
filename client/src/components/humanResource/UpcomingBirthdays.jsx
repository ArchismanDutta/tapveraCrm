import React from "react";

const formatDate = (date) => {
  if (!date) return "-";
  const d = new Date(date);
  if (isNaN(d)) return "-";
  return d.toLocaleDateString(undefined, { month: "short", day: "numeric" });
};

const UpcomingBirthdays = ({ birthdays }) => {
  return (
    <div className="bg-[#1a1f36] border border-gray-700 rounded-2xl shadow-lg p-5">
      <h3 className="text-lg font-semibold text-gray-100 mb-4 flex items-center">
        🎂 Upcoming Birthdays
      </h3>
      <ul className="space-y-3 max-h-64 overflow-auto scrollbar-thin scrollbar-thumb-gray-600 scrollbar-track-transparent">
        {birthdays.length === 0 && (
          <li className="text-gray-400 text-sm text-center py-4">
            No upcoming birthdays
          </li>
        )}
        {birthdays.map((b, idx) => {
          const birthYear = b.originalDob
            ? new Date(b.originalDob).getFullYear()
            : null;

          return (
            <li
              key={idx}
              className="flex items-center justify-between p-3 rounded-xl hover:bg-[#2a314d] transition"
            >
              <div className="flex items-center gap-3">
                {b.avatar ? (
                  <img
                    src={b.avatar}
                    alt={b.name}
                    className="w-10 h-10 rounded-full object-cover ring-2 ring-pink-500/50"
                  />
                ) : (
                  <div className="w-10 h-10 bg-pink-600 rounded-full flex items-center justify-center font-bold text-white">
                    {b.name.charAt(0)}
                  </div>
                )}
                <div>
                  <p className="font-medium text-gray-100">{b.name}</p>
                  <span className="text-xs text-gray-400">
                    {b.role || "Employee"}{" "}
                    {birthYear && `• Born ${birthYear}`}
                  </span>
                </div>
              </div>
              <span className="px-3 py-1 rounded-full text-xs font-medium bg-gray-700 text-gray-300">
                {formatDate(b.nextDate)}
              </span>
            </li>
          );
        })}
      </ul>
    </div>
  );
};

export default UpcomingBirthdays;
