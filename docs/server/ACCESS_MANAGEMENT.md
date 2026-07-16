# Access Management System

How roles, departments, and positions control access in this CRM. Written after the 2026-07-03 access-management rework (see [`docs/superpowers/specs/2026-07-03-access-management-design.md`](../superpowers/specs/2026-07-03-access-management-design.md) for the original problem/design rationale, and [`docs/superpowers/plans/2026-07-03-access-management-rework.md`](../superpowers/plans/2026-07-03-access-management-rework.md) for the phase-by-phase implementation log).

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
| `permissions.*` | 20 boolean flags — the actual grants (see table below) |
| `hierarchicalAccess.dataScope` | `"own"` \| `"team"` \| `"department"` \| `"all"` — how far `scopeQuery()` widens a data query |

`department` (string enum) and `position` (free-text string, on `User`) still exist and are kept in sync for backward compatibility. New code should always prefer `departmentRef`/`positionRef`. Removing the legacy fields entirely is Phase 6 (not done yet — see that plan doc's Rollback Plan).

### The 20 permission flags (`Position.permissions`)

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

## The permission engine (`server/utils/accessControl.js`)

Single choke point, replacing ~280 scattered `authorize("admin","hr",...)` / `req.user.role === "..."` checks.

- **`resolvePosition(user)`** — resolves `user.positionRef` to a `Position` doc; falls back to legacy free-text `user.position` string match (and logs a warning) if `positionRef` isn't set yet.
- **`evaluate(position, action)`** — pure function, `action` → does this position have one of the flags in `ACTION_PERMISSION_MAP[action]`. No DB access, directly unit-tested in `server/tests/accessControl.test.js`.
- **`can(user, action, options)`** — the main entry point. Super-admin always `true`. `options.targetUserId` + `SELF_IMPLICIT_ACTIONS` grants a user access to their own data regardless of permissions. Admin with no resolved Position falls back to legacy full-bypass (logged) until an Admin Position is assigned.
- **`scopeQuery(user, resourceUserField)`** — returns a ready-to-spread Mongo filter (`{ assignedTo: { $in: [...] } }` or `{}` for unrestricted), delegating ID resolution to the pre-existing `hierarchyUtils.getAccessibleUserIds`.
- **`requirePermission(action)`** — Express middleware factory wrapping `can()`.
- **`ACTION_PERMISSION_MAP`** — maps an action string (e.g. `"leads:edit"`) to the permission flag(s) that satisfy it. Extend this when adding a new action; each entry should mirror a real field on `Position.permissions`.

**Migration pattern used throughout Phase 4:** never replace an old `authorize(...)` check outright. Instead, add a small `requireX`/`hasXAuthority` helper that ORs the new `can()` check with the original role list, so access only ever expands, never narrows. (The one deliberate exception — payroll/payslip/payment routes standardized onto `hr`+`super-admin` — was an explicit, discussed decision, not the default pattern.)

## Canonical hierarchy (`server/scripts/seedCanonicalHierarchy.js`)

```
Admin (95)  — org-wide
HR (90)     — org-wide, HR-domain only (leave/shift/attendance/users), no business-data scope by default
Project Manager (70)  — per delivery department, dataScope: department
Supervisor (50)       — per delivery department, dataScope: team, parentPosition: PM
Team Lead (40)        — per delivery department, dataScope: team, parentPosition: Supervisor
Agent (10)            — per delivery department, dataScope: own, parentPosition: Team Lead
```

Delivery departments (full PM→Supervisor→TL→Agent chain) are configured via `DELIVERY_DEPARTMENT_CODES` in the script — currently `tech` and `marketingAndSales`. Executives/HR are staff functions and deliberately don't get their own delivery chain. This produces distinct, independently-configurable positions per department (`"Team Lead — Tech"` vs `"Team Lead — Marketing & Sales"`) — the thing the old free-text system couldn't do.

Running this script only upserts `Position` documents; it never touches `User` documents. Assigning real employees to positions is a deliberate act via the Access Management page's Assign Employees tab, informed by `migrateToPositionRefs.js`'s mismatch report.

## The Access Management page (`client/src/pages/admin/AccessManagementPage.jsx`)

Routed at `/admin/access-management`, super-admin only. Four tabs, backed by `server/routes/departmentRoutes.js` and `server/routes/positionRoutes.js`:

- **Departments** — CRUD.
- **Positions & Permissions** — full permission grid, `parentPosition` picker, department dropdown (no free text).
- **Assign Employees** — department → position → assign, reference-based (`PATCH /api/positions/users/:userId/assign` with `{ departmentId, positionId }`, not name strings).
- **Access Overview** — `GET /api/positions/users/:userId/access-overview`: pick any user, see their resolved department/position/permissions and who they can/can't see. This is the answer to "why can't X see Y" — use this instead of the old one-off `server/diagnose-hierarchy.js` script.

## Frontend consumption

`GET /api/users/me/permissions` (`userController.getMyPermissions`) is the single source of truth for the logged-in user's resolved access — computed server-side, not re-derived from `localStorage` strings. Returns `role`/`isSuperAdmin`/`isAdmin`/`isHR`/`bypass`, `department`, `position` (`id`/`name`/`level`/`dataScope`), the full `permissions` map, and a convenience `canAccessLeadManagement` boolean.

`Sidebar.jsx` and `App.jsx` both fetch this on load and use it to drive menu visibility and route gating (e.g. `isSupervisor`, `canAccessLeadManagement()`), falling back to the old string-matching logic only until the fetch resolves or if it fails — so a slow/failed fetch never locks anyone out.

## How to add a new department

1. Access Management → Departments → create it (or add it to `server/scripts/seedDepartments.js` for a fresh environment).
2. If it needs its own delivery chain (PM/Supervisor/TL/Agent), add its code to `DELIVERY_DEPARTMENT_CODES` in `seedCanonicalHierarchy.js` and re-run the script (it's idempotent).
3. Assign employees to the new positions via Assign Employees.

## How to add a new position

Use Access Management → Positions & Permissions → create. Set `level` for seniority display only, pick a `departmentRef`, pick a `parentPosition` if it sits in a reporting chain, and check the specific permission flags it should have. No code change needed for a new position with an existing permission vocabulary.

## How to add a new permission/action

1. Add the boolean flag to `Position.permissions` in `server/models/Position.js`.
2. Add a matching entry to `ACTION_PERMISSION_MAP` in `server/utils/accessControl.js` (the action string is your choice, e.g. `"invoices:manage"`; map it to the new flag).
3. If the action should have a "you can always access your own" carve-out, add it to `SELF_IMPLICIT_ACTIONS`.
4. Add a `requireX`/`hasXAuthority` guard at the route/controller using `can(req.user, "your:action")`, following the existing OR-with-legacy-check pattern if a check already exists there.
5. Add unit coverage in `server/tests/accessControl.test.js` (Part 1, no DB needed).

## What's still transitional (Phase 6, not done)

These are deliberately still present as a rollback safety net and are **not** safe to remove until Phase 4/5 have soaked in production:

- `User.department` (enum) / `User.position` (free-text string) — superseded by `departmentRef`/`positionRef` but kept in sync.
- `Position.department` (enum) — superseded by `departmentRef`.
- `server/diagnose-hierarchy.js`, `server/fix-supervisor-position.js` — superseded by the Access Overview tab.
- `client/src/pages/admin/PositionManagement.jsx` and its route — superseded by `AccessManagementPage.jsx`.
- Shadow-mode comparison logging (`server/middlewares/accessShadowLog.js`) — compares old `hierarchyUtils` decisions against the new engine's; safe to remove per-module only after a few days of production traffic with no logged disagreements.

See the plan doc's Phase 6 section for the removal checklist and its Rollback Plan section for why the order matters.
