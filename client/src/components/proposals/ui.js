// components/proposals/ui.js
//
// The CRM's dark palette, in one place.
//
// ─────────────────────────────────────────────────────────────────────────────
// WHY THESE EXACT HEX VALUES
// ─────────────────────────────────────────────────────────────────────────────
// The app runs class-based dark mode (`@custom-variant dark (&:is(.dark *))`
// in index.css) and every existing page hard-codes the same three surfaces:
//
//   #0a0f16   page ground
//   #1a1f2e   raised card
//   #0f1419   sunken — inputs, table headers, hover rows
//
// They are not Tailwind palette colours, so there is no token to import and
// nothing stops a new page from inventing its own near-black. Collecting them
// here means the Proposals screens match ClientRequests and SuperAdminDashboard
// by construction, and a future palette change is one file rather than a grep.
//
// Light-mode halves are Tailwind greys, matching the same pages.

export const ui = {
  // Surfaces
  page:    "bg-gray-50 dark:bg-[#0a0f16]",
  card:    "bg-white dark:bg-[#1a1f2e]",
  sunken:  "bg-gray-50 dark:bg-[#0f1419]",
  hover:   "hover:bg-gray-50 dark:hover:bg-[#0f1419]",

  // Lines
  border:      "border-gray-200 dark:border-gray-700",
  borderInput: "border-gray-300 dark:border-gray-600",
  divide:      "divide-gray-200 dark:divide-gray-700",

  // Text
  heading: "text-gray-900 dark:text-white",
  body:    "text-gray-700 dark:text-gray-300",
  muted:   "text-gray-600 dark:text-gray-400",
  faint:   "text-gray-500 dark:text-gray-500",
};

export const input =
  "w-full rounded-lg border px-3 py-2 text-sm " +
  "bg-gray-50 dark:bg-[#0f1419] border-gray-300 dark:border-gray-600 " +
  "text-gray-900 dark:text-white placeholder:text-gray-400 dark:placeholder:text-gray-500 " +
  "focus:outline-none focus:border-blue-500";

const btnBase =
  "inline-flex items-center gap-1.5 rounded-lg px-3 py-2 text-sm font-medium " +
  "transition-colors disabled:opacity-50 disabled:cursor-not-allowed";

export const btnPrimary =
  `${btnBase} bg-blue-600 text-white hover:bg-blue-500 dark:bg-blue-600 dark:hover:bg-blue-500`;

export const btnGhost =
  `${btnBase} border border-gray-300 dark:border-gray-600 ` +
  "text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-[#0f1419]";

// Status pills. Dark halves use /15 alpha fills rather than solid 900-level
// greens: a saturated block reads as a button on a near-black ground, and
// these are labels nobody should try to click.
export const STATUS_STYLE = {
  draft: {
    label: "Draft",
    cls: "bg-gray-100 text-gray-600 border-gray-200 dark:bg-gray-500/15 dark:text-gray-300 dark:border-gray-600",
  },
  published: {
    label: "Live",
    cls: "bg-emerald-50 text-emerald-700 border-emerald-200 dark:bg-emerald-500/15 dark:text-emerald-300 dark:border-emerald-500/30",
  },
  generating: {
    label: "Generating",
    cls: "bg-amber-50 text-amber-700 border-amber-200 dark:bg-amber-500/15 dark:text-amber-300 dark:border-amber-500/30",
  },
  expired: {
    label: "Expired",
    cls: "bg-orange-50 text-orange-700 border-orange-200 dark:bg-orange-500/15 dark:text-orange-300 dark:border-orange-500/30",
  },
  archived: {
    label: "Archived",
    cls: "bg-gray-50 text-gray-400 border-gray-200 dark:bg-gray-700/30 dark:text-gray-500 dark:border-gray-700",
  },
};

// Field-source badges — the guardrail made visible in the form.
export const SOURCE_BADGE = {
  ai: {
    label: "AI drafted",
    cls: "bg-violet-50 text-violet-700 border-violet-200 dark:bg-violet-500/15 dark:text-violet-300 dark:border-violet-500/30",
  },
  computed: {
    label: "Calculated",
    cls: "bg-gray-100 text-gray-600 border-gray-200 dark:bg-gray-500/15 dark:text-gray-300 dark:border-gray-600",
  },
  // Stricter than "Calculated": this one is a reading from outside the system,
  // not arithmetic on values already here. It exists so an agent can see at a
  // glance that the number on the proposal is Google's, not theirs.
  measured: {
    label: "Measured",
    cls: "bg-teal-50 text-teal-700 border-teal-200 dark:bg-teal-500/15 dark:text-teal-300 dark:border-teal-500/30",
  },
  crm: {
    label: "From CRM",
    cls: "bg-sky-50 text-sky-700 border-sky-200 dark:bg-sky-500/15 dark:text-sky-300 dark:border-sky-500/30",
  },
};
