import React, { useState, useMemo } from "react";
import { Check, X } from "lucide-react";
import { formatLeaveType } from "../../api/leaveApi";

const statusColor = {
  Pending: "bg-yellow-500/20 text-yellow-300 border border-yellow-500/30",
  Approved: "bg-green-500/20 text-green-300 border border-green-500/30",
  Rejected: "bg-red-500/20 text-red-300 border border-red-500/30",
};

const LeaveRequestsTable = ({ requests, selectedId, onSelect, onApprove, onReject }) => {
  const [searchTerm, setSearchTerm] = useState("");

  // Filter requests based on search term
  const filteredRequests = useMemo(() => {
    if (!searchTerm.trim()) {
      return requests;
    }

    const searchLower = searchTerm.toLowerCase();
    return requests.filter(req => {
      const employeeName = req.employee?.name?.toLowerCase() || "";
      const employeeEmail = req.employee?.email?.toLowerCase() || "";
      const department = req.employee?.department?.toLowerCase() || "";
      const designation = req.employee?.designation?.toLowerCase() || "";

      return employeeName.includes(searchLower) ||
             employeeEmail.includes(searchLower) ||
             department.includes(searchLower) ||
             designation.includes(searchLower);
    });
  }, [requests, searchTerm]);

  const handleSearchChange = (e) => {
    setSearchTerm(e.target.value);
  };

  const handleClearSearch = () => {
    setSearchTerm("");
  };

  const handleKeyDown = (e) => {
    if (e.key === 'Escape') {
      setSearchTerm("");
    }
  };

  return (
    <div className="h-full flex flex-col">
      {/* Search and Filter */}
      <div className="mb-4">
        <div className="relative">
          <input
            type="text"
            value={searchTerm}
            onChange={handleSearchChange}
            onKeyDown={handleKeyDown}
            placeholder="🔍 Search by employee name, email, department..."
            className="w-full bg-slate-800/50 border border-slate-600/50 rounded-xl px-4 py-3 pr-12 text-white placeholder-gray-400 focus:ring-2 focus:ring-cyan-400 focus:border-cyan-400 outline-none transition-all duration-300"
          />

          {/* Clear button */}
          {searchTerm && (
            <button
              onClick={handleClearSearch}
              className="absolute right-3 top-1/2 transform -translate-y-1/2 text-gray-400 hover:text-red-400 transition-colors p-1"
              title="Clear search"
            >
              <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 20 20">
                <path fillRule="evenodd" d="M4.293 4.293a1 1 0 011.414 0L10 8.586l4.293-4.293a1 1 0 111.414 1.414L11.414 10l4.293 4.293a1 1 0 01-1.414 1.414L10 11.414l-4.293 4.293a1 1 0 01-1.414-1.414L8.586 10 4.293 5.707a1 1 0 010-1.414z" clipRule="evenodd" />
              </svg>
            </button>
          )}
        </div>

        {/* Search results indicator */}
        {searchTerm && (
          <div className="mt-2 text-sm text-gray-400">
            {filteredRequests.length === 0 ? (
              <span className="text-red-400">No results found for "{searchTerm}"</span>
            ) : (
              <span>
                Showing {filteredRequests.length} of {requests.length} request{requests.length !== 1 ? 's' : ''}
                {filteredRequests.length !== requests.length && ` matching "${searchTerm}"`}
              </span>
            )}
          </div>
        )}
      </div>

      {/* Table Container */}
      <div className="flex-1 overflow-hidden rounded-2xl border border-slate-600/30">
        <div className="overflow-x-auto overflow-y-auto h-full">
          <table className="w-full text-sm">
            <thead className="bg-gradient-to-r from-slate-700/50 to-slate-800/50 sticky top-0 z-10">
              <tr className="text-gray-300">
                <th className="p-4 text-left font-semibold">Employee</th>
                <th className="p-4 text-left font-semibold">Department</th>
                <th className="p-4 text-left font-semibold">Leave Period</th>
                <th className="p-4 text-left font-semibold">Leave Type</th>
                <th className="p-4 text-center font-semibold">Status</th>
                <th className="p-4 text-center font-semibold">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-700/30">
              {filteredRequests.length === 0 ? (
                <tr>
                  <td colSpan={6} className="p-12 text-center">
                    <div className="flex flex-col items-center space-y-3">
                      <div className="w-16 h-16 bg-slate-700/30 rounded-full flex items-center justify-center">
                        <svg className="w-8 h-8 text-gray-500" fill="currentColor" viewBox="0 0 20 20">
                          <path d="M9 2a1 1 0 000 2h2a1 1 0 100-2H9z" />
                          <path fillRule="evenodd" d="M4 5a2 2 0 012-2v1a1 1 0 102 0V3h4v1a1 1 0 102 0V3a2 2 0 012 2v6a2 2 0 01-2 2H6a2 2 0 01-2-2V5zm8 8a1 1 0 100-2 1 1 0 000 2z" clipRule="evenodd" />
                        </svg>
                      </div>
                      <p className="text-gray-400 text-lg">
                        {searchTerm ? `No results found for "${searchTerm}"` : "No leave requests found"}
                      </p>
                      <p className="text-gray-500 text-sm">
                        {searchTerm ? "Try adjusting your search terms" : "Leave requests will appear here when submitted"}
                      </p>
                    </div>
                  </td>
                </tr>
              ) : (
                filteredRequests.map((req) => {
                  const id = req._id || req.id;
                  const start = req.period?.start ? new Date(req.period.start) : null;
                  const end = req.period?.end ? new Date(req.period.end) : null;
                  const validPeriod = start && end && !isNaN(start.getTime()) && !isNaN(end.getTime());
                  const isSelected = String(selectedId) === String(id);

                  return (
                    <tr
                      key={id}
                      className={`transition-all duration-200 cursor-pointer hover:bg-slate-700/20 ${
                        isSelected
                          ? "bg-gradient-to-r from-cyan-500/10 to-blue-500/10 border-l-4 border-cyan-400"
                          : "hover:border-l-4 hover:border-slate-500"
                      }`}
                      onClick={() => onSelect(id)}
                    >
                      {/* Employee Info */}
                      <td className="p-4">
                        <div className="flex items-center space-x-3">
                          <div className="flex-shrink-0">
                            <img
                              src={req.employee?.avatar || `https://ui-avatars.com/api/?name=${encodeURIComponent(req.employee?.name || 'Unknown')}&background=6366f1&color=ffffff`}
                              alt={req.employee?.name || "Employee"}
                              className="w-10 h-10 rounded-full object-cover border-2 border-slate-600"
                            />
                          </div>
                          <div>
                            <p className="font-semibold text-white">
                              {req.employee?.name || "Unknown Employee"}
                            </p>
                            <p className="text-sm text-gray-400">
                              {req.employee?.email || "-"}
                            </p>
                          </div>
                        </div>
                      </td>

                      {/* Department */}
                      <td className="p-4">
                        <div className="flex flex-col">
                          <span className="text-gray-300 font-medium">
                            {req.employee?.department || "-"}
                          </span>
                          <span className="text-sm text-gray-500">
                            {req.employee?.designation || "-"}
                          </span>
                        </div>
                      </td>

                      {/* Leave Period */}
                      <td className="p-4">
                        <div className="text-gray-300">
                          {validPeriod ? (
                            <div className="flex flex-col">
                              <span className="font-medium">
                                {start.toLocaleDateString('en-US', {
                                  month: 'short',
                                  day: 'numeric',
                                  year: start.getFullYear() !== new Date().getFullYear() ? 'numeric' : undefined
                                })}
                              </span>
                              <span className="text-sm text-gray-400">
                                to {end.toLocaleDateString('en-US', {
                                  month: 'short',
                                  day: 'numeric',
                                  year: end.getFullYear() !== new Date().getFullYear() ? 'numeric' : undefined
                                })}
                              </span>
                            </div>
                          ) : (
                            <span className="text-gray-500">Invalid period</span>
                          )}
                        </div>
                      </td>

                      {/* Leave Type */}
                      <td className="p-4">
                        <span className="inline-flex items-center px-3 py-1 rounded-full text-xs font-medium bg-blue-500/20 text-blue-300 border border-blue-500/30">
                          {formatLeaveType(req.type)}
                        </span>
                      </td>

                      {/* Status */}
                      <td className="p-4 text-center">
                        <span className={`inline-flex items-center px-3 py-1 rounded-full text-xs font-semibold ${statusColor[req.status] || "bg-gray-500/20 text-gray-300 border border-gray-500/30"}`}>
                          {req.status === "Pending" && (
                            <svg className="w-3 h-3 mr-1" fill="currentColor" viewBox="0 0 20 20">
                              <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm1-12a1 1 0 10-2 0v4a1 1 0 00.293.707l2.828 2.829a1 1 0 101.415-1.415L11 9.586V6z" clipRule="evenodd" />
                            </svg>
                          )}
                          {req.status === "Approved" && (
                            <svg className="w-3 h-3 mr-1" fill="currentColor" viewBox="0 0 20 20">
                              <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
                            </svg>
                          )}
                          {req.status === "Rejected" && (
                            <svg className="w-3 h-3 mr-1" fill="currentColor" viewBox="0 0 20 20">
                              <path fillRule="evenodd" d="M4.293 4.293a1 1 0 011.414 0L10 8.586l4.293-4.293a1 1 0 111.414 1.414L11.414 10l4.293 4.293a1 1 0 01-1.414 1.414L10 11.414l-4.293 4.293a1 1 0 01-1.414-1.414L8.586 10 4.293 5.707a1 1 0 010-1.414z" clipRule="evenodd" />
                            </svg>
                          )}
                          {req.status}
                        </span>
                      </td>

                      {/* Actions */}
                      <td className="p-4 text-center">
                        <div className="flex gap-2 justify-center items-center">
                          <button
                            type="button"
                            title="Approve"
                            className={`p-2 rounded-lg transition-all duration-200 ${
                              req.status === "Approved"
                                ? "bg-green-500/20 text-green-400/50 cursor-not-allowed"
                                : "bg-green-500/20 text-green-400 hover:bg-green-500/30 hover:scale-110"
                            }`}
                            onClick={(e) => {
                              e.stopPropagation();
                              if (req.status !== "Approved") onApprove(id);
                            }}
                            disabled={req.status === "Approved"}
                          >
                            <Check size={16} />
                          </button>
                          <button
                            type="button"
                            title="Reject"
                            className={`p-2 rounded-lg transition-all duration-200 ${
                              req.status === "Rejected"
                                ? "bg-red-500/20 text-red-400/50 cursor-not-allowed"
                                : "bg-red-500/20 text-red-400 hover:bg-red-500/30 hover:scale-110"
                            }`}
                            onClick={(e) => {
                              e.stopPropagation();
                              if (req.status !== "Rejected") onReject(id);
                            }}
                            disabled={req.status === "Rejected"}
                          >
                            <X size={16} />
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
};

export default LeaveRequestsTable;