// scripts/undoPrematureAutoClose.js
//
// Remove PUNCH_OUT events written by the auto-close job before its shift-end
// bug was fixed, reopening days that were closed while people were still at
// work.
//
//     node scripts/undoPrematureAutoClose.js --dry-run
//     node scripts/undoPrematureAutoClose.js
//     node scripts/undoPrematureAutoClose.js --hours 48
//
// ─────────────────────────────────────────────────────────────────────────────
// WHAT WENT WRONG
// ─────────────────────────────────────────────────────────────────────────────
// getShiftEndUTC read the attendance date with getUTCDate(). Records are
// normalised to SERVER-LOCAL midnight, so a record for 5 Aug is stored as
// 2026-08-04T18:30:00Z and that call returned 4 — a day early. The computed
// shift end therefore sat a full day in the past, every employee was instantly
// "past shift end + grace", and the job closed their day the morning they
// arrived.
//
// From the outside this looked like the fingerprint terminal ending someone's
// shift when they scanned to open the door — which the terminal has not done
// since resolveAction was changed. The auto-close job was doing it.
//
// Only removes PUNCH_OUT events tagged device: "SYSTEM:AUTO_CLOSE". A real
// punch-out from the CRM is left alone: the employee meant that one.
'use strict';

require('dotenv').config();
const mongoose = require('mongoose');

const args = process.argv.slice(2);
const DRY_RUN = args.includes('--dry-run');
const argVal = (n, d) => { const i = args.indexOf(`--${n}`); return i >= 0 && args[i + 1] ? args[i + 1] : d; };
const HOURS = Number(argVal('hours', 36));

const ist = (d) => new Intl.DateTimeFormat('en-GB', {
  timeZone: 'Asia/Kolkata', day: '2-digit', month: 'short',
  hour: '2-digit', minute: '2-digit', hour12: true,
}).format(new Date(d));

(async () => {
  await mongoose.connect(process.env.MONGODB_URI || process.env.MONGO_URI);

  const AttendanceRecord = require('../models/AttendanceRecord');
  const User = require('../models/User');
  const AttendanceService = require('../services/AttendanceService');
  const attendanceService = new AttendanceService();

  const nowTs = Date.now();
  const records = await AttendanceRecord.find({
    date: { $gte: new Date(nowTs - HOURS * 3600 * 1000), $lte: new Date(nowTs + 12 * 3600 * 1000) },
  });

  let reopened = 0;
  const touched = new Set();

  console.log(`\nUndoing premature auto-closes (last ${HOURS}h)${DRY_RUN ? '  — DRY RUN' : ''}\n`);
  console.log('─'.repeat(90));

  for (const record of records) {
    for (const employee of record.employees || []) {
      const autoClosed = (employee.events || []).filter(
        (e) => e.type === 'PUNCH_OUT' && String(e.device || '') === 'SYSTEM:AUTO_CLOSE'
      );
      if (!autoClosed.length) continue;

      const user = await User.findById(employee.userId).select('name').lean();

      for (const ev of autoClosed) {
        console.log(
          `  ${(user?.name || String(employee.userId)).padEnd(24)} removing PUNCH_OUT @ ${ist(ev.timestamp)}`
        );
      }

      if (!DRY_RUN) {
        employee.events = employee.events.filter(
          (e) => !(e.type === 'PUNCH_OUT' && String(e.device || '') === 'SYSTEM:AUTO_CLOSE')
        );
        touched.add(record);
      }
      reopened += autoClosed.length;
    }
  }

  if (!DRY_RUN) {
    for (const record of touched) {
      for (const employee of record.employees) {
        // Recompute from the remaining events — status returns to WORKING and
        // the work timer resumes from the arrival, instead of being frozen at
        // a departure that never happened.
        attendanceService.recalculateEmployeeData(employee, record.date);
      }
      attendanceService.updateDailyStats(record);
      await record.save();
    }
  }

  console.log('─'.repeat(90));
  console.log(`  ${DRY_RUN ? 'would remove' : 'removed'} : ${reopened} auto-close punch-out(s)`);
  console.log(`  records recalculated : ${DRY_RUN ? 0 : touched.size}`);
  if (DRY_RUN) console.log('\nRe-run without --dry-run to apply.');
  else console.log('\nThose days are open again. Deploy the getShiftEndUTC fix before the job runs on the hour.');
  process.exit(0);
})().catch((e) => { console.error('Failed:', e.message); process.exit(1); });
