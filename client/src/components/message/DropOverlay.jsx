import React from "react";
import { Upload } from "lucide-react";

/**
 * The "drop files here" overlay shown while a file drag is over a thread.
 *
 * `pointer-events-none` is load-bearing: an overlay that accepts pointer
 * events sits between the cursor and the element holding the drop handlers,
 * so the drop lands on the overlay instead and the browser navigates away to
 * the file. It must be visible but not interactive.
 *
 * Accent is a prop rather than hardcoded because the two surfaces are
 * deliberately themed apart — chat is blue, project threads teal — the same
 * distinction ThreadFilterBar already carries.
 *
 * @param {boolean} active
 * @param {'blue'|'teal'} [accent='blue']
 * @param {number} [maxFiles]
 */
const ACCENTS = {
  blue: {
    ring: "border-blue-400 dark:border-blue-400/70",
    wash: "bg-blue-50/90 dark:bg-blue-950/70",
    icon: "text-blue-600 dark:text-blue-300",
    text: "text-blue-900 dark:text-blue-100",
    sub: "text-blue-700/70 dark:text-blue-200/60",
  },
  teal: {
    ring: "border-teal-400 dark:border-teal-400/70",
    wash: "bg-teal-50/90 dark:bg-teal-950/70",
    icon: "text-teal-600 dark:text-teal-300",
    text: "text-teal-900 dark:text-teal-100",
    sub: "text-teal-700/70 dark:text-teal-200/60",
  },
};

const DropOverlay = ({ active, accent = "blue", maxFiles }) => {
  if (!active) return null;
  const c = ACCENTS[accent] || ACCENTS.blue;

  return (
    <div
      className={`pointer-events-none absolute inset-0 z-40 flex items-center justify-center ${c.wash} backdrop-blur-[1px]`}
      aria-hidden="true"
    >
      <div
        className={`flex flex-col items-center gap-3 rounded-2xl border-2 border-dashed ${c.ring} px-10 py-8`}
      >
        <Upload className={`h-8 w-8 ${c.icon}`} />
        <div className="text-center">
          <p className={`text-sm font-semibold ${c.text}`}>Drop files to attach</p>
          <p className={`mt-1 text-xs ${c.sub}`}>
            Any file type{maxFiles ? ` · up to ${maxFiles} at once` : ""}
          </p>
        </div>
      </div>
    </div>
  );
};

export default DropOverlay;
