# Access Management System

How roles, departments, and positions control access in this CRM. Written after the 2026-07-03 access-management rework (see [`docs/superpowers/specs/2026-07-03-access-management-design.md`](../superpowers/specs/2026-07-03-access-management-design.md) for the original problem/design rationale, and [`docs/superpowers/plans/2026-07-03-access-management-rework.md`](../superpowers/plans/2026-07-03-access-management-rework.md) for the phase-by-phase implementation log), and updated for the 2026-07-27 role & department hierarchy revamp v2 (see [`docs/superpowers/specs/2026-07-27-role-hierarchy-revamp-design.md`](../superpowers/specs/2026-07-27-role-hierarchy-revamp-design.md) and its [companion plan](../superpowers/plans/2026-07-27-role-hierarchy-revamp-plan.md) — that plan's "What was actually verified" section is the accurate record of what's code-complete versus still needs to be run against a real database).

## The core idea

Two things decide what a user can do, and they answer different questions:

- **`User.role`** ("slim role") — a small system tier: `super-admin`, `admin`, `hr`, `employee` (or `client`). Answers "what kind of account is this" and gates broad, non-hierarchical product areas (the HR dashboard, Salary Management, the Access Management page itself). Super-admin bypasses all checks; it is the one true break-glass role.
- **`Position`** — the real organizational hierarchy: department, seniority level, an explicit reporting chain, and a concrete set of permission flags. Answers "what data can this specific person see and act on."

Before this rework, position was a free-text string on `User` (`"Team Lead"`, `"team lead - tech"`, `"TL"`, ...) matched by substring in a dozen different places. That's why a department's TL had no real, enforced meaning. Now `User.positionRef` points at a real `Position` document, and every access decision reads that document's fields instead of guessing from a string.

**Design rule: level ≠ automatic access.** A `Position.level` of 90 does not, by itself, grant HR access to Sales' pipeline. Data access is always decided by explicit permission flags plus `hierarchicalAccess.dataScope`. Level is only used for seniority/tie-breaking comparisons (e.g. "is this transfer-escalation target senior enough" in `transferController.js`).

## Data model

### `Department` (`server/models/Department.js`)
Admin-manageable list of departments (`name`, `code`, `status`). Replaces the old hardcoded department enum. `legacyEnumValue` bridges to the enum still present on `User.department`/`Position.department` for backward compatibility during the transition.

### `Position` (`server/models/Position.js`)
The real hierarchy unit.

| Field | Purpose |
|---|---|
| `name` | Unique display name, e.g. `"Team Lead — Tech"` |
| `level` (0–100) | Seniority/tie-breaking only — see rule above |
| `departmentRef` | Which `Department` this position belongs to (`null` = org-wide, e.g. Admin/HR) |
| `parentPosition` | Explicit reporting chain (self-referencing `Position` ref), e.g. Agent → Team Lead → Supervisor → Project Manager |
| `permissions.*` | 21 boolean flags — the actual grants (see table below) |
| `hierarchicalAccess.dataScope` | `"own"` \| `"team"` \| `"department"` \| `"all"` — how far `scopeQuery()` widens a data query |

`department` (string enum) and `position` (free-text string, on `User`) still exist and are kept in sync for backward compatibility. New code should always prefer `departmentRef`/`positionRef`. Removing the legacy fields entirely is Phase 6 (not done yet — see that plan doc's Rollback Plan).

### The 21 permission flags (`Position.permissions`)

| Flag | Grants |
|---|---|
| `canManageUsers` | Create/edit/list employees |
| `canManageDepartments` | Access Management → Departments tab |
| `canManagePositions` | Access Management → Positions tab |
| `canManageClients` | Client CRUD |
| `canManageProjects` | Project CRUD, status, milestones |
| `canAssignTasks` | Assign tasks to others, view workload |
| `canApproveLeaves` | Approve/reject leave requests |
| `canApproveShifts` | Approve shift requests, manage shift catalog |
| `canViewReports` | Analytics/reporting endpoints |
| `canManageAttendance` | Manual attendance edits, recalculation, holiday management |
| `canViewSubordinateLeads` / `canViewSubordinateCallbacks` | See leads/callbacks belonging to people below you in the chain |
| `canEditSubordinateLeads` / `canEditSubordinateCallbacks` | Edit/delete those |
| `canViewSubordinateTasks` / `canViewSubordinateProjects` | See subordinates' tasks/projects |
| `canAssignToSubordinates` | Reassign a subordinate's work to another subordinate |
| `canViewDepartmentLeads` / `canViewDepartmentCallbacks` / `canViewDepartmentTasks` | Department-wide (not just direct-report) visibility |
| `canManageSubordinateAccess` *(added 2026-07-27)* | Opens "My Team's Access" — grant/revoke the flags above for people below you, bounded by the ceiling/scope/root-of-trust rules described later in this doc |

### `User.permissionOverrides` (added 2026-07-27)

A `Map<string, boolean>` of rare, explicit per-user exceptions, layered on top of whatever the user's resolved `Position` grants. Default empty. Written only via `PATCH /api/positions/my-team/:userId/permissions` (see "Delegated permission editing" below) — never edited directly elsewhere. Kept intentionally small on purpose: a `Position` is a shared template (editing it changes everyone pointed at it — the exact "silent disconnect" failure class the 2026-07-03 rework eliminated), so wanting one person to permanently differ from their peers should usually mean cloning a new `Position`, not stacking overrides. The Access Overview tab and `MyTeamAccessPage.jsx` both show a "custom access" badge on any user with a non-empty map, specifically so overrides can't quietly sprawl into unaudited one-offs without anyone noticing.

## The permission engine (`server/utils/accessControl.js`)

Single choke point, replacing ~280 scattered `authorize("admin","hr",...)` / `req.user.role === "..."` checks.

- **`resolvePosition(user)`** — resolves `user.positionRef` to a `Position` doc; falls back to legacy free-text `user.position` string match (and logs a warning) if `positionRef` isn't set yet.
- **`evaluate(position, action, overrides?)`** — pure function, `action` → does this position (plus, since 2026-07-27, any `permissionOverrides`) have one of the flags in `ACTION_PERMISSION_MAP[action]`. The third argument is optional and backward compatible. No DB access, directly unit-tested in `server/tests/accessControl.test.js`.
- **`resolveEffectivePermissions(position, overrides)`** *(added 2026-07-27)* — pure function merging a Position's flags with a user's `permissionOverrides` (override wins when present). Used by `evaluate()`, `userController.getMyPermissions`, and the Access Overview endpoint so all three agree on what a user's access actually is.
- **`can(user, action, options)`** — the main entry point. Super-admin always `true`. `options.targetUserId` + `SELF_IMPLICIT_ACTIONS` grants a user access to their own data regardless of permissions. Admin with no resolved Position falls back to legacy full-bypass (logged) until an Admin Position is assigned.
- **`scopeQuery(user, resourceUserField)`** — returns a ready-to-spread Mongo filter (`{ assignedTo: { $in: [...] } }` or `{}` for unrestricted), delegating ID resolution to the pre-existing `hierarchyUtils.getAccessibleUserIds`.
- **`requirePermission(action)`** — Express middleware factory wrapping `can()`.
- **`ACTION_PERMISSION_MAP`** — maps an action string (e.g. `"leads:edit"`) to the permission flag(s) that satisfy it. Extend this when adding a new action; each entry should mirror a real field on `Position.permissions`.

**Migration pattern used throughout Phase 4:** never replace an old `authorize(...)` check outright. Instead, add a small `requireX`/`hasXAuthority` helper that ORs the new `can()` check with the original role list, so access only ever expands, never narrows. (The one deliberate exception — payroll/payslip/payment routes standardized onto `hr`+`super-admin` — was an explicit, discussed decision, not the default pattern.)

## Canonical hierarchy v1 (`server/scripts/seedCanonicalHierarchy.js`) — superseded

```
Admin (95)  — org-wide
HR (90)     — org-wide, HR-domain only (leave/shift/attendance/users), no business-data scope by default
Project Manager (70)  — per delivery department, dataScope: department
Supervisor (50)       — per delivery department, dataScope: team, parentPosition: PM
Team Lead (40)        — per delivery department, dataScope: team, parentPosition: Supervisor
Agent (10)            — per delivery department, dataScope: own, parentPosition: Team Lead
```

Delivery departments (full PM→Supervisor→TL→Agent chain) were configured via `DELIVERY_DEPARTMENT_CODES` in the script — `tech` and `marketingAndSales`. Executives/HR were staff functions and deliberately didn't get their own delivery chain.

**Superseded 2026-07-27** by the v2 hierarchy below — this identical-template-per-department shape is exactly what the 2026-07-27 revamp replaced, because Development/Sales/HR don't actually share one shape (Development has no PM, Sales has no Team Lead, HR is a flat ladder with neither). Left in place, not deleted, pending Phase 3 of the v2 plan (retire old positions once nothing real points at them).

## Canonical hierarchy v2 (`server/scripts/seedRoleHierarchyV2.js`, 2026-07-27)

Each operational department has the shape it actually has, instead of one template stamped onto all three. Numeric `level` is still cosmetic (seniority/tie-break only, same rule as v1) — access is always the explicit `permissions.*` flags + `hierarchicalAccess.dataScope`.

```
Admin (95) — org-wide, dataScope: all, canManageSubordinateAccess: true

Development                    Sales                          HR
------------                    -----                          --
Team Lead (65)                  Project Manager (70)           Senior HR (60)
   ↑ department scope              ↑ department scope             ↑ own scope, HR-domain flags
Supervisor (40)                 Supervisor (40)                Junior HR (30)
   ↑ team scope                    ↑ team scope                   ↑ team scope, HR-domain flags
Employee (15)                   Agent (10)                     HR Intern (5)
   ↑ own scope                     ↑ own scope                    ↑ own scope
Intern (5)
   ↑ own scope
```

Project Manager — Sales and Team Lead — Development are deliberately close in level (70/65), not one strictly above the other — they're lateral counterparts in different departments who hand off work to each other (PM retains overall project/client ownership; the actual handoff mechanics aren't built yet — see the design doc's Section 3), not manager/subordinate. Development has no PM tier; Sales has no Team Lead tier; HR has neither, just three flat seniority tiers. No Sales Intern tier (confirmed absent, not an oversight — easy to add later as a data change).

"Digital Marketing" / "Content Writer" / "SEO Expert" and similar are **not** separate Positions — they're free text in `User.designation`, relabeled "Specialization" in the employee form when department is Development. Filtering/reporting by specialty isn't built; if that becomes needed, that argues for a maintained suggestions list rather than pure free text (flagged, not built, in the design doc).

Running this script only upserts `Position` documents; it never touches `User` documents — same discipline as v1. One wrinkle specific to this script: it shares the literal name `"Admin"` with `seedCanonicalHierarchy.js`'s Admin position, deliberately — so an already-assigned Admin picks up `canManageSubordinateAccess` without needing reassignment. Because a plain `$setOnInsert` would silently no-op that flag onto an already-existing document, the script follows up with an explicit `$set` on `permissions.canManageSubordinateAccess` that always runs, insert or not.

**Two ways to run it (added 2026-07-27, follow-up session):** the original `node scripts/seedRoleHierarchyV2.js` from a terminal still works unchanged. Or, without touching a terminal or the database directly at all: Access Management → **Hierarchy setup** tab → "Apply v2 hierarchy setup" — calls `POST /api/hierarchy-setup/apply` (Super Admin only), which runs the exact same exported `seedRoleHierarchyV2()` function (and `applyDepartmentRenames()` for the department-rename step from "Canonical hierarchy v1" above) from inside the already-running, already-connected app. Both entry points share one implementation (`server/scripts/seedRoleHierarchyV2.js` / `updateDepartmentsV2.js` export the core function; the CLI is a thin wrapper around it), so there's no risk of the two drifting apart. Same for the migration report below: `node scripts/migrateToRoleHierarchyV2.js` or the same tab's "Load report", both backed by `generateMigrationReport()`.

## Delegated permission editing ("My Team's Access", added 2026-07-27)

Before this, only Super Admin could touch a Position's permissions or assign anyone to one (hardcoded `authorize("super-admin")`, not routed through the permission engine at all). Now anyone whose resolved Position has `canManageSubordinateAccess` (Admin, seeded, today) can grant or revoke individual permission flags on people below them — through `client/src/pages/admin/MyTeamAccessPage.jsx` (routed at `/my-team/access`), not the full super-admin-only Access Management page.

Every attempt is checked against three rules together, every time, via `server/utils/accessControl.js`:

1. **Ceiling** (`grantableFlags(grantorPosition)`) — a grantor can only turn a flag **on** for someone else if their own Position currently has that flag `true`. Revoking (turning a flag off) never needs this check, since tightening someone's access can't escalate privilege.
2. **Scope** (`canManageAccessFor(grantor, targetUser)` / pure core `evaluateManageAccess`) — the target must already be inside the grantor's own `hierarchyUtils.getAccessibleUserIds()` reach, and at a strictly lower `level` than the grantor. No lateral edits, no reaching into a department the grantor doesn't manage.
3. **Root of trust** — `role: "super-admin"` is never editable by anyone but itself; `role: "admin"` is only editable by Super Admin. Delegation only ever applies below Admin.

Grants/revokes are written to the target's `User.permissionOverrides` (see the Data model section above), never to the shared `Position` document — so one Admin adjusting one Agent's access can't silently change what every other Agent on that same Position can do. Every change is logged to `AccessAuditLog` (`server/models/AccessAuditLog.js`, append-only: `actorId`, `targetUserId`, `action`, `flagOrPositionName`, `previousValue`, `newValue`, timestamp) and surfaced two places: a "recent changes" list on `MyTeamAccessPage.jsx` itself, and folded into the existing Access Overview tab's `recentAccessChanges` field — so "why can this person do X" and "who gave them X and when" are answered from the same place.

Routes (`server/routes/positionRoutes.js`), none using a static `authorize(...)` list since the check is relationship-dependent per target user:

- `GET /api/positions/my-team` — people the caller may manage.
- `GET /api/positions/my-team/grantable-flags` — what the caller can currently hand out (drives the UI's disabled-with-tooltip toggles).
- `PATCH /api/positions/my-team/:userId/permissions` — body `{ flag, value }`; the actual grant/revoke.
- `POST /api/positions/my-team/positions` — scoped Position create/clone (ceiling-checked per flag, level must be below the creator's own); built, not yet wired to any UI.

This is designed to extend below Admin without a code change — any Position can be given `canManageSubordinateAccess` from Access Management → Positions & Permissions (it's a checkbox like any other flag). Only Admin is seeded with it as of 2026-07-27.

## The Access Management page (`client/src/pages/admin/AccessManagementPage.jsx`)

Routed at `/admin/access-management`, super-admin only. Five tabs, backed by `server/routes/departmentRoutes.js`, `server/routes/positionRoutes.js`, and (as of the 2026-07-27 follow-up session) `server/routes/hierarchySetupRoutes.js`:

- **Departments** — CRUD.
- **Positions & Permissions** — full permission grid (21 flags as of 2026-07-27), `parentPosition` picker, department dropdown (no free text). This — plus "Delegated permission editing" above for Admin's narrower version — **is** "a page to manage what access what roles get"; nothing further was needed there.
- **Assign Employees** — department → position → assign, reference-based (`PATCH /api/positions/users/:userId/assign` with `{ departmentId, positionId }`, not name strings).
- **Access Overview** — `GET /api/positions/users/:userId/access-overview`: pick any user, see their resolved department/position/*effective* permissions (Position + any `permissionOverrides`, with a "custom" badge on overridden flags), who they can/can't see, and (since 2026-07-27) their recent delegated-access changes. This is the answer to "why can't X see Y" — use this instead of the old one-off `server/diagnose-hierarchy.js` script.
- **Hierarchy setup** (added 2026-07-27, follow-up session) — status cards for whether the v2 departments/positions are seeded yet, an "Apply v2 hierarchy setup" button, and the migration report rendered as a table grouped by confidence (`uncertain`/`best-guess`/`direct`/`no-action-needed`) with a per-row "Apply" button that reassigns that one person via the same `PATCH .../assign` endpoint the Assign Employees tab uses. This is the UI for reassigning existing employees into the new hierarchy — see "Canonical hierarchy v2" above and the plan doc's Task 3.1b/3.2.

For Admin's narrower version of permission editing (own subordinates only, not the whole org), see "Delegated permission editing" above.

## Frontend consumption

`GET /api/users/me/permissions` (`userController.getMyPermissions`) is the single source of truth for the logged-in user's resolved access — computed server-side, not re-derived from `localStorage` strings. Returns `role`/`isSuperAdmin`/`isAdmin`/`isHR`/`bypass`, `department`, `position` (`id`/`name`/`level`/`dataScope`), the full `permissions` map, and a convenience `canAccessLeadManagement` boolean.

`Sidebar.jsx` and `App.jsx` both fetch this on load and use it to drive menu visibility and route gating (e.g. `isSupervisor`, `canAccessLeadManagement()`), falling back to the old string-matching logic only until the fetch resolves or if it fails — so a slow/failed fetch never locks anyone out.

## How to add a new department

1. Access Management → Departments → create it (or add it to `server/scripts/seedDepartments.js` for a fresh environment).
2. Give it its own hierarchy shape by adding positions for it in `server/scripts/seedRoleHierarchyV2.js` (or via Access Management → Positions & Permissions directly) — as of 2026-07-27 each department gets a shape that matches how it's actually run, not a shared template. (The older `DELIVERY_DEPARTMENT_CODES` array in `seedCanonicalHierarchy.js` still exists but is superseded — see "Canonical hierarchy v1" above.)
3. Assign employees to the new positions via Assign Employees.

## How to add a new position

Use Access Management → Positions & Permissions → create. Set `level` for seniority display only, pick a `departmentRef`, pick a `parentPosition` if it sits in a reporting chain, and check the specific permission flags it should have. No code change needed for a new position with an existing permission vocabulary.

## How to add a new permission/action

1. Add the boolean flag to `Position.permissions` in `server/models/Position.js`.
2. Add a matching entry to `ACTION_PERMISSION_MAP` in `server/utils/accessControl.js` (the action string is your choice, e.g. `"invoices:manage"`; map it to the new flag).
3. If the action should have a "you can always access your own" carve-out, add it to `SELF_IMPLICIT_ACTIONS`.
4. Add a `requireX`/`hasXAuthority` guard at the route/controller using `can(req.user, "your:action")`, following the existing OR-with-legacy-check pattern if a check already exists there.
5. Add unit coverage in `server/tests/accessControl.test.js` (Part 1, no DB needed).

## What's still transitional

From the 2026-07-03 rework (its own Phase 6, not done) — deliberately still present as a rollback safety net, **not** safe to remove until that plan's Phase 4/5 have soaked in production:

- `User.department` (enum) / `User.position` (free-text string) — superseded by `departmentRef`/`positionRef` but kept in sync.
- `Position.department` (enum) — superseded by `departmentRef`.
- `server/diagnose-hierarchy.js`, `server/fix-supervisor-position.js` — superseded by the Access Overview tab.
- `client/src/pages/admin/PositionManagement.jsx` and its route — superseded by `AccessManagementPage.jsx`.
- Shadow-mode comparison logging (`server/middlewares/accessShadowLog.js`) — compares old `hierarchyUtils` decisions against the new engine's; safe to remove per-module only after a few days of production traffic with no logged disagreements.

From the 2026-07-27 revamp v2 (its Phase 5, not started — see that plan's Rollback Plan section):

- `server/scripts/seedCanonicalHierarchy.js`'s positions (`"HR"`, `"Project Manager — Tech"`, `"Supervisor — Marketing & Sales"`, etc.) — superseded by "Canonical hierarchy v2" above, but not deactivated or deleted. Safe to soft-retire (`status: "inactive"`) only after `migrateToRoleHierarchyV2.js`'s report confirms zero active users still resolve to them, and safe to hard-delete only after that's soaked for a while — see that plan's Phase 3/5.
- `"Admin"` is the one v1 position name reused as-is by v2 (deliberately — see "Canonical hierarchy v2" above), so it isn't part of this retirement list.

See the plan doc's Phase 6 section for the removal checklist and its Rollback Plan section for why the order matters.
