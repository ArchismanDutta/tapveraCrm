import React, { useEffect, useMemo, useState } from "react";
import {
  AlertCircle,
  ChevronDown,
  Crown,
  Eye,
  Globe,
  Loader2,
  Mail,
  MapPin,
  User,
  X,
} from "lucide-react";
import { useNavigate } from "react-router-dom";

const statusStyles = {
  active:
    "border-emerald-200 bg-emerald-50 text-emerald-700 dark:border-emerald-400/20 dark:bg-emerald-400/10 dark:text-emerald-200",
  terminated:
    "border-rose-200 bg-rose-50 text-rose-700 dark:border-rose-400/20 dark:bg-rose-400/10 dark:text-rose-200",
  absconded:
    "border-orange-200 bg-orange-50 text-orange-700 dark:border-orange-400/20 dark:bg-orange-400/10 dark:text-orange-200",
};

const EmployeeTable = ({
  employees = [],
  currentUser,
  onStatusUpdate,
  updatingStatus,
  regions = [],
  onRegionChange,
  canManage = false,
}) => {
  const navigate = useNavigate();
  const [statusDropdownOpen, setStatusDropdownOpen] = useState(null);
  const [regionDropdownOpen, setRegionDropdownOpen] = useState(null);

  const sortedEmployees = useMemo(() => {
    const currentUserId = String(currentUser?._id || "");
    return [...employees].sort((first, second) => {
      if (first._id === currentUserId) return -1;
      if (second._id === currentUserId) return 1;
      return 0;
    });
  }, [currentUser?._id, employees]);

  useEffect(() => {
    const closeDropdowns = (event) => {
      if (!event.target.closest(".status-dropdown")) setStatusDropdownOpen(null);
      if (!event.target.closest(".region-dropdown")) setRegionDropdownOpen(null);
    };
    document.addEventListener("mousedown", closeDropdowns);
    return () => document.removeEventListener("mousedown", closeDropdowns);
  }, []);

  if (!currentUser) return null;

  const viewEmployee = (employee) => {
    if (canManage && employee?._id) navigate(`/employee/${employee._id}`);
  };

  const sharedControlProps = {
    canManage,
    regions,
    updatingStatus,
    statusDropdownOpen,
    setStatusDropdownOpen,
    regionDropdownOpen,
    setRegionDropdownOpen,
    onStatusUpdate,
    onRegionChange,
  };

  if (sortedEmployees.length === 0) {
    return (
      <div className="py-14 text-center">
        <span className="mx-auto flex h-12 w-12 items-center justify-center rounded-xl bg-slate-100 text-slate-400 dark:bg-white/[0.05]">
          <User className="h-5 w-5" />
        </span>
        <h3 className="mt-4 text-sm font-semibold text-slate-900 dark:text-white">
          No employees found
        </h3>
        <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">
          Try changing the search term or filters.
        </p>
      </div>
    );
  }

  return (
    <div>
      <div className="space-y-3 md:hidden">
        {sortedEmployees.map((employee) => {
          const isCurrentUser = employee._id === String(currentUser._id);
          return (
            <article
              key={employee._id}
              onClick={() => viewEmployee(employee)}
              className={`rounded-xl border p-4 transition ${
                canManage ? "cursor-pointer" : ""
              } ${
                isCurrentUser
                  ? "border-blue-200 bg-blue-50/60 dark:border-blue-400/20 dark:bg-blue-400/[0.06]"
                  : "border-slate-200 hover:border-slate-300 dark:border-white/10 dark:hover:border-white/20"
              }`}
            >
              <div className="flex items-start justify-between gap-3">
                <EmployeeIdentity employee={employee} isCurrentUser={isCurrentUser} />
                <StatusControl employee={employee} {...sharedControlProps} />
              </div>
              <div className="mt-4 grid grid-cols-2 gap-3 border-t border-slate-200 pt-3 text-xs dark:border-white/10">
                <Detail label="Department" value={employee.department || "N/A"} />
                <Detail label="Position" value={employee.designation || "N/A"} />
              </div>
              <div className="mt-4 flex items-center justify-between gap-3">
                <RegionControl employee={employee} {...sharedControlProps} />
                <EmployeeAction employee={employee} canManage={canManage} onView={viewEmployee} />
              </div>
            </article>
          );
        })}
      </div>

      <div className="hidden overflow-hidden rounded-xl border border-slate-200 dark:border-white/10 md:block">
        <div className="max-h-[650px] overflow-auto">
          <table className="w-full min-w-[1080px] text-left">
            <thead className="sticky top-0 z-10 bg-slate-50 dark:bg-[#151923]">
              <tr className="border-b border-slate-200 dark:border-white/10">
                {["Employee", "Contact", "Department", "Position", "Region", "Status", ""].map(
                  (heading) => (
                    <th
                      key={heading || "actions"}
                      className="px-4 py-3 text-[11px] font-semibold uppercase tracking-wider text-slate-500 dark:text-slate-400"
                    >
                      {heading}
                    </th>
                  ),
                )}
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-200 dark:divide-white/10">
              {sortedEmployees.map((employee) => {
                const isCurrentUser = employee._id === String(currentUser._id);
                return (
                  <tr
                    key={employee._id}
                    onClick={() => viewEmployee(employee)}
                    className={`transition ${canManage ? "cursor-pointer" : ""} ${
                      isCurrentUser
                        ? "bg-blue-50/60 dark:bg-blue-400/[0.05]"
                        : "hover:bg-slate-50 dark:hover:bg-white/[0.025]"
                    }`}
                  >
                    <td className="px-4 py-3.5">
                      <EmployeeIdentity employee={employee} isCurrentUser={isCurrentUser} />
                    </td>
                    <td className="px-4 py-3.5">
                      <div className="flex items-center gap-2 text-sm text-slate-600 dark:text-slate-300">
                        <Mail className="h-3.5 w-3.5 shrink-0 text-slate-400" />
                        <span className="max-w-52 truncate">{employee.email || "—"}</span>
                      </div>
                    </td>
                    <td className="px-4 py-3.5 text-sm font-medium text-slate-700 dark:text-slate-200">
                      {employee.department || "N/A"}
                    </td>
                    <td className="px-4 py-3.5 text-sm text-slate-600 dark:text-slate-300">
                      {employee.designation || "N/A"}
                    </td>
                    <td className="px-4 py-3.5">
                      <RegionControl employee={employee} {...sharedControlProps} />
                    </td>
                    <td className="px-4 py-3.5">
                      <StatusControl employee={employee} {...sharedControlProps} />
                    </td>
                    <td className="px-4 py-3.5 text-right">
                      <EmployeeAction employee={employee} canManage={canManage} onView={viewEmployee} />
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>

      <div className="mt-3 flex flex-col gap-2 text-xs text-slate-500 dark:text-slate-400 sm:flex-row sm:items-center sm:justify-between">
        <span>
          Showing {sortedEmployees.length} employee
          {sortedEmployees.length === 1 ? "" : "s"}
        </span>
        <div className="flex flex-wrap gap-3">
          {[
            ["Active", "active", "bg-emerald-500"],
            ["Terminated", "terminated", "bg-rose-500"],
            ["Absconded", "absconded", "bg-orange-500"],
          ].map(([label, status, dot]) => (
            <span key={status} className="inline-flex items-center gap-1.5">
              <span className={`h-1.5 w-1.5 rounded-full ${dot}`} />
              {sortedEmployees.filter((employee) => employee.status?.toLowerCase() === status).length} {label}
            </span>
          ))}
        </div>
      </div>
    </div>
  );
};

const EmployeeIdentity = ({ employee, isCurrentUser }) => (
  <div className="flex min-w-0 items-center gap-3">
    <span className="relative flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-gradient-to-br from-blue-500 to-indigo-600 text-sm font-semibold text-white">
      {employee.name?.charAt(0)?.toUpperCase() || "?"}
      {isCurrentUser && (
        <span className="absolute -right-0.5 -top-0.5 flex h-4 w-4 items-center justify-center rounded-full bg-amber-400 ring-2 ring-white dark:ring-[#10131c]">
          <Crown className="h-2.5 w-2.5 text-white" />
        </span>
      )}
    </span>
    <div className="min-w-0">
      <p className="truncate text-sm font-semibold text-slate-900 dark:text-white">
        {employee.name} {isCurrentUser && <span className="text-xs font-medium text-blue-600 dark:text-blue-300">(You)</span>}
      </p>
      <p className="truncate text-xs text-slate-500 dark:text-slate-400">
        ID: {employee.employeeId || "—"}
      </p>
    </div>
  </div>
);

const Detail = ({ label, value }) => (
  <div className="min-w-0">
    <p className="text-slate-400">{label}</p>
    <p className="mt-1 truncate font-medium text-slate-700 dark:text-slate-200">{value}</p>
  </div>
);

const getEmployeeRegions = (employee) =>
  employee.regions?.length ? employee.regions : [employee.region || "Global"];

const RegionControl = ({
  employee,
  canManage,
  regions,
  regionDropdownOpen,
  setRegionDropdownOpen,
  onRegionChange,
}) => {
  const employeeRegions = getEmployeeRegions(employee);
  return (
    <div className="region-dropdown relative" onClick={(event) => event.stopPropagation()}>
      <div className="flex flex-wrap items-center gap-1">
        {employeeRegions.map((region) => (
          <span
            key={region}
            className="inline-flex items-center gap-1 rounded-full border border-blue-200 bg-blue-50 px-2 py-0.5 text-[11px] font-medium text-blue-700 dark:border-blue-400/20 dark:bg-blue-400/10 dark:text-blue-200"
          >
            {region === "Global" ? <Globe className="h-3 w-3" /> : <MapPin className="h-3 w-3" />}
            {region}
          </span>
        ))}
        {canManage && (
          <button
            type="button"
            onClick={() =>
              setRegionDropdownOpen(
                regionDropdownOpen === employee._id ? null : employee._id,
              )
            }
            className="rounded-md border border-slate-200 p-1 text-slate-400 transition hover:bg-slate-50 hover:text-slate-700 dark:border-white/10 dark:hover:bg-white/[0.05] dark:hover:text-white"
            aria-label={`Edit regions for ${employee.name}`}
          >
            <ChevronDown className="h-3 w-3" />
          </button>
        )}
      </div>

      {canManage && regionDropdownOpen === employee._id && (
        <div className="absolute left-0 top-full z-40 mt-2 min-w-52 rounded-xl border border-slate-200 bg-white p-2 shadow-xl dark:border-slate-700 dark:bg-slate-900">
          <p className="px-2 py-1 text-xs font-semibold text-slate-500 dark:text-slate-400">Assigned regions</p>
          {regions.map((region) => (
            <label key={region} className="flex cursor-pointer items-center gap-2 rounded-lg px-2 py-2 text-sm text-slate-700 hover:bg-slate-50 dark:text-slate-200 dark:hover:bg-slate-800">
              <input
                type="checkbox"
                checked={employeeRegions.includes(region)}
                onChange={() => onRegionChange?.(employee._id, region)}
                className="h-4 w-4 rounded border-slate-300 text-blue-600 focus:ring-blue-500"
              />
              {region === "Global" ? <Globe className="h-3.5 w-3.5" /> : <MapPin className="h-3.5 w-3.5" />}
              {region}
            </label>
          ))}
          <button type="button" onClick={() => setRegionDropdownOpen(null)} className="mt-1 h-8 w-full rounded-lg bg-blue-600 text-xs font-semibold text-white hover:bg-blue-700">Done</button>
        </div>
      )}
    </div>
  );
};

const StatusControl = ({
  employee,
  canManage,
  updatingStatus,
  statusDropdownOpen,
  setStatusDropdownOpen,
  onStatusUpdate,
}) => {
  const status = employee.status?.toLowerCase() || "active";
  return (
    <div className="status-dropdown relative" onClick={(event) => event.stopPropagation()}>
      <button
        type="button"
        disabled={!canManage || updatingStatus === employee._id}
        onClick={() =>
          setStatusDropdownOpen(
            statusDropdownOpen === employee._id ? null : employee._id,
          )
        }
        className={`inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-xs font-semibold capitalize transition disabled:cursor-default ${
          statusStyles[status] ||
          "border-slate-200 bg-slate-100 text-slate-600 dark:border-white/10 dark:bg-white/[0.05] dark:text-slate-300"
        }`}
      >
        {updatingStatus === employee._id ? (
          <Loader2 className="h-3 w-3 animate-spin" />
        ) : status === "terminated" ? (
          <X className="h-3 w-3" />
        ) : status === "absconded" ? (
          <AlertCircle className="h-3 w-3" />
        ) : (
          <span className="h-1.5 w-1.5 rounded-full bg-current" />
        )}
        {status}
        {canManage && updatingStatus !== employee._id && <ChevronDown className="h-3 w-3" />}
      </button>

      {canManage && statusDropdownOpen === employee._id && (
        <div className="absolute right-0 top-full z-40 mt-2 min-w-36 overflow-hidden rounded-xl border border-slate-200 bg-white p-1 shadow-xl dark:border-slate-700 dark:bg-slate-900">
          {["active", "terminated", "absconded"].map((nextStatus) => (
            <button
              key={nextStatus}
              type="button"
              onClick={() => {
                onStatusUpdate?.(employee._id, nextStatus);
                setStatusDropdownOpen(null);
              }}
              className={`flex w-full items-center gap-2 rounded-lg px-3 py-2 text-left text-sm capitalize transition ${
                status === nextStatus
                  ? "bg-blue-50 text-blue-700 dark:bg-blue-950/40 dark:text-blue-200"
                  : "text-slate-700 hover:bg-slate-50 dark:text-slate-200 dark:hover:bg-slate-800"
              }`}
            >
              <span className={`h-2 w-2 rounded-full ${nextStatus === "active" ? "bg-emerald-500" : nextStatus === "terminated" ? "bg-rose-500" : "bg-orange-500"}`} />
              {nextStatus}
            </button>
          ))}
        </div>
      )}
    </div>
  );
};

const EmployeeAction = ({ employee, canManage, onView }) =>
  canManage ? (
    <button
      type="button"
      onClick={(event) => {
        event.stopPropagation();
        onView(employee);
      }}
      className="inline-flex h-9 items-center gap-2 rounded-lg border border-slate-200 bg-white px-3 text-xs font-semibold text-slate-700 transition hover:bg-slate-50 dark:border-white/10 dark:bg-white/[0.04] dark:text-slate-200 dark:hover:bg-white/[0.07]"
    >
      <Eye className="h-3.5 w-3.5" /> View
    </button>
  ) : (
    <a
      href={`mailto:${employee.email}`}
      onClick={(event) => event.stopPropagation()}
      className="inline-flex h-9 items-center gap-2 rounded-lg border border-slate-200 bg-white px-3 text-xs font-semibold text-slate-700 transition hover:bg-slate-50 dark:border-white/10 dark:bg-white/[0.04] dark:text-slate-200 dark:hover:bg-white/[0.07]"
    >
      <Mail className="h-3.5 w-3.5" /> Email
    </a>
  );

export default EmployeeTable;
