import React, { useState } from "react";
import { Bell, Calendar, Clock, Hourglass } from "lucide-react";
import ImportantNoticeModal from "./ImportantNoticeModal";

// Map color names to Tailwind classes tailored for your theme
const colorMap = {
  green: { bg: "border-emerald-200 bg-emerald-50 dark:border-emerald-400/20 dark:bg-emerald-400/10", text: "text-emerald-700 dark:text-emerald-200" },
  blue: { bg: "border-blue-200 bg-blue-50 dark:border-blue-400/20 dark:bg-blue-400/10", text: "text-blue-700 dark:text-blue-200" },
  yellow: { bg: "border-amber-200 bg-amber-50 dark:border-amber-400/20 dark:bg-amber-400/10", text: "text-amber-700 dark:text-amber-200" },
};

const StatCard = ({ icon: Icon, value, label, color }) => (
  <div
    className="min-w-0 bg-white p-4 dark:bg-[#10131c] sm:p-5"
  >
    <div className={`mb-3 inline-flex h-9 w-9 items-center justify-center rounded-lg border ${colorMap[color].bg} ${colorMap[color].text}`}>
      {React.createElement(Icon, { className: "h-4 w-4" })}
    </div>
    <p className="text-2xl font-semibold text-slate-950 dark:text-white">{value}</p>
    <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">{label}</p>
  </div>
);

const LeaveSummary = ({ available, taken, pending, importantNotices = [] }) => {
  const [showPopover, setShowPopover] = useState(false);

  return (
    <div className="relative rounded-2xl border border-slate-200 bg-white p-4 shadow-sm dark:border-white/10 dark:bg-[#10131c] sm:p-5">
      {/* Header with button */}
      <div className="relative mb-4 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h3 className="text-base font-semibold text-slate-950 dark:text-white">Leave overview</h3>
          <p className="mt-0.5 text-xs text-slate-500 dark:text-slate-400">Current annual allowance and request status</p>
        </div>

        <div className="relative">
          <button
            type="button"
            onClick={() => setShowPopover(true)}
            className="inline-flex h-9 items-center justify-center gap-2 rounded-lg border border-amber-200 bg-amber-50 px-3 text-xs font-semibold text-amber-700 transition hover:bg-amber-100 dark:border-amber-400/20 dark:bg-amber-400/10 dark:text-amber-200"
          >
            <Bell className="h-3.5 w-3.5" /> Leave policy
          </button>

          {showPopover && (
            <ImportantNoticeModal notices={importantNotices} onClose={() => setShowPopover(false)} />
          )}
        </div>
      </div>

      {/* Stats cards */}
      <div className="grid grid-cols-3 gap-px overflow-hidden rounded-xl border border-slate-200 bg-slate-200 dark:border-white/10 dark:bg-white/10">
        <StatCard icon={Calendar} value={available} label="Available days" color="green" />
        <StatCard icon={Clock} value={taken} label="Taken days" color="blue" />
        <StatCard icon={Hourglass} value={pending} label="Pending days" color="yellow" />
      </div>
    </div>
  );
};

export default LeaveSummary;
