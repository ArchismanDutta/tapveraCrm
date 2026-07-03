import React from "react";
import { Check, Download, FileText, Save, UserRound, X } from "lucide-react";

const leaveTypeLabels = {
  annual: "Annual leave",
  paid: "Paid leave",
  unpaid: "Unpaid leave",
  sick: "Sick leave",
  workFromHome: "Work from home",
  maternity: "Maternity leave",
  halfDay: "Half day",
};

const statusStyles = {
  Pending:
    "border-amber-200 bg-amber-50 text-amber-700 dark:border-amber-400/20 dark:bg-amber-400/10 dark:text-amber-200",
  Approved:
    "border-emerald-200 bg-emerald-50 text-emerald-700 dark:border-emerald-400/20 dark:bg-emerald-400/10 dark:text-emerald-200",
  Rejected:
    "border-rose-200 bg-rose-50 text-rose-700 dark:border-rose-400/20 dark:bg-rose-400/10 dark:text-rose-200",
};

const formatPeriod = (period) => {
  if (!period.start || !period.end) return "N/A";
  const start = new Date(period.start);
  const end = new Date(period.end);
  if (Number.isNaN(start.getTime()) || Number.isNaN(end.getTime())) return "N/A";
  const options = { day: "numeric", month: "short", year: "numeric" };
  return `${start.toLocaleDateString("en-IN", options)} – ${end.toLocaleDateString("en-IN", options)}`;
};

const formatFileSize = (size) => {
  if (!size) return "";
  const kilobytes = Number.parseInt(size, 10) / 1024;
  return kilobytes < 1024
    ? `${kilobytes.toFixed(2)} KB`
    : `${(kilobytes / 1024).toFixed(2)} MB`;
};

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
      <div className="flex min-h-[390px] flex-col items-center justify-center px-6 text-center">
        <span className="flex h-12 w-12 items-center justify-center rounded-xl bg-slate-100 text-slate-400 dark:bg-white/[0.05]">
          <FileText className="h-5 w-5" />
        </span>
        <h3 className="mt-4 text-sm font-semibold text-slate-900 dark:text-white">
          No request selected
        </h3>
        <p className="mt-1 max-w-xs text-sm text-slate-500 dark:text-slate-400">
          Select a leave request from the queue to review its details.
        </p>
      </div>
    );
  }

  const {
    employee = {},
    period = {},
    type,
    reason,
    document,
    status,
    approvedBy,
  } = request;

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-3 rounded-xl border border-slate-200 p-4 dark:border-white/10">
        <img
          src={
            employee.avatar ||
            `https://ui-avatars.com/api/?name=${encodeURIComponent(
              employee.name || "Unknown",
            )}&background=6366f1&color=ffffff`
          }
          alt={employee.name || "Employee"}
          className="h-11 w-11 rounded-full object-cover"
        />
        <div className="min-w-0 flex-1">
          <h3 className="truncate text-sm font-semibold text-slate-900 dark:text-white">
            {employee.name || "Unknown employee"}
          </h3>
          <p className="truncate text-xs text-slate-500 dark:text-slate-400">
            {employee.email || "—"}
          </p>
          <p className="mt-1 truncate text-[11px] text-slate-500 dark:text-slate-400">
            {employee.department || "No department"} · {employee.designation || "No designation"}
          </p>
        </div>
      </div>

      <div className="space-y-3 rounded-xl border border-slate-200 p-4 dark:border-white/10">
        <div className="flex items-center justify-between gap-3">
          <span className="text-xs text-slate-500 dark:text-slate-400">Status</span>
          <span
            className={`rounded-full border px-2.5 py-1 text-xs font-semibold ${
              statusStyles[status] ||
              "border-slate-200 bg-slate-100 text-slate-600 dark:border-white/10 dark:bg-white/[0.05] dark:text-slate-300"
            }`}
          >
            {status}
          </span>
        </div>
        <div className="flex items-center justify-between gap-3">
          <span className="text-xs text-slate-500 dark:text-slate-400">Leave type</span>
          <span className="rounded-full border border-blue-200 bg-blue-50 px-2.5 py-1 text-xs font-medium text-blue-700 dark:border-blue-400/20 dark:bg-blue-400/10 dark:text-blue-200">
            {leaveTypeLabels[type] || type || "—"}
          </span>
        </div>
        <div className="flex items-center justify-between gap-3">
          <span className="text-xs text-slate-500 dark:text-slate-400">Duration</span>
          <span className="text-right text-xs font-medium text-slate-700 dark:text-slate-200">
            {formatPeriod(period)}
          </span>
        </div>
        <div className="border-t border-slate-200 pt-3 dark:border-white/10">
          <p className="text-xs text-slate-500 dark:text-slate-400">Reason</p>
          <p className="mt-1.5 rounded-lg bg-slate-50 p-3 text-xs leading-5 text-slate-700 dark:bg-white/[0.035] dark:text-slate-200">
            {reason || "No reason provided"}
          </p>
        </div>
      </div>

      {document?.url && (
        <div className="rounded-xl border border-slate-200 p-4 dark:border-white/10">
          <p className="text-xs font-semibold text-slate-700 dark:text-slate-200">
            Supporting document
          </p>
          <div className="mt-3 flex items-center gap-3 rounded-lg bg-slate-50 p-3 dark:bg-white/[0.035]">
            <FileText className="h-4 w-4 shrink-0 text-blue-600 dark:text-blue-300" />
            <div className="min-w-0 flex-1">
              <p className="truncate text-xs font-medium text-slate-700 dark:text-slate-200">
                {document.name || "Document"}
              </p>
              <p className="text-[11px] text-slate-500 dark:text-slate-400">
                {formatFileSize(document.size)}
              </p>
            </div>
            <a
              href={document.url}
              target="_blank"
              rel="noopener noreferrer"
              download={document.name}
              className="rounded-lg border border-slate-200 bg-white p-2 text-slate-600 transition hover:bg-slate-50 dark:border-white/10 dark:bg-white/[0.04] dark:text-slate-300"
              aria-label="Download supporting document"
            >
              <Download className="h-4 w-4" />
            </a>
          </div>
        </div>
      )}

      {status === "Approved" && approvedBy && (
        <div className="rounded-xl border border-emerald-200 bg-emerald-50 p-4 dark:border-emerald-400/20 dark:bg-emerald-400/10">
          <div className="flex items-center gap-3">
            <UserRound className="h-4 w-4 text-emerald-600 dark:text-emerald-300" />
            <div className="min-w-0">
              <p className="text-xs font-semibold text-emerald-800 dark:text-emerald-200">
                Approved by {approvedBy.name || "Unknown"}
              </p>
              <p className="truncate text-[11px] text-emerald-700 dark:text-emerald-300">
                {approvedBy.email || "—"}
              </p>
            </div>
          </div>
        </div>
      )}

      <div className="rounded-xl border border-slate-200 p-4 dark:border-white/10">
        <div className="mb-2 flex items-center justify-between gap-3">
          <label htmlFor="admin-remarks" className="text-xs font-semibold text-slate-700 dark:text-slate-200">
            Admin remarks
          </label>
          {onSaveRemarks && (
            <button
              type="button"
              onClick={() => onSaveRemarks(request._id)}
              className="inline-flex items-center gap-1.5 text-xs font-semibold text-blue-600 hover:text-blue-700 dark:text-blue-300"
            >
              <Save className="h-3.5 w-3.5" /> Save
            </button>
          )}
        </div>
        <textarea
          id="admin-remarks"
          value={adminRemarks}
          onChange={(event) => onChangeRemarks(event.target.value)}
          className="w-full resize-none rounded-xl border border-slate-200 bg-slate-50 p-3 text-sm text-slate-900 outline-none transition placeholder:text-slate-400 focus:border-blue-500 focus:ring-2 focus:ring-blue-500/15 dark:border-white/10 dark:bg-white/[0.035] dark:text-white"
          placeholder="Add remarks for this request"
          rows={3}
        />
      </div>

      {status !== "Approved" && status !== "Rejected" && (
        <div className="grid grid-cols-2 gap-3">
          <button
            type="button"
            onClick={() => onApprove(request._id)}
            className="inline-flex h-10 items-center justify-center gap-2 rounded-lg bg-emerald-600 px-4 text-sm font-semibold text-white transition hover:bg-emerald-700"
          >
            <Check className="h-4 w-4" /> Approve
          </button>
          <button
            type="button"
            onClick={() => onReject(request._id)}
            className="inline-flex h-10 items-center justify-center gap-2 rounded-lg bg-rose-600 px-4 text-sm font-semibold text-white transition hover:bg-rose-700"
          >
            <X className="h-4 w-4" /> Reject
          </button>
        </div>
      )}
    </div>
  );
};

export default LeaveRequestDetails;
