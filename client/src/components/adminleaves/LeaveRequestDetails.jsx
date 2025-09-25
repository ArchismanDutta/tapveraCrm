import React from "react";

const LeaveRequestDetails = ({
  request,
  adminRemarks,
  onChangeRemarks,
  onApprove,
  onReject,
  onSaveRemarks,
}) => {
  if (!request) {
    return (
      <div className="h-full flex flex-col items-center justify-center text-center space-y-6 p-6">
        <div className="w-20 h-20 bg-gradient-to-br from-purple-500/20 to-pink-600/20 rounded-full flex items-center justify-center">
          <svg className="w-10 h-10 text-purple-400" fill="currentColor" viewBox="0 0 20 20">
            <path fillRule="evenodd" d="M4 4a2 2 0 012-2h8a2 2 0 012 2v12a2 2 0 01-2 2H6a2 2 0 01-2-2V4zm2 0v12h8V4H6z" clipRule="evenodd" />
          </svg>
        </div>
        <div>
          <h3 className="text-xl font-semibold text-white mb-2">No Request Selected</h3>
          <p className="text-gray-400 max-w-sm leading-relaxed">
            Click on a leave request from the table to view detailed information and take action.
          </p>
        </div>
        <div className="w-full max-w-xs h-1 bg-gradient-to-r from-purple-500/30 to-pink-600/30 rounded-full"></div>
      </div>
    );
  }

  const { employee = {}, period = {}, type, reason, document, status, approvedBy } = request;

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

    const options = {
      month: 'short',
      day: 'numeric',
      year: start.getFullYear() !== new Date().getFullYear() ? 'numeric' : undefined
    };

    return `${start.toLocaleDateString('en-US', options)} - ${end.toLocaleDateString('en-US', options)}`;
  };

  const formatFileSize = (size) => {
    if (!size) return "";
    const kb = parseInt(size) / 1024;
    if (kb < 1024) return `${kb.toFixed(2)} KB`;
    return `${(kb / 1024).toFixed(2)} MB`;
  };

  const getStatusColor = (status) => {
    switch (status) {
      case "Pending": return "bg-yellow-500/20 text-yellow-300 border border-yellow-500/30";
      case "Approved": return "bg-green-500/20 text-green-300 border border-green-500/30";
      case "Rejected": return "bg-red-500/20 text-red-300 border border-red-500/30";
      default: return "bg-gray-500/20 text-gray-300 border border-gray-500/30";
    }
  };

  return (
    <div className="space-y-4">
      {/* Employee Info */}
      <div className="bg-slate-800/30 border border-slate-600/30 rounded-2xl p-4 hover:border-purple-500/30 transition-all duration-300">
        <div className="flex items-center space-x-4">
          <img
            src={employee.avatar || `https://ui-avatars.com/api/?name=${encodeURIComponent(employee.name || 'Unknown')}&background=6366f1&color=ffffff`}
            alt={employee.name || "Employee"}
            className="w-12 h-12 rounded-full object-cover border-2 border-purple-400/50 shadow-lg"
          />
          <div className="flex-1 min-w-0">
            <h3 className="text-lg font-bold text-white truncate">{employee.name || "Unknown Employee"}</h3>
            <p className="text-purple-300 text-sm truncate">{employee.email || "-"}</p>
            <div className="flex items-center space-x-3 mt-1 text-xs text-gray-400">
              <span>
                <span className="text-gray-500">Dept:</span> {employee.department || "-"}
              </span>
              <span>
                <span className="text-gray-500">Role:</span> {employee.designation || "-"}
              </span>
            </div>
          </div>
        </div>
      </div>

      {/* Leave Details */}
      <div className="bg-slate-800/30 border border-slate-600/30 rounded-2xl p-4 space-y-3 hover:border-purple-500/30 transition-all duration-300">
        <h4 className="text-lg font-semibold text-white mb-3">Leave Information</h4>

        {/* Status Badge */}
        <div className="flex items-center justify-between">
          <span className="text-gray-400 text-sm">Status:</span>
          <span className={`inline-flex items-center px-3 py-1 rounded-full text-xs font-semibold ${getStatusColor(status)}`}>
            {status === "Pending" && (
              <svg className="w-3 h-3 mr-1" fill="currentColor" viewBox="0 0 20 20">
                <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm1-12a1 1 0 10-2 0v4a1 1 0 00.293.707l2.828 2.829a1 1 0 101.415-1.415L11 9.586V6z" clipRule="evenodd" />
              </svg>
            )}
            {status === "Approved" && (
              <svg className="w-3 h-3 mr-1" fill="currentColor" viewBox="0 0 20 20">
                <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
              </svg>
            )}
            {status === "Rejected" && (
              <svg className="w-3 h-3 mr-1" fill="currentColor" viewBox="0 0 20 20">
                <path fillRule="evenodd" d="M4.293 4.293a1 1 0 011.414 0L10 8.586l4.293-4.293a1 1 0 111.414 1.414L11.414 10l4.293 4.293a1 1 0 01-1.414 1.414L10 11.414l-4.293 4.293a1 1 0 01-1.414-1.414L8.586 10 4.293 5.707a1 1 0 010-1.414z" clipRule="evenodd" />
              </svg>
            )}
            {status}
          </span>
        </div>

        <div className="space-y-3">
          <div className="flex justify-between items-center">
            <span className="text-gray-400 text-sm">Leave Type:</span>
            <span className="inline-flex items-center px-3 py-1 rounded-full text-xs font-medium bg-blue-500/20 text-blue-300 border border-blue-500/30">
              {leaveTypeLabels[type] || type || "-"}
            </span>
          </div>

          <div className="flex justify-between items-center">
            <span className="text-gray-400 text-sm">Duration:</span>
            <span className="text-white font-medium text-sm">{formatPeriod(period)}</span>
          </div>

          <div className="flex flex-col space-y-2">
            <span className="text-gray-400 text-sm">Reason:</span>
            <div className="bg-slate-700/30 rounded-lg p-3 max-h-20 overflow-y-auto">
              <p className="text-white text-xs leading-relaxed">{reason || "No reason provided"}</p>
            </div>
          </div>
        </div>
      </div>

      {/* Supporting Document */}
      {document?.url && (
        <div className="bg-slate-800/30 border border-slate-600/30 rounded-2xl p-4 hover:border-purple-500/30 transition-all duration-300">
          <h4 className="text-sm font-semibold text-white mb-3">Supporting Document</h4>
          <div className="bg-slate-700/30 rounded-lg p-3 flex items-center justify-between">
            <div className="flex items-center space-x-3 min-w-0 flex-1">
              <div className="w-8 h-8 bg-purple-500/20 rounded-lg flex items-center justify-center flex-shrink-0">
                <svg className="w-4 h-4 text-purple-400" fill="currentColor" viewBox="0 0 20 20">
                  <path fillRule="evenodd" d="M4 4a2 2 0 012-2h8a2 2 0 012 2v12a2 2 0 01-2 2H6a2 2 0 01-2-2V4zm2 0v12h8V4H6z" clipRule="evenodd" />
                </svg>
              </div>
              <div className="min-w-0 flex-1">
                <p className="text-white font-medium text-sm truncate">{document.name || "Document"}</p>
                <p className="text-gray-400 text-xs">{formatFileSize(document.size)}</p>
              </div>
            </div>
            <a
              href={document.url}
              target="_blank"
              rel="noopener noreferrer"
              download={document.name}
              className="bg-purple-600 hover:bg-purple-700 text-white px-3 py-1 rounded-lg text-xs font-medium transition-all duration-200 hover:scale-105 flex-shrink-0"
            >
              Download
            </a>
          </div>
        </div>
      )}

      {/* Approved By */}
      {status === "Approved" && approvedBy && (
        <div className="bg-green-500/10 border border-green-500/30 rounded-2xl p-4">
          <h4 className="text-sm font-semibold text-green-300 mb-3">Approved By</h4>
          <div className="flex items-center space-x-3">
            <div className="w-8 h-8 bg-green-500/20 rounded-full flex items-center justify-center">
              <svg className="w-4 h-4 text-green-400" fill="currentColor" viewBox="0 0 20 20">
                <path fillRule="evenodd" d="M10 9a3 3 0 100-6 3 3 0 000 6zm-7 9a7 7 0 1114 0H3z" clipRule="evenodd" />
              </svg>
            </div>
            <div className="min-w-0 flex-1">
              <p className="text-green-300 font-semibold text-sm truncate">{approvedBy.name || "Unknown"}</p>
              <p className="text-green-200 text-xs truncate">{approvedBy.email || "-"}</p>
            </div>
          </div>
        </div>
      )}

      {/* Admin Remarks */}
      <div className="bg-slate-800/30 border border-slate-600/30 rounded-2xl p-4 hover:border-purple-500/30 transition-all duration-300">
        <div className="flex items-center justify-between mb-3">
          <h4 className="text-sm font-semibold text-white">Admin Remarks</h4>
          {onSaveRemarks && (
            <button
              type="button"
              onClick={() => onSaveRemarks(request._id)}
              className="px-3 py-1 bg-blue-600 hover:bg-blue-700 text-white text-xs rounded-lg transition-colors"
            >
              Save Remarks
            </button>
          )}
        </div>
        <textarea
          value={adminRemarks}
          onChange={(e) => onChangeRemarks(e.target.value)}
          className="w-full bg-slate-700/50 border border-slate-600/50 rounded-xl p-3 text-white placeholder-gray-400 focus:ring-2 focus:ring-purple-400 focus:border-purple-400 outline-none transition-all duration-300 resize-none text-sm"
          placeholder="Add your remarks here..."
          rows={3}
        />
      </div>

      {/* Actions */}
      {status !== "Approved" && status !== "Rejected" && (
        <div className="flex gap-3 pt-2">
          <button
            type="button"
            className="flex-1 bg-gradient-to-r from-green-600 to-green-700 hover:from-green-700 hover:to-green-800 text-white font-semibold py-2 px-4 rounded-xl transition-all duration-200 hover:scale-105 hover:shadow-lg hover:shadow-green-500/25 flex items-center justify-center space-x-2 text-sm"
            onClick={() => onApprove(request._id)}
          >
            <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 20 20">
              <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
            </svg>
            <span>Approve</span>
          </button>
          <button
            type="button"
            className="flex-1 bg-gradient-to-r from-red-600 to-red-700 hover:from-red-700 hover:to-red-800 text-white font-semibold py-2 px-4 rounded-xl transition-all duration-200 hover:scale-105 hover:shadow-lg hover:shadow-red-500/25 flex items-center justify-center space-x-2 text-sm"
            onClick={() => onReject(request._id)}
          >
            <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 20 20">
              <path fillRule="evenodd" d="M4.293 4.293a1 1 0 011.414 0L10 8.586l4.293-4.293a1 1 0 111.414 1.414L11.414 10l4.293 4.293a1 1 0 01-1.414 1.414L10 11.414l-4.293 4.293a1 1 0 01-1.414-1.414L8.586 10 4.293 5.707a1 1 0 010-1.414z" clipRule="evenodd" />
            </svg>
            <span>Reject</span>
          </button>
        </div>
      )}
    </div>
  );
};

export default LeaveRequestDetails;