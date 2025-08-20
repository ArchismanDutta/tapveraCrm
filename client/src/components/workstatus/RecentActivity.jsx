import React from "react";

const RecentActivity = ({ activities }) => {
  if (!activities || activities.length === 0) return null;

  return (
    <div className="bg-white p-4 rounded-xl shadow-md w-full">
      <h3 className="text-lg font-semibold border-b border-gray-300 pb-2 mb-2">Recent Activity</h3>
      <ul className="space-y-2 text-gray-700 text-sm">
        {activities.map((activity, idx) => (
          <li key={idx} className="flex justify-between items-center border-b border-gray-100 pb-2 last:border-none">
            <span className="font-medium">{activity.date}</span>
            <div className="flex gap-3">
              <span>{activity.activity}</span>
              <span className="text-gray-500">{activity.time}</span>
            </div>
          </li>
        ))}
      </ul>
    </div>
  );
};

export default RecentActivity;
