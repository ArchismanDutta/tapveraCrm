import React, { useMemo, useState } from "react";
import { Check, Search, X } from "lucide-react";
import { formatLeaveType } from "../../api/leaveApi";

const statusColor = {
  Pending:
    "border border-amber-200 bg-amber-50 text-amber-700 dark:border-amber-400/20 dark:bg-amber-400/10 dark:text-amber-200",
  Approved:
    "border border-emerald-200 bg-emerald-50 text-emerald-700 dark:border-emerald-400/20 dark:bg-emerald-400/10 dark:text-emerald-200",
  Rejected:
    "border border-rose-200 bg-rose-50 text-rose-700 dark:border-rose-400/20 dark:bg-rose-400/10 dark:text-rose-200",
};

const formatDate = (date) =>
  date.toLocaleDateString("en-IN", {
    day: "numeric",
    month: "short",
    year: date.getFullYear() !== new Date().getFullYear() ? "numeric" : undefined,
  });

const LeaveRequestsTable = ({
  requests,
  selectedId,
  onSelect,
  onApprove,
  onReject,
}) => {
  const [searchTerm, setSearchTerm] = useState("");

  const filteredRequests = useMemo(() => {
    const query = searchTerm.trim().toLowerCase();
    if (!query) return requests;
    return requests.filter((request) =>
      [
        request.employee?.name,
        request.employee?.email,
        request.employee?.department,
        request.employee?.designation,
      ].some((value) => value?.toLowerCase().includes(query)),
    );
  }, [requests, searchTerm]);

  return (
    <div className="flex h-full flex-col">
      <div className="mb-4">
        <label className="relative block">
          <span className="sr-only">Search leave requests</span>
          <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
          <input
            type="search"
            value={searchTerm}
            onChange={(event) => setSearchTerm(event.target.value)}
            onKeyDown={(event) => {
              if (event.key === "Escape") setSearchTerm("");
            }}
            placeholder="Search name, email, or department"
            className="h-10 w-full rounded-xl border border-slate-200 bg-slate-50 pl-10 pr-10 text-sm text-slate-900 outline-none transition placeholder:text-slate-400 focus:border-blue-500 focus:bg-white focus:ring-2 focus:ring-blue-500/15 dark:border-white/10 dark:bg-white/[0.035] dark:text-white"
          />
          {searchTerm && (
            <button
              type="button"
              onClick={() => setSearchTerm("")}
              className="absolute right-3 top-1/2 -translate-y-1/2 rounded-md p-1 text-slate-400 transition hover:bg-slate-100 hover:text-rose-600 dark:hover:bg-white/[0.05]"
              aria-label="Clear search"
            >
              <X className="h-4 w-4" />
            </button>
          )}
        </label>
        {searchTerm && (
          <p className="mt-2 text-xs text-slate-500 dark:text-slate-400">
            {filteredRequests.length} of {requests.length} requests shown
          </p>
        )}
      </div>

      <div className="flex-1 overflow-hidden rounded-xl border border-slate-200 dark:border-white/10">
        <div className="h-full overflow-auto">
          <table className="w-full min-w-[850px] text-sm">
            <thead className="sticky top-0 z-10 bg-slate-50 dark:bg-[#151923]">
              <tr className="border-b border-slate-200 text-left text-[11px] font-semibold uppercase tracking-wider text-slate-500 dark:border-white/10 dark:text-slate-400">
                {[
                  "Employee",
                  "Department",
                  "Leave period",
                  "Leave type",
                  "Status",
                  "Actions",
                ].map((heading) => (
                  <th key={heading} className="px-4 py-3">
                    {heading}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-200 dark:divide-white/10">
              {filteredRequests.length === 0 ? (
                <tr>
                  <td colSpan={6} className="p-12 text-center">
                    <Search className="mx-auto h-6 w-6 text-slate-400" />
                    <p className="mt-3 text-sm font-semibold text-slate-700 dark:text-slate-200">
                      No leave requests found
                    </p>
                    <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">
                      {searchTerm
                        ? "Try a different search term."
                        : "New requests will appear here."}
                    </p>
                  </td>
                </tr>
              ) : (
                filteredRequests.map((request) => {
                  const id = request._id || request.id;
                  const start = request.period?.start
                    ? new Date(request.period.start)
                    : null;
                  const end = request.period?.end
                    ? new Date(request.period.end)
                    : null;
                  const validPeriod =
                    start &&
                    end &&
                    !Number.isNaN(start.getTime()) &&
                    !Number.isNaN(end.getTime());
                  const isSelected = String(selectedId) === String(id);

                  return (
                    <tr
                      key={id}
                      onClick={() => onSelect(id)}
                      className={`cursor-pointer transition ${
                        isSelected
                          ? "bg-blue-50 dark:bg-blue-950/30"
                          : "hover:bg-slate-50 dark:hover:bg-white/[0.025]"
                      }`}
                    >
                      <td className="px-4 py-3.5">
                        <div className="flex items-center gap-3">
                          <img
                            src={
                              request.employee?.avatar ||
                              `https://ui-avatars.com/api/?name=${encodeURIComponent(
                                request.employee?.name || "Unknown",
                              )}&background=6366f1&color=ffffff`
                            }
                            alt={request.employee?.name || "Employee"}
                            className="h-9 w-9 rounded-full border border-slate-200 object-cover dark:border-white/10"
                          />
                          <div className="min-w-0">
                            <p className="truncate font-semibold text-slate-900 dark:text-white">
                              {request.employee?.name || "Unknown employee"}
                            </p>
                            <p className="truncate text-xs text-slate-500 dark:text-slate-400">
                              {request.employee?.email || "—"}
                            </p>
                          </div>
                        </div>
                      </td>
                      <td className="px-4 py-3.5">
                        <p className="font-medium text-slate-700 dark:text-slate-200">
                          {request.employee?.department || "—"}
                        </p>
                        <p className="text-xs text-slate-500 dark:text-slate-400">
                          {request.employee?.designation || "—"}
                        </p>
                      </td>
                      <td className="px-4 py-3.5 text-slate-700 dark:text-slate-200">
                        {validPeriod ? (
                          <>
                            <p className="font-medium">{formatDate(start)}</p>
                            <p className="text-xs text-slate-500 dark:text-slate-400">
                              to {formatDate(end)}
                            </p>
                          </>
                        ) : (
                          <span className="text-slate-400">Invalid period</span>
                        )}
                      </td>
                      <td className="px-4 py-3.5">
                        <span className="inline-flex rounded-full border border-blue-200 bg-blue-50 px-2.5 py-1 text-xs font-medium text-blue-700 dark:border-blue-400/20 dark:bg-blue-400/10 dark:text-blue-200">
                          {formatLeaveType(request.type)}
                        </span>
                      </td>
                      <td className="px-4 py-3.5">
                        <span
                          className={`inline-flex rounded-full px-2.5 py-1 text-xs font-semibold ${
                            statusColor[request.status] ||
                            "border border-slate-200 bg-slate-100 text-slate-600 dark:border-white/10 dark:bg-white/[0.05] dark:text-slate-300"
                          }`}
                        >
                          {request.status}
                        </span>
                      </td>
                      <td className="px-4 py-3.5">
                        <div className="flex items-center gap-2">
                          <button
                            type="button"
                            title="Approve"
                            disabled={request.status === "Approved"}
                            onClick={(event) => {
                              event.stopPropagation();
                              onApprove(id);
                            }}
                            className="rounded-lg bg-emerald-50 p-2 text-emerald-700 transition hover:bg-emerald-100 disabled:cursor-not-allowed disabled:bg-slate-100 disabled:text-slate-300 dark:bg-emerald-400/10 dark:text-emerald-300 dark:disabled:bg-white/[0.04] dark:disabled:text-slate-600"
                          >
                            <Check className="h-4 w-4" />
                          </button>
                          <button
                            type="button"
                            title="Reject"
                            disabled={request.status === "Rejected"}
                            onClick={(event) => {
                              event.stopPropagation();
                              onReject(id);
                            }}
                            className="rounded-lg bg-rose-50 p-2 text-rose-700 transition hover:bg-rose-100 disabled:cursor-not-allowed disabled:bg-slate-100 disabled:text-slate-300 dark:bg-rose-400/10 dark:text-rose-300 dark:disabled:bg-white/[0.04] dark:disabled:text-slate-600"
                          >
                            <X className="h-4 w-4" />
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
