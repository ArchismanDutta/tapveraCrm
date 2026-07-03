import React from "react";
import { Clock3, Coffee, Home, Loader2, LogIn, LogOut, Target, Timer } from "lucide-react";

const statusStyles = {
  break: {
    text: "On break",
    className: "border-amber-200 bg-amber-50 text-amber-700 dark:border-amber-400/20 dark:bg-amber-400/10 dark:text-amber-200",
    dot: "bg-amber-500",
  },
  working: {
    text: "Working",
    className: "border-emerald-200 bg-emerald-50 text-emerald-700 dark:border-emerald-400/20 dark:bg-emerald-400/10 dark:text-emerald-200",
    dot: "bg-emerald-500",
  },
  offline: {
    text: "Not punched in",
    className: "border-slate-200 bg-slate-50 text-slate-600 dark:border-white/10 dark:bg-white/[0.04] dark:text-slate-300",
    dot: "bg-slate-400",
  },
};

const getGreeting = () => {
  const hour = new Date().getHours();
  if (hour < 12) return "Good morning";
  if (hour < 18) return "Good afternoon";
  return "Good evening";
};

const AttendanceHero = ({
  userName = "",
  currentlyWorking = false,
  onBreak = false,
  punchInTime = "--",
  workedDuration = "0h 00m 00s",
  breakDuration = "0h 00m 00s",
  remainingHours = "8h 00m",
  onPunchIn,
  onPunchOut,
  isLoading = false,
  alreadyPunchedIn = false,
  alreadyPunchedOut = false,
  workProgress = 0,
  isWFH = false,
}) => {
  const firstName = userName.split(" ")[0] || "there";
  const progress = Math.max(0, Math.min(workProgress, 100));
  const todayLabel = new Intl.DateTimeFormat("en-US", {
    weekday: "long",
    month: "short",
    day: "numeric",
  }).format(new Date());
  const status = onBreak ? statusStyles.break : currentlyWorking ? statusStyles.working : statusStyles.offline;

  const metrics = [
    { label: "Started", value: punchInTime, icon: Clock3 },
    { label: "Worked", value: workedDuration, icon: Timer },
    { label: "Break", value: breakDuration, icon: Coffee },
    { label: "Remaining", value: remainingHours, icon: Target },
  ];

  const showPunchIn = !currentlyWorking && !alreadyPunchedOut;
  const showPunchOut = currentlyWorking || onBreak;
  const disabled = isLoading || (showPunchIn && alreadyPunchedIn);
  const buttonLabel = isLoading
    ? "Processing"
    : showPunchIn
    ? alreadyPunchedIn
      ? "Punched in"
      : "Punch in"
    : showPunchOut
    ? "Punch out"
    : "Day complete";
  const ButtonIcon = isLoading ? Loader2 : showPunchOut ? LogOut : LogIn;
  const buttonAction = showPunchIn ? onPunchIn : showPunchOut ? onPunchOut : undefined;

  return (
    <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm dark:border-white/10 dark:bg-[#10131c] sm:p-6">
      <div className="grid gap-5 lg:grid-cols-[minmax(0,1fr)_320px]">
        <div className="min-w-0">
          <div className="mb-4 flex flex-wrap items-start justify-between gap-3">
            <div className="min-w-0">
              <div className="mb-1 text-xs font-semibold uppercase tracking-wider text-slate-500 dark:text-slate-400">Today&apos;s attendance</div>
              <h1 className="truncate text-2xl font-semibold tracking-tight text-slate-950 dark:text-white">{getGreeting()}, {firstName}</h1>
              <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">{todayLabel}</p>
            </div>

            <div className="flex flex-wrap items-center gap-2">
              <div className={`inline-flex items-center gap-2 rounded-lg border px-2.5 py-1.5 text-xs font-medium ${status.className}`}>
                <span className={`h-2 w-2 rounded-full ${status.dot}`} />
                {status.text}
              </div>
              {isWFH && (
                <div className="inline-flex items-center gap-1.5 rounded-lg border border-slate-200 px-2.5 py-1.5 text-xs font-medium text-slate-600 dark:border-white/10 dark:text-slate-300">
                  <Home className="h-3.5 w-3.5" /> Work from home
                </div>
              )}
            </div>
          </div>

          <div className="grid grid-cols-2 gap-px overflow-hidden rounded-xl border border-slate-200 bg-slate-200 dark:border-white/10 dark:bg-white/10 sm:grid-cols-4">
            {metrics.map(({ label, value, icon: Icon }) => (
              <div key={label} className="min-w-0 bg-white p-3.5 dark:bg-[#10131c]">
                <div className="mb-2 flex items-center gap-2 text-xs text-slate-500 dark:text-slate-400">
                  {React.createElement(Icon, { className: "h-3.5 w-3.5 shrink-0" })}
                  <span>{label}</span>
                </div>
                <p className="truncate text-base font-semibold text-slate-950 dark:text-white sm:text-lg">{value}</p>
              </div>
            ))}
          </div>
        </div>

        <div className="flex flex-col justify-between gap-4 rounded-xl border border-slate-200 bg-slate-50 p-4 dark:border-white/10 dark:bg-white/[0.03]">
          <div>
            <div className="mb-2 flex items-center justify-between text-xs">
              <span className="font-medium text-slate-600 dark:text-slate-300">Daily progress</span>
              <span className="text-slate-500 dark:text-slate-400">{Math.round(progress)}% of 8 hours</span>
            </div>
            <div className="h-1.5 overflow-hidden rounded-full bg-slate-200 dark:bg-white/10">
              <div className="h-full rounded-full bg-blue-600 transition-[width] duration-500" style={{ width: `${progress}%` }} />
            </div>
          </div>

          <div className="border-t border-slate-200 pt-4 dark:border-white/10">
            <p className="mb-3 text-xs text-slate-500 dark:text-slate-400">
              {showPunchIn ? "Ready to start your workday" : showPunchOut ? onBreak ? "Break is currently active" : "Work session in progress" : "Attendance completed for today"}
            </p>
            {showPunchIn || showPunchOut ? (
              <button
                type="button"
                onClick={buttonAction}
                disabled={disabled}
                className={`inline-flex h-10 w-full items-center justify-center gap-2 rounded-xl px-4 text-sm font-semibold transition focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 dark:focus:ring-offset-[#10131c] ${
                  disabled
                    ? "cursor-not-allowed border border-slate-200 bg-slate-100 text-slate-400 dark:border-white/10 dark:bg-white/[0.04] dark:text-slate-500"
                    : showPunchOut
                    ? "border border-rose-200 bg-white text-rose-700 hover:bg-rose-50 dark:border-rose-400/25 dark:bg-transparent dark:text-rose-200 dark:hover:bg-rose-400/10"
                    : "border border-blue-600 bg-blue-600 text-white hover:border-blue-700 hover:bg-blue-700"
                }`}
              >
                <ButtonIcon className={`h-4 w-4 ${isLoading ? "animate-spin" : ""}`} />
                {buttonLabel}
              </button>
            ) : (
              <div className="inline-flex h-10 w-full items-center justify-center rounded-xl border border-slate-200 bg-slate-100 px-4 text-sm font-semibold text-slate-500 dark:border-white/10 dark:bg-white/[0.04] dark:text-slate-400">{buttonLabel}</div>
            )}
          </div>
        </div>
      </div>
    </section>
  );
};

export default AttendanceHero;
