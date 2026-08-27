const express = require("express");
const Position = require("../models/Position");
const User = require("../models/User");
const Department = require("../models/Department"); // Access-management rework (2026-07-03)
const { protect, authorize } = require("../middlewares/authMiddleware");
const hierarchyUtils = require("../utils/hierarchyUtils");
const accessControl = require("../utils/accessControl"); // Role & Department Hierarchy Revamp v2 (2026-07-27)
const AccessAuditLog = require("../models/AccessAuditLog");

const router = express.Router();

// Additive: super-admin keeps existing access. Any Position explicitly granted
// "canManagePositions" is also allowed for create/update/delete operations.
// Position-to-user assignment (PATCH /users/:userId/assign) stays super-admin
// only — that is the root-of-trust boundary for the whole permission system.
const requirePositionManage = async (req, res, next) => {
  if (await accessControl.can(req.user, "positions:manage")) return next();
  return authorize("super-admin")(req, res, next);
};

// Legacy User.department enum values (server/models/User.js) — a Department
// document can only be synced into that legacy string field if its
// legacyEnumValue is one of these; otherwise the field is left untouched
// and departmentRef becomes the sole source of truth for that user/position.
const LEGACY_DEPARTMENT_ENUM = ["executives", "development", "marketingAndSales", "humanResource", ""];

// ==========================================
// POSITION MANAGEMENT (Super-Admin Only)
// ==========================================

// Get all positions
router.get("/", protect, async (req, res) => {
  try {
    const { status, department } = req.query;

    let query = {};
    if (status) query.status = status;
    if (department && department !== "all") query.department = department;

    const positions = await Position.find(query)
      .sort({ level: -1, name: 1 })
      .populate("createdBy", "name email")
      .populate("departmentRef", "name code status") // Access-management rework (2026-07-03)
      .populate("parentPosition", "name level");

    res.json(positions);
  } catch (err) {
    console.error("Error fetching positions:", err);
    res.status(500).json({ error: "Server Error" });
  }
});

// Create new position
router.post("/", protect, requirePositionManage, async (req, res) => {
  try {
    const {
      name, level, department, description, permissions,
      departmentRef, parentPosition, hierarchicalAccess, // Access-management rework (2026-07-03)
    } = req.body;

    // Check if position already exists
    const existingPosition = await Position.findOne({
      name: { $regex: new RegExp(`^${name}$`, 'i') }
    });

    if (existingPosition) {
      return res.status(400).json({ error: "Position with this name already exists" });
    }

    let resolvedDepartmentRef = null;
    let legacyDepartment = department || "all";
    if (departmentRef) {
      const deptDoc = await Department.findById(departmentRef);
      if (!deptDoc) {
        return res.status(400).json({ error: "Invalid departmentRef." });
      }
      resolvedDepartmentRef = deptDoc._id;
      // Keep the legacy enum field in sync only when the new department has
      // a legacy equivalent - otherwise leave it at its enum default ("all")
      // rather than fail validation on a value the enum doesn't allow.
      if (deptDoc.legacyEnumValue && LEGACY_DEPARTMENT_ENUM.includes(deptDoc.legacyEnumValue)) {
        legacyDepartment = deptDoc.legacyEnumValue;
      }
    }

    if (parentPosition) {
      const parentDoc = await Position.findById(parentPosition);
      if (!parentDoc) {
        return res.status(400).json({ error: "Invalid parentPosition." });
      }
    }

    const newPosition = new Position({
      name: name.trim(),
      level: level || 50,
      department: legacyDepartment,
      departmentRef: resolvedDepartmentRef,
      parentPosition: parentPosition || null,
      description: description || "",
      permissions: permissions || {},
      hierarchicalAccess: hierarchicalAccess || undefined,
      createdBy: req.user._id
    });

    await newPosition.save();
    res.status(201).json(newPosition);
  } catch (err) {
    console.error("Error creating position:", err);
    res.status(500).json({ error: "Server Error", message: err.message });
  }
});

// Update position
router.put("/:id", protect, requirePositionManage, async (req, res) => {
  try {
    const {
      name, level, department, description, permissions, status,
      departmentRef, parentPosition, hierarchicalAccess, // Access-management rework (2026-07-03)
    } = req.body;

    const position = await Position.findById(req.params.id);
    if (!position) {
      return res.status(404).json({ error: "Position not found" });
    }

    // Check if name is being changed and if it conflicts with another position
    if (name && name.trim() !== position.name) {
      const existingPosition = await Position.findOne({
        name: { $regex: new RegExp(`^${name}$`, 'i') },
        _id: { $ne: req.params.id }
      });

      if (existingPosition) {
        return res.status(400).json({ error: "Position with this name already exists" });
      }
      position.name = name.trim();
    }

    if (level !== undefined) position.level = level;
    if (department) position.department = department;
    if (description !== undefined) position.description = description;
    if (permissions) position.permissions = { ...position.permissions, ...permissions };
    if (status) position.status = status;

    if (departmentRef !== undefined) {
      if (departmentRef === null || departmentRef === "") {
        position.departmentRef = null;
      } else {
        const deptDoc = await Department.findById(departmentRef);
        if (!deptDoc) {
          return res.status(400).json({ error: "Invalid departmentRef." });
        }
        position.departmentRef = deptDoc._id;
        if (deptDoc.legacyEnumValue && LEGACY_DEPARTMENT_ENUM.includes(deptDoc.legacyEnumValue)) {
          position.department = deptDoc.legacyEnumValue;
        }
      }
    }

    if (parentPosition !== undefined) {
      if (parentPosition === null || parentPosition === "") {
        position.parentPosition = null;
      } else {
        if (parentPosition === req.params.id) {
          return res.status(400).json({ error: "A position cannot be its own parent." });
        }
        const parentDoc = await Position.findById(parentPosition);
        if (!parentDoc) {
          return res.status(400).json({ error: "Invalid parentPosition." });
        }
        position.parentPosition = parentDoc._id;
      }
    }

    if (hierarchicalAccess) {
      position.hierarchicalAccess = { ...position.hierarchicalAccess?.toObject?.() ?? position.hierarchicalAccess, ...hierarchicalAccess };
    }

    await position.save();
    res.json(position);
  } catch (err) {
    console.error("Error updating position:", err);
    res.status(500).json({ error: "Server Error", message: err.message });
  }
});

// Delete position
router.delete("/:id", protect, requirePositionManage, async (req, res) => {
  try {
    const position = await Position.findById(req.params.id);
    if (!position) {
      return res.status(404).json({ error: "Position not found" });
    }

    // Check if any users have this position
    const usersWithPosition = await User.countDocuments({ position: position.name });

    if (usersWithPosition > 0) {
      return res.status(400).json({
        error: `Cannot delete position. ${usersWithPosition} user(s) currently assigned to this position.`,
        usersCount: usersWithPosition
      });
    }

    await Position.findByIdAndDelete(req.params.id);
    res.json({ message: "Position deleted successfully" });
  } catch (err) {
    console.error("Error deleting position:", err);
    res.status(500).json({ error: "Server Error" });
  }
});

// ==========================================
// USER POSITION ASSIGNMENT (Super-Admin Only)
// ==========================================

// Get users with their positions — read-only; assignment itself stays super-admin only.
// Opened to canManagePositions/canManageDepartments so the Access Management page's
// Assign Employees and Access Overview tabs load correctly for delegated managers.
const requirePositionOrDeptManage = async (req, res, next) => {
  if (
    await accessControl.can(req.user, "positions:manage") ||
    await accessControl.can(req.user, "departments:manage")
  ) return next();
  return authorize("super-admin", "admin", "hr")(req, res, next);
};
router.get("/users/list", protect, requirePositionOrDeptManage, async (req, res) => {
  try {
    const { department, position, role } = req.query;

    let query = { status: "active" };
    if (department && department !== "") query.department = department;
    if (position && position !== "") query.position = position;
    if (role && role !== "") query.role = role;

    const users = await User.find(query)
      .select("employeeId name email role department departmentRef designation position positionRef positionLevel avatar")
      .populate("departmentRef", "name code") // Access-management rework (2026-07-03)
      .populate("positionRef", "name level")
      .sort({ positionLevel: -1, name: 1 });

    res.json(users);
  } catch (err) {
    console.error("Error fetching users:", err);
    res.status(500).json({ error: "Server Error" });
  }
});

// Assign position to user
// Preferred (Access-management rework, 2026-07-03): { positionId, departmentId? }
// Legacy (kept working for backward compatibility): { position: "name string" }
router.patch("/users/:userId/assign", protect, authorize("super-admin"), async (req, res) => {
  try {
    const { position, positionLevel, positionId, departmentId } = req.body;

    const user = await User.findById(req.params.userId);
    if (!user) {
      return res.status(404).json({ error: "User not found" });
    }

    if (positionId) {
      // ---- Reference-based path (preferred) ----
      const positionDoc = await Position.findById(positionId);
      if (!positionDoc || positionDoc.status !== "active") {
        return res.status(400).json({ error: "Invalid position. Position does not exist or is inactive." });
      }

      user.positionRef = positionDoc._id;
      user.position = positionDoc.name; // keep legacy string field in sync
      user.positionLevel = positionDoc.level;

      // Department: explicit departmentId wins, otherwise infer from the position's own department.
      const effectiveDepartmentId = departmentId || positionDoc.departmentRef || null;
      if (effectiveDepartmentId) {
        const deptDoc = await Department.findById(effectiveDepartmentId);
        if (!deptDoc) {
          return res.status(400).json({ error: "Invalid department." });
        }
        user.departmentRef = deptDoc._id;
        if (deptDoc.legacyEnumValue && LEGACY_DEPARTMENT_ENUM.includes(deptDoc.legacyEnumValue)) {
          user.department = deptDoc.legacyEnumValue;
        }
        // else: this department has no legacy equivalent - departmentRef is now
        // the source of truth for this user, legacy `department` string untouched.
      }
    } else if (position !== undefined) {
      // ---- Legacy free-text path (unchanged behavior, for backward compatibility) ----
      if (position && position.trim()) {
        const positionDoc = await Position.findOne({ name: position.trim(), status: "active" });
        if (!positionDoc) {
          return res.status(400).json({ error: "Invalid position. Position does not exist or is inactive." });
        }
        user.position = position.trim();
        user.positionLevel = positionLevel !== undefined ? positionLevel : positionDoc.level;
      } else {
        // Clear position
        user.position = "";
        user.positionLevel = 0;
        user.positionRef = null;
      }
    } else {
      return res.status(400).json({ error: "Provide either positionId (preferred) or position." });
    }

    await user.save();

    res.json({
      message: "Position assigned successfully",
      user: {
        _id: user._id,
        name: user.name,
        department: user.department,
        departmentRef: user.departmentRef,
        position: user.position,
        positionRef: user.positionRef,
        positionLevel: user.positionLevel
      }
    });
  } catch (err) {
    console.error("Error assigning position:", err);
    res.status(500).json({ error: "Server Error", message: err.message });
  }
});

// Bulk assign positions
router.post("/users/bulk-assign", protect, authorize("super-admin"), async (req, res) => {
  try {
    const { assignments } = req.body; // [{ userId, position, positionLevel }]

    if (!Array.isArray(assignments) || assignments.length === 0) {
      return res.status(400).json({ error: "Invalid assignments data" });
    }

    const results = {
      successCount: 0,
      failedCount: 0,
      errors: []
    };

    for (const assignment of assignments) {
      try {
        const { userId, position, positionLevel } = assignment;

        const user = await User.findById(userId);
        if (!user) {
          results.failedCount++;
          results.errors.push({ userId, error: "User not found" });
          continue;
        }

        if (position && position.trim()) {
          const positionDoc = await Position.findOne({ name: position.trim(), status: "active" });
          if (!positionDoc) {
            results.failedCount++;
            results.errors.push({ userId, error: "Position not found or inactive" });
            continue;
          }

          user.position = position.trim();
          user.positionLevel = positionLevel !== undefined ? positionLevel : positionDoc.level;
        } else {
          user.position = "";
          user.positionLevel = 0;
        }

        await user.save();
        results.successCount++;
      } catch (err) {
        results.failedCount++;
        results.errors.push({ userId: assignment.userId, error: err.message });
      }
    }

    res.json({
      message: `Successfully assigned positions to ${results.successCount} user(s)`,
      results
    });
  } catch (err) {
    console.error("Error in bulk assign:", err);
    res.status(500).json({ error: "Server Error", message: err.message });
  }
});

// Get position statistics
router.get("/stats", protect, requirePositionManage, async (req, res) => {
  try {
    const [totalPositions, activePositions, usersWithPositions, positionDistribution] = await Promise.all([
      Position.countDocuments(),
      Position.countDocuments({ status: "active" }),
      User.countDocuments({ position: { $ne: "" } }),
      User.aggregate([
        { $match: { position: { $ne: "" }, status: "active" } },
        { $group: { _id: "$position", count: { $sum: 1 } } },
        { $sort: { count: -1 } }
      ])
    ]);

    res.json({
      totalPositions,
      activePositions,
      usersWithPositions,
      usersWithoutPositions: await User.countDocuments({ position: "", status: "active" }),
      positionDistribution
    });
  } catch (err) {
    console.error("Error fetching position stats:", err);
    res.status(500).json({ error: "Server Error" });
  }
});

// ==========================================
// DELEGATED PERMISSION EDITING — "MY TEAM'S ACCESS"
// Role & Department Hierarchy Revamp v2 (2026-07-27). See
// docs/superpowers/specs/2026-07-27-role-hierarchy-revamp-design.md Section 2.
//
// Deliberately NOT gated with a static authorize("admin") role list — the
// whole point is that the check is relationship-dependent, per target user,
// via accessControl.canManageAccessFor(). Today only the seeded Admin
// Position holds canManageSubordinateAccess, but nothing here hardcodes
// that: any Position can be granted the flag later from the Access
// Management page, and these routes would just start working for it.
// ==========================================

// Users the caller may manage: hierarchyUtils scope, filtered to strictly
// lower level than the caller.
router.get("/my-team", protect, async (req, res) => {
  try {
    const isSuperAdmin = req.user.role === "super-admin" || req.user.role === "superadmin";
    const grantorPosition = await accessControl.resolvePosition(req.user);

    if (!isSuperAdmin && !grantorPosition?.permissions?.canManageSubordinateAccess) {
      return res.status(403).json({ error: "You don't have delegated access management permission." });
    }

    const accessibleIds = await hierarchyUtils.getAccessibleUserIds(req.user);
    const grantorLevel = isSuperAdmin ? Infinity : (grantorPosition?.level ?? -1);

    const users = await User.find({
      _id: { $in: accessibleIds, $ne: req.user._id },
      status: "active",
    })
      .select("employeeId name email role department departmentRef designation position positionRef positionLevel permissionOverrides avatar")
      .populate("departmentRef", "name code")
      .populate("positionRef", "name level")
      .sort({ positionLevel: -1, name: 1 });

    // Defense in depth — the PATCH route below re-checks this per-user via
    // canManageAccessFor(); don't even list people who wouldn't pass it.
    const filtered = users.filter((u) => {
      const level = u.positionRef?.level ?? u.positionLevel ?? 0;
      return level < grantorLevel;
    });

    res.json(
      filtered.map((u) => ({
        _id: u._id,
        employeeId: u.employeeId,
        name: u.name,
        email: u.email,
        role: u.role,
        department: u.departmentRef || (u.department ? { name: u.department, code: u.department } : null),
        designation: u.designation,
        position: u.positionRef ? { _id: u.positionRef._id, name: u.positionRef.name, level: u.positionRef.level } : { name: u.position, level: u.positionLevel },
        hasOverrides: Boolean(u.permissionOverrides && u.permissionOverrides.size > 0),
      }))
    );
  } catch (err) {
    console.error("Error fetching my-team:", err);
    res.status(500).json({ error: "Server Error", message: err.message });
  }
});

// What the caller is currently allowed to hand out — drives which toggles
// the "My Team's Access" editor renders enabled vs. disabled-with-tooltip.
router.get("/my-team/grantable-flags", protect, async (req, res) => {
  try {
    if (req.user.role === "super-admin" || req.user.role === "superadmin") {
      return res.json({ flags: accessControl.PERMISSION_FLAG_KEYS });
    }
    const grantorPosition = await accessControl.resolvePosition(req.user);
    res.json({ flags: accessControl.grantableFlags(grantorPosition) });
  } catch (err) {
    console.error("Error fetching grantable flags:", err);
    res.status(500).json({ error: "Server Error", message: err.message });
  }
});

// Grant or revoke a single permission override on a subordinate.
// Ceiling (ownFlag must be true on grantor's own Position), scope (target
// must be in grantor's own accessible-users tree, strictly lower level),
// and root-of-trust (super-admin/admin untouchable except by super-admin)
// are all enforced by canManageAccessFor() + the ceiling check below.
router.patch("/my-team/:userId/permissions", protect, async (req, res) => {
  try {
    const { flag, value } = req.body;

    if (typeof flag !== "string" || !accessControl.PERMISSION_FLAG_KEYS.includes(flag)) {
      return res.status(400).json({ error: `Unknown permission flag "${flag}".` });
    }
    if (typeof value !== "boolean") {
      return res.status(400).json({ error: "Body must include a boolean `value`." });
    }

    const targetUser = await User.findById(req.params.userId);
    if (!targetUser) {
      return res.status(404).json({ error: "User not found." });
    }

    const allowed = await accessControl.canManageAccessFor(req.user, targetUser);
    if (!allowed) {
      return res.status(403).json({ error: "You don't have permission to manage this user's access." });
    }

    // Ceiling rule only applies to GRANTING (value: true) — revoking a
    // subordinate's flag only ever tightens access, so it never needs it.
    if (value === true && req.user.role !== "super-admin") {
      const grantorPosition = await accessControl.resolvePosition(req.user);
      const grantable = accessControl.grantableFlags(grantorPosition);
      if (!grantable.includes(flag)) {
        return res.status(403).json({ error: `You can't grant "${flag}" — you don't hold it yourself.` });
      }
    }

    const previousValue = targetUser.permissionOverrides?.get
      ? targetUser.permissionOverrides.get(flag)
      : undefined;

    if (!targetUser.permissionOverrides) targetUser.permissionOverrides = new Map();
    targetUser.permissionOverrides.set(flag, value);
    targetUser.markModified("permissionOverrides");
    await targetUser.save();

    await accessControl.logAccessChange({
      actorId: req.user._id,
      targetUserId: targetUser._id,
      action: value ? "grant" : "revoke",
      flagOrPositionName: flag,
      previousValue: previousValue === undefined ? null : previousValue,
      newValue: value,
    });

    res.json({
      message: "Permission override updated.",
      userId: targetUser._id,
      flag,
      value,
    });
  } catch (err) {
    console.error("Error updating subordinate permission:", err);
    res.status(500).json({ error: "Server Error", message: err.message });
  }
});

// Scoped Position create (e.g. clone "Agent — Sales", adjust one flag, name
// it "Senior Agent — Sales") — the recommended path for "this one person
// needs a different permission than their peers" instead of mutating a
// shared Position template out from under everyone else pointing at it.
router.post("/my-team/positions", protect, async (req, res) => {
  try {
    const isSuperAdmin = req.user.role === "super-admin" || req.user.role === "superadmin";
    const grantorPosition = await accessControl.resolvePosition(req.user);

    if (!isSuperAdmin && !grantorPosition?.permissions?.canManageSubordinateAccess) {
      return res.status(403).json({ error: "You don't have delegated access management permission." });
    }

    const { name, level, description, permissions, parentPosition } = req.body;
    if (!name || !name.trim()) {
      return res.status(400).json({ error: "Position name is required." });
    }

    const existingPosition = await Position.findOne({ name: { $regex: new RegExp(`^${name}$`, "i") } });
    if (existingPosition) {
      return res.status(400).json({ error: "Position with this name already exists" });
    }

    const requestedPermissions = permissions || {};
    let requestedLevel = level !== undefined && level !== null ? Number(level) : 10;

    if (!isSuperAdmin) {
      const grantable = accessControl.grantableFlags(grantorPosition);
      const overreach = Object.entries(requestedPermissions)
        .filter(([, v]) => v === true)
        .map(([k]) => k)
        .filter((k) => !grantable.includes(k));
      if (overreach.length > 0) {
        return res.status(403).json({
          error: `You can't grant these flags — you don't hold them yourself: ${overreach.join(", ")}`,
        });
      }

      // A delegated position must sit strictly below its creator's own
      // level — same scope rule as everything else in this system.
      if (requestedLevel >= grantorPosition.level) {
        return res.status(400).json({ error: `Level must be lower than your own position's level (${grantorPosition.level}).` });
      }
    }

    const newPosition = new Position({
      name: name.trim(),
      level: requestedLevel,
      department: "all",
      departmentRef: (!isSuperAdmin ? grantorPosition?.departmentRef : req.body.departmentRef) || null,
      parentPosition: parentPosition || grantorPosition?._id || null,
      description: description || "",
      permissions: requestedPermissions,
      createdBy: req.user._id,
    });
    await newPosition.save();

    await accessControl.logAccessChange({
      actorId: req.user._id,
      targetUserId: req.user._id, // position creation has no single target user
      action: "create-position",
      flagOrPositionName: newPosition.name,
      previousValue: null,
      newValue: newPosition.permissions,
    });

    res.status(201).json(newPosition);
  } catch (err) {
    console.error("Error creating scoped position:", err);
    res.status(500).json({ error: "Server Error", message: err.message });
  }
});

// ==========================================
// ACCESS OVERVIEW (Access-management rework, 2026-07-03)
// Resolves a user's effective department/position/permissions and (for
// hierarchical positions) who they can see - the shipped answer to
// "why can't X see Y", replacing the need for a hand-run diagnostic script
// like server/diagnose-hierarchy.js.
//
// Role & Department Hierarchy Revamp v2 (2026-07-27): Changed from
// authorize("super-admin", "admin") to permission-based check, since this
// is used by MyTeamAccessPage for anyone with canManageSubordinateAccess.
// ==========================================
router.get("/users/:userId/access-overview", protect, async (req, res) => {
  try {
    const user = await User.findById(req.params.userId).select("-password");
    if (!user) {
      return res.status(404).json({ error: "User not found" });
    }

    // Permission check: super-admin/admin always allowed, otherwise check
    // canManageSubordinateAccess permission and scope (must be able to manage this specific user).
    const isSuperAdmin = req.user.role === "super-admin" || req.user.role === "superadmin";
    const isAdmin = req.user.role === "admin";

    if (!isSuperAdmin && !isAdmin) {
      const grantorPosition = await accessControl.resolvePosition(req.user);
      if (!grantorPosition?.permissions?.canManageSubordinateAccess) {
        return res.status(403).json({ error: "Access denied. You need 'Delegate access to subordinates' permission." });
      }

      // Check if this user is actually within the manager's scope
      const canManage = await accessControl.canManageAccessFor(req.user, user);
      if (!canManage) {
        return res.status(403).json({ error: "Access denied. This user is not in your reporting tree." });
      }
    }

    // Resolve effective position: positionRef first, legacy string match as fallback.
    let position = null;
    let resolvedVia = null;
    if (user.positionRef) {
      position = await Position.findById(user.positionRef);
      if (position) resolvedVia = "positionRef";
    }
    if (!position && user.position && user.position.trim()) {
      position = await Position.findOne({ name: user.position.trim(), status: "active" });
      if (position) resolvedVia = "legacy-string-match";
    }

    let department = null;
    if (user.departmentRef) {
      department = await Department.findById(user.departmentRef);
    }

    // Walk the parentPosition chain for a human-readable hierarchy path.
    const hierarchyChain = [];
    let current = position;
    let guard = 0;
    while (current && guard < 20) {
      hierarchyChain.push({ _id: current._id, name: current.name, level: current.level });
      if (!current.parentPosition) break;
      current = await Position.findById(current.parentPosition);
      guard += 1;
    }

    const bypassesEverything = user.role === "super-admin" || user.role === "superadmin" || user.role === "admin";

    let accessibleUsers = [];
    if (!bypassesEverything && position) {
      const accessibleIds = await hierarchyUtils.getAccessibleUserIds(user);
      accessibleUsers = await User.find({
        _id: { $in: accessibleIds, $ne: user._id },
      })
        .collation({ locale: "en", strength: 1 })
        .sort({ name: 1 })
        .select("name employeeId position department")
        .lean();
    }

    // Role & Department Hierarchy Revamp v2 (2026-07-27), Task 2.3: surface
    // the delegated-access audit trail right next to the current-state view
    // this endpoint already provides — "who changed what, for whom, when."
    const recentAccessChanges = await AccessAuditLog.find({ targetUserId: user._id })
      .sort({ createdAt: -1 })
      .limit(20)
      .populate("actorId", "name employeeId")
      .lean();

    // Same revamp: the Position's raw permissions alone under-report a user
    // who has permissionOverrides layered on top (server/routes/positionRoutes.js's
    // PATCH /my-team/:userId/permissions writes there). Surface both the raw
    // overrides map and the merged effective result, reused by both this
    // super-admin/admin Access Overview tab and MyTeamAccessPage.jsx's editor.
    const permissionOverrides = user.permissionOverrides ? Object.fromEntries(user.permissionOverrides) : {};
    const effectivePermissions = accessControl.resolveEffectivePermissions(position, user.permissionOverrides);

    res.json({
      user: {
        _id: user._id,
        name: user.name,
        employeeId: user.employeeId,
        email: user.email,
        role: user.role,
      },
      department: department
        ? { _id: department._id, name: department.name, code: department.code }
        : null,
      departmentSource: user.departmentRef ? "departmentRef" : user.department ? "legacy-department-enum" : "none",
      position: position
        ? {
            _id: position._id,
            name: position.name,
            level: position.level,
            permissions: position.permissions,
            hierarchicalAccess: position.hierarchicalAccess,
          }
        : null,
      positionResolvedVia: resolvedVia,
      hierarchyChain, // [self position, parent, grandparent, ...]
      bypassesEverything,
      accessibleUsersCount: bypassesEverything ? "all" : accessibleUsers.length,
      accessibleUsers: bypassesEverything ? [] : accessibleUsers,
      recentAccessChanges,
      permissionOverrides,
      effectivePermissions,
    });
  } catch (err) {
    console.error("Error building access overview:", err);
    res.status(500).json({ error: "Server Error", message: err.message });
  }
});

module.exports = router;
