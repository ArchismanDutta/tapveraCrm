// File: components/dashboard/LeaveList.jsx
import React from "react";

const LeaveList = ({ leaves = [] }) => {
  if (!leaves || leaves.length === 0) {
    return (
      <p className="text-gray-400 italic text-center py-4">
        No leave records found for the selected period.
      </p>
    );
  }

  return (
    <div className="overflow-x-auto rounded-lg border border-gray-700 shadow-md bg-gray-800">
      <table className="table-auto w-full text-left text-white border-collapse">
        <thead className="bg-gray-700">
          <tr>
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
              <tr
                key={leave._id}
                className="hover:bg-gray-700 transition-colors duration-200"
              >
                <td className="border border-gray-600 px-4 py-2">{startDate}</td>
                <td className="border border-gray-600 px-4 py-2">{endDate}</td>
                <td className="border border-gray-600 px-4 py-2 capitalize">
                  {leave.type || "-"}
                </td>
                <td className="border border-gray-600 px-4 py-2 capitalize">
                  {leave.status || "-"}
                </td>
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
