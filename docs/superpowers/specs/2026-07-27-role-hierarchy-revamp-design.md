# Role & Department Hierarchy Revamp v2 — Design

**Date:** 2026-07-27
**Status:** Reviewed and implemented in code (2026-07-27, Cowork session) — see the companion plan's "What was actually verified" section. All six Open Items below are resolved. Not yet run against a real database or committed to git — see the plan doc for exactly what's code-complete vs. still needs a live app to verify.
**Requested by:** Tapvera
**Priority:** High — foundational. Re-shapes the department/position hierarchy seeded by the 2026-07-03 rework and adds one genuinely new capability (delegated permission editing) that system never had.
**Companion plan:** [`docs/superpowers/plans/2026-07-27-role-hierarchy-revamp-plan.md`](../plans/2026-07-27-role-hierarchy-revamp-plan.md)
**Prior art:** [`docs/superpowers/specs/2026-07-03-access-management-design.md`](2026-07-03-access-management-design.md), [`docs/server/ACCESS_MANAGEMENT.md`](../../server/ACCESS_MANAGEMENT.md) — read those first if you haven't; this doc assumes familiarity with `Department`, `Position`, and `server/utils/accessControl.js` as they exist today.

---

## Executive Summary

This is **not a rewrite**. The 2026-07-03 rework already built the right machinery: a real `Department` collection, a `Position` model with levels/permissions/`hierarchicalAccess`/`parentPosition`, a central `accessControl.js` engine (`can`/`scopeQuery`/`requirePermission`), and a super-admin-only Access Management page. That infrastructure is sound and stays.

What's changing:

1. **The seeded hierarchy itself.** The org actually runs on three operational departments — Development, Sales, HR — each with its own shape, not the identical PM→Supervisor→TL→Agent chain the 2026-07-03 rework stamped onto every delivery department. Development tops out at Team Lead (no PM). Sales tops out at Project Manager (no TL). HR is a flat seniority ladder (Senior HR → Junior HR → Intern) with no supervisor/lead titles at all.
2. **A genuinely new capability.** Today, *only* Super Admin can touch a `Position`'s permissions or assign anyone to one — it's hardcoded (`authorize("super-admin")` on the mutation routes, not even routed through `accessControl.js`). Tapvera wants Admin to be able to configure what the people below Admin can do. That doesn't exist yet at any level — it has to be designed, not just reconfigured.

Everything else — the permission flags, `dataScope`, the audit-friendly template model, the additive/reversible migration discipline — carries forward unchanged.

---

## Where this leaves the 2026-07-03 system

| Piece | Status |
|---|---|
| `Department` model, CRUD, Access Management "Departments" tab | Kept as-is. Reseed the *rows* (Section 1), not the schema. |
| `Position` model (`level`, `departmentRef`, `parentPosition`, `permissions.*`, `hierarchicalAccess`) | Kept as-is, schema unchanged. One new permission flag added (Section 2). |
| `server/utils/accessControl.js` (`can`/`scopeQuery`/`requirePermission`) | Kept and extended, not replaced. New functions added, nothing removed. |
| `server/utils/hierarchyUtils.js` (`getAccessibleUserIds`, dataScope resolution) | Kept as-is — still the thing that answers "which user IDs can X see." |
| The `seedCanonicalHierarchy.js` **positions** (Admin/HR/PM/Supervisor/TL/Agent × tech + marketingAndSales) | **Superseded** by Section 1's table below. If that script was ever actually run against real data, Phase 0 of the companion plan treats its output as data to migrate, not code to delete blindly. |
| "Only Super Admin can manage Departments/Positions" | **Changing** — this is the Section 2 work. |

---

## 1. New org structure

### Cross-cutting tiers (not departments)

- **Super Admin** — unrestricted, org-wide, every module. Unchanged from today (`role === "super-admin"` bypass in `accessControl.js` and `hierarchyUtils.js`). Also the sole root of trust for the new delegation system: Super Admin sets Admin's permission ceiling, same as today's Access Management page already lets it do for any Position.
- **Admin** — org-wide by default (mirrors today's seeded "Admin" Position, level 95), but *exactly* how broad is now Super Admin's call to configure per Section 2, not a hardcoded bypass. Gains a new ability: delegated, bounded control over the permissions of people below Admin in the hierarchy.

Neither is a `Department`. A user with `role: "admin"` or `"super-admin"` doesn't need a `departmentRef` — matches today's schema (`User.departmentRef` already defaults to `null`).

### Department: Development

Renamed from the 2026-07-03 rework's "Tech" (which, in a nice coincidence, already had `legacyEnumValue: "development"` — the *display* name was "Tech" but the underlying legacy enum value was always `"development"`. This rename actually removes a naming mismatch rather than creating one).

```
Team Lead — Development      (top of chain, department-wide visibility)
   ↑ parentPosition
Supervisor — Development      (team-level visibility)
   ↑ parentPosition
Employee — Development        (own data only; specialization varies per person — see below)
   ↑ parentPosition
Intern — Development          (own data only; same permission floor as Employee)
```

No Project Manager tier in Development — per your description, project/client ownership sits with Sales' PM, and Development's Team Lead is the technical counterpart who receives the handoff (Section 3).

**Specialization (Digital Marketing, Content Writer, SEO Expert, and more) is not a separate Position.** All "Employee — Development" users share one Position (one set of permissions, one row to maintain), and specialization is per-user metadata. Concretely: reuse the `designation` field that already exists on `User` (`server/models/User.js:80-84`) and is currently free text — it's unused for this purpose today but is exactly the right shape (a display label, not an access decision). No schema change needed for this part. If you later want to *filter or report* by specialization ("show me every SEO Expert"), that argues for a small Super-Admin-managed suggestions list rather than pure free text, so "SEO Expert" and "Seo expert" don't silently become two buckets — flagged as an open item, not required for v1.

### Department: Sales

Renamed from "Marketing & Sales" → **Sales** (digital marketing moved under Development's specializations per your description, so the old name no longer fit).

```
Project Manager — Sales       (department-wide visibility; owns client relationship
   ↑ parentPosition            and overall project ownership — see Section 3)
Supervisor — Sales             (team-level visibility)
   ↑ parentPosition
Agent — Sales                  (own data only)
```

No Intern tier in Sales — you didn't mention one. Easy to add later (it's a data change, not a code change) if that's wrong.

### Department: HR

```
Senior HR      (department-wide visibility into HR-domain data — leave, attendance,
   ↑             payroll, employee records — same "HR-domain, not business-data"
   |             scope the 2026-07-03 rework already established for the HR tier)
Junior HR      (team-level visibility)
   ↑
HR Intern      (own data only)
```

You listed these as "Senior HR, Junior HR, Interns" — I've read that as descending seniority (Senior HR is the top of the ladder), which is the standard reading, but flagging it explicitly since the sentence itself doesn't state direction. Flip it if I read it backwards.

No separate "Supervisor"/"Team Lead" titles in HR — three flat seniority tiers, matching what you described (unlike Development/Sales, HR doesn't have a title change between "does the work" and "leads the team").



### Canonical hierarchy table

Numeric `level` is **cosmetic** — same rule the 2026-07-03 rework established and this revamp keeps: level drives seniority/tie-break comparisons only (e.g. "is this transfer-escalation target senior enough," `transferController.js`), never automatic data access. Actual access is always the explicit `permissions.*` flags + `hierarchicalAccess.dataScope`.

| Level | Position | Department | Reports to | dataScope | Permission highlights |
|---:|---|---|---|---|---|
| — | Super Admin *(role, no Position row)* | — | — | all | bypasses everything |
| 95 | Admin | — | Super Admin | all *(Super-Admin-configurable, not hardcoded — Section 2)* | broad; `canManageSubordinateAccess: true` (new, Section 2) |
| 70 | Project Manager — Sales | Sales | Admin | department | `canManageProjects`, `canViewDepartmentLeads/Callbacks`, `canAssignToSubordinates` |
| 65 | Team Lead — Development | Development | Admin | department | `canManageProjects`, `canViewDepartmentTasks`, `canAssignTasks`, `canAssignToSubordinates` |
| 60 | Senior HR | HR | Admin | own *(HR-domain flags, not business-data scope)* | `canApproveLeaves`, `canApproveShifts`, `canManageAttendance`, `canManageUsers` |
| 40 | Supervisor — Sales | Sales | Project Manager — Sales | team | `canViewSubordinateLeads/Callbacks`, `canEditSubordinateLeads/Callbacks` |
| 40 | Supervisor — Development | Development | Team Lead — Development | team | `canViewSubordinateTasks`, `canAssignTasks` |
| 30 | Junior HR | HR | Senior HR | team *(HR-domain)* | `canApproveLeaves` (limited), `canManageAttendance` |
| 15 | Employee — Development | Development | Supervisor — Development | own | none by default (self-access is always implicit) |
| 10 | Agent — Sales | Sales | Supervisor — Sales | own | none by default |
| 5 | Intern — Development | Development | Employee — Development | own | none by default |
| 5 | HR Intern | HR | Junior HR | own | none by default |

PM and Dev Team Lead are deliberately close in level (70/65), not one strictly above the other in a shared chain — organizationally they're lateral counterparts in different departments who hand off work to each other (Section 3), not manager/subordinate. The small gap reflects your clarification that the PM retains overall project/client ownership; make them equal if that distinction shouldn't exist at all.

This replaces the 2026-07-03 script's per-department PM→Supervisor→TL→Agent chain (identical shape for every delivery department) with department-specific shapes, and adds HR's three-tier ladder, which that script explicitly skipped ("Executives and HR are staff functions and deliberately don't get their own delivery chain").

---

## 2. New capability: bounded delegated permission editing

### The gap today

`server/routes/positionRoutes.js:232` (assign) and every mutating route in `server/routes/departmentRoutes.js` are gated with `authorize("super-admin")` — a hardcoded role check, not routed through `accessControl.js` at all. `Position.permissions.canManagePositions` / `canManageDepartments` exist on the schema but nothing currently reads them to let anyone *other than* super-admin through. So "Admin decides the access people under them will have" is new engineering, not a config change.

### The rule

Three safety rules, enforced together, every time someone who isn't Super Admin tries to change another user's access:

1. **Ceiling — can't grant what you don't have.** A grantor can only enable a permission flag on someone else if the grantor's own resolved Position currently has that flag `true`. Nobody can create a subordinate more powerful than themselves, accidentally or otherwise.
2. **Scope — can't reach outside your own tree.** The target user must already be inside the grantor's existing `hierarchyUtils.getAccessibleUserIds()` reach (their team/department, per their `dataScope`) *and* at a strictly lower `level` than the grantor. No lateral edits (Admin editing another Admin), no reaching into a different department's chain.
3. **Root of trust is exclusive.** `role: "super-admin"` is never editable by anyone but itself; `role: "admin"` is only editable by Super Admin. Delegation only applies below Admin.

This is deliberately **not hardcoded to the word "Admin."** It's a new boolean permission flag — `canManageSubordinateAccess` — added to the existing `Position.permissions` surface (bringing the flag count from 20 to 21) and seeded `true` only on the Admin Position for now. That keeps faith with the existing design principle ("`role` is a slim tier; `Position` carries the real power") and means if Tapvera later wants, say, Senior HR or a department's Team Lead to also delegate within their own team, it's a checkbox on the Access Management page, not a new code path.

### Position templates vs. per-user overrides — recommendation

A `Position` is a shared template — "Agent — Sales" is one document that (say) 12 agents all point to. If Admin opens an editor for one specific agent and flips a flag, mutating that shared document silently changes it for the other 11. That's the exact "silent disconnect" failure class the 2026-07-03 rework was built to eliminate (the Azad/Rahul incident) — this design should not reintroduce it one layer up.

Recommended model, two tools rather than one:

- **The normal path: Admin edits/creates Positions**, the same mental model Super Admin already uses today, just scoped to what's below Admin. Wanting one agent to have a permission their peers don't really means "this person needs a different Position" (e.g., clone "Agent — Sales" into "Senior Agent — Sales") — visible, auditable, and it's exactly how the rest of the system already works.
- **The escape hatch: a narrow per-user override.** For genuine one-offs, add a small `User.permissionOverrides` map (`{ [flagName]: true | false }`, default `{}`) that's layered on top of the resolved Position's flags at evaluation time in `accessControl.js`'s `evaluate()`. Still subject to the ceiling/scope rules above. Kept intentionally small and visibly flagged ("custom access" badge) in the Access Overview tab so it can't quietly sprawl into 200 unauditable snowflakes — if overrides start being the common case for a role instead of the exception, that's a signal to make it a real Position instead.

### Audit trail

Every delegated change (grant, revoke, position reassignment, position creation by anyone other than Super Admin) gets logged: `{ actorId, targetUserId, action, flagOrPositionName, previousValue, newValue, timestamp }`. Surfaced as a "recent changes" panel on the existing Access Overview tab, next to the current-state view it already shows. This is the direct answer to "who gave X this access and when" the same way Access Overview already answers "what can X access" — without it, delegation just moves the diagnostic-script problem down a level instead of solving it.

### API surface sketch (illustrative — finalized in the plan doc, not here)

```js
// server/utils/accessControl.js — additive
async function canManageAccessFor(grantor, targetUser) { /* ceiling + scope + root-of-trust rules above */ }
function grantableFlags(grantorPosition) { /* subset of PERMISSION_KEYS currently true on grantor */ }

// New routes, all wrapped in canManageAccessFor() per-target-user checks:
// GET   /api/positions/my-team                       -> users the caller may manage, per hierarchyUtils scope
// PATCH /api/positions/my-team/:userId/permissions    -> per-user override, ceiling-checked
// POST  /api/positions/my-team/positions              -> create a scoped Position (e.g. clone + adjust)
```

---

## 3. Sales PM ↔ Dev Team Lead relationship (context only — not built this round)

Per your clarification: **the Project Manager handles the project** — the PM owns the client relationship and overall project accountability. When the PM picks up work, they convey the technical requirements to Development's Team Lead, who executes/coordinates delivery. The Dev Team Lead is the technical counterpart, not a replacement client-facing owner.

This round is roles/departments/permissions only, so this is documented as organizational context, not built. When it is built (fast-follow), it'll most likely need: a explicit field on `Project` (or `Lead`) recording which Dev Team Lead a PM handed the work to, and a narrow visibility bridge so that Team Lead can see *that specific* project without gaining blanket visibility into Sales' pipeline — a good fit for the existing `SELF_IMPLICIT_ACTIONS`-style carve-out pattern already in `accessControl.js`, extended to "assigned-to-me-by-handoff" rather than "created-by-me." Flagging the shape now so Section 1's hierarchy doesn't accidentally make that harder to add later — it doesn't; nothing here blocks it.

---

## 4. Migration & compatibility strategy

Same additive discipline the 2026-07-03 rework used, because it worked:

1. **New Position/Department rows are added, not swapped in place.** Old rows (Admin/HR/PM/Supervisor/TL/Agent × tech/marketingAndSales, if `seedCanonicalHierarchy.js` was ever actually run) stay until Phase 3 of the plan confirms nothing real still points at them.
2. **Report, don't guess, for anyone already assigned.** Same pattern as `migrateToPositionRefs.js` — anyone currently sitting on an old Position gets listed in a report and reassigned deliberately via the Assign Employees tab, not auto-migrated by string-matching.
3. **The new `canManageSubordinateAccess` flag defaults `false`** on every existing Position except the newly-seeded Admin row — so no existing user's effective access changes the moment this ships.
4. **`designation` reuse for specialization is zero-migration** — it's already a field on every `User` document, just currently blank for most.

---

## What this fixes, directly

- "TL/Supervisor/PM distinctions have no enforced meaning" (still true post-07-03 for Development/Sales specifically, since that rework's seed script gave every delivery department the identical generic shape) → each department now has the shape it actually has, not a copy-pasted template.
- "Super admin decides every access, admin decides access for people under him" → today only the first half is true (and only via hardcoded role checks on a handful of routes, not the `accessControl.js` engine). Section 2 makes the second half real, with guardrails so delegation can't be used to escalate privilege.
- Digital Marketing / Content Writer / SEO Expert have a home (specialization on `Employee — Development`) without needing a Position row per job title.
- HR's flat seniority ladder is representable, which the 07-03 hierarchy didn't attempt (it excluded HR from the delivery chain entirely).

---

## Open Items for Review — resolved

Tapvera's answers, folded into the implementation (see the companion plan for exactly where):

1. **"Executives" department** — **leave dormant.** Left completely untouched in `updateDepartmentsV2.js` — not renamed, not deleted, not folded into anything. If anyone's actually assigned there today, they're unaffected until Tapvera decides o
1. therwise.
1. **HR ordering** — confirmed: Senior HR outranks Junior HR outranks Intern. Seeded at levels 60/30/5 in `seedRoleHierarchyV2.js`.
1. **Sales Intern tier** — confirmed absent for this round. Not seeded. Adding it later is a data change (new `Position` row), not a code change.
1. **Free-text vs. controlled specialization list** — confirmed: plain free text for v1. `EmployeeFormModal.jsx`'s Designation field relabels itself "Specialization" with example placeholders when department is Development; no schema change, no suggestions list built.
1. **Does delegated editing ever extend below Admin?** — confirmed: **Admin only for this round.** `canManageSubordinateAccess` is seeded `true` only on the "Admin" Position. The mechanism itself is still fully general — any Position can be granted the flag later from Access Management → Positions & Permissions (now includes a checkbox for it) with zero code changes. One implementation consequence of keeping this general: the "My Team's Access" nav entry had to be added to the `employee`/`hr`/`admin` menu arrays (not just `admin`'s) so a future grant to, say, Senior HR would actually surface the link — see the plan's Task 2.2 note.
1. **PM vs. Dev Team Lead level (70 vs. 65)** — confirmed: keep the small gap, PM slightly senior. Seeded exactly as drawn in Section 1's table below.

Companion implementation plan: [`docs/superpowers/plans/2026-07-27-role-hierarchy-revamp-plan.md`](../plans/2026-07-27-role-hierarchy-revamp-plan.md) — has the full implementation log and a "What was actually verified" section.
