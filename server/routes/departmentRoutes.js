const express = require("express");
const Department = require("../models/Department");
const Position = require("../models/Position");
const User = require("../models/User");
const { protect, authorize } = require("../middlewares/authMiddleware");
const { can } = require("../utils/accessControl");

const router = express.Router();

// Additive: super-admin keeps existing access. Any Position explicitly granted
// "canManageDepartments" (via Access Management) is also allowed in.
const requireDeptManage = async (req, res, next) => {
  if (await can(req.user, "departments:manage")) return next();
  return authorize("super-admin")(req, res, next);
};

// ==========================================
// DEPARTMENT MANAGEMENT
// Part of the access-management rework (2026-07-03) — see
// docs/superpowers/specs/2026-07-03-access-management-design.md
//
// Mutations (create/update/delete) are Super-Admin only, matching the
// design decision that super-admin owns access management. Reads are open
// to any authenticated user because department dropdowns are needed on
// ordinary forms (e.g. employee creation), the same way GET /api/positions
// works today.
// ==========================================

// Get all departments
router.get("/", protect, async (req, res) => {
  try {
    const { status } = req.query;

    const query = {};
    if (status) query.status = status;

    const departments = await Department.find(query)
      .sort({ name: 1 })
      .populate("createdBy", "name email");

    res.json(departments);
  } catch (err) {
    console.error("Error fetching departments:", err);
    res.status(500).json({ error: "Server Error" });
  }
});

// Get department statistics (member + position counts per department)
router.get("/stats", protect, requireDeptManage, async (req, res) => {
  try {
    const departments = await Department.find().lean();

    const stats = await Promise.all(
      departments.map(async (dept) => {
        const [positionCount, memberCount] = await Promise.all([
          Position.countDocuments({ departmentRef: dept._id }),
          User.countDocuments({ departmentRef: dept._id, status: "active" }),
        ]);
        return {
          departmentId: dept._id,
          name: dept.name,
          code: dept.code,
          status: dept.status,
          positionCount,
          memberCount,
        };
      })
    );

    res.json({
      totalDepartments: departments.length,
      activeDepartments: departments.filter((d) => d.status === "active").length,
      departments: stats,
    });
  } catch (err) {
    console.error("Error fetching department stats:", err);
    res.status(500).json({ error: "Server Error" });
  }
});

// Create new department
router.post("/", protect, requireDeptManage, async (req, res) => {
  try {
    const { name, code, description, legacyEnumValue } = req.body;

    if (!name || !name.trim()) {
      return res.status(400).json({ error: "Department name is required" });
    }
    if (!code || !code.trim()) {
      return res.status(400).json({ error: "Department code is required" });
    }

    const normalizedCode = code.trim().toLowerCase();

    const existing = await Department.findOne({
      $or: [
        { name: { $regex: new RegExp(`^${name.trim()}$`, "i") } },
        { code: normalizedCode },
      ],
    });
    if (existing) {
      return res.status(400).json({ error: "A department with this name or code already exists" });
    }

    const department = new Department({
      name: name.trim(),
      code: normalizedCode,
      description: description || "",
      legacyEnumValue: legacyEnumValue || "",
      createdBy: req.user._id,
    });

    await department.save();
    res.status(201).json(department);
  } catch (err) {
    console.error("Error creating department:", err);
    res.status(500).json({ error: "Server Error", message: err.message });
  }
});

// Update (rename/describe/activate/deactivate) a department
router.put("/:id", protect, requireDeptManage, async (req, res) => {
  try {
    const { name, code, description, status } = req.body;

    const department = await Department.findById(req.params.id);
    if (!department) {
      return res.status(404).json({ error: "Department not found" });
    }

    if (name && name.trim() !== department.name) {
      const existing = await Department.findOne({
        name: { $regex: new RegExp(`^${name.trim()}$`, "i") },
        _id: { $ne: req.params.id },
      });
      if (existing) {
        return res.status(400).json({ error: "A department with this name already exists" });
      }
      department.name = name.trim();
    }

    if (code && code.trim().toLowerCase() !== department.code) {
      const normalizedCode = code.trim().toLowerCase();
      const existing = await Department.findOne({
        code: normalizedCode,
        _id: { $ne: req.params.id },
      });
      if (existing) {
        return res.status(400).json({ error: "A department with this code already exists" });
      }
      department.code = normalizedCode;
    }

    if (description !== undefined) department.description = description;
    if (status) department.status = status;

    await department.save();
    res.json(department);
  } catch (err) {
    console.error("Error updating department:", err);
    res.status(500).json({ error: "Server Error", message: err.message });
  }
});

// Delete (or soft-delete) a department — blocked if positions or users still reference it
router.delete("/:id", protect, requireDeptManage, async (req, res) => {
  try {
    const department = await Department.findById(req.params.id);
    if (!department) {
      return res.status(404).json({ error: "Department not found" });
    }

    const [positionCount, memberCount] = await Promise.all([
      Position.countDocuments({ departmentRef: department._id }),
      User.countDocuments({ departmentRef: department._id }),
    ]);

    if (positionCount > 0 || memberCount > 0) {
      return res.status(400).json({
        error: `Cannot delete department. ${positionCount} position(s) and ${memberCount} user(s) still reference it. Reassign them first, or deactivate the department instead of deleting it.`,
        positionCount,
        memberCount,
      });
    }

    await Department.findByIdAndDelete(req.params.id);
    res.json({ message: "Department deleted successfully" });
  } catch (err) {
    console.error("Error deleting department:", err);
    res.status(500).json({ error: "Server Error" });
  }
});

module.exports = router;
