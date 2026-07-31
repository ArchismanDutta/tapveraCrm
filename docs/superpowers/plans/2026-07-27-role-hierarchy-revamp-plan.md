# Role & Department Hierarchy Revamp v2 — Implementation Plan

**Design doc:** [`docs/superpowers/specs/2026-07-27-role-hierarchy-revamp-design.md`](../specs/2026-07-27-role-hierarchy-revamp-design.md) — read that first, it has the *why* and the full hierarchy table.

**Goal:** Reseed Development/Sales/HR with their real (not copy-pasted) hierarchy shapes, and give Admin real, bounded, auditable control over the access of people below them — without breaking anything mid-rollout.

**Approach:** Same discipline the 2026-07-03 rework used and that this plan explicitly inherits: additive schema first, backend engine second, admin UI third, then migrate real people, then frontend surfacing, then cleanup. Each phase leaves the app fully working. Do not start a phase until the previous one is checked off and verified.

**Status:** Phases 0, 1, 2, and 4 implemented in code (2026-07-27, Cowork session) and verified via unit tests / lint / syntax checks — see the "What was actually verified" note at the end of this doc. **None of it has been run against a real database yet** — the seed/rename/migration scripts are written but deliberately not executed against Tapvera's live MongoDB from this session (see Phase 0/3 notes below). Phase 5 not started, by design (needs soak time). Tapvera's answers to the design doc's open items are folded in below and in the design doc itself.

**Update (same day, follow-up session):** Tapvera asked for this to be UI-driven rather than terminal-driven — "don't directly make any changes to the database, let's create an access management page and reassign the roles/departments of the existing employees and also a page to manage what access what roles get." In response, Phase 3's three scripts (`updateDepartmentsV2.js`, `seedRoleHierarchyV2.js`, `migrateToRoleHierarchyV2.js`) were refactored to export their core logic as reusable functions (CLI usage unchanged — `node scripts/...` still works standalone), and a new Super-Admin-only API (`server/routes/hierarchySetupRoutes.js`, mounted at `/api/hierarchy-setup`) plus a fifth "Hierarchy setup" tab on the Access Management page (`client/src/pages/admin/AccessManagementPage.jsx`) now put every one of those operations behind a button in the running app instead of a terminal command. See the new "Phase 3.1b: Hierarchy Setup UI/API" section below. This still has not been run against the real database — same sandbox network restriction as before (see "What was actually verified") — but it no longer requires terminal access at all: once Tapvera opens the page in their own browser and clicks through it, everything happens through the app's own authenticated endpoints.

---

## Phase Overview

| Phase | What | Risk if skipped/reordered |
|---|---|---|
| 0 | Reseed Departments + department-shaped Positions, additive only | Nothing else can be built on the wrong hierarchy shape |
| 1 | Delegated permission engine (ceiling + scope + audit log) | Without this, Phase 2's UI would have nothing safe to call |
| 2 | Admin delegation UI ("My Team's Access") | Without this, delegation is API-only, unusable day to day |
| 3 | Assign real employees, retire old delivery-chain positions | Nothing to test against otherwise; old positions linger and confuse |
| 4 | Frontend surfacing (specialization, nav) | Cosmetic but needed for the design to actually be usable |
| 5 | Cleanup & hardening | Safe to defer, not safe to skip forever |

---

## Phase 0: Departments + Position reseed (additive, no behavior change)

Nothing in this phase changes what any existing user can currently do.

### Task 0.1: Update Department rows

**File:** `server/scripts/seedDepartments.js` (modify) or a new `server/scripts/updateDepartmentsV2.js` (new, idempotent, safer to keep the original script's history intact)

- [x] Rename "Tech" → **"Development"**, code `tech` → `development` (this actually *removes* a mismatch — `legacyEnumValue` was already `"development"`).
- [x] Rename "Marketing & Sales" → **"Sales"**, code `marketingAndSales` → `sales` (keep `legacyEnumValue: "marketingAndSales"` for the bridge to the old raw enum on `User.department`/`Position.department`).
- [x] Leave "Human Resources" / `humanResource` and "Executives" / `executives` as-is (Open Item #1 — Tapvera confirmed: leave Executives dormant/untouched this round).
- [x] Use `findOneAndUpdate` by existing code, not delete+recreate — preserves the `_id` so any already-existing `Position.departmentRef`/`User.departmentRef` pointers don't break.
- [ ] Commit: `git commit -m "feat(access): rename Tech->Development, Marketing & Sales->Sales departments"` — **not run.** Went with the new-script option (`server/scripts/updateDepartmentsV2.js`), written and syntax-checked but not executed against any database from this session (see "What was actually verified" at the end of this doc) and not yet committed to git.

### Task 0.2: Add the new permission flag to `Position`

**File:** `server/models/Position.js` (modify)

- [x] Add one field to `permissions` (done — `server/models/Position.js`).
- [x] Add `permissionOverrides` to `User` (`server/models/User.js`), additive, default empty — the "escape hatch" from the design doc's Section 2. Implemented with `default: () => new Map()` (function factory) rather than `default: new Map()` from this sketch — avoids Mongoose documents sharing one mutable Map instance across records.
- [x] Do not remove or rename any existing field — additive only, matching the 07-03 rework's own rule.
- [ ] Commit: `git commit -m "feat(access): add canManageSubordinateAccess flag and User.permissionOverrides (additive)"` — written, not committed.

### Task 0.3: Seed the new hierarchy

**File:** `server/scripts/seedRoleHierarchyV2.js` (new — follows the exact `upsertPosition()` pattern already established in `seedCanonicalHierarchy.js`, don't reinvent it)

- [x] Upsert the 11 positions from the design doc's table: Admin (95, org-wide, `canManageSubordinateAccess: true` alongside its existing broad permission set), Project Manager — Sales (70), Team Lead — Development (65), Senior HR (60), Supervisor — Sales (40), Supervisor — Development (40), Junior HR (30), Employee — Development (15), Agent — Sales (10), Intern — Development (5), HR Intern (5). Levels 70/65 confirmed by Tapvera (PM slightly senior, per Section 1's "PM vs Dev Team Lead" open item).
- [x] Set `parentPosition` chains exactly as drawn in the design doc's Section 1 diagrams.
- [x] Script is idempotent (`findOneAndUpdate` + `upsert`, same as `seedCanonicalHierarchy.js`) and does **not** touch any `User` document. **One deliberate deviation from the sketch above:** because this script's "Admin" upsert shares a name with `seedCanonicalHierarchy.js`'s "Admin", a plain `$setOnInsert` would silently no-op `canManageSubordinateAccess: true` onto an already-existing "Admin" document (the one case this script's own header comment flags). Added an explicit follow-up `$set` on `permissions.canManageSubordinateAccess` that always fires, insert or not, so the one new capability this whole revamp is about can never depend on whether "Admin" happened to pre-exist.
- [x] Explicitly does **not** delete or deactivate the old `tech`/`marketingAndSales`-flavored Admin/HR/PM/Supervisor/TL/Agent positions from `seedCanonicalHierarchy.js` in this task, even if that script was already run — that's Phase 3, after confirming nothing real still points at them.
- [x] Prints a summary table on completion, same style as the existing seed scripts.
- [ ] Commit: `git commit -m "feat(access): seed Development/Sales/HR hierarchy v2 positions"` — written, not committed, **not run against any database**.

### Task 0.4: Phase 0 verification

- [x] Ran the existing test suite's DB-free portion (`node server/tests/accessControl.test.js`, Part 1) — passes unchanged (9/9 original assertions), plus 17 new ones for the delegated-access engine (26/26 total).
- [ ] Confirm the new positions exist (via Access Management → Positions tab or a direct query) but zero users are assigned to them yet. **Blocked on running `seedRoleHierarchyV2.js` against a real database — not done from this session.**
- [ ] Confirm existing users' effective access is byte-for-byte unchanged (spot-check one user per current role). **Same blocker — needs a real database and a running app.**

---

## Phase 1: Delegated Permission Engine (backend)

### Task 1.1: `canManageAccessFor()` and `grantableFlags()`

**File:** `server/utils/accessControl.js` (modify — additive functions, nothing existing changes shape)

```js
const hierarchyUtils = require("./hierarchyUtils");

/**
 * Can `grantor` manage `targetUser`'s access at all? (Not which flags —
 * just whether the relationship qualifies.) Enforces the three rules from
 * the design doc: ceiling is checked separately per-flag in grantableFlags().
 */
async function canManageAccessFor(grantor, targetUser) {
  if (grantor.role === "super-admin") return true;
  if (targetUser.role === "super-admin") return false;
  if (targetUser.role === "admin") return false; // admins can't edit admins

  const grantorPosition = await resolvePosition(grantor);
  if (!grantorPosition?.permissions?.canManageSubordinateAccess) return false;

  const targetPosition = await resolvePosition(targetUser);
  if (!targetPosition || targetPosition.level >= grantorPosition.level) return false;

  const accessibleIds = await hierarchyUtils.getAccessibleUserIds(grantor);
  return accessibleIds.includes(String(targetUser._id));
}

/** The subset of PERMISSION_KEYS the grantor can hand out — never more than they hold. */
function grantableFlags(grantorPosition) {
  if (!grantorPosition) return [];
  return Object.entries(grantorPosition.permissions || {})
    .filter(([, value]) => value === true)
    .map(([key]) => key);
}
```

- [x] Implemented both functions above — with one refinement over the sketch: each is split into a pure, DB-free decision core (`evaluateManageAccess()`) plus a thin async wrapper (`canManageAccessFor()`) that resolves Positions/accessible-IDs and calls it, mirroring the existing `evaluate()`/`can()` split so the ceiling/scope/root-of-trust logic is directly unit-testable without a database — same reasoning the file's own Part 1 tests already rely on for `evaluate()`.
- [x] Extended `evaluate()` to accept an optional third `overrides` argument (backward compatible — existing 2-arg call sites unchanged) and added `resolveEffectivePermissions()` to do the merge. `can()` now passes `user.permissionOverrides` through; `authMiddleware.js`'s `protect` now attaches it to `req.user`; `userController.getMyPermissions` now layers it into the permissions map it returns (this last part wasn't explicitly called out in this plan but is necessary for the design to actually work end-to-end — otherwise a granted override would be invisible to the affected user's own UI/nav).
- [x] Unit tests added to `server/tests/accessControl.test.js` Part 1: ceiling, scope, root-of-trust (all three, individually and combined), override layering (grant, revoke, Map vs. plain object), `grantableFlags()`. 17 new assertions, all passing.
- [ ] Commit: `git commit -m "feat(access): add canManageAccessFor/grantableFlags and permissionOverrides layering"` — written, not committed.

### Task 1.2: Audit log

**File:** `server/models/AccessAuditLog.js` (new)

```js
const auditLogSchema = new mongoose.Schema({
  actorId: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true },
  targetUserId: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true },
  action: { type: String, enum: ["grant", "revoke", "assign-position", "create-position"], required: true },
  flagOrPositionName: { type: String, trim: true },
  previousValue: mongoose.Schema.Types.Mixed,
  newValue: mongoose.Schema.Types.Mixed,
}, { timestamps: true });
```

- [x] Created the model above (`server/models/AccessAuditLog.js`) — append-only by convention, indexed on `{ targetUserId, createdAt }` for the Access Overview "recent changes" query.
- [x] Added `logAccessChange(...)` in `accessControl.js`, called from the PATCH and POST routes in Task 1.3. Deliberately swallows its own errors (logs to console, doesn't throw) so an audit-log write failure can never block the underlying permission change.
- [ ] Commit: `git commit -m "feat(access): add AccessAuditLog model and logging helper"` — written, not committed.

### Task 1.3: New routes

**File:** `server/routes/positionRoutes.js` (modify — new routes, existing ones untouched)

- [x] `GET /api/positions/my-team` — users the caller may manage, via `hierarchyUtils.getAccessibleUserIds` filtered to strictly-lower level. Also added `GET /api/positions/my-team/grantable-flags` (not in the original sketch) so the frontend editor can render disabled-with-tooltip toggles without independently re-deriving the ceiling rule.
- [x] `PATCH /api/positions/my-team/:userId/permissions` — body `{ flag, value }`; checks `canManageAccessFor()`, then the per-flag ceiling from `grantableFlags()` (only for `value: true` — revoking never needs the ceiling check, since tightening access can't escalate privilege); writes to `User.permissionOverrides`; logs via Task 1.2.
- [x] `POST /api/positions/my-team/positions` — scoped Position create/clone; ceiling-checked per requested flag, and the new position's level must be strictly below the creator's own. Built per the design doc's sketch; no UI calls it yet (Task 2.1 scoped the Phase 2 UI to the per-user editor only — see that task's note).
- [x] All four require `protect` + inline `canManageAccessFor`/flag checks, not a static `authorize(...)` list.
- [ ] Commit: `git commit -m "feat(access): add scoped my-team routes for delegated permission editing"` — written, not committed.

### Task 1.4: Phase 1 verification

- [x] All new unit tests pass; existing `accessControl.test.js` Part 1 still passes unchanged (26/26 total, see Task 0.4).
- [ ] Manually verify with a test Admin account (needs a real database + running app — not done from this session): can adjust a subordinate's flag they themselves hold, cannot adjust one they don't, cannot reach a user outside their tree, cannot touch another Admin.

---

## Phase 2: Admin Delegation UI ("My Team's Access")

### Task 2.1: New page

**File:** `client/src/pages/admin/MyTeamAccessPage.jsx` (new). **Deviation from the sketch:** rather than importing `AccessManagementPage.jsx`'s internal (unexported) permission-grid components, this duplicates the small `PERMISSION_GROUPS`/labels constant (~30 lines) and builds its own list+editor layout matching that page's visual conventions (same card/dark-mode classes, same `API` axios instance, same notification-toast pattern). Reuses the *endpoints* heavily instead: the per-user detail view calls the existing `GET /api/positions/users/:userId/access-overview` (already allows the `admin` role through its `authorize()` check) rather than a new endpoint, so `effectivePermissions`/`permissionOverrides`/`recentAccessChanges` only had to be added there once (Task 2.3) and both pages benefit.

- [x] List view: users returned by `GET /api/positions/my-team`, with a search box and a "custom" badge for anyone with overrides.
- [x] Per-user editor: grouped checkboxes (same grouping as `AccessManagementPage.jsx`'s `PERMISSION_GROUPS`); only flags in `grantableFlags` are togglable when turning a flag ON, everything else disabled with a `title` tooltip and a lock icon. Turning a flag OFF (revoke) is always enabled for anyone in-scope, matching Task 1.3's ceiling-only-applies-to-grants rule.
- [x] "Custom access" badge — both in this page's team list and (added, beyond this task's literal scope) on `AccessManagementPage.jsx`'s own Access Overview tab, since that page had the same under-reporting gap once overrides can exist.
- [x] Route at `/my-team/access`; visibility driven by `permissions.permissions?.canManageSubordinateAccess` from the now-extended `GET /api/users/me/permissions` (Task 1.1's `userController` change).
- [ ] Commit: `git commit -m "feat(access): add My Team's Access page for delegated permission editing"` — written, not committed. ESLint-clean (`npx eslint` against this file and the other touched frontend files: 0 errors after fixing 2 real issues this pass caught — a JSX attribute quote-escaping bug and an unused variable, see "What was actually verified").

### Task 2.2: Nav wiring

**File:** `client/src/components/dashboard/Sidebar.jsx` (modify)

- [x] Added a nav entry gated on `permissions.permissions?.canManageSubordinateAccess`, following the fetch-then-fallback pattern `isSupervisor`/`canAccessLeadManagement` already use (falls back to `role === "admin" || role === "super-admin"` before permissions load). Added the literal menu item to the `employee`, `hr`, and `admin` role arrays in `menuConfig` (not just `admin`) — a plain permission-gated filter can only show/hide an item that's *present* in the role's array, so if Tapvera later grants the flag to a Position held by an "employee"/"hr" role user (e.g. Senior HR, Team Lead — Development — see the design doc's Open Item #5), the item needs to already be there for the "no code change needed" promise to actually hold.
- [ ] Commit: `git commit -m "feat(access): wire My Team's Access into sidebar navigation"` — written, not committed.

### Task 2.3: Extend Access Overview with recent changes

**File:** `server/routes/positionRoutes.js`'s `GET /users/:userId/access-overview` (modify, additive field), `client/src/pages/admin/AccessManagementPage.jsx` (modify)

- [x] Added `recentAccessChanges` (last 20 `AccessAuditLog` entries, newest first, actor populated) to the access-overview response. Also added `permissionOverrides` and `effectivePermissions` (Position + overrides merged) — needed so both this tab and `MyTeamAccessPage.jsx` can show a user's *actual* current access, not just their Position template.
- [x] Rendered as a simple list under the existing overview panel; also updated the "Granted permissions" badges to read from `effectivePermissions` (falling back to the raw Position if absent) and tagged override-sourced flags with a small "custom" pill, so Access Overview doesn't under-report a user who has grant-type overrides.
- [ ] Commit: `git commit -m "feat(access): surface audit log in Access Overview tab"` — written, not committed.

### Task 2.4: Phase 2 verification

- [ ] Log in as a test Admin: reach `/my-team/access`, adjust a subordinate's permission, confirm it's reflected in that subordinate's next `GET /api/users/me/permissions` call and logged in Access Overview. **Needs a real database, seeded v2 positions, an assigned test Admin, and a running app — not possible from this session; verified at the code level instead (ESLint clean, all backend routes require the same `canManageAccessFor` check the unit tests exercise).**
- [ ] Confirm a non-`canManageSubordinateAccess` user cannot reach the route (direct URL entry included). Route-level guard is in place (`App.jsx`'s `isAdmin` check) but this is a coarse guard, not the real boundary — the real boundary is server-side (`canManageAccessFor` on every route) and is unit-tested; still needs a live click-through to confirm the page itself behaves (shows the "you don't have this permission" empty state) for an admin without the flag.

---

## Phase 3: Assign Real Employees, Retire Old Positions

### Task 3.1: Migration report

**File:** `server/scripts/migrateToRoleHierarchyV2.js` (new — same report-not-guess pattern as `migrateToPositionRefs.js`)

- [x] For every active `User` currently on one of the old `seedCanonicalHierarchy.js` positions, proposes a best-guess mapping to a Phase 0 position and outputs a report — never auto-assigns (this script contains no `.save()`/write call anywhere, stricter than `migrateToPositionRefs.js`'s opt-in `--dry-run`: there is no live mode at all). Each proposed mapping is tagged `direct` (same tier, department renamed only), `best-guess` (reasonable but confirm), or `uncertain` (the old tier has no real equivalent in the new shape — e.g. old "Project Manager — Tech" and "Team Lead — Marketing & Sales", since Development no longer has a PM tier and Sales no longer has a Team Lead tier) so the riskiest reassignments aren't visually mixed in with the safe ones.
- [x] For every user with no resolved position at all, listed separately.
- [ ] Commit: `git commit -m "feat(access): add v2 hierarchy migration report script"` — written, syntax-checked, not committed, **not run against any database** (it would need Task 0.1/0.3's scripts to have already been run for its suggested target positions to exist).

### Task 3.1b: Hierarchy Setup UI/API (added in the follow-up UI-driven session)

Puts Tasks 0.1, 0.3, and 3.1's scripts behind the running app's own authenticated HTTP layer instead of a terminal, per Tapvera's explicit instruction not to make direct database changes.

**Files:**
- `server/scripts/updateDepartmentsV2.js`, `seedRoleHierarchyV2.js`, `migrateToRoleHierarchyV2.js` (refactored) — each now exports its core logic as a reusable async function (`applyDepartmentRenames()`, `seedRoleHierarchyV2()`, `generateMigrationReport()`) alongside an unchanged CLI wrapper (`if (require.main === module)`), so there is exactly one implementation behind both the terminal and the API, not two that can drift apart.
- `server/routes/hierarchySetupRoutes.js` (new, Super Admin only, mounted at `/api/hierarchy-setup` in `server/app.js`):
  - `GET /status` — cheap snapshot for status cards: are the v2 departments/positions present yet, and how many active users are still on an old position.
  - `POST /apply` — calls `applyDepartmentRenames()` and/or `seedRoleHierarchyV2()` (idempotent, upsert-based, safe to call more than once) and returns a line-by-line log for the UI to display.
  - `GET /migration-report` — calls `generateMigrationReport()` (still strictly read-only — no `.save()`/write call anywhere in that function) and additionally resolves each suggestion's target `Position._id`, so the UI can offer a one-click "Apply" per row without re-deriving an id from a name client-side. Optional `?persist=true` also writes the JSON snapshot file the CLI version writes by default, for an audit-trail copy.
- `client/src/pages/admin/AccessManagementPage.jsx` — new fifth tab, "Hierarchy setup": status cards, one "Apply v2 hierarchy setup" button (departments + positions together, since positions already refuse to seed if departments aren't ready), an apply-transcript log, and the migration report rendered as a table grouped by confidence (`uncertain` / `best-guess` / `direct` / `no-action-needed`) with a per-row "Apply" button.

**Deliberately does NOT introduce a new reassignment endpoint.** Each row's "Apply" button calls the *existing* `PATCH /api/positions/users/:userId/assign` (unchanged, same one the "Assign employees" tab already uses) with the suggested `positionId` — reassignment is still one person, one deliberate click, at a time, exactly as Task 3.2 below already required; this just removes the need to re-type each person's target position by hand.

- [x] Scripts refactored, CLI behavior preserved (verified via `node --check` + full `require()` on all three).
- [x] `hierarchySetupRoutes.js` written and mounted; full `require()` of the route file resolves and registers all three routes with no runtime errors.
- [x] `AccessManagementPage.jsx`'s new tab written; `eslint` clean.
- [ ] Commit: not yet committed (see the git-lock note in "What was actually verified").
- [ ] Actually clicked through from Tapvera's own browser against the real database — **not done from this session**, same MongoDB network restriction as everything else here.

### Task 3.2: Assign via UI

Reassigning real employees is exactly the kind of judgment call this whole plan (and the 07-03 rework before it) insists on doing deliberately, one person at a time, through the UI — not something to automate or guess at without the actual org chart in front of a human. Also requires Phase 0's scripts to have actually been applied against the real database first (now doable from the same tab — see Task 3.1b — no terminal needed).

- [ ] From the Access Management page's new "Hierarchy setup" tab, click "Apply v2 hierarchy setup" once (renames departments, seeds the 11 positions).
- [ ] Load the migration report on that same tab and work through it — `uncertain` rows first, they need a real decision, not a default — clicking "Apply" per row (or "Review manually", which jumps to the Assign Employees tab for anyone with no direct suggestion).
- [ ] Confirm each of the three org-chart shapes (Section 1 of the design doc) has at least one real person once done, or document why not.

### Task 3.3: Retire old delivery-chain positions

- [ ] Once Task 3.2's report shows zero active users on the old tech/marketingAndSales-flavored PM/Supervisor/TL/Agent positions, set their `status` to `"inactive"` (soft — matches how `Position.status` already works; never hard-delete, per the existing rollback discipline).
- [ ] Leave the old "Admin" and "HR" positions from `seedCanonicalHierarchy.js` alone — Phase 0's new Admin/Senior HR are meant to replace them by upsert-on-same-name if named identically, or coexist if not; reconcile naming here rather than guessing in Phase 0.

### Task 3.4: Phase 3 verification

- [ ] Every active user resolves to a real Position under the new v2 hierarchy (zero unexplained entries in the migration report).
- [ ] Access Overview spot-check for 2-3 users per department confirms access matches what they should actually have.

---

## Phase 4: Frontend Surfacing

### Task 4.1: Specialization field

**File:** employee create/edit forms (audited: primary create/edit form is `client/src/components/employee/EmployeeFormModal.jsx`)

- [x] `EmployeeFormModal.jsx`'s Designation field now labels itself "Specialization" (with placeholder "e.g. Digital Marketing, Content Writer, SEO Expert") when `department === "development"`, plus a small helper line clarifying it's free-text and doesn't affect access — no schema change, per the design doc (reuses `User.designation`).
- [x] Broader than this task's literal scope: also fixed the "Marketing & Sales" → "Sales" department-label rename (Section 1 of the design doc) everywhere it appeared as a user-visible string — centrally in `client/src/utils/formatters.js`'s `DEPARTMENT_LABELS` (used by most employee list/detail views app-wide), plus the handful of components with their own hardcoded `<option>` lists that don't go through that helper (`EmployeeFormModal.jsx`, `EmployeePage.jsx`, `ViewCallbacks.jsx`, `SignUp.jsx`, `EmployeeFilters.jsx`). Left `PositionManagement.jsx` alone — it's explicitly documented as superseded/kept-for-rollback-only.
- [ ] Commit: `git commit -m "feat(access): surface specialization (designation) field for Development employees"` — written, not committed.

### Task 4.2: Phase 4 verification

- [ ] Create/edit an employee end-to-end through the UI only, confirm specialization displays correctly. **Needs a running app — not done from this session.**
- [ ] Visual smoke-test nav changes from Phase 2 across at least one Admin, one Team Lead, one Agent, one Senior HR account. **Same blocker.**

---

## Phase 5: Cleanup & Hardening

Only after Phases 0–4 have soaked in production for a reasonable period — same rule the 07-03 rework used. **Not started, by design — this session did not touch any of the below.**

- [ ] Hard-delete (not just deactivate) the old tech/marketingAndSales-flavored delivery positions, if Phase 3 confirmed zero references for long enough that rollback is no longer a realistic concern.
- [x] Update `docs/server/ACCESS_MANAGEMENT.md` with: the new hierarchy table, the `canManageSubordinateAccess`/`permissionOverrides` mechanism, and a "how delegated editing works" section alongside the existing "how to add a department/position" ones. **Pulled forward from Phase 5 into this session** — documentation carries no rollback risk (unlike the hard-delete above, which genuinely should wait), and stale docs describing only the pre-v2 system would be actively misleading the moment any of Phases 0–4 ship.
- [ ] Full regression pass across Access Management, My Team's Access, and every module that reads `scopeQuery`/`can()`. Needs a running app against real data.

---

## What was actually verified (this session, no live database available)

Everything below was checked without connecting to Tapvera's real MongoDB — the sandbox this was built in only has repo file access, not a path to the production/staging database, and running untested seed/migration scripts against a real database sight-unseen would be irresponsible regardless. So verification here is "the code is correct and internally consistent," not "this was exercised against real data" — Task 0.4/1.4/2.4/3.x/4.2's unchecked items above are exactly the gap between those two things, and are Tapvera's (or whoever runs this next) to close by actually running the scripts and clicking through the app.

- **`node server/tests/accessControl.test.js`** (Part 1, no DB): 26/26 pass — the original 9 plus 17 new ones covering the ceiling/scope/root-of-trust rules and override layering individually and combined.
- **`node --check`** on every new/modified server file (all model, route, middleware, controller, and script files touched) — no syntax errors.
- **Full `require()`** (not just `--check`) of `accessControl.js`, `Position.js`, `User.js`, `AccessAuditLog.js`, `hierarchyUtils.js` (via the test run above), plus `authMiddleware.js`, `userController.js`, and `positionRoutes.js` individually — all load with no reference/runtime errors at module scope. (One pre-existing, unrelated Mongoose warning about a duplicate `departmentRef` index surfaced during this — not introduced by this work, not touched.)
- **`npx eslint`** against every new/modified client file (`MyTeamAccessPage.jsx`, `App.jsx`, `Sidebar.jsx`, `AccessManagementPage.jsx`, `EmployeeFormModal.jsx`, `EmployeePage.jsx`, `ViewCallbacks.jsx`, `SignUp.jsx`, `EmployeeFilters.jsx`, `formatters.js`) using the repo's own `eslint.config.js` — caught and fixed two real bugs in `MyTeamAccessPage.jsx` (a JSX attribute using `\'` escaping, which JSX plain-quoted attributes don't support the way JS string literals do, and an unused variable left over from an earlier draft). Zero errors on the final pass. Two pre-existing, unrelated issues surfaced in files this work touched elsewhere (an unused loop variable in `EmployeeFormModal.jsx` from a 2026-06-12 commit, a pre-existing `react-hooks/exhaustive-deps` warning in `SignUp.jsx`) — neither introduced by this work, neither touched.
- **`esbuild`** was attempted first for the frontend files and abandoned — the installed binary is architecture-mismatched for this sandbox (`node_modules` was installed on a different platform), an environment artifact unrelated to the code. ESLint (pure JS, no native binary) was used instead and is arguably the more useful check anyway since it also parses JSX correctly.
- **Not run, at all, from this session:** any script that connects to MongoDB (`updateDepartmentsV2.js`, `seedRoleHierarchyV2.js`, `migrateToRoleHierarchyV2.js`, or Part 2 of `accessControl.test.js`), and nothing was committed to git.

**Follow-up UI-driven session (same day):** the three scripts above were refactored (core logic extracted into exported functions, CLI wrapper kept) and a new route file + UI tab were added on top of them (see Task 3.1b). Verification for that follow-up work specifically:
- `node --check` on all three refactored scripts, the new `hierarchySetupRoutes.js`, and `server/app.js` — no syntax errors.
- Full `require()` of `hierarchySetupRoutes.js` (pulling in the three refactored scripts, `accessControl.js`, `hierarchyUtils.js`, `authMiddleware.js`, and the `Department`/`Position`/`User`/`AccessAuditLog` models transitively) — loads with no reference/runtime errors, and its Express router correctly registers all three routes (`GET /status`, `POST /apply`, `GET /migration-report`). Same pre-existing, unrelated `departmentRef` duplicate-index Mongoose warning as before surfaced again here — still not introduced by this work.
- `node server/tests/accessControl.test.js` (Part 1, no DB) re-run after the refactor: still 26/26 pass — confirms the script refactor didn't disturb anything the delegated-access engine depends on.
- `npx eslint` against `AccessManagementPage.jsx` (now ~1600 lines with the new tab) — zero errors, zero warnings.
- `git status --porcelain` on every touched/new file confirms the expected set: `server/app.js` and `client/src/pages/admin/AccessManagementPage.jsx` modified; `server/routes/hierarchySetupRoutes.js`, `server/scripts/updateDepartmentsV2.js`, `server/scripts/seedRoleHierarchyV2.js`, `server/scripts/migrateToRoleHierarchyV2.js` untracked (new).
- **`.git/index.lock` still present** (re-checked this session, same file, confirmed by `git add --dry-run -A` still failing with "Unable to create ... index.lock: File exists") — commits are still blocked from this sandbox. Tapvera needs to delete `.git\index.lock` from their own machine (after confirming no other git client/editor has the repo open) before anything from either session can be committed.
- Still not run against the real database — MongoDB Atlas is still unreachable from this sandbox (same `querySrv ECONNREFUSED` DNS restriction as the original session).

## Success Criteria

- Development, Sales, and HR each have their real hierarchy shape (not a shared template), matching the design doc's table. **Code complete; not yet seeded into a real database.**
- An Admin can, entirely through the UI, adjust what a specific subordinate can access — without ever being able to grant more than the Admin's own permission set, or reach outside their own tree. **Code complete and unit-tested (ceiling/scope/root-of-trust); not yet exercised end-to-end against a running app.**
- Every delegated change is answerable from Access Overview: who changed what, for whom, when. **Code complete (`AccessAuditLog` + both UI surfaces); not yet exercised end-to-end.**
- Digital Marketing / Content Writer / SEO Expert / and-more are representable without a code deploy per new specialization. **Done — `designation` free text, relabeled contextually.**
- No existing user's access changes as a side effect of Phase 0 or Phase 1 shipping (both are additive-only until Phase 3's deliberate reassignment step). **True by construction (additive schema, `$setOnInsert`-based seeding, the one exception being the deliberate `canManageSubordinateAccess` force-`$set` on the "Admin" position specifically, which is the intended new behavior, not a regression) — not yet confirmed against real data since Phase 0's scripts haven't been run anywhere yet.**

## Rollback Plan

Phases 0–2 are additive — old fields, old positions, and the old super-admin-only routes all keep working the entire time, so any phase can be reverted via `git revert` without data loss. Phase 3 is the first phase that reassigns real users; keep the Task 3.1 report as a point-in-time snapshot so a reassignment can be manually undone if needed. Do not start Phase 5 until Phase 3/4 have soaked long enough that rollback is no longer a realistic concern — same reasoning as the 07-03 plan's rollback section. **Nothing from this session has been committed to git yet — review the working tree diff before committing, and commit in the same phase-by-phase granularity this doc's per-task commit messages describe, rather than as one large commit, so this same rollback story holds.**
