import React, { useState } from "react";
import { useNavigate } from "react-router-dom";
import { Building2, Filter, Search, UserPlus, Users, X } from "lucide-react";
import { formatDepartment } from "../../utils/formatters";

const EmployeeFilters = ({ filters, setFilters, canAddEmployees = false }) => {
  const navigate = useNavigate();
  const hasActiveFilters =
    filters.search || filters.department !== "all" || filters.status !== "all";

  const clearAllFilters = () =>
    setFilters({ search: "", department: "all", status: "all" });

  const departments = [
    { value: "all", label: "All" },
    { value: "executives", label: "Executives" },
    { value: "development", label: "Development" },
    { value: "marketingAndSales", label: "Sales" },
    { value: "humanResource", label: "HR" },
  ];

  const statuses = [
    { value: "all", label: "All" },
    { value: "active", label: "Active" },
    { value: "terminated", label: "Terminated" },
    { value: "absconded", label: "Absconded" },
  ];

  return (
    <div className="space-y-2">
      <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
        <label className="relative min-w-0 flex-1">
          <span className="sr-only">Search employees</span>
          <Search className="pointer-events-none absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-slate-400" />
          <input
            type="search"
            placeholder="Search name, ID, email..."
            value={filters.search}
            onChange={(event) =>
              setFilters((current) => ({
                ...current,
                search: event.target.value,
              }))
            }
            className="h-8 w-full rounded-lg border border-slate-200 bg-slate-50 pl-8 pr-8 text-xs text-slate-900 outline-none transition placeholder:text-slate-400 focus:border-blue-500 focus:bg-white focus:ring-1 focus:ring-blue-500/15 dark:border-white/10 dark:bg-white/[0.035] dark:text-white"
            autoComplete="off"
          />
          {filters.search && (
            <button
              type="button"
              onClick={() =>
                setFilters((current) => ({ ...current, search: "" }))
              }
              className="absolute right-2 top-1/2 -translate-y-1/2 rounded p-0.5 text-slate-400 transition hover:bg-slate-100 hover:text-rose-600 dark:hover:bg-white/[0.05]"
              aria-label="Clear search"
            >
              <X className="h-3 w-3" />
            </button>
          )}
        </label>

        {canAddEmployees && (
          <button
            type="button"
            onClick={() =>
              navigate("/signup", { state: { fromDirectory: true } })
            }
            className="inline-flex h-8 items-center justify-center gap-1.5 rounded-lg bg-blue-600 px-3 text-xs font-semibold text-white transition hover:bg-blue-700"
          >
            <UserPlus className="h-3.5 w-3.5" />
            <span className="hidden sm:inline">Add employee</span>
          </button>
        )}
      </div>

      {/* Tag-based Filters */}
      <div className="flex flex-wrap items-center gap-2">
        {/* Department Tags */}
        <div className="flex items-center gap-1">
          <Building2 className="h-3 w-3 text-slate-400" />
          {departments.map((dept) => (
            <button
              key={dept.value}
              type="button"
              onClick={() =>
                setFilters((current) => ({
                  ...current,
                  department: dept.value,
                }))
              }
              className={`rounded-md px-2 py-0.5 text-[11px] font-medium transition ${
                filters.department === dept.value
                  ? "bg-blue-600 text-white"
                  : "border border-slate-200 bg-white text-slate-600 hover:bg-slate-50 dark:border-white/10 dark:bg-white/[0.04] dark:text-slate-300 dark:hover:bg-white/[0.07]"
              }`}
            >
              {dept.label}
            </button>
          ))}
        </div>

        {/* Status Tags */}
        <div className="flex items-center gap-1">
          <Users className="h-3 w-3 text-slate-400" />
          {statuses.map((status) => (
            <button
              key={status.value}
              type="button"
              onClick={() =>
                setFilters((current) => ({
                  ...current,
                  status: status.value,
                }))
              }
              className={`rounded-md px-2 py-0.5 text-[11px] font-medium transition ${
                filters.status === status.value
                  ? "bg-blue-600 text-white"
                  : "border border-slate-200 bg-white text-slate-600 hover:bg-slate-50 dark:border-white/10 dark:bg-white/[0.04] dark:text-slate-300 dark:hover:bg-white/[0.07]"
              }`}
            >
              {status.label}
            </button>
          ))}
        </div>

        {/* Clear All */}
        {hasActiveFilters && (
          <button
            type="button"
            onClick={clearAllFilters}
            className="ml-auto text-[11px] font-semibold text-rose-600 hover:text-rose-700 dark:text-rose-400"
          >
            Clear all
          </button>
        )}
      </div>
    </div>
  );
};

export default EmployeeFilters;
