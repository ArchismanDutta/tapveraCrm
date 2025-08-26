import React from "react";

const STATUS_STYLES = {
  Present: "text-green-400 bg-green-900",
  Late: "text-yellow-400 bg-yellow-900",
  Absent: "text-red-400 bg-red-900",
  default: "text-gray-400 bg-gray-900",
};

const RecentActivityTable = ({ activities }) => (
  <div className="bg-[#161c2c] rounded-xl shadow-md p-4 w-full border border-[#232945]">
    <h3 className="font-semibold text-lg mb-4 text-gray-100">Recent Activity</h3>
    <table className="w-full text-sm text-gray-300">
      <thead>
        <tr className="border-b border-[#232945] text-left">
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
            className="border-b border-[#232945] last:border-none hover:bg-[#232945]"
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
