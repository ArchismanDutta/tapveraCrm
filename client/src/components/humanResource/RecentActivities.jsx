import React from "react";

const RecentActivities = ({ activities }) => {
  return (
    <div className="bg-white rounded-2xl shadow p-4">
      <h3 className="text-lg font-semibold mb-4">Recent Activities</h3>
      <ul className="space-y-4">
        {activities.map((act, idx) => (
          <li key={idx} className="flex items-start gap-3">
            <div className={`p-2 rounded-lg ${act.bg} text-white`}>
              {act.icon}
            </div>
            <div>
              <p className="font-medium">{act.title}</p>
              <p className="text-xs text-gray-500">{act.time}</p>
            </div>
          </li>
        ))}
      </ul>
    </div>
  );
};

export default RecentActivities;
