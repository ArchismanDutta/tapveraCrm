// RecentActivityTable.jsx
import React from "react";

const STATUS_STYLES = {
  Present: "text-green-600 bg-green-50",
  Late: "text-yellow-600 bg-yellow-50",
  Absent: "text-red-600 bg-red-50",
  default: "text-gray-600 bg-gray-50",
};

const RecentActivityTable = ({ activities }) => (
  <div className="bg-white rounded-xl shadow-md p-4 w-full">
    <h3 className="font-semibold text-lg mb-4">Recent Activity</h3>
    <table className="w-full text-sm">
      <thead>
        <tr className="border-b border-gray-200 text-left text-gray-600">
          <th className="py-2 px-3">Date</th>
          <th className="py-2 px-3">Time In</th>
          <th className="py-2 px-3">Time Out</th>
          <th className="py-2 px-3">Status</th>
        </tr>
      </thead>
      <tbody>
        {activities.map(({ date, timeIn, timeOut, status }, idx) => (
          <tr
            key={idx}
            className="border-b border-gray-100 last:border-none hover:bg-gray-50"
          >
            <td className="py-2 px-3">{date}</td>
            <td className="py-2 px-3">{timeIn}</td>
            <td className="py-2 px-3">{timeOut}</td>
            <td className="py-2 px-3">
              <span
                className={`px-3 py-1 rounded-full font-semibold text-xs ${
                  STATUS_STYLES[status] || STATUS_STYLES.default
                }`}
              >
                {status}
              </span>
            </td>
          </tr>
        ))}
      </tbody>
    </table>
  </div>
);

export default RecentActivityTable;
