// server/scripts/seedDepartments.js
//
// Access-management rework (2026-07-03) — Phase 0, Task 0.2.
// See docs/superpowers/plans/2026-07-03-access-management-rework.md
//
// Creates the initial Department documents, mapped from today's hardcoded
// User.department / Position.department enum values:
//   executives        -> "Executives"       (code: executives)
//   development       -> "Tech"             (code: tech)          <- rename, confirm before running on real data
//   marketingAndSales -> "Marketing & Sales" (code: marketingAndSales)
//   humanResource     -> "Human Resources"   (code: humanResource)
//
// This script is idempotent (safe to re-run — upserts by `code`) and purely
// additive: it does not touch User or Position documents at all. Run
// migrateToPositionRefs.js afterwards to link existing users/positions to
// these new Department docs.
//
// IMPORTANT: this has NOT been run against any environment yet. The "Tech"
// rename in particular is a naming call flagged for Sahil's confirmation in
// the design doc's "Open Items for Review" section — confirm before running
// this against staging or production data.
//
// Usage:
//   cd server
//   node scripts/seedDepartments.js

const mongoose = require("mongoose");
require("dotenv").config();

const Department = require("../models/Department");

const DEPARTMENTS = [
  {
    name: "Executives",
    code: "executives",
    legacyEnumValue: "executives",
    description: "Company leadership and executive management.",
  },
  {
    name: "Tech",
    code: "tech",
    legacyEnumValue: "development",
    description: "Engineering, development, and QA. (Renamed from legacy \"development\" — confirm naming before running in production.)",
  },
  {
    name: "Marketing & Sales",
    code: "marketingAndSales",
    legacyEnumValue: "marketingAndSales",
    description: "Marketing, sales, leads, and callbacks.",
  },
  {
    name: "Human Resources",
    code: "humanResource",
    legacyEnumValue: "humanResource",
    description: "HR, payroll, attendance, and people operations.",
  },
];

async function seedDepartments() {
  await mongoose.connect(process.env.MONGODB_URI, {
    serverSelectionTimeoutMS: 10000,
  });
  console.log("Connected to MongoDB\n");

  console.log("==========================================");
  console.log("SEEDING DEPARTMENTS");
  console.log("==========================================\n");

  const results = [];

  for (const dept of DEPARTMENTS) {
    const result = await Department.findOneAndUpdate(
      { code: dept.code },
      {
        $setOnInsert: {
          name: dept.name,
          code: dept.code,
          legacyEnumValue: dept.legacyEnumValue,
          description: dept.description,
          status: "active",
        },
      },
      { upsert: true, new: true, setDefaultsOnInsert: true }
    );
    results.push(result);
    console.log(`- ${result.name} (code: ${result.code}, legacy: "${result.legacyEnumValue}") -> ${result._id}`);
  }

  console.log(`\nDone. ${results.length} department(s) present (created or already existed).`);
  console.log("Next: review the report from migrateToPositionRefs.js before linking existing users/positions.\n");

  await mongoose.disconnect();
  process.exit(0);
}

seedDepartments().catch((err) => {
  console.error("Error seeding departments:", err);
  process.exit(1);
});
