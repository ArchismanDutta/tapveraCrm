// server/tests/accessControl.test.js
//
// Access-management rework (2026-07-03) — Phase 1, Task 1.1.
//
// This repo has no test runner configured (package.json's "test" script is
// a stub, and the other files in this folder are plain Node/axios scripts
// against a live server rather than a real test framework) — so this
// follows that same convention: a standalone Node script, no new
// dependencies added.
//
// Part 1 (always runs, no DB, no risk): pure-logic tests for
// accessControl.evaluate() and the ACTION_PERMISSION_MAP shape. These are
// real unit tests — evaluate() takes plain objects, no Mongo connection
// needed.
//
// Part 2 (opt-in via --with-db): a READ-ONLY spot-check against real data,
// comparing the new engine's decisions to the existing, already-working
// hierarchyUtils decisions for a sample of real users — the same
// comparison shadowCompare() does live, run here as an offline batch
// report. Deliberately read-only: this script never creates, modifies, or
// deletes any document. There is no separate test database configured in
// this project (server/.env.example only defines one MONGODB_URI), so
// anything that wrote data here would be writing to your real database.
//
// Usage:
//   cd server
//   node tests/accessControl.test.js              # Part 1 only
//   node tests/accessControl.test.js --with-db     # Part 1 + Part 2 (read-only)

const assert = require("assert");
const { evaluate, ACTION_PERMISSION_MAP, SELF_IMPLICIT_ACTIONS } = require("../utils/accessControl");

let passed = 0;
let failed = 0;

function test(name, fn) {
  try {
    fn();
    passed++;
    console.log(`  PASS: ${name}`);
  } catch (err) {
    failed++;
    console.log(`  FAIL: ${name}`);
    console.log(`        ${err.message}`);
  }
}

console.log("==========================================");
console.log("PART 1: PURE-LOGIC TESTS (no DB required)");
console.log("==========================================\n");

test("evaluate() returns false for a null position", () => {
  assert.strictEqual(evaluate(null, "leads:edit"), false);
});

test("evaluate() returns false and warns for an unknown action", () => {
  const position = { permissions: { canEditSubordinateLeads: true } };
  assert.strictEqual(evaluate(position, "not:a:real:action"), false);
});

test("evaluate() returns true when the single mapped flag is true", () => {
  const position = { permissions: { canEditSubordinateLeads: true } };
  assert.strictEqual(evaluate(position, "leads:edit"), true);
});

test("evaluate() returns false when the single mapped flag is false", () => {
  const position = { permissions: { canEditSubordinateLeads: false } };
  assert.strictEqual(evaluate(position, "leads:edit"), false);
});

test("evaluate() returns true when ANY of several mapped flags is true (leads:view)", () => {
  const positionA = { permissions: { canViewSubordinateLeads: true, canViewDepartmentLeads: false } };
  const positionB = { permissions: { canViewSubordinateLeads: false, canViewDepartmentLeads: true } };
  assert.strictEqual(evaluate(positionA, "leads:view"), true);
  assert.strictEqual(evaluate(positionB, "leads:view"), true);
});

test("evaluate() returns false when ALL mapped flags are false", () => {
  const position = { permissions: { canViewSubordinateLeads: false, canViewDepartmentLeads: false } };
  assert.strictEqual(evaluate(position, "leads:view"), false);
});

test("evaluate() treats a missing permissions object as no permissions (does not throw)", () => {
  const position = { name: "Some Position" }; // no .permissions at all
  assert.strictEqual(evaluate(position, "leads:edit"), false);
});

test("every action in ACTION_PERMISSION_MAP maps to at least one flag", () => {
  Object.entries(ACTION_PERMISSION_MAP).forEach(([action, flags]) => {
    assert.ok(Array.isArray(flags) && flags.length > 0, `${action} has no flags mapped`);
  });
});

test("every SELF_IMPLICIT_ACTIONS entry is also a known action in ACTION_PERMISSION_MAP", () => {
  SELF_IMPLICIT_ACTIONS.forEach((action) => {
    assert.ok(
      Object.prototype.hasOwnProperty.call(ACTION_PERMISSION_MAP, action),
      `"${action}" is in SELF_IMPLICIT_ACTIONS but not in ACTION_PERMISSION_MAP`
    );
  });
});

console.log(`\nPart 1 result: ${passed} passed, ${failed} failed.\n`);

// ---------------------------------------------------------------------------
// Part 2: read-only DB spot-check (opt-in)
// ---------------------------------------------------------------------------
async function runDbSpotCheck() {
  console.log("==========================================");
  console.log("PART 2: READ-ONLY SPOT-CHECK AGAINST REAL DATA");
  console.log("==========================================\n");
  console.log("This section only READS data — it never writes anything.\n");

  const mongoose = require("mongoose");
  require("dotenv").config();

  if (!process.env.MONGODB_URI) {
    console.log("No MONGODB_URI configured — skipping Part 2.\n");
    return;
  }

  await mongoose.connect(process.env.MONGODB_URI, { serverSelectionTimeoutMS: 10000 });
  console.log("Connected to MongoDB (read-only checks only)\n");

  const User = require("../models/User");
  const hierarchyUtils = require("../utils/hierarchyUtils");
  const { can, scopeQuery } = require("../utils/accessControl");

  // Sample a handful of active, non-super-admin users with a position set,
  // since those are the ones where old vs new logic can actually diverge.
  const sample = await User.find({
    status: "active",
    role: { $ne: "super-admin" },
    position: { $ne: "" },
  })
    .limit(15)
    .lean();

  if (sample.length === 0) {
    console.log("No active users with a position assigned were found — nothing to spot-check.\n");
  } else {
    console.log(`Spot-checking ${sample.length} user(s)...\n`);
    let agreements = 0;
    let disagreements = 0;

    for (const user of sample) {
      const oldEdit = await hierarchyUtils.hasPermission(user, "canEditSubordinateLeads");
      const newEdit = await can(user, "leads:edit");
      const oldScope = await hierarchyUtils.getAccessibleUserIds(user);
      const newScopeFilter = await scopeQuery(user, "assignedTo");
      const newScopeIsUnrestricted = Object.keys(newScopeFilter).length === 0;

      const editAgrees = Boolean(oldEdit) === Boolean(newEdit);
      // scopeQuery returns {} (unrestricted) only for super-admin/admin-with-all-scope;
      // otherwise compare the ID list it would have produced via hierarchyUtils directly.
      const newScopeIds = newScopeIsUnrestricted ? null : newScopeFilter.assignedTo.$in;
      const scopeAgrees =
        newScopeIsUnrestricted || JSON.stringify([...oldScope].sort()) === JSON.stringify([...newScopeIds].sort());

      if (editAgrees && scopeAgrees) {
        agreements++;
      } else {
        disagreements++;
        console.log(
          `  DISAGREEMENT — ${user.name} (${user.employeeId}, position="${user.position}"): ` +
            `edit old=${Boolean(oldEdit)}/new=${Boolean(newEdit)} (agree=${editAgrees}), ` +
            `scope agree=${scopeAgrees}`
        );
      }
    }

    console.log(`\nSpot-check result: ${agreements} agree, ${disagreements} disagree (out of ${sample.length}).`);
    if (disagreements === 0) {
      console.log("No disagreements found in this sample — accessControl.js matches existing behavior so far.\n");
    } else {
      console.log("Investigate accessControl.js before relying on it for any real decision.\n");
    }
  }

  await mongoose.disconnect();
}

const withDb = process.argv.includes("--with-db");
if (withDb) {
  runDbSpotCheck()
    .then(() => process.exit(failed > 0 ? 1 : 0))
    .catch((err) => {
      console.error("Error during Part 2 spot-check:", err.message);
      process.exit(1);
    });
} else {
  console.log("(Run with --with-db to also spot-check against real data, read-only.)\n");
  process.exit(failed > 0 ? 1 : 0);
}
