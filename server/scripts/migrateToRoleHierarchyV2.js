// server/scripts/migrateToRoleHierarchyV2.js
//
// Role & Department Hierarchy Revamp v2 (2026-07-27) — Phase 3, Task 3.1.
// See docs/superpowers/specs/2026-07-27-role-hierarchy-revamp-design.md
//      docs/superpowers/plans/2026-07-27-role-hierarchy-revamp-plan.md
//
// STRICTLY READ-ONLY. Unlike migrateToPositionRefs.js (which links refs and
// writes by default, with an opt-in --dry-run), this script NEVER writes
// anything, ever — there is no live mode. It only reports.
//
// For every active User currently resolved (via accessControl.resolvePosition
// — positionRef first, legacy position-string match as fallback) onto one of
// the OLD tech/marketingAndSales-flavored positions from
// server/scripts/seedCanonicalHierarchy.js, this proposes a best-guess
// mapping to a Phase 0 (server/scripts/seedRoleHierarchyV2.js) position and
// writes a report. Reassignment itself happens deliberately, one person at a
// time, via the Access Management page's "Assign Employees" tab (or Admin's
// own "My Team's Access" page) — never by this script.
//
// Some old positions have NO direct new equivalent (the whole point of this
// revamp is that Development/Sales/HR no longer share an identical template
// — see the design doc's Section 1). Those are flagged "uncertain" with a
// reasoned suggestion, not a confident answer — a human should decide.
//
// Requires scripts/seedRoleHierarchyV2.js to have been run first (so the
// suggested target positions actually exist).
//
// ---------------------------------------------------------------------------
// Two ways to run this:
//
// 1. CLI (still works exactly as before):
//      cd server
//      node scripts/migrateToRoleHierarchyV2.js
//
// 2. From the running app, in-process, via the Hierarchy Setup tab on the
//    Access Management page (see server/routes/hierarchySetupRoutes.js) —
//    used to render the same report as a table in the browser instead of a
//    JSON file. The core logic is exported as generateMigrationReport()
//    below so there is exactly one implementation behind both entry points.
// ---------------------------------------------------------------------------

const mongoose = require("mongoose");
const fs = require("fs");
const path = require("path");

const User = require("../models/User");
const Position = require("../models/Position");
const { resolvePosition } = require("../utils/accessControl");

// Old name -> { suggestion, confidence, reason }. Old names are exactly what
// seedCanonicalHierarchy.js produced when it ran against the PRE-rename
// Department rows ("Tech" / "Marketing & Sales" — see
// scripts/updateDepartmentsV2.js), so these are matched by literal string
// regardless of whether that rename has since happened.
const OLD_TO_NEW = {
  "Admin": {
    suggestion: null,
    confidence: "no-action-needed",
    reason:
      'seedRoleHierarchyV2.js upserts onto the SAME "Admin" document by name — anyone already on it needs no reassignment; they picked up canManageSubordinateAccess automatically.',
  },
  "HR": {
    suggestion: "Senior HR",
    confidence: "best-guess",
    reason: 'Old "HR" was a single org-wide HR tier. Closest equivalent in the new 3-tier HR ladder is the top, "Senior HR" — but confirm seniority is actually warranted per person.',
  },
  "Project Manager — Tech": {
    suggestion: "Team Lead — Development",
    confidence: "uncertain",
    reason: 'Development has NO Project Manager tier in the new hierarchy (PM now lives only in Sales — see design doc Section 1). Closest surviving role is Team Lead — Development, but this person may actually belong in Sales as a PM instead. Needs a human decision, not a default.',
  },
  "Supervisor — Tech": {
    suggestion: "Supervisor — Development",
    confidence: "direct",
    reason: "Same tier, department renamed only.",
  },
  "Team Lead — Tech": {
    suggestion: "Team Lead — Development",
    confidence: "direct",
    reason: "Same tier, department renamed only.",
  },
  "Agent — Tech": {
    suggestion: "Employee — Development",
    confidence: "best-guess",
    reason: '"Agent" was the old generic front-line title. Development\'s front-line title is now "Employee" (with free-text specialization) — confirm this person isn\'t actually meant to be an Intern.',
  },
  "Project Manager — Marketing & Sales": {
    suggestion: "Project Manager — Sales",
    confidence: "direct",
    reason: "Same tier, department renamed only.",
  },
  "Supervisor — Marketing & Sales": {
    suggestion: "Supervisor — Sales",
    confidence: "direct",
    reason: "Same tier, department renamed only.",
  },
  "Team Lead — Marketing & Sales": {
    suggestion: "Supervisor — Sales",
    confidence: "uncertain",
    reason: 'Sales has NO Team Lead tier in the new hierarchy (PM -> Supervisor -> Agent only — see design doc Section 1). Closest surviving tier below PM is Supervisor, but confirm this person shouldn\'t instead become the Project Manager or an Agent.',
  },
  "Agent — Marketing & Sales": {
    suggestion: "Agent — Sales",
    confidence: "direct",
    reason: "Same tier, department renamed only.",
  },
};

/**
 * Core logic, reusable from either the CLI wrapper below or an Express route
 * handler that's already connected to MongoDB. Never writes to any
 * collection — read-only by construction (no .save()/.updateOne() calls on
 * User or Position anywhere in this function).
 *
 * `writeFile` (default true) controls whether a JSON snapshot is also
 * written to server/scripts/migration-reports/ for an audit trail — the
 * Hierarchy Setup API route calls this with writeFile:false for a plain
 * "give me the current numbers" view, and true when the user explicitly
 * wants a saved snapshot.
 *
 * Returns { report, reportPath } — reportPath is null when writeFile:false.
 */
async function generateMigrationReport({ log = () => {}, writeFile = true } = {}) {
  log("==========================================");
  log("ROLE HIERARCHY V2 MIGRATION REPORT (read-only)");
  log("==========================================\n");

  const newPositionNames = new Set(
    (await Position.find({ status: "active" }).select("name").lean()).map((p) => p.name)
  );
  const missingTargets = [...new Set(Object.values(OLD_TO_NEW).map((v) => v.suggestion).filter(Boolean))].filter(
    (name) => !newPositionNames.has(name)
  );
  if (missingTargets.length > 0) {
    log(
      `WARNING: these suggested target positions don't exist yet — run scripts/seedRoleHierarchyV2.js first: ${missingTargets.join(", ")}\n`
    );
  }

  const users = await User.find({ status: "active" });

  const report = {
    generatedAt: new Date().toISOString(),
    readOnly: true,
    totalActiveUsers: users.length,
    onOldPosition: [],
    noPositionResolved: [],
    missingTargets,
  };

  for (const user of users) {
    const position = await resolvePosition(user);

    if (!position) {
      report.noPositionResolved.push({
        userId: user._id.toString(),
        employeeId: user.employeeId,
        name: user.name,
        rawDepartment: user.department,
        rawPosition: user.position,
      });
      continue;
    }

    const mapping = OLD_TO_NEW[position.name];
    if (!mapping) continue; // already on a v2 position, or some other custom position — nothing to report

    report.onOldPosition.push({
      userId: user._id.toString(),
      employeeId: user.employeeId,
      name: user.name,
      currentPosition: position.name,
      suggestedPosition: mapping.suggestion,
      confidence: mapping.confidence,
      reason: mapping.reason,
    });
  }

  let reportPath = null;
  if (writeFile) {
    const reportsDir = path.join(__dirname, "migration-reports");
    if (!fs.existsSync(reportsDir)) fs.mkdirSync(reportsDir, { recursive: true });
    reportPath = path.join(reportsDir, `role-hierarchy-v2-migration-report-${Date.now()}.json`);
    fs.writeFileSync(reportPath, JSON.stringify(report, null, 2));
  }

  log(`Total active users: ${report.totalActiveUsers}`);
  log(`On an old (pre-v2) position: ${report.onOldPosition.length}`);
  log(`No position resolved at all: ${report.noPositionResolved.length}\n`);

  if (report.onOldPosition.length > 0) {
    log("Proposed reassignments (confirm each one via Assign Employees — nothing here was written):\n");
    const byConfidence = { "no-action-needed": [], direct: [], "best-guess": [], uncertain: [] };
    report.onOldPosition.forEach((r) => byConfidence[r.confidence]?.push(r));

    for (const level of ["no-action-needed", "direct", "best-guess", "uncertain"]) {
      const rows = byConfidence[level];
      if (rows.length === 0) continue;
      log(`  [${level}] (${rows.length}):`);
      rows.forEach((r) => {
        log(
          `    - ${r.name} (${r.employeeId}): "${r.currentPosition}" -> ${r.suggestedPosition ? `"${r.suggestedPosition}"` : "(no change needed)"}`
        );
      });
      log("");
    }
  }

  if (report.noPositionResolved.length > 0) {
    log(`Users with no resolved position at all (${report.noPositionResolved.length}) — sample:`);
    report.noPositionResolved.slice(0, 10).forEach((u) => {
      log(`    - ${u.name} (${u.employeeId}): department="${u.rawDepartment || ""}", position="${u.rawPosition || ""}"`);
    });
    log("");
  }

  if (reportPath) log(`Full report written to: ${reportPath}`);
  log("\nNothing was changed. Next: work through this report via the Access Management");
  log('page\'s "Assign Employees" tab (or Admin\'s "My Team\'s Access" page), department by');
  log("department — especially the [uncertain] rows, which need a real decision, not a default.\n");

  return { report, reportPath };
}

// ---------------------------------------------------------------------------
// CLI wrapper — only runs when this file is executed directly
// (`node scripts/migrateToRoleHierarchyV2.js`), not when required by a route.
// ---------------------------------------------------------------------------
async function runCli() {
  require("dotenv").config();
  await mongoose.connect(process.env.MONGODB_URI, { serverSelectionTimeoutMS: 10000 });
  console.log("Connected to MongoDB (read-only — this script never writes anything)\n");

  await generateMigrationReport({ log: console.log, writeFile: true });

  await mongoose.disconnect();
  process.exit(0);
}

module.exports = { generateMigrationReport, OLD_TO_NEW };

if (require.main === module) {
  runCli().catch((err) => {
    console.error("Error generating migration report:", err);
    process.exit(1);
  });
}
