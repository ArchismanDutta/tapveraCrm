import React from "react";
import { Clock3, Pause, Play, Square } from "lucide-react";
import timeUtils from "../../utils/timeUtils";

const formatLocalTime = (isoString) => {
  if (!isoString) return "--";
  try { return timeUtils.formatTime(isoString); } catch { return "--"; }
};

const getBreakTypeLabel = (event) => {
  const notes = String(event?.notes || "").trim();
  if (notes && notes.toLowerCase() !== "manual entry") return notes;
  return String(event?.type || "").match(/\(([^)]+)\)/)?.[1]?.trim() || "";
};

const getEventDetails = (event) => {
  const eventType = String(event?.type || "").toLowerCase();
  const breakTypeLabel = getBreakTypeLabel(event);
  if (eventType.includes("punch") && eventType.includes("in")) return { icon: Play, label: "Punch in", breakTypeLabel: "", style: "border-emerald-200 bg-emerald-50 text-emerald-600 dark:border-emerald-400/20 dark:bg-emerald-400/10 dark:text-emerald-300" };
  if (eventType.includes("punch") && eventType.includes("out")) return { icon: Square, label: "Punch out", breakTypeLabel: "", style: "border-rose-200 bg-rose-50 text-rose-600 dark:border-rose-400/20 dark:bg-rose-400/10 dark:text-rose-300" };
  if (eventType.includes("break") && eventType.includes("start")) return { icon: Pause, label: "Break started", breakTypeLabel, style: "border-amber-200 bg-amber-50 text-amber-600 dark:border-amber-400/20 dark:bg-amber-400/10 dark:text-amber-300" };
  if ((eventType.includes("break") && eventType.includes("end")) || eventType.includes("resume")) return { icon: Play, label: "Work resumed", breakTypeLabel, style: "border-blue-200 bg-blue-50 text-blue-600 dark:border-blue-400/20 dark:bg-blue-400/10 dark:text-blue-300" };
  return { icon: Clock3, label: event?.type || "Activity", breakTypeLabel, style: "border-slate-200 bg-slate-50 text-slate-500 dark:border-white/10 dark:bg-white/[0.04] dark:text-slate-300" };
};

const AttendanceTimeline = ({ timeline = [], className = "" }) => {
  const validTimeline = timeline.filter((item) => item?.type && item?.time && !isNaN(new Date(item.time).getTime())).sort((a, b) => new Date(a.time) - new Date(b.time));
  const allEvents = [...validTimeline];
  const hasPunchIn = validTimeline.some((event) => event.type?.toLowerCase().includes("punch") && event.type?.toLowerCase().includes("in"));
  const hasPunchOut = validTimeline.some((event) => event.type?.toLowerCase().includes("punch") && event.type?.toLowerCase().includes("out"));
  if (!hasPunchIn) allEvents.push({ type: "Punch In", time: null, pending: true });
  if (hasPunchIn && !hasPunchOut) allEvents.push({ type: "Punch Out", time: null, pending: true });

  return (
    <section className={`flex h-[420px] flex-col overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm dark:border-white/10 dark:bg-[#10131c] ${className}`}>
      <div className="flex items-center justify-between gap-3 border-b border-slate-200 px-5 py-4 dark:border-white/10">
        <div><h2 className="text-base font-semibold text-slate-950 dark:text-white">Today&apos;s activity</h2><p className="mt-0.5 text-xs text-slate-500 dark:text-slate-400">{validTimeline.length} recorded events</p></div>
        <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-slate-100 text-slate-500 dark:bg-white/[0.05] dark:text-slate-300"><Clock3 className="h-4 w-4" /></div>
      </div>

      <div className="relative min-h-0 flex-1 overflow-y-auto p-5 [scrollbar-gutter:stable]">
        <div className="absolute bottom-7 left-[32px] top-7 w-px bg-slate-200 dark:bg-white/10" />
        <div className="space-y-3">
          {allEvents.map((event, index) => {
            const details = getEventDetails(event);
            const isPending = event.pending || !event.time;
            const Icon = details.icon;
            return (
              <div key={`${event.time || "pending"}-${index}`} className="relative flex items-start gap-3">
                <div className={`relative z-10 flex h-7 w-7 shrink-0 items-center justify-center rounded-lg border ${isPending ? "border-slate-200 bg-white text-slate-300 dark:border-white/10 dark:bg-[#10131c] dark:text-slate-600" : details.style}`}><Icon className="h-3.5 w-3.5" /></div>
                <div className={`min-w-0 flex-1 border-b border-slate-100 pb-3 dark:border-white/[0.06] ${isPending ? "opacity-60" : ""}`}>
                  <p className={`truncate text-sm font-medium ${isPending ? "text-slate-400 dark:text-slate-500" : "text-slate-900 dark:text-white"}`}>{details.label}</p>
                  {details.breakTypeLabel && <span className="mt-1 inline-flex rounded-md bg-slate-100 px-2 py-0.5 text-[11px] text-slate-600 dark:bg-white/[0.05] dark:text-slate-300">{details.breakTypeLabel}</span>}
                  <p className="mt-1 text-xs text-slate-400 dark:text-slate-500">{isPending ? "Pending" : formatLocalTime(event.time)}</p>
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </section>
  );
};

export default AttendanceTimeline;
