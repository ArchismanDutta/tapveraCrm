import React, { useState } from "react";
import { useNavigate } from "react-router-dom";
import { Building2, Filter, Search, UserPlus, Users, X } from "lucide-react";
import { formatDepartment } from "../../utils/formatters";

const EmployeeFilters = ({ filters, setFilters, canAddEmployees = false }) => {
  const navigate = useNavigate();
  const [showAdvancedFilters, setShowAdvancedFilters] = useState(false);
  const hasActiveFilters =
    filters.search || filters.department !== "all" || filters.status !== "all";

  const clearAllFilters = () =>
    setFilters({ search: "", department: "all", status: "all" });

  return (
    <div className="space-y-3">
      <div className="flex flex-col gap-3 lg:flex-row">
        <label className="relative min-w-0 flex-1">
          <span className="sr-only">Search employees</span>
          <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
          <input
            type="search"
            placeholder="Search name, ID, email, department, or designation"
            value={filters.search}
            onChange={(event) =>
              setFilters((current) => ({
                ...current,
                search: event.target.value,
              }))
            }
            className="h-10 w-full rounded-xl border border-slate-200 bg-slate-50 pl-10 pr-10 text-sm text-slate-900 outline-none transition placeholder:text-slate-400 focus:border-blue-500 focus:bg-white focus:ring-2 focus:ring-blue-500/15 dark:border-white/10 dark:bg-white/[0.035] dark:text-white"
            autoComplete="off"
          />
          {filters.search && (
            <button
              type="button"
              onClick={() =>
                setFilters((current) => ({ ...current, search: "" }))
              }
              className="absolute right-3 top-1/2 -translate-y-1/2 rounded-md p-1 text-slate-400 transition hover:bg-slate-100 hover:text-rose-600 dark:hover:bg-white/[0.05]"
              aria-label="Clear search"
            >
              <X className="h-4 w-4" />
            </button>
          )}
        </label>

        <div className="flex gap-2">
          <button
            type="button"
            onClick={() => setShowAdvancedFilters((visible) => !visible)}
            className={`inline-flex h-10 items-center justify-center gap-2 rounded-lg border px-4 text-sm font-semibold transition ${
              showAdvancedFilters
                ? "border-blue-200 bg-blue-50 text-blue-700 dark:border-blue-400/20 dark:bg-blue-400/10 dark:text-blue-200"
                : "border-slate-200 bg-white text-slate-700 hover:bg-slate-50 dark:border-white/10 dark:bg-white/[0.04] dark:text-slate-200 dark:hover:bg-white/[0.07]"
            }`}
          >
            <Filter className="h-4 w-4" /> Filters
            {hasActiveFilters && (
              <span className="h-1.5 w-1.5 rounded-full bg-blue-500" />
            )}
          </button>
          {canAddEmployees && (
            <button
              type="button"
              onClick={() =>
                navigate("/signup", { state: { fromDirectory: true } })
              }
              className="inline-flex h-10 items-center justify-center gap-2 rounded-lg bg-blue-600 px-4 text-sm font-semibold text-white transition hover:bg-blue-700"
            >
              <UserPlus className="h-4 w-4" />
              <span className="hidden sm:inline">Add employee</span>
            </button>
          )}
        </div>
      </div>

      {showAdvancedFilters && (
        <div className="rounded-xl border border-slate-200 bg-slate-50 p-4 dark:border-white/10 dark:bg-white/[0.025]">
          <div className="flex items-center justify-between gap-3">
            <h3 className="text-sm font-semibold text-slate-900 dark:text-white">
              Advanced filters
            </h3>
            {hasActiveFilters && (
              <button
                type="button"
                onClick={clearAllFilters}
                className="text-xs font-semibold text-rose-600 hover:text-rose-700 dark:text-rose-300"
              >
                Clear all
              </button>
            )}
          </div>

          <div className="mt-4 grid gap-4 md:grid-cols-2">
            <label className="block">
              <span className="mb-1.5 flex items-center gap-2 text-xs font-medium text-slate-600 dark:text-slate-300">
                <Building2 className="h-3.5 w-3.5" /> Department
              </span>
              <select
                value={filters.department}
                onChange={(event) =>
                  setFilters((current) => ({
                    ...current,
                    department: event.target.value,
                  }))
                }
                className="h-10 w-full rounded-xl border border-slate-200 bg-white px-3 text-sm text-slate-900 outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-500/15 dark:border-white/10 dark:bg-[#151923] dark:text-white"
              >
                <option value="all">All departments</option>
                <option value="executives">Executives</option>
                <option value="development">Development</option>
                <option value="marketingAndSales">Marketing & Sales</option>
                <option value="humanResource">Human Resource</option>
              </select>
            </label>

            <label className="block">
              <span className="mb-1.5 flex items-center gap-2 text-xs font-medium text-slate-600 dark:text-slate-300">
                <Users className="h-3.5 w-3.5" /> Status
              </span>
              <select
                value={filters.status}
                onChange={(event) =>
                  setFilters((current) => ({
                    ...current,
                    status: event.target.value,
                  }))
                }
                className="h-10 w-full rounded-xl border border-slate-200 bg-white px-3 text-sm text-slate-900 outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-500/15 dark:border-white/10 dark:bg-[#151923] dark:text-white"
              >
                <option value="all">All statuses</option>
                <option value="active">Active</option>
                <option value="terminated">Terminated</option>
                <option value="absconded">Absconded</option>
              </select>
            </label>
          </div>

          {hasActiveFilters && (
            <div className="mt-4 flex flex-wrap items-center gap-2 border-t border-slate-200 pt-4 dark:border-white/10">
              <span className="text-xs text-slate-500 dark:text-slate-400">
                Active filters
              </span>
              {filters.search && (
                <FilterChip
                  label={`Search: ${filters.search}`}
                  onRemove={() =>
                    setFilters((current) => ({ ...current, search: "" }))
                  }
                />
              )}
              {filters.department !== "all" && (
                <FilterChip
                  label={formatDepartment(filters.department)}
                  onRemove={() =>
                    setFilters((current) => ({
                      ...current,
                      department: "all",
                    }))
                  }
                />
              )}
              {filters.status !== "all" && (
                <FilterChip
                  label={filters.status}
                  onRemove={() =>
                    setFilters((current) => ({ ...current, status: "all" }))
                  }
                />
              )}
            </div>
          )}
        </div>
      )}
    </div>
  );
};

const FilterChip = ({ label, onRemove }) => (
  <span className="inline-flex items-center gap-1.5 rounded-full border border-blue-200 bg-blue-50 px-2.5 py-1 text-xs font-medium capitalize text-blue-700 dark:border-blue-400/20 dark:bg-blue-400/10 dark:text-blue-200">
    {label}
    <button type="button" onClick={onRemove} aria-label={`Remove ${label} filter`}>
      <X className="h-3 w-3" />
    </button>
  </span>
);

export default EmployeeFilters;
