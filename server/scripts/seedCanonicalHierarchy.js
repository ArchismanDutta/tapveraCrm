// server/scripts/seedCanonicalHierarchy.js
//
// Access-management rework (2026-07-03) — Phase 3, Task 3.1.
// See docs/superpowers/specs/2026-07-03-access-management-design.md
//      docs/superpowers/plans/2026-07-03-access-management-rework.md
//
// Creates the canonical hierarchy positions from the design doc:
//   Admin (95) -> HR (90) -> Project Manager (70) -> Supervisor (50)
//   -> Team Lead (40) -> Agent (10)
//
// Admin and HR are org-wide (not department-bound). Project Manager,
// Supervisor, Team Lead, and Agent are created ONCE PER OPERATIONAL
// DEPARTMENT (see DELIVERY_DEPARTMENT_CODES below) so "Team Lead — Tech"
// and "Team Lead — Marketing & Sales" are two distinct, independently
// configurable positions — not a name collision the way the old system's
// free-text position matching allowed.
//
// Executives and Human Resources are deliberately NOT given their own
// PM/Supervisor/TL/Agent chain here — they're leadership/staff functions,
// not delivery teams. Add their codes to DELIVERY_DEPARTMENT_CODES below
// if that's wrong for how Tapvera is actually organized; everything here
// is also editable afterward from the Access Management page regardless.
//
// IMPORTANT — things this script deliberately does NOT do:
//   - It does not touch any User document. Assigning real employees to
//     these positions is a judgment call about who actually goes where —
//     do that deliberately via the Access Management page's "Assign
//     Employees" tab (Phase 2), informed by the report from
//     migrateToPositionRefs.js, not by this script.
//   - It does not force HR into the Admin->HR->PM->Supervisor->TL->Agent
//     chain as PM's literal parentPosition. Per the design doc, level
//     encodes seniority/tie-breaking, not automatic authority — HR is a
//     lateral, domain-specific function (leave/attendance/payroll), not
//     literally PM's manager, so PM.parentPosition is left at the top of
//     its own operational chain instead. HR.parentPosition is also left
//     null for the same reason. Change this from the Access Management
//     page if Tapvera's real reporting lines say otherwise.
//   - The permission defaults below are a reasoned STARTING POINT (see the
//     design doc's "Open Items for Review"), not a final decision — Admin's
//     broad-but-real permission set and HR's exact scope in particular are
//     both flagged there for confirmation. Everything is editable from the
//     Access Management page after this runs.
//
// This has NOT been run against any environment yet. Requires
// seedDepartments.js to have been run first (looks departments up by code).
//
// Usage:
//   cd server
//   node scripts/seedCanonicalHierarchy.js

const mongoose = require("mongoose");
require("dotenv").config();

const Department = require("../models/Department");
const Position = require("../models/Position");

// Departments that get a full Project Manager -> Supervisor -> Team Lead ->
// Agent chain. Executives/Human Resources intentionally excluded — see
// comment above.
const DELIVERY_DEPARTMENT_CODES = ["tech", "marketingAndSales"];

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
};

async function upsertPosition({ name, level, departmentId, parentPositionName, description, permissions, hierarchicalAccess }) {
  let parentPosition = null;
  if (parentPositionName) {
    const parentDoc = await Position.findOne({ name: parentPositionName });
    parentPosition = parentDoc ? parentDoc._id : null;
  }

  const result = await Position.findOneAndUpdate(
    { name },
    {
      $setOnInsert: {
        name,
        level,
        department: "all", // legacy enum field - department-bound positions get this synced separately below
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

async function seed() {
  await mongoose.connect(process.env.MONGODB_URI, { serverSelectionTimeoutMS: 10000 });
  console.log("Connected to MongoDB\n");

  console.log("==========================================");
  console.log("SEEDING CANONICAL HIERARCHY");
  console.log("==========================================\n");

  const departments = await Department.find().lean();
  if (departments.length === 0) {
    console.error("No Department documents found. Run seedDepartments.js first. Aborting.");
    process.exit(1);
  }
  const deptByCode = new Map(departments.map((d) => [d.code, d]));

  const missing = DELIVERY_DEPARTMENT_CODES.filter((code) => !deptByCode.has(code));
  if (missing.length > 0) {
    console.error(`Missing expected department code(s): ${missing.join(", ")}. Run seedDepartments.js first, or update DELIVERY_DEPARTMENT_CODES in this script. Aborting.`);
    process.exit(1);
  }

  const created = [];

  // ---- Org-wide positions ----
  const admin = await upsertPosition({
    name: "Admin",
    level: 95,
    departmentId: null,
    description: "Broad operational authority across the whole CRM. Starting point per the design doc - review before relying on it.",
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
      // canManageDepartments / canManagePositions left false: kept
      // super-admin-exclusive by default. Enable from the Access
      // Management page if Admin should be able to reconfigure the
      // hierarchy itself, not just use it.
    },
    hierarchicalAccess: { dataScope: "all", accessLowerLevels: true },
  });
  created.push(admin);

  const hr = await upsertPosition({
    name: "HR",
    level: 90,
    departmentId: null,
    description: "HR-domain authority (leave, shifts, attendance, employee records) org-wide. Deliberately NOT given business-data scope (leads/clients/projects) by default - see design doc.",
    permissions: {
      canManageUsers: true,
      canApproveLeaves: true,
      canApproveShifts: true,
      canViewReports: true,
      canManageAttendance: true,
    },
    hierarchicalAccess: { dataScope: "own" },
  });
  created.push(hr);

  // ---- Per-department delivery chain ----
  for (const code of DELIVERY_DEPARTMENT_CODES) {
    const dept = deptByCode.get(code);
    const suffix = ` — ${dept.name}`;

    const pm = await upsertPosition({
      name: `Project Manager${suffix}`,
      level: 70,
      departmentId: dept._id,
      description: `Manages ${dept.name}'s projects, tasks, and team. Sees the whole department's operational data.`,
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
    });
    created.push(pm);

    const supervisor = await upsertPosition({
      name: `Supervisor${suffix}`,
      level: 50,
      departmentId: dept._id,
      parentPositionName: pm.name,
      description: `Oversees Team Leads and Agents in ${dept.name}. Permissions mirror what was already hand-configured for Supervisor in production (see server/fix-supervisor-position.js) before this rework.`,
      permissions: {
        canManageProjects: true,
        canAssignTasks: true,
        canViewSubordinateLeads: true,
        canViewSubordinateCallbacks: true,
        canEditSubordinateLeads: true,
        canEditSubordinateCallbacks: true,
        canAssignToSubordinates: true,
      },
      hierarchicalAccess: { dataScope: "team", accessLowerLevels: true },
    });
    created.push(supervisor);

    const tl = await upsertPosition({
      name: `Team Lead${suffix}`,
      level: 40,
      departmentId: dept._id,
      parentPositionName: supervisor.name,
      description: `Leads a team of Agents in ${dept.name}.`,
      permissions: {
        canAssignTasks: true,
        canViewSubordinateLeads: true,
        canViewSubordinateCallbacks: true,
        canEditSubordinateLeads: true,
        canEditSubordinateCallbacks: true,
        canAssignToSubordinates: true,
      },
      hierarchicalAccess: { dataScope: "team", accessLowerLevels: true },
    });
    created.push(tl);

    const agent = await upsertPosition({
      name: `Agent${suffix}`,
      level: 10,
      departmentId: dept._id,
      parentPositionName: tl.name,
      description: `Front-line ${dept.name} employee. Own leads/callbacks/tasks only - no special permissions needed since self-access is always implicit (see server/utils/accessControl.js SELF_IMPLICIT_ACTIONS).`,
      permissions: {},
      hierarchicalAccess: { dataScope: "own" },
    });
    created.push(agent);
  }

  console.log(`Upserted ${created.length} position(s):\n`);
  created.forEach((p) => {
    console.log(`  - ${p.name} (level ${p.level}, dataScope: ${p.hierarchicalAccess?.dataScope})`);
  });

  console.log("\nNothing was assigned to any user. Next: use the Access Management");
  console.log("page's 'Assign Employees' tab to assign your real employees to");
  console.log("these positions (informed by migrateToPositionRefs.js's report).\n");

  await mongoose.disconnect();
  process.exit(0);
}

seed().catch((err) => {
  console.error("Error seeding canonical hierarchy:", err);
  process.exit(1);
});
