import React from "react";
import { Link } from "react-router-dom";
import { CalendarDays, Home, RefreshCw } from "lucide-react";
import NotificationBell from "./NotificationBell";

const DashboardHeader = ({
  userName = "",
  currentTime,
  workStatus,
  notifications = [],
  onRefresh,
  onDismissNotification,
  onClearAllNotifications,
}) => {
  const initials = (userName || "Employee")
    .split(" ")
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0])
    .join("")
    .toUpperCase();
  const firstName = userName?.split(" ")[0] || "there";
  const hour = currentTime?.getHours?.() ?? 12;
  const greeting = hour < 12 ? "Good morning" : hour < 17 ? "Good afternoon" : "Good evening";
  const statusLabel = workStatus?.onBreak
    ? "On break"
    : workStatus?.currentlyWorking
    ? "Working"
    : "Not punched in";

  return (
    <header className="rounded-2xl border border-slate-200 bg-white px-5 py-4 shadow-sm dark:border-white/10 dark:bg-[#10131c] sm:px-6 sm:py-5">
      <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
        <div className="min-w-0">
          <div className="mb-1 text-xs font-semibold uppercase tracking-wider text-slate-500 dark:text-slate-400">
            Employee dashboard
          </div>
          <h1 className="truncate text-2xl font-semibold tracking-tight text-slate-950 dark:text-white">
            {greeting}, {firstName}
          </h1>
          <div className="mt-3 flex flex-wrap items-center gap-2">
            <div className="inline-flex items-center gap-2 rounded-lg border border-slate-200 bg-slate-50 px-2.5 py-1.5 text-xs text-slate-600 dark:border-white/10 dark:bg-white/[0.04] dark:text-slate-300">
              <span
                className={`h-2 w-2 rounded-full ${
                  workStatus?.onBreak
                    ? "bg-amber-500"
                    : workStatus?.currentlyWorking
                    ? "bg-emerald-500"
                    : "bg-slate-400"
                }`}
              />
              <span className="font-medium">{statusLabel}</span>
              {workStatus?.arrivalTimeFormatted && (
                <span className="text-slate-400">since {workStatus.arrivalTimeFormatted}</span>
              )}
            </div>

            {workStatus?.isWFH && (
              <div className="inline-flex items-center gap-1.5 rounded-lg border border-slate-200 px-2.5 py-1.5 text-xs font-medium text-slate-600 dark:border-white/10 dark:text-slate-300">
                <Home className="h-3.5 w-3.5" /> Work from home
              </div>
            )}

            <div className="inline-flex items-center gap-1.5 px-1 text-xs text-slate-500 dark:text-slate-400">
              <CalendarDays className="h-3.5 w-3.5" />
              {currentTime.toLocaleDateString("en-US", {
                weekday: "short",
                month: "short",
                day: "numeric",
              })}
              <span aria-hidden="true">·</span>
              {currentTime.toLocaleTimeString("en-US", {
                hour: "2-digit",
                minute: "2-digit",
              })}
            </div>
          </div>
        </div>

        <div className="flex shrink-0 items-center gap-2 self-end lg:self-center">
          <button
            type="button"
            onClick={onRefresh}
            className="inline-flex h-10 w-10 items-center justify-center rounded-xl border border-slate-200 bg-white text-slate-500 transition hover:border-slate-300 hover:bg-slate-50 hover:text-slate-800 focus:outline-none focus:ring-2 focus:ring-blue-500 dark:border-white/10 dark:bg-white/[0.04] dark:text-slate-300 dark:hover:bg-white/[0.07] dark:hover:text-white"
            title="Refresh dashboard"
            aria-label="Refresh dashboard"
          >
            <RefreshCw className="h-4 w-4" />
          </button>
          <div className="rounded-xl border border-slate-200 bg-white p-px dark:border-white/10 dark:bg-white/[0.04]">
            <NotificationBell
              notifications={notifications}
              onDismiss={onDismissNotification}
              onClearAll={onClearAllNotifications}
            />
          </div>
          <Link
            to="/profile"
            className="flex h-10 w-10 items-center justify-center rounded-xl bg-slate-900 text-xs font-semibold text-white transition hover:bg-slate-800 dark:bg-slate-100 dark:text-slate-900 dark:hover:bg-white"
            aria-label="Open profile"
          >
            {initials}
          </Link>
        </div>
      </div>
    </header>
  );
};

export default DashboardHeader;
