import React from "react";
import { BarChart3 } from "lucide-react";

const DAYS = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];
const TARGET_HOURS = 8;

const WeeklySummary = ({ dailyData = [], weeklySummary = null, className = "" }) => {
  const parseTimeToHours = (timeStr) => {
    if (!timeStr) return 0;
    const match = timeStr.match(/(\d+)h\s*(\d+)m/);
    return match ? (parseInt(match[1], 10) || 0) + (parseInt(match[2], 10) || 0) / 60 : 0;
  };

  const dailyHoursMap = Object.fromEntries(DAYS.map((day) => [day, 0]));
  const today = new Date();
  const dayOfWeek = today.getDay();

  if (Array.isArray(dailyData)) {
    dailyData.forEach((day) => {
      if (!day.date) return;
      const date = new Date(day.date);
      const dayIndex = date.getDay();
      const dayKey = DAYS[dayIndex === 0 ? 6 : dayIndex - 1];
      const hours = day.workDurationSeconds != null
        ? day.workDurationSeconds / 3600
        : parseTimeToHours(day.workDuration);
      if (dayKey) dailyHoursMap[dayKey] = Math.round(hours * 10) / 10;
    });
  }

  const todayIndex = dayOfWeek === 0 ? 6 : dayOfWeek - 1;
  const totalHours = Object.values(dailyHoursMap).reduce((sum, hours) => sum + hours, 0);
  const totalHoursFormatted = weeklySummary?.totalWork || weeklySummary?.totalWorkTime || `${Math.floor(totalHours)}h ${Math.round((totalHours % 1) * 60)}m`;
  const attendancePercentage = weeklySummary?.presentDays
    ? Math.round((weeklySummary.presentDays / 5) * 100)
    : Math.round((Object.values(dailyHoursMap).filter((hours) => hours > 0).length / 5) * 100);
  const breaksTotal = weeklySummary?.totalBreak || weeklySummary?.totalBreakTime || "0h 0m";
  const maxHours = Math.max(...Object.values(dailyHoursMap), TARGET_HOURS);

  const chartData = DAYS.map((day, index) => {
    const hours = dailyHoursMap[day];
    return {
      day,
      hours,
      isToday: index === todayIndex,
      isFuture: index > todayIndex,
      targetMet: hours >= TARGET_HOURS,
      height: hours > 0 ? Math.max(8, (hours / maxHours) * 100) : 0,
    };
  });

  return (
    <section className={`flex h-[420px] flex-col overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm dark:border-white/10 dark:bg-[#10131c] ${className}`}>
      <div className="flex flex-col gap-3 border-b border-slate-200 px-5 py-4 dark:border-white/10 sm:flex-row sm:items-center sm:justify-between">
        <div className="min-w-0">
          <div className="flex items-center gap-2.5">
            <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-blue-50 text-blue-600 dark:bg-blue-400/10 dark:text-blue-300"><BarChart3 className="h-4 w-4" /></div>
            <div><h2 className="text-base font-semibold text-slate-950 dark:text-white">Weekly summary</h2><p className="mt-0.5 text-xs text-slate-500 dark:text-slate-400">Attendance across the current week</p></div>
          </div>
        </div>

        <div className="grid grid-cols-3 gap-5 text-right">
          <div><p className="text-[11px] text-slate-400">Work</p><p className="text-xs font-semibold text-slate-900 dark:text-white">{totalHoursFormatted}</p></div>
          <div><p className="text-[11px] text-slate-400">Break</p><p className="text-xs font-semibold text-slate-900 dark:text-white">{breaksTotal}</p></div>
          <div><p className="text-[11px] text-slate-400">Rate</p><p className="text-xs font-semibold text-slate-900 dark:text-white">{attendancePercentage}%</p></div>
        </div>
      </div>

      <div className="flex min-h-0 flex-1 flex-col p-5">
        <div className="grid min-h-0 flex-1 grid-cols-7 items-end gap-2 border-b border-slate-200 pb-3 dark:border-white/10">
          {chartData.map((item) => (
            <div key={item.day} className="flex min-w-0 flex-col items-center gap-2">
              <div className="flex h-40 w-full items-end justify-center">
                <div className="relative h-full w-full max-w-12 overflow-hidden rounded-md bg-slate-100 dark:bg-white/[0.05]">
                  {item.hours > 0 && (
                    <div className={`absolute inset-x-0 bottom-0 rounded-t-md ${item.targetMet ? "bg-emerald-500" : "bg-blue-600"}`} style={{ height: `${item.height}%` }} />
                  )}
                  {item.isToday && <div className="absolute inset-x-1.5 top-2 h-0.5 rounded-full bg-blue-500" />}
                </div>
              </div>
              <div className="text-center">
                <p className={`text-xs font-medium ${item.isToday ? "text-blue-600 dark:text-blue-300" : item.isFuture ? "text-slate-300 dark:text-slate-600" : "text-slate-600 dark:text-slate-300"}`}>{item.day}</p>
                <p className="mt-1 text-[11px] text-slate-400 dark:text-slate-500">{item.hours > 0 ? `${item.hours}h` : "--"}</p>
              </div>
            </div>
          ))}
        </div>

        <div className="mt-3 flex flex-wrap items-center gap-x-4 gap-y-2 text-[11px] text-slate-500 dark:text-slate-400">
          <span className="inline-flex items-center gap-1.5"><span className="h-2 w-2 rounded-full bg-blue-600" /> Recorded</span>
          <span className="inline-flex items-center gap-1.5"><span className="h-2 w-2 rounded-full bg-emerald-500" /> Target met</span>
          <span className="inline-flex items-center gap-1.5"><span className="h-2 w-2 rounded-full bg-slate-200 dark:bg-slate-600" /> No hours</span>
        </div>
      </div>
    </section>
  );
};

export default WeeklySummary;
