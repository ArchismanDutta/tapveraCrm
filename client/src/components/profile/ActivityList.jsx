// src/components/profile/ActivityList.jsx
import React from "react";

const ActivityList = ({ activities }) => {
  return (
    <div className="bg-white rounded-xl shadow-sm p-6 mt-6 border border-black-500">
      <h2 className="text-lg font-semibold mb-4">Recent Activity</h2>
      <ul className="space-y-4">
        {activities.map((activity, i) => (
          <li key={i} className="flex items-start space-x-3">
            <div>
              <p className="font-medium">{activity.title}</p>
              <p className="text-sm text-gray-500">{activity.subtitle}</p>
              <p className="text-xs text-gray-400 mt-1">{activity.time}</p>
            </div>
          </li>
        ))}
      </ul>
    </div>
  );
};

export default ActivityList;
