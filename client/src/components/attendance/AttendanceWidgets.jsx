import React from "react";
import { CalendarCheck, Clock3, Flame, TrendingUp } from "lucide-react";

const cards = [
  { key: "weekly", title: "Weekly hours", icon: Clock3, iconClass: "text-blue-600 dark:text-blue-300" },
  { key: "streak", title: "Streak", icon: Flame, iconClass: "text-amber-600 dark:text-amber-300" },
  { key: "month", title: "This month", icon: CalendarCheck, iconClass: "text-emerald-600 dark:text-emerald-300" },
  { key: "arrival", title: "Avg. arrival", icon: TrendingUp, iconClass: "text-slate-500 dark:text-slate-300" },
];

const AttendanceWidgets = ({ weeklyHours = 0, targetWeeklyHours = 40, attendanceStreak = 0, monthlyAttendance = 0, overtimeHours = 0, averageArrivalTime = "--", className = "" }) => {
  const weeklyProgress = Math.min((weeklyHours / targetWeeklyHours) * 100, 100);
  const values = {
    weekly: { value: `${weeklyHours}h`, helper: `${Math.round(weeklyProgress)}% of ${targetWeeklyHours}h`, progress: weeklyProgress },
    streak: { value: `${attendanceStreak}`, helper: attendanceStreak === 1 ? "day" : "days", progress: Math.min(attendanceStreak * 14, 100) },
    month: { value: `${monthlyAttendance}%`, helper: "attendance rate", progress: monthlyAttendance },
    arrival: { value: averageArrivalTime, helper: overtimeHours > 0 ? `+${overtimeHours}h overtime` : "this week", progress: 0 },
  };

  return (
    <section className={`grid grid-cols-1 gap-3 sm:grid-cols-2 2xl:grid-cols-4 ${className}`}>
      {cards.map((card) => {
        const Icon = card.icon;
        const data = values[card.key];
        return (
          <article key={card.key} className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm dark:border-white/10 dark:bg-[#10131c]">
            <div className="mb-3 flex items-center justify-between gap-3">
              <div className="min-w-0">
                <h3 className="truncate text-xs font-medium text-slate-500 dark:text-slate-400">{card.title}</h3>
                <p className="mt-2 truncate text-2xl font-semibold tracking-tight text-slate-950 dark:text-white">{data.value}</p>
              </div>
              <div className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-slate-50 dark:bg-white/[0.05] ${card.iconClass}`}><Icon className="h-4 w-4" /></div>
            </div>
            <p className="text-[11px] text-slate-400 dark:text-slate-500">{data.helper}</p>
            {card.key !== "arrival" && (
              <div className="mt-3 h-1 overflow-hidden rounded-full bg-slate-100 dark:bg-white/[0.07]">
                <div className="h-full rounded-full bg-blue-600 transition-[width] duration-500" style={{ width: `${Math.max(0, Math.min(data.progress, 100))}%` }} />
              </div>
            )}
          </article>
        );
      })}
    </section>
  );
};

export default AttendanceWidgets;
