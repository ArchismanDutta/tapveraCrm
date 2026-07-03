import React, { useEffect, useMemo, useState } from "react";
import axios from "axios";
import {
  CalendarDays,
  Check,
  Clock,
  LoaderCircle,
  UserRoundCog,
  X,
  XCircle,
} from "lucide-react";
import { toast } from "react-toastify";

const API_BASE = import.meta.env.VITE_API_BASE || "http://localhost:5000";

const STATUS_STYLES = {
  approved:
    "border-emerald-200 bg-emerald-50 text-emerald-700 dark:border-emerald-400/20 dark:bg-emerald-400/10 dark:text-emerald-200",
  rejected:
    "border-rose-200 bg-rose-50 text-rose-700 dark:border-rose-400/20 dark:bg-rose-400/10 dark:text-rose-200",
  pending:
    "border-amber-200 bg-amber-50 text-amber-700 dark:border-amber-400/20 dark:bg-amber-400/10 dark:text-amber-200",
};

const formatDate = (value) => {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "Date unavailable";
  return date.toLocaleDateString("en-IN", {
    day: "numeric",
    month: "short",
    year: "numeric",
  });
};

const RequestCard = ({ request, updating, onUpdate, showActions }) => {
  const status = String(request.status || "pending").toLowerCase();
  const employeeName =
    request.employee?.name || request.employee?.email || "Unknown employee";

  return (
    <article className="rounded-xl border border-slate-200 p-4 dark:border-slate-800">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="flex min-w-0 items-center gap-3">
          <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-gradient-to-br from-blue-500 to-indigo-600 text-sm font-semibold text-white">
            {employeeName.charAt(0).toUpperCase()}
          </span>
          <div className="min-w-0">
            <h3 className="truncate text-sm font-semibold text-slate-900 dark:text-white">
              {employeeName}
            </h3>
            <p className="mt-0.5 text-xs text-slate-500 dark:text-slate-400">
              Requested {formatDate(request.createdAt || request.requestedDate)}
            </p>
          </div>
        </div>
        <span
          className={`rounded-full border px-2.5 py-1 text-[11px] font-semibold capitalize ${
            STATUS_STYLES[status] || STATUS_STYLES.pending
          }`}
        >
          {status}
        </span>
      </div>

      <dl className="mt-4 grid grid-cols-2 gap-3 rounded-xl bg-slate-50 p-3 text-xs dark:bg-slate-950/50 sm:grid-cols-3">
        <div>
          <dt className="flex items-center gap-1.5 text-slate-400">
            <CalendarDays className="h-3.5 w-3.5" /> Date
          </dt>
          <dd className="mt-1 font-semibold text-slate-700 dark:text-slate-200">
            {formatDate(request.requestedDate)}
          </dd>
        </div>
        <div>
          <dt className="flex items-center gap-1.5 text-slate-400">
            <Clock className="h-3.5 w-3.5" /> Start
          </dt>
          <dd className="mt-1 font-semibold text-slate-700 dark:text-slate-200">
            {request.requestedStartTime || "Not specified"}
          </dd>
        </div>
        <div>
          <dt className="text-slate-400">Duration</dt>
          <dd className="mt-1 font-semibold text-slate-700 dark:text-slate-200">
            {request.durationHours ? `${request.durationHours}h` : "Not specified"}
          </dd>
        </div>
      </dl>

      {request.reason && (
        <div className="mt-3">
          <p className="text-xs font-medium text-slate-500 dark:text-slate-400">
            Reason
          </p>
          <p className="mt-1 text-sm leading-5 text-slate-700 dark:text-slate-200">
            {request.reason}
          </p>
        </div>
      )}

      {showActions && (
        <div className="mt-4 flex gap-2 border-t border-slate-200 pt-3 dark:border-slate-800">
          <button
            type="button"
            onClick={() => onUpdate(request, "approved")}
            disabled={updating}
            className="inline-flex flex-1 items-center justify-center gap-2 rounded-lg bg-emerald-600 px-3 py-2.5 text-sm font-semibold text-white transition hover:bg-emerald-700 disabled:cursor-not-allowed disabled:opacity-60"
          >
            {updating ? (
              <LoaderCircle className="h-4 w-4 animate-spin" />
            ) : (
              <Check className="h-4 w-4" />
            )}
            Approve
          </button>
          <button
            type="button"
            onClick={() => onUpdate(request, "rejected")}
            disabled={updating}
            className="inline-flex flex-1 items-center justify-center gap-2 rounded-lg border border-rose-200 bg-white px-3 py-2.5 text-sm font-semibold text-rose-700 transition hover:bg-rose-50 disabled:cursor-not-allowed disabled:opacity-60 dark:border-rose-400/20 dark:bg-transparent dark:text-rose-200 dark:hover:bg-rose-400/10"
          >
            <XCircle className="h-4 w-4" />
            Reject
          </button>
        </div>
      )}
    </article>
  );
};

const FlexibleRequestsModal = ({ isOpen, onClose, requests = [], refresh }) => {
  const [updatingIds, setUpdatingIds] = useState([]);
  const [activeTab, setActiveTab] = useState("pending");

  useEffect(() => {
    if (isOpen) setActiveTab("pending");
  }, [isOpen]);

  useEffect(() => {
    if (!isOpen) return undefined;
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    const handleKeyDown = (event) => {
      if (event.key === "Escape" && updatingIds.length === 0) onClose();
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => {
      document.body.style.overflow = previousOverflow;
      window.removeEventListener("keydown", handleKeyDown);
    };
  }, [isOpen, onClose, updatingIds.length]);

  const sortedRequests = useMemo(
    () =>
      [...requests].sort(
        (left, right) =>
          new Date(right.requestedDate || right.createdAt) -
          new Date(left.requestedDate || left.createdAt),
      ),
    [requests],
  );
  const pendingRequests = sortedRequests.filter(
    (request) => String(request.status || "").toLowerCase() === "pending",
  );
  const previousRequests = sortedRequests.filter(
    (request) => String(request.status || "").toLowerCase() !== "pending",
  );

  if (!isOpen) return null;

  const updateStatus = async (request, newStatus) => {
    if (updatingIds.includes(request._id)) return;
    const employeeName =
      request.employee?.name || request.employee?.email || "this employee";
    if (
      !window.confirm(
        `${newStatus === "approved" ? "Approve" : "Reject"} the flexible-shift request for ${employeeName}?`,
      )
    ) {
      return;
    }

    try {
      setUpdatingIds((current) => [...current, request._id]);
      const token = localStorage.getItem("token");
      await axios.put(
        `${API_BASE}/api/flexible-shifts/${request._id}/status`,
        { status: newStatus },
        { headers: { Authorization: `Bearer ${token}` } },
      );
      toast.success(`Request ${newStatus}`);
      await refresh?.();
    } catch (requestError) {
      console.error("Failed to update flexible shift status:", requestError);
      toast.error(
        requestError.response?.data?.message || "Failed to update request",
      );
    } finally {
      setUpdatingIds((current) =>
        current.filter((requestId) => requestId !== request._id),
      );
    }
  };

  const visibleRequests =
    activeTab === "pending" ? pendingRequests : previousRequests;

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/70 p-3 backdrop-blur-sm sm:p-6"
      onMouseDown={(event) => {
        if (event.target === event.currentTarget && updatingIds.length === 0)
          onClose();
      }}
    >
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="flexible-requests-title"
        className="flex max-h-[92vh] w-full max-w-4xl flex-col overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-2xl dark:border-slate-700 dark:bg-slate-900"
      >
        <header className="border-b border-slate-200 px-5 pt-4 dark:border-slate-800 sm:px-6">
          <div className="flex items-start justify-between gap-4">
            <div className="flex min-w-0 items-center gap-3">
              <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-violet-50 text-violet-700 dark:bg-violet-400/10 dark:text-violet-200">
                <UserRoundCog className="h-5 w-5" />
              </span>
              <div>
                <h2
                  id="flexible-requests-title"
                  className="text-lg font-semibold text-slate-900 dark:text-white"
                >
                  Flexible-shift requests
                </h2>
                <p className="mt-0.5 text-sm text-slate-500 dark:text-slate-400">
                  Review schedule changes and previous decisions.
                </p>
              </div>
            </div>
            <button
              type="button"
              onClick={onClose}
              disabled={updatingIds.length > 0}
              aria-label="Close flexible shift requests"
              className="rounded-lg p-2 text-slate-400 transition hover:bg-slate-100 hover:text-slate-700 disabled:opacity-50 dark:hover:bg-slate-800 dark:hover:text-slate-200"
            >
              <X className="h-5 w-5" />
            </button>
          </div>

          <div className="mt-5 flex gap-1" role="tablist">
            <button
              type="button"
              role="tab"
              aria-selected={activeTab === "pending"}
              onClick={() => setActiveTab("pending")}
              className={`rounded-t-lg border-b-2 px-4 py-3 text-sm font-semibold transition ${
                activeTab === "pending"
                  ? "border-blue-600 bg-blue-50 text-blue-700 dark:bg-blue-950/30 dark:text-blue-200"
                  : "border-transparent text-slate-500 hover:bg-slate-50 dark:text-slate-400 dark:hover:bg-slate-800"
              }`}
            >
              Pending ({pendingRequests.length})
            </button>
            <button
              type="button"
              role="tab"
              aria-selected={activeTab === "history"}
              onClick={() => setActiveTab("history")}
              className={`rounded-t-lg border-b-2 px-4 py-3 text-sm font-semibold transition ${
                activeTab === "history"
                  ? "border-blue-600 bg-blue-50 text-blue-700 dark:bg-blue-950/30 dark:text-blue-200"
                  : "border-transparent text-slate-500 hover:bg-slate-50 dark:text-slate-400 dark:hover:bg-slate-800"
              }`}
            >
              History ({previousRequests.length})
            </button>
          </div>
        </header>

        <div className="flex-1 overflow-y-auto p-5 sm:p-6">
          {visibleRequests.length === 0 ? (
            <div className="rounded-xl border border-dashed border-slate-300 px-6 py-14 text-center dark:border-slate-700">
              <Clock className="mx-auto h-7 w-7 text-slate-400" />
              <h3 className="mt-3 text-sm font-semibold text-slate-800 dark:text-slate-100">
                {activeTab === "pending"
                  ? "No pending requests"
                  : "No request history"}
              </h3>
              <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">
                {activeTab === "pending"
                  ? "New flexible-shift requests will appear here."
                  : "Approved and rejected requests will appear here."}
              </p>
            </div>
          ) : (
            <div className="grid gap-3 lg:grid-cols-2">
              {visibleRequests.map((request) => (
                <RequestCard
                  key={request._id}
                  request={request}
                  updating={updatingIds.includes(request._id)}
                  onUpdate={updateStatus}
                  showActions={activeTab === "pending"}
                />
              ))}
            </div>
          )}
        </div>

        <footer className="border-t border-slate-200 bg-slate-50 px-5 py-4 text-right dark:border-slate-800 dark:bg-slate-950/50 sm:px-6">
          <button
            type="button"
            onClick={onClose}
            disabled={updatingIds.length > 0}
            className="rounded-lg bg-slate-900 px-4 py-2.5 text-sm font-semibold text-white transition hover:bg-slate-800 disabled:opacity-50 dark:bg-blue-600 dark:hover:bg-blue-700"
          >
            Done
          </button>
        </footer>
      </div>
    </div>
  );
};

export default FlexibleRequestsModal;
