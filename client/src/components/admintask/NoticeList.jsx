import React, { useMemo, useState } from "react";
import dayjs from "dayjs";
import { BellOff, CircleStop, Megaphone } from "lucide-react";

const filters = [
  { id: "all", label: "All" },
  { id: "active", label: "Active" },
  { id: "inactive", label: "Inactive" },
];

const NoticeList = ({ notices, onDeactivate }) => {
  const [filter, setFilter] = useState("all");
  const [deactivatingId, setDeactivatingId] = useState(null);

  const filteredNotices = useMemo(() => {
    const matching = notices.filter((notice) => {
      if (filter === "active") return notice.isActive;
      if (filter === "inactive") return !notice.isActive;
      return true;
    });
    return [...matching].sort(
      (first, second) => new Date(second.createdAt) - new Date(first.createdAt),
    );
  }, [filter, notices]);

  const handleDeactivate = async (id) => {
    try {
      setDeactivatingId(id);
      await onDeactivate(id);
    } finally {
      setDeactivatingId(null);
    }
  };

  return (
    <div>
      <div className="mb-4 flex gap-1 overflow-x-auto rounded-xl bg-slate-100 p-1 dark:bg-white/[0.04] sm:w-fit">
        {filters.map((item) => (
          <button
            key={item.id}
            type="button"
            onClick={() => setFilter(item.id)}
            className={`h-8 rounded-lg px-3 text-xs font-semibold transition ${
              filter === item.id
                ? "bg-white text-slate-900 shadow-sm dark:bg-white/[0.09] dark:text-white"
                : "text-slate-500 hover:text-slate-900 dark:text-slate-400 dark:hover:text-white"
            }`}
          >
            {item.label}
          </button>
        ))}
      </div>

      {filteredNotices.length === 0 ? (
        <div className="py-14 text-center">
          <span className="mx-auto flex h-12 w-12 items-center justify-center rounded-xl bg-slate-100 text-slate-400 dark:bg-white/[0.05]">
            <BellOff className="h-5 w-5" />
          </span>
          <h3 className="mt-4 text-sm font-semibold text-slate-900 dark:text-white">
            No {filter === "all" ? "" : `${filter} `}notices found
          </h3>
          <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">
            {notices.length === 0
              ? "Published announcements will appear here."
              : "Try a different status filter."}
          </p>
        </div>
      ) : (
        <div className="space-y-3">
          {filteredNotices.map((notice) => (
            <article
              key={notice._id}
              className="flex flex-col gap-4 rounded-xl border border-slate-200 p-4 transition hover:border-slate-300 dark:border-white/10 dark:hover:border-white/20 sm:flex-row sm:items-start sm:justify-between"
            >
              <div className="flex min-w-0 gap-3">
                <span
                  className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-xl ${
                    notice.isActive
                      ? "bg-blue-50 text-blue-600 dark:bg-blue-400/10 dark:text-blue-300"
                      : "bg-slate-100 text-slate-400 dark:bg-white/[0.05] dark:text-slate-500"
                  }`}
                >
                  <Megaphone className="h-4 w-4" />
                </span>
                <div className="min-w-0">
                  <p className="whitespace-pre-wrap break-words text-sm leading-6 text-slate-800 dark:text-slate-200">
                    {notice.message}
                  </p>
                  <div className="mt-2 flex flex-wrap items-center gap-2 text-xs text-slate-500 dark:text-slate-400">
                    <time dateTime={notice.createdAt}>
                      {dayjs(notice.createdAt).format("DD MMM YYYY, hh:mm A")}
                    </time>
                    <span aria-hidden="true">·</span>
                    <span
                      className={`inline-flex items-center gap-1.5 font-medium ${
                        notice.isActive
                          ? "text-emerald-700 dark:text-emerald-300"
                          : "text-slate-500 dark:text-slate-400"
                      }`}
                    >
                      <span
                        className={`h-1.5 w-1.5 rounded-full ${
                          notice.isActive ? "bg-emerald-500" : "bg-slate-400"
                        }`}
                      />
                      {notice.isActive ? "Active" : "Inactive"}
                    </span>
                  </div>
                </div>
              </div>

              {notice.isActive && (
                <button
                  type="button"
                  onClick={() => handleDeactivate(notice._id)}
                  disabled={deactivatingId === notice._id}
                  className="inline-flex h-9 shrink-0 items-center justify-center gap-2 rounded-lg border border-slate-200 px-3 text-xs font-semibold text-slate-600 transition hover:border-rose-200 hover:bg-rose-50 hover:text-rose-700 disabled:opacity-50 dark:border-white/10 dark:text-slate-300 dark:hover:border-rose-400/20 dark:hover:bg-rose-400/10 dark:hover:text-rose-300"
                >
                  {deactivatingId === notice._id ? (
                    <span className="h-3.5 w-3.5 animate-spin rounded-full border-2 border-slate-300 border-t-slate-600 dark:border-slate-600 dark:border-t-slate-200" />
                  ) : (
                    <CircleStop className="h-3.5 w-3.5" />
                  )}
                  {deactivatingId === notice._id
                    ? "Deactivating..."
                    : "Deactivate"}
                </button>
              )}
            </article>
          ))}
        </div>
      )}
    </div>
  );
};

export default NoticeList;
