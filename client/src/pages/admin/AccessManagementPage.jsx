import React, { useState, useEffect, useMemo } from "react";
import API from "../../api";
import Sidebar from "../../components/dashboard/Sidebar";
import {
  AlertCircle,
  Briefcase,
  Building2,
  Check,
  ChevronRight,
  Edit2,
  Eye,
  Network,
  Plus,
  Search,
  Shield,
  Trash2,
  UserCog,
  Users,
  X,
} from "lucide-react";

// ============================================================================
// Access-management rework (2026-07-03)
// See docs/superpowers/specs/2026-07-03-access-management-design.md
//      docs/superpowers/plans/2026-07-03-access-management-rework.md
//
// Supersedes PositionManagement.jsx (kept alive in parallel until Phase 4/5
// of the rework are complete and verified, per the plan's rollback strategy
// - do not delete PositionManagement.jsx yet).
//
// Four tabs: Departments / Positions & Permissions / Assign Employees /
// Access Overview. Unlike PositionManagement.jsx, this exposes the FULL
// permission surface (previously only 8 of ~17 flags were editable) plus
// department references and the parentPosition hierarchy chain.
// ============================================================================

// ---- Full permission surface, grouped for the editor ----
const PERMISSION_GROUPS = [
  {
    label: "Business management",
    keys: {
      canManageUsers: "Manage users",
      canManageClients: "Manage clients",
      canManageProjects: "Manage projects",
      canAssignTasks: "Assign tasks",
      canViewCommunicationTracking: "View project communication tracking",
    },
  },
  {
    label: "HR & operations",
    keys: {
      canApproveLeaves: "Approve leaves",
      canApproveShifts: "Approve shifts",
      canViewReports: "View reports",
      canManageAttendance: "Manage attendance",
      canManageSalary: "Manage salary",
    },
  },
  {
    label: "Subordinate access",
    keys: {
      canViewSubordinateLeads: "View subordinates' leads",
      canEditSubordinateLeads: "Edit subordinates' leads",
      canViewSubordinateCallbacks: "View subordinates' callbacks",
      canEditSubordinateCallbacks: "Edit subordinates' callbacks",
      canViewSubordinateTasks: "View subordinates' tasks",
      canViewSubordinateProjects: "View subordinates' projects",
      canAssignToSubordinates: "Assign work to subordinates",
    },
  },
  {
    label: "Department-wide access",
    keys: {
      canViewDepartmentLeads: "View department leads",
      canViewDepartmentCallbacks: "View department callbacks",
      canViewDepartmentTasks: "View department tasks",
    },
  },
  {
    label: "Access management",
    keys: {
      canManageDepartments: "Manage departments",
      canManagePositions: "Manage positions & permissions",
      // Role & Department Hierarchy Revamp v2 (2026-07-27): lets this
      // Position's holder open "My Team's Access" — a scoped editor over
      // their own subordinates' permissions (ceiling/scope/audit-logged,
      // see server/utils/accessControl.js's canManageAccessFor). Seeded
      // true on Admin only for now; any Position can get it from here.
      canManageSubordinateAccess: "Delegate access to subordinates (My Team's Access)",
    },
  },
];

const ALL_PERMISSION_KEYS = PERMISSION_GROUPS.flatMap((g) => Object.keys(g.keys));
const PERMISSION_LABELS = PERMISSION_GROUPS.reduce(
  (acc, g) => ({ ...acc, ...g.keys }),
  {}
);

const emptyPermissions = () =>
  ALL_PERMISSION_KEYS.reduce((acc, key) => ({ ...acc, [key]: false }), {});

const emptyPositionForm = () => ({
  name: "",
  level: 50,
  departmentRef: "",
  parentPosition: "",
  description: "",
  permissions: emptyPermissions(),
  hierarchicalAccess: {
    dataScope: "own",
    accessLowerLevels: false,
    minimumLevelGap: 0,
    canAccessPositions: [],
  },
});

const emptyDepartmentForm = () => ({ name: "", code: "", description: "" });

const fieldClass =
  "h-10 w-full rounded-xl border border-slate-200 bg-slate-50 px-3 text-sm text-slate-900 outline-none transition placeholder:text-slate-400 focus:border-blue-500 focus:bg-white focus:ring-2 focus:ring-blue-500/15 dark:border-white/10 dark:bg-white/[0.035] dark:text-white dark:focus:bg-white/[0.05]";

// ============================================================================
// Shared small building blocks
// ============================================================================

const SearchField = ({ value, onChange, placeholder }) => (
  <label className="relative block w-full sm:max-w-md">
    <span className="sr-only">{placeholder}</span>
    <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
    <input
      type="search"
      value={value}
      onChange={(event) => onChange(event.target.value)}
      placeholder={placeholder}
      className="h-10 w-full rounded-xl border border-slate-200 bg-slate-50 pl-10 pr-3 text-sm text-slate-900 outline-none transition placeholder:text-slate-400 focus:border-blue-500 focus:bg-white focus:ring-2 focus:ring-blue-500/15 dark:border-white/10 dark:bg-white/[0.035] dark:text-white"
    />
  </label>
);

const EmptyState = ({ title, description }) => (
  <div className="py-14 text-center">
    <span className="mx-auto flex h-12 w-12 items-center justify-center rounded-xl bg-slate-100 text-slate-400 dark:bg-white/[0.05]">
      <Search className="h-5 w-5" />
    </span>
    <h3 className="mt-4 text-sm font-semibold text-slate-900 dark:text-white">{title}</h3>
    <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">{description}</p>
  </div>
);

const LoadingRows = () => (
  <div className="mt-4 space-y-3">
    {[0, 1, 2, 3].map((item) => (
      <div key={item} className="h-16 animate-pulse rounded-xl bg-slate-100 dark:bg-white/[0.04]" />
    ))}
  </div>
);

const LevelBadge = ({ level }) => (
  <span className="whitespace-nowrap rounded-full border border-violet-200 bg-violet-50 px-2.5 py-1 text-[11px] font-semibold text-violet-700 dark:border-violet-400/20 dark:bg-violet-400/10 dark:text-violet-200">
    Level {level}
  </span>
);

const StatusBadge = ({ status }) => (
  <span
    className={`whitespace-nowrap rounded-full border px-2.5 py-1 text-[11px] font-semibold ${
      status === "active"
        ? "border-emerald-200 bg-emerald-50 text-emerald-700 dark:border-emerald-400/20 dark:bg-emerald-400/10 dark:text-emerald-200"
        : "border-slate-200 bg-slate-50 text-slate-500 dark:border-white/10 dark:bg-white/[0.04] dark:text-slate-400"
    }`}
  >
    {status || "active"}
  </span>
);

const RowActions = ({ onEdit, onDelete, onView, deleteTitle = "Delete" }) => (
  <div className="flex justify-end gap-2">
    {onView && (
      <button type="button" onClick={onView} className="rounded-lg bg-slate-50 p-2 text-slate-600 transition hover:bg-slate-100 dark:bg-white/[0.04] dark:text-slate-300" aria-label="View">
        <Eye className="h-4 w-4" />
      </button>
    )}
    {onEdit && (
      <button type="button" onClick={onEdit} className="rounded-lg bg-blue-50 p-2 text-blue-700 transition hover:bg-blue-100 dark:bg-blue-400/10 dark:text-blue-300" aria-label="Edit">
        <Edit2 className="h-4 w-4" />
      </button>
    )}
    {onDelete && (
      <button type="button" onClick={onDelete} className="rounded-lg bg-rose-50 p-2 text-rose-700 transition hover:bg-rose-100 dark:bg-rose-400/10 dark:text-rose-300" aria-label={deleteTitle} title={deleteTitle}>
        <Trash2 className="h-4 w-4" />
      </button>
    )}
  </div>
);

const ModalShell = ({ title, description, onClose, children, maxWidth = "max-w-2xl" }) => (
  <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/60 p-4 backdrop-blur-sm">
    <section
      className={`max-h-[90vh] w-full ${maxWidth} overflow-y-auto rounded-2xl border border-slate-200 bg-white shadow-2xl dark:border-white/10 dark:bg-[#10131c]`}
      role="dialog"
      aria-modal="true"
    >
      <header className="sticky top-0 z-10 flex items-start justify-between gap-4 border-b border-slate-200 bg-white/95 px-5 py-4 backdrop-blur dark:border-white/10 dark:bg-[#10131c]/95">
        <div>
          <h2 className="text-base font-semibold text-slate-950 dark:text-white">{title}</h2>
          {description && <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">{description}</p>}
        </div>
        <button type="button" onClick={onClose} className="rounded-lg p-1.5 text-slate-400 transition hover:bg-slate-100 hover:text-slate-900 dark:hover:bg-white/[0.06] dark:hover:text-white" aria-label="Close dialog">
          <X className="h-5 w-5" />
        </button>
      </header>
      {children}
    </section>
  </div>
);

// ============================================================================
// Departments tab
// ============================================================================

const DepartmentsPanel = ({ departments, stats, query, setQuery, loading, onCreate, onEdit, onToggleStatus }) => {
  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return departments;
    return departments.filter((d) => [d.name, d.code, d.description].some((v) => v?.toLowerCase().includes(q)));
  }, [departments, query]);

  const statsByCode = useMemo(() => {
    const map = new Map();
    (stats?.departments || []).forEach((s) => map.set(s.departmentId, s));
    return map;
  }, [stats]);

  return (
    <div>
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <SearchField value={query} onChange={setQuery} placeholder="Search departments" />
        <button type="button" onClick={onCreate} className="inline-flex h-10 items-center justify-center gap-2 rounded-lg bg-blue-600 px-4 text-sm font-semibold text-white transition hover:bg-blue-700">
          <Plus className="h-4 w-4" /> Add department
        </button>
      </div>
      <p className="mt-3 text-xs text-slate-500 dark:text-slate-400">Showing {filtered.length} of {departments.length} departments</p>

      {loading ? (
        <LoadingRows />
      ) : filtered.length === 0 ? (
        <EmptyState title="No departments found" description={query ? "Try a different search term." : "Create your first department."} />
      ) : (
        <div className="mt-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {filtered.map((dept) => {
            const s = statsByCode.get(dept._id);
            return (
              <article key={dept._id} className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm dark:border-white/10 dark:bg-[#10131c]">
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <h3 className="truncate text-sm font-semibold text-slate-900 dark:text-white">{dept.name}</h3>
                    <p className="mt-0.5 text-xs text-slate-400 dark:text-slate-500">code: {dept.code}</p>
                  </div>
                  <StatusBadge status={dept.status} />
                </div>
                <p className="mt-3 line-clamp-2 text-sm text-slate-600 dark:text-slate-300">{dept.description || "No description"}</p>
                <div className="mt-4 flex items-center gap-4 border-t border-slate-200 pt-3 text-xs text-slate-500 dark:border-white/10 dark:text-slate-400">
                  <span>{s?.positionCount ?? "—"} positions</span>
                  <span>{s?.memberCount ?? "—"} members</span>
                </div>
                <div className="mt-3 flex justify-end gap-2">
                  <button
                    type="button"
                    onClick={() => onToggleStatus(dept)}
                    className="rounded-lg border border-slate-200 px-2.5 py-1.5 text-xs font-medium text-slate-600 transition hover:bg-slate-50 dark:border-white/10 dark:text-slate-300 dark:hover:bg-white/[0.05]"
                  >
                    {dept.status === "active" ? "Deactivate" : "Activate"}
                  </button>
                  <RowActions onEdit={() => onEdit(dept)} />
                </div>
              </article>
            );
          })}
        </div>
      )}
    </div>
  );
};

const DepartmentModal = ({ editing, form, setForm, loading, onClose, onSubmit }) => (
  <ModalShell
    title={editing ? "Edit department" : "Add department"}
    description="Departments are shared across positions and employee assignment - renaming here does not require a code deploy."
    onClose={onClose}
    maxWidth="max-w-lg"
  >
    <form onSubmit={onSubmit} className="space-y-4 p-5">
      <label className="block">
        <span className="mb-1.5 block text-xs font-medium text-slate-600 dark:text-slate-300">Name</span>
        <input
          type="text"
          value={form.name}
          onChange={(e) => setForm((c) => ({ ...c, name: e.target.value }))}
          className={fieldClass}
          placeholder="e.g. Tech"
          required
        />
      </label>
      <label className="block">
        <span className="mb-1.5 block text-xs font-medium text-slate-600 dark:text-slate-300">Code</span>
        <input
          type="text"
          value={form.code}
          onChange={(e) => setForm((c) => ({ ...c, code: e.target.value }))}
          className={fieldClass}
          placeholder="e.g. tech"
          required
          disabled={Boolean(editing)}
        />
        {editing && <p className="mt-1 text-[11px] text-slate-400">Code can't be changed once other records reference it.</p>}
      </label>
      <label className="block">
        <span className="mb-1.5 block text-xs font-medium text-slate-600 dark:text-slate-300">Description</span>
        <textarea
          value={form.description}
          onChange={(e) => setForm((c) => ({ ...c, description: e.target.value }))}
          className={`${fieldClass} min-h-20 resize-y py-3`}
          rows={3}
        />
      </label>
      <div className="flex justify-end gap-3 border-t border-slate-200 pt-4 dark:border-white/10">
        <button type="button" onClick={onClose} disabled={loading} className="h-10 rounded-lg border border-slate-200 px-4 text-sm font-semibold text-slate-700 transition hover:bg-slate-50 disabled:opacity-50 dark:border-white/10 dark:text-slate-200 dark:hover:bg-white/[0.05]">
          Cancel
        </button>
        <button type="submit" disabled={loading} className="inline-flex h-10 items-center justify-center gap-2 rounded-lg bg-blue-600 px-4 text-sm font-semibold text-white transition hover:bg-blue-700 disabled:opacity-50">
          {loading && <span className="h-4 w-4 animate-spin rounded-full border-2 border-white/30 border-t-white" />}
          {loading ? "Saving..." : editing ? "Update department" : "Create department"}
        </button>
      </div>
    </form>
  </ModalShell>
);

// ============================================================================
// Positions & Permissions tab
// ============================================================================

const PositionsPanel = ({ positions, query, setQuery, loading, onCreate, onEdit, onDelete }) => {
  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return positions;
    return positions.filter((p) =>
      [p.name, p.description, p.departmentRef?.name, p.department].some((v) => v?.toLowerCase().includes(q))
    );
  }, [positions, query]);

  return (
    <div>
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <SearchField value={query} onChange={setQuery} placeholder="Search positions" />
        <button type="button" onClick={onCreate} className="inline-flex h-10 items-center justify-center gap-2 rounded-lg bg-blue-600 px-4 text-sm font-semibold text-white transition hover:bg-blue-700">
          <Plus className="h-4 w-4" /> Create position
        </button>
      </div>
      <p className="mt-3 text-xs text-slate-500 dark:text-slate-400">Showing {filtered.length} of {positions.length} positions</p>

      {loading ? (
        <LoadingRows />
      ) : filtered.length === 0 ? (
        <EmptyState title="No positions found" description={query ? "Try a different search term." : "Create the first organizational position."} />
      ) : (
        <div className="mt-5 hidden overflow-hidden rounded-xl border border-slate-200 dark:border-white/10 xl:block">
          <div className="overflow-x-auto">
            <table className="w-full min-w-[950px] text-left">
              <thead className="bg-slate-50 dark:bg-white/[0.025]">
                <tr className="border-b border-slate-200 dark:border-white/10">
                  {["Position", "Level", "Department", "Reports to", "Scope", "Permissions", ""].map((h) => (
                    <th key={h || "actions"} className="px-4 py-3 text-[11px] font-semibold uppercase tracking-wider text-slate-500 dark:text-slate-400">
                      {h}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-200 dark:divide-white/10">
                {filtered
                  .slice()
                  .sort((a, b) => b.level - a.level)
                  .map((position) => (
                    <tr key={position._id} className="transition hover:bg-slate-50 dark:hover:bg-white/[0.025]">
                      <td className="px-4 py-3.5 text-sm font-semibold text-slate-900 dark:text-white">{position.name}</td>
                      <td className="px-4 py-3.5"><LevelBadge level={position.level} /></td>
                      <td className="px-4 py-3.5 text-sm capitalize text-slate-600 dark:text-slate-300">
                        {position.departmentRef?.name || position.department || "All"}
                      </td>
                      <td className="px-4 py-3.5 text-sm text-slate-600 dark:text-slate-300">
                        {position.parentPosition?.name || <span className="text-slate-400">—</span>}
                      </td>
                      <td className="px-4 py-3.5 text-xs capitalize text-slate-500 dark:text-slate-400">
                        {position.hierarchicalAccess?.dataScope || "own"}
                      </td>
                      <td className="px-4 py-3.5 text-xs text-slate-500 dark:text-slate-400">
                        {Object.values(position.permissions || {}).filter(Boolean).length} enabled
                      </td>
                      <td className="px-4 py-3.5">
                        <RowActions onEdit={() => onEdit(position)} onDelete={() => onDelete(position)} />
                      </td>
                    </tr>
                  ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {!loading && filtered.length > 0 && (
        <div className="mt-5 space-y-4 xl:hidden">
          {filtered.map((position) => (
            <article key={position._id} className="rounded-xl border border-slate-200 p-4 dark:border-white/10">
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <h3 className="truncate text-sm font-semibold text-slate-900 dark:text-white">{position.name}</h3>
                  <p className="mt-1 truncate text-xs text-slate-500 dark:text-slate-400">
                    {position.departmentRef?.name || position.department || "All departments"}
                    {position.parentPosition?.name ? ` · reports to ${position.parentPosition.name}` : ""}
                  </p>
                </div>
                <LevelBadge level={position.level} />
              </div>
              <div className="mt-3 flex items-center justify-between border-t border-slate-200 pt-3 dark:border-white/10">
                <span className="text-xs text-slate-500 dark:text-slate-400">
                  {Object.values(position.permissions || {}).filter(Boolean).length} permissions · {position.hierarchicalAccess?.dataScope || "own"} scope
                </span>
                <RowActions onEdit={() => onEdit(position)} onDelete={() => onDelete(position)} />
              </div>
            </article>
          ))}
        </div>
      )}
    </div>
  );
};

const PositionModal = ({ editing, form, setForm, departments, positions, loading, onClose, onSubmit }) => {
  const togglePermission = (key) =>
    setForm((c) => ({ ...c, permissions: { ...c.permissions, [key]: !c.permissions[key] } }));

  const toggleAccessPosition = (name) =>
    setForm((c) => {
      const current = c.hierarchicalAccess.canAccessPositions || [];
      const next = current.includes(name) ? current.filter((n) => n !== name) : [...current, name];
      return { ...c, hierarchicalAccess: { ...c.hierarchicalAccess, canAccessPositions: next } };
    });

  const parentCandidates = positions.filter((p) => p._id !== editing?._id);

  return (
    <ModalShell
      title={editing ? "Edit position" : "Create position"}
      description="Set the hierarchy, department, and every permission this position grants — nothing here requires editing the database directly."
      onClose={onClose}
      maxWidth="max-w-3xl"
    >
      <form onSubmit={onSubmit} className="space-y-5 p-5">
        <div className="grid gap-4 sm:grid-cols-2">
          <label className="block">
            <span className="mb-1.5 block text-xs font-medium text-slate-600 dark:text-slate-300">Position name</span>
            <input
              type="text"
              value={form.name}
              onChange={(e) => setForm((c) => ({ ...c, name: e.target.value }))}
              className={fieldClass}
              placeholder="e.g. Team Lead — Tech"
              required
            />
          </label>
          <label className="block">
            <span className="mb-1.5 block text-xs font-medium text-slate-600 dark:text-slate-300">Level (0–100)</span>
            <input
              type="number"
              min="0"
              max="100"
              value={form.level}
              onChange={(e) => setForm((c) => ({ ...c, level: Number.parseInt(e.target.value, 10) || 0 }))}
              className={fieldClass}
              required
            />
          </label>
        </div>

        <div className="grid gap-4 sm:grid-cols-2">
          <label className="block">
            <span className="mb-1.5 block text-xs font-medium text-slate-600 dark:text-slate-300">Department</span>
            <select
              value={form.departmentRef}
              onChange={(e) => setForm((c) => ({ ...c, departmentRef: e.target.value }))}
              className={`${fieldClass} dark:bg-[#151923]`}
            >
              <option value="">All departments</option>
              {departments.map((d) => (
                <option key={d._id} value={d._id}>{d.name}</option>
              ))}
            </select>
          </label>
          <label className="block">
            <span className="mb-1.5 block text-xs font-medium text-slate-600 dark:text-slate-300">Reports to (parent position)</span>
            <select
              value={form.parentPosition}
              onChange={(e) => setForm((c) => ({ ...c, parentPosition: e.target.value }))}
              className={`${fieldClass} dark:bg-[#151923]`}
            >
              <option value="">None (top-level)</option>
              {parentCandidates.map((p) => (
                <option key={p._id} value={p._id}>{p.name} (Level {p.level})</option>
              ))}
            </select>
          </label>
        </div>

        <label className="block">
          <span className="mb-1.5 block text-xs font-medium text-slate-600 dark:text-slate-300">Description</span>
          <textarea
            value={form.description}
            onChange={(e) => setForm((c) => ({ ...c, description: e.target.value }))}
            className={`${fieldClass} min-h-20 resize-y py-3`}
            rows={2}
          />
        </label>

        <fieldset className="rounded-xl border border-slate-200 p-4 dark:border-white/10">
          <legend className="px-1 text-xs font-semibold text-slate-700 dark:text-slate-200">Hierarchical data access</legend>
          <p className="mb-3 text-[11px] text-slate-500 dark:text-slate-400">
            Level decides seniority only. This section decides what data this position can actually see — level does not grant access by itself.
          </p>
          <div className="grid gap-4 sm:grid-cols-2">
            <label className="block">
              <span className="mb-1.5 block text-xs font-medium text-slate-600 dark:text-slate-300">Data scope</span>
              <select
                value={form.hierarchicalAccess.dataScope}
                onChange={(e) =>
                  setForm((c) => ({ ...c, hierarchicalAccess: { ...c.hierarchicalAccess, dataScope: e.target.value } }))
                }
                className={`${fieldClass} dark:bg-[#151923]`}
              >
                <option value="own">Own data only</option>
                <option value="team">Team (uses hierarchy below)</option>
                <option value="department">Whole department</option>
                <option value="all">Everything</option>
              </select>
            </label>
            <label className="block">
              <span className="mb-1.5 block text-xs font-medium text-slate-600 dark:text-slate-300">Minimum level gap</span>
              <input
                type="number"
                min="0"
                value={form.hierarchicalAccess.minimumLevelGap}
                onChange={(e) =>
                  setForm((c) => ({
                    ...c,
                    hierarchicalAccess: { ...c.hierarchicalAccess, minimumLevelGap: Number.parseInt(e.target.value, 10) || 0 },
                  }))
                }
                className={fieldClass}
              />
            </label>
          </div>
          <label className="mt-3 flex cursor-pointer items-center gap-3 rounded-xl border border-slate-200 p-3 text-sm text-slate-700 transition hover:bg-slate-50 dark:border-white/10 dark:text-slate-200 dark:hover:bg-white/[0.04]">
            <input
              type="checkbox"
              checked={form.hierarchicalAccess.accessLowerLevels}
              onChange={(e) =>
                setForm((c) => ({ ...c, hierarchicalAccess: { ...c.hierarchicalAccess, accessLowerLevels: e.target.checked } }))
              }
              className="h-4 w-4 rounded border-slate-300 text-blue-600 focus:ring-blue-500"
            />
            Can access lower-level positions in the same department
          </label>
          <div className="mt-3">
            <span className="mb-1.5 block text-xs font-medium text-slate-600 dark:text-slate-300">Specific positions this one can always access</span>
            <div className="flex flex-wrap gap-2">
              {positions.filter((p) => p._id !== editing?._id).map((p) => {
                const selected = form.hierarchicalAccess.canAccessPositions.includes(p.name);
                return (
                  <button
                    type="button"
                    key={p._id}
                    onClick={() => toggleAccessPosition(p.name)}
                    className={`rounded-full border px-3 py-1 text-xs font-medium transition ${
                      selected
                        ? "border-blue-300 bg-blue-50 text-blue-700 dark:border-blue-400/30 dark:bg-blue-400/10 dark:text-blue-200"
                        : "border-slate-200 text-slate-500 hover:bg-slate-50 dark:border-white/10 dark:text-slate-400 dark:hover:bg-white/[0.04]"
                    }`}
                  >
                    {p.name}
                  </button>
                );
              })}
              {positions.length === 0 && <span className="text-xs text-slate-400">No other positions yet.</span>}
            </div>
          </div>
        </fieldset>

        {PERMISSION_GROUPS.map((group) => (
          <fieldset key={group.label}>
            <legend className="mb-2 text-xs font-medium text-slate-600 dark:text-slate-300">{group.label}</legend>
            <div className="grid gap-2 sm:grid-cols-2">
              {Object.entries(group.keys).map(([key, label]) => (
                <label
                  key={key}
                  className="flex cursor-pointer items-center gap-3 rounded-xl border border-slate-200 p-3 text-sm text-slate-700 transition hover:bg-slate-50 dark:border-white/10 dark:text-slate-200 dark:hover:bg-white/[0.04]"
                >
                  <input
                    type="checkbox"
                    checked={form.permissions[key] || false}
                    onChange={() => togglePermission(key)}
                    className="h-4 w-4 rounded border-slate-300 text-blue-600 focus:ring-blue-500"
                  />
                  {label}
                </label>
              ))}
            </div>
          </fieldset>
        ))}

        <div className="flex justify-end gap-3 border-t border-slate-200 pt-4 dark:border-white/10">
          <button type="button" onClick={onClose} disabled={loading} className="h-10 rounded-lg border border-slate-200 px-4 text-sm font-semibold text-slate-700 transition hover:bg-slate-50 disabled:opacity-50 dark:border-white/10 dark:text-slate-200 dark:hover:bg-white/[0.05]">
            Cancel
          </button>
          <button type="submit" disabled={loading} className="inline-flex h-10 items-center justify-center gap-2 rounded-lg bg-blue-600 px-4 text-sm font-semibold text-white transition hover:bg-blue-700 disabled:opacity-50">
            {loading && <span className="h-4 w-4 animate-spin rounded-full border-2 border-white/30 border-t-white" />}
            {loading ? "Saving..." : editing ? "Update position" : "Create position"}
          </button>
        </div>
      </form>
    </ModalShell>
  );
};

// ============================================================================
// Assign Employees tab
// ============================================================================

const AssignPanel = ({ users, query, setQuery, loading, onAssign }) => {
  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return users;
    return users.filter((u) =>
      [u.name, u.email, u.employeeId, u.position, u.departmentRef?.name, u.positionRef?.name].some((v) =>
        v?.toLowerCase().includes(q)
      )
    );
  }, [users, query]);

  return (
    <div>
      <SearchField value={query} onChange={setQuery} placeholder="Search employees" />
      <p className="mt-3 text-xs text-slate-500 dark:text-slate-400">Showing {filtered.length} of {users.length} employees</p>

      {loading ? (
        <LoadingRows />
      ) : filtered.length === 0 ? (
        <EmptyState title="No employees found" description="Try a different name, ID, email, or position." />
      ) : (
        <div className="mt-4 space-y-2">
          {filtered.map((user) => (
            <div
              key={user._id}
              className="flex flex-col gap-3 rounded-xl border border-slate-200 p-4 sm:flex-row sm:items-center sm:justify-between dark:border-white/10"
            >
              <div className="flex min-w-0 items-center gap-3">
                <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-gradient-to-br from-blue-500 to-indigo-600 text-xs font-semibold text-white">
                  {user.name?.charAt(0)?.toUpperCase() || "?"}
                </span>
                <div className="min-w-0">
                  <p className="truncate text-sm font-semibold text-slate-900 dark:text-white">{user.name}</p>
                  <p className="truncate text-xs text-slate-500 dark:text-slate-400">{user.employeeId} · {user.email}</p>
                </div>
              </div>
              <div className="flex flex-wrap items-center gap-2">
                <span className="rounded-full border border-slate-200 px-2.5 py-1 text-xs capitalize text-slate-600 dark:border-white/10 dark:text-slate-300">
                  {user.departmentRef?.name || user.department || "No department"}
                </span>
                {user.positionRef?.name || user.position ? (
                  <span className="rounded-full border border-emerald-200 bg-emerald-50 px-2.5 py-1 text-xs font-medium text-emerald-700 dark:border-emerald-400/20 dark:bg-emerald-400/10 dark:text-emerald-200">
                    {user.positionRef?.name || user.position}
                  </span>
                ) : (
                  <span className="text-xs text-slate-400">Not assigned</span>
                )}
                <button
                  type="button"
                  onClick={() => onAssign(user)}
                  className="h-9 shrink-0 rounded-lg bg-blue-600 px-3 text-xs font-semibold text-white transition hover:bg-blue-700"
                >
                  Assign
                </button>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
};

const AssignModal = ({ user, departments, positions, form, setForm, loading, onClose, onAssign }) => {
  const positionsInDept = positions.filter(
    (p) => !form.departmentId || p.departmentRef?._id === form.departmentId || p.departmentRef?._id === form.departmentId?._id
  );

  return (
    <ModalShell title="Assign department & position" description="Replaces free-text assignment - both are picked from real records, so nothing can silently disconnect." onClose={onClose} maxWidth="max-w-md">
      <div className="space-y-4 p-5">
        <div className="flex items-center gap-3 rounded-xl border border-slate-200 bg-slate-50 p-4 dark:border-white/10 dark:bg-white/[0.025]">
          <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-gradient-to-br from-blue-500 to-indigo-600 text-xs font-semibold text-white">
            {user.name?.charAt(0)?.toUpperCase() || "?"}
          </span>
          <div className="min-w-0">
            <p className="truncate text-sm font-semibold text-slate-900 dark:text-white">{user.name}</p>
            <p className="truncate text-xs text-slate-500 dark:text-slate-400">{user.employeeId} · {user.email}</p>
          </div>
        </div>

        <label className="block">
          <span className="mb-1.5 block text-xs font-medium text-slate-600 dark:text-slate-300">Department</span>
          <select
            value={form.departmentId}
            onChange={(e) => setForm((c) => ({ ...c, departmentId: e.target.value, positionId: "" }))}
            className={`${fieldClass} dark:bg-[#151923]`}
          >
            <option value="">Any / inferred from position</option>
            {departments.map((d) => (
              <option key={d._id} value={d._id}>{d.name}</option>
            ))}
          </select>
        </label>

        <label className="block">
          <span className="mb-1.5 block text-xs font-medium text-slate-600 dark:text-slate-300">Position</span>
          <select
            value={form.positionId}
            onChange={(e) => setForm((c) => ({ ...c, positionId: e.target.value }))}
            className={`${fieldClass} dark:bg-[#151923]`}
            required
          >
            <option value="">Select a position</option>
            {positionsInDept
              .filter((p) => p.status === "active")
              .sort((a, b) => b.level - a.level)
              .map((p) => (
                <option key={p._id} value={p._id}>{p.name} (Level {p.level})</option>
              ))}
          </select>
        </label>

        <div className="flex justify-end gap-3 border-t border-slate-200 pt-4 dark:border-white/10">
          <button type="button" onClick={onClose} disabled={loading} className="h-10 rounded-lg border border-slate-200 px-4 text-sm font-semibold text-slate-700 transition hover:bg-slate-50 disabled:opacity-50 dark:border-white/10 dark:text-slate-200 dark:hover:bg-white/[0.05]">
            Cancel
          </button>
          <button
            type="button"
            onClick={onAssign}
            disabled={loading || !form.positionId}
            className="inline-flex h-10 items-center justify-center gap-2 rounded-lg bg-blue-600 px-4 text-sm font-semibold text-white transition hover:bg-blue-700 disabled:opacity-50"
          >
            {loading && <span className="h-4 w-4 animate-spin rounded-full border-2 border-white/30 border-t-white" />}
            {loading ? "Assigning..." : "Assign"}
          </button>
        </div>
      </div>
    </ModalShell>
  );
};

// ============================================================================
// Access Overview tab
// ============================================================================

const OverviewPanel = ({ users, selectedUserId, onSelectUser, data, loading }) => {
  const [query, setQuery] = useState("");
  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return users.slice(0, 20);
    return users.filter((u) => [u.name, u.email, u.employeeId].some((v) => v?.toLowerCase().includes(q))).slice(0, 20);
  }, [users, query]);

  return (
    <div className="grid gap-5 lg:grid-cols-[280px,1fr]">
      <div>
        <SearchField value={query} onChange={setQuery} placeholder="Find an employee" />
        <div className="mt-3 max-h-[520px] space-y-1 overflow-y-auto pr-1">
          {filtered.map((u) => (
            <button
              key={u._id}
              type="button"
              onClick={() => onSelectUser(u._id)}
              className={`flex w-full items-center gap-2 rounded-lg px-3 py-2 text-left text-sm transition ${
                selectedUserId === u._id
                  ? "bg-blue-50 text-blue-700 dark:bg-blue-400/10 dark:text-blue-200"
                  : "text-slate-600 hover:bg-slate-50 dark:text-slate-300 dark:hover:bg-white/[0.04]"
              }`}
            >
              <span className="truncate">{u.name}</span>
              <ChevronRight className="ml-auto h-3.5 w-3.5 shrink-0 opacity-50" />
            </button>
          ))}
          {filtered.length === 0 && <p className="px-3 py-6 text-center text-xs text-slate-400">No matches.</p>}
        </div>
      </div>

      <div>
        {!selectedUserId ? (
          <EmptyState title="Pick an employee" description="See exactly what they can access and why — no diagnostic script required." />
        ) : loading ? (
          <LoadingRows />
        ) : !data ? (
          <EmptyState title="Nothing resolved yet" description="This user has no position assigned, so they default to own-data-only access." />
        ) : (
          <div className="space-y-4">
            <div className="rounded-2xl border border-slate-200 bg-white p-4 dark:border-white/10 dark:bg-[#10131c]">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <h3 className="text-sm font-semibold text-slate-900 dark:text-white">{data.user.name}</h3>
                <span className="rounded-full border border-slate-200 px-2.5 py-1 text-xs capitalize text-slate-600 dark:border-white/10 dark:text-slate-300">
                  role: {data.user.role}
                </span>
                {Object.keys(data.permissionOverrides || {}).length > 0 && (
                  <span
                    title="This user has one or more per-user permission overrides layered on top of their Position — see server/models/User.js's permissionOverrides."
                    className="rounded-full border border-violet-200 bg-violet-50 px-2.5 py-1 text-xs font-medium text-violet-700 dark:border-violet-400/20 dark:bg-violet-400/10 dark:text-violet-200"
                  >
                    Custom access
                  </span>
                )}
              </div>
              <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">{data.user.employeeId} · {data.user.email}</p>

              {data.bypassesEverything ? (
                <div className="mt-4 flex items-center gap-2 rounded-xl border border-amber-200 bg-amber-50 px-3 py-2.5 text-xs text-amber-800 dark:border-amber-400/20 dark:bg-amber-400/10 dark:text-amber-200">
                  <Shield className="h-4 w-4 shrink-0" />
                  This role bypasses the permission system entirely — sees and can act on everything.
                </div>
              ) : (
                <>
                  <div className="mt-4 grid gap-3 sm:grid-cols-2">
                    <div className="rounded-xl border border-slate-200 p-3 dark:border-white/10">
                      <p className="text-[11px] uppercase tracking-wide text-slate-400">Department</p>
                      <p className="mt-1 text-sm font-medium text-slate-800 dark:text-slate-100">{data.department?.name || "Unassigned"}</p>
                      <p className="mt-0.5 text-[11px] text-slate-400">source: {data.departmentSource}</p>
                    </div>
                    <div className="rounded-xl border border-slate-200 p-3 dark:border-white/10">
                      <p className="text-[11px] uppercase tracking-wide text-slate-400">Position</p>
                      <p className="mt-1 text-sm font-medium text-slate-800 dark:text-slate-100">{data.position?.name || "Unassigned"}</p>
                      <p className="mt-0.5 text-[11px] text-slate-400">
                        {data.position ? `resolved via ${data.positionResolvedVia}` : "no special permissions — own data only"}
                      </p>
                    </div>
                  </div>

                  {data.hierarchyChain?.length > 0 && (
                    <div className="mt-3 flex flex-wrap items-center gap-1.5 text-xs text-slate-500 dark:text-slate-400">
                      <span className="font-medium text-slate-600 dark:text-slate-300">Reports up through:</span>
                      {data.hierarchyChain.map((step, idx) => (
                        <React.Fragment key={step._id}>
                          {idx > 0 && <ChevronRight className="h-3 w-3 opacity-50" />}
                          <span className="rounded-full border border-slate-200 px-2 py-0.5 dark:border-white/10">{step.name}</span>
                        </React.Fragment>
                      ))}
                    </div>
                  )}

                  {data.position && (
                    <div className="mt-4">
                      <p className="mb-2 text-[11px] uppercase tracking-wide text-slate-400">
                        Granted permissions {data.effectivePermissions ? "(effective — Position + any overrides)" : ""}
                      </p>
                      <div className="flex flex-wrap gap-1.5">
                        {Object.entries(data.effectivePermissions || data.position.permissions || {})
                          .filter(([, v]) => v)
                          .map(([key]) => (
                            <span
                              key={key}
                              title={data.permissionOverrides?.[key] !== undefined ? "Via per-user override, not the Position template" : "Via Position"}
                              className={`rounded-full border px-2.5 py-1 text-[11px] font-medium ${
                                data.permissionOverrides?.[key] !== undefined
                                  ? "border-violet-200 bg-violet-50 text-violet-700 dark:border-violet-400/20 dark:bg-violet-400/10 dark:text-violet-200"
                                  : "border-emerald-200 bg-emerald-50 text-emerald-700 dark:border-emerald-400/20 dark:bg-emerald-400/10 dark:text-emerald-200"
                              }`}
                            >
                              {PERMISSION_LABELS[key] || key}
                            </span>
                          ))}
                        {Object.values(data.effectivePermissions || data.position.permissions || {}).every((v) => !v) && (
                          <span className="text-xs text-slate-400">No permissions granted on this position.</span>
                        )}
                      </div>
                    </div>
                  )}
                </>
              )}
            </div>

            {!data.bypassesEverything && (
              <div className="rounded-2xl border border-slate-200 bg-white p-4 dark:border-white/10 dark:bg-[#10131c]">
                <div className="flex items-center justify-between">
                  <p className="text-sm font-semibold text-slate-900 dark:text-white">Can see data belonging to</p>
                  <span className="text-xs text-slate-400">{data.accessibleUsersCount} {data.accessibleUsersCount === 1 ? "person" : "people"}</span>
                </div>
                {data.accessibleUsers.length === 0 ? (
                  <p className="mt-3 text-xs text-slate-400">Only their own data.</p>
                ) : (
                  <ul className="mt-3 divide-y divide-slate-100 dark:divide-white/10">
                    {data.accessibleUsers.map((u) => (
                      <li key={u._id} className="flex items-center justify-between py-2 text-sm">
                        <span className="text-slate-700 dark:text-slate-200">{u.name}</span>
                        <span className="text-xs capitalize text-slate-400">{u.position || u.department || ""}</span>
                      </li>
                    ))}
                  </ul>
                )}
              </div>
            )}

            {/* Role & Department Hierarchy Revamp v2 (2026-07-27), Task 2.3:
                the delegated-access audit trail, right next to the
                current-state view above — "who changed what, for whom,
                when," same as this tab already answers "what can X access." */}
            {data.recentAccessChanges?.length > 0 && (
              <div className="rounded-2xl border border-slate-200 bg-white p-4 dark:border-white/10 dark:bg-[#10131c]">
                <p className="text-sm font-semibold text-slate-900 dark:text-white">Recent access changes</p>
                <ul className="mt-3 divide-y divide-slate-100 dark:divide-white/10">
                  {data.recentAccessChanges.map((entry) => (
                    <li key={entry._id} className="py-2 text-xs text-slate-600 dark:text-slate-300">
                      <span className="font-medium text-slate-800 dark:text-slate-100">{entry.actorId?.name || "Unknown"}</span>{" "}
                      {entry.action === "grant" && <>granted <span className="font-mono">{entry.flagOrPositionName}</span></>}
                      {entry.action === "revoke" && <>revoked <span className="font-mono">{entry.flagOrPositionName}</span></>}
                      {entry.action === "assign-position" && <>reassigned this person to <span className="font-medium">{entry.flagOrPositionName}</span></>}
                      {entry.action === "create-position" && <>created position <span className="font-medium">{entry.flagOrPositionName}</span></>}
                      <span className="ml-1.5 text-slate-400">· {new Date(entry.createdAt).toLocaleString()}</span>
                    </li>
                  ))}
                </ul>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
};

// ============================================================================
// Hierarchy Setup tab (Role & Department Hierarchy Revamp v2, 2026-07-27)
// Puts server/scripts/updateDepartmentsV2.js, seedRoleHierarchyV2.js, and
// migrateToRoleHierarchyV2.js behind buttons instead of a terminal — see
// server/routes/hierarchySetupRoutes.js. Renaming/seeding is additive and
// idempotent (upsert-based, safe to click more than once). The migration
// report is strictly read-only and never reassigns anyone by itself — each
// row's "Apply" click is a separate, deliberate call to the same
// PATCH /api/positions/users/:userId/assign endpoint the Assign Employees
// tab already uses.
// ============================================================================

const CONFIDENCE_STYLES = {
  "no-action-needed": "border-slate-200 bg-slate-50 text-slate-500 dark:border-white/10 dark:bg-white/[0.04] dark:text-slate-400",
  direct: "border-emerald-200 bg-emerald-50 text-emerald-700 dark:border-emerald-400/20 dark:bg-emerald-400/10 dark:text-emerald-200",
  "best-guess": "border-amber-200 bg-amber-50 text-amber-700 dark:border-amber-400/20 dark:bg-amber-400/10 dark:text-amber-200",
  uncertain: "border-rose-200 bg-rose-50 text-rose-700 dark:border-rose-400/20 dark:bg-rose-400/10 dark:text-rose-200",
};

const ConfidenceBadge = ({ confidence }) => (
  <span
    className={`whitespace-nowrap rounded-full border px-2.5 py-1 text-[11px] font-semibold capitalize ${
      CONFIDENCE_STYLES[confidence] || CONFIDENCE_STYLES["no-action-needed"]
    }`}
  >
    {confidence ? confidence.replace(/-/g, " ") : "n/a"}
  </span>
);

const HierarchySetupPanel = ({
  status,
  statusLoading,
  onRefreshStatus,
  onApply,
  applying,
  applyLog,
  report,
  reportLoading,
  onLoadReport,
  onApplySuggestion,
  applyingUserId,
  onGoToAssign,
}) => {
  const cards = status
    ? [
        {
          label: "Departments renamed",
          value: status.departmentsApplied ? "Done" : "Pending",
          tone: status.departmentsApplied ? "text-emerald-600 dark:text-emerald-300" : "text-amber-600 dark:text-amber-300",
        },
        {
          label: "V2 positions seeded",
          value: status.positionsApplied ? "Done" : "Pending",
          tone: status.positionsApplied ? "text-emerald-600 dark:text-emerald-300" : "text-amber-600 dark:text-amber-300",
        },
        {
          label: "Employees on old positions",
          value: status.usersOnOldPositions,
          tone: status.usersOnOldPositions > 0 ? "text-amber-600 dark:text-amber-300" : "text-emerald-600 dark:text-emerald-300",
        },
        {
          label: "Unresolved position",
          value: status.usersUnresolved,
          tone: status.usersUnresolved > 0 ? "text-rose-600 dark:text-rose-300" : "text-emerald-600 dark:text-emerald-300",
        },
      ]
    : [];

  const grouped = useMemo(() => {
    const byConfidence = { uncertain: [], "best-guess": [], direct: [], "no-action-needed": [] };
    if (!report) return byConfidence;
    report.onOldPosition.forEach((r) => byConfidence[r.confidence]?.push(r));
    return byConfidence;
  }, [report]);

  return (
    <div className="space-y-6">
      <div className="rounded-xl border border-blue-200 bg-blue-50/60 p-4 text-sm leading-6 text-blue-900 dark:border-blue-400/20 dark:bg-blue-400/[0.06] dark:text-blue-100">
        Applies the 2026-07-27 role hierarchy revamp: renames Tech → Development and Marketing &amp; Sales → Sales,
        then seeds the 11 new positions (Admin; Project Manager, Supervisor, and Agent — Sales; Team Lead,
        Supervisor, Employee, and Intern — Development; Senior HR, Junior HR, and HR Intern). Safe to click more
        than once — nothing is ever deleted, only renamed or added. Existing employees are never moved
        automatically; the report below is for review, and every reassignment below is a separate, deliberate
        click.
      </div>

      <div>
        <div className="mb-3 flex items-center justify-between">
          <h3 className="text-sm font-semibold text-slate-900 dark:text-white">Setup status</h3>
          <button
            type="button"
            onClick={onRefreshStatus}
            disabled={statusLoading}
            className="text-xs font-medium text-blue-600 hover:underline disabled:opacity-50 dark:text-blue-300"
          >
            {statusLoading ? "Refreshing…" : "Refresh"}
          </button>
        </div>

        {statusLoading && !status ? (
          <LoadingRows />
        ) : (
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-4">
            {cards.map((c) => (
              <div key={c.label} className="rounded-xl border border-slate-200 p-4 dark:border-white/10">
                <p className="text-xs font-medium text-slate-500 dark:text-slate-400">{c.label}</p>
                <p className={`mt-1 text-xl font-semibold ${c.tone}`}>{c.value}</p>
              </div>
            ))}
          </div>
        )}

        <button
          type="button"
          onClick={() => onApply(["departments", "positions"])}
          disabled={applying}
          className="mt-4 inline-flex h-10 items-center justify-center gap-2 rounded-lg bg-blue-600 px-4 text-sm font-semibold text-white transition hover:bg-blue-700 disabled:opacity-50"
        >
          {applying && <span className="h-4 w-4 animate-spin rounded-full border-2 border-white/30 border-t-white" />}
          {applying ? "Applying…" : "Apply v2 hierarchy setup"}
        </button>

        {applyLog.length > 0 && (
          <pre className="mt-3 max-h-48 overflow-y-auto whitespace-pre-wrap rounded-xl bg-slate-950 p-3 text-[11px] leading-5 text-slate-200">
            {applyLog.join("\n")}
          </pre>
        )}
      </div>

      <div className="border-t border-slate-200 pt-6 dark:border-white/10">
        <div className="mb-3 flex items-center justify-between gap-3">
          <div>
            <h3 className="text-sm font-semibold text-slate-900 dark:text-white">Migration report</h3>
            <p className="mt-0.5 text-xs text-slate-500 dark:text-slate-400">
              Read-only suggestions for anyone still on an old (pre-v2) position. Nothing changes until you click
              Apply on a row.
            </p>
          </div>
          <button
            type="button"
            onClick={onLoadReport}
            disabled={reportLoading}
            className="h-9 shrink-0 rounded-lg border border-slate-200 px-3 text-xs font-semibold text-slate-700 transition hover:bg-slate-50 disabled:opacity-50 dark:border-white/10 dark:text-slate-200 dark:hover:bg-white/[0.05]"
          >
            {reportLoading ? "Loading…" : report ? "Refresh report" : "Load report"}
          </button>
        </div>

        {reportLoading && !report ? (
          <LoadingRows />
        ) : !report ? (
          <EmptyState title="No report loaded yet" description='Click "Load report" to see who still needs review.' />
        ) : report.onOldPosition.length === 0 ? (
          <EmptyState title="Nothing to review" description="No active employees are on an old (pre-v2) position." />
        ) : (
          <div className="space-y-5">
            {["uncertain", "best-guess", "direct", "no-action-needed"].map((level) =>
              grouped[level]?.length ? (
                <div key={level}>
                  <div className="mb-2 flex items-center gap-2">
                    <ConfidenceBadge confidence={level} />
                    <span className="text-xs text-slate-500 dark:text-slate-400">{grouped[level].length} employee(s)</span>
                  </div>
                  <div className="overflow-x-auto rounded-xl border border-slate-200 dark:border-white/10">
                    <table className="w-full min-w-[820px] text-left">
                      <thead className="bg-slate-50 text-[11px] uppercase tracking-wide text-slate-500 dark:bg-white/[0.03] dark:text-slate-400">
                        <tr>
                          <th className="px-4 py-2.5 font-medium">Employee</th>
                          <th className="px-4 py-2.5 font-medium">Current position</th>
                          <th className="px-4 py-2.5 font-medium">Suggested position</th>
                          <th className="px-4 py-2.5 font-medium">Why</th>
                          <th className="px-4 py-2.5 font-medium text-right">Action</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-100 dark:divide-white/5">
                        {grouped[level].map((row) => (
                          <tr key={row.userId}>
                            <td className="px-4 py-3">
                              <p className="text-sm font-medium text-slate-900 dark:text-white">{row.name}</p>
                              <p className="text-xs text-slate-500 dark:text-slate-400">{row.employeeId}</p>
                            </td>
                            <td className="px-4 py-3 text-sm text-slate-600 dark:text-slate-300">{row.currentPosition}</td>
                            <td className="px-4 py-3 text-sm text-slate-600 dark:text-slate-300">
                              {row.suggestedPosition || <span className="text-slate-400">No change needed</span>}
                            </td>
                            <td className="max-w-xs px-4 py-3 text-xs text-slate-500 dark:text-slate-400">{row.reason}</td>
                            <td className="px-4 py-3 text-right">
                              {row.suggestedPositionId ? (
                                <button
                                  type="button"
                                  onClick={() => onApplySuggestion(row)}
                                  disabled={applyingUserId === row.userId}
                                  className="h-8 shrink-0 rounded-lg bg-blue-600 px-3 text-xs font-semibold text-white transition hover:bg-blue-700 disabled:opacity-50"
                                >
                                  {applyingUserId === row.userId ? "Applying…" : "Apply"}
                                </button>
                              ) : (
                                <button
                                  type="button"
                                  onClick={onGoToAssign}
                                  className="h-8 shrink-0 rounded-lg border border-slate-200 px-3 text-xs font-semibold text-slate-600 transition hover:bg-slate-50 dark:border-white/10 dark:text-slate-300 dark:hover:bg-white/[0.05]"
                                >
                                  Review manually
                                </button>
                              )}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              ) : null
            )}
          </div>
        )}

        {report?.noPositionResolved?.length > 0 && (
          <div className="mt-5 rounded-xl border border-amber-200 bg-amber-50/60 p-4 dark:border-amber-400/20 dark:bg-amber-400/[0.06]">
            <p className="text-sm font-semibold text-amber-800 dark:text-amber-200">
              {report.noPositionResolved.length} active employee(s) have no resolvable position at all
            </p>
            <p className="mt-1 text-xs text-amber-700 dark:text-amber-300">
              Not covered by this report — assign them a position directly from the "Assign employees" tab.
            </p>
            <button type="button" onClick={onGoToAssign} className="mt-2 text-xs font-semibold text-amber-800 underline dark:text-amber-200">
              Go to Assign employees
            </button>
          </div>
        )}
      </div>
    </div>
  );
};

// ============================================================================
// Main page
// ============================================================================

const AccessManagementPage = ({ onLogout }) => {
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);
  const [activeTab, setActiveTab] = useState("departments");
  const [pageLoading, setPageLoading] = useState(true);
  const [notification, setNotification] = useState(null);

  const [departments, setDepartments] = useState([]);
  const [departmentStats, setDepartmentStats] = useState(null);
  const [positions, setPositions] = useState([]);
  const [users, setUsers] = useState([]);

  // Departments tab state
  const [searchDept, setSearchDept] = useState("");
  const [showDeptModal, setShowDeptModal] = useState(false);
  const [editingDept, setEditingDept] = useState(null);
  const [deptForm, setDeptForm] = useState(emptyDepartmentForm);
  const [deptLoading, setDeptLoading] = useState(false);

  // Positions tab state
  const [searchPosition, setSearchPosition] = useState("");
  const [showPositionModal, setShowPositionModal] = useState(false);
  const [editingPosition, setEditingPosition] = useState(null);
  const [positionForm, setPositionForm] = useState(emptyPositionForm);
  const [positionLoading, setPositionLoading] = useState(false);

  // Assign tab state
  const [searchUser, setSearchUser] = useState("");
  const [assignUser, setAssignUser] = useState(null);
  const [showAssignModal, setShowAssignModal] = useState(false);
  const [assignForm, setAssignForm] = useState({ departmentId: "", positionId: "" });
  const [assignLoading, setAssignLoading] = useState(false);

  // Overview tab state
  const [overviewUserId, setOverviewUserId] = useState("");
  const [overviewData, setOverviewData] = useState(null);
  const [overviewLoading, setOverviewLoading] = useState(false);

  // Hierarchy Setup tab state (Role & Department Hierarchy Revamp v2, 2026-07-27)
  const [hierarchyStatus, setHierarchyStatus] = useState(null);
  const [hierarchyStatusLoading, setHierarchyStatusLoading] = useState(false);
  const [hierarchyApplying, setHierarchyApplying] = useState(false);
  const [hierarchyApplyLog, setHierarchyApplyLog] = useState([]);
  const [migrationReport, setMigrationReport] = useState(null);
  const [migrationReportLoading, setMigrationReportLoading] = useState(false);
  const [applyingSuggestionUserId, setApplyingSuggestionUserId] = useState(null);

  const showNotification = (message, type) => setNotification({ message, type });
  useEffect(() => {
    if (!notification) return undefined;
    const t = window.setTimeout(() => setNotification(null), 3500);
    return () => window.clearTimeout(t);
  }, [notification]);

  const loadAll = async () => {
    setPageLoading(true);
    try {
      const [deptRes, statsRes, posRes, usersRes] = await Promise.allSettled([
        API.get("/api/departments"),
        API.get("/api/departments/stats"),
        API.get("/api/positions"),
        API.get("/api/positions/users/list"),
      ]);
      if (deptRes.status === "fulfilled") setDepartments(deptRes.value.data || []);
      if (statsRes.status === "fulfilled") setDepartmentStats(statsRes.value.data || null);
      if (posRes.status === "fulfilled") setPositions(posRes.value.data || []);
      if (usersRes.status === "fulfilled") setUsers(usersRes.value.data || []);
      if ([deptRes, statsRes, posRes, usersRes].some((r) => r.status === "rejected")) {
        showNotification("Some access-management data could not be loaded", "error");
      }
    } catch (err) {
      console.error("Error loading access management data:", err);
      showNotification("Could not load access management data", "error");
    } finally {
      setPageLoading(false);
    }
  };

  useEffect(() => {
    loadAll();
    // eslint-disable-next-line react-hooks/exhaustive-deps -- mount-only load; loadAll is also called explicitly after mutations
  }, []);

  // ---- Department handlers ----
  const openCreateDept = () => {
    setEditingDept(null);
    setDeptForm(emptyDepartmentForm());
    setShowDeptModal(true);
  };
  const openEditDept = (dept) => {
    setEditingDept(dept);
    setDeptForm({ name: dept.name, code: dept.code, description: dept.description || "" });
    setShowDeptModal(true);
  };
  const closeDeptModal = () => {
    setShowDeptModal(false);
    setEditingDept(null);
  };
  const submitDept = async (e) => {
    e.preventDefault();
    setDeptLoading(true);
    try {
      if (editingDept) {
        await API.put(`/api/departments/${editingDept._id}`, deptForm);
        showNotification("Department updated", "success");
      } else {
        await API.post("/api/departments", deptForm);
        showNotification("Department created", "success");
      }
      closeDeptModal();
      await loadAll();
    } catch (err) {
      showNotification(err.response?.data?.error || "Could not save department", "error");
    } finally {
      setDeptLoading(false);
    }
  };
  const toggleDeptStatus = async (dept) => {
    try {
      await API.put(`/api/departments/${dept._id}`, { status: dept.status === "active" ? "inactive" : "active" });
      showNotification(`Department ${dept.status === "active" ? "deactivated" : "activated"}`, "success");
      await loadAll();
    } catch (err) {
      showNotification(err.response?.data?.error || "Could not update department", "error");
    }
  };

  // ---- Position handlers ----
  const openCreatePosition = () => {
    setEditingPosition(null);
    setPositionForm(emptyPositionForm());
    setShowPositionModal(true);
  };
  const openEditPosition = (position) => {
    setEditingPosition(position);
    setPositionForm({
      name: position.name || "",
      level: position.level ?? 50,
      departmentRef: position.departmentRef?._id || "",
      parentPosition: position.parentPosition?._id || "",
      description: position.description || "",
      permissions: { ...emptyPermissions(), ...(position.permissions || {}) },
      hierarchicalAccess: {
        dataScope: position.hierarchicalAccess?.dataScope || "own",
        accessLowerLevels: position.hierarchicalAccess?.accessLowerLevels || false,
        minimumLevelGap: position.hierarchicalAccess?.minimumLevelGap || 0,
        canAccessPositions: position.hierarchicalAccess?.canAccessPositions || [],
      },
    });
    setShowPositionModal(true);
  };
  const closePositionModal = () => {
    setShowPositionModal(false);
    setEditingPosition(null);
  };
  const submitPosition = async (e) => {
    e.preventDefault();
    setPositionLoading(true);
    try {
      const payload = {
        name: positionForm.name,
        level: positionForm.level,
        departmentRef: positionForm.departmentRef || null,
        parentPosition: positionForm.parentPosition || null,
        description: positionForm.description,
        permissions: positionForm.permissions,
        hierarchicalAccess: positionForm.hierarchicalAccess,
      };
      if (editingPosition) {
        await API.put(`/api/positions/${editingPosition._id}`, payload);
        showNotification("Position updated", "success");
      } else {
        await API.post("/api/positions", payload);
        showNotification("Position created", "success");
      }
      closePositionModal();
      await loadAll();
    } catch (err) {
      showNotification(err.response?.data?.error || "Could not save position", "error");
    } finally {
      setPositionLoading(false);
    }
  };
  const deletePosition = async (position) => {
    if (!window.confirm(`Delete "${position.name}"? This can't be undone.`)) return;
    try {
      await API.delete(`/api/positions/${position._id}`);
      showNotification("Position deleted", "success");
      await loadAll();
    } catch (err) {
      showNotification(err.response?.data?.error || "Could not delete position", "error");
    }
  };

  // ---- Assign handlers ----
  const openAssign = (user) => {
    setAssignUser(user);
    setAssignForm({ departmentId: user.departmentRef?._id || "", positionId: user.positionRef?._id || "" });
    setShowAssignModal(true);
  };
  const closeAssignModal = () => {
    setShowAssignModal(false);
    setAssignUser(null);
  };
  const submitAssign = async () => {
    if (!assignUser || !assignForm.positionId) return;
    setAssignLoading(true);
    try {
      await API.patch(`/api/positions/users/${assignUser._id}/assign`, {
        positionId: assignForm.positionId,
        departmentId: assignForm.departmentId || undefined,
      });
      showNotification("Assignment updated", "success");
      closeAssignModal();
      await loadAll();
    } catch (err) {
      showNotification(err.response?.data?.error || "Could not assign", "error");
    } finally {
      setAssignLoading(false);
    }
  };

  // ---- Overview handlers ----
  const selectOverviewUser = async (userId) => {
    setOverviewUserId(userId);
    setOverviewLoading(true);
    setOverviewData(null);
    try {
      const res = await API.get(`/api/positions/users/${userId}/access-overview`);
      setOverviewData(res.data);
    } catch (err) {
      showNotification(err.response?.data?.error || "Could not load access overview", "error");
    } finally {
      setOverviewLoading(false);
    }
  };

  // ---- Hierarchy Setup handlers ----
  const loadHierarchyStatus = async () => {
    setHierarchyStatusLoading(true);
    try {
      const res = await API.get("/api/hierarchy-setup/status");
      setHierarchyStatus(res.data);
    } catch (err) {
      showNotification(err.response?.data?.error || "Could not load hierarchy setup status", "error");
    } finally {
      setHierarchyStatusLoading(false);
    }
  };

  useEffect(() => {
    if (activeTab === "hierarchy" && !hierarchyStatus && !hierarchyStatusLoading) {
      loadHierarchyStatus();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps -- lazy-load once when this tab is first opened
  }, [activeTab]);

  const applyHierarchySteps = async (steps) => {
    setHierarchyApplying(true);
    try {
      const res = await API.post("/api/hierarchy-setup/apply", { steps });
      setHierarchyApplyLog(res.data.log || []);
      showNotification(res.data.message || "Hierarchy setup applied", "success");
      await loadHierarchyStatus();
      await loadAll();
    } catch (err) {
      setHierarchyApplyLog(err.response?.data?.log || []);
      showNotification(err.response?.data?.message || err.response?.data?.error || "Could not apply hierarchy setup", "error");
    } finally {
      setHierarchyApplying(false);
    }
  };

  const loadMigrationReport = async () => {
    setMigrationReportLoading(true);
    try {
      const res = await API.get("/api/hierarchy-setup/migration-report");
      setMigrationReport(res.data);
    } catch (err) {
      showNotification(err.response?.data?.error || "Could not load migration report", "error");
    } finally {
      setMigrationReportLoading(false);
    }
  };

  const applySuggestion = async (row) => {
    if (!row.suggestedPositionId) return;
    setApplyingSuggestionUserId(row.userId);
    try {
      await API.patch(`/api/positions/users/${row.userId}/assign`, { positionId: row.suggestedPositionId });
      showNotification(`${row.name} reassigned to ${row.suggestedPosition}`, "success");
      setMigrationReport((prev) =>
        prev ? { ...prev, onOldPosition: prev.onOldPosition.filter((r) => r.userId !== row.userId) } : prev
      );
      await loadHierarchyStatus();
      await loadAll();
    } catch (err) {
      showNotification(err.response?.data?.error || "Could not reassign", "error");
    } finally {
      setApplyingSuggestionUserId(null);
    }
  };

  const summary = {
    totalDepartments: departmentStats?.totalDepartments ?? departments.length,
    totalPositions: positions.length,
    assignedUsers: users.filter((u) => u.positionRef || u.position).length,
    unassignedUsers: users.filter((u) => !u.positionRef && !u.position).length,
  };

  const metrics = [
    ["Departments", summary.totalDepartments, Building2, "text-blue-600 dark:text-blue-300"],
    ["Positions", summary.totalPositions, Briefcase, "text-violet-600 dark:text-violet-300"],
    ["Assigned employees", summary.assignedUsers, Users, "text-emerald-600 dark:text-emerald-300"],
    ["Unassigned", summary.unassignedUsers, UserCog, "text-amber-600 dark:text-amber-300"],
  ];

  const tabs = [
    ["departments", "Departments", Building2],
    ["positions", "Positions & permissions", Briefcase],
    ["assign", "Assign employees", Users],
    ["overview", "Access overview", Shield],
    ["hierarchy", "Hierarchy setup", Network],
  ];

  return (
    <div className="relative flex h-[100dvh] overflow-hidden bg-slate-50 text-slate-900 dark:bg-[#0b0d12] dark:text-slate-100">
      <Sidebar collapsed={sidebarCollapsed} setCollapsed={setSidebarCollapsed} onLogout={onLogout} userRole="super-admin" />

      <main
        className={`h-[100dvh] min-w-0 flex-1 overflow-y-auto overflow-x-hidden px-3 py-4 transition-all duration-300 sm:px-5 lg:px-6 ${
          sidebarCollapsed ? "app-offset app-offset-collapsed" : "app-offset"
        }`}
      >
        <div className="mx-auto max-w-[1500px] space-y-4 pb-8 sm:space-y-5">
          {notification && (
            <div
              className={`fixed right-4 top-4 z-50 flex max-w-sm items-center gap-3 rounded-xl border px-4 py-3 text-sm font-medium shadow-xl ${
                notification.type === "success"
                  ? "border-emerald-200 bg-white text-emerald-700 dark:border-emerald-400/20 dark:bg-[#151923] dark:text-emerald-200"
                  : "border-rose-200 bg-white text-rose-700 dark:border-rose-400/20 dark:bg-[#151923] dark:text-rose-200"
              }`}
            >
              {notification.type === "success" ? <Check className="h-4 w-4 shrink-0" /> : <AlertCircle className="h-4 w-4 shrink-0" />}
              {notification.message}
            </div>
          )}

          <header className="rounded-2xl border border-slate-200 bg-white px-5 py-5 shadow-sm dark:border-white/10 dark:bg-[#10131c] sm:px-6">
            <div className="flex items-start gap-3">
              <div className="mt-0.5 flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-blue-50 text-blue-600 dark:bg-blue-400/10 dark:text-blue-300">
                <Shield className="h-5 w-5" />
              </div>
              <div>
                <div className="inline-flex items-center rounded-md bg-blue-50 px-2 py-1 text-[11px] font-semibold uppercase tracking-wide text-blue-700 dark:bg-blue-400/10 dark:text-blue-200">
                  Super admin only
                </div>
                <h1 className="mt-2 text-2xl font-semibold tracking-tight text-slate-950 dark:text-white">Access management</h1>
                <p className="mt-1 text-sm leading-6 text-slate-500 dark:text-slate-400">
                  Departments, positions, hierarchy, and permissions for the whole CRM — decide who has what access from here.
                </p>
              </div>
            </div>
          </header>

          <section className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4" aria-label="Access management summary">
            {metrics.map(([label, value, Icon, tone]) => (
              <article key={label} className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm dark:border-white/10 dark:bg-[#10131c]">
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <p className="text-xs font-medium text-slate-500 dark:text-slate-400">{label}</p>
                    <p className="mt-1 text-2xl font-semibold text-slate-950 dark:text-white">{pageLoading ? "—" : value}</p>
                  </div>
                  <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-slate-100 dark:bg-white/[0.05]">
                    {React.createElement(Icon, { className: `h-4 w-4 ${tone}` })}
                  </span>
                </div>
              </article>
            ))}
          </section>

          <section className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm dark:border-white/10 dark:bg-[#10131c]">
            <nav className="flex flex-nowrap gap-1 overflow-x-auto border-b border-slate-200 p-2 dark:border-white/10 sm:px-4" aria-label="Access management sections">
              {tabs.map(([id, label, Icon]) => (
                <button
                  key={id}
                  type="button"
                  onClick={() => setActiveTab(id)}
                  className={`inline-flex h-10 shrink-0 items-center gap-2 rounded-lg px-3 text-sm font-medium transition ${
                    activeTab === id
                      ? "bg-blue-50 text-blue-700 dark:bg-blue-400/10 dark:text-blue-200"
                      : "text-slate-500 hover:bg-slate-50 hover:text-slate-900 dark:text-slate-400 dark:hover:bg-white/[0.05] dark:hover:text-white"
                  }`}
                >
                  {React.createElement(Icon, { className: "h-4 w-4" })}
                  {label}
                </button>
              ))}
            </nav>

            <div className="p-4 sm:p-6">
              {activeTab === "departments" && (
                <DepartmentsPanel
                  departments={departments}
                  stats={departmentStats}
                  query={searchDept}
                  setQuery={setSearchDept}
                  loading={pageLoading}
                  onCreate={openCreateDept}
                  onEdit={openEditDept}
                  onToggleStatus={toggleDeptStatus}
                />
              )}
              {activeTab === "positions" && (
                <PositionsPanel
                  positions={positions}
                  query={searchPosition}
                  setQuery={setSearchPosition}
                  loading={pageLoading}
                  onCreate={openCreatePosition}
                  onEdit={openEditPosition}
                  onDelete={deletePosition}
                />
              )}
              {activeTab === "assign" && (
                <AssignPanel
                  users={users}
                  query={searchUser}
                  setQuery={setSearchUser}
                  loading={pageLoading}
                  onAssign={openAssign}
                />
              )}
              {activeTab === "overview" && (
                <OverviewPanel
                  users={users}
                  selectedUserId={overviewUserId}
                  onSelectUser={selectOverviewUser}
                  data={overviewData}
                  loading={overviewLoading}
                />
              )}
              {activeTab === "hierarchy" && (
                <HierarchySetupPanel
                  status={hierarchyStatus}
                  statusLoading={hierarchyStatusLoading}
                  onRefreshStatus={loadHierarchyStatus}
                  onApply={applyHierarchySteps}
                  applying={hierarchyApplying}
                  applyLog={hierarchyApplyLog}
                  report={migrationReport}
                  reportLoading={migrationReportLoading}
                  onLoadReport={loadMigrationReport}
                  onApplySuggestion={applySuggestion}
                  applyingUserId={applyingSuggestionUserId}
                  onGoToAssign={() => setActiveTab("assign")}
                />
              )}
            </div>
          </section>
        </div>
      </main>

      {showDeptModal && (
        <DepartmentModal editing={editingDept} form={deptForm} setForm={setDeptForm} loading={deptLoading} onClose={closeDeptModal} onSubmit={submitDept} />
      )}

      {showPositionModal && (
        <PositionModal
          editing={editingPosition}
          form={positionForm}
          setForm={setPositionForm}
          departments={departments}
          positions={positions}
          loading={positionLoading}
          onClose={closePositionModal}
          onSubmit={submitPosition}
        />
      )}

      {showAssignModal && assignUser && (
        <AssignModal
          user={assignUser}
          departments={departments}
          positions={positions}
          form={assignForm}
          setForm={setAssignForm}
          loading={assignLoading}
          onClose={closeAssignModal}
          onAssign={submitAssign}
        />
      )}
    </div>
  );
};

export default AccessManagementPage;
