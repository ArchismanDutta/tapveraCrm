import React, { useCallback, useEffect, useState } from "react";
import axios from "axios";
import {
  Activity,
  AlertCircle,
  Clock,
  Edit3,
  Eye,
  LoaderCircle,
  RefreshCw,
  TrendingUp,
  Users,
  X,
} from "lucide-react";

const API_BASE = import.meta.env.VITE_API_BASE || "http://localhost:5000";

const formatDate = (dateString) => {
  if (!dateString) return "Not available";

  const date = new Date(dateString);
  if (Number.isNaN(date.getTime())) return "Not available";

  const now = new Date();
  const difference = Math.max(0, now.getTime() - date.getTime());
  const minutes = Math.floor(difference / 60000);
  const hours = Math.floor(difference / 3600000);
  const days = Math.floor(difference / 86400000);

  if (minutes < 1) return "Just now";
  if (minutes < 60) return `${minutes} min ago`;
  if (hours < 24) return `${hours} hr${hours === 1 ? "" : "s"} ago`;
  if (days < 7) return `${days} day${days === 1 ? "" : "s"} ago`;

  return date.toLocaleDateString("en-IN", {
    day: "numeric",
    month: "short",
    year: date.getFullYear() === now.getFullYear() ? undefined : "numeric",
  });
};

const getUserDetail = (user) =>
  [user?.email, user?.employeeId].filter(Boolean).join(" · ");

const EmptyState = ({ tab }) => {
  const isHistory = tab === "history";
  const Icon = isHistory ? Clock : TrendingUp;

  return (
    <div className="rounded-2xl border border-dashed border-slate-300 px-6 py-14 text-center dark:border-slate-700">
      <span className="mx-auto flex h-12 w-12 items-center justify-center rounded-2xl bg-slate-100 text-slate-400 dark:bg-slate-800 dark:text-slate-500">
        <Icon className="h-6 w-6" aria-hidden="true" />
      </span>
      <h3 className="mt-4 text-sm font-semibold text-slate-800 dark:text-slate-100">
        {isHistory ? "No activity yet" : "No statistics yet"}
      </h3>
      <p className="mx-auto mt-1 max-w-sm text-sm text-slate-500 dark:text-slate-400">
        {isHistory
          ? "Access events will appear here after team members open this sheet."
          : "User statistics will appear once this sheet has been accessed."}
      </p>
    </div>
  );
};

const AccessHistoryModal = ({ sheet, onClose }) => {
  const [history, setHistory] = useState([]);
  const [stats, setStats] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [activeTab, setActiveTab] = useState("history");

  const fetchData = useCallback(async () => {
    try {
      setLoading(true);
      setError("");
      const token = localStorage.getItem("token");
      const endpoint =
        activeTab === "history"
          ? `${API_BASE}/api/sheets/${sheet._id}/access-history?limit=100`
          : `${API_BASE}/api/sheets/${sheet._id}/access-stats`;

      const response = await axios.get(endpoint, {
        headers: { Authorization: `Bearer ${token}` },
      });
      const responseData = Array.isArray(response.data)
        ? response.data
        : response.data?.data;

      if (activeTab === "history") {
        setHistory(Array.isArray(responseData) ? responseData : []);
      } else {
        setStats(Array.isArray(responseData) ? responseData : []);
      }
    } catch (requestError) {
      console.error("Error fetching access data:", requestError);
      setError(
        requestError.response?.data?.message ||
          "We couldn't load the access data. Please try again.",
      );
    } finally {
      setLoading(false);
    }
  }, [activeTab, sheet._id]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  useEffect(() => {
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";

    const handleKeyDown = (event) => {
      if (event.key === "Escape") onClose();
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => {
      document.body.style.overflow = previousOverflow;
      window.removeEventListener("keydown", handleKeyDown);
    };
  }, [onClose]);

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/70 p-3 backdrop-blur-sm sm:p-6"
      onMouseDown={(event) => {
        if (event.target === event.currentTarget) onClose();
      }}
    >
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="access-history-title"
        className="flex max-h-[92vh] w-full max-w-4xl flex-col overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-2xl dark:border-slate-700 dark:bg-slate-900"
      >
        <header className="border-b border-slate-200 px-5 pt-4 dark:border-slate-800 sm:px-6">
          <div className="flex items-start justify-between gap-4">
            <div className="flex min-w-0 items-center gap-3">
              <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-blue-50 text-blue-600 dark:bg-blue-500/10 dark:text-blue-400">
                <Activity className="h-5 w-5" aria-hidden="true" />
              </span>
              <div className="min-w-0">
                <h2
                  id="access-history-title"
                  className="text-lg font-semibold text-slate-900 dark:text-white"
                >
                  Sheet activity
                </h2>
                <p className="truncate text-sm text-slate-500 dark:text-slate-400">
                  {sheet.name}
                </p>
              </div>
            </div>
            <button
              type="button"
              onClick={onClose}
              aria-label="Close sheet activity dialog"
              className="rounded-lg p-2 text-slate-400 transition hover:bg-slate-100 hover:text-slate-700 dark:hover:bg-slate-800 dark:hover:text-slate-200"
            >
              <X className="h-5 w-5" aria-hidden="true" />
            </button>
          </div>

          <div className="mt-5 flex gap-1 overflow-x-auto" role="tablist">
            <button
              type="button"
              role="tab"
              aria-selected={activeTab === "history"}
              onClick={() => setActiveTab("history")}
              className={`inline-flex shrink-0 items-center gap-2 rounded-t-lg border-b-2 px-4 py-3 text-sm font-medium transition ${
                activeTab === "history"
                  ? "border-blue-600 bg-blue-50 text-blue-700 dark:bg-blue-950/30 dark:text-blue-300"
                  : "border-transparent text-slate-500 hover:bg-slate-50 hover:text-slate-800 dark:text-slate-400 dark:hover:bg-slate-800/60 dark:hover:text-slate-200"
              }`}
            >
              <Clock className="h-4 w-4" aria-hidden="true" />
              Recent activity
            </button>
            <button
              type="button"
              role="tab"
              aria-selected={activeTab === "stats"}
              onClick={() => setActiveTab("stats")}
              className={`inline-flex shrink-0 items-center gap-2 rounded-t-lg border-b-2 px-4 py-3 text-sm font-medium transition ${
                activeTab === "stats"
                  ? "border-blue-600 bg-blue-50 text-blue-700 dark:bg-blue-950/30 dark:text-blue-300"
                  : "border-transparent text-slate-500 hover:bg-slate-50 hover:text-slate-800 dark:text-slate-400 dark:hover:bg-slate-800/60 dark:hover:text-slate-200"
              }`}
            >
              <TrendingUp className="h-4 w-4" aria-hidden="true" />
              User statistics
            </button>
          </div>
        </header>

        <div className="flex-1 overflow-y-auto px-5 py-5 sm:px-6">
          {loading ? (
            <div className="flex min-h-72 items-center justify-center">
              <div className="text-center">
                <LoaderCircle className="mx-auto h-8 w-8 animate-spin text-blue-600" />
                <p className="mt-3 text-sm text-slate-500 dark:text-slate-400">
                  Loading sheet activity...
                </p>
              </div>
            </div>
          ) : error ? (
            <div className="rounded-2xl border border-red-200 bg-red-50 px-6 py-10 text-center dark:border-red-900/60 dark:bg-red-950/30">
              <AlertCircle className="mx-auto h-8 w-8 text-red-500" />
              <p className="mt-3 text-sm font-medium text-red-800 dark:text-red-200">
                {error}
              </p>
              <button
                type="button"
                onClick={fetchData}
                className="mt-4 inline-flex items-center gap-2 rounded-lg border border-red-300 bg-white px-3 py-2 text-sm font-medium text-red-700 transition hover:bg-red-100 dark:border-red-800 dark:bg-red-950/50 dark:text-red-300 dark:hover:bg-red-950"
              >
                <RefreshCw className="h-4 w-4" />
                Try again
              </button>
            </div>
          ) : activeTab === "history" ? (
            history.length === 0 ? (
              <EmptyState tab="history" />
            ) : (
              <div className="space-y-3">
                {history.map((entry, index) => {
                  const isEdit = entry.permissionLevel === "edit";
                  const detail = getUserDetail(entry.user);

                  return (
                    <article
                      key={entry._id || `${entry.user?._id}-${entry.accessedAt}-${index}`}
                      className="rounded-xl border border-slate-200 bg-white p-4 transition hover:border-blue-200 hover:shadow-sm dark:border-slate-800 dark:bg-slate-950/40 dark:hover:border-blue-900"
                    >
                      <div className="flex items-start gap-3 sm:items-center">
                        <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-gradient-to-br from-blue-500 to-indigo-600 text-sm font-semibold text-white">
                          {entry.user?.name?.trim()?.charAt(0)?.toUpperCase() || "?"}
                        </span>
                        <div className="min-w-0 flex-1">
                          <div className="flex flex-wrap items-center gap-2">
                            <h3 className="truncate text-sm font-semibold text-slate-900 dark:text-white">
                              {entry.user?.name || "Unknown user"}
                            </h3>
                            <span
                              className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-xs font-medium ${
                                isEdit
                                  ? "bg-emerald-50 text-emerald-700 dark:bg-emerald-950/50 dark:text-emerald-300"
                                  : "bg-amber-50 text-amber-700 dark:bg-amber-950/50 dark:text-amber-300"
                              }`}
                            >
                              {isEdit ? (
                                <Edit3 className="h-3 w-3" />
                              ) : (
                                <Eye className="h-3 w-3" />
                              )}
                              {isEdit ? "Edit access" : "View access"}
                            </span>
                          </div>
                          {detail && (
                            <p className="mt-0.5 truncate text-xs text-slate-500 dark:text-slate-400">
                              {detail}
                            </p>
                          )}
                        </div>
                        <div className="shrink-0 text-right">
                          <p className="text-sm font-medium text-slate-700 dark:text-slate-200">
                            {formatDate(entry.accessedAt)}
                          </p>
                          <p className="mt-0.5 text-xs text-slate-400 dark:text-slate-500">
                            {entry.accessedAt &&
                            !Number.isNaN(new Date(entry.accessedAt).getTime())
                              ? new Date(entry.accessedAt).toLocaleTimeString("en-IN", {
                                  hour: "2-digit",
                                  minute: "2-digit",
                                })
                              : ""}
                          </p>
                        </div>
                      </div>
                    </article>
                  );
                })}
              </div>
            )
          ) : stats.length === 0 ? (
            <EmptyState tab="stats" />
          ) : (
            <div className="grid gap-3 md:grid-cols-2">
              {stats.map((stat, index) => {
                const detail = getUserDetail(stat.user);
                const accessCount = Number(stat.accessCount) || 0;

                return (
                  <article
                    key={stat._id || stat.user?._id || index}
                    className="rounded-xl border border-slate-200 bg-white p-4 dark:border-slate-800 dark:bg-slate-950/40"
                  >
                    <div className="flex items-center gap-3">
                      <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-gradient-to-br from-blue-500 to-indigo-600 font-semibold text-white">
                        {stat.user?.name?.trim()?.charAt(0)?.toUpperCase() || "?"}
                      </span>
                      <div className="min-w-0 flex-1">
                        <h3 className="truncate text-sm font-semibold text-slate-900 dark:text-white">
                          {stat.user?.name || "Unknown user"}
                        </h3>
                        {detail && (
                          <p className="mt-0.5 truncate text-xs text-slate-500 dark:text-slate-400">
                            {detail}
                          </p>
                        )}
                      </div>
                      <div className="text-right">
                        <p className="text-2xl font-bold text-blue-600 dark:text-blue-400">
                          {accessCount.toLocaleString("en-IN")}
                        </p>
                        <p className="text-xs text-slate-500 dark:text-slate-400">
                          {accessCount === 1 ? "access" : "accesses"}
                        </p>
                      </div>
                    </div>
                    <div className="mt-4 grid grid-cols-2 gap-3 border-t border-slate-200 pt-3 text-xs dark:border-slate-800">
                      <div>
                        <p className="text-slate-400 dark:text-slate-500">First access</p>
                        <p className="mt-1 font-medium text-slate-700 dark:text-slate-200">
                          {formatDate(stat.firstAccess)}
                        </p>
                      </div>
                      <div className="text-right">
                        <p className="text-slate-400 dark:text-slate-500">Latest access</p>
                        <p className="mt-1 font-medium text-slate-700 dark:text-slate-200">
                          {formatDate(stat.lastAccess)}
                        </p>
                      </div>
                    </div>
                  </article>
                );
              })}
            </div>
          )}
        </div>

        <footer className="flex items-center justify-between gap-4 border-t border-slate-200 bg-slate-50 px-5 py-4 dark:border-slate-800 dark:bg-slate-950/50 sm:px-6">
          <p className="hidden items-center gap-1.5 text-xs text-slate-500 dark:text-slate-400 sm:flex">
            <Users className="h-3.5 w-3.5" aria-hidden="true" />
            Activity is limited to the 100 most recent events.
          </p>
          <button
            type="button"
            onClick={onClose}
            className="ml-auto rounded-lg bg-slate-900 px-4 py-2.5 text-sm font-semibold text-white transition hover:bg-slate-800 dark:bg-blue-600 dark:hover:bg-blue-700"
          >
            Done
          </button>
        </footer>
      </div>
    </div>
  );
};

export default AccessHistoryModal;
