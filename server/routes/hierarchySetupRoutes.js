// server/routes/hierarchySetupRoutes.js
//
// Role & Department Hierarchy Revamp v2 (2026-07-27) — Phase 3.
// See docs/superpowers/specs/2026-07-27-role-hierarchy-revamp-design.md
//      docs/superpowers/plans/2026-07-27-role-hierarchy-revamp-plan.md
//
// Super-Admin-only API that puts server/scripts/updateDepartmentsV2.js,
// seedRoleHierarchyV2.js, and migrateToRoleHierarchyV2.js behind the app's
// own authenticated HTTP layer, so applying the v2 hierarchy is a button
// click on the Access Management page's "Hierarchy Setup" tab instead of a
// terminal command — nothing in this file (or the scripts it calls) ever
// runs outside of a request made by a logged-in Super Admin's own browser.
//
// All three underlying operations remain exactly what they were as scripts:
//   - additive / idempotent (safe to click "Apply" more than once)
//   - upsert-based, never delete-then-recreate
//   - the migration report is strictly read-only and never assigns anyone
//
// Actually reassigning an individual employee to a suggested position still
// goes through the EXISTING PATCH /api/positions/users/:userId/assign
// endpoint (unchanged by this file) — this route only seeds the v2
// department/position scaffolding and reports on who needs a look, one
// person at a time, per the design doc's "report, don't guess" rule.

const express = require("express");
const Department = require("../models/Department");
const Position = require("../models/Position");
const User = require("../models/User");
const { protect, authorize } = require("../middlewares/authMiddleware");
const { resolvePosition } = require("../utils/accessControl");
const { applyDepartmentRenames, RENAMES } = require("../scripts/updateDepartmentsV2");
const { seedRoleHierarchyV2, REQUIRED_DEPARTMENT_CODES, V2_POSITION_NAMES } = require("../scripts/seedRoleHierarchyV2");
const { generateMigrationReport, OLD_TO_NEW } = require("../scripts/migrateToRoleHierarchyV2");

const router = express.Router();

// ==========================================
// GET /api/hierarchy-setup/status
// Cheap read-only snapshot for the "Hierarchy Setup" tab's status cards.
// ==========================================
router.get("/status", protect, authorize("super-admin"), async (req, res) => {
  try {
    const departments = await Department.find().select("code name").lean();
    const deptCodes = new Set(departments.map((d) => d.code));
    const missingDepartmentCodes = REQUIRED_DEPARTMENT_CODES.filter((code) => !deptCodes.has(code));

    const positions = await Position.find({ name: { $in: V2_POSITION_NAMES }, status: "active" })
      .select("name")
      .lean();
    const positionNamesPresent = new Set(positions.map((p) => p.name));
    const missingPositionNames = V2_POSITION_NAMES.filter((name) => !positionNamesPresent.has(name));

    // Cheap count, not the full report: resolve each active user's position
    // and check membership in OLD_TO_NEW's keys, without building the whole
    // report object or touching the filesystem.
    const users = await User.find({ status: "active" });
    let usersOnOldPositions = 0;
    let usersUnresolved = 0;
    for (const user of users) {
      const position = await resolvePosition(user);
      if (!position) {
        usersUnresolved += 1;
      } else if (OLD_TO_NEW[position.name]) {
        usersOnOldPositions += 1;
      }
    }

    res.json({
      departmentsApplied: missingDepartmentCodes.length === 0,
      missingDepartmentCodes,
      renames: RENAMES.map((r) => ({
        oldCode: r.oldCode,
        newCode: r.newCode,
        newName: r.newName,
        applied: deptCodes.has(r.newCode),
      })),
      positionsApplied: missingPositionNames.length === 0,
      missingPositionNames,
      totalActiveUsers: users.length,
      usersOnOldPositions,
      usersUnresolved,
    });
  } catch (err) {
    console.error("Error building hierarchy setup status:", err);
    res.status(500).json({ error: "Server Error", message: err.message });
  }
});

// ==========================================
// POST /api/hierarchy-setup/apply
// Body (optional): { steps: ["departments", "positions"] } — defaults to
// both. Idempotent: safe to call repeatedly (upsert-based underneath).
// ==========================================
router.post("/apply", protect, authorize("super-admin"), async (req, res) => {
  const requestedSteps = Array.isArray(req.body?.steps) && req.body.steps.length > 0
    ? req.body.steps
    : ["departments", "positions"];

  const log = [];
  const collect = (line) => {
    if (line) log.push(String(line));
  };

  try {
    let departmentRenames = null;
    let positionsSeeded = null;

    if (requestedSteps.includes("departments")) {
      departmentRenames = await applyDepartmentRenames({ log: collect });
    }

    if (requestedSteps.includes("positions")) {
      positionsSeeded = await seedRoleHierarchyV2({ log: collect });
    }

    res.json({
      message: "Hierarchy setup step(s) applied.",
      stepsApplied: requestedSteps,
      departmentRenames,
      positionsSeeded: positionsSeeded
        ? positionsSeeded.map((p) => ({ _id: p._id, name: p.name, level: p.level, dataScope: p.hierarchicalAccess?.dataScope }))
        : null,
      log,
    });
  } catch (err) {
    if (err.code === "MISSING_DEPARTMENTS") {
      return res.status(400).json({
        error: "Departments not ready",
        message: err.message,
        missing: err.missing,
        log,
      });
    }
    console.error("Error applying hierarchy setup:", err);
    res.status(500).json({ error: "Server Error", message: err.message, log });
  }
});

// ==========================================
// GET /api/hierarchy-setup/migration-report
// Read-only. Optional ?persist=true also writes the JSON snapshot to
// server/scripts/migration-reports/ (same file the CLI script produces),
// for anyone who wants an audit-trail copy on disk.
// ==========================================
router.get("/migration-report", protect, authorize("super-admin"), async (req, res) => {
  const log = [];
  const collect = (line) => {
    if (line) log.push(String(line));
  };

  try {
    const { report, reportPath } = await generateMigrationReport({
      log: collect,
      writeFile: req.query.persist === "true",
    });

    // Resolve each suggestion's target Position _id so the UI can call the
    // existing PATCH /api/positions/users/:userId/assign directly, without
    // re-deriving an id from a name on the client.
    const suggestedNames = [...new Set(report.onOldPosition.map((r) => r.suggestedPosition).filter(Boolean))];
    const suggestedPositions = await Position.find({ name: { $in: suggestedNames }, status: "active" })
      .select("name level")
      .lean();
    const positionByName = new Map(suggestedPositions.map((p) => [p.name, p]));

    const onOldPosition = report.onOldPosition.map((row) => {
      const target = row.suggestedPosition ? positionByName.get(row.suggestedPosition) : null;
      return {
        ...row,
        suggestedPositionId: target ? target._id : null,
        suggestedPositionLevel: target ? target.level : null,
      };
    });

    res.json({
      ...report,
      onOldPosition,
      reportPath,
      log,
    });
  } catch (err) {
    console.error("Error generating migration report:", err);
    res.status(500).json({ error: "Server Error", message: err.message, log });
  }
});

module.exports = router;
