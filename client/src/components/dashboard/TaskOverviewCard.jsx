import React from "react";
import { Link } from "react-router-dom";
import { ArrowRight, Phone, ExternalLink } from "lucide-react";

/** The cabin-call system. External to the CRM, hence a real <a> and not a route. */
const CALL_ADMIN_URL = "https://tapvera.io/cabin_call/index.php";

const iconStyles = {
  blue: "bg-blue-50 text-blue-600 dark:bg-blue-400/10 dark:text-blue-300",
  orange: "bg-amber-50 text-amber-600 dark:bg-amber-400/10 dark:text-amber-300",
  red: "bg-rose-50 text-rose-600 dark:bg-rose-400/10 dark:text-rose-300",
  green: "bg-emerald-50 text-emerald-600 dark:bg-emerald-400/10 dark:text-emerald-300",
  rose: "bg-slate-100 text-slate-500 dark:bg-white/[0.06] dark:text-slate-300",
};

const TaskOverviewCard = ({ summaryData = [] }) => (
  <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm dark:border-white/10 dark:bg-[#10131c]">
    <div className="mb-4 flex items-center justify-between gap-3">
      <div>
        <h2 className="text-base font-semibold text-slate-950 dark:text-white">Task overview</h2>
        <p className="mt-0.5 text-sm text-slate-500 dark:text-slate-400">Current workload and priority</p>
      </div>
      <Link
        to="/tasks"
        className="group hidden items-center gap-1.5 text-xs font-semibold text-blue-600 transition hover:text-blue-700 dark:text-blue-300 dark:hover:text-blue-200 sm:flex"
      >
        View all <ArrowRight className="h-3.5 w-3.5 transition-transform group-hover:translate-x-0.5" />
      </Link>
    </div>

    {/* Six columns, not five: the Call Admin action sits inside the same strip
        as the stats so it reads as part of one object rather than a stray
        button parked next to it. */}
    <div className="grid grid-cols-2 gap-px overflow-hidden rounded-xl border border-slate-200 bg-slate-200 dark:border-white/10 dark:bg-white/10 md:grid-cols-6">
      {summaryData.map((item, idx) => {
        const Icon = item.icon;
        return (
          <div
            key={`${item.label}-${idx}`}
            className="relative min-w-0 bg-white p-4 dark:bg-[#10131c]"
          >
            {item.urgent && (
              <span className="absolute right-3 top-3 h-1.5 w-1.5 rounded-full bg-rose-500" />
            )}
            <div className={`mb-3 flex h-8 w-8 items-center justify-center rounded-lg ${iconStyles[item.color] || iconStyles.blue}`}>
              {Icon && <Icon className="h-4 w-4" />}
            </div>
            <div className="text-2xl font-semibold tracking-tight text-slate-950 dark:text-white">{item.count}</div>
            <div className="mt-1 truncate text-xs font-medium text-slate-500 dark:text-slate-400">{item.label}</div>
            {item.trend && (
              <div className="mt-1 text-[11px] text-slate-400 dark:text-slate-500">{item.trend} completed</div>
            )}
          </div>
        );
      })}

      {/* Call Admin.
          Deliberately an <a target="_blank">, not a Link or a location change:
          the cabin-call system is a separate app, and navigating away would
          throw out the dashboard's loaded state to come back to. The tag/label
          rhythm mirrors the stat cells (icon, headline, caption) so the cell
          lines up with them instead of looking bolted on.
          rel="noopener" is required with target="_blank" — without it the opened
          page gets a handle on this window via window.opener. */}
      <a
        href={CALL_ADMIN_URL}
        target="_blank"
        rel="noopener noreferrer"
        className="group relative min-w-0 overflow-hidden bg-gradient-to-br from-rose-600/95 via-red-600/90 to-red-800/95 p-4 text-left ring-1 ring-inset ring-white/25 backdrop-blur-md transition duration-200 hover:from-rose-500 hover:via-red-600 hover:to-red-700 hover:ring-white/40"
      >
        {/* Specular sheen — a bright edge along the top falling off to nothing.
            This is the part that actually reads as glass; translucency and blur
            on their own just look like a tinted panel. Clipped by
            overflow-hidden above, and pointer-events-none so it can never
            intercept the click. */}
        <span
          aria-hidden="true"
          className="pointer-events-none absolute inset-x-0 top-0 h-1/2 bg-gradient-to-b from-white/25 via-white/[0.07] to-transparent"
        />

        {/* ─── ON THE OPACITY ───
            95/90/95 rather than something more obviously see-through. The tile
            has to stay legible over BOTH backgrounds: in dark mode it sits on
            #10131c and any amount of transparency only deepens the red, but in
            light mode it sits on white, and dropping to ~80% washes the red out
            to roughly 3.4:1 against white text — under the 4.5:1 minimum. Held
            up here, the darkest stop keeps it near 5.5:1 in both themes, and the
            ring plus the sheen carry the glass read instead. */}
        <span className="relative z-10 mb-3 flex h-8 w-8 items-center justify-center rounded-lg bg-white/20 text-white ring-1 ring-inset ring-white/30 backdrop-blur-sm transition group-hover:bg-white/30">
          <Phone className="h-4 w-4" />
        </span>
        <div className="relative z-10 text-base font-semibold tracking-tight text-white drop-shadow-sm">
          Call Admin
        </div>
        {/* rose-100 rather than white/70: a flat white at low alpha dims toward
            the background and loses contrast, while a light tint of the hue
            stays readable and still reads as secondary. */}
        <div className="relative z-10 mt-1 flex items-center gap-1 truncate text-xs font-medium text-rose-100/90">
          Cabin call
          <ExternalLink className="h-3 w-3 flex-shrink-0" />
        </div>
      </a>
    </div>
  </section>
);

export default TaskOverviewCard;
