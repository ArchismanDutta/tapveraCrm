// server/scripts/migrateToPositionRefs.js
//
// Access-management rework (2026-07-03) — Phase 0, Task 0.5.
// See docs/superpowers/plans/2026-07-03-access-management-rework.md
//
// This is the systematic replacement for the kind of hand-run, single-user
// patch that server/fix-supervisor-position.js had to do after the fact.
// Instead of silently guessing or defaulting a user/position that doesn't
// cleanly match, this script REPORTS every unresolved case so it can be
// fixed deliberately (via the new Assign Employees UI, once built) instead
// of quietly breaking someone's access the way the Azad/Rahul incident did.
//
// What it does:
//   1. Resolves Position.department (legacy enum) -> Position.departmentRef
//   2. Resolves User.department (legacy enum) -> User.departmentRef
//   3. Resolves User.position (legacy free-text, must match a Position.name)
//      -> User.positionRef
//   4. Leaves ALL legacy string fields untouched — purely additive.
//   5. Never overwrites a ref that's already set (safe to re-run).
//   6. Writes a JSON report of every unresolved user/position instead of
//      guessing, plus a console summary.
//
// Requires: Department docs to already exist (run seedDepartments.js first).
//
// IMPORTANT: this has NOT been run against any environment yet. Run against
// a staging copy of the database first, review the report with Sahil, only
// then consider running against production — per the design doc's migration
// strategy (shadow-mode / report-first, never silent).
//
// Usage:
//   cd server
//   node scripts/migrateToPositionRefs.js            # writes report + applies clean matches
//   node scripts/migrateToPositionRefs.js --dry-run   # report only, no writes

const mongoose = require("mongoose");
const fs = require("fs");
const path = require("path");
require("dotenv").config();

const User = require("../models/User");
const Position = require("../models/Position");
const Department = require("../models/Department");

const DRY_RUN = process.argv.includes("--dry-run");

async function migrate() {
  await mongoose.connect(process.env.MONGODB_URI, {
    serverSelectionTimeoutMS: 10000,
  });
  console.log("Connected to MongoDB");
  console.log(DRY_RUN ? "Mode: DRY RUN (no writes)\n" : "Mode: LIVE (will write resolved refs)\n");

  console.log("==========================================");
  console.log("MIGRATING TO POSITION/DEPARTMENT REFERENCES");
  console.log("==========================================\n");

  const departments = await Department.find().lean();
  if (departments.length === 0) {
    console.error("No Department documents found. Run seedDepartments.js first. Aborting.");
    process.exit(1);
  }
  const deptByLegacyValue = new Map(departments.map((d) => [d.legacyEnumValue, d]));

  const report = {
    generatedAt: new Date().toISOString(),
    dryRun: DRY_RUN,
    positions: { total: 0, resolved: 0, alreadyLinked: 0, unresolved: [] },
    users: { total: 0, departmentResolved: 0, positionResolved: 0, alreadyLinked: 0, unresolved: [] },
  };

  // ---------- 1. Positions: department (enum) -> departmentRef ----------
  const positions = await Position.find();
  report.positions.total = positions.length;

  for (const pos of positions) {
    if (pos.departmentRef) {
      report.positions.alreadyLinked++;
      continue;
    }

    const dept = deptByLegacyValue.get(pos.department);
    if (!dept) {
      report.positions.unresolved.push({
        positionId: pos._id.toString(),
        name: pos.name,
        rawDepartment: pos.department,
        reason: pos.department
          ? `No Department found with legacyEnumValue "${pos.department}"`
          : "Position has no department set (or is department-agnostic 'all')",
      });
      continue;
    }

    if (!DRY_RUN) {
      pos.departmentRef = dept._id;
      await pos.save();
    }
    report.positions.resolved++;
  }

  // ---------- 2. Users: department (enum) -> departmentRef, position (string) -> positionRef ----------
  const users = await User.find();
  report.users.total = users.length;

  // Build a case-insensitive lookup of active positions by name for resolving User.position
  const activePositions = await Position.find({ status: "active" }).lean();
  const positionByLowerName = new Map(activePositions.map((p) => [p.name.trim().toLowerCase(), p]));

  for (const user of users) {
    const userReport = {
      userId: user._id.toString(),
      employeeId: user.employeeId,
      name: user.name,
      rawDepartment: user.department,
      rawPosition: user.position,
      issues: [],
    };

    let touchedThisUser = false;

    // Department
    if (user.departmentRef) {
      report.users.alreadyLinked++;
    } else {
      const dept = deptByLegacyValue.get(user.department);
      if (dept) {
        if (!DRY_RUN) user.departmentRef = dept._id;
        report.users.departmentResolved++;
        touchedThisUser = true;
      } else {
        userReport.issues.push(
          user.department
            ? `department "${user.department}" does not match any Department.legacyEnumValue`
            : "no department set"
        );
      }
    }

    // Position (only meaningful if the user has a non-empty position string)
    if (user.position && user.position.trim()) {
      if (user.positionRef) {
        // already linked, nothing to do
      } else {
        const match = positionByLowerName.get(user.position.trim().toLowerCase());
        if (match) {
          if (!DRY_RUN) {
            user.positionRef = match._id;
            user.positionLevel = match.level; // keep the existing cache field trustworthy
          }
          report.users.positionResolved++;
          touchedThisUser = true;
        } else {
          userReport.issues.push(
            `position "${user.position}" does not exactly match any active Position.name (this is the exact failure mode that broke Azad/Rahul's hierarchy previously)`
          );
        }
      }
    }

    if (userReport.issues.length > 0) {
      report.users.unresolved.push(userReport);
    }

    if (touchedThisUser && !DRY_RUN) {
      await user.save();
    }
  }

  // ---------- Write report ----------
  const reportsDir = path.join(__dirname, "migration-reports");
  if (!fs.existsSync(reportsDir)) fs.mkdirSync(reportsDir, { recursive: true });
  const reportPath = path.join(
    reportsDir,
    `migration-report-${Date.now()}.json`
  );
  fs.writeFileSync(reportPath, JSON.stringify(report, null, 2));

  console.log("Positions:");
  console.log(`  Total: ${report.positions.total}`);
  console.log(`  Already linked: ${report.positions.alreadyLinked}`);
  console.log(`  Resolved this run: ${report.positions.resolved}`);
  console.log(`  Unresolved: ${report.positions.unresolved.length}`);

  console.log("\nUsers:");
  console.log(`  Total: ${report.users.total}`);
  console.log(`  Already linked: ${report.users.alreadyLinked}`);
  console.log(`  Department resolved this run: ${report.users.departmentResolved}`);
  console.log(`  Position resolved this run: ${report.users.positionResolved}`);
  console.log(`  Users with unresolved issues: ${report.users.unresolved.length}`);

  if (report.users.unresolved.length > 0) {
    console.log("\n  Sample unresolved users (see full report file for all):");
    report.users.unresolved.slice(0, 10).forEach((u) => {
      console.log(`   - ${u.name} (${u.employeeId}): ${u.issues.join("; ")}`);
    });
  }

  console.log(`\nFull report written to: ${reportPath}`);
  console.log(
    DRY_RUN
      ? "\nDry run complete — no data was changed."
      : "\nDone. Unresolved users/positions were left untouched (old fields still intact) — fix them deliberately via the Assign Employees UI once Phase 2 ships."
  );

  await mongoose.disconnect();
  process.exit(0);
}

migrate().catch((err) => {
  console.error("Error during migration:", err);
  process.exit(1);
});
