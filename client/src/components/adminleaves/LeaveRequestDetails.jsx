import React from "react";

const LeaveRequestDetails = ({
  request,
  adminRemarks,
  onChangeRemarks,
  onApprove,
  onReject,
}) => {
  if (!request)
    return (
      <div className="bg-gray-900 rounded-xl shadow p-8 flex items-center justify-center h-full text-gray-400">
        <span>Select a leave request...</span>
      </div>
    );

  const { employee = {}, period = {}, type, reason, document, status } = request;

  const leaveTypeLabels = {
    annual: "Annual Leave",
    paid: "Paid Leave",
    unpaid: "Unpaid Leave",
    sick: "Sick Leave",
    workFromHome: "Work From Home",
    maternity: "Maternity Leave",
    halfDay: "Half Day",
  };

  const formatPeriod = (period) => {
    if (!period.start || !period.end) return "N/A";
    const start = new Date(period.start);
    const end = new Date(period.end);
    if (isNaN(start.getTime()) || isNaN(end.getTime())) return "N/A";
    return `${start.toLocaleDateString()} - ${end.toLocaleDateString()}`;
  };

  const formatFileSize = (size) => {
    if (!size) return "";
    const kb = parseInt(size) / 1024;
    if (kb < 1024) return `${kb.toFixed(2)} KB`;
    return `${(kb / 1024).toFixed(2)} MB`;
  };

  return (
    <div className="bg-gray-900 rounded-xl shadow p-8 flex flex-col gap-6 min-h-[320px] text-gray-200">
      <h3 className="font-semibold text-xl mb-2">Leave Request Details</h3>

      <div className="flex gap-3 items-center">
        <img
          src={employee.avatar || "/default-avatar.png"}
          alt={employee.name || "Employee"}
          className="w-12 h-12 rounded-full object-cover"
        />
        <div className="flex flex-col">
          <span className="font-bold text-gray-100">{employee.name || "-"}</span>
          <span className="text-xs text-gray-400">{employee.email || "-"}</span>
          <span className="text-sm text-gray-300">
            <span className="text-gray-500">Department: </span>
            {employee.department || "-"}
          </span>
          <span className="text-sm text-gray-300">
            <span className="text-gray-500">Designation: </span>
            {employee.designation || "-"}
          </span>
        </div>
      </div>

      <div className="space-y-1 text-gray-200">
        <div>
          <span className="text-gray-500 font-medium">Leave Type: </span>
          <span className="font-bold capitalize">
            {leaveTypeLabels[type] || type || "-"}
          </span>
        </div>
        <div>
          <span className="text-gray-500 font-medium">Duration: </span>
          <span>{formatPeriod(period)}</span>
        </div>
        <div>
          <span className="text-gray-500 font-medium">Reason: </span>
          <span className="font-bold">{reason || "-"}</span>
        </div>
      </div>

      {/* Display Supporting Document */}
      {document?.url && (
        <div>
          <span className="text-gray-500 mb-1 block">Supporting Document</span>
          <div className="bg-gray-800 rounded flex items-center justify-between px-3 py-2 text-sm">
            <span className="truncate">
              {document.name || "Document"}{" "}
              <span className="text-xs text-gray-400">({formatFileSize(document.size)})</span>
            </span>
            <a
              href={document.url}
              target="_blank"
              rel="noopener noreferrer"
              download={document.name}
              className="text-blue-400 font-semibold text-sm hover:underline"
            >
              Download
            </a>
          </div>
        </div>
      )}

      {/* Admin Remarks */}
      <div>
        <label className="text-gray-400 mb-2 block font-medium">Admin Remarks</label>
        <textarea
          value={adminRemarks}
          onChange={(e) => onChangeRemarks(e.target.value)}
          className="rounded border bg-gray-800 p-3 w-full text-sm text-gray-200 focus:outline-none focus:border-blue-500 min-h-[38px] max-h-[80px] resize-none"
          placeholder="Add your remarks here..."
        />
      </div>

      {/* Actions */}
      <div className="flex gap-3 justify-end pt-2">
        <button
          type="button"
          className="px-4 py-2 rounded border border-gray-700 text-gray-300 hover:bg-gray-700 transition"
          onClick={() => onChangeRemarks("")}
        >
          Cancel
        </button>
        <button
          type="button"
          className="px-4 py-2 rounded bg-green-700 text-white font-bold hover:bg-green-800 transition"
          onClick={() => onApprove(request._id)}
          disabled={status === "Approved"}
        >
          Approve Request
        </button>
        <button
          type="button"
          className="px-4 py-2 rounded bg-red-700 text-white font-bold hover:bg-red-800 transition"
          onClick={() => onReject(request._id)}
          disabled={status === "Rejected"}
        >
          Reject Request
        </button>
      </div>
    </div>
  );
};

export default LeaveRequestDetails;
