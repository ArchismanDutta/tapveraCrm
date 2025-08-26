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

const leaveTypeLabels = {
  maternity: "Maternity Leave",
  paid: "Paid Leave",
  unpaid: "Unpaid Leave",
  sick: "Sick Leave",
  workFromHome: "Work From Home",
  halfDay: "Half Day",
};

const RecentLeaveRequests = ({ requests }) => {
  const safeRequests = Array.isArray(requests) ? requests : [];

  const formatFileSize = (size) => {
    if (!size) return "";
    const kb = parseInt(size) / 1024;
    if (kb < 1024) return `${kb.toFixed(2)} KB`;
    return `${(kb / 1024).toFixed(2)} MB`;
  };

  return (
    <div
      className="bg-[rgba(22,28,48,0.68)] border border-[rgba(84,123,209,0.13)] shadow-[0_8px_32px_0_rgba(10,40,100,0.14)] rounded-3xl p-6 overflow-x-auto"
    >
      <h3 className="text-xl font-semibold mb-4 text-blue-100">Recent Leave Requests</h3>
      {safeRequests.length === 0 ? (
        <p className="text-blue-300 text-sm">No leave requests yet.</p>
      ) : (
        <table className="w-full text-sm border-collapse">
          <thead className="bg-[rgba(36,44,92,0.4)] text-blue-300">
            <tr>
              <th className="p-3 text-left">Date</th>
              <th className="p-3 text-left">Leave Type</th>
              <th className="p-3 text-left">Duration</th>
              <th className="p-3 text-left">Status</th>
              <th className="p-3 text-left">Remarks</th>
              <th className="p-3 text-left">Document</th>
            </tr>
          </thead>
          <tbody>
            {safeRequests.map((req) => {
              const start = req?.period?.start
                ? new Date(req.period.start).toLocaleDateString()
                : "N/A";
              const end = req?.period?.end
                ? new Date(req.period.end).toLocaleDateString()
                : "N/A";
              return (
                <tr
                  key={req._id || req.id}
                  className="border-b border-[rgba(84,123,209,0.13)] last:border-0 hover:bg-[rgba(36,44,92,0.3)] transition group h-12 text-blue-100"
                >
                  <td className="p-3">{req?.createdAt ? new Date(req.createdAt).toLocaleDateString() : "-"}</td>
                  <td className="p-3">{leaveTypeLabels[req?.type] || req?.type || "-"}</td>
                  <td className="p-3">{`${start} - ${end}`}</td>
                  <td className="p-3">
                    <span
                      className={`inline-flex items-center gap-1 px-3 py-1 rounded-full text-xs font-medium ${
                        statusStyles[req?.status] || "bg-gray-100 text-gray-700"
                      }`}
                    >
                      {statusIcons[req?.status] || <AlertCircle size={14} />} {req?.status || "-"}
                    </span>
                  </td>
                  <td className="p-3 text-blue-300">{req?.adminRemarks?.trim() || "-"}</td>
                  <td className="p-3">
                    {req?.document?.url ? (
                      <a
                        href={req.document.url}
                        target="_blank"
                        rel="noopener noreferrer"
                        download={req.document.name || "document"}
                        className="hover:underline text-[#ff8000]"
                      >
                        {req.document.name || "Document"}{" "}
                        {req.document.size ? `(${formatFileSize(req.document.size)})` : ""}
                      </a>
                    ) : (
                      "-"
                    )}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      )}
    </div>
  );
};

export default RecentLeaveRequests;
