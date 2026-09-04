// scripts/canonicaliseAttendanceDates.js
//
// Move every AttendanceRecord.date onto the canonical representation:
// UTC midnight of the IST calendar date the record belongs to.
//
//     node scripts/canonicaliseAttendanceDates.js --dry-run   # always first
//     node scripts/canonicaliseAttendanceDates.js
//
// ─────────────────────────────────────────────────────────────────────────────
// WHY THIS IS NEEDED
//
// AttendanceService.normalizeDate() used to call setHours(0, 0, 0, 0), which
// reads the PROCESS timezone. app.js pins that to Asia/Kolkata, so records
// written by a pinned server landed on 18:30Z of the PREVIOUS day, while
// LeaveRequest.period and Holiday.date — parsed from "YYYY-MM-DD", which the
// language spec reads as UTC — sat at 00:00Z. Everything that compared the two
// was 330 minutes out.
//
// normalizeDate now derives the IST date from a fixed offset and returns UTC
// midnight, which is independent of the host timezone. That fixes new writes.
// Rows already stored at 18:30Z would then be invisible to the lookup, and the
// next punch of the day would create a SECOND record for a day that already
// has one — so those rows have to be moved.
//
// Two generations may exist side by side, because the timezone was only pinned
// part way through the system's life:
//
//     written while the host ran UTC   ->  2026-08-05T00:00:00Z   already right
//     written while pinned to IST      ->  2026-08-04T18:30:00Z   needs moving
//
// Both normalize to the same canonical value, so this script is idempotent and
// safe to re-run. Where moving a row would collide with an existing canonical
// row for the same day, the two are merged rather than one overwriting the
// other: employees are unioned by userId, and where both rows hold the same
// employee the one with more recorded events wins, since that is the one that
// actually saw punches.
// ─────────────────────────────────────────────────────────────────────────────

require("dotenv").config();
process.env.TZ = process.env.TZ || "Asia/Kolkata";

const mongoose = require("mongoose");
const AttendanceRecord = require("../models/AttendanceRecord");
const AttendanceService = require("../services/AttendanceService");

const attendanceService = new AttendanceService();
const DRY_RUN = process.argv.includes("--dry-run");

const iso = (d) => new Date(d).toISOString();
const eventCount = (employee) => (employee && employee.events ? employee.events.length : 0);

/** Union two employee arrays, preferring the row that has more events. */
function mergeEmployees(canonicalEmployees = [], incomingEmployees = []) {
  const byUser = new Map();

  for (const employee of canonicalEmployees) {
    byUser.set(String(employee.userId), employee);
  }

  let added = 0;
  let replaced = 0;

  for (const employee of incomingEmployees) {
    const key = String(employee.userId);
    const existing = byUser.get(key);

    if (!existing) {
      byUser.set(key, employee);
      added++;
    } else if (eventCount(employee) > eventCount(existing)) {
      byUser.set(key, employee);
      replaced++;
    }
  }

  return { employees: [...byUser.values()], added, replaced };
}

async function main() {
  const uri = process.env.MONGODB_URI || process.env.MONGO_URI;
  if (!uri) {
    console.error("❌ MONGODB_URI not set in .env");
    process.exit(1);
  }

  await mongoose.connect(uri);
  console.log(`✅ Connected  (TZ=${process.env.TZ})${DRY_RUN ? "  — DRY RUN, nothing will be written" : ""}\n`);

  const records = await AttendanceRecord.find({}).sort({ date: 1 });
  console.log(`📄 ${records.length} attendance record(s)\n`);

  let alreadyCanonical = 0;
  let moved = 0;
  let mergedInto = 0;
  let employeesMoved = 0;

  for (const record of records) {
    const canonical = attendanceService.normalizeDate(record.date);

    if (canonical.getTime() === new Date(record.date).getTime()) {
      alreadyCanonical++;
      continue;
    }

    // Is there already a record sitting on the canonical date?
    const existing = await AttendanceRecord.findOne({ date: canonical });

    if (!existing) {
      console.log(`move   ${iso(record.date)} -> ${iso(canonical)}   (${record.employees.length} employees)`);
      if (!DRY_RUN) {
        record.date = canonical;
        await record.save();
      }
      moved++;
      continue;
    }

    const { employees, added, replaced } = mergeEmployees(existing.employees, record.employees);
    console.log(
      `merge  ${iso(record.date)} -> ${iso(canonical)}   ` +
        `+${added} employee(s), ${replaced} replaced by a fuller row`
    );

    if (!DRY_RUN) {
      existing.employees = employees;
      attendanceService.updateDailyStats(existing);
      await existing.save();
      await AttendanceRecord.deleteOne({ _id: record._id });
    }

    mergedInto++;
    employeesMoved += added + replaced;
  }

  console.log(
    `\n${DRY_RUN ? "Would leave" : "Left"} ${alreadyCanonical} already-canonical, ` +
      `${DRY_RUN ? "move" : "moved"} ${moved}, ` +
      `${DRY_RUN ? "merge" : "merged"} ${mergedInto} (${employeesMoved} employee rows carried across).`
  );

  if (DRY_RUN && (moved || mergedInto)) {
    console.log("\nRe-run without --dry-run to apply. Back up the collection first.");
  }

  await mongoose.connection.close();
}

main().catch(async (err) => {
  console.error("❌ Migration failed:", err);
  await mongoose.connection.close().catch(() => {});
  process.exit(1);
});
