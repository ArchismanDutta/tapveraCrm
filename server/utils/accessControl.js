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
  "tasks:assign": ["canAssignTasks"],
  "tasks:view": ["canAssignTasks", "canViewSubordinateTasks", "canViewDepartmentTasks"],
  "leaves:approve": ["canApproveLeaves"],
  "shifts:approve": ["canApproveShifts"],
  "reports:view": ["canViewReports"],
  "attendance:manage": ["canManageAttendance"],
  "leads:view": ["canViewSubordinateLeads", "canViewDepartmentLeads"],
  "leads:edit": ["canEditSubordinateLeads"],
  "callbacks:view": ["canViewSubordinateCallbacks", "canViewDepartmentCallbacks"],
  "callbacks:edit": ["canEditSubordinateCallbacks"],
  "subordinates:assign": ["canAssignToSubordinates"],
};

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
 * Evaluate whether a resolved Position grants a given action.
 * Pure function (no DB access) so it's directly unit-testable — see
 * server/tests/accessControl.test.js.
 */
function evaluate(position, action) {
  if (!position) return false;
  const flags = ACTION_PERMISSION_MAP[action];
  if (!flags) {
    console.warn(`[accessControl] Unknown action "${action}" — denying by default. Add it to ACTION_PERMISSION_MAP if this is intentional.`);
    return false;
  }
  return flags.some((flag) => position.permissions?.[flag] === true);
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
    return evaluate(position, action);
  }

  const position = await resolvePosition(user);
  return evaluate(position, action);
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

module.exports = {
  can,
  scopeQuery,
  requirePermission,
  resolvePosition,
  evaluate,
  ACTION_PERMISSION_MAP,
  SELF_IMPLICIT_ACTIONS,
};
