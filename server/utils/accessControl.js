// server/utils/accessControl.js
//
// Access-management rework (2026-07-03) — Phase 1, Task 1.1.
// See docs/superpowers/specs/2026-07-03-access-management-design.md
//      docs/superpowers/plans/2026-07-03-access-management-rework.md
//
// Central permission engine. Goal: one choke point ("can I do X?") instead
// of the ~280 scattered role-string checks found across routes/controllers
// during the codebase audit. This module is ADDITIVE — it wraps and reuses
// the existing, already-working `hierarchyUtils.js` rather than replacing
// it. Nothing currently in production is switched over to this yet; that
// happens module-by-module in Phase 4, after this engine has been verified
// in shadow mode (see server/middlewares/accessShadowLog.js).
//
// Key design decision from the design doc: numeric Position level drives
// seniority/tie-breaking, NOT automatic data access. Access is always
// decided by explicit permission flags (ACTION_PERMISSION_MAP below) plus
// hierarchicalAccess.dataScope, so — for example — HR outranking Project
// Manager numerically does not silently grant HR blanket access to every
// department's sales pipeline.

const Position = require("../models/Position");
const hierarchyUtils = require("./hierarchyUtils"); // existing, kept working as-is
const AccessAuditLog = require("../models/AccessAuditLog"); // Role & Department Hierarchy Revamp v2 (2026-07-27)

// ---------------------------------------------------------------------------
// Action -> Position.permissions flag(s) that grant it.
// Some actions accept more than one flag (any one of them is sufficient) —
// e.g. either the "subordinate" or "department" flavor of a permission.
// Extend this map as new modules are migrated in Phase 4; it should always
// mirror the permission fields defined on server/models/Position.js.
// ---------------------------------------------------------------------------
const ACTION_PERMISSION_MAP = {
  "users:manage": ["canManageUsers"],
  "departments:manage": ["canManageDepartments"],
  "positions:manage": ["canManagePositions"],
  "clients:manage": ["canManageClients"],
  "projects:manage": ["canManageProjects"],
  "projects:view": ["canManageProjects", "canViewSubordinateProjects"],
  "communication:view": ["canViewCommunicationTracking"],
  "tasks:assign": ["canAssignTasks"],
  "tasks:view": ["canAssignTasks", "canViewSubordinateTasks", "canViewDepartmentTasks"],
  "leaves:approve": ["canApproveLeaves"],
  "shifts:approve": ["canApproveShifts"],
  "reports:view": ["canViewReports"],
  "attendance:manage": ["canManageAttendance"],
  "salary:manage": ["canManageSalary"],
  "leads:view": ["canViewSubordinateLeads", "canViewDepartmentLeads"],
  "leads:edit": ["canEditSubordinateLeads"],
  "callbacks:view": ["canViewSubordinateCallbacks", "canViewDepartmentCallbacks"],
  "callbacks:edit": ["canEditSubordinateCallbacks"],
  "subordinates:assign": ["canAssignToSubordinates"],
};

// Canonical list of every Position.permissions flag — single source of
// truth for validating flag names (e.g. positionRoutes.js's "my-team"
// delegated permission-editing routes) and for userController.js's
// getMyPermissions response. Keep in sync with the `permissions` subdocument
// in server/models/Position.js.
const PERMISSION_FLAG_KEYS = [
  "canManageUsers", "canManageClients", "canManageProjects", "canAssignTasks", "canViewCommunicationTracking",
  "canApproveLeaves", "canApproveShifts", "canViewReports", "canManageAttendance", "canManageSalary",
  "canViewSubordinateLeads", "canViewSubordinateCallbacks", "canViewSubordinateTasks", "canViewSubordinateProjects",
  "canEditSubordinateLeads", "canEditSubordinateCallbacks", "canAssignToSubordinates",
  "canViewDepartmentLeads", "canViewDepartmentCallbacks", "canViewDepartmentTasks",
  "canManageDepartments", "canManagePositions",
  // Role & Department Hierarchy Revamp v2 (2026-07-27):
  "canManageSubordinateAccess",
];

// Actions where a user always implicitly has access to their OWN data,
// regardless of Position permissions — mirrors the "self" carve-out that
// hierarchyUtils.canAccessUserData already applies.
const SELF_IMPLICIT_ACTIONS = new Set([
  "leads:view",
  "leads:edit",
  "callbacks:view",
  "callbacks:edit",
  "tasks:view",
  "projects:view",
]);

/**
 * Resolve the effective Position document for a user.
 * Prefers the new `positionRef` (Phase 0). Falls back to the legacy
 * free-text `position` string match during the transition window — the
 * same lookup hierarchyUtils.js already does — and logs when it has to,
 * which doubles as a live list of who still needs migrateToPositionRefs.js.
 */
async function resolvePosition(user) {
  if (!user) return null;

  if (user.positionRef) {
    const position = await Position.findById(user.positionRef);
    if (position && position.status === "active") return position;
  }

  if (user.position && user.position.trim()) {
    console.warn(
      `[accessControl] User ${user._id || user.name || "unknown"} resolved via legacy position string "${user.position}" (no positionRef set yet). Run server/scripts/migrateToPositionRefs.js.`
    );
    const legacyMatch = await Position.findOne({
      name: user.position.trim(),
      status: "active",
    });
    if (legacyMatch) return legacyMatch;
  }

  return null;
}

/**
 * Merge a resolved Position's permission flags with a user's
 * permissionOverrides (Mongoose Map, plain object, or undefined/null) —
 * override wins when present for a given flag, falls through to the
 * Position's flag otherwise. Pure, no DB access.
 *
 * Role & Department Hierarchy Revamp v2 (2026-07-27) — see
 * docs/superpowers/specs/2026-07-27-role-hierarchy-revamp-design.md Section 2
 * ("the escape hatch"). `overrides` is subject to the same ceiling rule as
 * everything else in the delegated-access system at write time
 * (canManageAccessFor/grantableFlags below) — this function just applies
 * whatever was already written, at read time.
 */
function resolveEffectivePermissions(position, overrides) {
  const base = { ...(position?.permissions || {}) };
  if (!overrides) return base;
  const overridesObj = typeof overrides.entries === "function" ? Object.fromEntries(overrides) : overrides;
  return { ...base, ...overridesObj };
}

/**
 * Evaluate whether a resolved Position (plus optional permissionOverrides)
 * grants a given action.
 * Pure function (no DB access) so it's directly unit-testable — see
 * server/tests/accessControl.test.js.
 */
function evaluate(position, action, overrides) {
  const flags = ACTION_PERMISSION_MAP[action];
  if (!flags) {
    console.warn(`[accessControl] Unknown action "${action}" — denying by default. Add it to ACTION_PERMISSION_MAP if this is intentional.`);
    return false;
  }
  if (!position && !overrides) return false;
  const effective = resolveEffectivePermissions(position, overrides);
  return flags.some((flag) => effective[flag] === true);
}

/**
 * can(user, action, options)
 * The main entry point. `user` is expected to look like req.user (see
 * middlewares/authMiddleware.js) — a plain object with at least
 * `_id`, `role`, `position`, `positionRef`.
 *
 * options.targetUserId — when checking access to a specific person's data,
 * enables the "always allowed on your own data" carve-out.
 */
async function can(user, action, options = {}) {
  if (!user) return false;

  // Super-admin bypasses everything — unchanged from existing behavior.
  if (user.role === "super-admin" || user.role === "superadmin") return true;

  // Self access is always allowed for actions where that makes sense,
  // regardless of Position permissions.
  if (
    options.targetUserId !== undefined &&
    options.targetUserId !== null &&
    SELF_IMPLICIT_ACTIONS.has(action) &&
    String(options.targetUserId) === String(user._id)
  ) {
    return true;
  }

  // Admin: today `admin` bypasses everything (see hierarchyUtils.js), same
  // as super-admin. The design doc recommends reining this in to a real,
  // explicit (very broad) permission set. Until an Admin Position exists
  // and is assigned (Phase 3), fall back to the historical full-bypass so
  // nothing regresses mid-migration — but log it, since this fallback is
  // meant to be temporary and is easy to lose track of otherwise.
  if (user.role === "admin") {
    const position = await resolvePosition(user);
    if (!position) {
      console.warn(
        `[accessControl] Admin user ${user._id} has no resolved Position yet — falling back to legacy full-bypass behavior for "${action}". Assign an Admin Position via the Access Management page (Phase 2/3) to replace this fallback.`
      );
      return true;
    }
    return evaluate(position, action, user.permissionOverrides);
  }

  const position = await resolvePosition(user);
  return evaluate(position, action, user.permissionOverrides);
}

/**
 * scopeQuery(user, resourceUserField)
 * Returns a Mongo filter fragment, e.g. { assignedTo: { $in: [...] } }, or
 * {} to mean "no restriction — see everything". Delegates the actual ID
 * resolution to hierarchyUtils.getAccessibleUserIds, which already handles
 * team/department/own scoping correctly — this function just adds the
 * admin-scope check the design doc calls for and shapes the result as a
 * ready-to-spread Mongo filter.
 */
async function scopeQuery(user, resourceUserField = "assignedTo") {
  if (!user) return { _id: null }; // matches nothing

  if (user.role === "super-admin" || user.role === "superadmin") return {};

  if (user.role === "admin") {
    const position = await resolvePosition(user);
    // No Admin Position assigned yet -> legacy fallback (see `can` above).
    if (!position) return {};
    if (position.hierarchicalAccess?.dataScope === "all") return {};
  }

  const accessibleIds = await hierarchyUtils.getAccessibleUserIds(user);
  return { [resourceUserField]: { $in: accessibleIds } };
}

/**
 * Express middleware factory — replaces `authorize(...)` at the route
 * level once a module is cut over in Phase 4. Not wired into any route
 * yet in this phase.
 */
function requirePermission(action) {
  return async (req, res, next) => {
    if (!req.user) {
      return res.status(401).json({ message: "User missing from request context." });
    }
    try {
      const allowed = await can(req.user, action, {
        targetUserId: req.params?.userId || req.params?.id,
      });
      if (!allowed) {
        return res.status(403).json({
          message: `Access denied. Missing permission '${action}'.`,
        });
      }
      next();
    } catch (err) {
      console.error("[accessControl] requirePermission error:", err);
      return res.status(500).json({ message: "Server error during authorization." });
    }
  };
}

// ---------------------------------------------------------------------------
// Delegated permission editing (Role & Department Hierarchy Revamp v2,
// 2026-07-27). See docs/superpowers/specs/2026-07-27-role-hierarchy-revamp-design.md
// Section 2. Lets a Position holder with `canManageSubordinateAccess` (seeded
// on Admin only for now, extensible to any Position later — no code change
// needed) open a bounded editor over their own subordinates' access, subject
// to three rules enforced together every time: (1) ceiling — can't grant a
// flag you don't hold yourself, (2) scope — target must be inside your own
// hierarchyUtils reach AND strictly lower level, (3) root of trust —
// super-admin is never editable by anyone but itself, admin only by
// super-admin.
// ---------------------------------------------------------------------------

/**
 * Pure decision core for "can `grantor` manage `targetUser`'s access at
 * all?" (the relationship, not which flags — that's grantableFlags below).
 * No DB access — directly unit-testable. `accessibleIds` is the grantor's
 * hierarchyUtils.getAccessibleUserIds() result, already resolved by the
 * caller (canManageAccessFor).
 */
function evaluateManageAccess({ grantorRole, grantorPosition, targetRole, targetUserId, targetPosition, accessibleIds }) {
  if (grantorRole === "super-admin" || grantorRole === "superadmin") return true;
  if (targetRole === "super-admin" || targetRole === "superadmin") return false; // root of trust: nobody edits super-admin but itself
  if (targetRole === "admin") return false; // root of trust: only super-admin edits admin

  if (!grantorPosition?.permissions?.canManageSubordinateAccess) return false;
  if (!targetPosition) return false;
  if (targetPosition.level >= grantorPosition.level) return false; // no lateral or upward edits

  const ids = (accessibleIds || []).map(String);
  return ids.includes(String(targetUserId));
}

/**
 * async wrapper around evaluateManageAccess() that resolves Positions and
 * the accessible-ID scope from the DB. This is what routes should actually
 * call.
 */
async function canManageAccessFor(grantor, targetUser) {
  if (!grantor || !targetUser) return false;

  if (grantor.role === "super-admin" || grantor.role === "superadmin") return true;
  if (targetUser.role === "super-admin" || targetUser.role === "superadmin") return false;
  if (targetUser.role === "admin") return false;

  const [grantorPosition, targetPosition, accessibleIds] = await Promise.all([
    resolvePosition(grantor),
    resolvePosition(targetUser),
    hierarchyUtils.getAccessibleUserIds(grantor),
  ]);

  return evaluateManageAccess({
    grantorRole: grantor.role,
    grantorPosition,
    targetRole: targetUser.role,
    targetUserId: targetUser._id,
    targetPosition,
    accessibleIds,
  });
}

/**
 * The subset of PERMISSION_FLAG_KEYS the grantor can hand out — never more
 * than they currently hold themselves (the "ceiling" rule). Pure, no DB
 * access. Only meaningful for GRANTING (value: true); revoking a
 * subordinate's flag (value: false) never escalates privilege, so routes
 * should only consult this when value === true.
 */
function grantableFlags(grantorPosition) {
  if (!grantorPosition) return [];
  return Object.entries(grantorPosition.permissions || {})
    .filter(([, value]) => value === true)
    .map(([key]) => key);
}

/**
 * Records a delegated access change to AccessAuditLog — every grant,
 * revoke, position reassignment, or position creation by anyone other than
 * Super Admin should call this. The shipped answer to "who gave X this
 * access and when," surfaced on the Access Overview tab. Deliberately
 * swallows its own errors: a logging failure must never block the
 * underlying permission change from taking effect.
 */
async function logAccessChange({ actorId, targetUserId, action, flagOrPositionName, previousValue, newValue }) {
  try {
    await AccessAuditLog.create({ actorId, targetUserId, action, flagOrPositionName, previousValue, newValue });
  } catch (err) {
    console.error("[accessControl] Failed to write access audit log (underlying change was NOT blocked):", err.message);
  }
}

module.exports = {
  can,
  scopeQuery,
  requirePermission,
  resolvePosition,
  evaluate,
  resolveEffectivePermissions,
  ACTION_PERMISSION_MAP,
  SELF_IMPLICIT_ACTIONS,
  PERMISSION_FLAG_KEYS,
  // Delegated permission editing (2026-07-27):
  evaluateManageAccess,
  canManageAccessFor,
  grantableFlags,
  logAccessChange,
};
