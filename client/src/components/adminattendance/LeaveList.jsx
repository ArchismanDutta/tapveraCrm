// File: components/dashboard/LeaveList.jsx
import React from "react";

const LeaveList = ({ leaves = [] }) => {
  if (!leaves || leaves.length === 0) {
    return (
      <p className="text-gray-400 italic">
        No leave records found for the selected period.
      </p>
    );
  }

  return (
    <div className="overflow-x-auto">
      <table className="table-auto border-collapse border border-gray-600 w-full text-left text-white mb-6">
        <thead>
          <tr className="bg-gray-700">
            <th className="border border-gray-600 px-4 py-2">Start Date</th>
            <th className="border border-gray-600 px-4 py-2">End Date</th>
            <th className="border border-gray-600 px-4 py-2">Type</th>
            <th className="border border-gray-600 px-4 py-2">Status</th>
            <th className="border border-gray-600 px-4 py-2">Reason</th>
          </tr>
        </thead>
        <tbody>
          {leaves.map((leave) => {
            const startDate = leave?.period?.start
              ? new Date(leave.period.start).toLocaleDateString()
              : "-";
            const endDate = leave?.period?.end
              ? new Date(leave.period.end).toLocaleDateString()
              : "-";
            return (
              <tr key={leave._id} className="hover:bg-gray-800 transition-colors">
                <td className="border border-gray-600 px-4 py-2">{startDate}</td>
                <td className="border border-gray-600 px-4 py-2">{endDate}</td>
                <td className="border border-gray-600 px-4 py-2">{leave.type || "-"}</td>
                <td className="border border-gray-600 px-4 py-2">{leave.status || "-"}</td>
                <td className="border border-gray-600 px-4 py-2">{leave.reason || "-"}</td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
};

// Default props for safety
LeaveList.defaultProps = {
  leaves: [],
};

export default LeaveList;
