import React, { useEffect, useMemo, useState } from "react";
import { BellRing, CheckCircle2, FileText, Radio } from "lucide-react";
import API from "../api";
import Sidebar from "../components/dashboard/Sidebar";
import NoticeForm from "../components/admintask/NoticeForm";
import NoticeList from "../components/admintask/NoticeList";

const NoticeBoard = ({ onLogout }) => {
  const [notices, setNotices] = useState([]);
  const [collapsed, setCollapsed] = useState(false);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  const fetchNotices = async ({ background = false } = {}) => {
    try {
      if (!background) setLoading(true);
      setError("");
      const response = await API.get("/api/notices");
      setNotices(Array.isArray(response.data) ? response.data : []);
    } catch (fetchError) {
      console.error("Error fetching notices:", fetchError.message);
      setError("Notices could not be loaded. Please try again.");
    } finally {
      if (!background) setLoading(false);
    }
  };

  useEffect(() => {
    fetchNotices();
  }, []);

  const handlePublish = async () => {
    await fetchNotices({ background: true });
  };

  const handleDeactivate = async (id) => {
    try {
      await API.patch(`/api/notices/${id}/deactivate`, { isActive: false });
      setNotices((current) =>
        current.map((notice) =>
          notice._id === id ? { ...notice, isActive: false } : notice,
        ),
      );
    } catch (deactivateError) {
      console.error("Error deactivating notice:", deactivateError.message);
      setError("The notice could not be deactivated. Please try again.");
    }
  };

  const summary = useMemo(() => {
    const active = notices.filter((notice) => notice.isActive).length;
    return {
      total: notices.length,
      active,
      inactive: notices.length - active,
    };
  }, [notices]);

  const metrics = [
    ["All notices", summary.total, FileText, "text-blue-600 dark:text-blue-300"],
    ["Active", summary.active, Radio, "text-emerald-600 dark:text-emerald-300"],
    ["Inactive", summary.inactive, CheckCircle2, "text-slate-500 dark:text-slate-300"],
  ];

  return (
    <div className="relative flex h-[100dvh] overflow-hidden bg-slate-50 text-slate-900 dark:bg-[#0b0d12] dark:text-slate-100">
      <Sidebar
        collapsed={collapsed}
        setCollapsed={setCollapsed}
        onLogout={onLogout}
        userRole="admin"
      />

      <main
        className={`h-[100dvh] min-w-0 flex-1 overflow-y-auto overflow-x-hidden px-3 py-4 transition-all duration-300 sm:px-5 lg:px-6 ${
          collapsed ? "app-offset app-offset-collapsed" : "app-offset"
        }`}
      >
        <div className="mx-auto max-w-[1500px] space-y-4 pb-8 sm:space-y-5">
          <header className="rounded-2xl border border-slate-200 bg-white px-5 py-5 shadow-sm dark:border-white/10 dark:bg-[#10131c] sm:px-6">
            <div className="inline-flex items-center gap-2 rounded-lg border border-blue-200 bg-blue-50 px-3 py-1.5 text-xs font-semibold text-blue-700 dark:border-blue-400/20 dark:bg-blue-400/10 dark:text-blue-200">
              <BellRing className="h-3.5 w-3.5" />
              Team communication
            </div>
            <h1 className="mt-3 text-2xl font-semibold tracking-tight text-slate-950 dark:text-white">
              Notice board
            </h1>
            <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">
              Publish company-wide updates and manage previous announcements.
            </p>
          </header>

          <section className="grid grid-cols-3 gap-3" aria-label="Notice summary">
            {metrics.map(([label, value, Icon, tone]) => (
              <article
                key={label}
                className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm dark:border-white/10 dark:bg-[#10131c]"
              >
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <p className="text-xs font-medium text-slate-500 dark:text-slate-400">
                      {label}
                    </p>
                    <p className="mt-1 text-2xl font-semibold text-slate-950 dark:text-white">
                      {loading ? "—" : value}
                    </p>
                  </div>
                  <span className="hidden h-9 w-9 items-center justify-center rounded-xl bg-slate-100 dark:bg-white/[0.05] sm:flex">
                    {React.createElement(Icon, {
                      className: `h-4 w-4 ${tone}`,
                    })}
                  </span>
                </div>
              </article>
            ))}
          </section>

          <NoticeForm onPublish={handlePublish} />

          {error && (
            <div className="flex flex-col gap-3 rounded-xl border border-rose-200 bg-rose-50 p-4 text-sm text-rose-700 dark:border-rose-400/20 dark:bg-rose-400/10 dark:text-rose-200 sm:flex-row sm:items-center sm:justify-between">
              <span>{error}</span>
              <button
                type="button"
                onClick={() => fetchNotices()}
                className="rounded-lg border border-rose-200 bg-white px-3 py-2 text-xs font-semibold dark:border-rose-400/20 dark:bg-transparent"
              >
                Try again
              </button>
            </div>
          )}

          <section className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm dark:border-white/10 dark:bg-[#10131c]">
            <div className="border-b border-slate-200 px-4 py-4 dark:border-white/10 sm:px-5">
              <h2 className="text-base font-semibold text-slate-950 dark:text-white">
                Published notices
              </h2>
              <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">
                Active notices are visible to employees.
              </p>
            </div>
            <div className="p-4 sm:p-5">
              {loading ? (
                <div className="space-y-3">
                  {[0, 1, 2, 3].map((item) => (
                    <div
                      key={item}
                      className="h-20 animate-pulse rounded-xl bg-slate-100 dark:bg-white/[0.04]"
                    />
                  ))}
                </div>
              ) : (
                <NoticeList
                  notices={notices}
                  onDeactivate={handleDeactivate}
                />
              )}
            </div>
          </section>
        </div>
      </main>
    </div>
  );
};

export default NoticeBoard;
