import React from "react";

const RecentActivity = ({ activities }) => {
  if (!activities || activities.length === 0) return null;

  return (
    <div className="bg-[#161c2c] p-4 rounded-xl shadow-md w-full border border-[#232945]">
      <h3 className="text-lg font-semibold border-b border-[#232945] pb-2 mb-2 text-gray-100">
        Recent Activity
      </h3>
      <ul className="space-y-2 text-gray-200 text-sm">
        {activities.map((activity, idx) => (
          <li
            key={idx}
            className="flex justify-between items-center border-b border-[#232945] pb-2 last:border-none"
          >
            <span className="font-medium text-orange-400">{activity.date}</span>
            <div className="flex gap-3">
              <span>{activity.activity}</span>
              <span className="text-gray-400">{activity.time}</span>
            </div>
          </li>
        ))}
      </ul>
    </div>
  );
};

export default RecentActivity;
