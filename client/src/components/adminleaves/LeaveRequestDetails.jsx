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
      <div className="bg-white rounded-xl shadow p-8 flex items-center justify-center h-full">
        <span className="text-gray-500">Select a leave request...</span>
      </div>
    );

  const { employee, period, type, reason, document, status } = request;
  const formatPeriod = (period) => {
    if (!period?.start || !period?.end) return "N/A";
    const start = new Date(period.start);
    const end = new Date(period.end);
    if (isNaN(start.getTime()) || isNaN(end.getTime())) return "N/A";
    return `${start.toLocaleDateString()} - ${end.toLocaleDateString()}`;
  };

  return (
    <div className="bg-white rounded-xl shadow p-8 flex flex-col gap-6 min-h-[320px]">
      <h3 className="font-semibold text-xl mb-2">Leave Request Details</h3>
      <div className="flex gap-3 items-center">
        <img
          src={employee.avatar}
          alt={employee.name}
          className="w-12 h-12 rounded-full object-cover"
        />
        <div className="flex flex-col">
          <span className="font-bold text-gray-800">{employee.name}</span>
          <span className="text-xs text-gray-500">{employee.email}</span>
          <span className="text-sm text-gray-700">
            <span className="text-gray-500">Department: </span>{employee.department}
          </span>
          <span className="text-sm text-gray-700">
            <span className="text-gray-500">Designation: </span>{employee.designation}
          </span>
        </div>
      </div>
      <div className="space-y-1 text-gray-800">
        <div>
          <span className="text-gray-500 font-medium">Leave Type: </span>
          <span className="font-bold capitalize">{type}</span>
        </div>
        <div>
          <span className="text-gray-500 font-medium">Duration: </span>
          <span>{formatPeriod(period)}</span>
        </div>
        <div>
          <span className="text-gray-500 font-medium">Reason: </span>
          <span className="font-bold">{reason}</span>
        </div>
      </div>
      {document && (
        <div>
          <span className="text-gray-500 mb-1 block">Attached Documents</span>
          <div className="bg-gray-100 rounded flex items-center justify-between px-3 py-2 text-sm">
            <span>
              {document.name}{" "}
              <span className="text-xs text-gray-500">({document.size})</span>
            </span>
            <a
              href={document.url}
              download
              className="text-blue-600 font-semibold text-sm hover:underline"
            >
              Download
            </a>
          </div>
        </div>
      )}
      <div>
        <label className="text-gray-500 mb-2 block font-medium">Admin Remarks</label>
        <textarea
          value={adminRemarks}
          onChange={(e) => onChangeRemarks(e.target.value)}
          className="rounded border p-3 w-full text-sm bg-gray-50 focus:outline-none focus:border-blue-400 min-h-[38px] max-h-[80px] resize-none"
          placeholder="Add your remarks here..."
        />
      </div>
      <div className="flex gap-3 justify-end pt-2">
        <button
          type="button"
          className="px-4 py-2 rounded border text-gray-700 hover:bg-gray-100 transition"
          onClick={() => onChangeRemarks("")}
        >
          Cancel
        </button>
        <button
          type="button"
          className="px-4 py-2 rounded bg-green-600 text-white font-bold hover:bg-green-700 transition"
          onClick={() => onApprove(request.id)}
          disabled={status === "Approved"}
        >
          Approve Request
        </button>
        <button
          type="button"
          className="px-4 py-2 rounded bg-red-600 text-white font-bold hover:bg-red-700 transition"
          onClick={() => onReject(request.id)}
          disabled={status === "Rejected"}
        >
          Reject Request
        </button>
      </div>
    </div>
  );
};

export default LeaveRequestDetails;
