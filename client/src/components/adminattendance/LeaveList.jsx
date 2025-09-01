import React from "react";

const LeaveList = ({ leaves }) => {
  if (!leaves || leaves.length === 0)
    return <p className="text-gray-400">No leave records in this period.</p>;

  return (
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
        {leaves.map((leave) => (
          <tr key={leave._id}>
            <td className="border border-gray-600 px-4 py-2">{new Date(leave.period.start).toLocaleDateString()}</td>
            <td className="border border-gray-600 px-4 py-2">{new Date(leave.period.end).toLocaleDateString()}</td>
            <td className="border border-gray-600 px-4 py-2">{leave.type}</td>
            <td className="border border-gray-600 px-4 py-2">{leave.status}</td>
            <td className="border border-gray-600 px-4 py-2">{leave.reason || "-"}</td>
          </tr>
        ))}
      </tbody>
    </table>
  );
};

export default LeaveList;
