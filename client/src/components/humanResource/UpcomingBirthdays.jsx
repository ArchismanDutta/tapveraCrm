import React from "react";

const UpcomingBirthdays = ({ birthdays }) => {
  return (
    <div className="bg-[#1a1f36] border border-gray-700 rounded-2xl shadow-lg p-5">
      <h3 className="text-lg font-semibold text-gray-100 mb-4 flex items-center">
        🎂 Upcoming Birthdays
      </h3>
      <ul className="space-y-3">
        {birthdays.length === 0 && (
          <li className="text-gray-400 text-sm text-center py-4">
            No upcoming birthdays
          </li>
        )}
        {birthdays.map((b, idx) => (
          <li
            key={idx}
            className="flex items-center justify-between p-3 rounded-xl hover:bg-[#2a314d] transition"
          >
            <div className="flex items-center gap-3">
              <img
                src={b.avatar}
                alt={b.name}
                className="w-10 h-10 rounded-full object-cover ring-2 ring-pink-500/50"
              />
              <div>
                <p className="font-medium text-gray-100">{b.name}</p>
                <span className="text-xs text-gray-400">{b.role}</span>
              </div>
            </div>
            <span className="px-3 py-1 rounded-full text-xs font-medium bg-gray-700 text-gray-300">
              {b.date}
            </span>
          </li>
        ))}
      </ul>
    </div>
  );
};

export default UpcomingBirthdays;
