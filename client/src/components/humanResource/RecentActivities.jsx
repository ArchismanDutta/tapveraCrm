import React from "react";

const RecentActivities = ({ activities }) => (
  <div className="bg-[#1a1f36] border border-gray-700 rounded-2xl shadow-lg p-4">
    <h3 className="text-lg font-semibold text-gray-100 mb-4">Recent Activities</h3>
    <ul className="space-y-4">
      {activities.length === 0 && (
        <li className="text-gray-400 text-sm text-center py-4">
          No recent activities
        </li>
      )}
      {activities.map((act, idx) => (
        <li key={idx} className="flex items-start gap-3">
          <div className={`p-2 rounded-lg ${act.bg} text-white`}>
            {act.icon}
          </div>
          <div>
            <p className="font-medium text-gray-100">{act.title}</p>
            <p className="text-xs text-gray-400">{act.time}</p>
          </div>
        </li>
      ))}
    </ul>
  </div>
);

export default RecentActivities;
