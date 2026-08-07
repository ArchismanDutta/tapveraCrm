import React, { useState } from "react";
import { Search, Filter, X, ChevronDown } from "lucide-react";

const ProjectFilters = ({
  searchTerm,
  onSearchChange,
  filterType,
  onTypeChange,
  filterStatus,
  onStatusChange,
  filterPriority,
  onPriorityChange,
  showMyProjectsOnly,
  onToggleMyProjects,
  onClearFilters,
}) => {
  const projectTypes = [
    "Website",
    "SEO",
    "Google Marketing",
    "SMO",
    "Hosting",
    "Invoice App",
  ];

  const statuses = ["new", "ongoing", "expired", "completed"];
  const priorities = ["High", "Medium", "Low"];

  // Collapsed by default on a phone.
  //
  // Four full-width controls plus a toggle and a heading ran ~300px — most of a
  // screen spent on filters that are, on any given visit, mostly left alone.
  // The search box stays out (it is the one people reach for); the three
  // selects and the toggle fold away behind a disclosure. From `sm` the panel
  // is always open and this state is ignored entirely.
  const [openOnMobile, setOpenOnMobile] = useState(false);

  const activeCount =
    (filterType !== "all" ? 1 : 0) +
    (filterStatus !== "all" ? 1 : 0) +
    (filterPriority !== "all" ? 1 : 0) +
    (showMyProjectsOnly ? 1 : 0);

  const hasActiveFilters = activeCount > 0 || searchTerm;

  return (
    <div className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm dark:border-white/10 dark:bg-[#10131c]">
      <div className="p-3 sm:p-4">
        {/* Heading row. On a phone the whole row is the disclosure control, and
            it carries a count so a collapsed panel can still tell you that
            filters are narrowing what you see — a hidden active filter is how
            people conclude their data has gone missing. */}
        <div className="mb-3 flex items-center justify-between gap-2 sm:mb-4">
          <button
            type="button"
            onClick={() => setOpenOnMobile((v) => !v)}
            aria-expanded={openOnMobile}
            aria-controls="project-filter-fields"
            className="-m-1 flex items-center gap-2 rounded-lg p-1 text-left sm:pointer-events-none"
          >
            <div className="inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-blue-50 text-blue-600 dark:bg-blue-400/10 dark:text-blue-300">
              <Filter className="h-3.5 w-3.5" />
            </div>
            <h3 className="text-sm font-semibold text-slate-950 dark:text-white">Filters</h3>
            {activeCount > 0 && (
              <span className="inline-flex h-5 min-w-5 items-center justify-center rounded-full bg-blue-600 px-1.5 text-[11px] font-semibold leading-none text-white">
                {activeCount}
              </span>
            )}
            <ChevronDown
              className={`h-4 w-4 text-slate-400 transition-transform sm:hidden ${openOnMobile ? "rotate-180" : ""}`}
            />
          </button>

          {hasActiveFilters && (
            <button
              onClick={onClearFilters}
              className="inline-flex shrink-0 items-center gap-1 rounded-md border border-slate-200 bg-white px-2 py-1 text-xs text-slate-500 transition hover:bg-slate-50 hover:text-slate-900 dark:border-white/10 dark:bg-white/[0.04] dark:text-slate-400 dark:hover:bg-white/[0.07] dark:hover:text-white"
            >
              <X className="h-3 w-3" />
              Clear
            </button>
          )}
        </div>

        {/* Search sits outside the disclosure — it is the control people
            actually use, and burying it behind a tap would be a regression
            dressed up as tidiness. */}
        <div className="relative mb-3 sm:hidden">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
          <input
            type="text"
            placeholder="Search projects..."
            value={searchTerm}
            onChange={(e) => onSearchChange(e.target.value)}
            className="h-10 w-full rounded-xl border border-slate-200 bg-slate-50 pl-9 pr-3 text-sm text-slate-900 outline-none transition placeholder:text-slate-400 focus:border-blue-500 focus:bg-white focus:ring-2 focus:ring-blue-500/15 dark:border-white/10 dark:bg-white/[0.035] dark:text-white"
          />
        </div>

        <div
          id="project-filter-fields"
          className={`gap-3 sm:grid sm:grid-cols-2 lg:grid-cols-4 ${openOnMobile ? "grid" : "hidden"}`}
        >
          {/* Search — desktop copy. Hidden below `sm`, where the always-visible
              one above the disclosure takes over. */}
          <div className="relative hidden sm:block">
            <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
            <input
              type="text"
              placeholder="Search projects..."
              value={searchTerm}
              onChange={(e) => onSearchChange(e.target.value)}
              className="h-10 w-full rounded-xl border border-slate-200 bg-slate-50 pl-9 pr-3 text-sm text-slate-900 outline-none transition placeholder:text-slate-400 focus:border-blue-500 focus:bg-white focus:ring-2 focus:ring-blue-500/15 dark:border-white/10 dark:bg-white/[0.035] dark:text-white"
            />
          </div>

          {/* Type Filter */}
          <select
            value={filterType}
            onChange={(e) => onTypeChange(e.target.value)}
            className="h-10 w-full appearance-none rounded-xl border border-slate-200 bg-white px-3 pr-8 text-sm text-slate-900 outline-none transition focus:border-blue-500 focus:ring-2 focus:ring-blue-500/15 dark:border-white/10 dark:bg-[#151923] dark:text-white"
          >
            <option value="all">All Types</option>
            {projectTypes.map((type) => (
              <option key={type} value={type}>
                {type}
              </option>
            ))}
          </select>

          {/* Status Filter */}
          <select
            value={filterStatus}
            onChange={(e) => onStatusChange(e.target.value)}
            className="h-10 w-full appearance-none rounded-xl border border-slate-200 bg-white px-3 pr-8 text-sm text-slate-900 outline-none transition focus:border-blue-500 focus:ring-2 focus:ring-blue-500/15 dark:border-white/10 dark:bg-[#151923] dark:text-white"
          >
            <option value="all">All Statuses</option>
            {statuses.map((status) => (
              <option key={status} value={status}>
                {status.charAt(0).toUpperCase() + status.slice(1)}
              </option>
            ))}
          </select>

          {/* Priority Filter */}
          <select
            value={filterPriority}
            onChange={(e) => onPriorityChange(e.target.value)}
            className="h-10 w-full appearance-none rounded-xl border border-slate-200 bg-white px-3 pr-8 text-sm text-slate-900 outline-none transition focus:border-blue-500 focus:ring-2 focus:ring-blue-500/15 dark:border-white/10 dark:bg-[#151923] dark:text-white"
          >
            <option value="all">All Priorities</option>
            {priorities.map((priority) => (
              <option key={priority} value={priority}>
                {priority}
              </option>
            ))}
          </select>
        </div>

        {/* My Projects Toggle — folds away with the selects on a phone. */}
        <div className={`mt-3 items-center gap-2 sm:flex ${openOnMobile ? "flex" : "hidden"}`}>
          <label className="relative inline-flex cursor-pointer items-center">
            <input
              type="checkbox"
              checked={showMyProjectsOnly}
              onChange={(e) => onToggleMyProjects(e.target.checked)}
              className="peer sr-only"
            />
            <div className="peer h-5 w-9 rounded-full bg-slate-200 after:absolute after:left-[2px] after:top-[2px] after:h-4 after:w-4 after:rounded-full after:bg-white after:shadow-sm after:transition-all after:content-[''] peer-checked:bg-blue-600 peer-checked:after:translate-x-full dark:bg-white/10"></div>
          </label>
          <span className="text-sm text-slate-500 dark:text-slate-400">Show my projects only</span>
        </div>
      </div>
    </div>
  );
};

export default ProjectFilters;
