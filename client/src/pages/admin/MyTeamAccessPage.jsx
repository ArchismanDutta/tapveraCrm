import React, { useEffect, useMemo, useState } from "react";
import API from "../../api";
import Sidebar from "../../components/dashboard/Sidebar";
import {
  AlertCircle,
  Check,
  ChevronRight,
  Lock,
  Search,
  Shield,
  Sparkles,
} from "lucide-react";

// ============================================================================
// Role & Department Hierarchy Revamp v2 (2026-07-27) — Phase 2, Task 2.1.
// See docs/superpowers/specs/2026-07-27-role-hierarchy-revamp-design.md
//      docs/superpowers/plans/2026-07-27-role-hierarchy-revamp-plan.md
//
// A narrower sibling of AccessManagementPage.jsx: instead of the full
// org-wide Departments/Positions/Assign/Overview surface (super-admin only),
// this lets anyone whose Position holds `canManageSubordinateAccess` (Admin,
// seeded, today — see server/scripts/seedRoleHierarchyV2.js) view their own
// reporting tree and grant/revoke individual permission flags on people
// below them, bounded by three server-enforced rules every time
// (server/utils/accessControl.js's canManageAccessFor/grantableFlags):
//
//   1. Ceiling  — can't grant a flag you don't hold on your own Position.
//   2. Scope    — target must be inside your own accessible-users reach,
//                 and at a strictly lower level. No lateral/upward edits.
//   3. Root of trust — super-admin/admin are never reachable from here.
//
// Reuses existing endpoints rather than inventing new ones for the detail
// view: GET /api/positions/users/:userId/access-overview already returns
// exactly what's needed (position, effectivePermissions,
// permissionOverrides, recentAccessChanges) and already allows the "admin"
// role through its authorize() check.
// ============================================================================

// Same grouping/labels as AccessManagementPage.jsx's PERMISSION_GROUPS, kept
// as an independent copy here (small, ~21 entries) rather than a shared
// import — these two pages render fairly different layouts around the same
// vocabulary. Keep in sync with server/models/Position.js's `permissions`.
const PERMISSION_GROUPS = [
  {
    label: "Business management",
    keys: {
      canManageUsers: "Manage users",
      canManageClients: "Manage clients",
      canManageProjects: "Manage projects",
      canAssignTasks: "Assign tasks",
    },
  },
  {
    label: "HR & operations",
    keys: {
      canApproveLeaves: "Approve leaves",
      canApproveShifts: "Approve shifts",
      canViewReports: "View reports",
      canManageAttendance: "Manage attendance",
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
      canManageSubordinateAccess: "Delegate access to subordinates",
    },
  },
];
const PERMISSION_LABELS = PERMISSION_GROUPS.reduce((acc, g) => ({ ...acc, ...g.keys }), {});

const EmptyState = ({ title, description }) => (
  <div className="flex h-full min-h-[280px] flex-col items-center justify-center rounded-2xl border border-dashed border-slate-200 p-8 text-center dark:border-white/10">
    <Shield className="h-8 w-8 text-slate-300 dark:text-slate-600" />
    <p className="mt-3 text-sm font-semibold text-slate-700 dark:text-slate-200">{title}</p>
    {description && <p className="mt-1 max-w-xs text-xs text-slate-400">{description}</p>}
  </div>
);

const LoadingRows = () => (
  <div className="space-y-2">
    {[0, 1, 2].map((i) => (
      <div key={i} className="h-14 animate-pulse rounded-xl bg-slate-100 dark:bg-white/[0.04]" />
    ))}
  </div>
);

const MyTeamAccessPage = ({ onLogout }) => {
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);
  const [notification, setNotification] = useState(null);

  const [loading, setLoading] = useState(true);
  const [forbidden, setForbidden] = useState(false);
  const [team, setTeam] = useState([]);
  const [grantableFlags, setGrantableFlags] = useState([]);

  const [query, setQuery] = useState("");
  const [selectedUserId, setSelectedUserId] = useState("");
  const [detail, setDetail] = useState(null);
  const [detailLoading, setDetailLoading] = useState(false);
  const [savingFlag, setSavingFlag] = useState(null); // flag name currently being toggled

  const showNotification = (message, type) => setNotification({ message, type });
  useEffect(() => {
    if (!notification) return undefined;
    const t = window.setTimeout(() => setNotification(null), 3500);
    return () => window.clearTimeout(t);
  }, [notification]);

  const loadTeam = async () => {
    setLoading(true);
    setForbidden(false);
    try {
      const [teamRes, flagsRes] = await Promise.all([
        API.get("/api/positions/my-team"),
        API.get("/api/positions/my-team/grantable-flags"),
      ]);
      setTeam(teamRes.data || []);
      setGrantableFlags(flagsRes.data?.flags || []);
    } catch (err) {
      if (err?.response?.status === 403) {
        setForbidden(true);
      } else {
        console.error("Error loading my-team:", err);
        showNotification("Could not load your team's access.", "error");
      }
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadTeam();
    // eslint-disable-next-line react-hooks/exhaustive-deps -- mount-only load
  }, []);

  const selectUser = async (userId) => {
    setSelectedUserId(userId);
    setDetailLoading(true);
    setDetail(null);
    try {
      const res = await API.get(`/api/positions/users/${userId}/access-overview`);
      setDetail(res.data);
    } catch (err) {
      console.error("Error loading access overview:", err);
      showNotification("Could not load this person's access.", "error");
    } finally {
      setDetailLoading(false);
    }
  };

  const toggleFlag = async (flag, nextValue) => {
    if (!selectedUserId) return;
    setSavingFlag(flag);
    try {
      await API.patch(`/api/positions/my-team/${selectedUserId}/permissions`, { flag, value: nextValue });
      showNotification(`${nextValue ? "Granted" : "Revoked"} "${PERMISSION_LABELS[flag] || flag}".`, "success");
      // Refresh both the detail panel (effective permissions + audit trail)
      // and the team list (its "custom access" badge may now be stale).
      await Promise.all([selectUser(selectedUserId), loadTeam()]);
    } catch (err) {
      console.error("Error updating permission:", err);
      showNotification(err?.response?.data?.error || "Could not update this permission.", "error");
    } finally {
      setSavingFlag(null);
    }
  };

  const filteredTeam = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return team;
    return team.filter((u) => [u.name, u.email, u.employeeId].some((v) => v?.toLowerCase().includes(q)));
  }, [team, query]);

  return (
    <div className="relative flex h-[100dvh] overflow-hidden bg-slate-50 text-slate-900 dark:bg-[#0b0d12] dark:text-slate-100">
      <Sidebar collapsed={sidebarCollapsed} setCollapsed={setSidebarCollapsed} onLogout={onLogout} userRole="admin" />

      <main
        className={`h-[100dvh] min-w-0 flex-1 overflow-y-auto overflow-x-hidden px-3 py-4 transition-all duration-300 sm:px-5 lg:px-6 ${
          sidebarCollapsed ? "ml-16" : "ml-16 sm:ml-56"
        }`}
      >
        <div className="mx-auto max-w-[1300px] space-y-4 pb-8 sm:space-y-5">
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
                <h1 className="text-2xl font-semibold tracking-tight text-slate-950 dark:text-white">My Team's Access</h1>
                <p className="mt-1 max-w-2xl text-sm leading-6 text-slate-500 dark:text-slate-400">
                  Grant or revoke individual permissions for people below you in the hierarchy. You can only hand out
                  permissions you hold yourself, only to people already in your own reporting tree, and every change is logged.
                </p>
              </div>
            </div>
          </header>

          {forbidden ? (
            <EmptyState
              title="You don't have delegated access management permission"
              description={`Your current Position doesn't have "Delegate access to subordinates" enabled. Ask your Super Admin to grant it from Access Management → Positions & Permissions if you believe this is wrong.`}
            />
          ) : (
            <section className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm dark:border-white/10 dark:bg-[#10131c]">
              <div className="grid gap-0 lg:grid-cols-[300px,1fr]">
                {/* ---- Left: team list ---- */}
                <div className="border-b border-slate-200 p-4 dark:border-white/10 lg:border-b-0 lg:border-r">
                  <div className="relative">
                    <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
                    <input
                      value={query}
                      onChange={(e) => setQuery(e.target.value)}
                      placeholder="Find a team member"
                      className="h-10 w-full rounded-lg border border-slate-200 bg-white pl-9 pr-3 text-sm text-slate-900 outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-500/15 dark:border-white/10 dark:bg-[#151923] dark:text-white"
                    />
                  </div>

                  <div className="mt-3 max-h-[560px] space-y-1 overflow-y-auto pr-1">
                    {loading ? (
                      <LoadingRows />
                    ) : filteredTeam.length === 0 ? (
                      <p className="px-1 py-6 text-center text-xs text-slate-400">
                        {team.length === 0 ? "Nobody in your reporting tree yet." : "No matches."}
                      </p>
                    ) : (
                      filteredTeam.map((u) => (
                        <button
                          key={u._id}
                          type="button"
                          onClick={() => selectUser(u._id)}
                          className={`flex w-full items-center gap-2 rounded-lg px-3 py-2.5 text-left text-sm transition ${
                            selectedUserId === u._id
                              ? "bg-blue-50 text-blue-700 dark:bg-blue-400/10 dark:text-blue-200"
                              : "text-slate-600 hover:bg-slate-50 dark:text-slate-300 dark:hover:bg-white/[0.04]"
                          }`}
                        >
                          <div className="min-w-0">
                            <p className="truncate font-medium">{u.name}</p>
                            <p className="truncate text-xs text-slate-400">{u.position?.name || "No position"}</p>
                          </div>
                          {u.hasOverrides && (
                            <span className="ml-auto shrink-0 rounded-full border border-violet-200 bg-violet-50 px-1.5 py-0.5 text-[10px] font-medium text-violet-700 dark:border-violet-400/20 dark:bg-violet-400/10 dark:text-violet-200">
                              custom
                            </span>
                          )}
                          <ChevronRight className="h-3.5 w-3.5 shrink-0 opacity-50" />
                        </button>
                      ))
                    )}
                  </div>
                </div>

                {/* ---- Right: selected user's editor ---- */}
                <div className="p-4 sm:p-5">
                  {!selectedUserId ? (
                    <EmptyState
                      title="Pick a team member"
                      description="See what they can access today and adjust it, permission by permission."
                    />
                  ) : detailLoading || !detail ? (
                    <LoadingRows />
                  ) : (
                    <div className="space-y-4">
                      <div className="flex flex-wrap items-center justify-between gap-2">
                        <div>
                          <h3 className="text-sm font-semibold text-slate-900 dark:text-white">{detail.user.name}</h3>
                          <p className="text-xs text-slate-500 dark:text-slate-400">
                            {detail.position?.name || "No position"} · {detail.department?.name || "No department"}
                          </p>
                        </div>
                        <span className="inline-flex items-center gap-1.5 rounded-full border border-slate-200 px-2.5 py-1 text-xs text-slate-500 dark:border-white/10 dark:text-slate-400">
                          <Sparkles className="h-3 w-3" />
                          You can grant {grantableFlags.length} of {Object.keys(PERMISSION_LABELS).length} permissions
                        </span>
                      </div>

                      <div className="space-y-4">
                        {PERMISSION_GROUPS.map((group) => (
                          <div key={group.label}>
                            <p className="mb-2 text-xs font-medium text-slate-600 dark:text-slate-300">{group.label}</p>
                            <div className="grid gap-2 sm:grid-cols-2">
                              {Object.entries(group.keys).map(([key, label]) => {
                                const isOn = Boolean(detail.effectivePermissions?.[key]);
                                const isOverridden = detail.permissionOverrides?.[key] !== undefined;
                                const canGrant = grantableFlags.includes(key);
                                // Ceiling only blocks GRANTING — revoking an
                                // already-on flag never needs it (tightening
                                // access is always safe), matching the
                                // server-side rule in positionRoutes.js.
                                const disabled = savingFlag !== null || (!isOn && !canGrant);

                                return (
                                  <label
                                    key={key}
                                    title={
                                      !canGrant && !isOn
                                        ? "You can't grant this — you don't hold it yourself."
                                        : isOverridden
                                        ? "Set via a per-user override, not their Position template."
                                        : ""
                                    }
                                    className={`flex items-center gap-3 rounded-xl border p-3 text-sm transition ${
                                      disabled
                                        ? "cursor-not-allowed border-slate-100 text-slate-400 dark:border-white/5 dark:text-slate-600"
                                        : "cursor-pointer border-slate-200 text-slate-700 hover:bg-slate-50 dark:border-white/10 dark:text-slate-200 dark:hover:bg-white/[0.04]"
                                    }`}
                                  >
                                    <input
                                      type="checkbox"
                                      checked={isOn}
                                      disabled={disabled}
                                      onChange={(e) => toggleFlag(key, e.target.checked)}
                                      className="h-4 w-4 rounded border-slate-300 text-blue-600 focus:ring-blue-500 disabled:opacity-40"
                                    />
                                    <span className="flex-1">{label}</span>
                                    {!canGrant && !isOn && <Lock className="h-3.5 w-3.5 shrink-0 opacity-50" />}
                                    {isOverridden && (
                                      <span className="shrink-0 rounded-full border border-violet-200 bg-violet-50 px-1.5 py-0.5 text-[10px] font-medium text-violet-700 dark:border-violet-400/20 dark:bg-violet-400/10 dark:text-violet-200">
                                        custom
                                      </span>
                                    )}
                                  </label>
                                );
                              })}
                            </div>
                          </div>
                        ))}
                      </div>

                      {detail.recentAccessChanges?.length > 0 && (
                        <div className="rounded-xl border border-slate-200 p-3 dark:border-white/10">
                          <p className="text-xs font-semibold text-slate-700 dark:text-slate-200">Recent changes for {detail.user.name}</p>
                          <ul className="mt-2 divide-y divide-slate-100 dark:divide-white/10">
                            {detail.recentAccessChanges.slice(0, 5).map((entry) => (
                              <li key={entry._id} className="py-1.5 text-xs text-slate-500 dark:text-slate-400">
                                <span className="font-medium text-slate-700 dark:text-slate-200">{entry.actorId?.name || "Unknown"}</span>{" "}
                                {entry.action === "grant" ? "granted" : entry.action === "revoke" ? "revoked" : entry.action}{" "}
                                <span className="font-mono">{entry.flagOrPositionName}</span>
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
            </section>
          )}
        </div>
      </main>
    </div>
  );
};

export default MyTeamAccessPage;
