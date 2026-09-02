// scripts/migrateLegacyPayslips.js
//
// Bring payslips created before the June 2026 "salary management" schema
// rewrite onto the current Payslip field names.
//
//     node scripts/migrateLegacyPayslips.js --dry-run        # always do this first
//     node scripts/migrateLegacyPayslips.js
//     node scripts/migrateLegacyPayslips.js --cleanup        # also drop the legacy keys
//
// ─────────────────────────────────────────────────────────────────────────────
// WHY THIS IS NEEDED
//
// The auto-payroll service used to write netPayment / grossComponents /
// eligibility{pf,esi} / deductions.esi, and never wrote totalDays. The Payslip
// schema now uses netSalary / paidComponents / pfEligible / esiEligible /
// deductions.employeeESI, with totalDays required.
//
// Documents written by the old code still hold the old field names, so the
// payslip screens read undefined and show a blank net pay. This script copies
// each legacy value onto its current field. It only touches documents that are
// missing netSalary, so it is safe to re-run.
//
// The reverse mapping is:
//     netPayment         -> netSalary
//     grossComponents    -> paidComponents
//     eligibility.pf     -> pfEligible
//     eligibility.esi    -> esiEligible
//     deductions.esi     -> deductions.employeeESI
//     (missing)          -> totalDays  (falls back to workingDays)
// ─────────────────────────────────────────────────────────────────────────────

require("dotenv").config();
const mongoose = require("mongoose");

const DRY_RUN = process.argv.includes("--dry-run");
const CLEANUP = process.argv.includes("--cleanup");

async function main() {
  const uri = process.env.MONGODB_URI || process.env.MONGO_URI;
  if (!uri) {
    console.error("❌ MONGODB_URI not set in .env");
    process.exit(1);
  }

  await mongoose.connect(uri);
  console.log(`✅ Connected${DRY_RUN ? "  (DRY RUN — nothing will be written)" : ""}`);

  const payslips = mongoose.connection.collection("payslips");

  // Legacy documents are the ones that never got a netSalary written.
  const legacy = await payslips
    .find({ $or: [{ netSalary: { $exists: false } }, { netSalary: null }] })
    .toArray();

  console.log(`📄 ${legacy.length} legacy payslip(s) found\n`);
  if (legacy.length === 0) {
    await mongoose.connection.close();
    return;
  }

  let migrated = 0;
  let skipped = 0;

  for (const doc of legacy) {
    const set = {};

    if (doc.netPayment != null) set.netSalary = doc.netPayment;
    if (doc.totalDays == null) set.totalDays = doc.workingDays;
    if (doc.paidComponents == null && doc.grossComponents) {
      set.paidComponents = doc.grossComponents;
    }
    if (doc.pfEligible == null) set.pfEligible = Boolean(doc.eligibility && doc.eligibility.pf);
    if (doc.esiEligible == null) set.esiEligible = Boolean(doc.eligibility && doc.eligibility.esi);

    const d = doc.deductions || {};
    if (d.employeeESI == null && d.esi != null) set["deductions.employeeESI"] = d.esi;
    if (d.lwpDeduction == null) set["deductions.lwpDeduction"] = 0;

    // A document with no netPayment to copy cannot be repaired automatically —
    // report it instead of writing a half-migrated payslip.
    if (set.netSalary == null || set.totalDays == null) {
      skipped++;
      console.warn(
        `⚠️  ${doc._id} (${doc.payPeriod}) — cannot migrate: ` +
          `netPayment=${doc.netPayment}, workingDays=${doc.workingDays}`
      );
      continue;
    }

    const update = { $set: set };
    if (CLEANUP) {
      update.$unset = {
        netPayment: "",
        grossComponents: "",
        eligibility: "",
        "deductions.esi": "",
        bonuses: "",
      };
    }

    console.log(
      `${DRY_RUN ? "would migrate" : "migrating   "}  ${doc._id}  ${doc.payPeriod}  ` +
        `netSalary=${set.netSalary}  totalDays=${set.totalDays}`
    );

    if (!DRY_RUN) await payslips.updateOne({ _id: doc._id }, update);
    migrated++;
  }

  console.log(
    `\n${DRY_RUN ? "Would migrate" : "Migrated"}: ${migrated}` +
      (skipped ? `   Skipped (needs manual review): ${skipped}` : "")
  );
  if (CLEANUP && !DRY_RUN) console.log("Legacy keys removed.");

  await mongoose.connection.close();
}

main().catch(async (err) => {
  console.error("❌ Migration failed:", err);
  await mongoose.connection.close().catch(() => {});
  process.exit(1);
});
