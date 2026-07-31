// server/scripts/seedRoleHierarchyV2.js
//
// Role & Department Hierarchy Revamp v2 (2026-07-27) — Phase 0, Task 0.3.
// See docs/superpowers/specs/2026-07-27-role-hierarchy-revamp-design.md
//      docs/superpowers/plans/2026-07-27-role-hierarchy-revamp-plan.md
//
// Upserts the 11 positions from the design doc's canonical hierarchy table.
// Each operational department now has the shape it actually has, instead of
// the identical PM->Supervisor->TL->Agent template
// server/scripts/seedCanonicalHierarchy.js stamped onto every delivery
// department:
//
//   Development:  Team Lead (65) -> Supervisor (40) -> Employee (15) -> Intern (5)
//   Sales:        Project Manager (70) -> Supervisor (40) -> Agent (10)
//   HR:           Senior HR (60) -> Junior HR (30) -> HR Intern (5)
//   Org-wide:     Admin (95)
//
// PM — Sales and Team Lead — Development are deliberately close in level
// (70/65) rather than one strictly above the other — they're lateral
// counterparts in different departments who hand off work to each other
// (PM retains overall project/client ownership; see design doc Section 3),
// not manager/subordinate.
//
// Numeric `level` is cosmetic (seniority/tie-break only, e.g. transfer
// escalation) — never automatic data access. Access is always the explicit
// `permissions.*` flags + `hierarchicalAccess.dataScope`, same rule the
// 2026-07-03 rework established.
//
// IMPORTANT — things this script deliberately does NOT do:
//   - It does not touch any User document. Assigning real employees to
//     these positions is Phase 3, via the Access Management page's "Assign
//     Employees" tab, informed by server/scripts/migrateToRoleHierarchyV2.js's
//     report — not this script.
//   - It does not delete or deactivate the old tech/marketingAndSales-flavored
//     positions from seedCanonicalHierarchy.js, even if that script already
//     ran. That's Phase 3, after confirming nothing real still points at them.
//   - Every position here is a REASONED STARTING POINT for its permission
//     set (matching the design doc's table), not a final decision — all of
//     it is editable afterward from the Access Management page.
//
// "Admin" is the one name this script shares with seedCanonicalHierarchy.js.
// That's intentional: if an "Admin" Position document already exists (e.g.
// seedCanonicalHierarchy.js already ran in this environment), this script
// upserts onto that SAME document by name — so any user already assigned to
// it inherits the new canManageSubordinateAccess capability without needing
// reassignment — rather than creating a second, differently-named Admin
// position. Every other field on an already-existing "Admin" document is
// left exactly as a Super Admin last configured it ($setOnInsert only); only
// `permissions.canManageSubordinateAccess` is force-set to true every run,
// because "Admin can delegate access" is the one new capability this whole
// revamp is about, and it must not depend on whether "Admin" happened to
// already exist. See the plan doc's Task 0.3 note and Phase 3's Task 3.3.
//
// Requires server/scripts/updateDepartmentsV2.js to have been run first
// (looks up departments by their NEW codes: development, sales, humanResource).
//
// ---------------------------------------------------------------------------
// Two ways to run this:
//
// 1. CLI (still works exactly as before):
//      cd server
//      node scripts/seedRoleHierarchyV2.js
//
// 2. From the running app, in-process, via the Hierarchy Setup tab on the
//    Access Management page (see server/routes/hierarchySetupRoutes.js).
//    The core logic is exported as seedRoleHierarchyV2() below so there is
//    exactly one implementation behind both entry points.
// ---------------------------------------------------------------------------

const mongoose = require("mongoose");

const Department = require("../models/Department");
const Position = require("../models/Position");

const REQUIRED_DEPARTMENT_CODES = ["development", "sales", "humanResource"];

// The 11 position names this script upserts — exported so callers (e.g.
// server/routes/hierarchySetupRoutes.js's GET /status) can cheaply check
// "has this already been applied?" without re-running the whole seed.
const V2_POSITION_NAMES = [
  "Admin",
  "Project Manager — Sales",
  "Supervisor — Sales",
  "Agent — Sales",
  "Team Lead — Development",
  "Supervisor — Development",
  "Employee — Development",
  "Intern — Development",
  "Senior HR",
  "Junior HR",
  "HR Intern",
];

// Mirrors seedCanonicalHierarchy.js's ALL_PERMISSIONS_FALSE, plus the one
// flag this revamp adds (server/models/Position.js).
const ALL_PERMISSIONS_FALSE = {
  canManageUsers: false,
  canManageClients: false,
  canManageProjects: false,
  canAssignTasks: false,
  canApproveLeaves: false,
  canApproveShifts: false,
  canViewReports: false,
  canManageAttendance: false,
  canViewSubordinateLeads: false,
  canViewSubordinateCallbacks: false,
  canViewSubordinateTasks: false,
  canViewSubordinateProjects: false,
  canEditSubordinateLeads: false,
  canEditSubordinateCallbacks: false,
  canAssignToSubordinates: false,
  canViewDepartmentLeads: false,
  canViewDepartmentCallbacks: false,
  canViewDepartmentTasks: false,
  canManageDepartments: false,
  canManagePositions: false,
  canManageSubordinateAccess: false,
};

// Identical pattern to seedCanonicalHierarchy.js's upsertPosition() —
// deliberately not reinvented (see design doc Task 0.3).
async function upsertPosition({ name, level, departmentId, parentPositionName, description, permissions, hierarchicalAccess }, { log = () => {} } = {}) {
  let parentPosition = null;
  if (parentPositionName) {
    const parentDoc = await Position.findOne({ name: parentPositionName });
    parentPosition = parentDoc ? parentDoc._id : null;
    if (!parentDoc) {
      log(`  (warning: parent position "${parentPositionName}" not found when creating "${name}" — leaving parentPosition null)`);
    }
  }

  const result = await Position.findOneAndUpdate(
    { name },
    {
      $setOnInsert: {
        name,
        level,
        department: "all", // legacy enum field — departmentRef is the real source of truth (matches 07-03 pattern)
        departmentRef: departmentId || null,
        parentPosition,
        description,
        permissions: { ...ALL_PERMISSIONS_FALSE, ...permissions },
        hierarchicalAccess: {
          accessLowerLevels: false,
          minimumLevelGap: 0,
          canAccessPositions: [],
          dataScope: "own",
          ...hierarchicalAccess,
        },
        status: "active",
      },
    },
    { upsert: true, new: true, setDefaultsOnInsert: true }
  );

  return result;
}

/**
 * Core logic, reusable from either the CLI wrapper below or an Express route
 * handler that's already connected to MongoDB.
 *
 * Throws an Error with `.code === "MISSING_DEPARTMENTS"` (and `.missing`,
 * the array of missing codes) if updateDepartmentsV2.js hasn't been applied
 * yet — callers decide how to surface that (CLI: exit 1; route: 400).
 *
 * Returns the array of 11 upserted Position documents.
 */
async function seedRoleHierarchyV2({ log = () => {} } = {}) {
  log("==========================================");
  log("SEEDING ROLE HIERARCHY V2");
  log("==========================================\n");

  const departments = await Department.find().lean();
  const deptByCode = new Map(departments.map((d) => [d.code, d]));

  const missing = REQUIRED_DEPARTMENT_CODES.filter((code) => !deptByCode.has(code));
  if (missing.length > 0) {
    const err = new Error(
      `Missing expected department code(s): ${missing.join(", ")}. ` +
      `Run scripts/seedDepartments.js then apply the department renames first.`
    );
    err.code = "MISSING_DEPARTMENTS";
    err.missing = missing;
    throw err;
  }

  const developmentDept = deptByCode.get("development");
  const salesDept = deptByCode.get("sales");
  const hrDept = deptByCode.get("humanResource");

  const created = [];

  // ---- Org-wide: Admin (95) ----
  const admin = await upsertPosition({
    name: "Admin",
    level: 95,
    departmentId: null,
    description: "Broad operational authority across the whole CRM, org-wide (not department-bound). Starting point per the design doc — review before relying on it. Can now delegate bounded, auditable access changes to people below them (canManageSubordinateAccess).",
    permissions: {
      canManageUsers: true,
      canManageClients: true,
      canManageProjects: true,
      canAssignTasks: true,
      canApproveLeaves: true,
      canApproveShifts: true,
      canViewReports: true,
      canManageAttendance: true,
      canViewSubordinateLeads: true,
      canViewSubordinateCallbacks: true,
      canViewSubordinateTasks: true,
      canViewSubordinateProjects: true,
      canEditSubordinateLeads: true,
      canEditSubordinateCallbacks: true,
      canAssignToSubordinates: true,
      canViewDepartmentLeads: true,
      canViewDepartmentCallbacks: true,
      canViewDepartmentTasks: true,
      // canManageDepartments / canManagePositions left false: the full
      // Access Management page (Departments/Positions tabs) stays
      // Super-Admin-exclusive. Admin's new power is the separate, narrower
      // "My Team's Access" delegation surface (canManageSubordinateAccess).
      canManageSubordinateAccess: true,
    },
    hierarchicalAccess: { dataScope: "all", accessLowerLevels: true },
  }, { log });
  created.push(admin);

  // Force-set on every run, independent of insert vs. already-existed —
  // see the file header comment for why.
  await Position.updateOne(
    { _id: admin._id },
    { $set: { "permissions.canManageSubordinateAccess": true } }
  );

  // ---- Sales: Project Manager (70) -> Supervisor (40) -> Agent (10) ----
  const pmSales = await upsertPosition({
    name: "Project Manager — Sales",
    level: 70,
    departmentId: salesDept._id,
    parentPositionName: "Admin",
    description: "Owns the client relationship and overall project/business accountability for Sales. Hands off technical execution to Development's Team Lead (see design doc Section 3 — not built this round).",
    permissions: {
      canManageProjects: true,
      canAssignTasks: true,
      canViewReports: true,
      canViewSubordinateTasks: true,
      canViewSubordinateProjects: true,
      canEditSubordinateLeads: true,
      canEditSubordinateCallbacks: true,
      canViewDepartmentLeads: true,
      canViewDepartmentCallbacks: true,
      canViewDepartmentTasks: true,
      canAssignToSubordinates: true,
    },
    hierarchicalAccess: { dataScope: "department", accessLowerLevels: true },
  }, { log });
  created.push(pmSales);

  const supervisorSales = await upsertPosition({
    name: "Supervisor — Sales",
    level: 40,
    departmentId: salesDept._id,
    parentPositionName: "Project Manager — Sales",
    description: "Team-level oversight of Agents in Sales.",
    permissions: {
      canViewSubordinateLeads: true,
      canViewSubordinateCallbacks: true,
      canEditSubordinateLeads: true,
      canEditSubordinateCallbacks: true,
    },
    hierarchicalAccess: { dataScope: "team", accessLowerLevels: true },
  }, { log });
  created.push(supervisorSales);

  const agentSales = await upsertPosition({
    name: "Agent — Sales",
    level: 10,
    departmentId: salesDept._id,
    parentPositionName: "Supervisor — Sales",
    description: "Front-line Sales employee. Own leads/callbacks/tasks only — self-access is always implicit (server/utils/accessControl.js SELF_IMPLICIT_ACTIONS), no special permissions needed. No Intern tier in Sales per Tapvera's description — easy to add later (a data change, not a code change) if that's wrong.",
    permissions: {},
    hierarchicalAccess: { dataScope: "own" },
  }, { log });
  created.push(agentSales);

  // ---- Development: Team Lead (65) -> Supervisor (40) -> Employee (15) -> Intern (5) ----
  const tlDevelopment = await upsertPosition({
    name: "Team Lead — Development",
    level: 65,
    departmentId: developmentDept._id,
    parentPositionName: "Admin",
    description: "Top of Development's chain — no Project Manager tier here; project/client ownership sits with Sales' PM (see design doc Section 3). Technical counterpart who receives the handoff and coordinates delivery.",
    permissions: {
      canManageProjects: true,
      canViewDepartmentTasks: true,
      canAssignTasks: true,
      canAssignToSubordinates: true,
    },
    hierarchicalAccess: { dataScope: "department", accessLowerLevels: true },
  }, { log });
  created.push(tlDevelopment);

  const supervisorDevelopment = await upsertPosition({
    name: "Supervisor — Development",
    level: 40,
    departmentId: developmentDept._id,
    parentPositionName: "Team Lead — Development",
    description: "Team-level oversight of Employees/Interns in Development.",
    permissions: {
      canViewSubordinateTasks: true,
      canAssignTasks: true,
    },
    hierarchicalAccess: { dataScope: "team", accessLowerLevels: true },
  }, { log });
  created.push(supervisorDevelopment);

  const employeeDevelopment = await upsertPosition({
    name: "Employee — Development",
    level: 15,
    departmentId: developmentDept._id,
    parentPositionName: "Supervisor — Development",
    description: "Own tasks/projects only — self-access is always implicit, no special permissions needed. Specialization (Digital Marketing, Content Writer, SEO Expert, and more) is per-user metadata on User.designation, not a separate Position — see design doc Section 1.",
    permissions: {},
    hierarchicalAccess: { dataScope: "own" },
  }, { log });
  created.push(employeeDevelopment);

  const internDevelopment = await upsertPosition({
    name: "Intern — Development",
    level: 5,
    departmentId: developmentDept._id,
    parentPositionName: "Employee — Development",
    description: "Same permission floor as Employee — Development (own data only).",
    permissions: {},
    hierarchicalAccess: { dataScope: "own" },
  }, { log });
  created.push(internDevelopment);

  // ---- HR: Senior HR (60) -> Junior HR (30) -> HR Intern (5) ----
  // Flat seniority ladder — no separate Supervisor/Team Lead titles, matching
  // Tapvera's description. HR-domain permissions (leave/shift/attendance/
  // users), not business-data dataScope — dataScope stays "own"/"team" per
  // the design rule that level/scope never substitute for explicit flags.
  const seniorHR = await upsertPosition({
    name: "Senior HR",
    level: 60,
    departmentId: hrDept._id,
    parentPositionName: "Admin",
    description: "HR-domain authority (leave, shifts, attendance, employee records). Deliberately NOT given business-data scope (leads/clients/projects) — same rule the 07-03 rework established for the HR tier.",
    permissions: {
      canManageUsers: true,
      canApproveLeaves: true,
      canApproveShifts: true,
      canViewReports: true,
      canManageAttendance: true,
    },
    hierarchicalAccess: { dataScope: "own" },
  }, { log });
  created.push(seniorHR);

  const juniorHR = await upsertPosition({
    name: "Junior HR",
    level: 30,
    departmentId: hrDept._id,
    parentPositionName: "Senior HR",
    description: "Team-level HR support, reporting to Senior HR.",
    permissions: {
      canApproveLeaves: true,
      canManageAttendance: true,
    },
    hierarchicalAccess: { dataScope: "team" },
  }, { log });
  created.push(juniorHR);

  const hrIntern = await upsertPosition({
    name: "HR Intern",
    level: 5,
    departmentId: hrDept._id,
    parentPositionName: "Junior HR",
    description: "Own data only — no special permissions needed.",
    permissions: {},
    hierarchicalAccess: { dataScope: "own" },
  }, { log });
  created.push(hrIntern);

  log(`Upserted ${created.length} position(s):\n`);
  created.forEach((p) => {
    log(`  - ${p.name} (level ${p.level}, dataScope: ${p.hierarchicalAccess?.dataScope})`);
  });

  return created;
}

// ---------------------------------------------------------------------------
// CLI wrapper — only runs when this file is executed directly
// (`node scripts/seedRoleHierarchyV2.js`), not when required by a route.
// ---------------------------------------------------------------------------
async function runCli() {
  require("dotenv").config();
  await mongoose.connect(process.env.MONGODB_URI, { serverSelectionTimeoutMS: 10000 });
  console.log("Connected to MongoDB\n");

  await seedRoleHierarchyV2({ log: console.log });

  console.log("\nNothing was assigned to any user. Next steps:");
  console.log("  1. Run scripts/migrateToRoleHierarchyV2.js for a report on anyone currently");
  console.log("     assigned to the old tech/marketingAndSales-flavored positions.");
  console.log("  2. Use the Access Management page's 'Assign Employees' tab to assign your");
  console.log("     real employees to these new positions (a deliberate act, not automated).\n");

  await mongoose.disconnect();
  process.exit(0);
}

module.exports = { seedRoleHierarchyV2, REQUIRED_DEPARTMENT_CODES, V2_POSITION_NAMES };

if (require.main === module) {
  runCli().catch((err) => {
    console.error("Error seeding role hierarchy v2:", err);
    process.exit(1);
  });
}
