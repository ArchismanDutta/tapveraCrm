import React from "react";
import { CheckCircle, XCircle, AlertCircle } from "lucide-react";

const statusStyles = {
  Approved: "bg-green-100 text-green-700",
  Rejected: "bg-red-100 text-red-700",
  Pending: "bg-yellow-100 text-yellow-700",
};

const statusIcons = {
  Approved: <CheckCircle size={14} />,
  Rejected: <XCircle size={14} />,
  Pending: <AlertCircle size={14} />,
};

const RecentLeaveRequests = ({ requests }) => {
  return (
    <div className="bg-white border border-gray-100 shadow-lg rounded-2xl p-6">
      <h3 className="text-xl font-semibold mb-4 text-gray-800">
        Recent Leave Requests
      </h3>
      {requests.length === 0 ? (
        <p className="text-gray-500 text-sm">No leave requests yet.</p>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full text-sm border-collapse">
            <thead className="bg-gray-50">
              <tr className="text-left border-b">
                <th className="p-3">Date</th>
                <th className="p-3">Leave Type</th>
                <th className="p-3">Duration</th>
                <th className="p-3">Status</th>
                <th className="p-3">Remarks</th>
              </tr>
            </thead>
            <tbody>
              {requests.map((req) => {
                const start = req.period?.start
                  ? new Date(req.period.start).toLocaleDateString()
                  : "N/A";
                const end = req.period?.end
                  ? new Date(req.period.end).toLocaleDateString()
                  : "N/A";
                return (
                  <tr
                    key={req._id || req.id}
                    className="border-b last:border-0 hover:bg-gray-50 transition group h-12"
                  >
                    <td className="p-3 text-gray-700">
                      {req.createdAt
                        ? new Date(req.createdAt).toLocaleDateString()
                        : "N/A"}
                    </td>
                    <td className="p-3 capitalize">{req.type}</td>
                    <td className="p-3">{`${start} - ${end}`}</td>
                    <td className="p-3">
                      <span
                        className={`inline-flex items-center gap-1 px-3 py-1 rounded-full text-xs font-medium ${
                          statusStyles[req.status] || ""
                        }`}
                      >
                        {statusIcons[req.status]} {req.status}
                      </span>
                    </td>
                    <td className="p-3 text-gray-600">
                      {req.adminRemarks && req.adminRemarks.trim().length > 0
                        ? req.adminRemarks
                        : "-"}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
};

export default RecentLeaveRequests;
