/**
 * Why can't an employee see their payslip?
 *
 * Answers, for one month, the only three questions that matter:
 *   1. Does a payslip exist for them at all?
 *   2. Is it published? A draft is invisible on their own Payslips page —
 *      getMyPayslipHistory returns published payslips only.
 *   3. Is it attached to the user they actually log in as?
 *
 * Read-only. Pass --publish to publish every draft it finds for that month.
 *
 *   node scripts/checkPayslipVisibility.js 2026-08
 *   node scripts/checkPayslipVisibility.js 2026-08 --publish
 */

"use strict";

const mongoose = require("mongoose");
require("dotenv").config();

const User = require("../models/User");
const Payslip = require("../models/Payslip");

const payPeriod = process.argv[2];
const doPublish = process.argv.includes("--publish");

if (!/^\d{4}-(0[1-9]|1[0-2])$/.test(payPeriod || "")) {
  console.error("Usage: node scripts/checkPayslipVisibility.js YYYY-MM [--publish]");
  process.exit(1);
}

const pad = (s, n) => String(s ?? "").padEnd(n).slice(0, n);

(async () => {
  await mongoose.connect(process.env.MONGODB_URI || process.env.MONGO_URI);
  console.log(`\nPayslips for ${payPeriod}\n`);

  const employees = await User.find({ status: "active" })
    .select("name employeeId role status")
    .sort({ employeeId: 1, name: 1 })
    .lean();

  const payslips = await Payslip.find({ payPeriod })
    .select("employee isPublished publishedAt netSalary createdAt")
    .lean();

  const byEmployee = new Map(payslips.map((p) => [String(p.employee), p]));

  let published = 0, drafts = 0, missing = 0;
  const draftDocs = [];

  console.log(`  ${pad("Employee ID", 14)}${pad("Name", 26)}${pad("Role", 12)}${pad("Payslip", 12)}${pad("Net", 12)}Employee can see it`);
  console.log(`  ${"-".repeat(96)}`);

  for (const employee of employees) {
    const payslip = byEmployee.get(String(employee._id));
    let state, visible;

    if (!payslip) { state = "none"; visible = "no — none exists"; missing++; }
    else if (payslip.isPublished) { state = "published"; visible = "YES"; published++; }
    else { state = "DRAFT"; visible = "no — still a draft"; drafts++; draftDocs.push(payslip); }

    console.log(
      `  ${pad(employee.employeeId, 14)}${pad(employee.name, 26)}${pad(employee.role, 12)}` +
      `${pad(state, 12)}${pad(payslip ? Math.round(payslip.netSalary) : "", 12)}${visible}`
    );
  }

  // A payslip whose employee is not in the active list at all: the row exists
  // but nobody who logs in owns it.
  const activeIds = new Set(employees.map((e) => String(e._id)));
  const orphans = payslips.filter((p) => !activeIds.has(String(p.employee)));

  console.log(`\n  ${published} published · ${drafts} draft · ${missing} with no payslip`);
  if (orphans.length) {
    console.log(`  ⚠️  ${orphans.length} payslip(s) belong to a user who is not active — nobody will see those.`);
    for (const o of orphans) console.log(`      employee ${o.employee}`);
  }

  if (drafts && !doPublish) {
    console.log(`\n  ${drafts} payslip(s) exist but are invisible to the employee.`);
    console.log(`  Publish them from the register, or re-run this with --publish.`);
  }

  if (drafts && doPublish) {
    const ids = draftDocs.map((p) => p._id);
    const result = await Payslip.updateMany(
      { _id: { $in: ids } },
      { $set: { isPublished: true, publishedAt: new Date() } }
    );
    console.log(`\n  Published ${result.modifiedCount} draft(s).`);
    console.log(`  Note: this does NOT send the in-app notification — publishing from the register does.`);
  }

  await mongoose.disconnect();
  console.log("");
})().catch(async (err) => {
  console.error("Failed:", err.message);
  try { await mongoose.disconnect(); } catch {}
  process.exit(1);
});
