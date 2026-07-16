const express = require("express");
const Position = require("../models/Position");
const User = require("../models/User");
const Department = require("../models/Department"); // Access-management rework (2026-07-03)
const { protect, authorize } = require("../middlewares/authMiddleware");
const hierarchyUtils = require("../utils/hierarchyUtils");

const router = express.Router();

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
router.post("/", protect, authorize("super-admin"), async (req, res) => {
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
router.put("/:id", protect, authorize("super-admin"), async (req, res) => {
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
router.delete("/:id", protect, authorize("super-admin"), async (req, res) => {
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

// Get users with their positions
router.get("/users/list", protect, authorize("super-admin", "admin", "hr"), async (req, res) => {
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
router.get("/stats", protect, authorize("super-admin", "admin"), async (req, res) => {
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
// ACCESS OVERVIEW (Access-management rework, 2026-07-03)
// Resolves a user's effective department/position/permissions and (for
// hierarchical positions) who they can see - the shipped answer to
// "why can't X see Y", replacing the need for a hand-run diagnostic script
// like server/diagnose-hierarchy.js.
// ==========================================
router.get("/users/:userId/access-overview", protect, authorize("super-admin", "admin"), async (req, res) => {
  try {
    const user = await User.findById(req.params.userId).select("-password");
    if (!user) {
      return res.status(404).json({ error: "User not found" });
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
        .select("name employeeId position department")
        .lean();
    }

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
    });
  } catch (err) {
    console.error("Error building access overview:", err);
    res.status(500).json({ error: "Server Error", message: err.message });
  }
});

module.exports = router;
