import React from "react";
import { Check, X } from "lucide-react";
import { formatLeaveType } from "../../api/leaveApi";

const statusColor = {
  Pending: "bg-yellow-800 text-yellow-300",
  Approved: "bg-green-800 text-green-300",
  Rejected: "bg-red-800 text-red-300",
};

const LeaveRequestsTable = ({
  requests,
  selectedId,
  onSelect,
  onApprove,
  onReject,
}) => {
  return (
    <div
      className="bg-gray-900 rounded-xl shadow p-4 flex flex-col h-full text-gray-200"
      style={{ scrollbarWidth: "none", msOverflowStyle: "none" }}
    >
      <style>{`
        .no-scrollbar::-webkit-scrollbar { display: none; }
        .table-row:hover { background-color: #1f2937; }
        .btn-action { padding: 6px; border-radius: 0.375rem; transition: background-color 0.15s ease; display: flex; align-items: center; justify-content: center; }
        .btn-action:hover:not(:disabled) { background-color: rgba(255 255 255 / 0.1); }
        .btn-disabled { opacity: 0.4; cursor: not-allowed; }
      `}</style>

      <div className="overflow-y-auto no-scrollbar flex-1 min-w-0">
        <table className="min-w-full text-sm table-auto border-separate border-spacing-y-2">
          <thead>
            <tr className="bg-gray-800 text-gray-300">
              <th className="p-3 text-left rounded-tl-lg">Department</th>
              <th className="p-3 text-left">Designation</th>
              <th className="p-3 text-left">Leave Period</th>
              <th className="p-3 text-left">Leave Type</th>
              <th className="p-3 text-center">Status</th>
              <th className="p-3 text-center rounded-tr-lg">Actions</th>
            </tr>
          </thead>
          <tbody>
            {requests.map((req) => {
              const id = req._id || req.id;
              const start = req.period?.start ? new Date(req.period.start) : null;
              const end = req.period?.end ? new Date(req.period.end) : null;
              const validPeriod =
                start && end && !isNaN(start.getTime()) && !isNaN(end.getTime());

              return (
                <tr
                  key={id}
                  className={`table-row bg-gray-900 border border-gray-700 rounded-lg cursor-pointer select-none shadow-sm transition ${
                    selectedId === id
                      ? "bg-blue-800 ring-2 ring-blue-500 shadow-md"
                      : ""
                  }`}
                  onClick={() => onSelect(id)}
                  style={{ height: "62px" }}
                >
                  <td className="p-3 text-gray-300">{req.employee.department}</td>
                  <td className="p-3 text-gray-300">{req.employee.designation}</td>
                  <td className="p-3 text-gray-300 whitespace-nowrap">
                    {validPeriod
                      ? `${start.toLocaleDateString()} - ${end.toLocaleDateString()}`
                      : ""}
                  </td>
                  <td className="p-3 text-gray-300">{formatLeaveType(req.type)}</td>
                  <td className="p-3 text-center align-middle">
                    <span
                      className={`px-2 py-1 rounded-full text-xs font-semibold ${
                        statusColor[req.status] || "bg-gray-700 text-gray-300"
                      }`}
                    >
                      {req.status}
                    </span>
                  </td>
                  <td className="p-3 text-center flex gap-2 justify-center items-center">
                    <button
                      type="button"
                      title="Approve"
                      className={`btn-action ${
                        req.status === "Approved" ? "btn-disabled" : ""
                      }`}
                      onClick={(e) => {
                        e.stopPropagation();
                        if (req.status !== "Approved") onApprove(id);
                      }}
                      disabled={req.status === "Approved"}
                    >
                      <Check className="text-green-400" size={20} />
                    </button>

                    <button
                      type="button"
                      title="Reject"
                      className={`btn-action ${
                        req.status === "Rejected" ? "btn-disabled" : ""
                      }`}
                      onClick={(e) => {
                        e.stopPropagation();
                        if (req.status !== "Rejected") onReject(id);
                      }}
                      disabled={req.status === "Rejected"}
                    >
                      <X className="text-red-400" size={20} />
                    </button>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
};

export default LeaveRequestsTable;
