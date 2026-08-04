// scripts/backfillClockOffset.js
//
// Correct attendance times that were recorded BEFORE the device clock offset
// went live.
//
//     node scripts/backfillClockOffset.js --dry-run          # always do this first
//     node scripts/backfillClockOffset.js
//     node scripts/backfillClockOffset.js --hours 48
//     node scripts/backfillClockOffset.js --offset 30        # override the env value
//
// ─────────────────────────────────────────────────────────────────────────────
// WHY THIS IS NEEDED
// ─────────────────────────────────────────────────────────────────────────────
// BIOMETRIC_CLOCK_OFFSET_MINUTES only affects punches processed after it was
// set. Anything the device sent before that is already written into
// AttendanceRecord at the device's wrong time, and nothing will ever revisit
// it — a 15:47 arrival stays recorded as 15:17 forever, and the employee
// appears to have arrived half an hour earlier than they did.
//
// ─────────────────────────────────────────────────────────────────────────────
// HOW IT AVOIDS DOUBLE-CORRECTING
// ─────────────────────────────────────────────────────────────────────────────
// BiometricPunch.appliedOffsetMinutes records what was applied to each punch at
// the time it was processed. This script only touches rows where that is 0 or
// missing — i.e. demonstrably uncorrected — and writes the offset back onto the
// row once done. So a second run finds nothing, and an interrupted run resumes
// safely instead of shifting the same punch twice.
//
// It matches attendance events by exact timestamp against the raw punch, which
// is reliable because recordPunchEvent stored that value verbatim.
'use strict';

require('dotenv').config();
const mongoose = require('mongoose');

const args = process.argv.slice(2);
const DRY_RUN = args.includes('--dry-run');
const argVal = (n, d) => { const i = args.indexOf(`--${n}`); return i >= 0 && args[i + 1] ? args[i + 1] : d; };

const HOURS = Number(argVal('hours', 24));
const OFFSET = Number(argVal('offset', process.env.BIOMETRIC_CLOCK_OFFSET_MINUTES || 0));

const ist = (d) => d ? new Intl.DateTimeFormat('en-GB', {
  timeZone: 'Asia/Kolkata', day: '2-digit', month: 'short',
  hour: '2-digit', minute: '2-digit', hour12: true,
}).format(new Date(d)) : '—';

(async () => {
  if (!OFFSET) {
    console.log('Offset is 0 — nothing to backfill. Set BIOMETRIC_CLOCK_OFFSET_MINUTES or pass --offset.');
    process.exit(1);
  }

  await mongoose.connect(process.env.MONGODB_URI || process.env.MONGO_URI);

  const BiometricPunch = require('../models/BiometricPunch');
  const AttendanceRecord = require('../models/AttendanceRecord');
  const AttendanceService = require('../services/AttendanceService');
  const attendanceService = new AttendanceService();

  const since = new Date(Date.now() - HOURS * 3600 * 1000);

  // Only punches that actually became attendance, and that carry no correction.
  const stale = await BiometricPunch.find({
    status: 'APPLIED',
    punchedAt: { $gte: since },
    $or: [{ appliedOffsetMinutes: 0 }, { appliedOffsetMinutes: { $exists: false } }, { appliedOffsetMinutes: null }],
  }).sort({ punchedAt: 1 }).lean();

  console.log(`\nBackfilling ${OFFSET > 0 ? '+' : ''}${OFFSET} min${DRY_RUN ? '  (DRY RUN — nothing will be written)' : ''}`);
  console.log(`Window: last ${HOURS}h · candidates: ${stale.length}\n`);
  console.log('─'.repeat(96));

  let shifted = 0, notFound = 0, failed = 0;
  const touchedRecords = new Map(); // date-key -> record doc
  const missReasons = {};
  const miss = (why, detail) => {
    notFound += 1;
    missReasons[why] = (missReasons[why] || 0) + 1;
    if (detail) console.log(`  – ${why}: ${detail}`);
  };

  for (const punch of stale) {
    try {
      // Fall back to deriving the attendance date from the punch itself when
      // the row doesn't carry one — older rows predate that field being set.
      let attendanceDate = punch.attendanceDate;
      if (!attendanceDate) {
        attendanceDate = attendanceService.normalizeDate(punch.punchedAt);
      }

      const dateKey = new Date(attendanceDate).toISOString();

      let record = touchedRecords.get(dateKey);
      if (!record) {
        record = await AttendanceRecord.findOne({ date: attendanceDate });
        if (!record) {
          miss('no AttendanceRecord for that date', `PIN ${punch.pin} · ${dateKey.slice(0, 10)}`);
          continue;
        }
        touchedRecords.set(dateKey, record);
      }

      const employee = record.employees.find((e) => String(e.userId) === String(punch.userId));
      if (!employee) {
        miss('employee not in that record', `PIN ${punch.pin} · userId ${punch.userId}`);
        continue;
      }

      // Match on timestamp. recordPunchEvent stored punchedAt verbatim, so an
      // exact match is expected — but tolerate a second of drift rather than
      // silently skipping, since a near-miss here is indistinguishable from
      // "no event at all" and that is what made the first version useless.
      const target = new Date(punch.punchedAt).getTime();
      const biometricEvents = employee.events.filter((ev) =>
        String(ev.device || '').startsWith('BIOMETRIC:')
      );

      const event =
        biometricEvents.find((ev) => Math.abs(new Date(ev.timestamp).getTime() - target) < 1000) ||
        null;

      if (!event) {
        const shown = employee.events
          .map((ev) => `${ev.type}@${ist(ev.timestamp)}${ev.device ? '' : ' (no device)'}`)
          .join(', ') || 'none';
        miss(
          'no matching BIOMETRIC event',
          `PIN ${punch.pin} · looking for ${ist(punch.punchedAt)} · record has: ${shown}`
        );
        continue;
      }

      const before = new Date(event.timestamp);
      const after = new Date(before.getTime() + OFFSET * 60000);

      console.log(`  PIN ${String(punch.pin).padEnd(4)} ${event.type.padEnd(10)} ${ist(before)} → ${ist(after)}`);

      if (!DRY_RUN) {
        event.timestamp = after;
        // Mark the row corrected immediately, so an interruption can't leave a
        // punch that gets shifted a second time on the next run.
        await BiometricPunch.updateOne({ _id: punch._id }, { appliedOffsetMinutes: OFFSET });
      }
      shifted += 1;
    } catch (err) {
      console.error(`  ✗ PIN ${punch.pin}: ${err.message}`);
      failed += 1;
    }
  }

  // Recalculate once per record, after all its events have moved — arrival,
  // departure, durations and the late flag are all derived from the timestamps
  // we just changed, so leaving them stale would be worse than not shifting.
  if (!DRY_RUN) {
    for (const record of touchedRecords.values()) {
      for (const employee of record.employees) {
        attendanceService.recalculateEmployeeData(employee, record.date);
      }
      attendanceService.updateDailyStats(record);
      await record.save();
    }
  }

  console.log('─'.repeat(96));
  console.log(`  ${DRY_RUN ? 'would shift' : 'shifted'} : ${shifted}`);
  console.log(`  skipped           : ${notFound}`);
  for (const [why, n] of Object.entries(missReasons)) {
    console.log(`      ${n} × ${why}`);
  }
  console.log(`  failed            : ${failed}`);
  console.log(`  records recalculated : ${DRY_RUN ? 0 : touchedRecords.size}`);

  if (DRY_RUN) console.log('\nRe-run without --dry-run to apply.');
  else console.log('\nDone. Re-running is safe — corrected punches are now marked and will be skipped.');

  process.exit(0);
})().catch((e) => { console.error('Failed:', e.message); process.exit(1); });
