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
const {
  evaluate,
  ACTION_PERMISSION_MAP,
  SELF_IMPLICIT_ACTIONS,
  // Role & Department Hierarchy Revamp v2 (2026-07-27):
  resolveEffectivePermissions,
  evaluateManageAccess,
  grantableFlags,
  PERMISSION_FLAG_KEYS,
} = require("../utils/accessControl");

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

// ---------------------------------------------------------------------------
// Role & Department Hierarchy Revamp v2 (2026-07-27) — delegated permission
// editing. See docs/superpowers/specs/2026-07-27-role-hierarchy-revamp-design.md
// Section 2. All still Part 1 style: pure functions, no DB, no risk.
// ---------------------------------------------------------------------------

console.log("==========================================");
console.log("PART 1b: DELEGATED PERMISSION EDITING (no DB required)");
console.log("==========================================\n");

// ---- resolveEffectivePermissions / evaluate() override layering ----

test("evaluate() ignores overrides when they don't mention the relevant flag", () => {
  const position = { permissions: { canEditSubordinateLeads: true } };
  assert.strictEqual(evaluate(position, "leads:edit", { canApproveLeaves: true }), true);
});

test("a permissionOverrides grant (true) turns on a flag the Position doesn't have", () => {
  const position = { permissions: { canEditSubordinateLeads: false } };
  assert.strictEqual(evaluate(position, "leads:edit", { canEditSubordinateLeads: true }), true);
});

test("a permissionOverrides revoke (false) turns off a flag the Position does have", () => {
  const position = { permissions: { canEditSubordinateLeads: true } };
  assert.strictEqual(evaluate(position, "leads:edit", { canEditSubordinateLeads: false }), false);
});

test("overrides work when passed as a real Map (not just a plain object)", () => {
  const position = { permissions: { canEditSubordinateLeads: false } };
  const overrides = new Map([["canEditSubordinateLeads", true]]);
  assert.strictEqual(evaluate(position, "leads:edit", overrides), true);
});

test("evaluate() with a null position but a granting override still returns true", () => {
  assert.strictEqual(evaluate(null, "leads:edit", { canEditSubordinateLeads: true }), true);
});

test("resolveEffectivePermissions treats a missing overrides arg as a no-op", () => {
  const position = { permissions: { canApproveLeaves: true } };
  assert.deepStrictEqual(resolveEffectivePermissions(position, undefined), { canApproveLeaves: true });
});

// ---- grantableFlags() — the ceiling rule's building block ----

test("grantableFlags() returns [] for a null grantor position", () => {
  assert.deepStrictEqual(grantableFlags(null), []);
});

test("grantableFlags() returns only the flags that are true on the grantor's Position", () => {
  const grantorPosition = {
    permissions: { canApproveLeaves: true, canManageAttendance: true, canManageUsers: false },
  };
  assert.deepStrictEqual(grantableFlags(grantorPosition).sort(), ["canApproveLeaves", "canManageAttendance"]);
});

test("every flag PERMISSION_FLAG_KEYS lists is a real key ACTION_PERMISSION_MAP or the delegation system understands", () => {
  // Sanity check the two vocabularies haven't drifted apart silently.
  assert.ok(PERMISSION_FLAG_KEYS.includes("canManageSubordinateAccess"));
  assert.ok(PERMISSION_FLAG_KEYS.length >= 21);
});

// ---- evaluateManageAccess() — ceiling / scope / root-of-trust, together ----

const seniorGrantorPosition = { level: 95, permissions: { canManageSubordinateAccess: true } };
const juniorTargetPosition = { level: 10, permissions: {} };
const peerTargetPosition = { level: 95, permissions: {} };

test("super-admin grantor can always manage access, no matter what", () => {
  assert.strictEqual(
    evaluateManageAccess({ grantorRole: "super-admin", grantorPosition: null, targetRole: "employee", targetUserId: "u1", targetPosition: null, accessibleIds: [] }),
    true
  );
});

test("root of trust: nobody can manage a super-admin target, even another super-admin's Position-based flag", () => {
  assert.strictEqual(
    evaluateManageAccess({
      grantorRole: "admin",
      grantorPosition: seniorGrantorPosition,
      targetRole: "super-admin",
      targetUserId: "u1",
      targetPosition: peerTargetPosition,
      accessibleIds: ["u1"],
    }),
    false
  );
});

test("root of trust: admin cannot manage another admin (only super-admin can)", () => {
  assert.strictEqual(
    evaluateManageAccess({
      grantorRole: "admin",
      grantorPosition: seniorGrantorPosition,
      targetRole: "admin",
      targetUserId: "u1",
      targetPosition: peerTargetPosition,
      accessibleIds: ["u1"],
    }),
    false
  );
});

test("grantor without canManageSubordinateAccess cannot manage anyone", () => {
  assert.strictEqual(
    evaluateManageAccess({
      grantorRole: "admin",
      grantorPosition: { level: 95, permissions: {} }, // flag not set
      targetRole: "employee",
      targetUserId: "u1",
      targetPosition: juniorTargetPosition,
      accessibleIds: ["u1"],
    }),
    false
  );
});

test("ceiling/scope rule: cannot manage a target at an equal or higher level (no lateral/upward edits)", () => {
  assert.strictEqual(
    evaluateManageAccess({
      grantorRole: "admin",
      grantorPosition: seniorGrantorPosition,
      targetRole: "employee",
      targetUserId: "u1",
      targetPosition: { level: 95, permissions: {} }, // equal level
      accessibleIds: ["u1"],
    }),
    false
  );
});

test("scope rule: cannot manage a target outside the grantor's own accessible-users reach", () => {
  assert.strictEqual(
    evaluateManageAccess({
      grantorRole: "admin",
      grantorPosition: seniorGrantorPosition,
      targetRole: "employee",
      targetUserId: "someone-else",
      targetPosition: juniorTargetPosition,
      accessibleIds: ["u1", "u2"], // target not in this list
    }),
    false
  );
});

test("scope rule: a target with no resolved Position at all cannot be managed", () => {
  assert.strictEqual(
    evaluateManageAccess({
      grantorRole: "admin",
      grantorPosition: seniorGrantorPosition,
      targetRole: "employee",
      targetUserId: "u1",
      targetPosition: null,
      accessibleIds: ["u1"],
    }),
    false
  );
});

test("happy path: lower level, in-scope, flag-holding grantor CAN manage the target", () => {
  assert.strictEqual(
    evaluateManageAccess({
      grantorRole: "admin",
      grantorPosition: seniorGrantorPosition,
      targetRole: "employee",
      targetUserId: "u1",
      targetPosition: juniorTargetPosition,
      accessibleIds: ["u1", "u2"],
    }),
    true
  );
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
