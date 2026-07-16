# Access Management & Role Hierarchy — Design

**Date:** 2026-07-03
**Status:** Proposed — awaiting review
**Requested by:** Sahil (Tapvera)
**Priority:** High — foundational. TL/Supervisor/PM/department distinctions currently have no enforced meaning anywhere in the system.

---

## Executive Summary

Tapvera CRM's access control today is really **two disconnected systems** wearing one trenchcoat:

1. A crude 4-value `role` field (`super-admin`, `admin`, `hr`, `employee`) that gates routes and the sidebar. Every non-management employee — agent, TL, supervisor, project manager — collapses into the single bucket `employee`.
2. A genuinely well-designed `Position` model (levels, granular permissions, hierarchical data-scope rules) that was built to solve exactly this problem, but was only ever wired into 8 of the ~60 backend modules, is matched to users by **free-text string** instead of a real reference, and has an admin UI that doesn't even expose the fields that make it work.

The result is exactly what you're seeing: departments carry no real weight, "TL" is just a label someone typed into a text field, and the one place hierarchy *is* enforced (leads/callbacks) already broke in production once ([`server/fix-supervisor-position.js`](../../../server/fix-supervisor-position.js), [`server/diagnose-hierarchy.js`](../../../server/diagnose-hierarchy.js) — both are hand-run incident-recovery scripts, not features).

**Recommendation (confirmed with Sahil):**
- Keep `role` as a **slim system tier** — it barely changes, so barely anything that reads it today has to change.
- Make `Position` the **real hierarchy engine** — reference-based instead of string-matched, with a complete permission surface, department-scoped, actually enforced everywhere, and actually editable from the UI.
- Promote `Department` from a hardcoded enum to a **real, admin-managed collection**, so "Tech" (and any future department) is a data change, not a code deploy.
- Ship one **Access Management** page for super-admin that ties all three together: manage departments, manage positions/hierarchy/permissions, assign employees, and see who can access what.
- Roll this out in additive, reversible phases — nothing flips over in one shot. Detailed task breakdown is in the companion plan: [`docs/superpowers/plans/2026-07-03-access-management-rework.md`](../plans/2026-07-03-access-management-rework.md).

---

## Problem Statement — What's Actually Wrong

Everything below is grounded in the current code, not assumption.

### 1. `role` has 4 values and everyone non-management is "employee"

`server/models/User.js:62-63`:
```js
role: { type: String, enum: ["super-admin", "admin", "hr", "employee"], default: "employee" },
department: { type: String, enum: ["executives", "development", "marketingAndSales", "humanResource", ""], default: "" },
```
An agent, a TL, a supervisor, and a project manager are all `role: "employee"`. There is no `tech` department — the closest is `development`. `department` also defaults to `""`, so a user can exist with no department at all.

### 2. The Position model is good — and almost entirely unused

`server/models/Position.js` already defines levels (0-100), department scoping, 8 basic permission flags, and a `hierarchicalAccess` block (`accessLowerLevels`, `minimumLevelGap`, `canAccessPositions[]`, `dataScope: own|team|department|all`). This is the right shape for what you're asking for. But:

- It's matched to `User` by **free-text string equality** (`User.position === Position.name`), not an ObjectId reference. Rename a position and every user silently disconnects from it.
- The engine that reads it (`server/utils/hierarchyUtils.js`) is only called from **8 of ~60 controllers**: `leadController.js`, `callbackController.js`, `callIntelligenceController.js`, `taskController.js`, `paymentController.js`, `messageController.js`, `notepadController.js`, `leaveController.js`. Everything else — projects, clients, attendance, payroll, shifts, sheets, chat, HR — has no idea Position exists.
- `hierarchyUtils.js:12-21` hardcodes `admin` to see and edit *everyone*, same as super-admin. The hierarchy you're asking for (`admin` outranks `hr` outranks `pm`...) isn't actually expressed anywhere — `admin` just bypasses the whole system today.

### 3. The admin UI for Position doesn't expose the fields that matter

`client/src/pages/admin/PositionManagement.jsx:18-27` — the entire permission editor:
```js
const permissionLabels = {
  canManageUsers: "Manage users", canManageClients: "Manage clients",
  canManageProjects: "Manage projects", canAssignTasks: "Assign tasks",
  canApproveLeaves: "Approve leaves", canApproveShifts: "Approve shifts",
  canViewReports: "View reports", canManageAttendance: "Manage attendance",
};
```
That's 8 of the ~15 permission fields the schema defines. Everything that actually drives hierarchy — `canViewSubordinateLeads`, `canEditSubordinateCallbacks`, `canAssignToSubordinates`, and the entire `hierarchicalAccess` block (`accessLowerLevels`, `dataScope`, `canAccessPositions`) — **cannot be set from the UI at all.** The only way to configure them today is editing MongoDB directly or running a one-off script.

That's exactly what happened: `server/fix-supervisor-position.js` is a hand-written script a previous session ran directly against the database to patch a Supervisor's `dataScope` and `canAccessPositions` because there was no form field for it. `server/diagnose-hierarchy.js` exists because a real employee (Azad) couldn't see another real employee's (Rahul) leads, and someone had to write a diagnostic script to find out why. This is the direct, concrete cost of the current design — it already broke, in production, for real people.

### 4. Frontend gating is also stuck on 4 buckets

`client/src/components/dashboard/Sidebar.jsx:50-529` — `menuConfig` has exactly four keys: `employee`, `hr`, `admin`, `super-admin`. Position is only used cosmetically:
- Line 720-723: a user is treated as a supervisor if their position *string* contains `"supervisor"`, `"team lead"`, or `"manager"` — a substring match, not a real check.
- Line 753 / 767: Lead/Callback management is shown to `super-admin`, `admin`, anyone in `marketingAndSales`, **or anyone with any non-empty position string at all**. A "Content Writer" position would pass that check.
- Lines ~209-213, ~306-310, ~434-438: a `/roles` "Role Management" nav item is already written and commented out in three separate places. Someone already planned this exact feature and stopped short of shipping it.

`client/src/App.jsx:419-422` derives exactly three booleans for top-level route access — `isSuperAdmin`, `isAdmin`, `isHR` — everyone else (TL, supervisor, PM, agent) is undifferentiated.

### 5. A third, disconnected access axis already exists: regions

`docs/server/REGION_BASED_ACCESS_IMPLEMENTATION.md` documents `User.regions[]` / `Client.region`, used to filter which clients/projects a user sees. This is a completely separate mechanism from role and Position — a third axis nobody reconciled with the other two. Any new design needs to either absorb this or explicitly leave it alone; leaving it as a silent third system would make things worse, not better.

### 6. Authorization logic is duplicated everywhere instead of centralized

Grep counts: **108** calls to `authorize(...)` across 27 route files, plus **92** more inline `req.user.role === '...'` checks scattered across 22 controller/route files, plus **82** more role-string comparisons in the frontend across 30 files. There is no single choke point where "can this user do this?" is decided — it's reimplemented ad hoc at every call site, which is exactly how gaps like #4 happen and stay unnoticed.

### Bottom line

You don't need to invent a hierarchy engine — you already half-built one. It needs: a real reference instead of a string match, full UI coverage instead of half, enforcement in every module instead of 8, and one central choke point instead of 200 scattered ones.

---

## Target Architecture

### Design principle: level ≠ automatic access

One important call before the schema: **numeric level should drive seniority/tie-breaking, not automatically grant data access.** If HR sits above Project Manager in your chain, that should *not* silently mean HR can browse every department's sales pipeline just because their number is bigger. Actual access is controlled by explicit permission flags and `dataScope` per position, exactly like the existing Position model already intends. Level answers "who outranks whom"; permissions answer "who can see/do what." This keeps HR's authority scoped to the HR domain (leave, attendance, payroll, directory) org-wide, while PM/Supervisor/TL authority stays scoped to their own department's operational data. Flagging this now because it's the one place a literal reading of "superadmin→admin→hr→pm→supervisor→tl→agents" could over-grant if taken purely numerically.

### Three collections, one engine

```
Department (new)                 Position (upgraded)                User (lightly changed)
──────────────                   ────────────────────                ──────────────────────
name: "Tech"                     name: "Team Lead — Tech"            role: super-admin|admin|hr|employee   (unchanged enum)
code: "tech"                     department: → Department            department: → Department (ref, was enum)
status: active|inactive          level: 40                           position: → Position (ref, was free text)
createdBy, timestamps             parentPosition: → Position          positionLevel: cached from Position (unchanged field, now trustworthy)
                                  permissions: { …complete set }
                                  hierarchicalAccess: { dataScope, accessLowerLevels, minimumLevelGap }
                                  status: active|inactive
```

**Department** becomes a real collection instead of a hardcoded enum (per your choice — admin-manageable, seeded from the current 4 plus a distinct **Tech** department). This directly fixes "departments possess no prominence": a department becomes something with an identity, a set of positions, and a member list, not a string.

**Position** keeps its existing shape but gets three upgrades:
1. `department` becomes an ObjectId ref (was a duplicate hardcoded enum).
2. A new `parentPosition` ref, so the chain is explicit (`Agent.parentPosition = TL`, `TL.parentPosition = Supervisor`, ...) instead of inferred purely from numeric level + department match. This is what lets "Tech TL" and "Sales TL" both exist at level 40 without seeing into each other's teams.
3. The permission surface is completed and every field becomes editable from the UI (fixing problem #3 above).

**User** changes the least, on purpose (this is why "slim role" was the lower-rework option): `role` keeps its exact same 4 values and every existing `role === 'admin'` check keeps working unchanged. `department` and `position` switch from free text/enum to references — this is the one real migration, and it's what fixes problem #2's silent-disconnect failure mode for good.

### Proposed starting hierarchy

This is a starting point, not a locked-in matrix — once the Access Management page exists, super-admin can retune levels and permissions without a deploy. Seeded to match the chain you described:

| Level | Position | Scope | Department-bound? |
|------:|----------|-------|:---:|
| 100 | *(role: super-admin — bypasses everything, no Position row needed)* | all | no |
| 95 | Admin | all *(see note below)* | no |
| 90 | HR | HR-domain org-wide (leave/attendance/payroll/directory) | no |
| 70 | Project Manager | department | yes — one per department |
| 50 | Supervisor | team | yes — one per department |
| 40 | Team Lead (TL) | team | yes — one per department (Tech TL, Sales TL, ...) |
| 10 | Agent | own | yes |

**Note on Admin:** today `admin` silently bypasses everything, identically to super-admin (`hierarchyUtils.js:18-21`). If the hierarchy is going to mean anything at the top, not just the bottom, Admin's blanket bypass should become a real (very broad) permission set instead of a hardcoded bypass — still effectively "can do almost everything," but expressed as data, auditable, and adjustable, the same way TL's permissions will be. Flagging this as a recommendation, not assuming it.

`Agent` is deliberately the new name for what's currently the undifferentiated `employee` role — it becomes the default/base Position that any `role: "employee"` user gets if nothing else is assigned, so nobody ends up unassigned the way users can silently have `department: ""` today.

### Central permission engine (replacing 200 scattered checks)

One module, one shape, called everywhere instead of reimplemented everywhere:

```js
// server/utils/accessControl.js  (replaces the scattered logic, wraps hierarchyUtils)
can(user, action, options?)         // → boolean. e.g. can(user, "leads:edit", { targetUserId })
scopeQuery(user, resource, field)   // → Mongo filter, e.g. { assignedTo: { $in: [...] } } | {} for "all"
requirePermission(action)           // → Express middleware, replaces authorize(...) at route level
```

`role` remains a fast-path: `super-admin` short-circuits to `true` immediately, same as today. Below that, every decision reads from the user's resolved `Position` document (permissions + hierarchicalAccess + parentPosition chain), cached per-request. This is additive on top of `hierarchyUtils.js`, not a rewrite from scratch — the working parts (leads/callbacks hierarchy) stay working through the transition.

### Access Management page (super-admin only)

Replaces and absorbs `PositionManagement.jsx`. Four tabs:

1. **Departments** — list/create/rename/deactivate. Shows member count and position count per department.
2. **Positions & Permissions** — the fixed version of today's position editor: every permission flag (not 8 of 15), `parentPosition` picker (not a raw number), `dataScope`, department binding. This is where "TL" finally gets real, visible, editable teeth.
3. **Assign Employees** — replaces free-text position assignment with department + position dropdowns (impossible to typo-disconnect a user from their position anymore).
4. **Access Overview** — read-only audit view: pick a user, see exactly what they can access and why (which permission, which position, which chain) — directly answers "who can see what" without reading code or running a diagnostic script by hand.

This becomes the un-commented, finally-shipped version of the `/roles` nav item already sitting dormant in `Sidebar.jsx`.

---

## Migration & Compatibility Strategy

Nothing about this should be a big-bang cutover — the existing app needs to keep working at every intermediate step.

1. **Additive first.** New fields (`Department` collection, `Position.parentPosition`, `Position.department` as ref, `User.department`/`User.position` as refs) get added *alongside* the current string fields, not instead of them, until everything reading the old fields has been moved over.
2. **Backfill with a report, not a silent script.** Given the Azad/Rahul incident already happened once from an unreported mismatch, the migration script must produce a report of every user whose free-text `position`/`department` couldn't be cleanly resolved to a new reference, so those are fixed deliberately instead of silently defaulting.
3. **Shadow-mode verification.** Before any route switches from `authorize(...)` to the new `can(...)` engine, run both in parallel for a period and log disagreements, so gaps are caught before they change real behavior — the same category of bug that caused the original incident.
4. **Module-by-module rollout**, not all 60 controllers at once. Leads/callbacks are already on the hierarchy engine and become the reference implementation; everything else follows the same pattern in priority order (see plan).
5. **Regions stay out of scope for this rework** except that the new `dataScope` concept is designed so region-based filtering could plug in the same way later, rather than remaining a permanently separate third system. No region code changes in this project.

---

## What This Fixes, Directly

- "Departments possess no prominence" → Department becomes a real, admin-managed entity with members, positions, and a page of its own.
- "Roles like TL have no significance" → TL becomes a real Position with real, enforced, UI-editable permissions and data scope, not a free-text label nothing reads.
- "TL for the tech department" → `parentPosition` + department-bound positions mean Tech TL and Sales TL are two distinct, independently-configurable rows, not a name collision.
- "Super admin decides who has what access" → the Access Management page is exactly that control surface, for the first time.
- The Azad/Rahul-style failure mode → reference-based assignment can't silently disconnect the way string matching did, and the Access Overview tab makes "why can't X see Y" answerable in the UI instead of via a hand-written diagnostic script.

---

## Open Items for Review

Flagging these rather than deciding unilaterally, since they're judgment calls about how your org actually works:

1. **Admin's blanket bypass** — recommend converting to an explicit (very broad) permission set rather than a hardcoded "sees everything" shortcut. Confirm you want Admin reined in to "almost everything, but real permissions" rather than left as-is.
2. **HR's scope** — proposed as HR-domain org-wide (leave/attendance/payroll/people data) rather than literal access to every department's business data, despite outranking PM numerically. Confirm this matches how HR should actually behave.
3. **Project Manager scope** — proposed as department-scoped (sees their department's projects/tasks/team), not cross-department. Confirm PMs at Tapvera are department-bound rather than assigned across departments.
4. **Exact department seed list** — proposing Executives, Tech (renamed from "development"), Marketing & Sales, Human Resources as the initial four, all editable/expandable afterward. Confirm "Tech" is the right name and whether Marketing and Sales should stay merged or split.

Companion implementation plan: [`docs/superpowers/plans/2026-07-03-access-management-rework.md`](../plans/2026-07-03-access-management-rework.md)
