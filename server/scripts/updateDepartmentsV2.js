// server/scripts/updateDepartmentsV2.js
//
// Role & Department Hierarchy Revamp v2 (2026-07-27) — Phase 0, Task 0.1.
// See docs/superpowers/specs/2026-07-27-role-hierarchy-revamp-design.md
//      docs/superpowers/plans/2026-07-27-role-hierarchy-revamp-plan.md
//
// Renames two Department rows seeded by server/scripts/seedDepartments.js:
//   "Tech" (code: tech)                -> "Development" (code: development)
//   "Marketing & Sales" (code: marketingAndSales) -> "Sales" (code: sales)
//
// "Tech" -> "Development" actually REMOVES a naming mismatch: that row's
// legacyEnumValue was already "development" (the display name was the only
// thing out of step). "Marketing & Sales" -> "Sales" reflects that digital
// marketing is now a specialization under Development, not its own
// department-level name.
//
// "Executives" (code: executives) and "Human Resources" (code: humanResource)
// are left exactly as-is — see the design doc's Open Items #1: Tapvera
// confirmed leaving Executives dormant/untouched for this round.
//
// This script is idempotent and updates BY EXISTING CODE, preserving each
// Department's _id — so any Position.departmentRef / User.departmentRef
// pointer that already exists keeps working unchanged. It uses findOneAndUpdate
// (not delete+recreate), matching the additive discipline the 2026-07-03
// rework established.
//
// Safe to run whether or not seedDepartments.js's rows exist yet:
//   - If the OLD code ("tech" / "marketingAndSales") is found, it's renamed.
//   - If the NEW code ("development" / "sales") already exists (e.g. this
//     already ran, or someone set it up by hand), it's left alone and
//     reported as already-current — never a duplicate-key error.
//   - If NEITHER is found, seedDepartments.js probably hasn't been run in
//     this environment yet — reported clearly instead of silently no-op'ing.
//
// ---------------------------------------------------------------------------
// Two ways to run this:
//
// 1. CLI (still works exactly as before):
//      cd server
//      node scripts/updateDepartmentsV2.js
//
// 2. From the running app, in-process (added so Tapvera can apply this from
//    the Access Management page's "Hierarchy Setup" tab instead of a
//    terminal — see server/routes/hierarchySetupRoutes.js). The core logic
//    is exported as applyDepartmentRenames() below; the CLI behavior is just
//    a thin wrapper around it so there is exactly one implementation, not
//    two that can drift apart.
// ---------------------------------------------------------------------------

const mongoose = require("mongoose");

const Department = require("../models/Department");

const RENAMES = [
  {
    oldCode: "tech",
    newCode: "development",
    newName: "Development",
    newDescription: "Engineering, development, QA, and Development specializations (Digital Marketing, Content Writer, SEO Expert, and more).",
  },
  {
    oldCode: "marketingAndSales",
    newCode: "sales",
    newName: "Sales",
    newDescription: "Sales pipeline, client relationships, leads, and callbacks. (Digital marketing moved under Development's specializations.)",
  },
];

async function renameOne({ oldCode, newCode, newName, newDescription }) {
  const alreadyRenamed = await Department.findOne({ code: newCode });
  if (alreadyRenamed) {
    return { status: "already-applied", department: alreadyRenamed };
  }

  const existing = await Department.findOne({ code: oldCode });
  if (!existing) {
    return { status: "source-not-found" };
  }

  const previousName = existing.name;
  existing.name = newName;
  existing.code = newCode;
  existing.description = newDescription;
  // legacyEnumValue intentionally left untouched — it still bridges to the
  // unchanged User.department / Position.department string enum values
  // ("development" / "marketingAndSales") for backward compatibility.
  await existing.save();

  return { status: "renamed", previousName, department: existing };
}

/**
 * Core logic, reusable from either the CLI wrapper below or an Express route
 * handler that's already connected to MongoDB. `log`, if provided, receives
 * one human-readable line per rename attempt (defaults to a no-op so calling
 * this from an API route doesn't spam the server's stdout).
 *
 * Returns an array of { oldCode, newCode, status, department? , previousName? }
 * — status is one of "renamed" | "already-applied" | "source-not-found".
 */
async function applyDepartmentRenames({ log = () => {} } = {}) {
  const results = [];

  for (const rename of RENAMES) {
    const outcome = await renameOne(rename);
    results.push({ oldCode: rename.oldCode, newCode: rename.newCode, ...outcome });

    if (outcome.status === "renamed") {
      log(`- Renamed "${outcome.previousName}" (${rename.oldCode}) -> "${outcome.department.name}" (${outcome.department.code}), _id unchanged: ${outcome.department._id}`);
    } else if (outcome.status === "already-applied") {
      log(`- "${outcome.department.name}" (code: ${rename.newCode}) already present — nothing to do.`);
    } else {
      log(`- WARNING: no Department found with code "${rename.oldCode}" or "${rename.newCode}". Run server/scripts/seedDepartments.js first if this is a fresh environment. Skipping.`);
    }
  }

  return results;
}

// ---------------------------------------------------------------------------
// CLI wrapper — only runs when this file is executed directly
// (`node scripts/updateDepartmentsV2.js`), not when required by a route.
// ---------------------------------------------------------------------------
async function runCli() {
  require("dotenv").config();
  await mongoose.connect(process.env.MONGODB_URI, { serverSelectionTimeoutMS: 10000 });
  console.log("Connected to MongoDB\n");

  console.log("==========================================");
  console.log("RENAMING DEPARTMENTS (v2)");
  console.log("==========================================\n");

  await applyDepartmentRenames({ log: console.log });

  console.log("\nUnchanged: Executives (executives), Human Resources (humanResource).");
  console.log("Next: node scripts/seedRoleHierarchyV2.js\n");

  await mongoose.disconnect();
  process.exit(0);
}

module.exports = { applyDepartmentRenames, RENAMES };

if (require.main === module) {
  runCli().catch((err) => {
    console.error("Error renaming departments:", err);
    process.exit(1);
  });
}
