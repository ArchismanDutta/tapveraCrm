import React from "react";
import { AlertCircle, CheckCircle, Edit3, FileText, XCircle } from "lucide-react";

const statusStyles = {
  Approved: "border-emerald-200 bg-emerald-50 text-emerald-700 dark:border-emerald-400/20 dark:bg-emerald-400/10 dark:text-emerald-200",
  Rejected: "border-rose-200 bg-rose-50 text-rose-700 dark:border-rose-400/20 dark:bg-rose-400/10 dark:text-rose-200",
  Pending: "border-amber-200 bg-amber-50 text-amber-700 dark:border-amber-400/20 dark:bg-amber-400/10 dark:text-amber-200",
};

const statusIcons = { Approved: CheckCircle, Rejected: XCircle, Pending: AlertCircle };
const leaveTypeLabels = { maternity: "Maternity leave", paid: "Paid leave", unpaid: "Unpaid leave", sick: "Sick leave", workFromHome: "Work from home", halfDay: "Half day" };

const formatFileSize = (size) => {
  if (!size) return "";
  const kb = Number(size) / 1024;
  return kb < 1024 ? `${kb.toFixed(1)} KB` : `${(kb / 1024).toFixed(1)} MB`;
};

const formatRequest = (request) => ({
  start: request?.period?.start ? new Date(request.period.start).toLocaleDateString() : "N/A",
  end: request?.period?.end ? new Date(request.period.end).toLocaleDateString() : "N/A",
  type: leaveTypeLabels[request?.type] || request?.type || "Unknown leave",
});

const StatusBadge = ({ status }) => {
  const Icon = statusIcons[status] || AlertCircle;
  return <span className={`inline-flex items-center gap-1.5 rounded-lg border px-2 py-1 text-[11px] font-semibold ${statusStyles[status] || "border-slate-200 bg-slate-50 text-slate-600 dark:border-white/10 dark:bg-white/[0.04] dark:text-slate-300"}`}><Icon className="h-3.5 w-3.5" />{status || "Unknown"}</span>;
};

const RecentLeaveRequests = ({ requests, onEditRequest }) => {
  const safeRequests = Array.isArray(requests) ? requests : [];

  return (
    <section className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm dark:border-white/10 dark:bg-[#10131c]">
      <div className="border-b border-slate-200 px-4 py-4 dark:border-white/10 sm:px-5">
        <h3 className="text-base font-semibold text-slate-950 dark:text-white">Recent requests</h3>
        <p className="mt-0.5 text-xs text-slate-500 dark:text-slate-400">Your latest leave submissions and approval status</p>
      </div>

      {safeRequests.length === 0 ? (
        <div className="flex flex-col items-center px-5 py-12 text-center">
          <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-slate-100 text-slate-400 dark:bg-white/[0.06]"><FileText className="h-5 w-5" /></div>
          <p className="mt-3 text-sm font-medium text-slate-700 dark:text-slate-200">No leave requests yet</p>
          <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">New requests will appear here after submission.</p>
        </div>
      ) : (
        <>
          <div className="divide-y divide-slate-100 dark:divide-white/[0.07] md:hidden">
            {safeRequests.map((request) => {
              const formatted = formatRequest(request);
              return (
                <article key={request._id || request.id} className="p-4">
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0">
                      <p className="text-sm font-semibold text-slate-950 dark:text-white">{formatted.type}</p>
                      <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">{formatted.start} – {formatted.end}</p>
                    </div>
                    <StatusBadge status={request.status} />
                  </div>
                  {request.adminRemarks?.trim() && <p className="mt-3 rounded-lg bg-slate-50 p-2.5 text-xs text-slate-600 dark:bg-white/[0.04] dark:text-slate-300">{request.adminRemarks}</p>}
                  <div className="mt-3 flex items-center justify-between gap-3">
                    {request.document?.url ? <a href={request.document.url} target="_blank" rel="noopener noreferrer" className="truncate text-xs font-medium text-blue-600 hover:underline dark:text-blue-300">{request.document.name || "Supporting document"}</a> : <span className="text-xs text-slate-400">No document</span>}
                    {request.status === "Pending" && onEditRequest && <button type="button" onClick={() => onEditRequest(request)} className="inline-flex h-8 items-center gap-1.5 rounded-lg border border-slate-200 px-3 text-xs font-semibold text-slate-600 transition hover:bg-slate-50 dark:border-white/10 dark:text-slate-300 dark:hover:bg-white/[0.06]"><Edit3 className="h-3.5 w-3.5" /> Edit</button>}
                  </div>
                </article>
              );
            })}
          </div>

          <div className="hidden overflow-x-auto md:block">
            <table className="w-full text-sm">
              <thead><tr className="border-b border-slate-200 dark:border-white/10">{["Requested", "Leave type", "Duration", "Status", "Remarks", "Document", "Action"].map((heading) => <th key={heading} className="whitespace-nowrap px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide text-slate-500 dark:text-slate-400">{heading}</th>)}</tr></thead>
              <tbody className="divide-y divide-slate-100 dark:divide-white/[0.07]">
                {safeRequests.map((request) => {
                  const formatted = formatRequest(request);
                  return (
                    <tr key={request._id || request.id} className="transition hover:bg-slate-50 dark:hover:bg-white/[0.025]">
                      <td className="whitespace-nowrap px-4 py-3 text-slate-600 dark:text-slate-300">{request.createdAt ? new Date(request.createdAt).toLocaleDateString() : "–"}</td>
                      <td className="whitespace-nowrap px-4 py-3 font-medium text-slate-950 dark:text-white">{formatted.type}</td>
                      <td className="whitespace-nowrap px-4 py-3 text-slate-600 dark:text-slate-300">{formatted.start} – {formatted.end}</td>
                      <td className="px-4 py-3"><StatusBadge status={request.status} /></td>
                      <td className="max-w-40 truncate px-4 py-3 text-slate-500 dark:text-slate-400">{request.adminRemarks?.trim() || "–"}</td>
                      <td className="max-w-44 px-4 py-3">{request.document?.url ? <a href={request.document.url} target="_blank" rel="noopener noreferrer" className="block truncate text-xs font-medium text-blue-600 hover:underline dark:text-blue-300">{request.document.name || "Document"} {request.document.size ? `(${formatFileSize(request.document.size)})` : ""}</a> : <span className="text-slate-400">–</span>}</td>
                      <td className="px-4 py-3">{request.status === "Pending" && onEditRequest ? <button type="button" onClick={() => onEditRequest(request)} className="inline-flex h-8 items-center gap-1.5 rounded-lg border border-slate-200 px-3 text-xs font-semibold text-slate-600 transition hover:bg-slate-50 dark:border-white/10 dark:text-slate-300 dark:hover:bg-white/[0.06]"><Edit3 className="h-3.5 w-3.5" /> Edit</button> : <span className="text-xs text-slate-400">No action</span>}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </>
      )}
    </section>
  );
};

export default RecentLeaveRequests;
