import React from "react";

const RecentActivity = ({ activities }) => {
  if (!activities || activities.length === 0) return null;

  return (
    <div className="bg-white p-6 rounded-xl shadow-md">
      <h3 className="text-xl font-semibold border-b border-gray-300 pb-2 mb-4">Recent Activity</h3>
      <ul className="space-y-4 text-gray-700 text-sm">
        {activities.map((activity, idx) => (
          <li key={idx} className="flex justify-between border-b border-gray-100 pb-3 last:border-none">
            <span className="font-medium">{activity.date}</span>
            <div className="flex gap-6">
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
