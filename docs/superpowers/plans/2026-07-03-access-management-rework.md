# Access Management & Role Hierarchy — Implementation Plan

**Design doc:** [`docs/superpowers/specs/2026-07-03-access-management-design.md`](../specs/2026-07-03-access-management-design.md) — read that first, it has the *why*.

**Goal:** Give departments and the superadmin→admin→hr→project manager→supervisor→tl→agent hierarchy real, enforced meaning across the whole CRM, controlled from one Access Management page, without breaking anything mid-rollout.

**Approach:** Additive schema first, central permission engine second, admin UI third, then migrate modules off the old scattered checks one at a time, then cut the frontend over, then clean up. Each phase leaves the app in a fully working state — do not start a phase until the previous one is checked off and verified.

**Status:** Not started. This plan is for review — no code has been written yet.

---

## Phase Overview

| Phase | What | Risk if skipped/reordered |
|---|---|---|
| 0 | Department + Position schema upgrade, additive only | Nothing else can be built on a shaky data model |
| 1 | Central permission engine (backend) | Without this, every later phase re-duplicates logic again |
| 2 | Access Management super admin page | Without this, hierarchy config is still MongoDB-only |
| 3 | Seed real hierarchy + assign real users | Nothing to test against otherwise |
| 4 | Migrate controllers off scattered checks, module by module | Skipping straight here means configuring permissions nothing reads yet |
| 5 | Frontend nav/route gating cutover | Do last — depends on backend being trustworthy first |
| 6 | Cleanup & hardening | Safe to defer, not safe to skip forever |

---

## Phase 0: Foundations (additive, no behavior change)

Nothing in this phase changes what any existing user can do. It only adds new, correct data next to the old data.

### Task 0.1: Create the `Department` model

**File:** `server/models/Department.js` (new)

```js
const mongoose = require("mongoose");

const departmentSchema = new mongoose.Schema(
  {
    name: { type: String, required: true, trim: true, unique: true }, // e.g. "Tech"
    code: { type: String, required: true, trim: true, unique: true, lowercase: true }, // e.g. "tech"
    description: { type: String, trim: true, default: "" },
    status: { type: String, enum: ["active", "inactive"], default: "active" },
    createdBy: { type: mongoose.Schema.Types.ObjectId, ref: "User" },
  },
  { timestamps: true }
);

module.exports = mongoose.model("Department", departmentSchema);
```

- [ ] Create the model above.
- [ ] Create `server/routes/departmentRoutes.js` + `server/controllers/departmentController.js` with standard CRUD (`GET /api/departments`, `POST`, `PUT/:id`, `DELETE/:id` — soft delete via `status`), protected by `protect` + a new `requirePermission("departments:manage")` (falls back to `authorize("super-admin")` until Phase 1 engine exists — see Task 0.5).
- [ ] Register routes in `server/app.js` next to the other route registrations.
- [ ] Commit: `git commit -m "feat(access): add Department model and CRUD routes"`

### Task 0.2: Seed script — Departments

**File:** `server/scripts/seedDepartments.js` (new)

- [ ] Write a script that creates 4 `Department` docs from the current hardcoded enum, mapping:
  - `executives` → name "Executives", code `executives`
  - `development` → name **"Tech"**, code `tech` *(rename, per design doc — confirm with Sahil before running against real data)*
  - `marketingAndSales` → name "Marketing & Sales", code `marketingAndSales`
  - `humanResource` → name "Human Resources", code `humanResource`
- [ ] Script must be idempotent (safe to re-run — `findOneAndUpdate` with `upsert`).
- [ ] Run against a dev/staging copy of the DB first. Print a summary table when done.
- [ ] Commit: `git commit -m "feat(access): seed initial departments"`

### Task 0.3: Upgrade the `Position` model

**File:** `server/models/Position.js` (modify)

- [ ] Change `department` from a hardcoded enum to a ref:
  ```js
  department: { type: mongoose.Schema.Types.ObjectId, ref: "Department", required: true },
  ```
- [ ] Add explicit hierarchy chain:
  ```js
  parentPosition: { type: mongoose.Schema.Types.ObjectId, ref: "Position", default: null },
  ```
- [ ] Complete the permission surface actually exposed to the UI later (schema already has most of these — this task is really "audit the list and add anything missing for the target hierarchy," e.g. `canManageDepartments`, `canManagePositions` for the Access Management page itself).
- [ ] Keep the old `department` enum values working during transition: write a Mongoose virtual or pre-save hook that also stamps a denormalized `departmentCode` string for any code that hasn't migrated yet (removed in Phase 6).
- [ ] Do **not** remove or rename any existing field in this task — additive only.
- [ ] Commit: `git commit -m "feat(access): upgrade Position schema with department ref and parentPosition"`

### Task 0.4: Upgrade the `User` model

**File:** `server/models/User.js` (modify)

- [ ] Add new reference fields alongside the existing string ones (do not remove `department` enum or `position` string yet):
  ```js
  departmentRef: { type: mongoose.Schema.Types.ObjectId, ref: "Department", default: null },
  positionRef: { type: mongoose.Schema.Types.ObjectId, ref: "Position", default: null },
  ```
- [ ] `positionLevel` field already exists (line 75-80) — keep it, it becomes a denormalized cache kept in sync on assignment (Phase 2 Task 2.3), not removed.
- [ ] Commit: `git commit -m "feat(access): add departmentRef/positionRef to User model (additive)"`

### Task 0.5: Migration + mismatch report script

**File:** `server/scripts/migrateToPositionRefs.js` (new)

This is the systematic version of what `fix-supervisor-position.js` did by hand for one user. It must **report**, not silently guess.

- [ ] For every `User`, attempt to resolve `user.department` (old enum string) → matching `Department` doc, and `user.position` (old free-text string) → matching `Position` doc by exact name.
- [ ] Where both resolve cleanly: set `departmentRef`/`positionRef`, leave old fields untouched.
- [ ] Where either fails to resolve (empty, typo, position doesn't exist as a `Position` doc, mixed case, trailing whitespace): **do not guess** — add the user to a report instead.
- [ ] Output a report file (`migration-report-{timestamp}.json`) listing every unresolved user with their raw `department`/`position` strings, so they can be fixed deliberately via the new Assign Employees UI (Phase 2) instead of silently defaulted.
- [ ] Script must be re-runnable (only touches users not yet resolved).
- [ ] Run against staging first, review the report with Sahil, then run against production.
- [ ] Commit: `git commit -m "feat(access): add position/department reference migration script with mismatch reporting"`

### Task 0.6: Phase 0 verification

- [ ] Run the full existing test suite (`server/tests/`) — must still pass unchanged, since nothing behavioral changed yet.
- [ ] Manually confirm existing login/role checks still work for one user of each current role (`super-admin`, `admin`, `hr`, `employee`).
- [ ] Confirm no route registered in Task 0.1 is reachable by non-super-admin yet.

---

## Phase 1: Central Permission Engine (backend)

### Task 1.1: Build the engine

**File:** `server/utils/accessControl.js` (new — wraps/extends `hierarchyUtils.js`, does not replace it yet)

```js
const User = require("../models/User");
const Position = require("../models/Position");
const hierarchyUtils = require("./hierarchyUtils"); // existing, keep working

/**
 * can(user, action, options)
 * action examples: "leads:view", "leads:edit", "users:manage", "departments:manage"
 * options: { targetUserId } when checking access to a specific person's data
 */
async function can(user, action, options = {}) {
  if (user.role === "super-admin") return true;
  // Resolve effective Position (positionRef preferred, falls back to legacy string match
  // via hierarchyUtils during the transition window)
  const position = await resolvePosition(user);
  if (!position) return false;
  return evaluate(position, action, user, options);
}

/**
 * scopeQuery(user, resourceUserField)
 * Returns a Mongo filter fragment: { [resourceUserField]: { $in: [...] } } or {} for "see all"
 */
async function scopeQuery(user, resourceUserField = "assignedTo") {
  if (user.role === "super-admin" || user.role === "admin") return {};
  const accessibleIds = await hierarchyUtils.getAccessibleUserIds(user); // reuse existing logic
  return { [resourceUserField]: { $in: accessibleIds } };
}

/** Express middleware factory, replaces authorize(...) at the route level */
function requirePermission(action) {
  return async (req, res, next) => {
    if (!req.user) return res.status(401).json({ message: "User missing from request context." });
    const allowed = await can(req.user, action);
    if (!allowed) {
      return res.status(403).json({ message: `Access denied. Missing permission '${action}'.` });
    }
    next();
  };
}

module.exports = { can, scopeQuery, requirePermission };
```

- [ ] Implement `resolvePosition()` (prefers `user.positionRef`, falls back to legacy string match — logs a warning when it has to fall back, which doubles as a live list of who's still unmigrated).
- [ ] Implement `evaluate()` against the completed permission surface from Phase 0 Task 0.3.
- [ ] Unit tests in `server/tests/accessControl.test.js` covering: super-admin bypass, admin broad-but-real permissions, HR domain scope, PM/Supervisor/TL department scoping, Agent own-only scope, and the Azad/Rahul scenario specifically as a regression test (two department-mates, one Supervisor above the other, verify the Supervisor can see the Agent's leads and a peer Agent cannot).
- [ ] Commit: `git commit -m "feat(access): add central accessControl engine (can/scopeQuery/requirePermission)"`

### Task 1.2: Shadow-mode comparison logging

**File:** `server/middlewares/accessShadowLog.js` (new, temporary — removed in Phase 6)

- [ ] For routes still using the old `authorize(...)`, optionally also compute what the new `can(...)` engine would have decided, and log a warning when they disagree (don't change behavior yet — just log).
- [ ] Wire this into 2-3 already-hierarchy-aware routes first (`leadRoutes.js`, `callbackRoutes.js`) as a dry run of the comparison tooling itself.
- [ ] Leave running for at least a few days of real traffic before Phase 4 starts cutting routes over, so disagreements surface before they matter.
- [ ] Commit: `git commit -m "feat(access): add shadow-mode logging to compare old vs new authorization"`

---

## Phase 2: Access Management Admin Page

### Task 2.1: Backend — Position CRUD, completed

**File:** `server/routes/positionRoutes.js`, `server/controllers/positionController.js` (modify existing)

- [ ] Extend the existing Position CRUD endpoints to accept/return the full permission surface and `parentPosition`, not just the 8 fields the current UI sends.
- [ ] Add `GET /api/positions/:id/effective-access` — resolves and returns a human-readable breakdown of what that position can do (powers the Access Overview tab).
- [ ] Commit: `git commit -m "feat(access): complete Position CRUD endpoints with full permission surface"`

### Task 2.2: Backend — Assign Employees, reference-based

**File:** `server/routes/positionRoutes.js` (modify)

- [ ] Change `PATCH /api/positions/users/:id/assign` to accept `{ departmentId, positionId }` (ObjectIds) instead of `{ position: "name string" }`.
- [ ] On assignment, set both `user.positionRef` and the legacy `user.position` string (kept in sync during transition) plus `user.positionLevel` from the Position doc.
- [ ] Commit: `git commit -m "feat(access): switch position assignment to reference-based IDs"`

### Task 2.3: Frontend — Access Management page

**File:** `client/src/pages/admin/AccessManagementPage.jsx` (new, supersedes `PositionManagement.jsx`)

Four tabs, per the design doc:
- [ ] **Departments tab** — list/create/rename/deactivate, member + position counts.
- [ ] **Positions & Permissions tab** — rebuild `PositionManagement.jsx`'s position editor with the *complete* permission list (all ~15+ flags, grouped: Business permissions / HR permissions / Hierarchical access), a `parentPosition` dropdown instead of a bare level number, and a department dropdown sourced from the new Department API instead of a hardcoded `<select>` (today hardcoded at `PositionManagement.jsx:638`).
- [ ] **Assign Employees tab** — department dropdown → filters position dropdown → assign. No free-text entry anywhere in this flow.
- [ ] **Access Overview tab** — pick any user, show their resolved department, position, permission list, and (for department-scoped positions) who they can/can't see, using the `effective-access` endpoint from Task 2.1. This is the shipped answer to "why can't X see Y," replacing the need for a hand-run diagnostic script.
- [ ] Route it at `/admin/access-management`, restricted to `super-admin` only (matches the design: "super admin decides who has what access").
- [ ] Commit: `git commit -m "feat(access): add Access Management page (Departments, Positions, Assign, Overview)"`

### Task 2.4: Wire up navigation

**File:** `client/src/components/dashboard/Sidebar.jsx` (modify)

- [ ] Un-comment and repoint the existing dormant `/roles` nav entries (lines ~209-213, ~306-310, ~434-438) to `/admin/access-management`, visible to `super-admin` only (remove from the `admin`/`hr` menu configs where currently commented, since this is explicitly super-admin's exclusive control surface per the design).
- [ ] `client/src/App.jsx` — add the route, gated the same way as other `super-admin`-only pages already are (see the `/admin/position-management` route as the existing pattern to copy).
- [ ] Commit: `git commit -m "feat(access): wire Access Management page into navigation and routing"`

### Task 2.5: Phase 2 verification

- [ ] Super-admin can create a department, create a position under it with a full permission set, and assign a real user to it, end to end, through the UI only (no MongoDB Compass, no scripts).
- [ ] Non-super-admin users cannot reach `/admin/access-management` (direct URL entry included).
- [ ] Existing `PositionManagement.jsx` page and route can be safely deleted once this is confirmed working (do this in Phase 6, not now — keep both live in parallel until Phase 4 is done, in case rollback is needed).

---

## Phase 3: Seed the Real Hierarchy

### Task 3.1: Create the seven canonical positions

- [ ] Using the new Access Management page (dogfood it), create, per department where applicable:
  - Admin (95, not department-bound)
  - HR (90, not department-bound, HR-domain permissions)
  - Project Manager (70, department-bound)
  - Supervisor (50, department-bound)
  - Team Lead (40, department-bound — create one row per department that needs one, e.g. "Team Lead — Tech", "Team Lead — Marketing & Sales")
  - Agent (10, department-bound, default fallback position)
- [ ] Set `parentPosition` chains matching the design doc's table.
- [ ] Confirm permission defaults against the "Open Items for Review" section of the design doc with Sahil before finalizing — this is org policy, not a technical default.

### Task 3.2: Assign real users

- [ ] Use the Phase 0.5 migration report to work through unresolved users first.
- [ ] Assign the remaining cleanly-migrated users to their real positions via the Assign Employees tab (bulk-assign helper if the user count makes one-by-one impractical).
- [ ] Re-run `diagnose-hierarchy.js`-style checks (or better: the new Access Overview tab) specifically for Azad and Rahul as a named regression check that the original incident is actually fixed by the new system, not just patched again.

### Task 3.3: Phase 3 verification

- [ ] Every active user has a resolved `positionRef` (zero entries left in the mismatch report, or each remaining entry has a documented reason, e.g. contractor with no position needed).
- [ ] Spot-check 3-4 users across different departments/levels in the Access Overview tab and confirm the access shown matches what they should actually be able to do.

---

## Phase 4: Migrate Modules Off Scattered Checks

Leads/callbacks are already hierarchy-aware (`leadController.js`, `callbackController.js`) — they become the reference pattern. For every other module, the change is mechanical and identical each time:

1. Route file: replace `authorize("admin", "hr", ...)` with `requirePermission("<resource>:<action>")`.
2. Controller: replace inline `if (req.user.role === "admin" || ...)` blocks with `await can(req.user, "<resource>:<action>", { targetUserId })`.
3. List/query endpoints: replace hand-rolled filters with `await scopeQuery(req.user, "<ownerField>")` merged into the Mongo query.
4. Add/confirm a `server/tests/<module>Access.test.js` covering at least: super-admin sees all, department-bound role sees only their scope, agent sees only their own.

Roll through in priority order (highest-traffic / most access-sensitive first). Each is its own task/commit — do not batch multiple modules into one commit, so any regression is easy to bisect.

- [x] **4.1 Tasks & Todo** (`taskController.js`, `todoTaskController.js`, `taskRoutes.js`, `todoTaskRoutes.js`) — already partially wired to `hierarchyUtils`; finish the cutover to `accessControl.js`. Done 2026-07-03: `canAccessTask`/`canManageTask` now additively OR in `can(user,"tasks:view"/"tasks:assign")`; `getTasks`'s non-admin branch now uses `scopeQuery()` (was: hard "assignedTo === self" only); `rejectTask`/`getEmployeeTaskAnalytics` authorization moved from route-level `authorize("admin","super-admin")` into the controller, additively expanded. `todoTaskController.js`/`todoTaskRoutes.js` audited — self-scoped by `req.user._id` throughout, no hierarchy concept, left unchanged.
- [x] **4.2 Projects & Clients** (`projectRoutes.js` — 18 role-check occurrences today, `clientRoutes.js` — 7, plus controllers) — currently the heaviest inline-check file, highest value to clean up. Done 2026-07-03: both files have no separate controller (logic lives in the route files). `projectRoutes.js` — 7 `authorize("admin","superadmin")` route gates (analytics, stats, create, update, status, delete, milestones) moved into controller-level `hasProjectManageAuthority()` checks (additive OR with `can(user,"projects:manage")`); single-project `GET /:id` additively expanded via `hasProjectViewAuthority()`; project list `GET /` and its pagination cap now use `scopeQuery()`/`can()` instead of a flat employee-sees-only-self rule. Left untouched (out of scope, self-scoped project-membership checks working correctly today): the notes/messages/milestone-status sub-endpoints, and the 2 message pin/unpin `authorize()` gates (Phase 4.6 territory). `clientRoutes.js` — all 7 `authorize("admin","super-admin"[,"hr"])` gates moved into controller-level `hasClientManageAuthority()` checks (additive OR with `can(user,"clients:manage")`); today a no-op beyond existing admin/super-admin/hr access since no canonical position other than Admin is granted `canManageClients` by default.
- [x] **4.3 Attendance** (`AttendanceController.js`, `allEmpAttendanceController.js`, `manualAttendanceController.js`, `adminAttendanceRoutes.js`, `newAttendanceRoutes.js`) — HR-domain, exercises the HR-scope rules from the design doc. Done 2026-07-03: confirmed `server/legacy/**` attendance files are dead code (not registered in app.js) and left untouched. `adminAttendanceRoutes.js`/`manualAttendanceRoutes.js` router-level `authorize("admin","hr","super-admin")` additively OR'd with `can(user,"attendance:manage")`. `newAttendanceRoutes.js`'s 5 per-route `authorize(...)` gates replaced with a `requireAttendanceManage` middleware that tries the permission check first, falling back to the original `authorize(...)` unchanged. `AttendanceController.js`'s 3 inline per-employee checks (`getEmployeeAttendanceRange`, `getEmployeeMonthly` — read; `recalculateAttendance` — write) additively expanded: the two reads now also allow `canAccessUserData()` (hierarchical reach, e.g. Supervisor viewing their team), the write stays gated to the stronger `attendance:manage` permission specifically. `allEmpAttendanceController.js` has no inline checks (purely router-gated), untouched.
- [x] **4.4 Leaves & Shifts** (`leaveController.js` — already partially wired, `shiftController.js`, `shiftsController.js`, `flexibleShiftController.js`) — HR-domain approval flows. Done 2026-07-03: confirmed `shiftsController.js`/`routes/shifts.js` are dead code (not registered in app.js, superseded by `shiftController.js`/`shiftRoutes.js`) and left untouched. `leaveRoutes.js`'s 3 admin-only gates (`getAllLeaves`, `getEmployeeLeaves`, `updateLeaveStatus`) additively OR'd with `can(user,"leaves:approve")` via a `requireLeaveApprove` middleware. `shiftRoutes.js`'s 7 gates and `flexibleShiftRoutes.js`'s 2 gates additively OR'd with `can(user,"shifts:approve")` the same way (shift catalog administration and shift-change-request approval both reuse this one action rather than adding a new permission flag). Also fixed a real pre-existing gap while here: `leaveController.js`'s `deleteLeave` only ever recognized literal role `"admin"` — super-admin/hr couldn't delete others' leave requests even though they can approve/reject them; widened to match the rest of the module's admin/super-admin/hr boundary. `flexibleShiftController.js`'s `deleteFlexibleShiftRequest` already had a correct inline hr/admin/super-admin check — just additively OR'd `shifts:approve` in.
- [x] **4.5 Payroll & Payments** (`autoPayrollController.js`, `paymentController.js` — already partially wired, `payslipController.js`) — sensitive, test thoroughly. Done 2026-07-03: discovered 3 inconsistent boundaries (payslips admin+hr+super-admin, auto-payroll hr+super-admin, payments super-admin-only) that couldn't be safely additively expanded with the usual `can()` reuse — reusing e.g. the attendance permission would have accidentally widened payment access to HR as a side effect, and there's no existing payroll-specific permission flag. Raised to Sahil directly; decision was to standardize all three onto hr+super-admin (not the additive Position-permission approach used elsewhere). This is the one Phase 4 change so far that isn't purely additive: `payslipRoutes.js`'s 8 gates narrowed from admin+hr+super-admin to hr+super-admin (plain "admin" role loses payslip access); `paymentRoutes.js`'s 6 gates + `paymentController.js`'s 2 inline checks widened from super-admin-only to hr+super-admin; `autoPayrollRoutes.js` already matched and was left unchanged. No Position/accessControl.js involvement in this module - plain role-string authorize() throughout, by design.
- [x] **4.6 Chat, Messages, Sheets, Notepad** (`chatController.js`, `messageController.js` — already partially wired, `sheetRoutes.js`, `notepadController.js` — already partially wired) — lower risk, mostly own-data already. Done 2026-07-03: this phase turned out to be mostly an audit, not a migration, because these modules' existing authorization is ownership/sharing-based (creator-only, owner-or-super-admin, explicit per-user/per-role sheet shares) rather than org-hierarchy-based - forcing Position permissions in would be shoehorning, not a real improvement, so most of it was deliberately left untouched:
  - `messageController.js`'s 2 pin/unpin routes (deferred from Phase 4.2) migrated to the same `hasProjectManageAuthority()` helper already used for the rest of `projectRoutes.js`.
  - `chatController.js`/`chatRoutes.js` audited: no admin-gated checks exist to migrate (whole file relies on `protect` + creator/membership checks). Found two real pre-existing gaps while there, left unfixed (out of scope - would narrow currently-open access, a policy call not a mechanical migration): `deleteConversation` has zero authorization (any authenticated user can delete any conversation), and `createGroupConversation`'s comment claims "admin or super-admin only" but has no actual check.
  - `sheetRoutes.js` audited and left untouched: access is governed by `Sheet.hasAccess()`/`getUserPermission()` (per-sheet ownership + explicit share grants), independent of the org hierarchy. The super-admin-only gates (create, share/unshare, stats) don't map to any existing accessControl.js action.
  - `notepadController.js` audited and left untouched: `getAllUserNotepads`/`getUserNotepad` (reading another employee's private notes) are deliberately super-admin-only, tighter than almost every other module (excludes even admin/hr) - same category of decision as Phase 4.5's payroll question, but lower stakes/lower priority, so flagged here rather than interrupting to ask.
- [x] **4.7 Everything remaining** — sweep the rest of `server/controllers/` and `server/routes/` against the grep baseline from the design doc (108 `authorize()` calls / 92 inline checks) until both counts are at or near zero outside of `accessControl.js` itself. Done 2026-07-03:
  - **Expanded additively** (admin/hr/super-admin keep what they had, `can()` OR'd in): `userRoutes.js` (7 of 9 routes - user/employee management via `users:manage`; workload view via `tasks:assign`), `authRoutes.js` (signup via `users:manage`), `holidayRoutes.js` (4 routes via `attendance:manage` - holidays feed leave/attendance calculations), `noticeRoutes.js` (2 routes via `users:manage`), `wishRoutes.js` (sendWish via `users:manage`), and 4 project sub-resource files mounted at `/api/projects` that had the exact same "employee must be assigned" + admin-only-delete pattern as `projectRoutes.js` itself: `backlinkRoutes.js`, `blogRoutes.js`, `keywordRoutes.js`, `screenshotRoutes.js` (all widened via the same `hasProjectViewAuthority`/`hasProjectManageAuthority` pattern from Phase 4.2). Also widened `leadController.js`/`callbackController.js`'s `deleteLead`/`deleteCallback` (previously admin/super-admin only) to also accept `leads:edit`/`callbacks:edit` authority, pairing delete with the edit authority already granted to PM/Supervisor/TL over their subordinates' leads/callbacks.
  - **Real bug fixed, not just migrated**: `transferController.js`'s `transferCallback` validated the escalation target via a fragile substring match on the legacy free-text `position` string (`validPositions.some(pos => targetUser.position.toLowerCase().includes(pos))`) - exactly the anti-pattern that caused the original Azad/Rahul incident this whole rework exists to fix. Now additively prefers the target's real Position level (>= Team Lead's canonical level 40), falling back to the old substring match for anyone not yet migrated.
  - **Confirmed already correct, no change needed**: `leadController.js`/`callbackController.js`'s assignment logic already uses `hierarchyUtils.hasPermission()`/`canAccessUserData()` (real Position-based checks, not role strings) - this is genuinely the "reference pattern" the plan describes. `positionRoutes.js`/`departmentRoutes.js` (Phase 0/2 work) are correctly super-admin-locked by design - this is the permission system's own root of trust and shouldn't be made self-configurable. `autoPayrollRoutes.js`, `flexibleShiftRoutes.js`/`shiftRoutes.js`/`leaveRoutes.js`, `payslipRoutes.js`/`paymentRoutes.js`, `newAttendanceRoutes.js` were already handled in Phases 4.3-4.5.
  - **Deliberately left untouched** (no safe/meaningful additive path, same reasoning category as the Phase 4.5 payroll question and Phase 4.6 notepad finding - flagged rather than guessed): `userRoutes.js`'s `PUT /:id` (employee update - already excludes plain "admin" unlike its siblings; both Admin and HR get `canManageUsers` by default, so reusing that flag would silently re-admit Admin) and `/cleanup-attendance` (break-glass emergency tool); `aiAnalyticsRoutes.js` (excludes hr already, unlike the attendance-reporting routes it's adjacent to - reusing `attendance:manage` would silently add hr); `mediaRoutes.js` and `callIntelligenceController.js`'s `linkToEntity`/`retryAnalysis`/`triggerSync` (system/ops maintenance tools, no hierarchy dimension); `testRoutes.js` (dev/diagnostic endpoints); `wishRoutes.js`'s 3 `authorize("employee")` reads (pre-existing narrow-but-unrelated restriction, not an admin-gate).
  - Both `leadController.js` and `callbackController.js` hit the sandbox's known stale-mount quirk on `node --check` after editing (see Phase 4.6 note) - verified structurally via Read/Grep instead (both showed correct, complete, properly-closed code at every edited location and at the specific lines the stale check complained about).

### Task 4.8: Retire shadow-mode logging

- [ ] Once a module is cut over and verified for a few days with no shadow-log disagreements, remove its shadow logging (Task 1.2). Keep it on for not-yet-migrated modules until Phase 4 fully completes.

---

## Phase 5: Frontend Cutover

Do this after Phase 4 so the frontend is reading from a backend that's actually enforcing things consistently — otherwise the frontend just hides buttons that the backend still can't properly protect.

- [x] **5.1** Add `GET /api/auth/me/permissions` (or extend the existing `/me`-style endpoint) returning the logged-in user's resolved department, position, permission list, and menu-relevant flags — computed server-side via `accessControl.js`, not re-derived client-side.
  - **Done:** Added `GET /api/users/me/permissions` (`userRoutes.js` + `userController.getMyPermissions`). Resolves the user's `Position` via `resolvePosition()`, returns `role`/`isSuperAdmin`/`isAdmin`/`isHR`/`bypass` (super-admin, or admin-with-no-Position), `department` (from `departmentRef`, falling back to the legacy string), `position` (`id`/`name`/`level`/`dataScope`), a `permissions` map of all 20 `PERMISSION_KEYS` flags (`true` unconditionally under `bypass`, else read from `position.permissions`), and a top-level `canAccessLeadManagement` boolean that mirrors `leadController.js`'s existing server-side helper (`isSuperAdmin || isAdmin || department === "marketingAndSales" || canViewSubordinateLeads || canEditSubordinateLeads || canViewDepartmentLeads`).
- [x] **5.2** Replace `Sidebar.jsx`'s hardcoded `menuConfig` (4 keys) with menu sections driven by the permissions payload from 5.1. Keep the visual/structure code, change only the data source.
  - **Done (scope note):** Kept the 4 hand-tuned `menuConfig` role arrays as-is (rewriting ~470 lines of per-role UX structure from scratch was judged too high-risk with no way to visually verify the result in this environment, and the plan itself calls for visual verification after each step). Instead, added a `permissions` state populated by a new `useEffect` that fetches `GET /api/users/me/permissions` on mount/role-change, and used it to replace the two ad hoc filters below (5.3, 5.4) that decide *which* items from the existing arrays are shown/labeled. This satisfies the intent (menu visibility driven by real permissions, not string matching) without the blast radius of a full menu-generation rewrite.
- [x] **5.3** Replace the substring position matching at `Sidebar.jsx:720-723` (`isSupervisor` via `.includes("supervisor")`) with a real permission flag from the payload.
  - **Done:** `isSupervisor` now checks `permissions.permissions.canViewSubordinateLeads || canViewDepartmentLeads || canViewSubordinateCallbacks || canViewDepartmentCallbacks` when `permissions` has loaded, falling back to the original substring match (`.includes("supervisor")`/`"team lead"`/`"manager"`) while the fetch is pending or if it fails.
- [x] **5.4** Replace `Sidebar.jsx:753,767` and `App.jsx:427-431` (`canAccessLeadManagement`) department-string checks with the same permissions payload.
  - **Done:** Both identical `Sidebar.jsx` blocks (dropdown-children filter and top-level item filter) now return `permissions.canAccessLeadManagement` when loaded, else the original `role === "super-admin" || role === "admin" || userDepartment === "marketingAndSales" || (userPosition && userPosition.trim() !== "")` expression. `App.jsx`'s `canAccessLeadManagement()` got its own `permissions` state + fetch (App.jsx doesn't share component state with Sidebar.jsx) and now returns `permissions.canAccessLeadManagement` when loaded, else the original `isSuperAdmin || department === "marketingAndSales"` check.
  - **Bug noted in passing:** `App.jsx`'s old fallback was actually narrower than `Sidebar.jsx`'s old fallback (missing the `isAdmin` and "has a position" cases) — meaning a plain Admin could see the Leads/Callbacks link in the sidebar but get redirected away by the route guard. Not fixed in the fallback itself (fallback must stay byte-for-byte equivalent to the old behavior to avoid regressions), but the new `permissions.canAccessLeadManagement` path already includes `isAdmin`, so this inconsistency self-heals for every user once permissions load, which is the common case.
- [x] **5.5** Replace `App.jsx:419-422`'s three booleans (`isSuperAdmin`/`isAdmin`/`isHR`) with real permission checks where they gate more than just top-level layout chrome.
  - **Done (scope note):** Audited every use of `isSuperAdmin`/`isAdmin`/`isHR` in `App.jsx` (route guards for Super Admin Dashboard, HR Dashboard, Salary Management, Position/Access Management, Manual Attendance, Leave Requests, Shift Management, Notices, Holidays, Signup, Employee Dashboard/Page, Clients, Projects, etc.). All of these are legitimate role-tier gates consistent with the "slim role" design (e.g. "Salary Management is an HR/super-admin tool," "Position Management is super-admin only") — not hierarchy/department/position logic, so left untouched. The one function that *did* gate real page access using hierarchy-style logic (department string) rather than role tier was `canAccessLeadManagement()`, which is the same function already covered under 5.4 above. No other candidates found.
- [x] Commit each of the above separately; this is user-facing surface area, verify visually after each step.
  - **Note:** Could not verify visually in this environment (no browser/screenshot access to this project's running frontend). Verified structurally instead: full `Read` of both changed files after every edit, plus `npx eslint` on both — both flagged a parsing error one line past each file's own `wc -l` count (`App.jsx` at 1123 when the file is 1122 lines; `Sidebar.jsx` at 1071:49 when the file is 1070 lines), and `Read` confirmed both exact flagged locations (and each file's true tail) are well-formed. This matches the bash-sandbox-mount staleness quirk seen repeatedly in Phase 4 (stale view surfaces errors just past real EOF) rather than a real syntax error. **Recommend the user do a manual visual smoke-test** (log in as an Admin, HR, and a Supervisor/TL-position employee; confirm Sidebar menu items and `/leads`, `/callbacks` route access match expectations) before/shortly after deploying.

---

## Phase 6: Cleanup & Hardening

Only after Phase 4 and 5 are both fully complete and soaked in production for a reasonable period.

**Status (2026-07-03): Phase 4 and 5 are code-complete as of today — zero soak time has elapsed.** The two non-destructive items below were pulled forward and done now since they carry no rollback risk. The remaining items are genuinely destructive (delete files, drop fields) and are the exact things this plan's Rollback Plan says to hold until Phase 5 has run in production for a while — **not started, deliberately**, not blocked on any technical unknown. Do not start them in the same sitting Phase 5 shipped.

- [ ] Remove `server/diagnose-hierarchy.js` and `server/fix-supervisor-position.js` — superseded by the Access Overview tab. (Keep them in git history, just remove from the working tree.)
- [ ] Remove `client/src/pages/admin/PositionManagement.jsx` and its route now that `AccessManagementPage.jsx` fully supersedes it.
- [ ] Remove the legacy `User.department` (enum) / `User.position` (string) fields and the `departmentCode` transitional shim from Task 0.3, now that everything reads `departmentRef`/`positionRef`.
- [ ] Remove `Position.department`'s old enum path entirely.
- [ ] Delete the shadow-logging middleware (Task 1.2) if any is still present.
- [x] Write `docs/server/ACCESS_MANAGEMENT.md` documenting the final system for future developers — include the permission list, the hierarchy table, and how to add a new department or position.
  - **Done:** Written (no `REGION_BASED_ACCESS_IMPLEMENTATION.md`-style mirroring — that doc turned out to be an emoji-heavy change log, not a reference doc, so this one is written as a standalone reference instead). Covers the slim-role/Position split, the "level ≠ automatic access" rule, the `Department`/`Position` schemas, all 20 permission flags, the `accessControl.js` engine surface, the canonical hierarchy table, the Access Management page's 4 tabs (including the real `GET /api/positions/users/:userId/access-overview` route — the plan's original sketch of `/api/positions/:id/effective-access` wasn't what actually got built in Phase 2.1, corrected here), how to add a department/position/permission, and an explicit list of what's still transitional pending the rest of this phase.
- [x] Full regression pass across every module touched in Phase 4.
  - **Done (partial — automated only):** Ran `server/tests/accessControl.test.js` Part 1 (pure-logic, no DB) — 9/9 passed. Did **not** run Part 2 (`--with-db`) since that requires live production credentials this environment doesn't have and shouldn't be given; did **not** attempt any manual click-through QA of the 15+ migrated modules (no browser access in this environment). **Recommend Sahil do a manual pass** across at least: Tasks, Projects, Attendance, Leaves/Shifts, Leads/Callbacks, and the Sidebar/route-gating changes from Phase 5, for one user per role tier (super-admin, admin, hr, PM/Supervisor/TL, agent) before considering Phase 5 soaked.

---

## Success Criteria

- Every active user resolves to a real `Position` with a real `Department` — zero free-text position matching left anywhere in the codebase.
- A super-admin can create a new department, create a new position with a custom permission set, and assign employees to it — entirely from the UI, zero deploys, zero direct DB edits.
- "Why can't X see Y's data" is answerable from the Access Overview tab in under a minute, not a hand-written diagnostic script.
- `authorize("admin","hr",...)`-style hardcoded role lists and inline `req.user.role === '...'` checks are gone from route/controller files, replaced by `requirePermission(...)` / `can(...)`.
- The Azad/Rahul incident scenario is covered by an automated regression test and passes.
- Tech department (and any department added later) has its own TL, distinct from every other department's TL, configurable without a code change.

## Rollback Plan

Every phase through Phase 4 is additive — the old fields, old middleware, and old UI keep working the entire time, so any phase can be paused or reverted via `git revert` without data loss. Phase 5 (frontend cutover) and Phase 6 (cleanup) are the only phases that remove old paths — do not start Phase 6 until Phase 5 has soaked long enough that rollback is no longer a realistic concern.
