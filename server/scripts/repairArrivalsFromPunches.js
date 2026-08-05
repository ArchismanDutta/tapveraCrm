// scripts/repairArrivalsFromPunches.js
//
// Pull each employee's recorded arrival back to their FIRST fingerprint scan of
// the day.
//
//     node scripts/repairArrivalsFromPunches.js --dry-run
//     node scripts/repairArrivalsFromPunches.js
//     node scripts/repairArrivalsFromPunches.js --hours 24
//
// ─────────────────────────────────────────────────────────────────────────────
// THE SITUATION THIS REPAIRS
// ─────────────────────────────────────────────────────────────────────────────
// While a stale clock correction was pushing punches into the future, every
// scan was rejected with "Cannot record future events". People then re-scanned
// once it was fixed — so their attendance opens at the time they re-scanned
// (say 10:05) rather than when they actually arrived (08:48).
//
// replayFailedPunches.js cannot repair that: the day is already open, so
// replaying the earlier punch is correctly refused as "already punched in".
// The fix is to move the existing PUNCH_IN back, not to add another one.
//
// The raw punches are the evidence — every scan is stored regardless of whether
// it became attendance — so the true arrival is simply the earliest one of the
// day.
//
// Only ever moves an arrival EARLIER. If the recorded time is already at or
// before the first scan, it is left alone: this repairs a known failure mode,
// it is not a general rewrite of attendance.
'use strict';

require('dotenv').config();
const mongoose = require('mongoose');

const args = process.argv.slice(2);
const DRY_RUN = args.includes('--dry-run');
const argVal = (n, d) => { const i = args.indexOf(`--${n}`); return i >= 0 && args[i + 1] ? args[i + 1] : d; };
const HOURS = Number(argVal('hours', 16));

const ist = (d) => new Intl.DateTimeFormat('en-GB', {
  timeZone: 'Asia/Kolkata', day: '2-digit', month: 'short',
  hour: '2-digit', minute: '2-digit', second: '2-digit', hour12: true,
}).format(new Date(d));

(async () => {
  await mongoose.connect(process.env.MONGODB_URI || process.env.MONGO_URI);

  const BiometricPunch = require('../models/BiometricPunch');
  const AttendanceRecord = require('../models/AttendanceRecord');
  const User = require('../models/User');
  const AttendanceService = require('../services/AttendanceService');
  const attendanceService = new AttendanceService();

  const since = new Date(Date.now() - HOURS * 3600 * 1000);

  // Every scan, whatever became of it — a FAILED punch is still proof the
  // person stood at the terminal.
  const punches = await BiometricPunch.find({
    punchedAt: { $gte: since },
    userId: { $ne: null },
  }).select('userId pin punchedAt appliedOffsetMinutes status').sort({ punchedAt: 1 }).lean();

  // Earliest scan per person = their true arrival.
  const earliest = new Map();
  for (const p of punches) {
    const key = String(p.userId);
    // Use the raw device time. The offset is 0 now that the device clock is
    // correct; older rows carrying +30 were recorded while it ran slow, so
    // their corrected value is the true one.
    const at = new Date(new Date(p.punchedAt).getTime() + (p.appliedOffsetMinutes || 0) * 60000);
    if (!earliest.has(key) || at < earliest.get(key).at) earliest.set(key, { at, pin: p.pin });
  }

  // Day-range match — AttendanceRecord.date is normalizeDate-normalised
  // (server-local midnight) while punch dates use UTC midnight of the IST date,
  // 5h30m apart. Equality matches nothing.
  const nowTs = Date.now();
  const records = await AttendanceRecord.find({
    date: { $gte: new Date(nowTs - 36 * 3600 * 1000), $lte: new Date(nowTs + 12 * 3600 * 1000) },
  });

  const users = await User.find({ _id: { $in: [...earliest.keys()] } }).select('name biometricPin').lean();
  const nameFor = (id) => users.find((u) => String(u._id) === String(id))?.name || String(id);

  let repaired = 0, alreadyCorrect = 0, noRow = 0;
  const touched = new Set();

  console.log(`\nRepairing arrivals from raw scans (last ${HOURS}h)${DRY_RUN ? '  — DRY RUN' : ''}\n`);
  console.log('─'.repeat(100));

  for (const [userId, { at: trueArrival, pin }] of earliest) {
    const record = records.find((r) =>
      (r.employees || []).some((e) => String(e.userId) === String(userId))
    );

    if (!record) {
      console.log(`  – ${nameFor(userId).padEnd(24)} PIN ${String(pin).padEnd(4)} no attendance row — run replayFailedPunches.js first`);
      noRow += 1;
      continue;
    }

    const employee = record.employees.find((e) => String(e.userId) === String(userId));
    const punchIn = (employee.events || [])
      .filter((e) => e.type === 'PUNCH_IN')
      .sort((a, b) => new Date(a.timestamp) - new Date(b.timestamp))[0];

    if (!punchIn) {
      console.log(`  – ${nameFor(userId).padEnd(24)} PIN ${String(pin).padEnd(4)} row exists but no PUNCH_IN event`);
      noRow += 1;
      continue;
    }

    const recorded = new Date(punchIn.timestamp);

    // Only ever move earlier, and ignore sub-minute noise.
    if (recorded.getTime() - trueArrival.getTime() < 60000) {
      alreadyCorrect += 1;
      continue;
    }

    const lateBy = Math.round((recorded - trueArrival) / 60000);
    console.log(
      `  ${nameFor(userId).padEnd(24)} PIN ${String(pin).padEnd(4)} ${ist(recorded)} → ${ist(trueArrival)}  (${lateBy} min earlier)`
    );

    if (!DRY_RUN) {
      punchIn.timestamp = trueArrival;
      touched.add(record);
    }
    repaired += 1;
  }

  if (!DRY_RUN) {
    for (const record of touched) {
      for (const employee of record.employees) {
        attendanceService.recalculateEmployeeData(employee, record.date);
      }
      attendanceService.updateDailyStats(record);
      await record.save();
    }
  }

  console.log('─'.repeat(100));
  console.log(`  ${DRY_RUN ? 'would repair' : 'repaired'} : ${repaired}`);
  console.log(`  already correct  : ${alreadyCorrect}`);
  console.log(`  no attendance row: ${noRow}`);
  if (DRY_RUN) console.log('\nRe-run without --dry-run to apply.');
  process.exit(0);
})().catch((e) => { console.error('Failed:', e.message); process.exit(1); });
